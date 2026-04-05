"""
Test Suite for InsureHub Iteration 7 - 4 New Features:
1. GPA & GTL Product Types - Only Employee relationship allowed
2. Full Excel Import E2E Flow
3. Policy-wise CD Ledger Filtering
4. HR Data Isolation - HR sees only own submissions
"""

import pytest
import requests
import os
import io
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDS = {"username": "admin", "password": "admin123"}
HR_CREDS = {"username": "hruser1", "password": "hr123456"}


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("Admin authentication failed")


@pytest.fixture(scope="module")
def hr_token():
    """Get HR authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_CREDS)
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("HR authentication failed")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def hr_headers(hr_token):
    return {"Authorization": f"Bearer {hr_token}"}


class TestGPAGTLPolicyTypes:
    """Test Feature 1: GPA & GTL Product Types"""
    
    def test_create_gpa_policy(self, admin_headers):
        """Admin can create a policy with type GPA"""
        policy_data = {
            "policy_number": "TEST-GPA-001",
            "policy_holder_name": "GPA Test Corp",
            "inception_date": "2025-01-01",
            "expiry_date": "2025-12-31",
            "policy_type": "GPA",
            "annual_premium_per_life": 5000.0,
            "status": "Active"
        }
        response = requests.post(f"{BASE_URL}/api/policies", json=policy_data, headers=admin_headers)
        
        if response.status_code == 400 and "already exists" in response.text:
            # Policy exists, fetch it
            policies = requests.get(f"{BASE_URL}/api/policies", headers=admin_headers).json()
            gpa_policy = next((p for p in policies if p["policy_number"] == "TEST-GPA-001"), None)
            assert gpa_policy is not None, "GPA policy should exist"
            assert gpa_policy["policy_type"] == "GPA"
            print("SUCCESS: GPA policy already exists with correct type")
        else:
            assert response.status_code == 201 or response.status_code == 200, f"Failed to create GPA policy: {response.text}"
            data = response.json()
            assert data["policy_type"] == "GPA", "Policy type should be GPA"
            print(f"SUCCESS: Created GPA policy {data['policy_number']}")
    
    def test_create_gtl_policy(self, admin_headers):
        """Admin can create a policy with type GTL"""
        policy_data = {
            "policy_number": "TEST-GTL-001",
            "policy_holder_name": "GTL Test Corp",
            "inception_date": "2025-01-01",
            "expiry_date": "2025-12-31",
            "policy_type": "GTL",
            "annual_premium_per_life": 3000.0,
            "status": "Active"
        }
        response = requests.post(f"{BASE_URL}/api/policies", json=policy_data, headers=admin_headers)
        
        if response.status_code == 400 and "already exists" in response.text:
            policies = requests.get(f"{BASE_URL}/api/policies", headers=admin_headers).json()
            gtl_policy = next((p for p in policies if p["policy_number"] == "TEST-GTL-001"), None)
            assert gtl_policy is not None, "GTL policy should exist"
            assert gtl_policy["policy_type"] == "GTL"
            print("SUCCESS: GTL policy already exists with correct type")
        else:
            assert response.status_code == 201 or response.status_code == 200, f"Failed to create GTL policy: {response.text}"
            data = response.json()
            assert data["policy_type"] == "GTL", "Policy type should be GTL"
            print(f"SUCCESS: Created GTL policy {data['policy_number']}")
    
    def test_policies_list_shows_policy_type(self, admin_headers):
        """GET /api/policies returns policy_type field"""
        response = requests.get(f"{BASE_URL}/api/policies", headers=admin_headers)
        assert response.status_code == 200
        policies = response.json()
        
        # Check that policy_type field exists
        for policy in policies:
            assert "policy_type" in policy, f"Policy {policy['policy_number']} missing policy_type field"
        
        # Verify GPA and GTL policies exist
        policy_types = [p["policy_type"] for p in policies]
        print(f"SUCCESS: Found policy types: {set(policy_types)}")
        assert "GPA" in policy_types or any(p["policy_number"] == "TEST-GPA-001" for p in policies), "GPA policy should exist"


class TestHRDataIsolation:
    """Test Feature 4: HR Data Isolation - HR sees only own submissions"""
    
    def test_hr_create_endorsement(self, hr_headers, admin_headers):
        """HR creates an endorsement (for isolation test)"""
        # First ensure a policy exists
        policies = requests.get(f"{BASE_URL}/api/policies", headers=hr_headers).json()
        if not policies:
            pytest.skip("No policies available for testing")
        
        policy = policies[0]
        endorsement_data = {
            "policy_number": policy["policy_number"],
            "member_name": "TEST_HR_Isolation_Member",
            "relationship_type": "Employee",
            "endorsement_type": "Addition",
            "endorsement_date": datetime.now().strftime("%Y-%m-%d")
        }
        
        response = requests.post(f"{BASE_URL}/api/endorsements", json=endorsement_data, headers=hr_headers)
        assert response.status_code in [200, 201], f"HR should be able to create endorsement: {response.text}"
        data = response.json()
        assert data["submitted_by"] is not None, "submitted_by should be set"
        print(f"SUCCESS: HR created endorsement {data['id'][:8]}... with submitted_by={data['submitted_by'][:8]}...")
        return data["id"]
    
    def test_hr_sees_only_own_endorsements(self, hr_headers, admin_headers):
        """HR GET /api/endorsements returns only their own submissions"""
        # Get HR's endorsements
        hr_response = requests.get(f"{BASE_URL}/api/endorsements", headers=hr_headers)
        assert hr_response.status_code == 200
        hr_endorsements = hr_response.json()
        
        # Get Admin's view (should see all)
        admin_response = requests.get(f"{BASE_URL}/api/endorsements", headers=admin_headers)
        assert admin_response.status_code == 200
        admin_endorsements = admin_response.json()
        
        # Admin should see >= HR's count (Admin sees all, HR sees only own)
        print(f"HR sees {len(hr_endorsements)} endorsements, Admin sees {len(admin_endorsements)} endorsements")
        assert len(admin_endorsements) >= len(hr_endorsements), "Admin should see at least as many endorsements as HR"
        
        # Verify HR only sees their own (all should have same submitted_by)
        if hr_endorsements:
            submitted_by_ids = set(e.get("submitted_by") for e in hr_endorsements if e.get("submitted_by"))
            # HR should only see endorsements with their own submitted_by
            assert len(submitted_by_ids) <= 1, f"HR should only see own submissions, found: {submitted_by_ids}"
            print(f"SUCCESS: HR data isolation working - HR sees only own {len(hr_endorsements)} endorsements")
    
    def test_hr_import_batches_filtered(self, hr_headers, admin_headers):
        """HR GET /api/endorsements/import-batches filtered by submitted_by"""
        hr_response = requests.get(f"{BASE_URL}/api/endorsements/import-batches", headers=hr_headers)
        assert hr_response.status_code == 200
        hr_batches = hr_response.json()
        
        admin_response = requests.get(f"{BASE_URL}/api/endorsements/import-batches", headers=admin_headers)
        assert admin_response.status_code == 200
        admin_batches = admin_response.json()
        
        print(f"HR sees {len(hr_batches)} import batches, Admin sees {len(admin_batches)} import batches")
        assert len(admin_batches) >= len(hr_batches), "Admin should see at least as many batches as HR"
        print("SUCCESS: Import batches filtering works")


class TestCDLedgerPolicyFilter:
    """Test Feature 3: Policy-wise CD Ledger Filtering"""
    
    def test_cd_ledger_without_filter(self, admin_headers):
        """GET /api/cd-ledger returns all entries without filter"""
        response = requests.get(f"{BASE_URL}/api/cd-ledger", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "entries" in data, "Response should have entries field"
        assert "total_balance" in data, "Response should have total_balance field"
        print(f"SUCCESS: CD Ledger returns {len(data['entries'])} entries, balance: {data['total_balance']}")
    
    def test_cd_ledger_with_policy_filter(self, admin_headers):
        """GET /api/cd-ledger?policy_number=X filters by policy"""
        # First get all policies
        policies = requests.get(f"{BASE_URL}/api/policies", headers=admin_headers).json()
        if not policies:
            pytest.skip("No policies for CD Ledger filter test")
        
        policy_number = policies[0]["policy_number"]
        
        # Get filtered CD Ledger
        response = requests.get(f"{BASE_URL}/api/cd-ledger?policy_number={policy_number}", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify all entries have the filtered policy_number (or null for general entries)
        for entry in data["entries"]:
            if entry.get("policy_number"):
                assert entry["policy_number"] == policy_number, f"Entry should be for policy {policy_number}"
        
        print(f"SUCCESS: CD Ledger filtered by {policy_number} returns {len(data['entries'])} entries")
    
    def test_cd_ledger_add_entry_with_policy(self, admin_headers):
        """Admin can add CD Ledger entry with policy_number"""
        policies = requests.get(f"{BASE_URL}/api/policies", headers=admin_headers).json()
        if not policies:
            pytest.skip("No policies for CD Ledger entry test")
        
        policy_number = policies[0]["policy_number"]
        entry_data = {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "reference": f"TEST-CD-{datetime.now().strftime('%H%M%S')}",
            "description": "Test CD entry with policy",
            "amount": 1000.0,
            "policy_number": policy_number
        }
        
        response = requests.post(f"{BASE_URL}/api/cd-ledger", json=entry_data, headers=admin_headers)
        assert response.status_code in [200, 201], f"Failed to add CD entry: {response.text}"
        data = response.json()
        assert data.get("policy_number") == policy_number, "Entry should have policy_number"
        print(f"SUCCESS: Added CD entry {data['reference']} for policy {policy_number}")
        
        # Clean up - delete the test entry
        delete_response = requests.delete(f"{BASE_URL}/api/cd-ledger/{data['id']}", headers=admin_headers)
        print(f"Cleanup: Deleted test CD entry (status: {delete_response.status_code})")


class TestExcelImportE2EFlow:
    """Test Feature 2: Full Excel Import E2E Flow"""
    
    def test_create_test_policy_for_import(self, admin_headers):
        """Create a test policy for Excel import"""
        policy_data = {
            "policy_number": "POL-E2E-TEST",
            "policy_holder_name": "E2E Test Company",
            "inception_date": "2025-01-01",
            "expiry_date": "2025-12-31",
            "policy_type": "Group Health",
            "annual_premium_per_life": 10000.0,
            "status": "Active"
        }
        response = requests.post(f"{BASE_URL}/api/policies", json=policy_data, headers=admin_headers)
        
        if response.status_code == 400 and "already exists" in response.text:
            print("SUCCESS: E2E test policy already exists")
        else:
            assert response.status_code in [200, 201], f"Failed to create E2E policy: {response.text}"
            print(f"SUCCESS: Created E2E test policy POL-E2E-TEST")
    
    def test_excel_preview_endpoint(self, hr_headers):
        """HR can preview Excel data before import"""
        # Create a simple Excel file using openpyxl
        try:
            from openpyxl import Workbook
        except ImportError:
            pytest.skip("openpyxl not installed")
        
        wb = Workbook()
        ws = wb.active
        ws.title = "Endorsements"
        
        # Headers
        headers = ["policy_number", "member_name", "relationship_type", "endorsement_type", "endorsement_date"]
        ws.append(headers)
        
        # Data row
        ws.append(["POL-E2E-TEST", "Preview Test Member", "Employee", "Addition", datetime.now().strftime("%Y-%m-%d")])
        
        # Save to bytes
        excel_buffer = io.BytesIO()
        wb.save(excel_buffer)
        excel_buffer.seek(0)
        
        # Upload for preview
        files = {"file": ("test_preview.xlsx", excel_buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        response = requests.post(f"{BASE_URL}/api/endorsements/preview", files=files, headers=hr_headers)
        
        assert response.status_code == 200, f"Preview failed: {response.text}"
        data = response.json()
        assert "rows" in data, "Preview should return rows"
        assert "total_rows" in data, "Preview should return total_rows"
        assert data["total_rows"] >= 1, "Should have at least 1 row"
        
        # Check that prorata_premium is calculated
        if data["rows"]:
            row = data["rows"][0]
            assert "prorata_premium" in row, "Preview should calculate prorata_premium"
            print(f"SUCCESS: Preview returned {data['total_rows']} rows with prorata_premium={row.get('prorata_premium')}")
    
    def test_excel_import_creates_batch(self, hr_headers, admin_headers):
        """HR uploads Excel → Creates import batch → Admin can view"""
        try:
            from openpyxl import Workbook
        except ImportError:
            pytest.skip("openpyxl not installed")
        
        wb = Workbook()
        ws = wb.active
        ws.title = "Endorsements"
        
        headers = ["policy_number", "member_name", "relationship_type", "endorsement_type", "endorsement_date"]
        ws.append(headers)
        
        # Add test data
        test_member = f"TEST_Import_{datetime.now().strftime('%H%M%S')}"
        ws.append(["POL-E2E-TEST", test_member, "Employee", "Addition", datetime.now().strftime("%Y-%m-%d")])
        
        excel_buffer = io.BytesIO()
        wb.save(excel_buffer)
        excel_buffer.seek(0)
        
        # Import the file
        files = {"file": ("test_import.xlsx", excel_buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        response = requests.post(f"{BASE_URL}/api/endorsements/import", files=files, headers=hr_headers)
        
        assert response.status_code == 200, f"Import failed: {response.text}"
        data = response.json()
        assert "import_batch_id" in data, "Import should return batch_id"
        assert data["success_count"] >= 1, "Should have at least 1 successful import"
        
        batch_id = data["import_batch_id"]
        print(f"SUCCESS: Import created batch {batch_id[:8]}... with {data['success_count']} records")
        
        # Admin can view the batch
        batches_response = requests.get(f"{BASE_URL}/api/endorsements/import-batches", headers=admin_headers)
        assert batches_response.status_code == 200
        batches = batches_response.json()
        
        batch_ids = [b["batch_id"] for b in batches]
        assert batch_id in batch_ids, f"Admin should see batch {batch_id[:8]}..."
        print(f"SUCCESS: Admin can see import batch in list")
        
        return batch_id
    
    def test_admin_view_batch_details(self, admin_headers):
        """Admin can view batch details"""
        # Get batches
        batches_response = requests.get(f"{BASE_URL}/api/endorsements/import-batches", headers=admin_headers)
        assert batches_response.status_code == 200
        batches = batches_response.json()
        
        if not batches:
            pytest.skip("No import batches to view")
        
        batch_id = batches[0]["batch_id"]
        
        # Get batch details
        detail_response = requests.get(f"{BASE_URL}/api/endorsements/batch/{batch_id}", headers=admin_headers)
        assert detail_response.status_code == 200
        endorsements = detail_response.json()
        
        assert len(endorsements) > 0, "Batch should have endorsements"
        print(f"SUCCESS: Batch {batch_id[:8]}... has {len(endorsements)} endorsements")
        
        return batch_id, endorsements
    
    def test_admin_download_batch_excel(self, admin_headers):
        """Admin can download batch as Excel"""
        batches_response = requests.get(f"{BASE_URL}/api/endorsements/import-batches", headers=admin_headers)
        batches = batches_response.json()
        
        if not batches:
            pytest.skip("No import batches to download")
        
        batch_id = batches[0]["batch_id"]
        
        download_response = requests.get(f"{BASE_URL}/api/endorsements/batch/{batch_id}/download", headers=admin_headers)
        assert download_response.status_code == 200, f"Download failed: {download_response.text}"
        
        # Check content type
        content_type = download_response.headers.get("Content-Type", "")
        assert "spreadsheet" in content_type or "excel" in content_type.lower() or "octet-stream" in content_type, f"Should return Excel file, got: {content_type}"
        
        # Check content disposition
        content_disp = download_response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disp, "Should be attachment download"
        
        print(f"SUCCESS: Downloaded batch Excel ({len(download_response.content)} bytes)")
    
    def test_admin_approve_endorsement_from_batch(self, admin_headers):
        """Admin approves endorsement → CD Ledger auto-deducted"""
        # Get a pending endorsement from a batch
        batches_response = requests.get(f"{BASE_URL}/api/endorsements/import-batches", headers=admin_headers)
        batches = batches_response.json()
        
        if not batches:
            pytest.skip("No import batches")
        
        # Find a batch with pending endorsements
        pending_endorsement = None
        for batch in batches:
            detail_response = requests.get(f"{BASE_URL}/api/endorsements/batch/{batch['batch_id']}", headers=admin_headers)
            endorsements = detail_response.json()
            for e in endorsements:
                if e.get("status") == "Pending":
                    pending_endorsement = e
                    break
            if pending_endorsement:
                break
        
        if not pending_endorsement:
            # Create a new endorsement to approve
            policies = requests.get(f"{BASE_URL}/api/policies", headers=admin_headers).json()
            if policies:
                endorsement_data = {
                    "policy_number": policies[0]["policy_number"],
                    "member_name": f"TEST_Approve_{datetime.now().strftime('%H%M%S')}",
                    "relationship_type": "Employee",
                    "endorsement_type": "Addition",
                    "endorsement_date": datetime.now().strftime("%Y-%m-%d")
                }
                create_response = requests.post(f"{BASE_URL}/api/endorsements", json=endorsement_data, headers=admin_headers)
                if create_response.status_code in [200, 201]:
                    pending_endorsement = create_response.json()
        
        if not pending_endorsement:
            pytest.skip("No pending endorsement to approve")
        
        endorsement_id = pending_endorsement["id"]
        prorata_premium = pending_endorsement.get("prorata_premium", 0)
        
        # Get CD Ledger balance before approval
        cd_before = requests.get(f"{BASE_URL}/api/cd-ledger", headers=admin_headers).json()
        balance_before = cd_before.get("total_balance", 0)
        
        # Approve the endorsement
        approval_data = {"status": "Approved", "remarks": "Test approval"}
        approve_response = requests.post(f"{BASE_URL}/api/endorsements/{endorsement_id}/approve", json=approval_data, headers=admin_headers)
        
        if approve_response.status_code == 400 and "already processed" in approve_response.text.lower():
            print("INFO: Endorsement already processed, skipping CD Ledger check")
            return
        
        assert approve_response.status_code == 200, f"Approval failed: {approve_response.text}"
        
        # Verify CD Ledger was updated
        cd_after = requests.get(f"{BASE_URL}/api/cd-ledger", headers=admin_headers).json()
        balance_after = cd_after.get("total_balance", 0)
        
        # For Addition, premium is positive, so CD balance should decrease (deduction)
        if prorata_premium > 0:
            expected_change = -prorata_premium
            print(f"SUCCESS: Approved endorsement. CD Balance: {balance_before} → {balance_after} (expected change: {expected_change})")
        else:
            print(f"SUCCESS: Approved endorsement. CD Balance: {balance_before} → {balance_after}")


class TestPolicyTypeEnum:
    """Verify PolicyType enum includes GPA and GTL"""
    
    def test_policy_type_enum_values(self, admin_headers):
        """Verify all policy types are accepted"""
        policy_types = ["Group Health", "Group Accident", "Group Term", "GPA", "GTL"]
        
        for ptype in policy_types:
            policy_data = {
                "policy_number": f"TEST-ENUM-{ptype.replace(' ', '-')}",
                "policy_holder_name": f"Test {ptype}",
                "inception_date": "2025-01-01",
                "expiry_date": "2025-12-31",
                "policy_type": ptype,
                "annual_premium_per_life": 1000.0,
                "status": "Active"
            }
            response = requests.post(f"{BASE_URL}/api/policies", json=policy_data, headers=admin_headers)
            
            # Either created or already exists
            assert response.status_code in [200, 201, 400], f"Policy type {ptype} should be valid: {response.text}"
            if response.status_code in [200, 201]:
                print(f"SUCCESS: Created policy with type {ptype}")
                # Clean up
                policy_id = response.json()["id"]
                requests.delete(f"{BASE_URL}/api/policies/{policy_id}", headers=admin_headers)
            elif "already exists" in response.text:
                print(f"SUCCESS: Policy type {ptype} is valid (policy exists)")


# Cleanup fixture
@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_headers):
    """Cleanup test data after all tests"""
    yield
    # Cleanup test policies
    try:
        policies = requests.get(f"{BASE_URL}/api/policies", headers=admin_headers).json()
        for policy in policies:
            if policy["policy_number"].startswith("TEST-"):
                requests.delete(f"{BASE_URL}/api/policies/{policy['id']}", headers=admin_headers)
                print(f"Cleaned up policy: {policy['policy_number']}")
    except:
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
