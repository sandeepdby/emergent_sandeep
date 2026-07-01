"""Iteration 35 — Family Group View in Employee Directory.

The Family Group View is purely client-side (groups the /api/employee-directory
response by employee_id). This suite exercises the backend contract that
underpins that view:
  * GET /api/employee-directory returns >= 11 active members
  * The Kumar family (4 members, employee_id=FAM001) is fully returned
  * Search filter matches Kumar family
  * Fields required by the frontend (per_life_premium, relationship_type,
    age, gender, dob) are populated
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://insurehub-portal.preview.emergentagent.com").rstrip("/")

HR_CREDS = {"username": "arpita", "password": "Password@123"}
ADMIN_CREDS = {"username": "masteradmin", "password": "Admin@123"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def hr_token():
    return _login(HR_CREDS)


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_CREDS)


@pytest.fixture(scope="module")
def hr_dir(hr_token):
    r = requests.get(f"{BASE_URL}/api/employee-directory",
                     headers={"Authorization": f"Bearer {hr_token}"}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


# ── Employee Directory basics ────────────────────────────────────────────
class TestDirectoryBasics:
    def test_directory_returns_list(self, hr_dir):
        assert isinstance(hr_dir, list)

    def test_directory_has_at_least_11_members(self, hr_dir):
        assert len(hr_dir) >= 11, f"Expected >=11 active members, got {len(hr_dir)}"

    def test_no_mongo_id_leak(self, hr_dir):
        for m in hr_dir:
            assert "_id" not in m, f"Mongo _id leaked in payload: {m}"

    def test_required_fields_present(self, hr_dir):
        for m in hr_dir:
            for key in ("id", "member_name", "relationship_type", "policy_number"):
                assert key in m, f"Missing key {key} in {m}"


# ── Kumar family group ───────────────────────────────────────────────────
class TestKumarFamily:
    @pytest.fixture
    def kumars(self, hr_dir):
        return [m for m in hr_dir if (m.get("employee_id") == "FAM001")]

    def test_four_kumar_members_exist(self, kumars):
        assert len(kumars) == 4, f"Expected 4 FAM001 members, got {len(kumars)}: {[k.get('member_name') for k in kumars]}"

    def test_all_kumars_share_policy(self, kumars):
        policies = {k.get("policy_number") for k in kumars}
        assert len(policies) == 1, f"Kumar family should share policy, got {policies}"
        assert "GMC0001393000100" in policies

    def test_kumar_relationships(self, kumars):
        rels = sorted(k.get("relationship_type") for k in kumars)
        assert rels == sorted(["Employee", "Spouse", "Kids1", "Kids2"]), f"Unexpected rels: {rels}"

    def test_kumar_names(self, kumars):
        names = sorted(k.get("member_name") for k in kumars)
        assert names == sorted(["Raj Kumar", "Priya Kumar", "Aarav Kumar", "Meera Kumar"]), names

    def test_kumar_premium_total(self, kumars):
        total = sum(k.get("per_life_premium") or 0 for k in kumars)
        assert total == 30000, f"Expected total ₹30,000, got ₹{total}"

    def test_kumar_per_life_rates(self, kumars):
        by_rel = {k["relationship_type"]: k.get("per_life_premium") for k in kumars}
        assert by_rel.get("Employee") == 11500, by_rel
        assert by_rel.get("Spouse") == 11500, by_rel
        assert by_rel.get("Kids1") == 3500, by_rel
        assert by_rel.get("Kids2") == 3500, by_rel

    def test_kumar_display_fields(self, kumars):
        # Fields the FamilyMemberCard renders
        for k in kumars:
            assert k.get("age") is not None, f"Missing age for {k.get('member_name')}"
            assert k.get("gender"), f"Missing gender for {k.get('member_name')}"
            assert k.get("dob"), f"Missing dob for {k.get('member_name')}"


# ── Search filter ────────────────────────────────────────────────────────
class TestSearchFilter:
    def test_search_kumar_returns_four(self, hr_dir):
        s = "kumar"
        matched = [m for m in hr_dir
                   if s in (m.get("member_name") or "").lower()
                   or s in (m.get("employee_id") or "").lower()]
        assert len(matched) == 4, f"Search 'Kumar' should match 4, got {len(matched)}"


# ── Non-family members (edge cases the dialog handles) ───────────────────
class TestNonFamilyEdgeCases:
    def test_john_doe_test_present(self, hr_dir):
        john = [m for m in hr_dir if m.get("employee_id") == "EMP001"]
        assert len(john) >= 1, "EMP001 (John Doe Test) not found"

    def test_john_doe_no_dependents(self, hr_dir):
        john_ids = [m for m in hr_dir if m.get("employee_id") == "EMP001"]
        # Family Group dialog groups by employee_id; single-employee case = "No other family members"
        assert len(john_ids) == 1, f"EMP001 unexpectedly has dependents: {[m.get('relationship_type') for m in john_ids]}"


# ── Admin also sees Kumar family ─────────────────────────────────────────
class TestAdminView:
    def test_admin_sees_kumar_family(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/employee-directory",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 200
        data = r.json()
        kumars = [m for m in data if m.get("employee_id") == "FAM001"]
        assert len(kumars) == 4, f"Admin should also see 4 Kumar members, got {len(kumars)}"


# ── Regression: history endpoint still works ─────────────────────────────
class TestHistoryRegression:
    def test_history_endpoint_still_reachable(self, hr_token):
        r = requests.get(
            f"{BASE_URL}/api/employee-directory/history?employee_id=EMP001&policy_number=TEST_POL_112123",
            headers={"Authorization": f"Bearer {hr_token}"}, timeout=15,
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list)
