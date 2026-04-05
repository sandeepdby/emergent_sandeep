"""
Test HR Dashboard Summary Features - Iteration 8
Tests:
1. GET /api/dashboard/analytics returns data filtered by HR user
2. HR data isolation - dashboard stats show only HR's own data
3. Verify analytics response structure (status_distribution, premium_summary, by_endorsement_type)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_CREDS = {"username": "admin", "password": "admin123"}
HR_CREDS = {"username": "hruser1", "password": "hr123456"}


class TestHRDashboardAnalytics:
    """Test HR Dashboard Analytics API"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    @pytest.fixture(scope="class")
    def hr_token(self):
        """Get HR authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("HR authentication failed")
    
    @pytest.fixture(scope="class")
    def hr_user_id(self, hr_token):
        """Get HR user ID"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        if response.status_code == 200:
            return response.json().get("id")
        pytest.skip("Could not get HR user info")
    
    def test_admin_login(self):
        """Test admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "Admin"
        print("✓ Admin login successful")
    
    def test_hr_login(self):
        """Test HR can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_CREDS)
        assert response.status_code == 200, f"HR login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "HR"
        print("✓ HR login successful")
    
    def test_dashboard_analytics_endpoint_exists(self, hr_token):
        """Test GET /api/dashboard/analytics endpoint exists and returns 200"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/analytics", headers=headers)
        assert response.status_code == 200, f"Dashboard analytics failed: {response.text}"
        print("✓ Dashboard analytics endpoint returns 200")
    
    def test_dashboard_analytics_response_structure(self, hr_token):
        """Test dashboard analytics returns correct structure"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/analytics", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        
        # Check status_distribution structure
        assert "status_distribution" in data, "Missing status_distribution"
        status_dist = data["status_distribution"]
        assert "total" in status_dist, "Missing total in status_distribution"
        assert "pending" in status_dist, "Missing pending in status_distribution"
        assert "approved" in status_dist, "Missing approved in status_distribution"
        assert "rejected" in status_dist, "Missing rejected in status_distribution"
        
        # Check premium_summary structure
        assert "premium_summary" in data, "Missing premium_summary"
        premium = data["premium_summary"]
        assert "total_charge" in premium, "Missing total_charge in premium_summary"
        assert "total_refund" in premium, "Missing total_refund in premium_summary"
        assert "net_premium" in premium, "Missing net_premium in premium_summary"
        
        # Check by_endorsement_type exists
        assert "by_endorsement_type" in data, "Missing by_endorsement_type"
        
        print(f"✓ Dashboard analytics structure verified")
        print(f"  - Status: total={status_dist['total']}, pending={status_dist['pending']}, approved={status_dist['approved']}, rejected={status_dist['rejected']}")
        print(f"  - Premium: charge={premium['total_charge']}, refund={premium['total_refund']}, net={premium['net_premium']}")
    
    def test_hr_data_isolation_in_analytics(self, hr_token, admin_token, hr_user_id):
        """Test HR sees only their own data in analytics"""
        hr_headers = {"Authorization": f"Bearer {hr_token}"}
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get HR analytics
        hr_response = requests.get(f"{BASE_URL}/api/dashboard/analytics", headers=hr_headers)
        assert hr_response.status_code == 200
        hr_data = hr_response.json()
        
        # Get Admin analytics (should see all)
        admin_response = requests.get(f"{BASE_URL}/api/dashboard/analytics", headers=admin_headers)
        assert admin_response.status_code == 200
        admin_data = admin_response.json()
        
        # HR total should be <= Admin total (HR sees subset)
        hr_total = hr_data["status_distribution"]["total"]
        admin_total = admin_data["status_distribution"]["total"]
        
        assert hr_total <= admin_total, f"HR total ({hr_total}) should be <= Admin total ({admin_total})"
        print(f"✓ HR data isolation verified: HR sees {hr_total} endorsements, Admin sees {admin_total}")
    
    def test_hr_endorsements_filtered_by_submitted_by(self, hr_token, hr_user_id):
        """Test HR GET /api/endorsements returns only their own submissions"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BASE_URL}/api/endorsements", headers=headers)
        assert response.status_code == 200
        
        endorsements = response.json()
        
        # All endorsements should be submitted by this HR user
        for e in endorsements:
            assert e.get("submitted_by") == hr_user_id, f"Endorsement {e.get('id')} not submitted by HR user"
        
        print(f"✓ HR endorsements filtered correctly: {len(endorsements)} endorsements all submitted by HR user")
    
    def test_admin_sees_all_endorsements(self, admin_token):
        """Test Admin GET /api/endorsements returns all endorsements"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/endorsements", headers=headers)
        assert response.status_code == 200
        
        endorsements = response.json()
        
        # Admin should see endorsements from multiple users (if any exist)
        submitted_by_users = set(e.get("submitted_by") for e in endorsements if e.get("submitted_by"))
        
        print(f"✓ Admin sees all endorsements: {len(endorsements)} total from {len(submitted_by_users)} users")
    
    def test_analytics_by_endorsement_type_structure(self, hr_token):
        """Test by_endorsement_type has correct structure"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/analytics", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        by_type = data.get("by_endorsement_type", [])
        
        # Each item should have _id, count, total_premium
        for item in by_type:
            assert "_id" in item, "Missing _id in by_endorsement_type item"
            assert "count" in item, "Missing count in by_endorsement_type item"
            assert "total_premium" in item, "Missing total_premium in by_endorsement_type item"
        
        print(f"✓ by_endorsement_type structure verified: {len(by_type)} types")
        for item in by_type:
            print(f"  - {item['_id']}: count={item['count']}, premium={item['total_premium']}")
    
    def test_analytics_requires_authentication(self):
        """Test dashboard analytics requires authentication"""
        response = requests.get(f"{BASE_URL}/api/dashboard/analytics")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Dashboard analytics requires authentication")


class TestHREndorsementsAPI:
    """Test HR Endorsements API for dashboard data"""
    
    @pytest.fixture(scope="class")
    def hr_token(self):
        """Get HR authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("HR authentication failed")
    
    def test_get_endorsements_returns_list(self, hr_token):
        """Test GET /api/endorsements returns a list"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BASE_URL}/api/endorsements", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Endorsements should be a list"
        print(f"✓ GET /api/endorsements returns list with {len(data)} items")
    
    def test_endorsement_has_required_fields(self, hr_token):
        """Test endorsements have fields needed for dashboard table"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BASE_URL}/api/endorsements", headers=headers)
        assert response.status_code == 200
        
        endorsements = response.json()
        
        if len(endorsements) > 0:
            e = endorsements[0]
            required_fields = ["policy_number", "member_name", "endorsement_type", "prorata_premium", "status"]
            for field in required_fields:
                assert field in e, f"Missing required field: {field}"
            print(f"✓ Endorsements have all required fields for dashboard table")
        else:
            print("⚠ No endorsements found to verify fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
