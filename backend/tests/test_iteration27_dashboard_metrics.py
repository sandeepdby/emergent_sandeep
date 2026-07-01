"""
Iteration 27: Test dashboard metrics bug fix.
Root cause: HR analytics endpoints filtered by submitted_by instead of by assigned policy_numbers.
Fix applied to 6 endpoints: get_dashboard_analytics, get_endorsements, get_import_batches,
get_batch_endorsements, get_endorsements_summary, get_claims_analytics.

Expected values:
- HR arpita: 55 endorsements total; 46 pending; 9 approved; 0 rejected
- Premium Charges: 9313; Refunds: 0; Net: +9313
- Total policies premium: 1,610,000; Claims ratio: 172.2%
"""
import os
import pytest
import requests

from dotenv import load_dotenv
load_dotenv('/app/frontend/.env')
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

ADMIN = {"username": "masteradmin", "password": "Admin@123"}
HR = {"username": "arpita", "password": "Password@123"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed for {creds['username']}: {r.status_code} {r.text}"
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def hr_token():
    return _login(HR)


def _h(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------- Dashboard Analytics ----------------
class TestDashboardAnalytics:
    def test_admin_dashboard_analytics(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/dashboard/analytics", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        print("ADMIN dashboard:", data)
        sd = data.get("status_distribution") or {}
        assert sd.get("total") == 55, f"Admin total expected 55, got {sd.get('total')}"
        assert sd.get("pending") == 46
        assert sd.get("approved") == 9
        assert sd.get("rejected") == 0
        ps = data.get("premium_summary") or {}
        assert round(float(ps.get("total_charge", 0))) == 9313, f"Admin total_charge expected 9313, got {ps.get('total_charge')}"
        assert round(float(ps.get("total_refund", 0))) == 0
        assert round(float(ps.get("net_premium", 0))) == 9313

    def test_hr_dashboard_analytics(self, hr_token):
        r = requests.get(f"{BASE_URL}/api/dashboard/analytics", headers=_h(hr_token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        print("HR dashboard:", data)
        sd = data.get("status_distribution") or {}
        assert sd.get("total") == 55, f"HR total expected 55, got {sd.get('total')}"
        assert sd.get("pending") == 46, f"HR pending expected 46, got {sd.get('pending')}"
        assert sd.get("approved") == 9, f"HR approved expected 9, got {sd.get('approved')}"
        assert sd.get("rejected") == 0, f"HR rejected expected 0, got {sd.get('rejected')}"
        ps = data.get("premium_summary") or {}
        assert round(float(ps.get("total_charge", 0))) == 9313, f"HR total_charge expected 9313, got {ps.get('total_charge')}"
        assert round(float(ps.get("total_refund", 0))) == 0, f"HR refund expected 0, got {ps.get('total_refund')}"
        assert round(float(ps.get("net_premium", 0))) == 9313, f"HR net expected 9313, got {ps.get('net_premium')}"
        # Verify by_endorsement_type includes 4 types
        bet = data.get("by_endorsement_type") or []
        types = {b.get("_id") for b in bet}
        assert {"Addition", "Deletion", "Correction", "Midterm addition"}.issubset(types), f"Missing types: {types}"


# ---------------- Endorsements list ----------------
class TestEndorsements:
    def test_admin_endorsements_count(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/endorsements", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        items = data if isinstance(data, list) else data.get("items", data.get("endorsements", []))
        print(f"Admin endorsements count: {len(items)}")
        assert len(items) == 55

    def test_hr_endorsements_count(self, hr_token):
        r = requests.get(f"{BASE_URL}/api/endorsements", headers=_h(hr_token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        items = data if isinstance(data, list) else data.get("items", data.get("endorsements", []))
        print(f"HR endorsements count: {len(items)}")
        assert len(items) == 55, f"HR expected 55 endorsements (assigned policies), got {len(items)}"


# ---------------- Claims Analytics ----------------
class TestClaimsAnalytics:
    def test_admin_claims_analytics(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/claims-analytics", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        print("Admin claims-analytics:", data)
        tp = data.get("total_premium") or data.get("total_policies_premium") or 0
        cr = data.get("claims_ratio") or 0
        assert round(float(tp)) == 1610000, f"Admin total_premium expected 1610000, got {tp}"
        assert abs(float(cr) - 172.2) < 1.0, f"Admin claims_ratio expected ~172.2, got {cr}"

    def test_hr_claims_analytics(self, hr_token):
        r = requests.get(f"{BASE_URL}/api/claims-analytics", headers=_h(hr_token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        print("HR claims-analytics:", data)
        tp = data.get("total_premium") or data.get("total_policies_premium") or 0
        cr = data.get("claims_ratio") or 0
        assert round(float(tp)) == 1610000, f"HR total_premium expected 1610000, got {tp}"
        assert abs(float(cr) - 172.2) < 1.0, f"HR claims_ratio expected ~172.2, got {cr}"
