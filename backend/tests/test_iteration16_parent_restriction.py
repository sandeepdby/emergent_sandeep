"""
Test Suite for Iteration 16 Features:
1. Parent restriction for mid-term Addition/Deletion endorsements
2. Contact form API endpoint
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://insurehub-portal.preview.emergentagent.com')

# Test credentials
HR_USER = {"username": "hruser1", "password": "hr123456"}
ADMIN_USER = {"username": "admin@insurehub.com", "password": "admin123"}
MASTER_ADMIN = {"username": "masteradmin", "password": "Admin@123"}

# Test policy numbers from previous iterations
TEST_POLICY_NUMBERS = ["TEST_POL_112123", "POL-E2E-TEST", "POL-NEW-001", "POL-GMC-002"]


class TestAuthentication:
    """Authentication tests to get tokens"""
    
    def test_hr_login(self):
        """Test HR user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_USER)
        assert response.status_code == 200, f"HR login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "HR"
        print(f"✓ HR login successful - user: {data['user']['username']}")
        return data["access_token"]
    
    def test_admin_login(self):
        """Test Admin user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MASTER_ADMIN)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "Admin"
        print(f"✓ Admin login successful - user: {data['user']['username']}")
        return data["access_token"]


class TestParentRestrictionBackend:
    """Test parent restriction for mid-term Addition/Deletion endorsements"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and policy number"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_USER)
        if response.status_code != 200:
            pytest.skip("HR login failed")
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get available policies
        policies_response = requests.get(f"{BASE_URL}/api/policies", headers=self.headers)
        if policies_response.status_code == 200 and policies_response.json():
            self.policy_number = policies_response.json()[0]["policy_number"]
        else:
            self.policy_number = "TEST_POL_112123"
    
    def test_father_addition_rejected(self):
        """POST /api/endorsements with Father + Addition should return 400"""
        payload = {
            "policy_number": self.policy_number,
            "member_name": "TEST_Father_Addition",
            "relationship_type": "Father",
            "endorsement_type": "Addition",
            "endorsement_date": "2026-01-15"
        }
        response = requests.post(f"{BASE_URL}/api/endorsements", json=payload, headers=self.headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert "Parents" in response.json().get("detail", "") or "Father" in response.json().get("detail", "")
        print(f"✓ Father + Addition correctly rejected with 400: {response.json()['detail']}")
    
    def test_mother_addition_rejected(self):
        """POST /api/endorsements with Mother + Addition should return 400"""
        payload = {
            "policy_number": self.policy_number,
            "member_name": "TEST_Mother_Addition",
            "relationship_type": "Mother",
            "endorsement_type": "Addition",
            "endorsement_date": "2026-01-15"
        }
        response = requests.post(f"{BASE_URL}/api/endorsements", json=payload, headers=self.headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert "Parents" in response.json().get("detail", "") or "Mother" in response.json().get("detail", "")
        print(f"✓ Mother + Addition correctly rejected with 400: {response.json()['detail']}")
    
    def test_father_deletion_rejected(self):
        """POST /api/endorsements with Father + Deletion should return 400"""
        payload = {
            "policy_number": self.policy_number,
            "member_name": "TEST_Father_Deletion",
            "relationship_type": "Father",
            "endorsement_type": "Deletion",
            "endorsement_date": "2026-01-15"
        }
        response = requests.post(f"{BASE_URL}/api/endorsements", json=payload, headers=self.headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert "Parents" in response.json().get("detail", "") or "Father" in response.json().get("detail", "")
        print(f"✓ Father + Deletion correctly rejected with 400: {response.json()['detail']}")
    
    def test_mother_deletion_rejected(self):
        """POST /api/endorsements with Mother + Deletion should return 400"""
        payload = {
            "policy_number": self.policy_number,
            "member_name": "TEST_Mother_Deletion",
            "relationship_type": "Mother",
            "endorsement_type": "Deletion",
            "endorsement_date": "2026-01-15"
        }
        response = requests.post(f"{BASE_URL}/api/endorsements", json=payload, headers=self.headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert "Parents" in response.json().get("detail", "") or "Mother" in response.json().get("detail", "")
        print(f"✓ Mother + Deletion correctly rejected with 400: {response.json()['detail']}")
    
    def test_father_correction_allowed(self):
        """POST /api/endorsements with Father + Correction should SUCCEED"""
        payload = {
            "policy_number": self.policy_number,
            "member_name": "TEST_Father_Correction",
            "relationship_type": "Father",
            "endorsement_type": "Correction",
            "endorsement_date": "2026-01-15"
        }
        response = requests.post(f"{BASE_URL}/api/endorsements", json=payload, headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["relationship_type"] == "Father"
        assert data["endorsement_type"] == "Correction"
        print(f"✓ Father + Correction correctly allowed - endorsement ID: {data['id']}")
        # Cleanup - delete the test endorsement
        return data["id"]
    
    def test_mother_correction_allowed(self):
        """POST /api/endorsements with Mother + Correction should SUCCEED"""
        payload = {
            "policy_number": self.policy_number,
            "member_name": "TEST_Mother_Correction",
            "relationship_type": "Mother",
            "endorsement_type": "Correction",
            "endorsement_date": "2026-01-15"
        }
        response = requests.post(f"{BASE_URL}/api/endorsements", json=payload, headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["relationship_type"] == "Mother"
        assert data["endorsement_type"] == "Correction"
        print(f"✓ Mother + Correction correctly allowed - endorsement ID: {data['id']}")
    
    def test_father_midterm_addition_allowed(self):
        """POST /api/endorsements with Father + Midterm addition should SUCCEED"""
        payload = {
            "policy_number": self.policy_number,
            "member_name": "TEST_Father_Midterm",
            "relationship_type": "Father",
            "endorsement_type": "Midterm addition",
            "endorsement_date": "2026-01-15"
        }
        response = requests.post(f"{BASE_URL}/api/endorsements", json=payload, headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["relationship_type"] == "Father"
        assert data["endorsement_type"] == "Midterm addition"
        print(f"✓ Father + Midterm addition correctly allowed - endorsement ID: {data['id']}")
    
    def test_spouse_addition_allowed(self):
        """POST /api/endorsements with Spouse + Addition should SUCCEED"""
        payload = {
            "policy_number": self.policy_number,
            "member_name": "TEST_Spouse_Addition",
            "relationship_type": "Spouse",
            "endorsement_type": "Addition",
            "endorsement_date": "2026-01-15"
        }
        response = requests.post(f"{BASE_URL}/api/endorsements", json=payload, headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["relationship_type"] == "Spouse"
        assert data["endorsement_type"] == "Addition"
        print(f"✓ Spouse + Addition correctly allowed - endorsement ID: {data['id']}")
    
    def test_employee_addition_allowed(self):
        """POST /api/endorsements with Employee + Addition should SUCCEED"""
        payload = {
            "policy_number": self.policy_number,
            "member_name": "TEST_Employee_Addition",
            "relationship_type": "Employee",
            "endorsement_type": "Addition",
            "endorsement_date": "2026-01-15"
        }
        response = requests.post(f"{BASE_URL}/api/endorsements", json=payload, headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["relationship_type"] == "Employee"
        assert data["endorsement_type"] == "Addition"
        print(f"✓ Employee + Addition correctly allowed - endorsement ID: {data['id']}")
    
    def test_kids_deletion_allowed(self):
        """POST /api/endorsements with Kids + Deletion should SUCCEED"""
        payload = {
            "policy_number": self.policy_number,
            "member_name": "TEST_Kids_Deletion",
            "relationship_type": "Kids",
            "endorsement_type": "Deletion",
            "endorsement_date": "2026-01-15"
        }
        response = requests.post(f"{BASE_URL}/api/endorsements", json=payload, headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["relationship_type"] == "Kids"
        assert data["endorsement_type"] == "Deletion"
        print(f"✓ Kids + Deletion correctly allowed - endorsement ID: {data['id']}")


class TestContactFormAPI:
    """Test Contact form API endpoint"""
    
    def test_contact_form_success(self):
        """POST /api/contact with valid data should return success"""
        payload = {
            "name": "TEST_Contact_User",
            "email": "test@example.com",
            "phone": "+91 98765 43210",
            "company": "Test Company",
            "message": "This is a test message from automated testing."
        }
        response = requests.post(f"{BASE_URL}/api/contact", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        assert "Thank you" in data["message"] or "get back" in data["message"].lower()
        print(f"✓ Contact form submission successful: {data['message']}")
    
    def test_contact_form_minimal_data(self):
        """POST /api/contact with minimal required data should succeed"""
        payload = {
            "name": "TEST_Minimal_User",
            "email": "minimal@test.com",
            "message": "Minimal test message"
        }
        response = requests.post(f"{BASE_URL}/api/contact", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Contact form with minimal data successful")
    
    def test_contact_form_missing_name(self):
        """POST /api/contact without name should fail validation"""
        payload = {
            "email": "test@example.com",
            "message": "Test message"
        }
        response = requests.post(f"{BASE_URL}/api/contact", json=payload)
        assert response.status_code == 422, f"Expected 422 validation error, got {response.status_code}"
        print(f"✓ Contact form correctly rejects missing name field")
    
    def test_contact_form_missing_email(self):
        """POST /api/contact without email should fail validation"""
        payload = {
            "name": "Test User",
            "message": "Test message"
        }
        response = requests.post(f"{BASE_URL}/api/contact", json=payload)
        assert response.status_code == 422, f"Expected 422 validation error, got {response.status_code}"
        print(f"✓ Contact form correctly rejects missing email field")
    
    def test_contact_form_missing_message(self):
        """POST /api/contact without message should fail validation"""
        payload = {
            "name": "Test User",
            "email": "test@example.com"
        }
        response = requests.post(f"{BASE_URL}/api/contact", json=payload)
        assert response.status_code == 422, f"Expected 422 validation error, got {response.status_code}"
        print(f"✓ Contact form correctly rejects missing message field")


class TestHealthEndpoint:
    """Test health check endpoint"""
    
    def test_health_check(self):
        """GET /api/health should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✓ Health check passed: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
