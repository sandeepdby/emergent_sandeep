"""Iteration 31: Verify family batch (Add Family) submission — backend supports multiple POSTs
under same employee_id with different relationship types."""
import os
from datetime import datetime, timedelta
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
RECENT_DOJ = (datetime.utcnow() - timedelta(days=10)).strftime("%Y-%m-%d")
TODAY = datetime.utcnow().strftime("%Y-%m-%d")
HR_USER = {"username": "arpita", "password": "Password@123"}


@pytest.fixture(scope="module")
def hr_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=HR_USER, timeout=20)
    assert r.status_code == 200, f"HR login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def headers(hr_token):
    return {"Authorization": f"Bearer {hr_token}", "Content-Type": "application/json"}


def test_gmc_policy_exists(headers):
    r = requests.get(f"{BASE_URL}/api/policies", headers=headers, timeout=20)
    assert r.status_code == 200
    pols = r.json()
    gmc = [p for p in pols if p["policy_number"] == "GMC0001393000100"]
    assert len(gmc) == 1, "Policy GMC0001393000100 not found"


def test_rate_card_gmc(headers):
    r = requests.get(f"{BASE_URL}/api/raters", headers=headers, timeout=20)
    assert r.status_code == 200
    raters = [x for x in r.json() if x["policy_number"] == "GMC0001393000100"]
    assert len(raters) >= 1
    bands = raters[0]["age_bands"]
    # verify 36-45 -> 11500, 0-18 -> 3500
    b36 = next((b for b in bands if b["min_age"] <= 36 <= b["max_age"]), None)
    b8 = next((b for b in bands if b["min_age"] <= 8 <= b["max_age"]), None)
    assert b36 and b36["per_life_rate"] == 11500
    assert b8 and b8["per_life_rate"] == 3500


def test_family_batch_submission(headers):
    """Simulate frontend loop: POST 2 endorsements — Employee + Spouse — same employee_id."""
    emp_id = "TEST_FAM_EMP_31"
    common = {
        "policy_number": "GMC0001393000100",
        "endorsement_type": "Addition",
        "employee_id": emp_id,
        "endorsement_date": "2026-07-01",
        "date_of_joining": "2026-06-21",
    }
    members = [
        {"relationship_type": "Employee", "member_name": "TEST_Parent",
         "dob": "1990-06-15", "age": 36, "gender": "Male", "per_life_premium": 11500},
        {"relationship_type": "Spouse", "member_name": "TEST_Spouse",
         "dob": "1992-08-20", "age": 33, "gender": "Female", "per_life_premium": 7800},
    ]
    created_ids = []
    for m in members:
        payload = {**common, **m}
        r = requests.post(f"{BASE_URL}/api/endorsements", json=payload,
                          headers=headers, timeout=30)
        assert r.status_code in (200, 201), f"POST failed for {m['relationship_type']}: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("employee_id") == emp_id
        assert body.get("relationship_type") == m["relationship_type"]
        created_ids.append(body.get("id"))

    # Verify persistence: GET endorsements filter by employee_id
    r = requests.get(f"{BASE_URL}/api/endorsements", headers=headers, timeout=20)
    assert r.status_code == 200
    all_e = r.json()
    for_emp = [e for e in all_e if e.get("employee_id") == emp_id]
    assert len(for_emp) >= 2, f"Expected >=2 endorsements for {emp_id}, found {len(for_emp)}"
    rels = {e.get("relationship_type") for e in for_emp}
    assert "Employee" in rels and "Spouse" in rels


def test_family_batch_kids(headers):
    """Verify Kids1 with age 8 accepted."""
    payload = {
        "policy_number": "GMC0001393000100",
        "endorsement_type": "Addition",
        "employee_id": "TEST_FAM_EMP_31",
        "endorsement_date": "2026-07-01",
        "date_of_joining": "2026-06-21",
        "relationship_type": "Kids1",
        "member_name": "TEST_Kid",
        "dob": "2018-03-10",
        "age": 8,
        "gender": "Male",
        "per_life_premium": 3500,
    }
    r = requests.post(f"{BASE_URL}/api/endorsements", json=payload, headers=headers, timeout=30)
    assert r.status_code in (200, 201), f"Kids1 POST failed: {r.status_code} {r.text}"
    assert r.json().get("relationship_type") == "Kids1"
