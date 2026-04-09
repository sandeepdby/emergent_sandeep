"""
Iteration 14 Test Suite - InsureHub Portal
Tests for:
1. Admin Policies form with Policy Type (Group Health GMC, GTL, GPA, Group Accident, Group Term) + Family Definition (ESKP/ESK/E)
2. Policy creation with family_definition field
3. HR Policies Dashboard charts and family column
4. HR Claims Dashboard with Claims Ratio and Renewal Pricing
5. Audit Log page with filters and pagination
6. Audit log captures LOGIN, CREATE policy, CREATE claim actions
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthAndAuditLog:
    """Test authentication and audit log functionality"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "masteradmin",
            "password": "Admin@123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def hr_token(self):
        """Get HR user authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "hruser1",
            "password": "hr123456"
        })
        assert response.status_code == 200, f"HR login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_admin_login_creates_audit_entry(self, admin_token):
        """Test that admin login creates an audit log entry"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/audit-log", headers=headers, params={
            "action": "LOGIN",
            "limit": 10
        })
        assert response.status_code == 200, f"Failed to get audit log: {response.text}"
        data = response.json()
        assert "entries" in data
        assert "total" in data
        # Should have at least one LOGIN entry
        login_entries = [e for e in data["entries"] if e.get("action") == "LOGIN"]
        assert len(login_entries) > 0, "No LOGIN entries found in audit log"
        print(f"Found {len(login_entries)} LOGIN entries in audit log")
    
    def test_audit_log_endpoint_returns_paginated_results(self, admin_token):
        """Test GET /api/audit-log returns paginated results with filters"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/audit-log", headers=headers, params={
            "page": 1,
            "limit": 30
        })
        assert response.status_code == 200, f"Failed to get audit log: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "entries" in data, "Missing 'entries' in response"
        assert "total" in data, "Missing 'total' in response"
        assert "page" in data, "Missing 'page' in response"
        assert "pages" in data, "Missing 'pages' in response"
        
        # Verify entries have required fields
        if len(data["entries"]) > 0:
            entry = data["entries"][0]
            assert "timestamp" in entry, "Missing 'timestamp' in entry"
            assert "username" in entry, "Missing 'username' in entry"
            assert "role" in entry, "Missing 'role' in entry"
            assert "action" in entry, "Missing 'action' in entry"
            assert "resource" in entry, "Missing 'resource' in entry"
        
        print(f"Audit log has {data['total']} total entries, {data['pages']} pages")
    
    def test_audit_log_action_filter(self, admin_token):
        """Test audit log action filter works"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/audit-log", headers=headers, params={
            "action": "LOGIN"
        })
        assert response.status_code == 200
        data = response.json()
        
        # All entries should have action=LOGIN
        for entry in data["entries"]:
            assert entry["action"] == "LOGIN", f"Expected LOGIN action, got {entry['action']}"
        print(f"Action filter working - found {len(data['entries'])} LOGIN entries")
    
    def test_audit_log_resource_filter(self, admin_token):
        """Test audit log resource filter works"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/audit-log", headers=headers, params={
            "resource": "auth"
        })
        assert response.status_code == 200
        data = response.json()
        
        # All entries should have resource=auth
        for entry in data["entries"]:
            assert entry["resource"] == "auth", f"Expected auth resource, got {entry['resource']}"
        print(f"Resource filter working - found {len(data['entries'])} auth entries")
    
    def test_audit_log_username_search(self, admin_token):
        """Test audit log username search works"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/audit-log", headers=headers, params={
            "username": "masteradmin"
        })
        assert response.status_code == 200
        data = response.json()
        
        # All entries should contain masteradmin in username
        for entry in data["entries"]:
            assert "masteradmin" in entry["username"].lower(), f"Username filter not working: {entry['username']}"
        print(f"Username search working - found {len(data['entries'])} entries for masteradmin")
    
    def test_hr_cannot_access_audit_log(self, hr_token):
        """Test that HR users cannot access audit log"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BASE_URL}/api/audit-log", headers=headers)
        assert response.status_code == 403, f"HR should not access audit log, got {response.status_code}"
        print("HR correctly denied access to audit log")


class TestPoliciesWithFamilyDefinition:
    """Test policy creation with family_definition field"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "masteradmin",
            "password": "Admin@123"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_create_policy_with_family_definition(self, admin_token):
        """Test creating a policy with family_definition field"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        policy_data = {
            "policy_number": f"TEST-POL-{datetime.now().strftime('%H%M%S')}",
            "policy_holder_name": "Test Company Ltd",
            "policy_date": "2025-01-01",
            "policy_type": "Group Health",
            "family_definition": "ESKP",
            "premium": 500000,
            "employees_count": 50,
            "spouse_count": 40,
            "kids_count": 30,
            "parents_count": 20,
            "addition_lives": 5,
            "deletion_lives": 2,
            "status": "Active"
        }
        
        response = requests.post(f"{BASE_URL}/api/policies", headers=headers, json=policy_data)
        assert response.status_code == 200, f"Failed to create policy: {response.text}"
        
        data = response.json()
        assert data["policy_type"] == "Group Health", f"Expected Group Health, got {data['policy_type']}"
        assert data["family_definition"] == "ESKP", f"Expected ESKP, got {data['family_definition']}"
        assert data["total_lives_count"] == 140, f"Expected 140 total lives, got {data['total_lives_count']}"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/policies/{data['id']}", headers=headers)
        print(f"Policy created with family_definition=ESKP, total_lives=140")
    
    def test_policy_types_enum_values(self, admin_token):
        """Test that all policy types are accepted"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        policy_types = ["Group Health", "GTL", "GPA", "Group Accident", "Group Term"]
        
        for ptype in policy_types:
            policy_data = {
                "policy_number": f"TEST-{ptype.replace(' ', '')[:5]}-{datetime.now().strftime('%H%M%S%f')[:8]}",
                "policy_holder_name": f"Test {ptype}",
                "policy_type": ptype,
                "family_definition": "ESK",
                "premium": 100000,
                "employees_count": 10,
                "status": "Active"
            }
            
            response = requests.post(f"{BASE_URL}/api/policies", headers=headers, json=policy_data)
            assert response.status_code == 200, f"Failed to create policy with type {ptype}: {response.text}"
            
            data = response.json()
            assert data["policy_type"] == ptype, f"Expected {ptype}, got {data['policy_type']}"
            
            # Cleanup
            requests.delete(f"{BASE_URL}/api/policies/{data['id']}", headers=headers)
            print(f"Policy type '{ptype}' accepted")
    
    def test_family_definition_enum_values(self, admin_token):
        """Test that all family definition values are accepted"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        family_defs = ["ESKP", "ESK", "E"]
        
        for fdef in family_defs:
            policy_data = {
                "policy_number": f"TEST-{fdef}-{datetime.now().strftime('%H%M%S%f')[:8]}",
                "policy_holder_name": f"Test {fdef}",
                "policy_type": "Group Health",
                "family_definition": fdef,
                "premium": 100000,
                "employees_count": 10,
                "status": "Active"
            }
            
            response = requests.post(f"{BASE_URL}/api/policies", headers=headers, json=policy_data)
            assert response.status_code == 200, f"Failed to create policy with family_definition {fdef}: {response.text}"
            
            data = response.json()
            assert data["family_definition"] == fdef, f"Expected {fdef}, got {data['family_definition']}"
            
            # Cleanup
            requests.delete(f"{BASE_URL}/api/policies/{data['id']}", headers=headers)
            print(f"Family definition '{fdef}' accepted")
    
    def test_policy_creation_creates_audit_entry(self, admin_token):
        """Test that policy creation creates an audit log entry"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a policy
        policy_data = {
            "policy_number": f"TEST-AUDIT-{datetime.now().strftime('%H%M%S')}",
            "policy_holder_name": "Audit Test Company",
            "policy_type": "Group Health",
            "family_definition": "ESKP",
            "premium": 100000,
            "employees_count": 10,
            "status": "Active"
        }
        
        response = requests.post(f"{BASE_URL}/api/policies", headers=headers, json=policy_data)
        assert response.status_code == 200
        policy_id = response.json()["id"]
        
        # Check audit log for CREATE policy entry
        audit_response = requests.get(f"{BASE_URL}/api/audit-log", headers=headers, params={
            "action": "CREATE",
            "resource": "policy",
            "limit": 10
        })
        assert audit_response.status_code == 200
        audit_data = audit_response.json()
        
        # Should have at least one CREATE policy entry
        create_entries = [e for e in audit_data["entries"] if e.get("action") == "CREATE" and e.get("resource") == "policy"]
        assert len(create_entries) > 0, "No CREATE policy entries found in audit log"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/policies/{policy_id}", headers=headers)
        print(f"Policy creation audit entry verified")


class TestPoliciesAnalytics:
    """Test policies analytics endpoint for HR dashboard"""
    
    @pytest.fixture(scope="class")
    def hr_token(self):
        """Get HR user authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "hruser1",
            "password": "hr123456"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_policies_analytics_returns_family_definition(self, hr_token):
        """Test GET /api/policies-analytics returns family_definition in policies array"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BASE_URL}/api/policies-analytics", headers=headers)
        assert response.status_code == 200, f"Failed to get policies analytics: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "total_policies" in data
        assert "active_policies" in data
        assert "total_employees" in data
        assert "total_spouse" in data
        assert "total_kids" in data
        assert "total_parents" in data
        assert "total_lives" in data
        assert "total_premium" in data
        assert "total_addition_lives" in data
        assert "total_deletion_lives" in data
        assert "type_breakdown" in data
        assert "policies" in data
        
        # Check that policies array includes family_definition
        if len(data["policies"]) > 0:
            policy = data["policies"][0]
            assert "family_definition" in policy, "Missing family_definition in policy"
            assert "policy_type" in policy, "Missing policy_type in policy"
            print(f"First policy: type={policy['policy_type']}, family_def={policy['family_definition']}")
        
        print(f"Policies analytics: {data['total_policies']} policies, {data['total_lives']} lives, {data['total_premium']} premium")


class TestClaimsAnalytics:
    """Test claims analytics endpoint for HR dashboard"""
    
    @pytest.fixture(scope="class")
    def hr_token(self):
        """Get HR user authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "hruser1",
            "password": "hr123456"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_claims_analytics_returns_all_metrics(self, hr_token):
        """Test GET /api/claims-analytics returns all required metrics"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BASE_URL}/api/claims-analytics", headers=headers)
        assert response.status_code == 200, f"Failed to get claims analytics: {response.text}"
        
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
            assert field in data, f"Missing field: {field}"
        
        print(f"Claims analytics: {data['total_claims']} claims, ratio={data['claims_ratio']}%, renewal={data['renewal_expected_pricing']}")
    
    def test_claims_ratio_calculation(self, hr_token):
        """Test that claims_ratio is calculated as Claims/Premium * 100"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BASE_URL}/api/claims-analytics", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify claims ratio calculation
        if data["total_premium"] > 0:
            expected_ratio = round((data["total_claimed_amount"] / data["total_premium"]) * 100, 2)
            assert abs(data["claims_ratio"] - expected_ratio) < 0.1, f"Claims ratio mismatch: expected {expected_ratio}, got {data['claims_ratio']}"
            print(f"Claims ratio verified: {data['claims_ratio']}% (claims={data['total_claimed_amount']}, premium={data['total_premium']})")
        else:
            print("No premium data to verify claims ratio calculation")
    
    def test_renewal_pricing_calculation(self, hr_token):
        """Test that renewal_expected_pricing is calculated as Claims * 1.30"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BASE_URL}/api/claims-analytics", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify renewal pricing calculation
        expected_renewal = round(data["total_claimed_amount"] * 1.30, 2)
        assert abs(data["renewal_expected_pricing"] - expected_renewal) < 1, f"Renewal pricing mismatch: expected {expected_renewal}, got {data['renewal_expected_pricing']}"
        print(f"Renewal pricing verified: {data['renewal_expected_pricing']} (claims * 1.30 = {expected_renewal})")


class TestClaimCreationAudit:
    """Test that claim creation creates audit log entry"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "masteradmin",
            "password": "Admin@123"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_claim_creation_creates_audit_entry(self, admin_token):
        """Test that claim creation creates an audit log entry"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get a policy number first
        policies_response = requests.get(f"{BASE_URL}/api/policies", headers=headers)
        if policies_response.status_code != 200 or len(policies_response.json()) == 0:
            pytest.skip("No policies available to create claim")
        
        policy_number = policies_response.json()[0]["policy_number"]
        
        # Create a claim
        claim_data = {
            "claim_number": f"CLM-AUDIT-{datetime.now().strftime('%H%M%S')}",
            "policy_number": policy_number,
            "employee_id": "EMP-AUDIT-001",
            "employee_name": "Audit Test Employee",
            "patient_name": "Audit Test Patient",
            "relationship": "Employee",
            "claim_type": "Reimbursement",
            "claimed_amount": 50000,
            "settled_amount": 0,
            "status": "Submitted",
            "admission_date": "2025-01-01",
            "discharge_date": "2025-01-05",
            "hospital_name": "Test Hospital",
            "diagnosis": "Test Diagnosis"
        }
        
        response = requests.post(f"{BASE_URL}/api/claims", headers=headers, json=claim_data)
        assert response.status_code == 200, f"Failed to create claim: {response.text}"
        claim_id = response.json()["id"]
        
        # Check audit log for CREATE claim entry
        audit_response = requests.get(f"{BASE_URL}/api/audit-log", headers=headers, params={
            "action": "CREATE",
            "resource": "claim",
            "limit": 10
        })
        assert audit_response.status_code == 200
        audit_data = audit_response.json()
        
        # Should have at least one CREATE claim entry
        create_entries = [e for e in audit_data["entries"] if e.get("action") == "CREATE" and e.get("resource") == "claim"]
        assert len(create_entries) > 0, "No CREATE claim entries found in audit log"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/claims/{claim_id}", headers=headers)
        print(f"Claim creation audit entry verified")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
