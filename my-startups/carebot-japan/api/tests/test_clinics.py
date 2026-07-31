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
