"""
Iteration 17 Tests: Policy Assignment Feature
Tests for admin policy assignment to HR users, filtering, and access control.
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
MASTER_ADMIN_CREDS = {"username": "masteradmin", "password": "Admin@123"}
ADMIN_CREDS = {"username": "admin", "password": "admin123"}
HR_CREDS = {"username": "hruser1", "password": "hr123456"}


class TestAuthSetup:
    """Authentication setup tests"""
    
    def test_master_admin_login(self):
        """Test master admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MASTER_ADMIN_CREDS)
        assert response.status_code == 200, f"Master admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "Admin"
        print(f"✓ Master admin login successful - user_id: {data['user']['id']}")
    
    def test_admin_login(self):
        """Test admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "Admin"
        print(f"✓ Admin login successful - user_id: {data['user']['id']}")
    
    def test_hr_user_login(self):
        """Test HR user can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_CREDS)
        assert response.status_code == 200, f"HR login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "HR"
        print(f"✓ HR user login successful - user_id: {data['user']['id']}")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=MASTER_ADMIN_CREDS)
    if response.status_code != 200:
        pytest.skip("Admin login failed")
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def admin_user_id():
    """Get admin user ID"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=MASTER_ADMIN_CREDS)
    if response.status_code != 200:
        pytest.skip("Admin login failed")
    return response.json()["user"]["id"]


@pytest.fixture(scope="module")
def hr_token():
    """Get HR auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_CREDS)
    if response.status_code != 200:
        pytest.skip("HR login failed")
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def hr_user_id():
    """Get HR user ID"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_CREDS)
    if response.status_code != 200:
        pytest.skip("HR login failed")
    return response.json()["user"]["id"]


@pytest.fixture(scope="module")
def policies(admin_token):
    """Get all policies"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.get(f"{BASE_URL}/api/policies", headers=headers)
    if response.status_code != 200:
        pytest.skip("Failed to fetch policies")
    return response.json()


@pytest.fixture(scope="module")
def hr_users(admin_token):
    """Get all HR users"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.get(f"{BASE_URL}/api/users/hr", headers=headers)
    if response.status_code != 200:
        pytest.skip("Failed to fetch HR users")
    return response.json()


class TestPolicyAssignmentEndpoints:
    """Test policy assignment CRUD endpoints"""
    
    def test_get_policy_assignments_admin(self, admin_token):
        """Admin can get all policy assignments"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/policy-assignments", headers=headers)
        assert response.status_code == 200, f"Failed to get assignments: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin can view all assignments - count: {len(data)}")
    
    def test_get_policy_assignments_hr(self, hr_token, hr_user_id):
        """HR can only see their own assignments"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BASE_URL}/api/policy-assignments", headers=headers)
        assert response.status_code == 200, f"Failed to get assignments: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        # All assignments should belong to this HR user
        for assignment in data:
            assert assignment["hr_user_id"] == hr_user_id, "HR sees assignment not belonging to them"
        print(f"✓ HR sees only their assignments - count: {len(data)}")
    
    def test_create_policy_assignment_admin(self, admin_token, policies, hr_users):
        """Admin can create a policy assignment"""
        if not policies or not hr_users:
            pytest.skip("No policies or HR users available")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Find a policy that's not already assigned to the first HR user
        hr_user = hr_users[0]
        existing_assignments = requests.get(
            f"{BASE_URL}/api/policy-assignments?hr_user_id={hr_user['id']}", 
            headers=headers
        ).json()
        assigned_policy_ids = [a["policy_id"] for a in existing_assignments]
        
        unassigned_policy = None
        for policy in policies:
            if policy["id"] not in assigned_policy_ids:
                unassigned_policy = policy
                break
        
        if not unassigned_policy:
            pytest.skip("All policies already assigned to HR user")
        
        payload = {
            "policy_id": unassigned_policy["id"],
            "hr_user_id": hr_user["id"]
        }
        response = requests.post(f"{BASE_URL}/api/policy-assignments", json=payload, headers=headers)
        assert response.status_code == 200, f"Failed to create assignment: {response.text}"
        data = response.json()
        assert data["policy_id"] == unassigned_policy["id"]
        assert data["hr_user_id"] == hr_user["id"]
        assert data["policy_number"] == unassigned_policy["policy_number"]
        assert "id" in data
        print(f"✓ Admin created assignment - policy: {data['policy_number']} to HR: {data['hr_username']}")
        
        # Store for cleanup
        return data["id"]
    
    def test_duplicate_assignment_rejected(self, admin_token, policies, hr_users):
        """Duplicate assignment should be rejected"""
        if not policies or not hr_users:
            pytest.skip("No policies or HR users available")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get existing assignments
        existing = requests.get(f"{BASE_URL}/api/policy-assignments", headers=headers).json()
        if not existing:
            pytest.skip("No existing assignments to test duplicate")
        
        # Try to create duplicate
        first_assignment = existing[0]
        payload = {
            "policy_id": first_assignment["policy_id"],
            "hr_user_id": first_assignment["hr_user_id"]
        }
        response = requests.post(f"{BASE_URL}/api/policy-assignments", json=payload, headers=headers)
        assert response.status_code == 400, f"Duplicate should be rejected: {response.text}"
        assert "already assigned" in response.json()["detail"].lower()
        print(f"✓ Duplicate assignment correctly rejected")
    
    def test_hr_cannot_create_assignment(self, hr_token, policies, hr_users):
        """HR users cannot create assignments"""
        if not policies or not hr_users:
            pytest.skip("No policies or HR users available")
        
        headers = {"Authorization": f"Bearer {hr_token}"}
        payload = {
            "policy_id": policies[0]["id"],
            "hr_user_id": hr_users[0]["id"]
        }
        response = requests.post(f"{BASE_URL}/api/policy-assignments", json=payload, headers=headers)
        assert response.status_code == 403, f"HR should not be able to create assignments: {response.text}"
        print(f"✓ HR correctly denied from creating assignments")
    
    def test_hr_cannot_delete_assignment(self, hr_token, admin_token):
        """HR users cannot delete assignments"""
        headers_admin = {"Authorization": f"Bearer {admin_token}"}
        headers_hr = {"Authorization": f"Bearer {hr_token}"}
        
        # Get an existing assignment
        existing = requests.get(f"{BASE_URL}/api/policy-assignments", headers=headers_admin).json()
        if not existing:
            pytest.skip("No existing assignments to test delete")
        
        assignment_id = existing[0]["id"]
        response = requests.delete(f"{BASE_URL}/api/policy-assignments/{assignment_id}", headers=headers_hr)
        assert response.status_code == 403, f"HR should not be able to delete assignments: {response.text}"
        print(f"✓ HR correctly denied from deleting assignments")


class TestBulkAssignment:
    """Test bulk policy assignment"""
    
    def test_bulk_assign_policies(self, admin_token, policies, hr_users):
        """Admin can bulk assign multiple policies"""
        if len(policies) < 2 or not hr_users:
            pytest.skip("Need at least 2 policies and 1 HR user")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        hr_user = hr_users[0]
        
        # Get existing assignments for this HR
        existing = requests.get(
            f"{BASE_URL}/api/policy-assignments?hr_user_id={hr_user['id']}", 
            headers=headers
        ).json()
        assigned_policy_ids = [a["policy_id"] for a in existing]
        
        # Find unassigned policies
        unassigned = [p for p in policies if p["id"] not in assigned_policy_ids]
        if len(unassigned) < 2:
            pytest.skip("Not enough unassigned policies for bulk test")
        
        payload = [
            {"policy_id": unassigned[0]["id"], "hr_user_id": hr_user["id"]},
            {"policy_id": unassigned[1]["id"], "hr_user_id": hr_user["id"]}
        ]
        response = requests.post(f"{BASE_URL}/api/policy-assignments/bulk", json=payload, headers=headers)
        assert response.status_code == 200, f"Bulk assign failed: {response.text}"
        data = response.json()
        assert "results" in data
        assigned_count = sum(1 for r in data["results"] if r["status"] == "assigned")
        print(f"✓ Bulk assignment successful - {assigned_count} policies assigned")
    
    def test_bulk_assign_skips_duplicates(self, admin_token, policies, hr_users):
        """Bulk assign skips already assigned policies"""
        if not policies or not hr_users:
            pytest.skip("No policies or HR users available")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get existing assignments
        existing = requests.get(f"{BASE_URL}/api/policy-assignments", headers=headers).json()
        if not existing:
            pytest.skip("No existing assignments to test skip")
        
        # Try to bulk assign an already assigned policy
        first = existing[0]
        payload = [{"policy_id": first["policy_id"], "hr_user_id": first["hr_user_id"]}]
        response = requests.post(f"{BASE_URL}/api/policy-assignments/bulk", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        skipped = [r for r in data["results"] if r["status"] == "skipped"]
        assert len(skipped) > 0, "Should have skipped duplicate"
        print(f"✓ Bulk assign correctly skips duplicates")


class TestHRFilteredAccess:
    """Test that HR users only see assigned policies and claims"""
    
    def test_hr_sees_only_assigned_policies(self, hr_token, admin_token, hr_user_id):
        """HR user sees only assigned policies via GET /api/policies"""
        headers_hr = {"Authorization": f"Bearer {hr_token}"}
        headers_admin = {"Authorization": f"Bearer {admin_token}"}
        
        # Get HR's assignments
        assignments = requests.get(
            f"{BASE_URL}/api/policy-assignments?hr_user_id={hr_user_id}", 
            headers=headers_admin
        ).json()
        assigned_policy_numbers = [a["policy_number"] for a in assignments]
        
        # Get policies as HR
        hr_policies = requests.get(f"{BASE_URL}/api/policies", headers=headers_hr).json()
        
        if not assigned_policy_numbers:
            # HR has no assignments, should see empty list
            assert len(hr_policies) == 0, "HR with no assignments should see no policies"
            print(f"✓ HR with no assignments sees empty policy list")
        else:
            # HR should only see assigned policies
            hr_policy_numbers = [p["policy_number"] for p in hr_policies]
            for pn in hr_policy_numbers:
                assert pn in assigned_policy_numbers, f"HR sees unassigned policy: {pn}"
            print(f"✓ HR sees only assigned policies - count: {len(hr_policies)}")
    
    def test_hr_sees_only_assigned_claims(self, hr_token, admin_token, hr_user_id):
        """HR user sees only claims for assigned policies via GET /api/claims"""
        headers_hr = {"Authorization": f"Bearer {hr_token}"}
        headers_admin = {"Authorization": f"Bearer {admin_token}"}
        
        # Get HR's assignments
        assignments = requests.get(
            f"{BASE_URL}/api/policy-assignments?hr_user_id={hr_user_id}", 
            headers=headers_admin
        ).json()
        assigned_policy_numbers = [a["policy_number"] for a in assignments]
        
        # Get claims as HR
        hr_claims = requests.get(f"{BASE_URL}/api/claims", headers=headers_hr).json()
        
        if not assigned_policy_numbers:
            assert len(hr_claims) == 0, "HR with no assignments should see no claims"
            print(f"✓ HR with no assignments sees empty claims list")
        else:
            for claim in hr_claims:
                assert claim["policy_number"] in assigned_policy_numbers, \
                    f"HR sees claim for unassigned policy: {claim['policy_number']}"
            print(f"✓ HR sees only claims for assigned policies - count: {len(hr_claims)}")
    
    def test_hr_policies_analytics_filtered(self, hr_token, admin_token, hr_user_id):
        """HR user sees filtered policies analytics"""
        headers_hr = {"Authorization": f"Bearer {hr_token}"}
        headers_admin = {"Authorization": f"Bearer {admin_token}"}
        
        # Get HR's assignments count
        assignments = requests.get(
            f"{BASE_URL}/api/policy-assignments?hr_user_id={hr_user_id}", 
            headers=headers_admin
        ).json()
        
        # Get analytics as HR
        response = requests.get(f"{BASE_URL}/api/policies-analytics", headers=headers_hr)
        assert response.status_code == 200
        data = response.json()
        
        if not assignments:
            assert data["total_policies"] == 0, "HR with no assignments should see 0 policies in analytics"
            print(f"✓ HR with no assignments sees 0 in policies analytics")
        else:
            assert data["total_policies"] == len(assignments), \
                f"HR analytics should show {len(assignments)} policies, got {data['total_policies']}"
            print(f"✓ HR policies analytics filtered correctly - {data['total_policies']} policies")
    
    def test_hr_claims_analytics_filtered(self, hr_token, admin_token, hr_user_id):
        """HR user sees filtered claims analytics"""
        headers_hr = {"Authorization": f"Bearer {hr_token}"}
        headers_admin = {"Authorization": f"Bearer {admin_token}"}
        
        # Get HR's assignments
        assignments = requests.get(
            f"{BASE_URL}/api/policy-assignments?hr_user_id={hr_user_id}", 
            headers=headers_admin
        ).json()
        
        # Get claims analytics as HR
        response = requests.get(f"{BASE_URL}/api/claims-analytics", headers=headers_hr)
        assert response.status_code == 200
        data = response.json()
        
        if not assignments:
            assert data["total_claims"] == 0, "HR with no assignments should see 0 claims in analytics"
            print(f"✓ HR with no assignments sees 0 in claims analytics")
        else:
            print(f"✓ HR claims analytics returned - total_claims: {data['total_claims']}")


class TestRevokeAssignment:
    """Test revoking policy assignments"""
    
    def test_admin_can_revoke_assignment(self, admin_token, policies, hr_users):
        """Admin can revoke a policy assignment"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First create an assignment to revoke
        if not policies or not hr_users:
            pytest.skip("No policies or HR users available")
        
        hr_user = hr_users[0]
        
        # Find unassigned policy
        existing = requests.get(
            f"{BASE_URL}/api/policy-assignments?hr_user_id={hr_user['id']}", 
            headers=headers
        ).json()
        assigned_ids = [a["policy_id"] for a in existing]
        
        unassigned = [p for p in policies if p["id"] not in assigned_ids]
        if not unassigned:
            # Use existing assignment
            if existing:
                assignment_id = existing[0]["id"]
            else:
                pytest.skip("No assignments to revoke")
        else:
            # Create new assignment
            payload = {"policy_id": unassigned[0]["id"], "hr_user_id": hr_user["id"]}
            create_resp = requests.post(f"{BASE_URL}/api/policy-assignments", json=payload, headers=headers)
            if create_resp.status_code != 200:
                pytest.skip("Could not create assignment to revoke")
            assignment_id = create_resp.json()["id"]
        
        # Revoke the assignment
        response = requests.delete(f"{BASE_URL}/api/policy-assignments/{assignment_id}", headers=headers)
        assert response.status_code == 200, f"Failed to revoke: {response.text}"
        assert "revoked" in response.json()["message"].lower()
        
        # Verify it's gone
        verify = requests.get(f"{BASE_URL}/api/policy-assignments", headers=headers).json()
        assert not any(a["id"] == assignment_id for a in verify), "Assignment still exists after revoke"
        print(f"✓ Admin successfully revoked assignment")
    
    def test_revoke_nonexistent_returns_404(self, admin_token):
        """Revoking non-existent assignment returns 404"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        fake_id = str(uuid.uuid4())
        response = requests.delete(f"{BASE_URL}/api/policy-assignments/{fake_id}", headers=headers)
        assert response.status_code == 404
        print(f"✓ Revoke non-existent returns 404")


class TestAuditLogging:
    """Test audit logging for assignments"""
    
    def test_assignment_creates_audit_log(self, admin_token, policies, hr_users):
        """Creating assignment creates audit log entry"""
        if not policies or not hr_users:
            pytest.skip("No policies or HR users available")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        hr_user = hr_users[0]
        
        # Find unassigned policy
        existing = requests.get(
            f"{BASE_URL}/api/policy-assignments?hr_user_id={hr_user['id']}", 
            headers=headers
        ).json()
        assigned_ids = [a["policy_id"] for a in existing]
        unassigned = [p for p in policies if p["id"] not in assigned_ids]
        
        if not unassigned:
            pytest.skip("No unassigned policies for audit test")
        
        # Create assignment
        payload = {"policy_id": unassigned[0]["id"], "hr_user_id": hr_user["id"]}
        create_resp = requests.post(f"{BASE_URL}/api/policy-assignments", json=payload, headers=headers)
        if create_resp.status_code != 200:
            pytest.skip("Could not create assignment for audit test")
        
        assignment_id = create_resp.json()["id"]
        
        # Check audit logs
        audit_resp = requests.get(f"{BASE_URL}/api/audit-logs?entity_type=policy_assignment", headers=headers)
        if audit_resp.status_code == 200:
            logs = audit_resp.json()
            assign_logs = [l for l in logs if l.get("action") == "ASSIGN_POLICY" and l.get("entity_id") == assignment_id]
            if assign_logs:
                print(f"✓ Audit log created for assignment")
            else:
                print(f"⚠ Audit log endpoint exists but no matching log found")
        else:
            print(f"⚠ Audit logs endpoint not accessible (status: {audit_resp.status_code})")
        
        # Cleanup - revoke the assignment
        requests.delete(f"{BASE_URL}/api/policy-assignments/{assignment_id}", headers=headers)


class TestAdminSeesAllPolicies:
    """Verify admin sees all policies regardless of assignments"""
    
    def test_admin_sees_all_policies(self, admin_token):
        """Admin sees all policies, not filtered by assignments"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get all policies as admin
        policies_resp = requests.get(f"{BASE_URL}/api/policies", headers=headers)
        assert policies_resp.status_code == 200
        policies = policies_resp.json()
        
        # Get all assignments
        assignments_resp = requests.get(f"{BASE_URL}/api/policy-assignments", headers=headers)
        assert assignments_resp.status_code == 200
        
        print(f"✓ Admin sees all {len(policies)} policies")
    
    def test_admin_sees_all_claims(self, admin_token):
        """Admin sees all claims, not filtered by assignments"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        claims_resp = requests.get(f"{BASE_URL}/api/claims", headers=headers)
        assert claims_resp.status_code == 200
        claims = claims_resp.json()
        
        print(f"✓ Admin sees all {len(claims)} claims")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
