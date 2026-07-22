"""Tests for profile photo upload + serve fix (iteration 40)."""
import io
import os
import struct
import zlib
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"

ADMIN = {"username": "masteradmin", "password": "Admin@123"}
HR = {"username": "arpita", "password": "Password@123"}


def _make_png(color=(255, 0, 0), size=10):
    """Create a tiny valid PNG in memory."""
    w = h = size
    raw = b""
    for _ in range(h):
        raw += b"\x00" + bytes(color) * w
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()


def upload_photo(token, png_bytes, filename="test.png"):
    return requests.post(
        f"{BASE_URL}/api/auth/profile-photo",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": (filename, png_bytes, "image/png")},
        timeout=30,
    )


class TestAdminProfilePhoto:
    def test_admin_upload_returns_backend_served_url(self):
        data = login(ADMIN)
        token = data["access_token"]
        user_id = data["user"]["id"]

        r = upload_photo(token, _make_png(color=(255, 0, 0)))
        assert r.status_code == 200, r.text
        body = r.json()
        assert "profile_photo" in body
        url = body["profile_photo"]
        assert url, "profile_photo URL is empty"
        assert url.startswith("/api/auth/profile-photo/"), f"Expected backend-served URL, got: {url}"
        assert user_id in url

    def test_admin_get_profile_photo_returns_image(self):
        data = login(ADMIN)
        user_id = data["user"]["id"]
        r = requests.get(f"{BASE_URL}/api/auth/profile-photo/{user_id}", timeout=30, allow_redirects=True)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"
        ct = r.headers.get("content-type", "")
        assert ct.startswith("image/"), f"Content-Type not image: {ct}"
        assert len(r.content) > 0

    def test_login_response_includes_profile_photo_url(self):
        # After upload, login response should include backend-served URL (not empty)
        data = login(ADMIN)
        photo = data["user"].get("profile_photo")
        assert photo, f"profile_photo missing/empty in login response: {photo}"
        assert photo.startswith("/api/auth/profile-photo/") or photo.startswith("http"), photo


class TestHRProfilePhoto:
    def test_hr_upload_and_serve(self):
        data = login(HR)
        token = data["access_token"]
        user_id = data["user"]["id"]

        r = upload_photo(token, _make_png(color=(0, 0, 255)))
        assert r.status_code == 200, r.text
        url = r.json()["profile_photo"]
        assert url.startswith("/api/auth/profile-photo/")
        assert user_id in url

        # Now GET it
        r2 = requests.get(f"{BASE_URL}{url}", timeout=30)
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("image/")
        assert len(r2.content) > 0

    def test_hr_login_response_has_photo(self):
        data = login(HR)
        photo = data["user"].get("profile_photo")
        assert photo, "HR profile_photo missing after upload"
        assert photo.startswith("/api/auth/profile-photo/") or photo.startswith("http")


class TestProfilePhotoEdgeCases:
    def test_get_unknown_user_returns_404(self):
        r = requests.get(f"{BASE_URL}/api/auth/profile-photo/nonexistent-user-id-xyz-123", timeout=30)
        assert r.status_code == 404

    def test_get_endpoint_is_public_no_auth(self):
        data = login(ADMIN)
        user_id = data["user"]["id"]
        # No auth header
        r = requests.get(f"{BASE_URL}/api/auth/profile-photo/{user_id}", timeout=30)
        assert r.status_code == 200

    def test_cache_control_header(self):
        data = login(ADMIN)
        user_id = data["user"]["id"]
        r = requests.get(f"{BASE_URL}/api/auth/profile-photo/{user_id}", timeout=30)
        assert r.status_code == 200
        cc = r.headers.get("cache-control", "")
        assert "max-age" in cc.lower(), f"Cache-Control not set: {cc}"


class TestRegression:
    def test_dashboard_analytics_still_works(self):
        data = login(HR)
        token = data["access_token"]
        r = requests.get(
            f"{BASE_URL}/api/dashboard/analytics",
            headers={"Authorization": f"Bearer {token}"}, timeout=30,
        )
        assert r.status_code == 200
        body = r.json()
        assert "premium_summary" in body or "status_distribution" in body

    def test_rate_cards_accessible(self):
        data = login(ADMIN)
        token = data["access_token"]
        r = requests.get(
            f"{BASE_URL}/api/rate-cards",
            headers={"Authorization": f"Bearer {token}"}, timeout=30,
        )
        assert r.status_code == 200

    def test_endorsements_list_regression(self):
        data = login(ADMIN)
        token = data["access_token"]
        r = requests.get(
            f"{BASE_URL}/api/endorsements",
            headers={"Authorization": f"Bearer {token}"}, timeout=30,
        )
        assert r.status_code == 200
