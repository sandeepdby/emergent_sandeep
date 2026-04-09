"""
Test suite for Iteration 10 features:
1. Admin User Management - POST /api/users/create (Admin creates HR/Admin users)
2. Unique email enforcement on registration and user creation
3. GET /api/users - List all users (Admin only)
4. DELETE /api/users/{id} - Delete user (Admin only)
5. My Endorsements table shows DOB, Gender, Sum Insured columns
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


class TestAdminUserCreation:
    """Test Admin-only user creation endpoint"""
    
    def test_admin_can_create_hr_user(self, admin_token):
        """Admin should be able to create HR user"""
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "username": f"TEST_hr_{unique_id}",
            "password": "testpass123",
            "full_name": f"Test HR User {unique_id}",
            "email": f"test_hr_{unique_id}@test.com",
            "phone": "+1234567890",
            "role": "HR"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/users/create",
            json=user_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["username"] == user_data["username"]
        assert data["role"] == "HR"
        assert "message" in data
        print(f"✓ Admin created HR user: {data['username']}")
    
    def test_admin_can_create_admin_user(self, admin_token):
        """Admin should be able to create Admin user"""
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "username": f"TEST_admin_{unique_id}",
            "password": "testpass123",
            "full_name": f"Test Admin User {unique_id}",
            "email": f"test_admin_{unique_id}@test.com",
            "phone": "+1234567890",
            "role": "Admin"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/users/create",
            json=user_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["username"] == user_data["username"]
        assert data["role"] == "Admin"
        print(f"✓ Admin created Admin user: {data['username']}")
    
    def test_hr_cannot_create_user(self, hr_token):
        """HR should NOT be able to create users (403 Forbidden)"""
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "username": f"TEST_blocked_{unique_id}",
            "password": "testpass123",
            "full_name": f"Blocked User {unique_id}",
            "email": f"blocked_{unique_id}@test.com",
            "role": "HR"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/users/create",
            json=user_data,
            headers={"Authorization": f"Bearer {hr_token}"}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("✓ HR correctly blocked from creating users (403)")


class TestUniqueEmailEnforcement:
    """Test unique email enforcement"""
    
    def test_admin_create_rejects_duplicate_email(self, admin_token):
        """Admin create user should reject duplicate email"""
        unique_id = str(uuid.uuid4())[:8]
        
        # First create a user
        user_data = {
            "username": f"TEST_dup1_{unique_id}",
            "password": "testpass123",
            "full_name": f"First User {unique_id}",
            "email": f"duplicate_{unique_id}@test.com",
            "role": "HR"
        }
        
        response1 = requests.post(
            f"{BASE_URL}/api/users/create",
            json=user_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response1.status_code == 200, f"First user creation failed: {response1.text}"
        
        # Try to create another user with same email
        user_data2 = {
            "username": f"TEST_dup2_{unique_id}",
            "password": "testpass123",
            "full_name": f"Second User {unique_id}",
            "email": f"duplicate_{unique_id}@test.com",  # Same email
            "role": "HR"
        }
        
        response2 = requests.post(
            f"{BASE_URL}/api/users/create",
            json=user_data2,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response2.status_code == 400, f"Expected 400 for duplicate email, got {response2.status_code}"
        assert "email" in response2.text.lower() or "already" in response2.text.lower()
        print("✓ Admin create correctly rejects duplicate email (400)")
    
    def test_register_rejects_duplicate_email(self):
        """Public registration should reject duplicate email"""
        unique_id = str(uuid.uuid4())[:8]
        
        # First register a user
        user_data = {
            "username": f"TEST_reg1_{unique_id}",
            "password": "testpass123",
            "full_name": f"First Reg User {unique_id}",
            "email": f"regdup_{unique_id}@test.com",
            "role": "HR"
        }
        
        response1 = requests.post(f"{BASE_URL}/api/auth/register", json=user_data)
        assert response1.status_code == 200, f"First registration failed: {response1.text}"
        
        # Try to register another user with same email
        user_data2 = {
            "username": f"TEST_reg2_{unique_id}",
            "password": "testpass123",
            "full_name": f"Second Reg User {unique_id}",
            "email": f"regdup_{unique_id}@test.com",  # Same email
            "role": "HR"
        }
        
        response2 = requests.post(f"{BASE_URL}/api/auth/register", json=user_data2)
        
        assert response2.status_code == 400, f"Expected 400 for duplicate email, got {response2.status_code}"
        assert "email" in response2.text.lower() or "already" in response2.text.lower()
        print("✓ Registration correctly rejects duplicate email (400)")


class TestUserListAndDelete:
    """Test GET /api/users and DELETE /api/users/{id}"""
    
    def test_admin_can_list_users(self, admin_token):
        """Admin should be able to list all users"""
        response = requests.get(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Expected at least one user"
        
        # Check user structure
        user = data[0]
        assert "id" in user
        assert "username" in user
        assert "email" in user
        assert "role" in user
        print(f"✓ Admin listed {len(data)} users")
    
    def test_hr_cannot_list_users(self, hr_token):
        """HR should NOT be able to list users (403 Forbidden)"""
        response = requests.get(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {hr_token}"}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ HR correctly blocked from listing users (403)")
    
    def test_admin_can_delete_user(self, admin_token):
        """Admin should be able to delete a user"""
        # First create a user to delete
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "username": f"TEST_delete_{unique_id}",
            "password": "testpass123",
            "full_name": f"Delete Me {unique_id}",
            "email": f"delete_{unique_id}@test.com",
            "role": "HR"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/users/create",
            json=user_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Now delete the user
        delete_response = requests.delete(
            f"{BASE_URL}/api/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        print(f"✓ Admin deleted user {user_id}")
    
    def test_hr_cannot_delete_user(self, hr_token, admin_token):
        """HR should NOT be able to delete users (403 Forbidden)"""
        # First create a user to try to delete
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "username": f"TEST_nodelete_{unique_id}",
            "password": "testpass123",
            "full_name": f"No Delete {unique_id}",
            "email": f"nodelete_{unique_id}@test.com",
            "role": "HR"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/users/create",
            json=user_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # HR tries to delete
        delete_response = requests.delete(
            f"{BASE_URL}/api/users/{user_id}",
            headers={"Authorization": f"Bearer {hr_token}"}
        )
        
        assert delete_response.status_code == 403, f"Expected 403, got {delete_response.status_code}"
        print("✓ HR correctly blocked from deleting users (403)")


class TestCreatedUserCanLogin:
    """Test that users created by admin can actually login"""
    
    def test_admin_created_user_can_login(self, admin_token):
        """User created by admin should be able to login"""
        unique_id = str(uuid.uuid4())[:8]
        password = "logintest123"
        user_data = {
            "username": f"TEST_login_{unique_id}",
            "password": password,
            "full_name": f"Login Test {unique_id}",
            "email": f"login_{unique_id}@test.com",
            "role": "HR"
        }
        
        # Create user
        create_response = requests.post(
            f"{BASE_URL}/api/users/create",
            json=user_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert create_response.status_code == 200, f"User creation failed: {create_response.text}"
        
        # Try to login with created user
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": user_data["username"], "password": password}
        )
        
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        data = login_response.json()
        assert "access_token" in data
        assert data["user"]["username"] == user_data["username"]
        print(f"✓ Admin-created user can login successfully")


class TestEndorsementFieldsForMyEndorsements:
    """Test that endorsement responses include DOB, Gender, Sum Insured fields"""
    
    def test_endorsement_has_dob_gender_sum_insured(self, hr_token):
        """Endorsement response should include DOB, Gender, Sum Insured fields"""
        response = requests.get(
            f"{BASE_URL}/api/endorsements",
            headers={"Authorization": f"Bearer {hr_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        if len(data) > 0:
            endorsement = data[0]
            # Check that these fields exist in the response (can be null)
            assert "dob" in endorsement, "DOB field missing from endorsement"
            assert "gender" in endorsement, "Gender field missing from endorsement"
            assert "sum_insured" in endorsement, "Sum Insured field missing from endorsement"
            print(f"✓ Endorsement has DOB: {endorsement.get('dob')}, Gender: {endorsement.get('gender')}, Sum Insured: {endorsement.get('sum_insured')}")
        else:
            print("⚠ No endorsements found to verify fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
