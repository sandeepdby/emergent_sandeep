"""Tests for bulk-approve endorsements endpoint with CD Ledger auto-deduction (iteration 46)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://insurehub-portal.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN = {"username": "masteradmin", "password": "Admin@123"}
HR = {"username": "arpita", "password": "Password@123"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def hr_token():
    r = requests.post(f"{API}/auth/login", json=HR, timeout=30)
    assert r.status_code == 200, f"HR login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def hr_headers(hr_token):
    return {"Authorization": f"Bearer {hr_token}", "Content-Type": "application/json"}


class TestBulkApproveEndpoint:
    """POST /api/endorsements/bulk-approve"""

    def test_admin_login(self, admin_token):
        assert admin_token and isinstance(admin_token, str)

    def test_endorsements_list_reachable(self, admin_headers):
        r = requests.get(f"{API}/endorsements", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_stats_summary_reachable(self, admin_headers):
        r = requests.get(f"{API}/endorsements/stats/summary", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "total_endorsements" in data

    def test_hr_forbidden_from_bulk_approve(self, hr_headers):
        r = requests.post(f"{API}/endorsements/bulk-approve",
                          headers=hr_headers,
                          json={"endorsement_ids": [str(uuid.uuid4())], "status": "Approved"},
                          timeout=30)
        assert r.status_code == 403, f"Expected 403 for non-admin, got {r.status_code}"

    def test_bulk_approve_nonexistent_ids(self, admin_headers):
        fake_ids = [str(uuid.uuid4()), str(uuid.uuid4())]
        r = requests.post(f"{API}/endorsements/bulk-approve",
                          headers=admin_headers,
                          json={"endorsement_ids": fake_ids, "status": "Approved", "remarks": "TEST_nonexistent"},
                          timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["success_count"] == 0
        assert data["failed_count"] == 2
        assert data["status"] == "Approved"

    def test_bulk_approve_invalid_status(self, admin_headers):
        r = requests.post(f"{API}/endorsements/bulk-approve",
                          headers=admin_headers,
                          json={"endorsement_ids": [str(uuid.uuid4())], "status": "InvalidStatus"},
                          timeout=30)
        assert r.status_code == 422

    def test_bulk_approve_real_pending(self, admin_headers):
        """End-to-end: pick one pending endorsement, approve it, verify status change & CD ledger entry."""
        r = requests.get(f"{API}/endorsements", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        endorsements = r.json()
        pending = [e for e in endorsements if e.get("status") == "Pending"]
        if not pending:
            pytest.skip("No pending endorsements to test bulk-approve")

        target = pending[0]
        target_id = target["id"]
        policy_number = target.get("policy_number")
        prorata = target.get("prorata_premium") or 0

        # Snapshot CD ledger count for this policy
        ledger_before = requests.get(f"{API}/cd-ledger", headers=admin_headers, timeout=30)
        ledger_before_ok = ledger_before.status_code == 200
        before_count = 0
        if ledger_before_ok:
            entries = ledger_before.json()
            if isinstance(entries, list):
                before_count = sum(1 for e in entries if e.get("endorsement_id") == target_id)

        # Approve
        resp = requests.post(f"{API}/endorsements/bulk-approve",
                             headers=admin_headers,
                             json={"endorsement_ids": [target_id], "status": "Approved", "remarks": "TEST_iter46_approve"},
                             timeout=60)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["success_count"] == 1, f"Expected success_count=1, got {data}"
        assert data["failed_count"] == 0
        assert data["status"] == "Approved"

        # Verify status persisted (GET one)
        one = requests.get(f"{API}/endorsements/{target_id}", headers=admin_headers, timeout=30)
        if one.status_code == 200:
            body = one.json()
            assert body.get("status") == "Approved"
            assert body.get("remarks") == "TEST_iter46_approve"
        else:
            # fallback via list
            listing = requests.get(f"{API}/endorsements", headers=admin_headers, timeout=30).json()
            match = next((e for e in listing if e["id"] == target_id), None)
            assert match and match["status"] == "Approved"

        # Verify CD ledger entry created (if prorata != 0)
        if prorata and ledger_before_ok:
            ledger_after = requests.get(f"{API}/cd-ledger", headers=admin_headers, timeout=30)
            if ledger_after.status_code == 200:
                entries = ledger_after.json()
                matched = [e for e in entries if e.get("endorsement_id") == target_id]
                assert len(matched) >= 1, "CD ledger entry not created for approved endorsement with prorata_premium"
                entry = matched[0]
                # amount stored as -prorata
                assert abs(entry.get("amount", 0) + prorata) < 0.01, \
                    f"CD ledger amount {entry.get('amount')} != -prorata {-prorata}"
                assert entry.get("policy_number") == policy_number

    def test_bulk_approve_already_processed(self, admin_headers):
        """Approving already-approved endorsement should return failed_count>0."""
        r = requests.get(f"{API}/endorsements", headers=admin_headers, timeout=30)
        approved = [e for e in r.json() if e.get("status") == "Approved"]
        if not approved:
            pytest.skip("No approved endorsements available")
        target_id = approved[0]["id"]
        resp = requests.post(f"{API}/endorsements/bulk-approve",
                             headers=admin_headers,
                             json={"endorsement_ids": [target_id], "status": "Approved"},
                             timeout=30)
        assert resp.status_code == 200
        data = resp.json()
        assert data["success_count"] == 0
        assert data["failed_count"] == 1

    def test_bulk_reject_real_pending(self, admin_headers):
        r = requests.get(f"{API}/endorsements", headers=admin_headers, timeout=30)
        pending = [e for e in r.json() if e.get("status") == "Pending"]
        if not pending:
            pytest.skip("No pending endorsements available to reject")
        target_id = pending[0]["id"]
        resp = requests.post(f"{API}/endorsements/bulk-approve",
                             headers=admin_headers,
                             json={"endorsement_ids": [target_id], "status": "Rejected", "remarks": "TEST_iter46_reject"},
                             timeout=30)
        assert resp.status_code == 200
        data = resp.json()
        assert data["success_count"] == 1
        assert data["status"] == "Rejected"

        # verify no CD ledger entry created for rejection
        ledger = requests.get(f"{API}/cd-ledger", headers=admin_headers, timeout=30)
        if ledger.status_code == 200:
            entries = ledger.json()
            if isinstance(entries, list):
                matched = [e for e in entries if e.get("endorsement_id") == target_id]
                assert len(matched) == 0, "CD ledger entry unexpectedly created on rejection"
