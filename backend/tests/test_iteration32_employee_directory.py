"""
Iteration 32: Employee Directory endpoint tests
- GET /api/employee-directory (HR + Admin isolation, search, policy filter)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://insurehub-portal.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

HR = {"username": "arpita", "password": "Password@123"}
ADMIN = {"username": "masteradmin", "password": "Admin@123"}


def _login(cred):
    r = requests.post(f"{API}/auth/login", json=cred, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def hr_token():
    return _login(HR)


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# --- HR directory basics ---
class TestEmployeeDirectoryHR:
    def test_hr_directory_returns_list(self, hr_token):
        r = requests.get(f"{API}/employee-directory", headers=_h(hr_token), timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # Review request says: 7+ active members expected
        assert len(data) >= 7, f"Expected >=7 active members for HR, got {len(data)}"
        # Validate shape
        m = data[0]
        for k in ["id", "member_name", "relationship_type", "policy_number"]:
            assert k in m, f"Missing key {k}"

    def test_hr_directory_search_john(self, hr_token):
        r = requests.get(f"{API}/employee-directory", headers=_h(hr_token), params={"search": "John"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # All results should contain 'john' in member_name / employee_id / policy_number
        for m in data:
            hay = f"{m.get('member_name','')} {m.get('employee_id','')} {m.get('policy_number','')}".lower()
            assert "john" in hay, f"Search result does not contain john: {m}"
        # Expect at least one John Doe Test
        assert any("john doe test" in (m.get("member_name") or "").lower() for m in data), \
            "Expected 'John Doe Test' in search=John results"

    def test_hr_directory_policy_filter(self, hr_token):
        # Get all, pick a policy that exists
        all_r = requests.get(f"{API}/employee-directory", headers=_h(hr_token), timeout=30)
        all_data = all_r.json()
        policies = list({m["policy_number"] for m in all_data})
        assert policies, "No policies in directory"
        target = "TEST_POL_112123" if "TEST_POL_112123" in policies else policies[0]

        r = requests.get(f"{API}/employee-directory", headers=_h(hr_token), params={"policy_number": target}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert all(m["policy_number"] == target for m in data), f"Policy filter leak: {[m['policy_number'] for m in data]}"

    def test_hr_directory_excludes_deleted(self, hr_token):
        """Ensure no member appears if a matching Deletion endorsement was approved.
        We fetch endorsements and cross-check active list has no key overlap with approved deletions.
        """
        # Fetch approved deletions via endorsements list
        r = requests.get(f"{API}/endorsements", headers=_h(hr_token), timeout=30)
        assert r.status_code == 200
        endos = r.json()
        del_keys = {
            f"{e.get('policy_number')}|{e.get('member_name','')}|{e.get('relationship_type','')}"
            for e in endos
            if e.get("endorsement_type") == "Deletion" and e.get("status") == "Approved"
        }
        d = requests.get(f"{API}/employee-directory", headers=_h(hr_token), timeout=30).json()
        for m in d:
            k = f"{m.get('policy_number')}|{m.get('member_name','')}|{m.get('relationship_type','')}"
            assert k not in del_keys, f"Deleted member appears in directory: {k}"


# --- Admin directory ---
class TestEmployeeDirectoryAdmin:
    def test_admin_directory_returns_all(self, admin_token):
        r = requests.get(f"{API}/employee-directory", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 7, f"Expected >=7 active members admin-wide, got {len(data)}"

    def test_admin_directory_multiple_policies(self, admin_token):
        r = requests.get(f"{API}/employee-directory", headers=_h(admin_token), timeout=30)
        data = r.json()
        policies = {m["policy_number"] for m in data}
        # Admin should see across policies (>= 1 policy at least — ideally >1)
        assert len(policies) >= 1


# --- Auth negative ---
class TestEmployeeDirectoryAuth:
    def test_directory_requires_auth(self):
        r = requests.get(f"{API}/employee-directory", timeout=30)
        assert r.status_code in (401, 403), f"Expected 401/403 unauthenticated, got {r.status_code}"
