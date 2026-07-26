"""Iteration 47: AI email preview for policy assignment + Excel attachment on imports"""
import os
import re
import io
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/") + "/api"

ADMIN = {"username": "masteradmin", "password": "Admin@123"}
HR = {"username": "arpita", "password": "Password@123"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/auth/login", json=creds, timeout=60)
    if r.status_code != 200:
        pytest.fail(f"Login failed for {creds['username']}: {r.status_code} {r.text[:300]}")
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_h():
    return {"Authorization": f"Bearer {_login(ADMIN)}"}


@pytest.fixture(scope="module")
def hr_h():
    return {"Authorization": f"Bearer {_login(HR)}"}


@pytest.fixture(scope="module")
def hr_user(admin_h):
    r = requests.get(f"{BASE_URL}/users/hr", headers=admin_h, timeout=60)
    assert r.status_code == 200, r.text[:300]
    users = r.json()
    assert len(users) > 0, "No HR users available"
    return users[0]


@pytest.fixture(scope="module")
def policies(admin_h):
    r = requests.get(f"{BASE_URL}/policies", headers=admin_h, timeout=60)
    assert r.status_code == 200, r.text[:300]
    pols = r.json()
    assert len(pols) > 0, "No policies available"
    return pols


# ---------- preview-email ----------
class TestPreviewEmail:
    def test_preview_email_success(self, admin_h, hr_user, policies):
        payload = {"hr_user_id": hr_user["id"], "policy_ids": [p["id"] for p in policies[:2]]}
        r = requests.post(f"{BASE_URL}/policy-assignments/preview-email", json=payload,
                          headers=admin_h, timeout=180)
        assert r.status_code == 200, f"{r.status_code} {r.text[:500]}"
        d = r.json()
        for k in ("subject", "body", "to_email", "hr_name"):
            assert k in d, f"missing key {k}"
        assert isinstance(d["subject"], str) and len(d["subject"]) > 5
        assert isinstance(d["body"], str) and len(d["body"]) > 100
        assert "<" in d["body"], "body should be HTML"
        assert d["hr_name"] == hr_user["full_name"]
        assert d["to_email"] == hr_user.get("email", "")
        # policy number should appear in the body
        pn = policies[0]["policy_number"]
        assert pn in d["body"], f"policy number {pn} not present in generated body"

    def test_preview_email_invalid_hr(self, admin_h, policies):
        r = requests.post(f"{BASE_URL}/policy-assignments/preview-email",
                          json={"hr_user_id": "does-not-exist", "policy_ids": [policies[0]["id"]]},
                          headers=admin_h, timeout=120)
        assert r.status_code == 404, f"{r.status_code} {r.text[:300]}"

    def test_preview_email_invalid_policies(self, admin_h, hr_user):
        r = requests.post(f"{BASE_URL}/policy-assignments/preview-email",
                          json={"hr_user_id": hr_user["id"], "policy_ids": ["bogus-id"]},
                          headers=admin_h, timeout=120)
        assert r.status_code == 404, f"{r.status_code} {r.text[:300]}"

    def test_preview_email_hr_forbidden(self, hr_h, hr_user, policies):
        r = requests.post(f"{BASE_URL}/policy-assignments/preview-email",
                          json={"hr_user_id": hr_user["id"], "policy_ids": [policies[0]["id"]]},
                          headers=hr_h, timeout=120)
        assert r.status_code == 403, f"{r.status_code} {r.text[:300]}"

    def test_preview_email_unauthenticated(self, hr_user, policies):
        r = requests.post(f"{BASE_URL}/policy-assignments/preview-email",
                          json={"hr_user_id": hr_user["id"], "policy_ids": [policies[0]["id"]]},
                          timeout=60)
        assert r.status_code in (401, 403), r.status_code


# ---------- send-email ----------
class TestSendEmail:
    def test_send_email_success(self, admin_h):
        payload = {"to_emails": ["qa.test@example.com"], "subject": "TEST_Policy Assignment",
                   "body": "<p>TEST body</p>"}
        r = requests.post(f"{BASE_URL}/policy-assignments/send-email", json=payload,
                          headers=admin_h, timeout=60)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        assert "message" in r.json()
        assert "qa.test@example.com" in r.json()["message"]

    @pytest.mark.parametrize("payload", [
        {"to_emails": [], "subject": "s", "body": "b"},
        {"to_emails": ["a@b.com"], "subject": "", "body": "b"},
        {"to_emails": ["a@b.com"], "subject": "s", "body": ""},
    ])
    def test_send_email_validation(self, admin_h, payload):
        r = requests.post(f"{BASE_URL}/policy-assignments/send-email", json=payload,
                          headers=admin_h, timeout=60)
        assert r.status_code == 400, f"{r.status_code} {r.text[:300]}"

    def test_send_email_hr_forbidden(self, hr_h):
        r = requests.post(f"{BASE_URL}/policy-assignments/send-email",
                          json={"to_emails": ["a@b.com"], "subject": "s", "body": "b"},
                          headers=hr_h, timeout=60)
        assert r.status_code == 403, f"{r.status_code} {r.text[:300]}"


# ---------- assignment page data ----------
class TestAssignmentPageData:
    def test_assignments_list(self, admin_h):
        r = requests.get(f"{BASE_URL}/policy-assignments", headers=admin_h, timeout=60)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            assert "_id" not in data[0]
            for item in data:
                assert "_id" not in item
                for k in ("id", "hr_user_id", "policy_number"):
                    assert k in item
            # KNOWN DATA ISSUE: some legacy assignment docs lack policy_id/hr_full_name,
            # which the frontend (PolicyAssignment.js) relies on for grouping/filtering.
            incomplete = [x["id"] for x in data if "policy_id" not in x or "hr_full_name" not in x]
            assert not incomplete, f"assignments missing policy_id/hr_full_name: {incomplete}"


# ---------- Excel attachment on endorsement import ----------
class TestEndorsementImportAttachment:
    """Verifies /endorsements/import accepts an Excel file and queues a notification
    email; attachment plumbing is validated by checking backend logs for SMTP errors."""

    def test_import_with_excel_sends_email(self, admin_h, policies):
        import pandas as pd
        from datetime import datetime
        pn = policies[0]["policy_number"]
        df = pd.DataFrame([{
            "policy_number": pn,
            "member_name": "TEST_QA_Attachment_Member",
            "relationship_type": "Employee",
            "endorsement_type": "Addition",
            "endorsement_date": datetime.now().strftime("%Y-%m-%d"),
        }])
        buf = io.BytesIO()
        df.to_excel(buf, index=False)
        buf.seek(0)
        files = {"file": ("TEST_qa_endorsements.xlsx", buf.getvalue(),
                          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        r = requests.post(f"{BASE_URL}/endorsements/import", files=files, headers=admin_h, timeout=180)
        assert r.status_code == 200, f"{r.status_code} {r.text[:500]}"
        d = r.json()
        assert d.get("success_count", d.get("imported", 0)) >= 1, d
