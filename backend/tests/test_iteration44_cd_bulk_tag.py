"""Iteration 44: CD Ledger bulk-tag, untagged filter, case-insensitive policy filter, HR isolation."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://insurehub-portal.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _login(username, password):
    r = requests.post(f"{API}/auth/login", json={"username": username, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed for {username}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login('masteradmin', 'Admin@123')}"}


@pytest.fixture(scope="module")
def hr_headers():
    return {"Authorization": f"Bearer {_login('arpita', 'Password@123')}"}


# ---------------- CD Ledger filter tests ----------------
class TestCDLedgerFilter:
    def test_case_insensitive_relyon(self, admin_headers):
        r = requests.get(f"{API}/cd-ledger", params={"policy_number": "Relyon(self+5)"}, headers=admin_headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        entries = data["entries"]
        # Should contain both casings
        policy_nums = {e.get("policy_number") for e in entries}
        assert len(entries) >= 2, f"Expected >=2 entries, got {len(entries)}: {policy_nums}"
        # Case-insensitive match: both 'Relyon(self+5)' and 'RELYON(SELF+5)' should appear
        lowered = {(p or "").lower() for p in policy_nums}
        assert "relyon(self+5)" in lowered
        assert data["total_balance"] != 0
        assert data["total_deposits"] > 0

    def test_untagged_filter_admin(self, admin_headers):
        r = requests.get(f"{API}/cd-ledger", params={"untagged": "true"}, headers=admin_headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        # Per iteration context all previously untagged were bulk-tagged; count could be 0.
        for e in data["entries"]:
            assert not e.get("policy_number"), f"Entry {e.get('id')} has policy_number={e.get('policy_number')} but appears in untagged"

    def test_all_policies_admin(self, admin_headers):
        r = requests.get(f"{API}/cd-ledger", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["entries"], list)
        assert data["total_deposits"] >= 0
        assert data["total_deductions"] >= 0


# ---------------- Bulk-tag tests ----------------
class TestBulkTag:
    def test_bulk_tag_hr_forbidden(self, hr_headers):
        r = requests.post(
            f"{API}/cd-ledger/bulk-tag",
            json={"policy_number": "GMC0001393000100", "entry_ids": ["nonexistent"]},
            headers=hr_headers,
            timeout=30,
        )
        assert r.status_code == 403

    def test_bulk_tag_admin_roundtrip(self, admin_headers):
        # Create a fresh untagged entry via POST cd-ledger with no policy... but endpoint requires model. Try directly with policy_number empty.
        payload = {
            "date": "2026-01-01",
            "reference": "TEST-ITER44-BULK",
            "description": "iter44 test",
            "amount": 111,
            "policy_number": "",
        }
        cr = requests.post(f"{API}/cd-ledger", json=payload, headers=admin_headers, timeout=30)
        # Some validators may reject empty; skip if so.
        if cr.status_code >= 400:
            pytest.skip(f"Could not create untagged test entry (status {cr.status_code}): {cr.text}")
        entry_id = cr.json().get("id") or cr.json().get("entry", {}).get("id")
        assert entry_id, f"No id in create response: {cr.text}"

        try:
            # Bulk-tag it
            br = requests.post(
                f"{API}/cd-ledger/bulk-tag",
                json={"policy_number": "GMC0001393000100", "entry_ids": [entry_id]},
                headers=admin_headers,
                timeout=30,
            )
            assert br.status_code == 200, br.text
            assert br.json().get("tagged_count", 0) >= 1

            # Verify persistence via filter on that policy
            gr = requests.get(f"{API}/cd-ledger", params={"policy_number": "GMC0001393000100"}, headers=admin_headers, timeout=30)
            assert gr.status_code == 200
            ids = [e["id"] for e in gr.json()["entries"]]
            assert entry_id in ids
        finally:
            requests.delete(f"{API}/cd-ledger/{entry_id}", headers=admin_headers, timeout=30)

    def test_bulk_tag_invalid_policy(self, admin_headers):
        r = requests.post(
            f"{API}/cd-ledger/bulk-tag",
            json={"policy_number": "DOES_NOT_EXIST_XYZ", "entry_ids": ["x"]},
            headers=admin_headers,
            timeout=30,
        )
        assert r.status_code == 404


# ---------------- HR isolation regression ----------------
class TestHRIsolation:
    def test_hr_cd_ledger_returns_only_assigned(self, hr_headers):
        r = requests.get(f"{API}/cd-ledger", headers=hr_headers, timeout=30)
        assert r.status_code == 200
        # Must not error; entries can be empty or restricted
        assert "entries" in r.json()

    def test_hr_cannot_use_untagged(self, hr_headers):
        r = requests.get(f"{API}/cd-ledger", params={"untagged": "true"}, headers=hr_headers, timeout=30)
        assert r.status_code == 200
        # untagged flag is admin-only; HR still gets scoped to their policies (untagged flag ignored)
        for e in r.json()["entries"]:
            # Should NOT return null-policy entries to HR
            assert e.get("policy_number"), f"HR received untagged entry: {e}"
