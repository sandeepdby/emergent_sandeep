"""
Endorsement Portal Backend API Tests
Tests for: Authentication, Policies, Endorsements, Excel Import/Export
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
HR_USER = {"username": "hr@test.com", "password": "password123"}
ADMIN_USER = {"username": "admin@test.com", "password": "password123"}


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_hr_login_success(self):
        """Test HR user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_USER)
        assert response.status_code == 200, f"HR login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["role"] == "HR"
        assert data["user"]["username"] == "hr@test.com"
        print(f"✓ HR login successful - User: {data['user']['full_name']}")
    
    def test_admin_login_success(self):
        """Test Admin user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["role"] == "Admin"
        assert data["user"]["username"] == "admin@test.com"
        print(f"✓ Admin login successful - User: {data['user']['full_name']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected")
    
    def test_get_current_user(self):
        """Test getting current user info"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_USER)
        token = login_response.json()["access_token"]
        
        # Get current user
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["username"] == "hr@test.com"
        print(f"✓ Current user retrieved: {data['full_name']}")


class TestPolicies:
    """Policy CRUD tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        return response.json()["access_token"]
    
    @pytest.fixture
    def hr_token(self):
        """Get HR token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_USER)
        return response.json()["access_token"]
    
    def test_get_policies(self, hr_token):
        """Test getting all policies"""
        response = requests.get(
            f"{BASE_URL}/api/policies",
            headers={"Authorization": f"Bearer {hr_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} policies")
        return data
    
    def test_create_policy_admin_only(self, admin_token, hr_token):
        """Test that only admin can create policies"""
        policy_data = {
            "policy_number": "TEST_POL_001",
            "policy_holder_name": "Test Company Ltd",
            "inception_date": "2025-01-01",
            "expiry_date": "2025-12-31",
            "policy_type": "Group Health",
            "annual_premium_per_life": 5000,
            "total_lives_covered": 0,
            "status": "Active"
        }
        
        # HR should not be able to create
        hr_response = requests.post(
            f"{BASE_URL}/api/policies",
            json=policy_data,
            headers={"Authorization": f"Bearer {hr_token}"}
        )
        assert hr_response.status_code == 403, "HR should not be able to create policies"
        print("✓ HR correctly denied policy creation")
        
        # Admin should be able to create
        admin_response = requests.post(
            f"{BASE_URL}/api/policies",
            json=policy_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # May return 400 if policy already exists
        if admin_response.status_code == 400:
            print("✓ Policy already exists (expected)")
        else:
            assert admin_response.status_code == 200, f"Admin policy creation failed: {admin_response.text}"
            print("✓ Admin successfully created policy")


class TestEndorsements:
    """Endorsement CRUD and workflow tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        return response.json()["access_token"]
    
    @pytest.fixture
    def hr_token(self):
        """Get HR token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_USER)
        return response.json()["access_token"]
    
    @pytest.fixture
    def test_policy(self, admin_token):
        """Ensure a test policy exists"""
        # First check if policy exists
        response = requests.get(
            f"{BASE_URL}/api/policies",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        policies = response.json()
        
        # Look for existing policy
        for policy in policies:
            if policy.get("policy_number"):
                return policy
        
        # Create one if none exist
        policy_data = {
            "policy_number": "TEST_POL_ENDORSE",
            "policy_holder_name": "Test Endorsement Company",
            "inception_date": "2025-01-01",
            "expiry_date": "2025-12-31",
            "policy_type": "Group Health",
            "annual_premium_per_life": 5000,
            "total_lives_covered": 0,
            "status": "Active"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/policies",
            json=policy_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if create_response.status_code == 200:
            return create_response.json()
        
        # If creation failed, get first policy
        return policies[0] if policies else None
    
    def test_submit_endorsement_with_new_fields(self, hr_token, test_policy):
        """Test submitting endorsement with all new fields"""
        if not test_policy:
            pytest.skip("No policy available for testing")
        
        endorsement_data = {
            "policy_number": test_policy["policy_number"],
            "employee_id": "TEST_EMP_001",
            "member_name": "Test Member New Fields",
            "dob": "1990-05-15",
            "age": 34,
            "gender": "Male",
            "relationship_type": "Employee",
            "endorsement_type": "Addition",
            "date_of_joining": "2025-01-15",
            "coverage_type": "Non-Floater",
            "sum_insured": 500000,
            "endorsement_date": "2025-01-20",
            "effective_date": "2025-01-20",
            "remarks": "Test endorsement with all new fields"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/endorsements",
            json=endorsement_data,
            headers={"Authorization": f"Bearer {hr_token}"}
        )
        
        assert response.status_code == 200, f"Endorsement creation failed: {response.text}"
        
        data = response.json()
        # Verify all new fields are saved
        assert data["employee_id"] == "TEST_EMP_001", "Employee ID not saved"
        assert data["dob"] == "1990-05-15", "DOB not saved"
        assert data["age"] == 34, "Age not saved"
        assert data["gender"] == "Male", "Gender not saved"
        assert data["date_of_joining"] == "2025-01-15", "Date of joining not saved"
        assert data["coverage_type"] == "Non-Floater", "Coverage type not saved"
        assert data["sum_insured"] == 500000, "Sum insured not saved"
        assert data["status"] == "Pending", "Status should be Pending"
        
        print("✓ Endorsement created with all new fields:")
        print(f"  - Employee ID: {data['employee_id']}")
        print(f"  - DOB: {data['dob']}")
        print(f"  - Age: {data['age']}")
        print(f"  - Gender: {data['gender']}")
        print(f"  - Date of Joining: {data['date_of_joining']}")
        print(f"  - Coverage Type: {data['coverage_type']}")
        print(f"  - Sum Insured: {data['sum_insured']}")
        
        return data
    
    def test_get_endorsements_hr(self, hr_token):
        """Test HR can get their endorsements"""
        response = requests.get(
            f"{BASE_URL}/api/endorsements",
            headers={"Authorization": f"Bearer {hr_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ HR retrieved {len(data)} endorsements")
        
        # Check if new fields are present in response
        if data:
            endorsement = data[0]
            print(f"  Sample endorsement fields present:")
            print(f"  - employee_id: {'✓' if 'employee_id' in endorsement else '✗'}")
            print(f"  - dob: {'✓' if 'dob' in endorsement else '✗'}")
            print(f"  - age: {'✓' if 'age' in endorsement else '✗'}")
            print(f"  - gender: {'✓' if 'gender' in endorsement else '✗'}")
            print(f"  - coverage_type: {'✓' if 'coverage_type' in endorsement else '✗'}")
            print(f"  - sum_insured: {'✓' if 'sum_insured' in endorsement else '✗'}")
        
        return data
    
    def test_get_endorsements_admin(self, admin_token):
        """Test Admin can get all endorsements"""
        response = requests.get(
            f"{BASE_URL}/api/endorsements",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin retrieved {len(data)} endorsements (all users)")
        return data
    
    def test_get_pending_endorsements(self, admin_token):
        """Test getting pending endorsements for approval"""
        response = requests.get(
            f"{BASE_URL}/api/endorsements?status=Pending",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Retrieved {len(data)} pending endorsements")
        return data
    
    def test_approve_endorsement(self, admin_token, hr_token, test_policy):
        """Test admin approving an endorsement"""
        if not test_policy:
            pytest.skip("No policy available for testing")
        
        # First create a new endorsement
        endorsement_data = {
            "policy_number": test_policy["policy_number"],
            "employee_id": "TEST_APPROVE_EMP",
            "member_name": "Test Approval Member",
            "dob": "1985-03-10",
            "age": 39,
            "gender": "Female",
            "relationship_type": "Employee",
            "endorsement_type": "Addition",
            "date_of_joining": "2025-01-01",
            "coverage_type": "Floater",
            "sum_insured": 300000,
            "endorsement_date": "2025-01-20",
            "effective_date": "2025-01-20",
            "remarks": "Test for approval workflow"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/endorsements",
            json=endorsement_data,
            headers={"Authorization": f"Bearer {hr_token}"}
        )
        
        assert create_response.status_code == 200, f"Failed to create endorsement: {create_response.text}"
        endorsement_id = create_response.json()["id"]
        print(f"✓ Created endorsement {endorsement_id} for approval test")
        
        # Now approve it
        approval_data = {
            "status": "Approved",
            "remarks": "Approved by test"
        }
        
        approve_response = requests.post(
            f"{BASE_URL}/api/endorsements/{endorsement_id}/approve",
            json=approval_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert approve_response.status_code == 200, f"Approval failed: {approve_response.text}"
        
        approved_data = approve_response.json()
        assert approved_data["status"] == "Approved"
        assert approved_data["approved_by"] is not None
        assert approved_data["approval_date"] is not None
        
        print(f"✓ Endorsement approved successfully")
        print(f"  - Status: {approved_data['status']}")
        print(f"  - Approval Date: {approved_data['approval_date']}")
        
        return approved_data


class TestExcelImportExport:
    """Excel import/export functionality tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        return response.json()["access_token"]
    
    @pytest.fixture
    def hr_token(self):
        """Get HR token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_USER)
        return response.json()["access_token"]
    
    def test_download_template(self, hr_token):
        """Test downloading Excel import template"""
        response = requests.get(
            f"{BASE_URL}/api/endorsements/template/download",
            headers={"Authorization": f"Bearer {hr_token}"}
        )
        
        assert response.status_code == 200, f"Template download failed: {response.text}"
        
        # Check content type
        content_type = response.headers.get("content-type", "")
        assert "spreadsheet" in content_type or "excel" in content_type or "octet-stream" in content_type, \
            f"Unexpected content type: {content_type}"
        
        # Check content disposition
        content_disposition = response.headers.get("content-disposition", "")
        assert "endorsement_import_template.xlsx" in content_disposition, \
            f"Unexpected filename in disposition: {content_disposition}"
        
        # Check file size (should be reasonable)
        content_length = len(response.content)
        assert content_length > 1000, f"Template file too small: {content_length} bytes"
        
        print(f"✓ Template downloaded successfully ({content_length} bytes)")
        print(f"  - Content-Type: {content_type}")
        print(f"  - Filename: endorsement_import_template.xlsx")
        
        # Verify template has 19 columns by checking with pandas
        try:
            import pandas as pd
            df = pd.read_excel(io.BytesIO(response.content), sheet_name='Endorsement Import Template')
            columns = list(df.columns)
            print(f"  - Template columns ({len(columns)}): {columns}")
            
            # Check for new fields in template
            expected_columns = [
                'Policy Number', 'Policy Holder', 'Policy Inception Date', 'Policy Expiry Date',
                'Type of Policy', 'Annual Premium Per Life', 'Employee ID', 'Member Name',
                'DOB', 'Age', 'Gender', 'Relationship Type', 'Endorsement Type',
                'Date of Joining', 'Coverage Type', 'Suminsured', 'Endorsement Date',
                'Effective Date', 'Remarks'
            ]
            
            for col in expected_columns:
                assert col in columns, f"Missing column in template: {col}"
            
            print(f"✓ Template has all 19 expected columns")
            
        except ImportError:
            print("  - pandas not available for detailed column check")
        
        return response.content
    
    def test_download_approved_endorsements(self, admin_token):
        """Test downloading approved endorsements Excel"""
        response = requests.get(
            f"{BASE_URL}/api/endorsements/download/approved",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # May return 404 if no approved endorsements
        if response.status_code == 404:
            print("✓ No approved endorsements to download (expected if none approved)")
            return None
        
        assert response.status_code == 200, f"Download failed: {response.text}"
        
        # Check content type
        content_type = response.headers.get("content-type", "")
        assert "spreadsheet" in content_type or "excel" in content_type or "octet-stream" in content_type
        
        content_length = len(response.content)
        print(f"✓ Approved endorsements downloaded ({content_length} bytes)")
        
        # Verify export has 26 columns
        try:
            import pandas as pd
            df = pd.read_excel(io.BytesIO(response.content), sheet_name='Approved Endorsements')
            columns = list(df.columns)
            print(f"  - Export columns ({len(columns)}): {columns}")
            
            # Check for all expected columns including new fields
            expected_columns = [
                'Policy Number', 'Policy Holder', 'Policy Inception Date', 'Policy Expiry Date',
                'Type of Policy', 'Annual Premium Per Life', 'Employee ID', 'Member Name',
                'DOB', 'Age', 'Gender', 'Relationship Type', 'Endorsement Type',
                'Date of Joining', 'Coverage Type', 'Suminsured', 'Endorsement Date',
                'Effective Date', 'Remarks', 'Days from Inception', 'Days in Policy Year',
                'Remaining Days', 'Pro-rata Premium', 'Status', 'Approval Date', 'Approved By'
            ]
            
            for col in expected_columns:
                assert col in columns, f"Missing column in export: {col}"
            
            print(f"✓ Export has all 26 expected columns")
            
        except ImportError:
            print("  - pandas not available for detailed column check")
        
        return response.content


class TestEndorsementStats:
    """Endorsement statistics tests"""
    
    @pytest.fixture
    def hr_token(self):
        """Get HR token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_USER)
        return response.json()["access_token"]
    
    def test_get_stats_summary(self, hr_token):
        """Test getting endorsement statistics"""
        response = requests.get(
            f"{BASE_URL}/api/endorsements/stats/summary",
            headers={"Authorization": f"Bearer {hr_token}"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert "total_endorsements" in data
        assert "pending" in data
        assert "approved" in data
        assert "rejected" in data
        assert "total_policies" in data
        
        print(f"✓ Stats retrieved:")
        print(f"  - Total: {data['total_endorsements']}")
        print(f"  - Pending: {data['pending']}")
        print(f"  - Approved: {data['approved']}")
        print(f"  - Rejected: {data['rejected']}")
        print(f"  - Total Policies: {data['total_policies']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
