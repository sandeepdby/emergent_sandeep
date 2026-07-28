"""
Iteration 48 tests:
1) GET /api/users/admins/public (public admin list for registration dropdown)
2) POST /api/auth/register with managed_by_admin_id persistence
3) CD Ledger policy filter + totals (infographics data)
4) Scoped admin email helper (get_scoped_admin_emails)
"""
import os
import uuid
import asyncio

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

MASTER = {"username": "masteradmin", "password": "Admin@123"}
HR = {"username": "arpita", "password": "Password@123"}


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(client, creds):
    r = client.post(f"{API}/auth/login", json=creds, timeout=60)
    if r.status_code != 200:
        pytest.fail(f"Login failed for {creds['username']}: {r.status_code} {r.text[:300]}")
    return r.json()["access_token"] if "access_token" in r.json() else r.json().get("token")


@pytest.fixture(scope="module")
def admin_token(client):
    return _login(client, MASTER)


@pytest.fixture(scope="module")
def hr_token(client):
    return _login(client, HR)


@pytest.fixture(scope="module")
def created_user_ids():
    return []


# ==================== 1. Public admins endpoint ====================
class TestPublicAdmins:
    def test_public_admins_no_auth(self, client):
        r = requests.get(f"{API}/users/admins/public", timeout=60)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0, "No admins returned for registration dropdown"
        for a in data:
            assert "id" in a and isinstance(a["id"], str)
            assert "full_name" in a
            assert "_id" not in a
            # minimal fields only - no email/password leak
            assert "password_hash" not in a
            assert "email" not in a, f"Public endpoint leaks email: {a}"

    def test_master_admin_in_list(self, client, admin_token):
        pub = requests.get(f"{API}/users/admins/public", timeout=60).json()
        r = client.get(f"{API}/users/admins", headers={"Authorization": f"Bearer {admin_token}"}, timeout=60)
        assert r.status_code == 200
        assert len(pub) == len(r.json()), "public admin count mismatch with authed admin list"


# ==================== 2. Registration with managed_by_admin_id ====================
class TestRegistrationAdminAssignment:
    def test_register_with_managed_by_admin_id(self, client, admin_token, created_user_ids):
        admins = requests.get(f"{API}/users/admins/public", timeout=60).json()
        admin_id = admins[0]["id"]
        uniq = uuid.uuid4().hex[:8]
        payload = {
            "username": f"TEST_hr_{uniq}",
            "password": "TestPass@123",
            "full_name": "TEST HR Assigned",
            "email": f"test_hr_{uniq}@example.test",
            "phone": "9999999999",
            "role": "HR",
            "managed_by_admin_id": admin_id,
        }
        r = client.post(f"{API}/auth/register", json=payload, timeout=120)
        assert r.status_code in (200, 201), f"Register failed: {r.status_code} {r.text[:400]}"

        # Verify persisted via admin user list
        lr = client.get(f"{API}/users", headers={"Authorization": f"Bearer {admin_token}"}, timeout=60)
        assert lr.status_code == 200, lr.text[:300]
        users = lr.json()
        match = [u for u in users if u.get("username") == payload["username"]]
        assert match, "Newly registered user not found in /api/users"
        u = match[0]
        created_user_ids.append(u["id"])
        assert u.get("managed_by_admin_id") == admin_id, (
            f"managed_by_admin_id not persisted/exposed: {u.get('managed_by_admin_id')}"
        )
        assert u.get("role") == "HR"

    def test_register_without_admin_id(self, client, admin_token, created_user_ids):
        uniq = uuid.uuid4().hex[:8]
        payload = {
            "username": f"TEST_hr_{uniq}",
            "password": "TestPass@123",
            "full_name": "TEST HR NoAdmin",
            "email": f"test_hr_{uniq}@example.test",
            "role": "HR",
        }
        r = client.post(f"{API}/auth/register", json=payload, timeout=120)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text[:400]}"
        lr = client.get(f"{API}/users", headers={"Authorization": f"Bearer {admin_token}"}, timeout=60)
        match = [u for u in lr.json() if u.get("username") == payload["username"]]
        assert match
        created_user_ids.append(match[0]["id"])
        assert match[0].get("managed_by_admin_id") in (None, "")

    def test_register_admin_role_forbidden(self, client):
        uniq = uuid.uuid4().hex[:8]
        r = client.post(f"{API}/auth/register", json={
            "username": f"TEST_admin_{uniq}", "password": "TestPass@123",
            "full_name": "TEST Admin", "email": f"test_admin_{uniq}@example.test", "role": "Admin",
        }, timeout=60)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"

    def test_register_duplicate_username(self, client, admin_token, created_user_ids):
        uniq = uuid.uuid4().hex[:8]
        payload = {
            "username": f"TEST_dup_{uniq}", "password": "TestPass@123",
            "full_name": "TEST Dup", "email": f"test_dup_{uniq}@example.test", "role": "HR",
        }
        r1 = client.post(f"{API}/auth/register", json=payload, timeout=120)
        assert r1.status_code in (200, 201)
        lr = client.get(f"{API}/users", headers={"Authorization": f"Bearer {admin_token}"}, timeout=60)
        m = [u for u in lr.json() if u.get("username") == payload["username"]]
        if m:
            created_user_ids.append(m[0]["id"])
        payload["email"] = f"test_dup2_{uniq}@example.test"
        r2 = client.post(f"{API}/auth/register", json=payload, timeout=120)
        assert r2.status_code == 400, f"Expected 400 dup username, got {r2.status_code}"


# ==================== 3. CD Ledger filter + infographics ====================
class TestCDLedger:
    def test_cd_ledger_all(self, client, admin_token):
        r = client.get(f"{API}/cd-ledger", headers={"Authorization": f"Bearer {admin_token}"}, timeout=60)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        for k in ("entries", "total_balance", "total_deposits", "total_deductions"):
            assert k in d, f"missing key {k}"
        assert isinstance(d["entries"], list)
        assert len(d["entries"]) > 0, "No CD ledger entries seeded"
        # totals consistency
        deposits = sum(float(e["amount"]) for e in d["entries"] if float(e["amount"]) > 0)
        deductions = sum(abs(float(e["amount"])) for e in d["entries"] if float(e["amount"]) < 0)
        assert round(deposits, 2) == d["total_deposits"]
        assert round(deductions, 2) == d["total_deductions"]
        assert round(deposits - deductions, 2) == d["total_balance"]
        # no mongo _id
        assert all("_id" not in e for e in d["entries"])
        # running balance on last entry equals total balance
        assert d["entries"][-1]["running_balance"] == d["total_balance"]

    def test_cd_ledger_policy_filter(self, client, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        all_data = client.get(f"{API}/cd-ledger", headers=h, timeout=60).json()
        policies = sorted({e.get("policy_number") for e in all_data["entries"] if e.get("policy_number")})
        assert policies, "No tagged policies in CD ledger"
        sum_balance = 0
        for pn in policies:
            r = client.get(f"{API}/cd-ledger", headers=h, params={"policy_number": pn}, timeout=60)
            assert r.status_code == 200, r.text[:200]
            d = r.json()
            assert len(d["entries"]) > 0, f"Filter returned no entries for {pn}"
            for e in d["entries"]:
                assert e["policy_number"].lower() == pn.lower(), f"Wrong policy in filtered result: {e['policy_number']}"
            dep = sum(float(e["amount"]) for e in d["entries"] if float(e["amount"]) > 0)
            ded = sum(abs(float(e["amount"])) for e in d["entries"] if float(e["amount"]) < 0)
            assert round(dep, 2) == d["total_deposits"]
            assert round(ded, 2) == d["total_deductions"]
            assert round(dep - ded, 2) == d["total_balance"]
            sum_balance += d["total_balance"]
        print(f"Policies: {policies}; per-policy balance sum={round(sum_balance,2)}")

    def test_cd_ledger_case_insensitive_filter(self, client, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        all_data = client.get(f"{API}/cd-ledger", headers=h, timeout=60).json()
        pn = next((e["policy_number"] for e in all_data["entries"] if e.get("policy_number")), None)
        assert pn
        r1 = client.get(f"{API}/cd-ledger", headers=h, params={"policy_number": pn}, timeout=60).json()
        r2 = client.get(f"{API}/cd-ledger", headers=h, params={"policy_number": pn.upper()}, timeout=60).json()
        assert len(r1["entries"]) == len(r2["entries"])

    def test_cd_ledger_unknown_policy(self, client, admin_token):
        r = client.get(f"{API}/cd-ledger", headers={"Authorization": f"Bearer {admin_token}"},
                       params={"policy_number": "TEST_NON_EXISTENT_POLICY"}, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["entries"] == [] and d["total_balance"] == 0

    def test_cd_ledger_requires_auth(self, client):
        r = requests.get(f"{API}/cd-ledger", timeout=60)
        assert r.status_code in (401, 403)


# ==================== 4. Scoped admin emails helper ====================
class TestScopedAdminEmails:
    def test_get_scoped_admin_emails(self):
        import sys
        sys.path.insert(0, "/app/backend")
        from server import get_scoped_admin_emails, db

        async def run():
            master = await db.users.find_one({"username": "masteradmin"}, {"_id": 0, "email": 1})
            # No hr id -> only master
            only_master = await get_scoped_admin_emails()
            assert only_master == [master["email"]], only_master

            # HR with assigned admin
            admin = await db.users.find_one({"role": "Admin", "username": {"$ne": "masteradmin"}}, {"_id": 0})
            hr = await db.users.find_one({"username": "arpita"}, {"_id": 0, "id": 1, "managed_by_admin_id": 1})
            assert hr, "arpita HR user missing"
            emails = await get_scoped_admin_emails(hr["id"])
            assert master["email"] in emails
            # must NOT include all admins
            all_admins = await db.users.find({"role": "Admin"}, {"_id": 0, "email": 1}).to_list(100)
            if len(all_admins) > 1 and not hr.get("managed_by_admin_id"):
                assert len(emails) == 1, f"Unassigned HR should only notify master admin, got {emails}"
            print(f"scoped emails for arpita: {emails}; total admins: {len(all_admins)}")
            return True

        assert asyncio.get_event_loop().run_until_complete(run()) if False else asyncio.run(run())


@pytest.fixture(scope="module", autouse=True)
def cleanup(client, created_user_ids):
    yield
    try:
        token = _login(client, MASTER)
        for uid in created_user_ids:
            client.delete(f"{API}/users/{uid}", headers={"Authorization": f"Bearer {token}"}, timeout=60)
    except Exception as e:
        print(f"cleanup error: {e}")
