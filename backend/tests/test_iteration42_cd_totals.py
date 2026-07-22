"""Iteration 42: CD Ledger server-side totals (total_deposits, total_deductions)"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://insurehub-portal.preview.emergentagent.com").rstrip("/")


def _login(username, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"username": username, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login("masteradmin", "Admin@123")


@pytest.fixture(scope="module")
def hr_token():
    return _login("arpita", "Password@123")


def _get_ledger(token, policy=None):
    params = {"policy_number": policy} if policy else {}
    r = requests.get(f"{BASE_URL}/api/cd-ledger", params=params,
                     headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    return r.json()


def test_admin_all_policies_totals(admin_token):
    data = _get_ledger(admin_token)
    assert "total_deposits" in data
    assert "total_deductions" in data
    assert "total_balance" in data
    assert isinstance(data["total_deposits"], (int, float))
    assert isinstance(data["total_deductions"], (int, float))
    assert isinstance(data["total_balance"], (int, float))
    print(f"Admin All: deposits={data['total_deposits']}, deductions={data['total_deductions']}, balance={data['total_balance']}, entries={len(data['entries'])}")
    # Per review: expected exact figures
    assert abs(data["total_deposits"] - 261800.81) < 1.0, f"Expected ~261800.81, got {data['total_deposits']}"
    assert abs(data["total_deductions"] - 185676.62) < 1.0, f"Expected ~185676.62, got {data['total_deductions']}"


def test_admin_policy_filter_totals(admin_token):
    data = _get_ledger(admin_token, "GMC0001393000100")
    print(f"Policy GMC0001393000100: deposits={data['total_deposits']}, deductions={data['total_deductions']}, balance={data['total_balance']}")
    assert abs(data["total_deposits"] - 102625.0) < 1.0
    assert abs(data["total_deductions"] - 136200.0) < 1.0
    assert abs(data["total_balance"] - (-33575.0)) < 1.0


def test_hr_totals(hr_token):
    data = _get_ledger(hr_token)
    print(f"HR arpita: deposits={data['total_deposits']}, deductions={data['total_deductions']}, balance={data['total_balance']}, entries={len(data['entries'])}")
    assert abs(data["total_deposits"] - 140800.81) < 1.0
    assert abs(data["total_deductions"] - 185676.62) < 1.0


def test_amount_is_number_not_string(admin_token):
    data = _get_ledger(admin_token)
    entries = data["entries"][:5]
    assert len(entries) >= 1
    for e in entries:
        assert isinstance(e["amount"], (int, float)), f"amount not numeric: {type(e['amount'])}={e['amount']}"
        assert isinstance(e["running_balance"], (int, float))


def test_regression_add_entry(admin_token):
    # Create a test entry and clean up
    payload = {
        "policy_number": "GMC0001393000100",
        "date": "2025-01-15",
        "reference": "TEST_ITER42/CLEAN",
        "particulars": "TEST iter42 regression",
        "amount": 1.0,
        "entry_type": "Deposit",
    }
    r = requests.post(f"{BASE_URL}/api/cd-ledger", json=payload,
                      headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
    entry_id = r.json().get("id") or r.json().get("_id")
    # cleanup
    if entry_id:
        d = requests.delete(f"{BASE_URL}/api/cd-ledger/{entry_id}",
                            headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert d.status_code in (200, 204)
