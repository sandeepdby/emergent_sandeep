"""
Test suite for InsureHub 7 new features:
1. Admin views & downloads HR-imported Excel endorsement batches
2. HR previews uploaded Excel data before final submission
3. Auto age from DOB (frontend only - tested via Playwright)
4. Dynamic fields: Addition→DOJ, Deletion→DOL, Midterm addition→hide Employee (frontend only)
5. 45-day backdating lock on DOJ/DOL
6. CD Ledger tab for cash deposit tracking with manual entries
7. Per-life prorata premium: negative=refund (deletion), positive=charge (addition)
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://endorsement-ai.preview.emergentagent.com')

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


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def hr_headers(hr_token):
    return {"Authorization": f"Bearer {hr_token}", "Content-Type": "application/json"}


class TestAuthentication:
    """Test authentication for both Admin and HR users"""
    
    def test_admin_login(self):
        """Admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "Admin"
        print(f"✓ Admin login successful - role: {data['user']['role']}")
    
    def test_hr_login(self):
        """HR can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "HR"
        print(f"✓ HR login successful - role: {data['user']['role']}")


class TestCDLedger:
    """Feature 6: CD Ledger tab for cash deposit tracking"""
    
    def test_get_cd_ledger_admin(self, admin_headers):
        """Admin can view CD Ledger entries"""
        response = requests.get(f"{BASE_URL}/api/cd-ledger", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "entries" in data
        assert "total_balance" in data
        print(f"✓ CD Ledger GET - {len(data['entries'])} entries, balance: ₹{data['total_balance']}")
    
    def test_get_cd_ledger_hr(self, hr_headers):
        """HR can view CD Ledger entries"""
        response = requests.get(f"{BASE_URL}/api/cd-ledger", headers=hr_headers)
        assert response.status_code == 200
        data = response.json()
        assert "entries" in data
        print(f"✓ HR can view CD Ledger - {len(data['entries'])} entries")
    
    def test_add_cd_ledger_entry_admin(self, admin_headers):
        """Admin can add manual CD Ledger entry"""
        entry_data = {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "reference": f"TEST-NEFT-{datetime.now().strftime('%H%M%S')}",
            "description": "Test deposit for pytest",
            "amount": 10000.00,
            "policy_number": None
        }
        response = requests.post(f"{BASE_URL}/api/cd-ledger", json=entry_data, headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        # API returns id, message, amount
        assert "id" in data
        assert data["amount"] == entry_data["amount"]
        assert "message" in data
        print(f"✓ Admin added CD entry: {data['id'][:8]}... - ₹{data['amount']}")
        return data["id"]
    
    def test_add_cd_ledger_entry_hr_forbidden(self, hr_headers):
        """HR cannot add CD Ledger entries (Admin only)"""
        entry_data = {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "reference": "HR-TEST-001",
            "description": "HR should not be able to add",
            "amount": 5000.00
        }
        response = requests.post(f"{BASE_URL}/api/cd-ledger", json=entry_data, headers=hr_headers)
        assert response.status_code == 403
        print("✓ HR correctly forbidden from adding CD entries")
    
    def test_delete_cd_ledger_entry_admin(self, admin_headers):
        """Admin can delete manual CD Ledger entry"""
        # First create an entry to delete
        entry_data = {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "reference": f"DELETE-TEST-{datetime.now().strftime('%H%M%S')}",
            "description": "Entry to be deleted",
            "amount": 1000.00
        }
        create_response = requests.post(f"{BASE_URL}/api/cd-ledger", json=entry_data, headers=admin_headers)
        assert create_response.status_code == 200
        entry_id = create_response.json()["id"]
        
        # Now delete it
        delete_response = requests.delete(f"{BASE_URL}/api/cd-ledger/{entry_id}", headers=admin_headers)
        assert delete_response.status_code == 200
        print(f"✓ Admin deleted CD entry: {entry_id}")
    
    def test_delete_cd_ledger_entry_hr_forbidden(self, admin_headers, hr_headers):
        """HR cannot delete CD Ledger entries"""
        # Create entry as admin
        entry_data = {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "reference": f"HR-DELETE-TEST-{datetime.now().strftime('%H%M%S')}",
            "description": "HR should not delete this",
            "amount": 500.00
        }
        create_response = requests.post(f"{BASE_URL}/api/cd-ledger", json=entry_data, headers=admin_headers)
        assert create_response.status_code == 200
        entry_id = create_response.json()["id"]
        
        # HR tries to delete
        delete_response = requests.delete(f"{BASE_URL}/api/cd-ledger/{entry_id}", headers=hr_headers)
        assert delete_response.status_code == 403
        print("✓ HR correctly forbidden from deleting CD entries")
        
        # Cleanup - admin deletes
        requests.delete(f"{BASE_URL}/api/cd-ledger/{entry_id}", headers=admin_headers)
    
    def test_cd_ledger_running_balance(self, admin_headers):
        """CD Ledger entries have running balance calculated"""
        response = requests.get(f"{BASE_URL}/api/cd-ledger", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        
        if len(data["entries"]) > 0:
            # Check that entries have running_balance field
            for entry in data["entries"]:
                assert "running_balance" in entry
            print(f"✓ Running balance present in {len(data['entries'])} entries")
        else:
            print("✓ No entries to verify running balance (empty ledger)")


class TestImportBatches:
    """Feature 1: Admin views & downloads HR-imported Excel endorsement batches"""
    
    def test_get_import_batches_admin(self, admin_headers):
        """Admin can view import batches"""
        response = requests.get(f"{BASE_URL}/api/endorsements/import-batches", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Import batches GET - {len(data)} batches found")
        
        if len(data) > 0:
            batch = data[0]
            assert "batch_id" in batch
            assert "count" in batch
            assert "submitted_by_name" in batch
            assert "total_premium" in batch
            print(f"  First batch: {batch['batch_id'][:8]}... - {batch['count']} records")
    
    def test_get_import_batches_hr(self, hr_headers):
        """HR can also view import batches"""
        response = requests.get(f"{BASE_URL}/api/endorsements/import-batches", headers=hr_headers)
        assert response.status_code == 200
        print("✓ HR can view import batches")
    
    def test_get_batch_detail(self, admin_headers):
        """Admin can view batch detail"""
        # First get list of batches
        batches_response = requests.get(f"{BASE_URL}/api/endorsements/import-batches", headers=admin_headers)
        batches = batches_response.json()
        
        if len(batches) > 0:
            batch_id = batches[0]["batch_id"]
            detail_response = requests.get(f"{BASE_URL}/api/endorsements/batch/{batch_id}", headers=admin_headers)
            assert detail_response.status_code == 200
            endorsements = detail_response.json()
            assert isinstance(endorsements, list)
            print(f"✓ Batch detail - {len(endorsements)} endorsements in batch {batch_id[:8]}...")
        else:
            print("✓ No batches to test detail (empty)")
    
    def test_download_batch_excel(self, admin_headers):
        """Admin can download batch as Excel"""
        batches_response = requests.get(f"{BASE_URL}/api/endorsements/import-batches", headers=admin_headers)
        batches = batches_response.json()
        
        if len(batches) > 0:
            batch_id = batches[0]["batch_id"]
            download_response = requests.get(
                f"{BASE_URL}/api/endorsements/batch/{batch_id}/download",
                headers=admin_headers
            )
            assert download_response.status_code == 200
            assert "spreadsheet" in download_response.headers.get("Content-Type", "")
            print(f"✓ Batch Excel download successful - {len(download_response.content)} bytes")
        else:
            print("✓ No batches to test download (empty)")
    
    def test_download_nonexistent_batch(self, admin_headers):
        """Download non-existent batch returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/endorsements/batch/nonexistent-batch-id/download",
            headers=admin_headers
        )
        assert response.status_code == 404
        print("✓ Non-existent batch download returns 404")


class TestExcelPreview:
    """Feature 2: HR previews uploaded Excel data before final submission"""
    
    def test_preview_endpoint_exists(self, hr_headers):
        """Preview endpoint exists and requires file"""
        response = requests.post(f"{BASE_URL}/api/endorsements/preview", headers=hr_headers)
        # Should fail with 422 (missing file) not 404
        assert response.status_code == 422
        print("✓ Preview endpoint exists (422 = missing file)")
    
    def test_preview_invalid_file_type(self, hr_headers):
        """Preview rejects non-Excel files"""
        files = {"file": ("test.txt", b"not an excel file", "text/plain")}
        response = requests.post(
            f"{BASE_URL}/api/endorsements/preview",
            headers={"Authorization": hr_headers["Authorization"]},
            files=files
        )
        assert response.status_code == 400
        assert "Excel" in response.json().get("detail", "")
        print("✓ Preview rejects non-Excel files")


class TestBackdatingValidation:
    """Feature 5: 45-day backdating lock on DOJ/DOL"""
    
    def test_endorsement_with_valid_doj(self, hr_headers):
        """Endorsement with DOJ within 45 days is accepted"""
        # First get a policy
        policies_response = requests.get(f"{BASE_URL}/api/policies", headers=hr_headers)
        policies = policies_response.json()
        
        if len(policies) == 0:
            pytest.skip("No policies available for testing")
        
        policy = policies[0]
        valid_doj = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        
        endorsement_data = {
            "policy_number": policy["policy_number"],
            "member_name": "TEST Valid DOJ Member",
            "relationship_type": "Employee",
            "endorsement_type": "Addition",
            "endorsement_date": datetime.now().strftime("%Y-%m-%d"),
            "date_of_joining": valid_doj
        }
        
        response = requests.post(f"{BASE_URL}/api/endorsements", json=endorsement_data, headers=hr_headers)
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Endorsement with valid DOJ (30 days ago) accepted - ID: {data['id'][:8]}...")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/endorsements/{data['id']}", headers=hr_headers)
    
    def test_endorsement_with_backdated_doj_rejected(self, hr_headers):
        """Endorsement with DOJ > 45 days backdated is rejected"""
        policies_response = requests.get(f"{BASE_URL}/api/policies", headers=hr_headers)
        policies = policies_response.json()
        
        if len(policies) == 0:
            pytest.skip("No policies available for testing")
        
        policy = policies[0]
        invalid_doj = (datetime.now() - timedelta(days=60)).strftime("%Y-%m-%d")
        
        endorsement_data = {
            "policy_number": policy["policy_number"],
            "member_name": "TEST Invalid DOJ Member",
            "relationship_type": "Employee",
            "endorsement_type": "Addition",
            "endorsement_date": datetime.now().strftime("%Y-%m-%d"),
            "date_of_joining": invalid_doj
        }
        
        response = requests.post(f"{BASE_URL}/api/endorsements", json=endorsement_data, headers=hr_headers)
        assert response.status_code == 400
        assert "45 days" in response.json().get("detail", "")
        print("✓ Endorsement with DOJ > 45 days backdated correctly rejected")
    
    def test_endorsement_with_backdated_dol_rejected(self, hr_headers):
        """Endorsement with DOL > 45 days backdated is rejected"""
        policies_response = requests.get(f"{BASE_URL}/api/policies", headers=hr_headers)
        policies = policies_response.json()
        
        if len(policies) == 0:
            pytest.skip("No policies available for testing")
        
        policy = policies[0]
        invalid_dol = (datetime.now() - timedelta(days=60)).strftime("%Y-%m-%d")
        
        endorsement_data = {
            "policy_number": policy["policy_number"],
            "member_name": "TEST Invalid DOL Member",
            "relationship_type": "Employee",
            "endorsement_type": "Deletion",
            "endorsement_date": datetime.now().strftime("%Y-%m-%d"),
            "date_of_leaving": invalid_dol
        }
        
        response = requests.post(f"{BASE_URL}/api/endorsements", json=endorsement_data, headers=hr_headers)
        assert response.status_code == 400
        assert "45 days" in response.json().get("detail", "")
        print("✓ Endorsement with DOL > 45 days backdated correctly rejected")


class TestProrataPremium:
    """Feature 7: Per-life prorata premium calculation"""
    
    def test_addition_has_positive_premium(self, hr_headers):
        """Addition endorsement has positive prorata premium (charge)"""
        policies_response = requests.get(f"{BASE_URL}/api/policies", headers=hr_headers)
        policies = policies_response.json()
        
        if len(policies) == 0:
            pytest.skip("No policies available for testing")
        
        policy = policies[0]
        
        endorsement_data = {
            "policy_number": policy["policy_number"],
            "member_name": "TEST Addition Premium",
            "relationship_type": "Employee",
            "endorsement_type": "Addition",
            "endorsement_date": datetime.now().strftime("%Y-%m-%d")
        }
        
        response = requests.post(f"{BASE_URL}/api/endorsements", json=endorsement_data, headers=hr_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Addition should have positive premium (charge)
        assert data["prorata_premium"] >= 0
        assert data["annual_premium_per_life"] == policy["annual_premium_per_life"]
        print(f"✓ Addition has positive premium: ₹{data['prorata_premium']} (annual: ₹{data['annual_premium_per_life']})")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/endorsements/{data['id']}", headers=hr_headers)
    
    def test_deletion_has_negative_premium(self, hr_headers):
        """Deletion endorsement has negative prorata premium (refund)"""
        policies_response = requests.get(f"{BASE_URL}/api/policies", headers=hr_headers)
        policies = policies_response.json()
        
        if len(policies) == 0:
            pytest.skip("No policies available for testing")
        
        policy = policies[0]
        
        endorsement_data = {
            "policy_number": policy["policy_number"],
            "member_name": "TEST Deletion Premium",
            "relationship_type": "Employee",
            "endorsement_type": "Deletion",
            "endorsement_date": datetime.now().strftime("%Y-%m-%d")
        }
        
        response = requests.post(f"{BASE_URL}/api/endorsements", json=endorsement_data, headers=hr_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Deletion should have negative premium (refund)
        assert data["prorata_premium"] <= 0
        print(f"✓ Deletion has negative premium (refund): ₹{data['prorata_premium']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/endorsements/{data['id']}", headers=hr_headers)
    
    def test_correction_has_zero_premium(self, hr_headers):
        """Correction endorsement has zero prorata premium"""
        policies_response = requests.get(f"{BASE_URL}/api/policies", headers=hr_headers)
        policies = policies_response.json()
        
        if len(policies) == 0:
            pytest.skip("No policies available for testing")
        
        policy = policies[0]
        
        endorsement_data = {
            "policy_number": policy["policy_number"],
            "member_name": "TEST Correction Premium",
            "relationship_type": "Employee",
            "endorsement_type": "Correction",
            "endorsement_date": datetime.now().strftime("%Y-%m-%d")
        }
        
        response = requests.post(f"{BASE_URL}/api/endorsements", json=endorsement_data, headers=hr_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Correction should have zero premium
        assert data["prorata_premium"] == 0
        print(f"✓ Correction has zero premium: ₹{data['prorata_premium']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/endorsements/{data['id']}", headers=hr_headers)
    
    def test_midterm_addition_has_positive_premium(self, hr_headers):
        """Midterm addition endorsement has positive prorata premium"""
        policies_response = requests.get(f"{BASE_URL}/api/policies", headers=hr_headers)
        policies = policies_response.json()
        
        if len(policies) == 0:
            pytest.skip("No policies available for testing")
        
        policy = policies[0]
        
        endorsement_data = {
            "policy_number": policy["policy_number"],
            "member_name": "TEST Midterm Addition Premium",
            "relationship_type": "Spouse",  # Midterm addition should not allow Employee
            "endorsement_type": "Midterm addition",
            "endorsement_date": datetime.now().strftime("%Y-%m-%d")
        }
        
        response = requests.post(f"{BASE_URL}/api/endorsements", json=endorsement_data, headers=hr_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Midterm addition should have positive premium (charge)
        assert data["prorata_premium"] >= 0
        print(f"✓ Midterm addition has positive premium: ₹{data['prorata_premium']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/endorsements/{data['id']}", headers=hr_headers)


class TestEndorsementFields:
    """Test endorsement response includes annual_premium_per_life field"""
    
    def test_endorsement_has_annual_premium_field(self, hr_headers):
        """Endorsement response includes annual_premium_per_life"""
        response = requests.get(f"{BASE_URL}/api/endorsements", headers=hr_headers)
        assert response.status_code == 200
        endorsements = response.json()
        
        if len(endorsements) > 0:
            endorsement = endorsements[0]
            assert "annual_premium_per_life" in endorsement
            assert "prorata_premium" in endorsement
            print(f"✓ Endorsement has annual_premium_per_life: ₹{endorsement.get('annual_premium_per_life')}")
        else:
            print("✓ No endorsements to verify fields (empty)")


class TestCDLedgerAutoDeduction:
    """Test CD balance auto-deducted when endorsement approved"""
    
    def test_approval_creates_cd_entry(self, admin_headers, hr_headers):
        """Approving endorsement creates CD Ledger entry"""
        # Get initial CD balance
        initial_ledger = requests.get(f"{BASE_URL}/api/cd-ledger", headers=admin_headers).json()
        initial_balance = initial_ledger["total_balance"]
        initial_count = len(initial_ledger["entries"])
        
        # Create an endorsement as HR
        policies_response = requests.get(f"{BASE_URL}/api/policies", headers=hr_headers)
        policies = policies_response.json()
        
        if len(policies) == 0:
            pytest.skip("No policies available for testing")
        
        policy = policies[0]
        
        endorsement_data = {
            "policy_number": policy["policy_number"],
            "member_name": "TEST CD Auto Deduction",
            "relationship_type": "Employee",
            "endorsement_type": "Addition",
            "endorsement_date": datetime.now().strftime("%Y-%m-%d")
        }
        
        create_response = requests.post(f"{BASE_URL}/api/endorsements", json=endorsement_data, headers=hr_headers)
        assert create_response.status_code == 200
        endorsement = create_response.json()
        endorsement_id = endorsement["id"]
        prorata_premium = endorsement["prorata_premium"]
        
        # Approve the endorsement as Admin
        approve_response = requests.post(
            f"{BASE_URL}/api/endorsements/{endorsement_id}/approve",
            json={"status": "Approved", "remarks": "Test approval for CD deduction"},
            headers=admin_headers
        )
        assert approve_response.status_code == 200
        
        # Check CD Ledger for new entry
        final_ledger = requests.get(f"{BASE_URL}/api/cd-ledger", headers=admin_headers).json()
        final_count = len(final_ledger["entries"])
        
        # Should have one more entry if premium > 0
        if prorata_premium > 0:
            assert final_count >= initial_count + 1, f"Expected CD entry for premium ₹{prorata_premium}"
            
            # Find the new entry
            new_entries = [e for e in final_ledger["entries"] if e.get("endorsement_id") == endorsement_id]
            assert len(new_entries) == 1, f"Expected 1 CD entry for endorsement {endorsement_id}"
            
            new_entry = new_entries[0]
            assert new_entry["entry_type"] == "Endorsement Deduction"
            assert new_entry["amount"] == -prorata_premium  # Deduction is negative of premium
            
            print(f"✓ Approval created CD entry: {new_entry['reference']} - ₹{new_entry['amount']}")
            print(f"  Balance changed from ₹{initial_balance} to ₹{final_ledger['total_balance']}")
        else:
            print(f"✓ No CD entry created (premium is ₹{prorata_premium})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
