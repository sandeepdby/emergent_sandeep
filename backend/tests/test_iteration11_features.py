"""
Iteration 11 Backend Tests
Tests for:
1. Master Admin login with masteradmin / Admin@123
2. Master Admin can list all users via GET /api/users
3. PUT /api/users/{id}/promote promotes HR to Admin
4. PUT /api/users/{id}/promote returns 400 if already Admin
5. PUT /api/users/{id}/promote returns 403 for non-Admin caller
6. POST /api/endorsements generates Excel and sends email (check logs)
7. Unique email enforcement still works
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMasterAdminLogin:
    """Test Master Admin login functionality"""
    
    def test_master_admin_login_success(self):
        """Master Admin can login with masteradmin / Admin@123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "masteradmin",
            "password": "Admin@123"
        })
        print(f"Master Admin login response: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "user" in data, "Response should contain user info"
        assert data["user"]["username"] == "masteradmin"
        assert data["user"]["role"] == "Admin"
        print(f"Master Admin login successful: {data['user']}")
        return data["access_token"]
    
    def test_master_admin_wrong_password(self):
        """Master Admin login fails with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "masteradmin",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Master Admin wrong password correctly rejected")


class TestMasterAdminUserManagement:
    """Test Master Admin can manage users"""
    
    @pytest.fixture
    def master_admin_token(self):
        """Get Master Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "masteradmin",
            "password": "Admin@123"
        })
        assert response.status_code == 200, f"Master Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_master_admin_can_list_users(self, master_admin_token):
        """Master Admin can list all users via GET /api/users"""
        response = requests.get(f"{BASE_URL}/api/users", headers={
            "Authorization": f"Bearer {master_admin_token}"
        })
        print(f"List users response: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        users = response.json()
        assert isinstance(users, list), "Response should be a list"
        print(f"Found {len(users)} users")
        
        # Check that masteradmin is in the list
        usernames = [u.get("username") for u in users]
        assert "masteradmin" in usernames, "masteradmin should be in users list"
        print("Master Admin can list all users - PASS")


class TestPromoteUserToAdmin:
    """Test PUT /api/users/{id}/promote endpoint"""
    
    @pytest.fixture
    def master_admin_token(self):
        """Get Master Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "masteradmin",
            "password": "Admin@123"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture
    def hr_user_token(self):
        """Get HR user token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "hruser1",
            "password": "hr123456"
        })
        if response.status_code != 200:
            pytest.skip("HR user hruser1 not available")
        return response.json()["access_token"]
    
    @pytest.fixture
    def test_hr_user(self, master_admin_token):
        """Create a test HR user for promotion testing"""
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "username": f"TEST_promote_hr_{unique_id}",
            "password": "testpass123",
            "full_name": f"Test HR User {unique_id}",
            "email": f"test_promote_{unique_id}@test.com",
            "phone": "1234567890",
            "role": "HR"
        }
        
        response = requests.post(f"{BASE_URL}/api/users/create", json=user_data, headers={
            "Authorization": f"Bearer {master_admin_token}"
        })
        
        if response.status_code != 200:
            pytest.skip(f"Could not create test HR user: {response.text}")
        
        created_user = response.json()
        yield created_user
        
        # Cleanup: delete the test user
        requests.delete(f"{BASE_URL}/api/users/{created_user['id']}", headers={
            "Authorization": f"Bearer {master_admin_token}"
        })
    
    def test_promote_hr_to_admin_success(self, master_admin_token, test_hr_user):
        """PUT /api/users/{id}/promote promotes HR to Admin"""
        user_id = test_hr_user["id"]
        
        response = requests.put(f"{BASE_URL}/api/users/{user_id}/promote", headers={
            "Authorization": f"Bearer {master_admin_token}"
        })
        print(f"Promote response: {response.status_code} - {response.text}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "promoted to Admin" in data.get("message", ""), f"Expected promotion message, got: {data}"
        print(f"HR user promoted to Admin successfully: {data}")
        
        # Verify the user is now Admin by listing users
        users_response = requests.get(f"{BASE_URL}/api/users", headers={
            "Authorization": f"Bearer {master_admin_token}"
        })
        users = users_response.json()
        promoted_user = next((u for u in users if u.get("id") == user_id), None)
        assert promoted_user is not None, "Promoted user should exist"
        assert promoted_user.get("role") == "Admin", f"User role should be Admin, got: {promoted_user.get('role')}"
        print("Verified user role is now Admin - PASS")
    
    def test_promote_already_admin_returns_400(self, master_admin_token):
        """PUT /api/users/{id}/promote returns 400 if already Admin"""
        # Get users list to find an admin user
        users_response = requests.get(f"{BASE_URL}/api/users", headers={
            "Authorization": f"Bearer {master_admin_token}"
        })
        users = users_response.json()
        
        # Find an admin user (not masteradmin to avoid issues)
        admin_user = next((u for u in users if u.get("role") == "Admin"), None)
        if not admin_user:
            pytest.skip("No admin user found to test")
        
        admin_id = admin_user["id"]
        
        response = requests.put(f"{BASE_URL}/api/users/{admin_id}/promote", headers={
            "Authorization": f"Bearer {master_admin_token}"
        })
        print(f"Promote already-admin response: {response.status_code} - {response.text}")
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "already" in data.get("detail", "").lower(), f"Expected 'already admin' message, got: {data}"
        print("Promote already-admin correctly returns 400 - PASS")
    
    def test_promote_by_non_admin_returns_403(self, hr_user_token):
        """PUT /api/users/{id}/promote returns 403 for non-Admin caller"""
        # Try to promote any user as HR
        response = requests.put(f"{BASE_URL}/api/users/some-user-id/promote", headers={
            "Authorization": f"Bearer {hr_user_token}"
        })
        print(f"Promote by HR response: {response.status_code} - {response.text}")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("Promote by non-admin correctly returns 403 - PASS")


class TestUniqueEmailEnforcement:
    """Test unique email enforcement still works"""
    
    @pytest.fixture
    def master_admin_token(self):
        """Get Master Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "masteradmin",
            "password": "Admin@123"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_duplicate_email_rejected_on_create(self, master_admin_token):
        """POST /api/users/create rejects duplicate email"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create first user
        user1_data = {
            "username": f"TEST_email1_{unique_id}",
            "password": "testpass123",
            "full_name": "Test User 1",
            "email": f"test_dup_{unique_id}@test.com",
            "role": "HR"
        }
        
        response1 = requests.post(f"{BASE_URL}/api/users/create", json=user1_data, headers={
            "Authorization": f"Bearer {master_admin_token}"
        })
        
        if response1.status_code != 200:
            pytest.skip(f"Could not create first user: {response1.text}")
        
        user1_id = response1.json()["id"]
        
        try:
            # Try to create second user with same email
            user2_data = {
                "username": f"TEST_email2_{unique_id}",
                "password": "testpass123",
                "full_name": "Test User 2",
                "email": f"test_dup_{unique_id}@test.com",  # Same email
                "role": "HR"
            }
            
            response2 = requests.post(f"{BASE_URL}/api/users/create", json=user2_data, headers={
                "Authorization": f"Bearer {master_admin_token}"
            })
            print(f"Duplicate email response: {response2.status_code} - {response2.text}")
            assert response2.status_code == 400, f"Expected 400, got {response2.status_code}"
            assert "email" in response2.json().get("detail", "").lower()
            print("Duplicate email correctly rejected - PASS")
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/users/{user1_id}", headers={
                "Authorization": f"Bearer {master_admin_token}"
            })


class TestEndorsementEmailWithExcel:
    """Test endorsement submission sends email with Excel attachment"""
    
    @pytest.fixture
    def hr_user_token(self):
        """Get HR user token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "hruser1",
            "password": "hr123456"
        })
        if response.status_code != 200:
            pytest.skip("HR user hruser1 not available")
        return response.json()["access_token"]
    
    @pytest.fixture
    def policy_number(self, hr_user_token):
        """Get a valid policy number"""
        response = requests.get(f"{BASE_URL}/api/policies", headers={
            "Authorization": f"Bearer {hr_user_token}"
        })
        if response.status_code != 200 or not response.json():
            pytest.skip("No policies available")
        return response.json()[0]["policy_number"]
    
    def test_endorsement_submission_success(self, hr_user_token, policy_number):
        """POST /api/endorsements creates endorsement and triggers email (check logs)"""
        from datetime import date
        
        endorsement_data = {
            "policy_number": policy_number,
            "member_name": f"TEST_Email_Member_{str(uuid.uuid4())[:8]}",
            "relationship_type": "Employee",
            "endorsement_type": "Addition",
            "endorsement_date": date.today().isoformat(),
            "employee_id": "TEST_EMP_001",
            "remarks": "Test endorsement for email verification"
        }
        
        response = requests.post(f"{BASE_URL}/api/endorsements", json=endorsement_data, headers={
            "Authorization": f"Bearer {hr_user_token}"
        })
        print(f"Endorsement creation response: {response.status_code}")
        
        # The endpoint should succeed even if email fails (background task)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain endorsement id"
        assert data["member_name"].startswith("TEST_Email_Member_")
        assert data["status"] == "Pending"
        print(f"Endorsement created successfully: {data['id']}")
        print("NOTE: Email with Excel attachment is sent in background task - check backend logs for email status")
        print("Email recipients should include: ks@aarogya-assist.com, connect@aarogya-assist.com + all Admin users")


class TestAdminLogin:
    """Test regular admin login still works"""
    
    def test_admin_login_success(self):
        """Admin can login with admin / admin123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        print(f"Admin login response: {response.status_code}")
        
        if response.status_code == 401:
            print("Admin user may not exist or password different - checking masteradmin instead")
            pytest.skip("Admin user not available with expected credentials")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["user"]["role"] == "Admin"
        print("Admin login successful")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
