"""
Iteration 30 tests: Submit Endorsement enhancements
- Kids1/Kids2 relationship_type accepted by POST /api/endorsements
- Existing Kids/Spouse/Employee/Mother/Father still work
- Rater endpoint returns GMC Standard Rate Card with correct age bands
"""

import os
import pytest
import requests
import uuid
from datetime import date

def _load_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        # load from frontend/.env
        try:
            with open("/app/frontend/.env") as f:
                for ln in f:
                    if ln.startswith("REACT_APP_BACKEND_URL="):
                        url = ln.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    assert url, "REACT_APP_BACKEND_URL not set"
    return url.rstrip("/")


BASE_URL = _load_url()
API = f"{BASE_URL}/api"

HR = {"username": "arpita", "password": "Password@123"}
ADMIN = {"username": "masteradmin", "password": "Admin@123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def hr_headers():
    return {"Authorization": f"Bearer {_login(HR)}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login(ADMIN)}", "Content-Type": "application/json"}


class TestRatersEndpoint:
    def test_hr_can_fetch_raters(self, hr_headers):
        r = requests.get(f"{API}/raters", headers=hr_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1, "HR should see at least 1 assigned rater"

    def test_gmc_rate_card_present_with_age_bands(self, hr_headers):
        r = requests.get(f"{API}/raters", headers=hr_headers, timeout=30)
        raters = r.json()
        gmc = next((x for x in raters if x.get("policy_number") == "GMC0001393000100"), None)
        assert gmc is not None, "GMC rate card not assigned to HR"
        bands = gmc.get("age_bands", [])
        # Expected: 0-18:3500, 19-25:5200, 26-35:7800, 36-45:11500, 46-55:16200, 56-65:22500, 66-80:35000
        band_26_35 = next((b for b in bands if b["min_age"] == 26 and b["max_age"] == 35), None)
        assert band_26_35 is not None, f"26-35 band not found; bands={bands}"
        assert band_26_35["per_life_rate"] == 7800, f"Expected 7800 got {band_26_35}"


class TestEndorsementKidsRelationships:
    """Backend must accept Kids1 and Kids2 relationship values"""

    def _base_payload(self, relationship, endorsement_type="Addition", policy_number="POL-NEW-001"):
        unique = uuid.uuid4().hex[:8]
        return {
            "policy_number": policy_number,
            "employee_id": f"TEST_{unique}",
            "member_name": f"TEST_Member_{unique}",
            "dob": "1996-03-15",
            "age": 30,
            "gender": "Male",
            "relationship_type": relationship,
            "endorsement_type": endorsement_type,
            "date_of_joining": str(date.today()),
            "coverage_type": "Floater",
            "sum_insured": 500000,
            "per_life_premium": 7800,
            "endorsement_date": str(date.today()),
            "effective_date": str(date.today()),
            "employee_email": f"test_{unique}@example.com",
            "employee_mobile": "+919999999999",
            "remarks": "TEST iteration30",
        }

    @pytest.mark.parametrize("rel", ["Kids1", "Kids2", "Kids", "Spouse", "Employee"])
    def test_create_endorsement_various_relationships(self, hr_headers, rel):
        payload = self._base_payload(rel)
        # For 'Employee' avoid Midterm restriction and DOB not required, but include anyway
        r = requests.post(f"{API}/endorsements", json=payload, headers=hr_headers, timeout=60)
        assert r.status_code in (200, 201), f"{rel} rejected: {r.status_code} {r.text}"
        data = r.json()
        assert data["relationship_type"] == rel
        # Verify persistence via GET
        eid = data["id"]
        g = requests.get(f"{API}/endorsements/{eid}", headers=hr_headers, timeout=30)
        assert g.status_code == 200
        assert g.json()["relationship_type"] == rel

    def test_reject_parent_on_midterm(self, hr_headers):
        payload = self._base_payload("Father", endorsement_type="Midterm addition")
        r = requests.post(f"{API}/endorsements", json=payload, headers=hr_headers, timeout=30)
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"

    def test_kids1_allowed_on_midterm(self, hr_headers):
        payload = self._base_payload("Kids1", endorsement_type="Midterm addition")
        r = requests.post(f"{API}/endorsements", json=payload, headers=hr_headers, timeout=30)
        assert r.status_code in (200, 201), f"Kids1 midterm rejected: {r.status_code} {r.text}"
        assert r.json()["relationship_type"] == "Kids1"
