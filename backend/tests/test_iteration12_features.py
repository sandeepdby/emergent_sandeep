"""
Iteration 12 Tests: Claims Management, Policy Analytics, Claims Analytics
- Password visibility toggle (frontend only - tested via Playwright)
- HR Dashboard: Policies and Claims tabs
- Admin Dashboard: Claims tab with CRUD
- Backend APIs: /api/claims, /api/claims-analytics, /api/policies-analytics
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDS = {"username": "admin", "password": "admin123"}
MASTER_ADMIN_CREDS = {"username": "masteradmin", "password": "Admin@123"}
HR_CREDS = {"username": "hruser1", "password": "hr123456"}


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    if response.status_code == 200:
        return response.json().get("access_token")
    # Try master admin if regular admin fails
    response = requests.post(f"{BASE_URL}/api/auth/login", json=MASTER_ADMIN_CREDS)
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin authentication failed")


@pytest.fixture(scope="module")
def hr_token():
    """Get HR user authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_CREDS)
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("HR authentication failed")


@pytest.fixture
def admin_headers(admin_token):
    """Headers with admin auth token"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture
def hr_headers(hr_token):
    """Headers with HR auth token"""
    return {"Authorization": f"Bearer {hr_token}", "Content-Type": "application/json"}


class TestClaimsEndpoints:
    """Test Claims CRUD endpoints"""

    def test_get_claims_list(self, admin_headers):
        """GET /api/claims should return claims list"""
        response = requests.get(f"{BASE_URL}/api/claims", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/claims returned {len(data)} claims")

    def test_create_claim_admin_only(self, admin_headers):
        """POST /api/claims should create a claim (admin only)"""
        claim_data = {
            "policy_number": "TEST-POL-001",
            "employee_name": "Test Employee",
            "patient_name": "Test Patient",
            "relationship": "Self",
            "claim_type": "Cashless",
            "diagnosis": "Test Diagnosis",
            "hospital_name": "Test Hospital",
            "claimed_amount": 50000,
            "approved_amount": 45000,
            "settled_amount": 0,
            "status": "Submitted",
            "policy_type": "Group Health"
        }
        response = requests.post(f"{BASE_URL}/api/claims", json=claim_data, headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain claim id"
        assert "claim_number" in data, "Response should contain claim_number"
        assert data["employee_name"] == "Test Employee"
        assert data["claimed_amount"] == 50000
        print(f"✓ POST /api/claims created claim: {data['claim_number']}")
        # Store for cleanup
        TestClaimsEndpoints.created_claim_id = data["id"]

    def test_create_claim_hr_forbidden(self, hr_headers):
        """POST /api/claims should return 403 for HR users"""
        claim_data = {
            "policy_number": "TEST-POL-002",
            "employee_name": "HR Test",
            "patient_name": "HR Patient",
            "claimed_amount": 10000
        }
        response = requests.post(f"{BASE_URL}/api/claims", json=claim_data, headers=hr_headers)
        assert response.status_code == 403, f"Expected 403 for HR user, got {response.status_code}"
        print("✓ POST /api/claims correctly returns 403 for HR users")

    def test_get_single_claim(self, admin_headers):
        """GET /api/claims/{id} should return a single claim"""
        if not hasattr(TestClaimsEndpoints, 'created_claim_id'):
            pytest.skip("No claim created to test")
        claim_id = TestClaimsEndpoints.created_claim_id
        response = requests.get(f"{BASE_URL}/api/claims/{claim_id}", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["id"] == claim_id
        print(f"✓ GET /api/claims/{claim_id} returned claim successfully")

    def test_update_claim_admin_only(self, admin_headers):
        """PUT /api/claims/{id} should update a claim (admin only)"""
        if not hasattr(TestClaimsEndpoints, 'created_claim_id'):
            pytest.skip("No claim created to test")
        claim_id = TestClaimsEndpoints.created_claim_id
        update_data = {
            "policy_number": "TEST-POL-001",
            "employee_name": "Test Employee Updated",
            "patient_name": "Test Patient",
            "relationship": "Self",
            "claim_type": "Cashless",
            "claimed_amount": 50000,
            "approved_amount": 48000,
            "settled_amount": 48000,
            "status": "Settled",
            "policy_type": "Group Health"
        }
        response = requests.put(f"{BASE_URL}/api/claims/{claim_id}", json=update_data, headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["status"] == "Settled"
        assert data["settled_amount"] == 48000
        print(f"✓ PUT /api/claims/{claim_id} updated claim to Settled status")

    def test_update_claim_hr_forbidden(self, hr_headers):
        """PUT /api/claims/{id} should return 403 for HR users"""
        if not hasattr(TestClaimsEndpoints, 'created_claim_id'):
            pytest.skip("No claim created to test")
        claim_id = TestClaimsEndpoints.created_claim_id
        update_data = {
            "policy_number": "TEST-POL-001",
            "employee_name": "HR Attempt",
            "patient_name": "Test Patient",
            "claimed_amount": 50000
        }
        response = requests.put(f"{BASE_URL}/api/claims/{claim_id}", json=update_data, headers=hr_headers)
        assert response.status_code == 403, f"Expected 403 for HR user, got {response.status_code}"
        print("✓ PUT /api/claims correctly returns 403 for HR users")

    def test_delete_claim_admin_only(self, admin_headers):
        """DELETE /api/claims/{id} should delete a claim (admin only)"""
        if not hasattr(TestClaimsEndpoints, 'created_claim_id'):
            pytest.skip("No claim created to test")
        claim_id = TestClaimsEndpoints.created_claim_id
        response = requests.delete(f"{BASE_URL}/api/claims/{claim_id}", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/claims/{claim_id}", headers=admin_headers)
        assert get_response.status_code == 404, "Deleted claim should return 404"
        print(f"✓ DELETE /api/claims/{claim_id} deleted claim successfully")

    def test_delete_claim_hr_forbidden(self, hr_headers, admin_headers):
        """DELETE /api/claims/{id} should return 403 for HR users"""
        # First create a claim to test deletion
        claim_data = {
            "policy_number": "TEST-POL-HR-DEL",
            "employee_name": "HR Delete Test",
            "patient_name": "Patient",
            "claimed_amount": 5000
        }
        create_response = requests.post(f"{BASE_URL}/api/claims", json=claim_data, headers=admin_headers)
        if create_response.status_code != 200:
            pytest.skip("Could not create claim for test")
        claim_id = create_response.json()["id"]
        
        # Try to delete as HR
        response = requests.delete(f"{BASE_URL}/api/claims/{claim_id}", headers=hr_headers)
        assert response.status_code == 403, f"Expected 403 for HR user, got {response.status_code}"
        print("✓ DELETE /api/claims correctly returns 403 for HR users")
        
        # Cleanup - delete as admin
        requests.delete(f"{BASE_URL}/api/claims/{claim_id}", headers=admin_headers)


class TestClaimsAnalytics:
    """Test Claims Analytics endpoint"""

    def test_get_claims_analytics(self, admin_headers):
        """GET /api/claims-analytics should return analytics data"""
        response = requests.get(f"{BASE_URL}/api/claims-analytics", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify required fields
        assert "total_claims" in data, "Should have total_claims"
        assert "total_claimed_amount" in data, "Should have total_claimed_amount"
        assert "total_approved_amount" in data, "Should have total_approved_amount"
        assert "total_settled_amount" in data, "Should have total_settled_amount"
        assert "settlement_ratio" in data, "Should have settlement_ratio"
        assert "status_distribution" in data, "Should have status_distribution"
        assert "type_distribution" in data, "Should have type_distribution"
        assert "monthly_trend" in data, "Should have monthly_trend"
        
        print(f"✓ GET /api/claims-analytics returned: total_claims={data['total_claims']}, "
              f"claimed={data['total_claimed_amount']}, settled={data['total_settled_amount']}")

    def test_claims_analytics_hr_access(self, hr_headers):
        """GET /api/claims-analytics should be accessible by HR users"""
        response = requests.get(f"{BASE_URL}/api/claims-analytics", headers=hr_headers)
        assert response.status_code == 200, f"HR should access claims analytics, got {response.status_code}"
        print("✓ GET /api/claims-analytics accessible by HR users")

    def test_claims_analytics_with_filter(self, admin_headers):
        """GET /api/claims-analytics with policy_type filter"""
        response = requests.get(f"{BASE_URL}/api/claims-analytics?policy_type=Group Health", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET /api/claims-analytics with policy_type filter works")


class TestPoliciesAnalytics:
    """Test Policies Analytics endpoint"""

    def test_get_policies_analytics(self, admin_headers):
        """GET /api/policies-analytics should return analytics data"""
        response = requests.get(f"{BASE_URL}/api/policies-analytics", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify required fields
        assert "total_policies" in data, "Should have total_policies"
        assert "active_policies" in data, "Should have active_policies"
        assert "expired_policies" in data, "Should have expired_policies"
        assert "total_lives_covered" in data, "Should have total_lives_covered"
        assert "total_annual_premium" in data, "Should have total_annual_premium"
        assert "type_breakdown" in data, "Should have type_breakdown"
        assert "policies" in data, "Should have policies list"
        
        print(f"✓ GET /api/policies-analytics returned: total={data['total_policies']}, "
              f"active={data['active_policies']}, lives={data['total_lives_covered']}")

    def test_policies_analytics_hr_access(self, hr_headers):
        """GET /api/policies-analytics should be accessible by HR users"""
        response = requests.get(f"{BASE_URL}/api/policies-analytics", headers=hr_headers)
        assert response.status_code == 200, f"HR should access policies analytics, got {response.status_code}"
        data = response.json()
        assert "policies" in data
        print(f"✓ GET /api/policies-analytics accessible by HR users, {len(data['policies'])} policies")


class TestClaimsFiltering:
    """Test Claims list filtering"""

    def test_claims_filter_by_status(self, admin_headers):
        """GET /api/claims with status filter"""
        response = requests.get(f"{BASE_URL}/api/claims?status=Submitted", headers=admin_headers)
        assert response.status_code == 200
        print("✓ GET /api/claims with status filter works")

    def test_claims_filter_by_policy_type(self, admin_headers):
        """GET /api/claims with policy_type filter"""
        response = requests.get(f"{BASE_URL}/api/claims?policy_type=Group Health", headers=admin_headers)
        assert response.status_code == 200
        print("✓ GET /api/claims with policy_type filter works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
