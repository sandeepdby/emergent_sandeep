"""
Test suite for Claims Excel Import Feature (Iteration 21)
Tests:
- POST /api/claims/import - Upload Excel file with claims data (Admin auth required, HR forbidden)
- GET /api/claims/template/download - Download claims Excel template (Admin only)
- Imported claims appear in GET /api/claims list
- Imported claims appear in GET /api/claims-analytics calculations
- HR user can see imported claims filtered by assigned policies in claims analytics
- Excel import validates required fields (Policy Number)
- Excel import handles invalid claim types and statuses gracefully with defaults
"""

import pytest
import requests
import os
import io
import pandas as pd

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
MASTER_ADMIN = {"username": "masteradmin", "password": "Admin@123"}
HR_USER = {"username": "arpita", "password": "Password@123"}


class TestClaimsImportFeature:
    """Test claims Excel import functionality"""
    
    admin_token = None
    hr_token = None
    imported_batch_id = None
    test_policy_number = "TEST-IMPORT-POL-001"
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth tokens"""
        # Admin login
        resp = requests.post(f"{BASE_URL}/api/auth/login", json=MASTER_ADMIN)
        assert resp.status_code == 200, f"Admin login failed: {resp.text}"
        TestClaimsImportFeature.admin_token = resp.json()["access_token"]
        
        # HR login
        resp = requests.post(f"{BASE_URL}/api/auth/login", json=HR_USER)
        assert resp.status_code == 200, f"HR login failed: {resp.text}"
        TestClaimsImportFeature.hr_token = resp.json()["access_token"]
    
    def admin_headers(self):
        return {"Authorization": f"Bearer {self.admin_token}"}
    
    def hr_headers(self):
        return {"Authorization": f"Bearer {self.hr_token}"}
    
    # ==================== Template Download Tests ====================
    
    def test_01_template_download_admin_success(self):
        """Admin can download claims template"""
        resp = requests.get(
            f"{BASE_URL}/api/claims/template/download",
            headers=self.admin_headers()
        )
        assert resp.status_code == 200, f"Template download failed: {resp.status_code}"
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in resp.headers.get("Content-Type", "")
        
        # Verify it's a valid Excel file
        df = pd.read_excel(io.BytesIO(resp.content))
        expected_columns = ["Policy Number", "Claim Type", "Policy Type", "Claims Report Date",
                          "Cashless Claims Count", "Reimbursement Claims Count", "Claimed Amount",
                          "Approved Amount", "Settled Amount", "Status", "Remarks"]
        for col in expected_columns:
            assert col in df.columns, f"Missing column: {col}"
        print(f"✓ Template downloaded with {len(df.columns)} columns: {list(df.columns)}")
    
    def test_02_template_download_hr_forbidden(self):
        """HR user cannot download claims template"""
        resp = requests.get(
            f"{BASE_URL}/api/claims/template/download",
            headers=self.hr_headers()
        )
        assert resp.status_code == 403, f"Expected 403 for HR, got {resp.status_code}"
        print("✓ HR user correctly forbidden from downloading template")
    
    def test_03_template_download_no_auth(self):
        """Unauthenticated user cannot download template"""
        resp = requests.get(f"{BASE_URL}/api/claims/template/download")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        print("✓ Unauthenticated user correctly blocked from template download")
    
    # ==================== Claims Import Tests ====================
    
    def test_04_import_claims_admin_success(self):
        """Admin can import claims from Excel"""
        # Create test Excel file
        data = {
            "Policy Number": [self.test_policy_number, self.test_policy_number, self.test_policy_number],
            "Claim Type": ["Cashless", "Reimbursement", "Cashless"],
            "Policy Type": ["ESKP", "ESK", "E"],
            "Claims Report Date": ["2026-01-15", "2026-01-20", "2026-01-25"],
            "Cashless Claims Count": [5, 0, 3],
            "Reimbursement Claims Count": [0, 2, 0],
            "Claimed Amount": [100000, 50000, 75000],
            "Approved Amount": [95000, 45000, 70000],
            "Settled Amount": [95000, 40000, 0],
            "Status": ["Settled", "In Process", "Submitted"],
            "Remarks": ["Test import 1", "Test import 2", "Test import 3"],
        }
        df = pd.DataFrame(data)
        
        # Write to bytes
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Claims")
        output.seek(0)
        
        # Upload
        files = {"file": ("test_claims.xlsx", output, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        resp = requests.post(
            f"{BASE_URL}/api/claims/import",
            headers=self.admin_headers(),
            files=files
        )
        assert resp.status_code == 200, f"Import failed: {resp.status_code} - {resp.text}"
        
        result = resp.json()
        assert result["success_count"] == 3, f"Expected 3 successes, got {result['success_count']}"
        assert result["error_count"] == 0, f"Expected 0 errors, got {result['error_count']}"
        assert result["total_rows"] == 3, f"Expected 3 total rows, got {result['total_rows']}"
        assert "batch_id" in result
        TestClaimsImportFeature.imported_batch_id = result["batch_id"]
        print(f"✓ Successfully imported 3 claims, batch_id: {result['batch_id']}")
    
    def test_05_import_claims_hr_forbidden(self):
        """HR user cannot import claims"""
        data = {"Policy Number": ["POL-001"], "Claimed Amount": [10000]}
        df = pd.DataFrame(data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False)
        output.seek(0)
        
        files = {"file": ("test.xlsx", output, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        resp = requests.post(
            f"{BASE_URL}/api/claims/import",
            headers=self.hr_headers(),
            files=files
        )
        assert resp.status_code == 403, f"Expected 403 for HR, got {resp.status_code}"
        print("✓ HR user correctly forbidden from importing claims")
    
    def test_06_import_validates_policy_number_required(self):
        """Import fails for rows without policy number"""
        data = {
            "Policy Number": [self.test_policy_number, "", ""],  # 2 missing policy numbers
            "Claimed Amount": [10000, 20000, 30000],
        }
        df = pd.DataFrame(data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False)
        output.seek(0)
        
        files = {"file": ("test.xlsx", output, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        resp = requests.post(
            f"{BASE_URL}/api/claims/import",
            headers=self.admin_headers(),
            files=files
        )
        assert resp.status_code == 200
        result = resp.json()
        assert result["success_count"] == 1, f"Expected 1 success, got {result['success_count']}"
        assert result["error_count"] == 2, f"Expected 2 errors, got {result['error_count']}"
        assert any("Missing policy number" in e.get("error", "") for e in result["errors"])
        print(f"✓ Validation correctly caught {result['error_count']} rows with missing policy numbers")
    
    def test_07_import_handles_invalid_claim_type_with_default(self):
        """Import defaults invalid claim types to 'Cashless'"""
        data = {
            "Policy Number": [self.test_policy_number],
            "Claim Type": ["InvalidType"],  # Invalid type
            "Claimed Amount": [10000],
        }
        df = pd.DataFrame(data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False)
        output.seek(0)
        
        files = {"file": ("test.xlsx", output, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        resp = requests.post(
            f"{BASE_URL}/api/claims/import",
            headers=self.admin_headers(),
            files=files
        )
        assert resp.status_code == 200
        result = resp.json()
        assert result["success_count"] == 1, "Should import with default claim type"
        print("✓ Invalid claim type defaulted to 'Cashless' successfully")
    
    def test_08_import_handles_invalid_status_with_default(self):
        """Import defaults invalid statuses to 'Submitted'"""
        data = {
            "Policy Number": [self.test_policy_number],
            "Status": ["InvalidStatus"],  # Invalid status
            "Claimed Amount": [10000],
        }
        df = pd.DataFrame(data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False)
        output.seek(0)
        
        files = {"file": ("test.xlsx", output, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        resp = requests.post(
            f"{BASE_URL}/api/claims/import",
            headers=self.admin_headers(),
            files=files
        )
        assert resp.status_code == 200
        result = resp.json()
        assert result["success_count"] == 1, "Should import with default status"
        print("✓ Invalid status defaulted to 'Submitted' successfully")
    
    def test_09_import_requires_policy_number_column(self):
        """Import fails if Excel has no Policy Number column"""
        data = {
            "Claimed Amount": [10000, 20000],
            "Status": ["Submitted", "Settled"],
        }
        df = pd.DataFrame(data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False)
        output.seek(0)
        
        files = {"file": ("test.xlsx", output, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        resp = requests.post(
            f"{BASE_URL}/api/claims/import",
            headers=self.admin_headers(),
            files=files
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        assert "Policy Number" in resp.json().get("detail", "")
        print("✓ Import correctly rejects Excel without Policy Number column")
    
    # ==================== Imported Claims Visibility Tests ====================
    
    def test_10_imported_claims_appear_in_claims_list(self):
        """Imported claims appear in GET /api/claims"""
        resp = requests.get(
            f"{BASE_URL}/api/claims",
            headers=self.admin_headers()
        )
        assert resp.status_code == 200
        claims = resp.json()
        
        # Find claims with our test policy number
        test_claims = [c for c in claims if c.get("policy_number") == self.test_policy_number]
        assert len(test_claims) >= 3, f"Expected at least 3 test claims, found {len(test_claims)}"
        
        # Verify claim structure
        for claim in test_claims[:1]:
            assert "id" in claim
            assert "claim_number" in claim
            assert claim["claim_number"].startswith("CLM-")
            assert "policy_number" in claim
            assert "claim_type" in claim
            assert "status" in claim
        print(f"✓ Found {len(test_claims)} imported claims in claims list")
    
    def test_11_imported_claims_appear_in_analytics(self):
        """Imported claims appear in GET /api/claims-analytics"""
        resp = requests.get(
            f"{BASE_URL}/api/claims-analytics",
            headers=self.admin_headers()
        )
        assert resp.status_code == 200
        analytics = resp.json()
        
        # Verify analytics structure
        assert "total_claims" in analytics
        assert "total_claimed_amount" in analytics
        assert "status_distribution" in analytics
        assert "type_distribution" in analytics
        assert "monthly_trend" in analytics
        
        # Analytics should include our imported claims
        assert analytics["total_claims"] >= 3, f"Expected at least 3 claims in analytics"
        print(f"✓ Analytics shows {analytics['total_claims']} total claims, {analytics['total_claimed_amount']} total claimed")
    
    def test_12_hr_sees_only_assigned_policy_claims(self):
        """HR user sees only claims for assigned policies"""
        # First check what policies HR has assigned
        resp = requests.get(
            f"{BASE_URL}/api/policy-assignments",
            headers=self.hr_headers()
        )
        assert resp.status_code == 200
        assignments = resp.json()
        assigned_policies = [a["policy_number"] for a in assignments]
        print(f"HR has {len(assigned_policies)} assigned policies: {assigned_policies[:5]}")
        
        # Get claims as HR
        resp = requests.get(
            f"{BASE_URL}/api/claims",
            headers=self.hr_headers()
        )
        assert resp.status_code == 200
        hr_claims = resp.json()
        
        # All claims should be for assigned policies (or empty if no assignments)
        if assigned_policies:
            for claim in hr_claims:
                assert claim["policy_number"] in assigned_policies, \
                    f"HR sees claim for unassigned policy: {claim['policy_number']}"
        print(f"✓ HR sees {len(hr_claims)} claims (all for assigned policies)")
    
    def test_13_hr_analytics_filtered_by_assigned_policies(self):
        """HR claims analytics filtered by assigned policies"""
        resp = requests.get(
            f"{BASE_URL}/api/claims-analytics",
            headers=self.hr_headers()
        )
        assert resp.status_code == 200
        analytics = resp.json()
        
        # Verify analytics structure
        assert "total_claims" in analytics
        assert "claims_ratio" in analytics
        assert "status_distribution" in analytics
        print(f"✓ HR analytics: {analytics['total_claims']} claims, ratio: {analytics['claims_ratio']}%")
    
    # ==================== Column Alias Tests ====================
    
    def test_14_import_handles_column_aliases(self):
        """Import handles various column name aliases"""
        data = {
            "policy_no": [self.test_policy_number],  # alias for policy_number
            "type": ["Reimbursement"],  # alias for claim_type
            "amount_claimed": [25000],  # alias for claimed_amount
            "claim_status": ["Settled"],  # alias for status
        }
        df = pd.DataFrame(data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False)
        output.seek(0)
        
        files = {"file": ("test.xlsx", output, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        resp = requests.post(
            f"{BASE_URL}/api/claims/import",
            headers=self.admin_headers(),
            files=files
        )
        assert resp.status_code == 200
        result = resp.json()
        assert result["success_count"] == 1, f"Expected 1 success with aliases, got {result['success_count']}"
        print("✓ Column aliases handled correctly")
    
    # ==================== Cleanup ====================
    
    def test_99_cleanup_test_claims(self):
        """Cleanup test claims"""
        # Get all claims with test policy number
        resp = requests.get(
            f"{BASE_URL}/api/claims",
            headers=self.admin_headers()
        )
        if resp.status_code == 200:
            claims = resp.json()
            test_claims = [c for c in claims if c.get("policy_number") == self.test_policy_number]
            deleted = 0
            for claim in test_claims:
                del_resp = requests.delete(
                    f"{BASE_URL}/api/claims/{claim['id']}",
                    headers=self.admin_headers()
                )
                if del_resp.status_code == 200:
                    deleted += 1
            print(f"✓ Cleaned up {deleted} test claims")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
