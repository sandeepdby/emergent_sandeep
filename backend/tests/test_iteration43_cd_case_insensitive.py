"""Iteration 43: Verify case-insensitive policy_number matching for CD Ledger."""
import os
import io
import uuid
import pytest
import requests
import pandas as pd

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://insurehub-portal.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"username": "masteradmin", "password": "Admin@123"}
HR = {"username": "arpita", "password": "Password@123"}

POLICY_CANONICAL = "Relyon(self+5)"
POLICY_UPPER = "RELYON(SELF+5)"


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def hr_token():
    return _login(HR)


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def hr_h(hr_token):
    return {"Authorization": f"Bearer {hr_token}"}


@pytest.fixture(scope="module")
def seed_entries(admin_h):
    """Ensure both case variants exist. Seed if missing. Cleanup at end."""
    created_ids = []
    # Fetch existing entries via case-insensitive filter
    r = requests.get(f"{API}/cd-ledger", params={"policy_number": POLICY_CANONICAL}, headers=admin_h, timeout=30)
    existing = r.json().get("entries", []) if r.status_code == 200 else []
    refs = {e.get("reference"): e for e in existing}

    if "TEST-RELYON-001" not in refs:
        payload = {
            "date": "2025-01-15",
            "reference": "TEST-RELYON-001",
            "description": "Test canonical case",
            "amount": 75000,
            "policy_number": POLICY_CANONICAL,
        }
        r = requests.post(f"{API}/cd-ledger", json=payload, headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        created_ids.append(r.json()["id"])
    if "TEST-CASE-001" not in refs:
        payload = {
            "date": "2025-01-16",
            "reference": "TEST-CASE-001",
            "description": "Test upper case variant",
            "amount": 25000,
            "policy_number": POLICY_UPPER,
        }
        r = requests.post(f"{API}/cd-ledger", json=payload, headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        created_ids.append(r.json()["id"])

    yield

    for eid in created_ids:
        requests.delete(f"{API}/cd-ledger/{eid}", headers=admin_h, timeout=30)


# --- Feature 1: case-insensitive filter returns both variants ---
def test_filter_returns_both_case_variants(admin_h, seed_entries):
    r = requests.get(f"{API}/cd-ledger", params={"policy_number": POLICY_CANONICAL}, headers=admin_h, timeout=30)
    assert r.status_code == 200
    data = r.json()
    refs = [e["reference"] for e in data["entries"]]
    assert "TEST-RELYON-001" in refs, f"Missing canonical entry. Refs: {refs}"
    assert "TEST-CASE-001" in refs, f"Missing uppercase-variant entry (case-insensitive filter failed). Refs: {refs}"
    # total_deposits should be >= 100000 (test entries) — may include other entries too
    assert data["total_deposits"] >= 100000, f"total_deposits={data['total_deposits']}"


def test_filter_upper_case_input_also_works(admin_h, seed_entries):
    r = requests.get(f"{API}/cd-ledger", params={"policy_number": POLICY_UPPER}, headers=admin_h, timeout=30)
    assert r.status_code == 200
    refs = [e["reference"] for e in r.json()["entries"]]
    assert "TEST-RELYON-001" in refs
    assert "TEST-CASE-001" in refs


# --- Feature 2: admin no-filter returns all with numeric totals ---
def test_admin_all_policies_totals(admin_h, seed_entries):
    r = requests.get(f"{API}/cd-ledger", headers=admin_h, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data["total_balance"], (int, float))
    assert isinstance(data["total_deposits"], (int, float))
    assert isinstance(data["total_deductions"], (int, float))
    assert data["total_deposits"] > 0
    # Both variants should exist in full list
    refs = [e["reference"] for e in data["entries"]]
    assert "TEST-RELYON-001" in refs
    assert "TEST-CASE-001" in refs


# --- Feature 3: import normalizes case to canonical ---
def test_import_normalizes_policy_case(admin_h):
    unique_ref = f"TEST-IMPORT-{uuid.uuid4().hex[:8]}"
    df = pd.DataFrame([{
        "Date": "2025-02-01",
        "Reference": unique_ref,
        "Description": "Case-normalization test",
        "Amount": 500,
        "Policy Number": POLICY_UPPER,  # uppercase input
    }])
    buf = io.BytesIO()
    df.to_excel(buf, index=False)
    buf.seek(0)
    files = {"file": ("test_import.xlsx", buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    r = requests.post(f"{API}/cd-ledger/import", headers=admin_h, files=files, timeout=60)
    assert r.status_code == 200, r.text
    result = r.json()
    assert result["success_count"] == 1, result

    # Verify normalized to canonical case
    r2 = requests.get(f"{API}/cd-ledger", params={"policy_number": POLICY_CANONICAL}, headers=admin_h, timeout=30)
    matched = [e for e in r2.json()["entries"] if e["reference"] == unique_ref]
    assert len(matched) == 1, f"Imported entry not found under canonical filter"
    assert matched[0]["policy_number"] == POLICY_CANONICAL, \
        f"Import did NOT normalize policy case. Stored as: {matched[0]['policy_number']}"

    # Cleanup
    requests.delete(f"{API}/cd-ledger/{matched[0]['id']}", headers=admin_h, timeout=30)


# --- Feature 4: HR case-insensitive isolation ---
def test_hr_case_insensitive_isolation(hr_h):
    r = requests.get(f"{API}/cd-ledger", headers=hr_h, timeout=30)
    assert r.status_code == 200
    data = r.json()
    # HR should get entries (arpita has GMC0001393000100 assignment per prior iterations)
    assert isinstance(data["entries"], list)
    # Response should include numeric totals
    assert isinstance(data["total_balance"], (int, float))
