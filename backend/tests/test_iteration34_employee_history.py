"""Iteration 34: Employee Coverage History endpoint tests"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


def _login(username, password):
    r = requests.post(f"{API}/auth/login", json={"username": username, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed for {username}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def hr_token():
    return _login("arpita", "Password@123")


@pytest.fixture(scope="module")
def admin_token():
    return _login("masteradmin", "Admin@123")


def _hdrs(tok):
    return {"Authorization": f"Bearer {tok}"}


class TestEmployeeHistory:
    def test_history_by_employee_id_and_policy(self, hr_token):
        r = requests.get(
            f"{API}/employee-directory/history",
            params={"employee_id": "EMP001", "policy_number": "TEST_POL_112123"},
            headers=_hdrs(hr_token), timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1, f"Expected >=1 event, got {len(data)}"
        ev = data[0]
        expected_fields = ["endorsement_type", "status", "member_name", "relationship_type",
                           "prorata_premium", "endorsement_date", "submitted_by_name"]
        for f in expected_fields:
            assert f in ev, f"Missing field {f}: {ev}"
        assert ev["member_name"] == "John Doe Test"

    def test_history_by_member_name(self, hr_token):
        r = requests.get(
            f"{API}/employee-directory/history",
            params={"member_name": "John Doe Test"},
            headers=_hdrs(hr_token), timeout=30,
        )
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        for ev in data:
            assert ev["member_name"] == "John Doe Test"

    def test_history_no_params_returns_400(self, hr_token):
        r = requests.get(f"{API}/employee-directory/history", headers=_hdrs(hr_token), timeout=30)
        assert r.status_code == 400

    def test_history_hr_isolation(self, hr_token):
        # HR should get only assigned policies. Query with unassigned policy → empty
        r = requests.get(
            f"{API}/employee-directory/history",
            params={"employee_id": "EMP001", "policy_number": "NONEXISTENT_POLICY_XYZ"},
            headers=_hdrs(hr_token), timeout=30,
        )
        assert r.status_code == 200
        assert r.json() == []

    def test_history_admin_access(self, admin_token):
        r = requests.get(
            f"{API}/employee-directory/history",
            params={"employee_id": "EMP001", "policy_number": "TEST_POL_112123"},
            headers=_hdrs(admin_token), timeout=30,
        )
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_history_unauthorized(self):
        r = requests.get(
            f"{API}/employee-directory/history",
            params={"employee_id": "EMP001"}, timeout=30,
        )
        assert r.status_code in [401, 403]

    def test_history_sorted_chronologically(self, hr_token):
        r = requests.get(
            f"{API}/employee-directory/history",
            params={"member_name": "John Doe Test"},
            headers=_hdrs(hr_token), timeout=30,
        )
        assert r.status_code == 200
        data = r.json()
        if len(data) >= 2:
            dates = [e.get("created_at") for e in data]
            assert dates == sorted(dates), "Events not sorted chronologically"

    def test_history_nonexistent_employee(self, hr_token):
        r = requests.get(
            f"{API}/employee-directory/history",
            params={"employee_id": "NONEXIST_EMP_ZZZ"},
            headers=_hdrs(hr_token), timeout=30,
        )
        assert r.status_code == 200
        assert r.json() == []
