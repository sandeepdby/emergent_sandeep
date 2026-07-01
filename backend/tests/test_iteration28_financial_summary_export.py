"""Iteration 28: Financial Summary PDF Export endpoint tests"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to reading .env directly
    from pathlib import Path
    env_path = Path("/app/frontend/.env")
    for line in env_path.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL"):
            BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
            break

ADMIN_USER = {"username": "masteradmin", "password": "Admin@123"}
HR_USER = {"username": "arpita", "password": "Password@123"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_USER)


@pytest.fixture(scope="module")
def hr_token():
    return _login(HR_USER)


# ==================== Financial Summary PDF Export ====================
class TestFinancialSummaryExport:
    def _assert_pdf_response(self, r):
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
        ct = r.headers.get("content-type", "")
        assert "application/pdf" in ct, f"Expected PDF, got Content-Type: {ct}"
        assert r.content[:4] == b"%PDF", "Response does not start with %PDF magic header"
        assert len(r.content) > 1000, f"PDF too small: {len(r.content)} bytes"
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd.lower() and ".pdf" in cd.lower(), f"Bad Content-Disposition: {cd}"

    def test_admin_export_download_only(self, admin_token):
        r = requests.post(
            f"{BASE_URL}/api/financial-summary/export",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=60,
        )
        self._assert_pdf_response(r)

    def test_hr_export_download_only(self, hr_token):
        r = requests.post(
            f"{BASE_URL}/api/financial-summary/export",
            headers={"Authorization": f"Bearer {hr_token}"},
            timeout=60,
        )
        self._assert_pdf_response(r)

    def test_admin_export_with_email_flag(self, admin_token):
        r = requests.post(
            f"{BASE_URL}/api/financial-summary/export?send_email_flag=true",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=60,
        )
        # Should still return PDF successfully even if SMTP not configured
        # (email is queued via BackgroundTasks and shouldn't affect response)
        self._assert_pdf_response(r)

    def test_hr_export_with_email_flag(self, hr_token):
        r = requests.post(
            f"{BASE_URL}/api/financial-summary/export?send_email_flag=true",
            headers={"Authorization": f"Bearer {hr_token}"},
            timeout=60,
        )
        self._assert_pdf_response(r)

    def test_export_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/financial-summary/export", timeout=30)
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"


# ==================== Regression: Dashboard metrics ====================
class TestDashboardMetricsRegression:
    def test_admin_dashboard_analytics(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/dashboard/analytics",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["status_distribution"]["total"] == 55
        assert round(data["premium_summary"]["total_charge"], 2) == 9313.19

    def test_hr_dashboard_analytics(self, hr_token):
        r = requests.get(
            f"{BASE_URL}/api/dashboard/analytics",
            headers={"Authorization": f"Bearer {hr_token}"},
            timeout=30,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["status_distribution"]["total"] == 55
        assert round(data["premium_summary"]["total_charge"], 2) == 9313.19

    def test_admin_claims_analytics(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/claims-analytics",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("total_premium") == 1610000
        assert data.get("claims_ratio") == 172.2
