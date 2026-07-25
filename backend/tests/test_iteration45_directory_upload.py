"""Tests for iteration 45 features:
- /api/employee-directory/template (GET) — Excel template download
- /api/employee-directory/upload (POST) — upload members via Excel
- /api/policies returns all policies (for policy filter)
- Email notification path exists in /api/endorsements/import (smoke)
"""
import os
import io
import pytest
import requests
import pandas as pd

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://insurehub-portal.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"username": "masteradmin", "password": "Admin@123"}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def hr_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"username": "arpita", "password": "Password@123"}, timeout=30)
    assert r.status_code == 200, f"HR login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _hdr(t):
    return {"Authorization": f"Bearer {t}"}


class TestPolicyFilter:
    def test_policies_endpoint_returns_all(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/policies", headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 200
        policies = r.json()
        assert isinstance(policies, list)
        assert len(policies) > 0
        # each policy must have policy_number
        assert all("policy_number" in p for p in policies)


class TestDirectoryTemplate:
    def test_template_download_admin(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/employee-directory/template", headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("content-type", "") or r.headers.get("content-type", "").startswith("application/")
        # parse Excel
        xl = pd.ExcelFile(io.BytesIO(r.content))
        assert "Members" in xl.sheet_names
        df = pd.read_excel(xl, sheet_name="Members")
        for col in ["Member Name", "Policy Number", "Mobile", "Email"]:
            assert col in df.columns, f"Missing col {col} in template"

    def test_template_download_hr(self, hr_token):
        r = requests.get(f"{BASE_URL}/api/employee-directory/template", headers=_hdr(hr_token), timeout=30)
        # Endpoint uses get_current_user (any authed user), should be 200
        assert r.status_code == 200


class TestDirectoryUpload:
    def _pick_policy(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/policies", headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 200
        policies = r.json()
        assert len(policies) > 0
        return policies[0]["policy_number"]

    def test_upload_invalid_file_type(self, admin_token):
        files = {"file": ("test.txt", b"not excel", "text/plain")}
        r = requests.post(f"{BASE_URL}/api/employee-directory/upload", headers=_hdr(admin_token), files=files, timeout=30)
        assert r.status_code == 400

    def test_upload_missing_required_columns(self, admin_token):
        df = pd.DataFrame([{"Foo": "bar"}])
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as w:
            df.to_excel(w, index=False, sheet_name="Members")
        buf.seek(0)
        files = {"file": ("bad.xlsx", buf.read(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        r = requests.post(f"{BASE_URL}/api/employee-directory/upload", headers=_hdr(admin_token), files=files, timeout=30)
        assert r.status_code == 400

    def test_upload_creates_addition_endorsements(self, admin_token):
        policy_number = self._pick_policy(admin_token)
        df = pd.DataFrame([
            {"Employee ID": "TEST-ITER45-E1", "Member Name": "TEST_Iter45 Member One", "Relationship Type": "Employee",
             "DOB": "1990-01-01", "Age": 35, "Gender": "Male", "Policy Number": policy_number,
             "Mobile": "+919999900001", "Email": "iter45.one@example.com", "Sum Insured": 500000, "Coverage Type": "Floater"},
            {"Employee ID": "TEST-ITER45-E1", "Member Name": "TEST_Iter45 Member Two", "Relationship Type": "Spouse",
             "DOB": "1992-05-05", "Age": 33, "Gender": "Female", "Policy Number": policy_number,
             "Mobile": "", "Email": "", "Sum Insured": 500000, "Coverage Type": "Floater"},
        ])
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as w:
            df.to_excel(w, index=False, sheet_name="Members")
        buf.seek(0)
        files = {"file": ("upload.xlsx", buf.read(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        r = requests.post(f"{BASE_URL}/api/employee-directory/upload", headers=_hdr(admin_token), files=files, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["total_rows"] == 2
        assert data["success_count"] == 2, f"Errors: {data.get('errors')}"
        assert data["error_count"] == 0

        # Verify endorsements exist with email/mobile
        r2 = requests.get(f"{BASE_URL}/api/endorsements", headers=_hdr(admin_token), timeout=30)
        assert r2.status_code == 200
        ends = r2.json()
        created = [e for e in ends if e.get("member_name", "").startswith("TEST_Iter45")]
        assert len(created) >= 2
        emp1 = next((e for e in created if e["member_name"] == "TEST_Iter45 Member One"), None)
        assert emp1 is not None
        assert emp1.get("employee_email") == "iter45.one@example.com"
        assert emp1.get("employee_mobile") == "+919999900001"
        assert emp1.get("endorsement_type") == "Addition"
        assert emp1.get("status") == "Pending"

        # Cleanup
        for e in created:
            requests.delete(f"{BASE_URL}/api/endorsements/{e['id']}", headers=_hdr(admin_token), timeout=15)


class TestEndorsementImportEmail:
    """Smoke: /api/endorsements/import responds; email path is best-effort background task."""

    def test_import_endpoint_exists(self, admin_token):
        # Send empty request — should get 400/422, not 404
        r = requests.post(f"{BASE_URL}/api/endorsements/import", headers=_hdr(admin_token), timeout=15)
        assert r.status_code != 404
