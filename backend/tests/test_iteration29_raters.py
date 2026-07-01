"""
Backend tests for Rater CRUD, permissions and Excel/PDF downloads.
Iteration 29.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://insurehub-portal.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ---------- Auth helpers ----------
def _login(username: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"username": username, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed for {username}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login("masteradmin", "Admin@123")


@pytest.fixture(scope="module")
def hr_token():
    return _login("arpita", "Password@123")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def hr_headers(hr_token):
    return {"Authorization": f"Bearer {hr_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def arpita_user_id(admin_headers):
    r = requests.get(f"{API}/users", headers=admin_headers, timeout=30)
    assert r.status_code == 200
    for u in r.json():
        if u.get("username") == "arpita":
            return u["id"]
    pytest.skip("HR user arpita not found")


# ---------- GET tests ----------
class TestRatersList:
    def test_admin_get_raters(self, admin_headers):
        r = requests.get(f"{API}/raters", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # existing GMC rater should be there
        names = [x.get("name") for x in data]
        assert any("GMC" in (n or "") for n in names), f"Expected GMC rater, got names={names}"

    def test_hr_get_raters_only_assigned(self, hr_headers):
        r = requests.get(f"{API}/raters", headers=hr_headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # arpita is assigned to the GMC rater
        assert len(data) >= 1
        for rater in data:
            assert "age_bands" in rater
            assert isinstance(rater["age_bands"], list)

    def test_gmc_seed_rater_structure(self, admin_headers):
        r = requests.get(f"{API}/raters", headers=admin_headers, timeout=30)
        gmc = next((x for x in r.json() if "GMC" in x.get("name", "")), None)
        assert gmc is not None
        assert gmc["policy_number"] == "GMC0001393000100"
        assert len(gmc["age_bands"]) == 7
        # verify a couple of known bands
        rates_by_min = {b["min_age"]: b["per_life_rate"] for b in gmc["age_bands"]}
        assert rates_by_min.get(0) == 3500
        assert rates_by_min.get(66) == 35000


# ---------- CREATE tests ----------
class TestRaterCreate:
    def test_hr_cannot_create(self, hr_headers):
        payload = {
            "name": "TEST_HR_Should_Fail",
            "policy_number": "GMC0001393000100",
            "age_bands": [{"min_age": 0, "max_age": 25, "per_life_rate": 5000}],
            "assigned_hr_users": [],
        }
        r = requests.post(f"{API}/raters", headers=hr_headers, json=payload, timeout=30)
        assert r.status_code == 403

    def test_admin_creates_rater(self, admin_headers, arpita_user_id, request):
        payload = {
            "name": "TEST_Rate_Card",
            "policy_number": "GMC0001393000100",
            "age_bands": [
                {"min_age": 0, "max_age": 25, "per_life_rate": 5000},
                {"min_age": 26, "max_age": 50, "per_life_rate": 10000},
                {"min_age": 51, "max_age": 80, "per_life_rate": 20000},
            ],
            "assigned_hr_users": [arpita_user_id],
        }
        r = requests.post(f"{API}/raters", headers=admin_headers, json=payload, timeout=30)
        assert r.status_code in (200, 201), f"Got {r.status_code}: {r.text}"
        data = r.json()
        assert data["name"] == "TEST_Rate_Card"
        assert data["policy_number"] == "GMC0001393000100"
        assert len(data["age_bands"]) == 3
        assert data["age_bands"][1]["per_life_rate"] == 10000
        assert arpita_user_id in data["assigned_hr_users"]
        assert "id" in data
        # share id with subsequent tests
        request.config.cache.set("rater/test_id", data["id"])

    def test_created_rater_visible_via_get(self, admin_headers, request):
        rid = request.config.cache.get("rater/test_id", None)
        assert rid, "No rater id in cache"
        r = requests.get(f"{API}/raters/{rid}", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Rate_Card"

    def test_hr_can_see_assigned_new_rater(self, hr_headers, request):
        rid = request.config.cache.get("rater/test_id", None)
        assert rid
        r = requests.get(f"{API}/raters", headers=hr_headers, timeout=30)
        assert r.status_code == 200
        assert any(x["id"] == rid for x in r.json())


# ---------- UPDATE tests ----------
class TestRaterUpdate:
    def test_hr_cannot_update(self, hr_headers, request):
        rid = request.config.cache.get("rater/test_id", None)
        assert rid
        r = requests.put(f"{API}/raters/{rid}", headers=hr_headers,
                         json={"name": "hacked"}, timeout=30)
        assert r.status_code == 403

    def test_admin_updates_rate_value(self, admin_headers, request):
        rid = request.config.cache.get("rater/test_id", None)
        assert rid
        payload = {
            "age_bands": [
                {"min_age": 0, "max_age": 25, "per_life_rate": 5500},
                {"min_age": 26, "max_age": 50, "per_life_rate": 10500},
                {"min_age": 51, "max_age": 80, "per_life_rate": 21000},
            ]
        }
        r = requests.put(f"{API}/raters/{rid}", headers=admin_headers, json=payload, timeout=30)
        assert r.status_code == 200
        # verify via GET
        g = requests.get(f"{API}/raters/{rid}", headers=admin_headers, timeout=30)
        assert g.status_code == 200
        rates = {b["min_age"]: b["per_life_rate"] for b in g.json()["age_bands"]}
        assert rates[0] == 5500
        assert rates[26] == 10500
        assert rates[51] == 21000


# ---------- DOWNLOAD tests ----------
class TestRaterDownload:
    def test_download_xlsx_admin(self, admin_headers, request):
        rid = request.config.cache.get("rater/test_id", None)
        assert rid
        r = requests.get(f"{API}/raters/{rid}/download", headers=admin_headers,
                         params={"format": "xlsx"}, timeout=30)
        assert r.status_code == 200
        ct = r.headers.get("content-type", "").lower()
        assert "spreadsheet" in ct or "excel" in ct or "xlsx" in ct, f"Unexpected content-type: {ct}"
        # xlsx files start with PK (zip)
        assert r.content[:2] == b"PK", "Not a valid xlsx (missing PK header)"

    def test_download_pdf_admin(self, admin_headers, request):
        rid = request.config.cache.get("rater/test_id", None)
        assert rid
        r = requests.get(f"{API}/raters/{rid}/download", headers=admin_headers,
                         params={"format": "pdf"}, timeout=30)
        assert r.status_code == 200
        assert "pdf" in r.headers.get("content-type", "").lower()
        assert r.content[:4] == b"%PDF", "Not a valid PDF"

    def test_download_xlsx_hr(self, hr_headers, request):
        rid = request.config.cache.get("rater/test_id", None)
        assert rid
        r = requests.get(f"{API}/raters/{rid}/download", headers=hr_headers,
                         params={"format": "xlsx"}, timeout=30)
        assert r.status_code == 200
        assert r.content[:2] == b"PK"

    def test_download_pdf_hr(self, hr_headers, request):
        rid = request.config.cache.get("rater/test_id", None)
        assert rid
        r = requests.get(f"{API}/raters/{rid}/download", headers=hr_headers,
                         params={"format": "pdf"}, timeout=30)
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"


# ---------- DELETE tests ----------
class TestRaterDelete:
    def test_hr_cannot_delete(self, hr_headers, request):
        rid = request.config.cache.get("rater/test_id", None)
        assert rid
        r = requests.delete(f"{API}/raters/{rid}", headers=hr_headers, timeout=30)
        assert r.status_code == 403

    def test_admin_deletes(self, admin_headers, request):
        rid = request.config.cache.get("rater/test_id", None)
        assert rid
        r = requests.delete(f"{API}/raters/{rid}", headers=admin_headers, timeout=30)
        assert r.status_code in (200, 204)
        g = requests.get(f"{API}/raters/{rid}", headers=admin_headers, timeout=30)
        assert g.status_code == 404


# ---------- Auth ----------
class TestRaterAuth:
    def test_no_auth_get(self):
        r = requests.get(f"{API}/raters", timeout=30)
        assert r.status_code in (401, 403)
