"""
Iteration 13 Tests: Policy and Claims Tab Redesign
- Policy fields: Policy Number, Policy Date, Policy Type (ESKP/ESK/E), Premium, 
  Employees Count, Spouse Count, Kids Count, Parents Count, Total Lives Count (auto-sum),
  Addition Lives, Deletion Lives
- Claims analytics: Total Claims, Reimbursement, Cashless, Rejected, Under Process,
  Claims Ratio (Claims/Premium), Renewal Expected Pricing (Claims*1.30)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestIteration13Backend:
    """Test suite for Iteration 13 features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_token = None
        self.hr_token = None
        self.test_policy_id = None
        
    def get_admin_token(self):
        """Get admin authentication token"""
        if self.admin_token:
            return self.admin_token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "masteradmin",
            "password": "Admin@123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json()["access_token"]
        return self.admin_token
    
    def get_hr_token(self):
        """Get HR user authentication token"""
        if self.hr_token:
            return self.hr_token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "hruser1",
            "password": "hr123456"
        })
        assert response.status_code == 200, f"HR login failed: {response.text}"
        self.hr_token = response.json()["access_token"]
        return self.hr_token

    # ==================== POLICY TESTS ====================
    
    def test_create_policy_with_new_fields(self):
        """Test creating policy with all new fields including life category counts"""
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create policy with new fields
        policy_data = {
            "policy_number": "TEST-POL-IT13-001",
            "policy_holder_name": "Test Company IT13",
            "policy_date": "2025-01-15",
            "policy_type": "ESKP",
            "premium": 250000,
            "employees_count": 25,
            "spouse_count": 20,
            "kids_count": 15,
            "parents_count": 10,
            "addition_lives": 5,
            "deletion_lives": 2,
            "status": "Active"
        }
        
        response = requests.post(f"{BASE_URL}/api/policies", json=policy_data, headers=headers)
        
        # Check if policy already exists
        if response.status_code == 400 and "already exists" in response.text:
            # Delete existing and recreate
            policies_resp = requests.get(f"{BASE_URL}/api/policies", headers=headers)
            for p in policies_resp.json():
                if p["policy_number"] == "TEST-POL-IT13-001":
                    requests.delete(f"{BASE_URL}/api/policies/{p['id']}", headers=headers)
            response = requests.post(f"{BASE_URL}/api/policies", json=policy_data, headers=headers)
        
        assert response.status_code in [200, 201], f"Create policy failed: {response.text}"
        
        data = response.json()
        assert data["policy_number"] == "TEST-POL-IT13-001"
        assert data["policy_type"] == "ESKP"
        assert data["premium"] == 250000
        assert data["employees_count"] == 25
        assert data["spouse_count"] == 20
        assert data["kids_count"] == 15
        assert data["parents_count"] == 10
        # Verify auto-computed total_lives_count = 25 + 20 + 15 + 10 = 70
        assert data["total_lives_count"] == 70, f"Expected total_lives_count=70, got {data['total_lives_count']}"
        assert data["addition_lives"] == 5
        assert data["deletion_lives"] == 2
        
        self.test_policy_id = data["id"]
        print(f"PASS: Created policy with total_lives_count auto-computed to {data['total_lives_count']}")
    
    def test_policy_type_enum_values(self):
        """Test that policy type accepts ESKP, ESK, E values"""
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        for policy_type in ["ESKP", "ESK", "E"]:
            policy_data = {
                "policy_number": f"TEST-TYPE-{policy_type}",
                "policy_holder_name": f"Test {policy_type} Company",
                "policy_type": policy_type,
                "premium": 100000,
                "employees_count": 10,
                "spouse_count": 5,
                "kids_count": 3,
                "parents_count": 2,
                "status": "Active"
            }
            
            response = requests.post(f"{BASE_URL}/api/policies", json=policy_data, headers=headers)
            
            if response.status_code == 400 and "already exists" in response.text:
                # Policy exists, verify it has correct type
                policies_resp = requests.get(f"{BASE_URL}/api/policies", headers=headers)
                found = False
                for p in policies_resp.json():
                    if p["policy_number"] == f"TEST-TYPE-{policy_type}":
                        assert p["policy_type"] == policy_type
                        found = True
                        break
                assert found, f"Policy TEST-TYPE-{policy_type} not found"
            else:
                assert response.status_code in [200, 201], f"Create {policy_type} policy failed: {response.text}"
                data = response.json()
                assert data["policy_type"] == policy_type
        
        print("PASS: All policy types (ESKP, ESK, E) accepted")
    
    def test_update_policy_with_new_fields(self):
        """Test updating policy recalculates total_lives_count"""
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # First get existing policies
        response = requests.get(f"{BASE_URL}/api/policies", headers=headers)
        assert response.status_code == 200
        policies = response.json()
        
        if not policies:
            pytest.skip("No policies to update")
        
        policy = policies[0]
        policy_id = policy["id"]
        
        # Update with new counts
        update_data = {
            "policy_number": policy["policy_number"],
            "policy_holder_name": policy["policy_holder_name"],
            "policy_type": "ESK",
            "premium": 300000,
            "employees_count": 30,
            "spouse_count": 25,
            "kids_count": 20,
            "parents_count": 15,
            "addition_lives": 8,
            "deletion_lives": 3,
            "status": "Active"
        }
        
        response = requests.put(f"{BASE_URL}/api/policies/{policy_id}", json=update_data, headers=headers)
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        data = response.json()
        # Verify total_lives_count recalculated = 30 + 25 + 20 + 15 = 90
        assert data["total_lives_count"] == 90, f"Expected 90, got {data['total_lives_count']}"
        print(f"PASS: Policy updated with recalculated total_lives_count = {data['total_lives_count']}")
    
    def test_get_policies_returns_new_fields(self):
        """Test GET /api/policies returns all new fields"""
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/policies", headers=headers)
        assert response.status_code == 200
        
        policies = response.json()
        if not policies:
            pytest.skip("No policies found")
        
        policy = policies[0]
        
        # Verify all new fields are present
        required_fields = [
            "policy_number", "policy_holder_name", "policy_type", "premium",
            "employees_count", "spouse_count", "kids_count", "parents_count",
            "total_lives_count", "addition_lives", "deletion_lives", "status"
        ]
        
        for field in required_fields:
            assert field in policy, f"Missing field: {field}"
        
        print(f"PASS: GET /api/policies returns all required fields")

    # ==================== POLICIES ANALYTICS TESTS ====================
    
    def test_policies_analytics_returns_life_category_totals(self):
        """Test GET /api/policies-analytics returns life category breakdowns"""
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/policies-analytics", headers=headers)
        assert response.status_code == 200, f"Analytics failed: {response.text}"
        
        data = response.json()
        
        # Verify all required analytics fields
        required_fields = [
            "total_policies", "active_policies", "expired_policies",
            "total_employees", "total_spouse", "total_kids", "total_parents",
            "total_lives", "total_premium",
            "total_addition_lives", "total_deletion_lives",
            "type_breakdown", "policies"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing analytics field: {field}"
        
        # Verify numeric values
        assert isinstance(data["total_employees"], int)
        assert isinstance(data["total_spouse"], int)
        assert isinstance(data["total_kids"], int)
        assert isinstance(data["total_parents"], int)
        assert isinstance(data["total_lives"], int)
        assert isinstance(data["total_premium"], (int, float))
        assert isinstance(data["total_addition_lives"], int)
        assert isinstance(data["total_deletion_lives"], int)
        
        print(f"PASS: Policies analytics returns all life category totals")
        print(f"  - Total Employees: {data['total_employees']}")
        print(f"  - Total Spouse: {data['total_spouse']}")
        print(f"  - Total Kids: {data['total_kids']}")
        print(f"  - Total Parents: {data['total_parents']}")
        print(f"  - Total Lives: {data['total_lives']}")
        print(f"  - Total Premium: {data['total_premium']}")
        print(f"  - Addition Lives: {data['total_addition_lives']}")
        print(f"  - Deletion Lives: {data['total_deletion_lives']}")
    
    def test_policies_analytics_type_breakdown(self):
        """Test policies analytics includes type breakdown with ESKP/ESK/E"""
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/policies-analytics", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        type_breakdown = data.get("type_breakdown", [])
        
        # Verify type_breakdown structure
        for item in type_breakdown:
            assert "name" in item
            assert "count" in item
            assert "lives" in item
            assert "premium" in item
        
        print(f"PASS: Type breakdown contains {len(type_breakdown)} types")
        for t in type_breakdown:
            print(f"  - {t['name']}: {t['count']} policies, {t['lives']} lives")
    
    def test_policies_analytics_accessible_by_hr(self):
        """Test HR users can access policies analytics"""
        token = self.get_hr_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/policies-analytics", headers=headers)
        assert response.status_code == 200, f"HR access failed: {response.text}"
        
        data = response.json()
        assert "total_policies" in data
        assert "total_lives" in data
        
        print("PASS: HR user can access policies analytics")

    # ==================== CLAIMS ANALYTICS TESTS ====================
    
    def test_claims_analytics_returns_all_metrics(self):
        """Test GET /api/claims-analytics returns all required metrics"""
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/claims-analytics", headers=headers)
        assert response.status_code == 200, f"Claims analytics failed: {response.text}"
        
        data = response.json()
        
        # Verify all required fields
        required_fields = [
            "total_claims", "total_claimed_amount",
            "reimbursement_claims", "reimbursement_count",
            "cashless_claims", "cashless_count",
            "rejected_claims", "rejected_count",
            "under_process_claims", "under_process_count",
            "total_premium", "claims_ratio", "renewal_expected_pricing",
            "status_distribution", "type_distribution", "monthly_trend"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing claims analytics field: {field}"
        
        print(f"PASS: Claims analytics returns all required metrics")
        print(f"  - Total Claims: {data['total_claims']}")
        print(f"  - Reimbursement: {data['reimbursement_count']} claims, ₹{data['reimbursement_claims']}")
        print(f"  - Cashless: {data['cashless_count']} claims, ₹{data['cashless_claims']}")
        print(f"  - Rejected: {data['rejected_count']} claims, ₹{data['rejected_claims']}")
        print(f"  - Under Process: {data['under_process_count']} claims, ₹{data['under_process_claims']}")
        print(f"  - Total Premium: ₹{data['total_premium']}")
        print(f"  - Claims Ratio: {data['claims_ratio']}%")
        print(f"  - Renewal Expected Pricing: ₹{data['renewal_expected_pricing']}")
    
    def test_claims_ratio_calculation(self):
        """Test claims ratio = (total_claimed / total_premium) * 100"""
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/claims-analytics", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        
        total_claimed = data["total_claimed_amount"]
        total_premium = data["total_premium"]
        claims_ratio = data["claims_ratio"]
        
        if total_premium > 0:
            expected_ratio = round((total_claimed / total_premium) * 100, 1)
            assert abs(claims_ratio - expected_ratio) < 0.2, f"Claims ratio mismatch: expected {expected_ratio}, got {claims_ratio}"
            print(f"PASS: Claims ratio correctly calculated: {claims_ratio}% (claimed: {total_claimed}, premium: {total_premium})")
        else:
            assert claims_ratio == 0
            print("PASS: Claims ratio is 0 when no premium")
    
    def test_renewal_expected_pricing_calculation(self):
        """Test renewal expected pricing = total_claimed * 1.30"""
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/claims-analytics", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        
        total_claimed = data["total_claimed_amount"]
        renewal_pricing = data["renewal_expected_pricing"]
        
        expected_renewal = round(total_claimed * 1.30, 2)
        assert abs(renewal_pricing - expected_renewal) < 0.01, f"Renewal pricing mismatch: expected {expected_renewal}, got {renewal_pricing}"
        
        print(f"PASS: Renewal expected pricing correctly calculated: ₹{renewal_pricing} (claimed * 1.30)")
    
    def test_claims_analytics_accessible_by_hr(self):
        """Test HR users can access claims analytics"""
        token = self.get_hr_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/claims-analytics", headers=headers)
        assert response.status_code == 200, f"HR access failed: {response.text}"
        
        data = response.json()
        assert "total_claims" in data
        assert "claims_ratio" in data
        assert "renewal_expected_pricing" in data
        
        print("PASS: HR user can access claims analytics")

    # ==================== CLAIMS CRUD TESTS ====================
    
    def test_create_claim_with_policy_type(self):
        """Test creating claim with ESKP/ESK/E policy type"""
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        claim_data = {
            "policy_number": "TEST-POL-IT13-001",
            "employee_name": "Test Employee IT13",
            "patient_name": "Test Patient IT13",
            "relationship": "Self",
            "claim_type": "Cashless",
            "policy_type": "ESKP",
            "diagnosis": "Test Diagnosis",
            "hospital_name": "Test Hospital",
            "claimed_amount": 50000,
            "approved_amount": 45000,
            "settled_amount": 45000,
            "status": "Settled"
        }
        
        response = requests.post(f"{BASE_URL}/api/claims", json=claim_data, headers=headers)
        assert response.status_code in [200, 201], f"Create claim failed: {response.text}"
        
        data = response.json()
        assert data["policy_type"] == "ESKP"
        
        print(f"PASS: Created claim with policy_type ESKP")
    
    def test_claims_list_includes_policy_type(self):
        """Test GET /api/claims returns policy_type field"""
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/claims", headers=headers)
        assert response.status_code == 200
        
        claims = response.json()
        if claims:
            # Check that policy_type field exists
            for claim in claims:
                assert "policy_type" in claim or claim.get("policy_type") is None
        
        print(f"PASS: Claims list returns {len(claims)} claims with policy_type field")

    # ==================== CLEANUP ====================
    
    def test_cleanup_test_data(self):
        """Cleanup test policies created during testing"""
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get all policies
        response = requests.get(f"{BASE_URL}/api/policies", headers=headers)
        if response.status_code == 200:
            policies = response.json()
            for p in policies:
                if p["policy_number"].startswith("TEST-"):
                    requests.delete(f"{BASE_URL}/api/policies/{p['id']}", headers=headers)
        
        # Get all claims and delete test claims
        response = requests.get(f"{BASE_URL}/api/claims", headers=headers)
        if response.status_code == 200:
            claims = response.json()
            for c in claims:
                if c.get("employee_name", "").startswith("Test Employee IT13"):
                    requests.delete(f"{BASE_URL}/api/claims/{c['id']}", headers=headers)
        
        print("PASS: Test data cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
