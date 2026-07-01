"""
Iteration 38 tests:
- Admin can edit approved endorsements including annual_premium_per_life, prorata_premium, per_life_premium
- HR cannot edit approved endorsements (403)
- HR dashboard shows non-zero premium_summary
- Regression: admin/HR pending edit still works
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://insurehub-portal.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_USER = "masteradmin"
ADMIN_PASS = "Admin@123"
HR_USER = "arpita"
HR_PASS = "Password@123"


def _login(username, password):
    r = requests.post(f"{API}/auth/login", json={"username": username, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed for {username}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_USER, ADMIN_PASS)


@pytest.fixture(scope="module")
def hr_token():
    return _login(HR_USER, HR_PASS)


@pytest.fixture(scope="module")
def approved_endorsement(admin_token):
    """Find (or create) an approved endorsement to test on."""
    h = {"Authorization": f"Bearer {admin_token}"}
    r = requests.get(f"{API}/endorsements", headers=h, timeout=30)
    assert r.status_code == 200
    items = r.json()
    approved = [e for e in items if e.get("status") == "Approved"]
    if not approved:
        pytest.skip("No approved endorsement in system to test with")
    # prefer the seeded one referenced in problem statement
    seeded = [e for e in approved if str(e.get("id", "")).startswith("dda1c3c0")]
    return (seeded or approved)[0]


# --- Admin edit approved endorsement ---

class TestAdminEditApprovedEndorsement:
    def test_admin_can_update_annual_and_prorata(self, admin_token, approved_endorsement):
        h = {"Authorization": f"Bearer {admin_token}"}
        eid = approved_endorsement["id"]
        payload = {"annual_premium_per_life": 20000, "prorata_premium": 12000}
        r = requests.put(f"{API}/endorsements/{eid}", json=payload, headers=h, timeout=30)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert float(data["annual_premium_per_life"]) == 20000
        assert float(data["prorata_premium"]) == 12000

        # verify persistence via GET
        r2 = requests.get(f"{API}/endorsements/{eid}", headers=h, timeout=30)
        assert r2.status_code == 200
        fetched = r2.json()
        assert float(fetched["annual_premium_per_life"]) == 20000
        assert float(fetched["prorata_premium"]) == 12000

    def test_admin_can_update_per_life_premium(self, admin_token, approved_endorsement):
        h = {"Authorization": f"Bearer {admin_token}"}
        eid = approved_endorsement["id"]
        payload = {"per_life_premium": 8000}
        r = requests.put(f"{API}/endorsements/{eid}", json=payload, headers=h, timeout=30)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert float(data["per_life_premium"]) == 8000

        # verify persistence + verify other fields unchanged
        r2 = requests.get(f"{API}/endorsements/{eid}", headers=h, timeout=30)
        fetched = r2.json()
        assert float(fetched["per_life_premium"]) == 8000
        assert float(fetched["annual_premium_per_life"]) == 20000
        assert float(fetched["prorata_premium"]) == 12000

    def test_admin_all_three_fields_independent(self, admin_token, approved_endorsement):
        """Update all 3 to distinct values and verify each persists independently."""
        h = {"Authorization": f"Bearer {admin_token}"}
        eid = approved_endorsement["id"]
        payload = {
            "per_life_premium": 5555,
            "annual_premium_per_life": 22222,
            "prorata_premium": 11111,
        }
        r = requests.put(f"{API}/endorsements/{eid}", json=payload, headers=h, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert float(data["per_life_premium"]) == 5555
        assert float(data["annual_premium_per_life"]) == 22222
        assert float(data["prorata_premium"]) == 11111

    def test_admin_full_payload_prorata_preserved(self, admin_token, approved_endorsement):
        """BUG: When frontend sends full payload with endorsement_date+endorsement_type,
        backend recalculates prorata_premium and OVERWRITES the user-provided value.
        This test simulates the exact payload the AllEndorsements.js form sends."""
        h = {"Authorization": f"Bearer {admin_token}"}
        eid = approved_endorsement["id"]
        # refetch to get current fields
        current = requests.get(f"{API}/endorsements/{eid}", headers=h, timeout=30).json()
        payload = {
            "member_name": current["member_name"],
            "relationship_type": current["relationship_type"],
            "endorsement_type": current["endorsement_type"],
            "endorsement_date": current["endorsement_date"],
            "effective_date": current.get("effective_date") or current["endorsement_date"],
            "annual_premium_per_life": 20000,
            "prorata_premium": 12000,
            "per_life_premium": 8000,
        }
        r = requests.put(f"{API}/endorsements/{eid}", json=payload, headers=h, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert float(data["annual_premium_per_life"]) == 20000
        assert float(data["per_life_premium"]) == 8000
        # THIS IS THE BUG: prorata_premium should equal 12000 but backend recalculates to remaining_days*rate=0
        assert float(data["prorata_premium"]) == 12000, (
            f"BUG: prorata_premium expected 12000 (user-supplied), got {data['prorata_premium']}. "
            f"Backend recalculates when endorsement_date/type is in payload, overwriting user input."
        )

    def test_auto_recalc_when_date_changes_without_prorata(self, admin_token, approved_endorsement):
        """Regression: if user changes ONLY endorsement_date (no prorata_premium in payload),
        auto-recalc of prorata should still trigger (existing behavior preserved)."""
        h = {"Authorization": f"Bearer {admin_token}"}
        eid = approved_endorsement["id"]
        current = requests.get(f"{API}/endorsements/{eid}", headers=h, timeout=30).json()

        # First: ensure prorata is a known value (12000) via explicit set
        requests.put(f"{API}/endorsements/{eid}", json={"prorata_premium": 12000}, headers=h, timeout=30)

        # Now change endorsement_date WITHOUT sending prorata_premium
        from datetime import datetime, timedelta
        orig_date = current["endorsement_date"]
        try:
            dt = datetime.fromisoformat(orig_date.replace("Z", "+00:00")) if isinstance(orig_date, str) else datetime.utcnow()
        except Exception:
            dt = datetime.utcnow()
        new_date = (dt + timedelta(days=1)).isoformat()

        payload = {"endorsement_date": new_date}
        r = requests.put(f"{API}/endorsements/{eid}", json=payload, headers=h, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        # prorata should have been RECALCULATED (i.e. NOT equal to 12000 unless recalc happens to yield 12000)
        # We at least verify the recalc metadata fields were updated
        assert "remaining_days" in data
        assert "days_in_policy_year" in data

        # Restore original date + prorata for other tests
        requests.put(
            f"{API}/endorsements/{eid}",
            json={"endorsement_date": orig_date, "prorata_premium": 12000},
            headers=h, timeout=30,
        )

    def test_admin_edit_response_no_mongo_id(self, admin_token, approved_endorsement):
        h = {"Authorization": f"Bearer {admin_token}"}
        eid = approved_endorsement["id"]
        r = requests.put(f"{API}/endorsements/{eid}", json={"per_life_premium": 6000}, headers=h, timeout=30)
        assert r.status_code == 200
        assert "_id" not in r.json()


# --- HR authorization on approved endorsements ---

class TestHrCannotEditApproved:
    def test_hr_gets_403_on_approved(self, hr_token, approved_endorsement):
        h = {"Authorization": f"Bearer {hr_token}"}
        eid = approved_endorsement["id"]
        r = requests.put(f"{API}/endorsements/{eid}", json={"annual_premium_per_life": 999}, headers=h, timeout=30)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"


# --- HR dashboard premium summary ---

class TestHrDashboardPremium:
    def test_hr_dashboard_premium_summary_nonzero(self, hr_token):
        h = {"Authorization": f"Bearer {hr_token}"}
        r = requests.get(f"{API}/dashboard/analytics", headers=h, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert "premium_summary" in data, f"Missing premium_summary: {list(data.keys())}"
        ps = data["premium_summary"]
        assert ps.get("total_charge", 0) > 0, f"total_charge should be > 0, got {ps.get('total_charge')}"
        assert ps.get("net_premium", 0) != 0, f"net_premium should be non-zero, got {ps.get('net_premium')}"

    def test_hr_dashboard_status_distribution(self, hr_token):
        h = {"Authorization": f"Bearer {hr_token}"}
        r = requests.get(f"{API}/dashboard/analytics", headers=h, timeout=30)
        assert r.status_code == 200
        data = r.json()
        sd = data.get("status_distribution", {})
        assert sd.get("total", 0) > 0, f"total endorsements should be > 0, got {sd}"
        assert sd.get("approved", 0) > 0, f"approved endorsements should be > 0, got {sd}"


# --- Regression ---

class TestRegression:
    def test_admin_can_edit_pending(self, admin_token):
        """Admin can still edit pending endorsements."""
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{API}/endorsements", headers=h, timeout=30)
        assert r.status_code == 200
        pending = [e for e in r.json() if e.get("status") == "Pending"]
        if not pending:
            pytest.skip("No pending endorsement in system")
        eid = pending[0]["id"]
        original = pending[0].get("member_name", "Test")
        r2 = requests.put(f"{API}/endorsements/{eid}", json={"member_name": original}, headers=h, timeout=30)
        assert r2.status_code == 200, f"{r2.status_code} {r2.text}"

    def test_employee_directory_accessible(self, hr_token):
        h = {"Authorization": f"Bearer {hr_token}"}
        r = requests.get(f"{API}/employee-directory", headers=h, timeout=30)
        assert r.status_code == 200

    def test_rate_cards_accessible(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{API}/raters", headers=h, timeout=30)
        assert r.status_code == 200
