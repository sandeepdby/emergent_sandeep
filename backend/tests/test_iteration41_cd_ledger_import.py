"""Iteration 41: CD Ledger Excel Template Download + Import functionality tests."""
import io
import os
import pytest
import requests
import pandas as pd

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fall back to reading from frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

ADMIN = {"username": "masteradmin", "password": "Admin@123"}
HR = {"username": "arpita", "password": "Password@123"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def hr_token():
    return _login(HR)


# ==================== TEMPLATE DOWNLOAD ====================
class TestTemplateDownload:
    def test_admin_can_download_template(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/cd-ledger/template/download",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert "spreadsheetml" in r.headers.get("content-type", "")
        # Parse xlsx and check sheets/columns
        xls = pd.ExcelFile(io.BytesIO(r.content))
        assert "CD Ledger" in xls.sheet_names
        assert "Instructions" in xls.sheet_names
        df = pd.read_excel(xls, sheet_name="CD Ledger")
        for col in ["Date", "Reference", "Description", "Amount", "Policy Number"]:
            assert col in df.columns, f"Missing column {col}"

    def test_hr_cannot_download_template(self, hr_token):
        r = requests.get(
            f"{BASE_URL}/api/cd-ledger/template/download",
            headers={"Authorization": f"Bearer {hr_token}"},
            timeout=30,
        )
        assert r.status_code == 403


# ==================== IMPORT EXCEL ====================
class TestImportExcel:
    def _make_xlsx(self, rows, columns=None):
        df = pd.DataFrame(rows, columns=columns) if columns else pd.DataFrame(rows)
        out = io.BytesIO()
        with pd.ExcelWriter(out, engine="openpyxl") as w:
            df.to_excel(w, index=False, sheet_name="CD Ledger")
        out.seek(0)
        return out

    def test_admin_import_valid_excel(self, admin_token):
        rows = [
            {"Date": "2026-01-15", "Reference": "TEST_IMP/A01", "Description": "Test 1", "Amount": 10000, "Policy Number": "GMC0001393000100"},
            {"Date": "2026-01-15", "Reference": "TEST_IMP/A02", "Description": "Test 2", "Amount": -2000, "Policy Number": "GMC0001393000100"},
            {"Date": "2026-01-15", "Reference": "TEST_IMP/A03", "Description": "Test 3", "Amount": 5000, "Policy Number": "GMC0001393000100"},
        ]
        f = self._make_xlsx(rows)
        r = requests.post(
            f"{BASE_URL}/api/cd-ledger/import",
            headers={"Authorization": f"Bearer {admin_token}"},
            files={"file": ("test.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["total_rows"] == 3
        assert data["success_count"] == 3
        assert data["error_count"] == 0

    def test_import_missing_amount_column(self, admin_token):
        rows = [{"Date": "2026-01-15", "Reference": "TEST_NOAMT", "Description": "x", "Policy Number": "GMC001"}]
        f = self._make_xlsx(rows)
        r = requests.post(
            f"{BASE_URL}/api/cd-ledger/import",
            headers={"Authorization": f"Bearer {admin_token}"},
            files={"file": ("test.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            timeout=30,
        )
        assert r.status_code == 400
        assert "amount" in r.text.lower()

    def test_hr_cannot_import(self, hr_token):
        f = self._make_xlsx([{"Date": "2026-01-15", "Reference": "X", "Amount": 100}])
        r = requests.post(
            f"{BASE_URL}/api/cd-ledger/import",
            headers={"Authorization": f"Bearer {hr_token}"},
            files={"file": ("t.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            timeout=30,
        )
        assert r.status_code == 403

    def test_import_non_excel_rejected(self, admin_token):
        r = requests.post(
            f"{BASE_URL}/api/cd-ledger/import",
            headers={"Authorization": f"Bearer {admin_token}"},
            files={"file": ("t.txt", io.BytesIO(b"hello"), "text/plain")},
            timeout=30,
        )
        assert r.status_code == 400


# ==================== VERIFY PRE-IMPORTED ENTRIES ====================
class TestPreImportedEntries:
    def test_import_entries_visible(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/cd-ledger?policy_number=GMC0001393000100",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        entries = data if isinstance(data, list) else data.get("entries", [])
        refs = [e.get("reference") for e in entries]
        for expected in ["IMPORT/001", "IMPORT/002", "IMPORT/003"]:
            assert expected in refs, f"Missing pre-imported entry {expected}. Found: {refs}"
        # Check entry_type == 'Excel Import' on those
        for e in entries:
            if e.get("reference") in ["IMPORT/001", "IMPORT/002", "IMPORT/003"]:
                assert e.get("entry_type") == "Excel Import"
