# apps/api/tests/test_queue.py
"""
Tests for routers/queue.py's GET /queue -- specifically that Test Message
tool rows (is_test) never inflate the real pending-review count.
"""

CLINIC_ID = "clinic-1"


class TestListQueueExcludesTestRows:
    def test_test_rows_excluded_by_default(self, queue_client, seed_clinic, fake_db):
        _clinic_id, token = seed_clinic(token="owner-token")
        fake_db.rows["review_queue"] = [
            {"id": "real-1", "clinic_id": CLINIC_ID, "status": "pending", "is_test": False},
            {"id": "test-1", "clinic_id": CLINIC_ID, "status": "pending", "is_test": True},
        ]

        res = queue_client.get("/queue", headers={"Authorization": f"Bearer {token}"})

        assert res.status_code == 200
        ids = [i["id"] for i in res.json()]
        assert ids == ["real-1"]

    def test_include_test_returns_everything(self, queue_client, seed_clinic, fake_db):
        _clinic_id, token = seed_clinic(token="owner-token")
        fake_db.rows["review_queue"] = [
            {"id": "real-1", "clinic_id": CLINIC_ID, "status": "pending", "is_test": False},
            {"id": "test-1", "clinic_id": CLINIC_ID, "status": "pending", "is_test": True},
        ]

        res = queue_client.get("/queue?include_test=true", headers={"Authorization": f"Bearer {token}"})

        assert res.status_code == 200
        ids = {i["id"] for i in res.json()}
        assert ids == {"real-1", "test-1"}

    def test_still_filters_by_status(self, queue_client, seed_clinic, fake_db):
        _clinic_id, token = seed_clinic(token="owner-token")
        fake_db.rows["review_queue"] = [
            {"id": "pending-1", "clinic_id": CLINIC_ID, "status": "pending", "is_test": False},
            {"id": "resolved-1", "clinic_id": CLINIC_ID, "status": "resolved", "is_test": False},
        ]

        res = queue_client.get("/queue", headers={"Authorization": f"Bearer {token}"})

        assert res.status_code == 200
        ids = [i["id"] for i in res.json()]
        assert ids == ["pending-1"]
