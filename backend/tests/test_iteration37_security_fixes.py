"""Security fixes verification — SEC-001..005"""
import os
import time
import jwt as _jwt
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://insurehub-portal.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"username": "masteradmin", "password": "Admin@123"}
HR = {"username": "arpita", "password": "Password@123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def hr_token():
    return _login(HR)


# ==================== SEC-001: Regex injection on password reset ====================
class TestSEC001PasswordResetRegex:
    @pytest.mark.parametrize("bad_token", [".*", "........", ".+", "[A-Z]{8}", "^.{8}$", "AAAAAAAA"])
    def test_regex_patterns_rejected(self, bad_token):
        r = requests.post(f"{API}/auth/reset-password",
                          json={"token": bad_token, "new_password": "NewPass@999"}, timeout=30)
        assert r.status_code == 400, f"regex token '{bad_token}' should be rejected, got {r.status_code}: {r.text}"
        assert "Invalid or expired" in r.text

    def test_admin_login_still_works_after_regex_attempts(self):
        # If SEC-001 was still broken, one of the above requests could have overwritten admin password.
        r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
        assert r.status_code == 200, f"admin login broken — password may have been changed! {r.text}"


class TestSEC001LegitimateResetFlow:
    def test_forgot_password_creates_token_prefix(self):
        # Trigger a reset for admin email (must match seeded ADMIN_EMAIL)
        admin_email = os.environ.get("ADMIN_EMAIL", "sandeepdby@gmail.com")
        r = requests.post(f"{API}/auth/forgot-password", json={"email": admin_email}, timeout=30)
        assert r.status_code == 200
        # Give background task a moment
        time.sleep(1)

        # Look up token_prefix directly from Mongo
        import asyncio
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        mongo_url = os.environ["MONGO_URL"]
        db_name = os.environ["DB_NAME"]

        async def _fetch():
            client = AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            rec = await db.password_resets.find_one({"email": admin_email, "used": False},
                                                    sort=[("created_at", -1)])
            client.close()
            return rec

        rec = asyncio.get_event_loop().run_until_complete(_fetch())
        assert rec is not None, "reset record not created"
        assert "token_prefix" in rec, "SEC-001: token_prefix field missing"
        assert isinstance(rec["token_prefix"], str) and len(rec["token_prefix"]) == 8
        assert rec["token_prefix"].isupper() or any(c.isdigit() for c in rec["token_prefix"])
        # NOTE: We do NOT actually reset the admin password here — that would break other tests.
        # We only verify the record structure is correct.


# ==================== SEC-002: HR policy filter bypass ====================
class TestSEC002HRPolicyFilter:
    def test_hr_unassigned_policy_returns_empty(self, hr_token):
        r = requests.get(f"{API}/employee-directory",
                         params={"policy_number": "FAKE_POLICY_ZZZ"},
                         headers={"Authorization": f"Bearer {hr_token}"}, timeout=30)
        assert r.status_code == 200
        assert r.json() == [], f"HR got data for unassigned policy: {r.json()}"

    def test_hr_history_unassigned_policy_returns_empty(self, hr_token):
        r = requests.get(f"{API}/employee-directory/history",
                         params={"policy_number": "FAKE_POLICY_ZZZ", "member_name": "anyone"},
                         headers={"Authorization": f"Bearer {hr_token}"}, timeout=30)
        assert r.status_code == 200
        assert r.json() == []

    def test_hr_assigned_policy_returns_data(self, hr_token):
        r = requests.get(f"{API}/employee-directory",
                         params={"policy_number": "GMC0001393000100"},
                         headers={"Authorization": f"Bearer {hr_token}"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0, "HR should see members of assigned policy"
        # Ensure all returned rows are for the assigned policy
        for row in data:
            assert row.get("policy_number") == "GMC0001393000100"


# ==================== SEC-004: JWT expiry ====================
class TestSEC004JWTExpiry:
    def test_fresh_token_has_exp_claim(self, admin_token):
        # decode without verification just to inspect claims
        payload = _jwt.decode(admin_token, options={"verify_signature": False})
        assert "exp" in payload, "SEC-004: fresh JWT missing exp claim"
        now = int(time.time())
        # exp should be ~24h from now (allow +/- 2 min drift)
        delta = payload["exp"] - now
        assert 23 * 3600 + 3540 < delta <= 24 * 3600 + 60, f"exp not ~24h from now (delta={delta}s)"

    def test_expired_token_rejected(self):
        # Craft a token with the SAME structure but expired. We can't sign it (secret unknown to test),
        # so instead we just verify the endpoint rejects a malformed/expired token with 401.
        bad = _jwt.encode({"user_id": "x", "exp": int(time.time()) - 60}, "wrongsecret", algorithm="HS256")
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {bad}"}, timeout=30)
        assert r.status_code == 401


# ==================== SEC-005: Document ownership check ====================
class TestSEC005DocumentOwnership:
    def test_hr_cannot_download_admin_document(self, admin_token, hr_token):
        # Find a document uploaded by admin that is NOT assigned to arpita.
        # Query the documents list as admin to find candidates.
        r = requests.get(f"{API}/documents", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        if r.status_code != 200:
            pytest.skip(f"/documents list endpoint not available: {r.status_code}")
        docs = r.json() if isinstance(r.json(), list) else r.json().get("documents", [])
        if not docs:
            pytest.skip("no documents in system to test with")

        # Get arpita's user id
        me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {hr_token}"}, timeout=30).json()
        hr_id = me.get("id") or me.get("user", {}).get("id")

        target = None
        for d in docs:
            if d.get("uploaded_by") != hr_id and d.get("assigned_to_hr") != hr_id:
                target = d
                break
        if not target:
            pytest.skip("no admin-only document available (arpita is uploader/assignee of all)")

        r = requests.get(f"{API}/documents/{target['id']}/download",
                         headers={"Authorization": f"Bearer {hr_token}"}, timeout=30, allow_redirects=False)
        assert r.status_code == 403, f"SEC-005: HR downloaded unassigned doc! status={r.status_code}"

    def test_admin_can_download_any_document(self, admin_token):
        r = requests.get(f"{API}/documents", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        if r.status_code != 200:
            pytest.skip("/documents list endpoint not available")
        docs = r.json() if isinstance(r.json(), list) else r.json().get("documents", [])
        if not docs:
            pytest.skip("no documents to test")
        d = docs[0]
        r = requests.get(f"{API}/documents/{d['id']}/download",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=30, allow_redirects=False)
        assert r.status_code in (200, 302, 307), f"admin blocked from own doc: {r.status_code}"


# ==================== Regression tests ====================
class TestRegression:
    def test_admin_login(self):
        r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_hr_login(self):
        r = requests.post(f"{API}/auth/login", json=HR, timeout=30)
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_employee_directory_hr(self, hr_token):
        r = requests.get(f"{API}/employee-directory",
                         headers={"Authorization": f"Bearer {hr_token}"}, timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_family_group(self, hr_token):
        r = requests.get(f"{API}/family-groups",
                         headers={"Authorization": f"Bearer {hr_token}"}, timeout=30)
        # This endpoint may vary — accept 200/404 but not 500
        assert r.status_code in (200, 404), f"family-groups error: {r.status_code} {r.text[:200]}"

    def test_coverage_history_hr(self, hr_token):
        # Use employee-directory/history endpoint
        r = requests.get(f"{API}/employee-directory/history",
                         params={"member_name": "test"},
                         headers={"Authorization": f"Bearer {hr_token}"}, timeout=30)
        assert r.status_code == 200

    def test_dashboard_metrics_admin(self, admin_token):
        r = requests.get(f"{API}/dashboard/metrics",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        # Endpoint name may vary; try a few
        if r.status_code == 404:
            r = requests.get(f"{API}/dashboard",
                             headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code in (200, 404), f"dashboard metrics failed: {r.status_code}"

    def test_rate_cards_admin(self, admin_token):
        r = requests.get(f"{API}/raters",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200

    def test_rate_cards_hr(self, hr_token):
        r = requests.get(f"{API}/raters",
                         headers={"Authorization": f"Bearer {hr_token}"}, timeout=30)
        assert r.status_code == 200
