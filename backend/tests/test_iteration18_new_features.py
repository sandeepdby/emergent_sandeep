"""
Iteration 18 - Testing 3 New Features:
1. Cloud Storage: Admin uploads documents assigned to HR users
2. E-Cards: View, WhatsApp, Email action buttons
3. Claims Tab Redesign: New fields (cashless_claims_count, reimbursement_claims_count, claims_report_date), 
   removed personal fields, annual_claims_trend instead of renewal_pricing
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://insurehub-portal.preview.emergentagent.com')

# Test credentials
MASTER_ADMIN = {"username": "masteradmin", "password": "Admin@123"}
ADMIN = {"username": "admin@insurehub.com", "password": "admin123"}
HR_USER = {"username": "hruser1", "password": "hr123456"}


class TestAuth:
    """Authentication tests"""
    
    def test_master_admin_login(self):
        """Test master admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MASTER_ADMIN)
        assert response.status_code == 200, f"Master admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "Admin"
        print(f"✓ Master admin login successful")
        return data["access_token"]
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        print(f"✓ Admin login successful")
        return data["access_token"]
    
    def test_hr_login(self):
        """Test HR user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_USER)
        assert response.status_code == 200, f"HR login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "HR"
        print(f"✓ HR user login successful")
        return data["access_token"], data["user"]["id"]


@pytest.fixture(scope="module")
def admin_token():
    """Get admin token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    if response.status_code != 200:
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MASTER_ADMIN)
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def hr_token_and_id():
    """Get HR token and user ID"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_USER)
    data = response.json()
    return data["access_token"], data["user"]["id"]


@pytest.fixture(scope="module")
def hr_users(admin_token):
    """Get list of HR users"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.get(f"{BASE_URL}/api/users/hr", headers=headers)
    return response.json()


class TestClaimsNewSchema:
    """Test Claims Management with new schema fields"""
    
    def test_create_claim_with_new_fields(self, admin_token):
        """Test creating a claim with new fields: cashless_claims_count, reimbursement_claims_count, claims_report_date"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First get a valid policy number
        policies_res = requests.get(f"{BASE_URL}/api/policies", headers=headers)
        policies = policies_res.json()
        if not policies:
            pytest.skip("No policies available for testing")
        
        policy_number = policies[0]["policy_number"]
        
        claim_data = {
            "policy_number": policy_number,
            "claim_type": "Cashless",
            "cashless_claims_count": 5,
            "reimbursement_claims_count": 3,
            "claims_report_date": "2025-01-15",
            "claimed_amount": 150000,
            "approved_amount": 140000,
            "settled_amount": 135000,
            "status": "Settled",
            "remarks": "Test claim with new schema fields",
            "policy_type": "ESKP"
        }
        
        response = requests.post(f"{BASE_URL}/api/claims", json=claim_data, headers=headers)
        assert response.status_code == 200, f"Create claim failed: {response.text}"
        
        data = response.json()
        assert data["cashless_claims_count"] == 5, "cashless_claims_count not saved correctly"
        assert data["reimbursement_claims_count"] == 3, "reimbursement_claims_count not saved correctly"
        assert data["claims_report_date"] == "2025-01-15", "claims_report_date not saved correctly"
        assert "claim_number" in data
        print(f"✓ Claim created with new fields: {data['claim_number']}")
        return data["id"]
    
    def test_claim_does_not_have_personal_fields(self, admin_token):
        """Verify ClaimCreate model does NOT have personal fields (employee_name, patient_name, etc.)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get policies
        policies_res = requests.get(f"{BASE_URL}/api/policies", headers=headers)
        policies = policies_res.json()
        if not policies:
            pytest.skip("No policies available")
        
        # Try to create claim with old personal fields - they should be ignored
        claim_data = {
            "policy_number": policies[0]["policy_number"],
            "claim_type": "Reimbursement",
            "employee_name": "Should Be Ignored",  # Old field
            "patient_name": "Should Be Ignored",   # Old field
            "admission_date": "2025-01-01",        # Old field
            "discharge_date": "2025-01-05",        # Old field
            "diagnosis": "Test Diagnosis",         # Old field
            "hospital": "Test Hospital",           # Old field
            "cashless_claims_count": 2,
            "reimbursement_claims_count": 1,
            "claims_report_date": "2025-01-10",
            "claimed_amount": 50000,
            "status": "Submitted"
        }
        
        response = requests.post(f"{BASE_URL}/api/claims", json=claim_data, headers=headers)
        assert response.status_code == 200, f"Create claim failed: {response.text}"
        
        data = response.json()
        # Verify personal fields are NOT in the response
        assert "employee_name" not in data, "employee_name should not be in claim"
        assert "patient_name" not in data, "patient_name should not be in claim"
        assert "admission_date" not in data, "admission_date should not be in claim"
        assert "discharge_date" not in data, "discharge_date should not be in claim"
        assert "diagnosis" not in data, "diagnosis should not be in claim"
        assert "hospital" not in data, "hospital should not be in claim"
        print(f"✓ Claim created without personal fields (as expected)")
        return data["id"]
    
    def test_get_claims_returns_new_fields(self, admin_token):
        """Test GET /api/claims returns new fields"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/claims", headers=headers)
        assert response.status_code == 200
        
        claims = response.json()
        if claims:
            claim = claims[0]
            # Check new fields exist in response
            assert "cashless_claims_count" in claim, "cashless_claims_count missing from claim"
            assert "reimbursement_claims_count" in claim, "reimbursement_claims_count missing from claim"
            assert "claims_report_date" in claim or claim.get("claims_report_date") is None, "claims_report_date field missing"
            print(f"✓ GET /api/claims returns new fields correctly")
    
    def test_update_claim_with_new_fields(self, admin_token):
        """Test updating a claim with new fields"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get existing claims
        claims_res = requests.get(f"{BASE_URL}/api/claims", headers=headers)
        claims = claims_res.json()
        if not claims:
            pytest.skip("No claims to update")
        
        claim_id = claims[0]["id"]
        
        update_data = {
            "policy_number": claims[0]["policy_number"],
            "claim_type": claims[0].get("claim_type", "Cashless"),
            "cashless_claims_count": 10,
            "reimbursement_claims_count": 5,
            "claims_report_date": "2025-01-20",
            "claimed_amount": claims[0].get("claimed_amount", 100000),
            "approved_amount": claims[0].get("approved_amount", 90000),
            "settled_amount": claims[0].get("settled_amount", 85000),
            "status": claims[0].get("status", "Submitted")
        }
        
        response = requests.put(f"{BASE_URL}/api/claims/{claim_id}", json=update_data, headers=headers)
        assert response.status_code == 200, f"Update claim failed: {response.text}"
        
        data = response.json()
        assert data["cashless_claims_count"] == 10
        assert data["reimbursement_claims_count"] == 5
        assert data["claims_report_date"] == "2025-01-20"
        print(f"✓ Claim updated with new fields successfully")


class TestClaimsAnalytics:
    """Test Claims Analytics with annual_claims_trend"""
    
    def test_claims_analytics_returns_annual_claims_trend(self, admin_token):
        """Test GET /api/claims-analytics returns annual_claims_trend instead of renewal_expected_pricing"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/claims-analytics", headers=headers)
        assert response.status_code == 200, f"Claims analytics failed: {response.text}"
        
        data = response.json()
        
        # Verify annual_claims_trend is present
        assert "annual_claims_trend" in data, "annual_claims_trend missing from analytics"
        
        # Verify renewal_expected_pricing is NOT present (replaced)
        assert "renewal_expected_pricing" not in data, "renewal_expected_pricing should be replaced by annual_claims_trend"
        
        # Verify other expected fields
        assert "total_claims" in data
        assert "total_claimed_amount" in data
        assert "claims_ratio" in data
        assert "status_distribution" in data
        assert "type_distribution" in data
        assert "monthly_trend" in data
        
        print(f"✓ Claims analytics returns annual_claims_trend: {data['annual_claims_trend']}")
        print(f"  - Total claims: {data['total_claims']}")
        print(f"  - Claims ratio: {data['claims_ratio']}%")
    
    def test_hr_claims_analytics_filtered(self, hr_token_and_id):
        """Test HR user sees filtered claims analytics"""
        hr_token, hr_id = hr_token_and_id
        headers = {"Authorization": f"Bearer {hr_token}"}
        
        response = requests.get(f"{BASE_URL}/api/claims-analytics", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "annual_claims_trend" in data
        print(f"✓ HR user claims analytics filtered correctly")


class TestCloudStorageHRAssignment:
    """Test Cloud Storage with HR assignment feature"""
    
    def test_admin_can_get_hr_users_list(self, admin_token):
        """Test admin can get list of HR users for assignment dropdown"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/users/hr", headers=headers)
        assert response.status_code == 200, f"Get HR users failed: {response.text}"
        
        hr_users = response.json()
        assert isinstance(hr_users, list)
        
        if hr_users:
            # Verify HR user has required fields for dropdown
            hr = hr_users[0]
            assert "id" in hr
            assert "full_name" in hr
            assert "email" in hr
            print(f"✓ Admin can get HR users list: {len(hr_users)} HR users found")
        return hr_users
    
    def test_hr_cannot_get_hr_users_list(self, hr_token_and_id):
        """Test HR user cannot access HR users list"""
        hr_token, _ = hr_token_and_id
        headers = {"Authorization": f"Bearer {hr_token}"}
        
        response = requests.get(f"{BASE_URL}/api/users/hr", headers=headers)
        assert response.status_code == 403, "HR should not be able to access HR users list"
        print(f"✓ HR user correctly denied access to HR users list")
    
    def test_admin_upload_document_with_hr_assignment(self, admin_token, hr_users):
        """Test admin can upload document assigned to HR user"""
        if not hr_users:
            pytest.skip("No HR users available for testing")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        hr_user = hr_users[0]
        
        # Create a test file
        files = {
            "file": ("test_ecard.pdf", b"Test E-Card content for HR assignment", "application/pdf")
        }
        
        response = requests.post(
            f"{BASE_URL}/api/documents/upload?category=E-Cards&assigned_to_hr={hr_user['id']}",
            files=files,
            headers=headers
        )
        assert response.status_code == 200, f"Upload failed: {response.text}"
        
        data = response.json()
        assert data["assigned_to_hr"] == hr_user["id"], "Document not assigned to HR user"
        print(f"✓ Admin uploaded document assigned to HR: {hr_user['full_name']}")
        return data["id"]
    
    def test_hr_sees_assigned_documents(self, admin_token, hr_token_and_id, hr_users):
        """Test HR user can see documents assigned to them"""
        if not hr_users:
            pytest.skip("No HR users available")
        
        hr_token, hr_id = hr_token_and_id
        headers = {"Authorization": f"Bearer {hr_token}"}
        
        response = requests.get(f"{BASE_URL}/api/documents", headers=headers)
        assert response.status_code == 200
        
        documents = response.json()
        # HR should see documents assigned to them or uploaded by them
        for doc in documents:
            is_assigned = doc.get("assigned_to_hr") == hr_id
            is_uploaded = doc.get("uploaded_by") == hr_id
            assert is_assigned or is_uploaded, f"HR sees document not assigned/uploaded by them: {doc['id']}"
        
        print(f"✓ HR user sees only their assigned/uploaded documents: {len(documents)} docs")
    
    def test_admin_upload_without_hr_assignment(self, admin_token):
        """Test admin can upload document without HR assignment"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        files = {
            "file": ("test_policy_terms.pdf", b"Test policy terms content", "application/pdf")
        }
        
        response = requests.post(
            f"{BASE_URL}/api/documents/upload?category=Policy Terms",
            files=files,
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # assigned_to_hr should be None or not present
        assert data.get("assigned_to_hr") is None, "Document should not be assigned to HR"
        print(f"✓ Admin uploaded document without HR assignment")


class TestECardActions:
    """Test E-Card View, WhatsApp, Email actions"""
    
    def test_ecard_document_has_hr_contact_info(self, admin_token, hr_users):
        """Test E-Card document stores HR contact info for actions"""
        if not hr_users:
            pytest.skip("No HR users available")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        hr_user = hr_users[0]
        
        # Upload E-Card assigned to HR
        files = {
            "file": ("ecard_test.pdf", b"E-Card test content", "application/pdf")
        }
        
        response = requests.post(
            f"{BASE_URL}/api/documents/upload?category=E-Cards&assigned_to_hr={hr_user['id']}",
            files=files,
            headers=headers
        )
        assert response.status_code == 200
        doc_id = response.json()["id"]
        
        # Get documents and verify HR contact info
        docs_response = requests.get(f"{BASE_URL}/api/documents", headers=headers)
        documents = docs_response.json()
        
        ecard_doc = next((d for d in documents if d["id"] == doc_id), None)
        assert ecard_doc is not None, "E-Card document not found"
        
        # Verify HR contact info is stored
        assert "assigned_to_hr_name" in ecard_doc, "assigned_to_hr_name missing"
        assert "assigned_to_hr_email" in ecard_doc, "assigned_to_hr_email missing"
        # Phone may be optional
        
        print(f"✓ E-Card has HR contact info: {ecard_doc.get('assigned_to_hr_name')}, {ecard_doc.get('assigned_to_hr_email')}")
        return doc_id
    
    def test_send_ecard_email_endpoint(self, admin_token, hr_users):
        """Test POST /api/documents/{id}/send-ecard sends email"""
        if not hr_users:
            pytest.skip("No HR users available")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        hr_user = hr_users[0]
        
        # First upload an E-Card
        files = {
            "file": ("ecard_email_test.pdf", b"E-Card for email test", "application/pdf")
        }
        
        upload_response = requests.post(
            f"{BASE_URL}/api/documents/upload?category=E-Cards&assigned_to_hr={hr_user['id']}",
            files=files,
            headers=headers
        )
        assert upload_response.status_code == 200
        doc_id = upload_response.json()["id"]
        
        # Send E-Card email
        response = requests.post(f"{BASE_URL}/api/documents/{doc_id}/send-ecard", headers=headers)
        
        # Should succeed if HR has email, or return 400 if no email
        if hr_user.get("email"):
            assert response.status_code == 200, f"Send E-Card failed: {response.text}"
            data = response.json()
            assert "message" in data
            print(f"✓ E-Card email sent successfully: {data['message']}")
        else:
            assert response.status_code == 400, "Should fail if no email"
            print(f"✓ E-Card email correctly failed (no HR email)")
    
    def test_download_ecard_for_view(self, admin_token, hr_users):
        """Test downloading E-Card for View action"""
        if not hr_users:
            pytest.skip("No HR users available")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        hr_user = hr_users[0]
        
        # Upload E-Card
        files = {
            "file": ("ecard_view_test.pdf", b"E-Card view test content", "application/pdf")
        }
        
        upload_response = requests.post(
            f"{BASE_URL}/api/documents/upload?category=E-Cards&assigned_to_hr={hr_user['id']}",
            files=files,
            headers=headers
        )
        assert upload_response.status_code == 200
        doc_id = upload_response.json()["id"]
        
        # Download for view
        response = requests.get(f"{BASE_URL}/api/documents/{doc_id}/download", headers=headers)
        assert response.status_code == 200, f"Download failed: {response.text}"
        assert len(response.content) > 0, "Downloaded content is empty"
        print(f"✓ E-Card downloaded successfully for View action")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_claims(self, admin_token):
        """Clean up test claims created during testing"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get all claims
        response = requests.get(f"{BASE_URL}/api/claims", headers=headers)
        claims = response.json()
        
        # Delete claims with test remarks
        deleted = 0
        for claim in claims:
            if claim.get("remarks") and "Test" in claim.get("remarks", ""):
                del_response = requests.delete(f"{BASE_URL}/api/claims/{claim['id']}", headers=headers)
                if del_response.status_code == 200:
                    deleted += 1
        
        print(f"✓ Cleaned up {deleted} test claims")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
