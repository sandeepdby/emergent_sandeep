"""
Iteration 48 tests:
- Twilio /notifications/test-sms (Admin + HR-forbidden). Sends ONE real 'both' message.
- Raters CRUD (3 rate types: age_band, flat_rate, per_family) + persistence GET.
- Endorsement premium auto-fill (POST /api/endorsements) for flat_rate / per_family / age_band.
- Cloud Storage /documents/upload with policy_number filter (GET ?policy_number vs no filter).
- End-to-end endorsement submission still works after Twilio wiring.
"""
import io
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://insurehub-portal.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_USER = "masteradmin"
ADMIN_PASS = "Admin@123"
HR_USER = "arpita"
HR_PASS = "Password@123"

TEST_PHONE = "9886260579"  # For the ONE real Twilio 'both' test


# ---------- Auth fixtures ----------
def _login(username, password):
    r = requests.post(f"{API}/auth/login", json={"username": username, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed for {username}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_token():
    return _login(ADMIN_USER, ADMIN_PASS)


@pytest.fixture(scope="session")
def hr_token():
    return _login(HR_USER, HR_PASS)


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def hr_headers(hr_token):
    return {"Authorization": f"Bearer {hr_token}"}


@pytest.fixture(scope="session")
def sample_policies(admin_headers):
    r = requests.get(f"{API}/policies", headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    policies = r.json()
    assert len(policies) >= 1, "Need at least one policy to test raters/endorsements"
    # Prefer a policy with valid inception/expiry that covers today for prorata calc
    from datetime import date as _date, datetime as _dt
    today = _date.today()
    def _active(p):
        try:
            inc = _dt.strptime(p.get("inception_date"), "%Y-%m-%d").date()
            exp = _dt.strptime(p.get("expiry_date"), "%Y-%m-%d").date()
            return inc <= today <= exp
        except Exception:
            return False
    active = [p for p in policies if _active(p)]
    if active:
        # Put an active one first
        policies = active + [p for p in policies if p not in active]
    return policies


# ---------- 1. Twilio: HR forbidden ----------
class TestTwilioAuth:
    def test_hr_forbidden_on_test_sms(self, hr_headers):
        r = requests.post(
            f"{API}/notifications/test-sms",
            headers=hr_headers,
            json={"to_number": "9999999999", "channel": "sms", "message": "should-be-blocked"},
            timeout=30,
        )
        assert r.status_code == 403, f"Expected 403 for HR, got {r.status_code}: {r.text}"


# ---------- 2. Twilio: Admin single 'both' real send (RUN ONCE) ----------
class TestTwilioSend:
    def test_admin_send_both_channels_once(self, admin_headers):
        payload = {
            "to_number": TEST_PHONE,
            "channel": "both",
            "message": "InsureHub automated test (iteration 48) - please ignore.",
        }
        r = requests.post(f"{API}/notifications/test-sms", headers=admin_headers, json=payload, timeout=60)
        assert r.status_code == 200, f"Twilio send failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("success") is True
        assert data.get("normalized_number") == "+919886260579", f"normalization wrong: {data.get('normalized_number')}"
        results = data.get("results", {})
        assert "sms" in results and "status" in results["sms"], f"missing sms status: {results}"
        assert "whatsapp" in results and "status" in results["whatsapp"], f"missing whatsapp status: {results}"
        print(f"Twilio results: {results}")


# ---------- 3. Rate Card CRUD for 3 rate types ----------
@pytest.fixture(scope="class")
def created_raters(admin_headers, sample_policies):
    policy_number = sample_policies[0]["policy_number"]
    ids = {}
    # age_band
    r1 = requests.post(f"{API}/raters", headers=admin_headers, json={
        "name": "TEST_AGE_BAND_R48",
        "policy_number": policy_number,
        "rate_type": "age_band",
        "age_bands": [
            {"min_age": 0, "max_age": 35, "per_life_rate": 5000},
            {"min_age": 36, "max_age": 60, "per_life_rate": 8000},
        ],
    }, timeout=30)
    assert r1.status_code == 200, r1.text
    ids["age_band"] = r1.json()["id"]
    # flat_rate
    r2 = requests.post(f"{API}/raters", headers=admin_headers, json={
        "name": "TEST_FLAT_R48",
        "policy_number": policy_number,
        "rate_type": "flat_rate",
        "flat_rate": 7500,
    }, timeout=30)
    assert r2.status_code == 200, r2.text
    ids["flat_rate"] = r2.json()["id"]
    # per_family
    r3 = requests.post(f"{API}/raters", headers=admin_headers, json={
        "name": "TEST_PERFAM_R48",
        "policy_number": policy_number,
        "rate_type": "per_family",
        "per_family_rate": 12000,
    }, timeout=30)
    assert r3.status_code == 200, r3.text
    ids["per_family"] = r3.json()["id"]

    yield {"policy_number": policy_number, "ids": ids}

    # cleanup
    for rid in ids.values():
        try:
            requests.delete(f"{API}/raters/{rid}", headers=admin_headers, timeout=15)
        except Exception:
            pass


class TestRaterCRUD:
    def test_list_contains_three_types(self, admin_headers, created_raters):
        r = requests.get(f"{API}/raters", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        raters = r.json()
        found = {rid: None for rid in created_raters["ids"].values()}
        for rr in raters:
            if rr["id"] in found:
                found[rr["id"]] = rr
        assert all(v is not None for v in found.values()), f"Not all created raters returned: {found}"

        by_type = {rr["rate_type"]: rr for rr in found.values()}
        assert by_type["age_band"]["age_bands"][0]["per_life_rate"] == 5000
        assert by_type["flat_rate"]["flat_rate"] == 7500
        assert by_type["per_family"]["per_family_rate"] == 12000

    def test_update_flat_rate(self, admin_headers, created_raters):
        rid = created_raters["ids"]["flat_rate"]
        r = requests.put(f"{API}/raters/{rid}", headers=admin_headers, json={"flat_rate": 9999}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["flat_rate"] == 9999
        # GET verify
        g = requests.get(f"{API}/raters/{rid}", headers=admin_headers, timeout=30)
        assert g.status_code == 200
        assert g.json()["flat_rate"] == 9999

    def test_delete_per_family(self, admin_headers, created_raters):
        rid = created_raters["ids"]["per_family"]
        r = requests.delete(f"{API}/raters/{rid}", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        g = requests.get(f"{API}/raters/{rid}", headers=admin_headers, timeout=30)
        assert g.status_code == 404
        # mark deleted so cleanup does not fail
        created_raters["ids"].pop("per_family", None)


# ---------- 4. Endorsement premium auto-fill ----------
class TestEndorsementRaterAutoFill:
    """POST /api/endorsements should auto-fill per_life_premium from the rate card
    based on rate_type. If it doesn't, we record it as a bug (see report)."""

    def _submit(self, headers, policy_number, age=None, per_life=None, etype="Addition", relationship="Employee"):
        payload = {
            "policy_number": policy_number,
            "member_name": f"TEST_R48_{int(time.time()*1000)}",
            "age": age,
            "relationship_type": relationship,
            "endorsement_type": etype,
            "endorsement_date": time.strftime("%Y-%m-%d"),
        }
        if per_life is not None:
            payload["per_life_premium"] = per_life
        return requests.post(f"{API}/endorsements", headers=headers, json=payload, timeout=30)

    def test_flat_rate_autofill(self, admin_headers, created_raters):
        # flat_rate was updated to 9999
        pn = created_raters["policy_number"]
        r = self._submit(admin_headers, pn, age=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["prorata_premium"] > 0, "Addition prorata must be positive"
        print(f"[flat_rate] per_life_premium={d.get('per_life_premium')} annual_per_life={d.get('annual_premium_per_life')} prorata={d['prorata_premium']}")
        # BUG CHECK: POST /api/endorsements should auto-fill per_life_premium from flat_rate rater (9999)
        assert d.get("per_life_premium") == 9999, (
            f"Rate card auto-fill NOT applied on POST /api/endorsements. "
            f"Expected per_life_premium=9999 (flat_rate rater), got {d.get('per_life_premium')}"
        )
        # cleanup
        requests.delete(f"{API}/endorsements/{d['id']}", headers=admin_headers, timeout=15)

    def test_per_family_autofill(self, admin_headers, sample_policies, created_raters):
        # per_family rater was deleted in earlier test; recreate quickly for this test
        pn = created_raters["policy_number"]
        r_create = requests.post(f"{API}/raters", headers=admin_headers, json={
            "name": "TEST_PERFAM_R48b",
            "policy_number": pn,
            "rate_type": "per_family",
            "per_family_rate": 15000,
        }, timeout=30)
        assert r_create.status_code == 200
        # Delete flat_rate rater to isolate per_family lookup
        flat_id = created_raters["ids"].get("flat_rate")
        if flat_id:
            requests.delete(f"{API}/raters/{flat_id}", headers=admin_headers, timeout=15)
            created_raters["ids"].pop("flat_rate", None)
        pf_id = r_create.json()["id"]
        created_raters["ids"]["per_family2"] = pf_id
        # Also delete age_band rater to isolate
        ab_id = created_raters["ids"].get("age_band")
        if ab_id:
            requests.delete(f"{API}/raters/{ab_id}", headers=admin_headers, timeout=15)
            created_raters["ids"].pop("age_band", None)

        r = self._submit(admin_headers, pn, age=30, etype="Deletion", relationship="Employee")
        assert r.status_code == 200, r.text
        d = r.json()
        # Deletion: prorata should be negative (refund)
        assert d["prorata_premium"] < 0, f"Deletion prorata should be negative, got {d['prorata_premium']}"
        print(f"[per_family] per_life_premium={d.get('per_life_premium')} annual_per_life={d.get('annual_premium_per_life')} prorata={d['prorata_premium']}")
        assert d.get("per_life_premium") == 15000, (
            f"Rate card auto-fill NOT applied. Expected per_life_premium=15000 (per_family rater), got {d.get('per_life_premium')}"
        )
        requests.delete(f"{API}/endorsements/{d['id']}", headers=admin_headers, timeout=15)

    def test_age_band_autofill(self, admin_headers, created_raters):
        pn = created_raters["policy_number"]
        # Delete any leftover per_family so age_band alone applies
        for key in ("per_family2",):
            rid = created_raters["ids"].get(key)
            if rid:
                requests.delete(f"{API}/raters/{rid}", headers=admin_headers, timeout=15)
                created_raters["ids"].pop(key, None)

        r_create = requests.post(f"{API}/raters", headers=admin_headers, json={
            "name": "TEST_AGE_BAND_R48b",
            "policy_number": pn,
            "rate_type": "age_band",
            "age_bands": [
                {"min_age": 0, "max_age": 35, "per_life_rate": 5000},
                {"min_age": 36, "max_age": 60, "per_life_rate": 8000},
            ],
        }, timeout=30)
        assert r_create.status_code == 200
        created_raters["ids"]["age_band2"] = r_create.json()["id"]

        r = self._submit(admin_headers, pn, age=40)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["prorata_premium"] > 0
        print(f"[age_band] per_life_premium={d.get('per_life_premium')} annual_per_life={d.get('annual_premium_per_life')} prorata={d['prorata_premium']}")
        # age 40 falls in 36-60 band → 8000
        assert d.get("per_life_premium") == 8000, (
            f"Rate card age_band auto-fill NOT applied. Expected per_life_premium=8000 for age=40, got {d.get('per_life_premium')}"
        )
        requests.delete(f"{API}/endorsements/{d['id']}", headers=admin_headers, timeout=15)


# ---------- 5. Cloud Storage: policy_number filter ----------
class TestDocuments:
    def test_upload_and_filter_by_policy(self, admin_headers, sample_policies):
        pn = sample_policies[0]["policy_number"]
        uniq_content = f"test-doc-content-{int(time.time()*1000)}".encode()
        files = {"file": ("TEST_R48_doc.txt", io.BytesIO(uniq_content), "text/plain")}
        r_up = requests.post(
            f"{API}/documents/upload",
            headers=admin_headers,
            params={"category": "test", "policy_number": pn},
            files=files,
            timeout=60,
        )
        assert r_up.status_code == 200, f"Upload failed: {r_up.status_code} {r_up.text}"
        doc_id = r_up.json()["id"]

        # Filtered list
        r_f = requests.get(f"{API}/documents", headers=admin_headers, params={"policy_number": pn}, timeout=30)
        assert r_f.status_code == 200
        filtered = r_f.json()
        assert any(d["id"] == doc_id for d in filtered), "Uploaded doc not present in filtered list"
        assert all(d.get("policy_number") == pn for d in filtered), \
            f"Filter returned docs for other policies: {set(d.get('policy_number') for d in filtered)}"

        # Unfiltered list (admin) — should contain the doc too
        r_all = requests.get(f"{API}/documents", headers=admin_headers, timeout=30)
        assert r_all.status_code == 200
        assert any(d["id"] == doc_id for d in r_all.json())

        # cleanup
        try:
            requests.post(f"{API}/documents/bulk-delete", headers=admin_headers, json={"ids": [doc_id]}, timeout=15)
        except Exception:
            pass


# ---------- 6. Endorsement submission still works end-to-end after Twilio wiring ----------
class TestEndorsementE2EAfterTwilio:
    def test_submit_addition_endorsement(self, admin_headers, sample_policies):
        pn = sample_policies[0]["policy_number"]
        payload = {
            "policy_number": pn,
            "member_name": f"TEST_R48_E2E_{int(time.time()*1000)}",
            "age": 32,
            "relationship_type": "Employee",
            "endorsement_type": "Addition",
            "endorsement_date": time.strftime("%Y-%m-%d"),
            "per_life_premium": 6000,
            "employee_mobile": "9999999999",
        }
        r = requests.post(f"{API}/endorsements", headers=admin_headers, json=payload, timeout=30)
        assert r.status_code == 200, f"Endorsement submit failed after Twilio wiring: {r.status_code} {r.text}"
        d = r.json()
        assert d["prorata_premium"] > 0
        # cleanup
        requests.delete(f"{API}/endorsements/{d['id']}", headers=admin_headers, timeout=15)
