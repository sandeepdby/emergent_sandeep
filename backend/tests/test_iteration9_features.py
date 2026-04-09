"""
Test Suite for Iteration 9 Features:
1. Registration endpoint restricts role to HR only (returns 403 for Admin)
2. Endorsement View/Edit/Delete operations
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDS = {"username": "admin", "password": "admin123"}
HR_CREDS = {"username": "hruser1", "password": "hr123456"}


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin authentication failed")


@pytest.fixture(scope="module")
def hr_token():
    """Get HR authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_CREDS)
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("HR authentication failed")


class TestRegistrationRoleRestriction:
    """Test that public registration is restricted to HR role only"""
    
    def test_register_with_admin_role_returns_403(self):
        """POST /api/auth/register with role=Admin should return 403"""
        unique_id = str(uuid.uuid4())[:8]
        register_data = {
            "username": f"test_admin_{unique_id}",
            "password": "testpass123",
            "full_name": "Test Admin User",
            "email": f"testadmin_{unique_id}@test.com",
            "role": "Admin"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=register_data)
        
        assert response.status_code == 403, f"Expected 403 for Admin role, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        assert "HR" in data["detail"] or "Admin" in data["detail"], f"Error message should mention role restriction: {data['detail']}"
        print(f"✓ Registration with Admin role correctly returns 403: {data['detail']}")
    
    def test_register_with_hr_role_succeeds(self):
        """POST /api/auth/register with role=HR should succeed"""
        unique_id = str(uuid.uuid4())[:8]
        register_data = {
            "username": f"test_hr_{unique_id}",
            "password": "testpass123",
            "full_name": "Test HR User",
            "email": f"testhr_{unique_id}@test.com",
            "role": "HR"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=register_data)
        
        assert response.status_code == 200, f"Expected 200 for HR role, got {response.status_code}: {response.text}"
        data = response.json()
        assert "user" in data
        assert data["user"]["role"] == "HR"
        print(f"✓ Registration with HR role succeeds: {data['user']['username']}")


class TestEndorsementViewEditDelete:
    """Test View/Edit/Delete operations on endorsements"""
    
    def test_get_endorsements_hr(self, hr_token):
        """HR can get their endorsements"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BASE_URL}/api/endorsements", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ HR can fetch endorsements: {len(data)} found")
        return data
    
    def test_get_endorsements_admin(self, admin_token):
        """Admin can get all endorsements"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/endorsements", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin can fetch all endorsements: {len(data)} found")
        return data
    
    def test_get_single_endorsement(self, hr_token):
        """Can get a single endorsement by ID"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        
        # First get list of endorsements
        response = requests.get(f"{BASE_URL}/api/endorsements", headers=headers)
        endorsements = response.json()
        
        if not endorsements:
            pytest.skip("No endorsements available to test")
        
        endorsement_id = endorsements[0]["id"]
        response = requests.get(f"{BASE_URL}/api/endorsements/{endorsement_id}", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == endorsement_id
        
        # Verify all expected fields are present for View dialog
        expected_fields = ["policy_number", "member_name", "relationship_type", "endorsement_type", 
                          "status", "endorsement_date", "effective_date", "annual_premium_per_life", 
                          "prorata_premium"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✓ Single endorsement fetch works with all required fields")
    
    def test_update_pending_endorsement_hr(self, hr_token):
        """HR can update their own pending endorsements"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        
        # Get pending endorsements
        response = requests.get(f"{BASE_URL}/api/endorsements?status=Pending", headers=headers)
        endorsements = response.json()
        
        if not endorsements:
            pytest.skip("No pending endorsements available to test")
        
        endorsement = endorsements[0]
        endorsement_id = endorsement["id"]
        original_name = endorsement["member_name"]
        
        # Update the endorsement
        update_data = {
            "member_name": f"Updated_{original_name[:20]}",
            "remarks": "Test update from iteration 9"
        }
        
        response = requests.put(f"{BASE_URL}/api/endorsements/{endorsement_id}", 
                               json=update_data, headers=headers)
        
        assert response.status_code == 200, f"Update failed: {response.text}"
        data = response.json()
        assert "Updated_" in data["member_name"]
        
        # Revert the change
        revert_data = {"member_name": original_name}
        requests.put(f"{BASE_URL}/api/endorsements/{endorsement_id}", 
                    json=revert_data, headers=headers)
        
        print(f"✓ HR can update pending endorsements")
    
    def test_update_approved_endorsement_hr_fails(self, hr_token):
        """HR cannot update approved endorsements"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        
        # Get approved endorsements
        response = requests.get(f"{BASE_URL}/api/endorsements?status=Approved", headers=headers)
        endorsements = response.json()
        
        if not endorsements:
            pytest.skip("No approved endorsements available to test")
        
        endorsement_id = endorsements[0]["id"]
        
        update_data = {"member_name": "Should Not Update"}
        response = requests.put(f"{BASE_URL}/api/endorsements/{endorsement_id}", 
                               json=update_data, headers=headers)
        
        assert response.status_code == 403, f"Expected 403 for updating approved endorsement, got {response.status_code}"
        print(f"✓ HR correctly cannot update approved endorsements")
    
    def test_admin_can_update_any_endorsement(self, admin_token):
        """Admin can update any endorsement"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get any endorsement
        response = requests.get(f"{BASE_URL}/api/endorsements", headers=headers)
        endorsements = response.json()
        
        if not endorsements:
            pytest.skip("No endorsements available to test")
        
        # Find a pending one for admin to update
        pending = [e for e in endorsements if e["status"] == "Pending"]
        if not pending:
            pytest.skip("No pending endorsements for admin test")
        
        endorsement = pending[0]
        endorsement_id = endorsement["id"]
        original_name = endorsement["member_name"]
        
        update_data = {"remarks": "Admin test update"}
        response = requests.put(f"{BASE_URL}/api/endorsements/{endorsement_id}", 
                               json=update_data, headers=headers)
        
        assert response.status_code == 200, f"Admin update failed: {response.text}"
        print(f"✓ Admin can update endorsements")
    
    def test_delete_pending_endorsement_hr(self, hr_token):
        """HR can delete their own pending endorsements"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        
        # First create a test endorsement to delete
        # Get a policy first
        response = requests.get(f"{BASE_URL}/api/policies", headers=headers)
        policies = response.json()
        
        if not policies:
            pytest.skip("No policies available to create test endorsement")
        
        policy = policies[0]
        
        # Create a test endorsement
        create_data = {
            "policy_number": policy["policy_number"],
            "member_name": "TEST_DELETE_ME",
            "relationship_type": "Employee",
            "endorsement_type": "Addition",
            "endorsement_date": "2025-01-15"
        }
        
        response = requests.post(f"{BASE_URL}/api/endorsements", json=create_data, headers=headers)
        
        if response.status_code != 200:
            pytest.skip(f"Could not create test endorsement: {response.text}")
        
        endorsement_id = response.json()["id"]
        
        # Now delete it
        response = requests.delete(f"{BASE_URL}/api/endorsements/{endorsement_id}", headers=headers)
        
        assert response.status_code == 200, f"Delete failed: {response.text}"
        print(f"✓ HR can delete their own pending endorsements")
    
    def test_delete_approved_endorsement_hr_fails(self, hr_token):
        """HR cannot delete approved endorsements"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        
        # Get approved endorsements
        response = requests.get(f"{BASE_URL}/api/endorsements?status=Approved", headers=headers)
        endorsements = response.json()
        
        if not endorsements:
            pytest.skip("No approved endorsements available to test")
        
        endorsement_id = endorsements[0]["id"]
        
        response = requests.delete(f"{BASE_URL}/api/endorsements/{endorsement_id}", headers=headers)
        
        assert response.status_code == 403, f"Expected 403 for deleting approved endorsement, got {response.status_code}"
        print(f"✓ HR correctly cannot delete approved endorsements")


class TestEndorsementFieldsForViewDialog:
    """Test that all required fields are present for View dialog"""
    
    def test_endorsement_has_all_view_fields(self, hr_token):
        """Verify endorsement response has all fields needed for View dialog"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        
        response = requests.get(f"{BASE_URL}/api/endorsements", headers=headers)
        endorsements = response.json()
        
        if not endorsements:
            pytest.skip("No endorsements available")
        
        endorsement = endorsements[0]
        
        # Fields required for View dialog (from MyEndorsements.js and AllEndorsements.js)
        required_fields = [
            "id", "policy_number", "employee_id", "member_name", "relationship_type",
            "endorsement_type", "status", "dob", "age", "gender", "sum_insured",
            "endorsement_date", "effective_date", "date_of_joining", "date_of_leaving",
            "annual_premium_per_life", "prorata_premium", "remarks"
        ]
        
        missing_fields = []
        for field in required_fields:
            if field not in endorsement:
                missing_fields.append(field)
        
        assert len(missing_fields) == 0, f"Missing fields for View dialog: {missing_fields}"
        print(f"✓ All {len(required_fields)} fields present for View dialog")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
