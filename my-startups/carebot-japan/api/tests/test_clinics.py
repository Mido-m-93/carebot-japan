# apps/api/tests/test_clinics.py
"""
Tests for routers/clinics.py's PATCH /clinics/me -- lets a clinic owner
rename their clinic (and update phone) from the dashboard, instead of only
being editable directly in Supabase.
"""
from unittest.mock import patch

import routers.clinics as clinics_module


class TestOnboardClinicLineChannelIdUniqueness:
    """
    Two clinics silently sharing a LINE Channel ID used to route real
    patient messages to whichever clinic's row the database happened to
    return first (see routers/webhooks.py's _resolve_clinic_by_line_channel).
    onboard_clinic must reject a duplicate before it ever gets created.
    """

    def test_rejects_a_line_channel_id_already_used_by_another_clinic(self, clinics_client, seed_clinic, fake_db):
        seed_clinic(clinic_id="clinic-1", token="existing-owner-token", line_channel_id="shared-channel")
        fake_db.auth.register_token("new-user-token", "new-user-1")

        res = clinics_client.post(
            "/clinics/onboard",
            json={"name": "New Clinic", "line_channel_id": "shared-channel"},
            headers={"Authorization": "Bearer new-user-token"},
        )

        assert res.status_code == 409
        assert "already connected" in res.json()["detail"].lower()
        # No orphaned clinic (or clinic_users row) was left behind.
        assert len(fake_db.rows.get("clinics", [])) == 1
        assert len(fake_db.rows.get("clinic_users", [])) == 1

    def test_allows_a_unique_line_channel_id(self, clinics_client, fake_db):
        fake_db.auth.register_token("new-user-token", "new-user-1")

        res = clinics_client.post(
            "/clinics/onboard",
            json={"name": "New Clinic", "line_channel_id": "unique-channel"},
            headers={"Authorization": "Bearer new-user-token"},
        )

        assert res.status_code == 200
        assert fake_db.rows["clinics"][0]["line_channel_id"] == "unique-channel"

    def test_allows_onboarding_with_no_line_channel_id(self, clinics_client, fake_db):
        fake_db.auth.register_token("new-user-token", "new-user-1")

        res = clinics_client.post(
            "/clinics/onboard",
            json={"name": "New Clinic"},
            headers={"Authorization": "Bearer new-user-token"},
        )

        assert res.status_code == 200


class TestCreateLocationLineChannelIdUniqueness:
    def test_rejects_a_line_channel_id_already_used_by_another_clinic(self, clinics_client, seed_clinic, fake_db):
        _primary_id, token = seed_clinic(token="owner-token", tier="enterprise")
        seed_clinic(clinic_id="other-clinic", user_id="user-2", token="other-token", line_channel_id="taken-channel")

        res = clinics_client.post(
            "/clinics/locations",
            json={"name": "Branch", "line_channel_id": "taken-channel"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert res.status_code == 409


class TestGetMyClinic:
    def test_returns_editable_fields_for_the_settings_page(self, clinics_client, seed_clinic, fake_db):
        seed_clinic(token="owner-token", name_jp="テストクリニック", phone="03-0000-0000")
        res = clinics_client.get("/clinics/me", headers={"Authorization": "Bearer owner-token"})

        assert res.status_code == 200
        body = res.json()
        assert body["name"] == "Test Clinic"
        assert body["name_jp"] == "テストクリニック"
        assert body["phone"] == "03-0000-0000"
        assert body["role"] == "owner"

    def test_line_channel_configured_is_false_when_not_set_up(self, clinics_client, seed_clinic):
        seed_clinic(token="owner-token")
        res = clinics_client.get("/clinics/me", headers={"Authorization": "Bearer owner-token"})

        assert res.status_code == 200
        assert res.json()["line_channel_configured"] is False

    def test_line_channel_configured_requires_both_secret_and_token(self, clinics_client, seed_clinic):
        seed_clinic(token="owner-token", line_channel_secret="s3cr3t")
        res = clinics_client.get("/clinics/me", headers={"Authorization": "Bearer owner-token"})

        # Secret alone isn't enough -- both must be set for LINE replies to work.
        assert res.json()["line_channel_configured"] is False

    def test_line_channel_configured_true_and_secret_never_leaked(self, clinics_client, seed_clinic):
        seed_clinic(
            token="owner-token",
            line_channel_secret="s3cr3t",
            line_channel_access_token="t0k3n",
        )
        res = clinics_client.get("/clinics/me", headers={"Authorization": "Bearer owner-token"})

        body = res.json()
        assert body["line_channel_configured"] is True
        assert "line_channel_secret" not in body
        assert "line_channel_access_token" not in body


class TestUpdateMyClinic:
    def test_owner_can_update_name(self, clinics_client, seed_clinic, fake_db):
        seed_clinic(token="owner-token")
        res = clinics_client.patch(
            "/clinics/me",
            json={"name": "Sakura Dental Clinic"},
            headers={"Authorization": "Bearer owner-token"},
        )

        assert res.status_code == 200
        assert res.json()["name"] == "Sakura Dental Clinic"
        assert fake_db.rows["clinics"][0]["name"] == "Sakura Dental Clinic"

    def test_owner_can_update_name_jp_and_phone(self, clinics_client, seed_clinic, fake_db):
        seed_clinic(token="owner-token")
        res = clinics_client.patch(
            "/clinics/me",
            json={"name_jp": "さくら歯科クリニック", "phone": "03-1234-5678"},
            headers={"Authorization": "Bearer owner-token"},
        )

        assert res.status_code == 200
        assert fake_db.rows["clinics"][0]["name_jp"] == "さくら歯科クリニック"
        assert fake_db.rows["clinics"][0]["phone"] == "03-1234-5678"

    def test_non_owner_is_forbidden(self, clinics_client, seed_clinic, fake_db):
        seed_clinic(role="staff", token="staff-token")
        res = clinics_client.patch(
            "/clinics/me",
            json={"name": "New Name"},
            headers={"Authorization": "Bearer staff-token"},
        )

        assert res.status_code == 403
        assert "owner" in res.json()["detail"].lower()
        # Unchanged.
        assert fake_db.rows["clinics"][0]["name"] == "Test Clinic"

    def test_empty_name_is_rejected(self, clinics_client, seed_clinic, fake_db):
        seed_clinic(token="owner-token")
        res = clinics_client.patch(
            "/clinics/me",
            json={"name": "   "},
            headers={"Authorization": "Bearer owner-token"},
        )

        assert res.status_code == 400
        assert fake_db.rows["clinics"][0]["name"] == "Test Clinic"

    def test_no_fields_is_rejected(self, clinics_client, seed_clinic):
        seed_clinic(token="owner-token")
        res = clinics_client.patch(
            "/clinics/me",
            json={},
            headers={"Authorization": "Bearer owner-token"},
        )

        assert res.status_code == 400

    def test_requires_auth(self, clinics_client):
        res = clinics_client.patch("/clinics/me", json={"name": "New Name"})
        assert res.status_code == 401

    def test_owner_can_set_line_channel_id(self, clinics_client, seed_clinic, fake_db):
        seed_clinic(token="owner-token")
        res = clinics_client.patch(
            "/clinics/me",
            json={"line_channel_id": "1234567890"},
            headers={"Authorization": "Bearer owner-token"},
        )

        assert res.status_code == 200
        assert fake_db.rows["clinics"][0]["line_channel_id"] == "1234567890"

    def test_owner_can_set_line_channel_secret_and_token(self, clinics_client, seed_clinic, fake_db):
        seed_clinic(token="owner-token")
        with patch.object(clinics_module, "get_bot_user_id", return_value="Uauto-detected00000000000000000000"):
            res = clinics_client.patch(
                "/clinics/me",
                json={"line_channel_secret": "s3cr3t", "line_channel_access_token": "t0k3n"},
                headers={"Authorization": "Bearer owner-token"},
            )

        assert res.status_code == 200
        assert fake_db.rows["clinics"][0]["line_channel_secret"] == "s3cr3t"
        assert fake_db.rows["clinics"][0]["line_channel_access_token"] == "t0k3n"
        # Never echoed back in the response, even right after setting it.
        assert "line_channel_secret" not in res.json()
        assert "line_channel_access_token" not in res.json()

    def test_saving_a_new_access_token_auto_detects_the_bot_user_id(self, clinics_client, seed_clinic, fake_db):
        seed_clinic(token="owner-token")
        with patch.object(clinics_module, "get_bot_user_id", return_value="Uauto-detected00000000000000000000") as mock_lookup:
            res = clinics_client.patch(
                "/clinics/me",
                json={"line_channel_access_token": "t0k3n"},
                headers={"Authorization": "Bearer owner-token"},
            )

        mock_lookup.assert_called_once_with("t0k3n")
        assert res.status_code == 200
        assert fake_db.rows["clinics"][0]["line_channel_id"] == "Uauto-detected00000000000000000000"
        assert res.json()["line_channel_id"] == "Uauto-detected00000000000000000000"
        assert "line_channel_id_lookup_failed" not in res.json()

    def test_auto_detected_id_overrides_a_manually_submitted_one_in_the_same_request(self, clinics_client, seed_clinic, fake_db):
        seed_clinic(token="owner-token")
        with patch.object(clinics_module, "get_bot_user_id", return_value="Uauto-detected00000000000000000000"):
            res = clinics_client.patch(
                "/clinics/me",
                json={"line_channel_id": "manually-typed-value", "line_channel_access_token": "t0k3n"},
                headers={"Authorization": "Bearer owner-token"},
            )

        assert res.status_code == 200
        assert fake_db.rows["clinics"][0]["line_channel_id"] == "Uauto-detected00000000000000000000"

    def test_lookup_failure_still_saves_secret_and_token_and_flags_it(self, clinics_client, seed_clinic, fake_db):
        seed_clinic(token="owner-token")
        with patch.object(clinics_module, "get_bot_user_id", return_value=None):
            res = clinics_client.patch(
                "/clinics/me",
                json={"line_channel_secret": "s3cr3t", "line_channel_access_token": "bad-or-expired-token"},
                headers={"Authorization": "Bearer owner-token"},
            )

        assert res.status_code == 200
        assert res.json()["line_channel_id_lookup_failed"] is True
        assert fake_db.rows["clinics"][0]["line_channel_secret"] == "s3cr3t"
        assert fake_db.rows["clinics"][0]["line_channel_access_token"] == "bad-or-expired-token"
        # Unchanged -- lookup failed, so no line_channel_id was set.
        assert fake_db.rows["clinics"][0].get("line_channel_id") is None

    def test_auto_detected_id_is_still_checked_for_uniqueness(self, clinics_client, seed_clinic, fake_db):
        seed_clinic(clinic_id="clinic-1", token="owner-token")
        seed_clinic(clinic_id="clinic-2", user_id="user-2", token="other-token", line_channel_id="Ualready-taken0000000000000000000")

        with patch.object(clinics_module, "get_bot_user_id", return_value="Ualready-taken0000000000000000000"):
            res = clinics_client.patch(
                "/clinics/me",
                json={"line_channel_access_token": "t0k3n"},
                headers={"Authorization": "Bearer owner-token"},
            )

        assert res.status_code == 409
        # Nothing was saved -- the conflict is caught before the update call.
        assert fake_db.rows["clinics"][0].get("line_channel_access_token") is None

    def test_rejects_a_line_channel_id_already_used_by_another_clinic(self, clinics_client, seed_clinic, fake_db):
        seed_clinic(clinic_id="clinic-1", token="owner-token")
        seed_clinic(clinic_id="clinic-2", user_id="user-2", token="other-token", line_channel_id="taken-channel")

        res = clinics_client.patch(
            "/clinics/me",
            json={"line_channel_id": "taken-channel"},
            headers={"Authorization": "Bearer owner-token"},
        )

        assert res.status_code == 409
        assert "already connected" in res.json()["detail"].lower()
        assert fake_db.rows["clinics"][0].get("line_channel_id") is None  # unchanged

    def test_can_set_its_own_line_channel_id_to_the_value_it_already_has(self, clinics_client, seed_clinic, fake_db):
        seed_clinic(token="owner-token", line_channel_id="my-channel")

        res = clinics_client.patch(
            "/clinics/me",
            json={"name": "Renamed Clinic", "line_channel_id": "my-channel"},
            headers={"Authorization": "Bearer owner-token"},
        )

        assert res.status_code == 200
        assert fake_db.rows["clinics"][0]["line_channel_id"] == "my-channel"

    def test_blank_line_channel_secret_does_not_clear_an_existing_one(self, clinics_client, seed_clinic, fake_db):
        """
        Regression guard: the settings page's secret/token fields are always
        masked blank (the API never returns their real value), so submitting
        the form without touching them must NOT wipe out an already-
        configured credential.
        """
        seed_clinic(token="owner-token", line_channel_secret="existing-secret", line_channel_access_token="existing-token")
        res = clinics_client.patch(
            "/clinics/me",
            json={"name": "Renamed Clinic", "line_channel_secret": "", "line_channel_access_token": ""},
            headers={"Authorization": "Bearer owner-token"},
        )

        assert res.status_code == 200
        assert fake_db.rows["clinics"][0]["name"] == "Renamed Clinic"
        assert fake_db.rows["clinics"][0]["line_channel_secret"] == "existing-secret"
        assert fake_db.rows["clinics"][0]["line_channel_access_token"] == "existing-token"


class TestUpdateLocationStatus:
    """
    PATCH /clinics/locations/{location_id} -- the "deactivate a location"
    button. Soft only: flips `active`, never deletes the row. A location
    needs no separate clinic_users row -- role is inherited from the
    primary clinic's membership (see services.auth._get_clinics_for_user).
    """

    def _seed_location(self, fake_db, primary_id, location_id="location-1", **overrides):
        row = {
            "id": location_id,
            "name": "Branch Clinic",
            "parent_clinic_id": primary_id,
            "tier": "enterprise",
            "created_at": "2026-01-02T00:00:00Z",
            "active": True,
        }
        row.update(overrides)
        fake_db.rows.setdefault("clinics", []).append(row)
        return location_id

    def test_owner_can_deactivate_a_location(self, clinics_client, seed_clinic, fake_db):
        primary_id, token = seed_clinic(token="owner-token")
        location_id = self._seed_location(fake_db, primary_id)

        res = clinics_client.patch(
            f"/clinics/locations/{location_id}",
            json={"active": False},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert res.status_code == 200
        assert res.json()["active"] is False
        stored = next(c for c in fake_db.rows["clinics"] if c["id"] == location_id)
        assert stored["active"] is False
        # Nothing was deleted -- the row is still there.
        assert stored["name"] == "Branch Clinic"

    def test_owner_can_reactivate_a_location(self, clinics_client, seed_clinic, fake_db):
        primary_id, token = seed_clinic(token="owner-token")
        location_id = self._seed_location(fake_db, primary_id, active=False)

        res = clinics_client.patch(
            f"/clinics/locations/{location_id}",
            json={"active": True},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert res.status_code == 200
        stored = next(c for c in fake_db.rows["clinics"] if c["id"] == location_id)
        assert stored["active"] is True

    def test_non_owner_is_forbidden(self, clinics_client, seed_clinic, fake_db):
        primary_id, _ = seed_clinic(role="staff", token="staff-token")
        location_id = self._seed_location(fake_db, primary_id)

        res = clinics_client.patch(
            f"/clinics/locations/{location_id}",
            json={"active": False},
            headers={"Authorization": "Bearer staff-token"},
        )

        assert res.status_code == 403
        stored = next(c for c in fake_db.rows["clinics"] if c["id"] == location_id)
        assert stored["active"] is True  # unchanged

    def test_cannot_deactivate_the_primary_clinic(self, clinics_client, seed_clinic, fake_db):
        primary_id, token = seed_clinic(token="owner-token")

        res = clinics_client.patch(
            f"/clinics/locations/{primary_id}",
            json={"active": False},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert res.status_code == 400
        # Unchanged -- the update was rejected before touching the row.
        assert fake_db.rows["clinics"][0].get("active", True) is True

    def test_unknown_location_is_404(self, clinics_client, seed_clinic):
        _primary_id, token = seed_clinic(token="owner-token")

        res = clinics_client.patch(
            "/clinics/locations/does-not-exist",
            json={"active": False},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert res.status_code == 404

    def test_requires_auth(self, clinics_client):
        res = clinics_client.patch("/clinics/locations/location-1", json={"active": False})
        assert res.status_code == 401
