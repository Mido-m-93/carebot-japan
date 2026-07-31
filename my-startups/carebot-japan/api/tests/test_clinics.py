# apps/api/tests/test_clinics.py
"""
Tests for routers/clinics.py's PATCH /clinics/me -- lets a clinic owner
rename their clinic (and update phone) from the dashboard, instead of only
being editable directly in Supabase.
"""


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
