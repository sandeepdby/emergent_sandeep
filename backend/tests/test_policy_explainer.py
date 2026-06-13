"""
Test suite for Policy Explainer & Benchmarking feature (Iteration 22)
Tests:
- GET /api/policy-benchmarks - returns seeded benchmarks (8 total)
- POST /api/policy-benchmarks - Admin can create new benchmark
- PUT /api/policy-benchmarks/{id} - Admin can update benchmark
- DELETE /api/policy-benchmarks/{id} - Admin can delete benchmark
- POST /api/policy-explainer/explain - AI generates T&C explanation
- POST /api/policy-explainer/compare - AI compares 2+ policies
- POST /api/policy-explainer/upload-pdf - Upload PDF for AI analysis
- HR user access to benchmarks and explainer (not admin-only)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDS = {"username": "masteradmin", "password": "Admin@123"}
HR_CREDS = {"username": "arpita", "password": "Password@123"}


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin authentication failed")


@pytest.fixture(scope="module")
def hr_token():
    """Get HR user authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_CREDS)
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("HR authentication failed")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Admin auth headers"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def hr_headers(hr_token):
    """HR auth headers"""
    return {"Authorization": f"Bearer {hr_token}", "Content-Type": "application/json"}


class TestPolicyBenchmarksGet:
    """Test GET /api/policy-benchmarks endpoint"""

    def test_get_benchmarks_returns_seeded_data(self, admin_headers):
        """Verify seeded benchmarks are returned (8 total)"""
        response = requests.get(f"{BASE_URL}/api/policy-benchmarks", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 8, f"Expected at least 8 benchmarks, got {len(data)}"
        
        # Verify benchmark structure
        for benchmark in data:
            assert "id" in benchmark
            assert "policy_type" in benchmark
            assert "insurer_name" in benchmark
            assert "plan_name" in benchmark
            assert "parameters" in benchmark
            assert "is_active" in benchmark

    def test_get_benchmarks_has_correct_policy_types(self, admin_headers):
        """Verify benchmarks include all 3 policy types"""
        response = requests.get(f"{BASE_URL}/api/policy-benchmarks", headers=admin_headers)
        assert response.status_code == 200
        
        data = response.json()
        policy_types = set(b["policy_type"] for b in data)
        
        assert "Group Health" in policy_types, "Missing Group Health benchmarks"
        assert "Group Term" in policy_types, "Missing Group Term benchmarks"
        assert "Group Accident" in policy_types, "Missing Group Accident benchmarks"

    def test_get_benchmarks_has_aarogya_addon(self, admin_headers):
        """Verify Aarogya Assist wellness add-on is present"""
        response = requests.get(f"{BASE_URL}/api/policy-benchmarks", headers=admin_headers)
        assert response.status_code == 200
        
        data = response.json()
        aarogya_addons = [b for b in data if b.get("is_aarogya_addon") == True]
        
        assert len(aarogya_addons) >= 1, "Expected at least 1 Aarogya Assist add-on"
        assert aarogya_addons[0]["insurer_name"] == "Aarogya Assist"

    def test_get_benchmarks_filter_by_policy_type(self, admin_headers):
        """Test filtering benchmarks by policy_type"""
        response = requests.get(
            f"{BASE_URL}/api/policy-benchmarks?policy_type=Group Health",
            headers=admin_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) >= 3, "Expected at least 3 Group Health benchmarks"
        for b in data:
            assert b["policy_type"] == "Group Health"

    def test_hr_can_access_benchmarks(self, hr_headers):
        """HR users should be able to access benchmarks (not admin-only)"""
        response = requests.get(f"{BASE_URL}/api/policy-benchmarks", headers=hr_headers)
        assert response.status_code == 200, f"HR should access benchmarks, got {response.status_code}"
        
        data = response.json()
        assert len(data) >= 8, "HR should see all benchmarks"

    def test_unauthenticated_blocked(self):
        """Unauthenticated requests should be blocked"""
        response = requests.get(f"{BASE_URL}/api/policy-benchmarks")
        assert response.status_code in [401, 403], "Unauthenticated should be blocked"


class TestPolicyBenchmarksCRUD:
    """Test CRUD operations for policy benchmarks (Admin only)"""

    def test_admin_create_benchmark(self, admin_headers):
        """Admin can create a new benchmark"""
        payload = {
            "policy_type": "Group Health",
            "insurer_name": "TEST_Insurer",
            "plan_name": "TEST_Plan",
            "parameters": {"sum_insured": "5L", "room_rent": "No limit"},
            "is_aarogya_addon": False,
            "is_active": True
        }
        response = requests.post(
            f"{BASE_URL}/api/policy-benchmarks",
            json=payload,
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["insurer_name"] == "TEST_Insurer"
        assert data["plan_name"] == "TEST_Plan"
        assert "id" in data
        
        # Store ID for cleanup
        TestPolicyBenchmarksCRUD.created_benchmark_id = data["id"]

    def test_admin_update_benchmark(self, admin_headers):
        """Admin can update an existing benchmark"""
        benchmark_id = getattr(TestPolicyBenchmarksCRUD, 'created_benchmark_id', None)
        if not benchmark_id:
            pytest.skip("No benchmark created to update")
        
        payload = {
            "policy_type": "Group Health",
            "insurer_name": "TEST_Insurer_Updated",
            "plan_name": "TEST_Plan_Updated",
            "parameters": {"sum_insured": "10L", "room_rent": "No limit", "copay": "Nil"},
            "is_aarogya_addon": False,
            "is_active": True
        }
        response = requests.put(
            f"{BASE_URL}/api/policy-benchmarks/{benchmark_id}",
            json=payload,
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["insurer_name"] == "TEST_Insurer_Updated"
        assert data["plan_name"] == "TEST_Plan_Updated"
        assert data["parameters"]["sum_insured"] == "10L"

    def test_admin_delete_benchmark(self, admin_headers):
        """Admin can delete a benchmark"""
        benchmark_id = getattr(TestPolicyBenchmarksCRUD, 'created_benchmark_id', None)
        if not benchmark_id:
            pytest.skip("No benchmark created to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/policy-benchmarks/{benchmark_id}",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/policy-benchmarks", headers=admin_headers)
        data = get_response.json()
        ids = [b["id"] for b in data]
        assert benchmark_id not in ids, "Deleted benchmark should not appear in list"

    def test_hr_cannot_create_benchmark(self, hr_headers):
        """HR users should NOT be able to create benchmarks"""
        payload = {
            "policy_type": "Group Health",
            "insurer_name": "HR_TEST_Insurer",
            "plan_name": "HR_TEST_Plan",
            "parameters": {},
            "is_aarogya_addon": False,
            "is_active": True
        }
        response = requests.post(
            f"{BASE_URL}/api/policy-benchmarks",
            json=payload,
            headers=hr_headers
        )
        assert response.status_code == 403, f"HR should be forbidden, got {response.status_code}"

    def test_hr_cannot_update_benchmark(self, hr_headers, admin_headers):
        """HR users should NOT be able to update benchmarks"""
        # Get a benchmark ID first
        get_response = requests.get(f"{BASE_URL}/api/policy-benchmarks", headers=admin_headers)
        benchmarks = get_response.json()
        if not benchmarks:
            pytest.skip("No benchmarks to test update")
        
        benchmark_id = benchmarks[0]["id"]
        payload = {
            "policy_type": "Group Health",
            "insurer_name": "HR_MODIFIED",
            "plan_name": "HR_MODIFIED",
            "parameters": {},
            "is_aarogya_addon": False,
            "is_active": True
        }
        response = requests.put(
            f"{BASE_URL}/api/policy-benchmarks/{benchmark_id}",
            json=payload,
            headers=hr_headers
        )
        assert response.status_code == 403, f"HR should be forbidden, got {response.status_code}"

    def test_hr_cannot_delete_benchmark(self, hr_headers, admin_headers):
        """HR users should NOT be able to delete benchmarks"""
        get_response = requests.get(f"{BASE_URL}/api/policy-benchmarks", headers=admin_headers)
        benchmarks = get_response.json()
        if not benchmarks:
            pytest.skip("No benchmarks to test delete")
        
        benchmark_id = benchmarks[0]["id"]
        response = requests.delete(
            f"{BASE_URL}/api/policy-benchmarks/{benchmark_id}",
            headers=hr_headers
        )
        assert response.status_code == 403, f"HR should be forbidden, got {response.status_code}"


class TestPolicyExplainer:
    """Test POST /api/policy-explainer/explain endpoint"""

    def test_explain_group_health(self, admin_headers):
        """AI generates T&C explanation for Group Health"""
        payload = {
            "policy_type": "Group Health",
            "focus_area": None
        }
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/explain",
            json=payload,
            headers=admin_headers,
            timeout=60  # AI calls may take time
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["policy_type"] == "Group Health"
        assert "explanation" in data
        assert len(data["explanation"]) > 100, "Explanation should be substantial"
        assert "benchmarks_count" in data

    def test_explain_with_focus_area(self, admin_headers):
        """AI generates focused explanation on specific topic"""
        payload = {
            "policy_type": "Group Term",
            "focus_area": "exclusions"
        }
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/explain",
            json=payload,
            headers=admin_headers,
            timeout=60
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["policy_type"] == "Group Term"
        assert data["focus_area"] == "exclusions"
        assert "explanation" in data

    def test_explain_group_accident(self, admin_headers):
        """AI generates T&C explanation for Group Accident"""
        payload = {
            "policy_type": "Group Accident",
            "focus_area": "claims process"
        }
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/explain",
            json=payload,
            headers=admin_headers,
            timeout=60
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["policy_type"] == "Group Accident"
        assert "explanation" in data

    def test_hr_can_access_explainer(self, hr_headers):
        """HR users should be able to use the explainer (not admin-only)"""
        payload = {
            "policy_type": "Group Health",
            "focus_area": None
        }
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/explain",
            json=payload,
            headers=hr_headers,
            timeout=60
        )
        assert response.status_code == 200, f"HR should access explainer, got {response.status_code}"


class TestPolicyCompare:
    """Test POST /api/policy-explainer/compare endpoint"""

    def test_compare_two_policies(self, admin_headers):
        """AI compares 2 policies side-by-side"""
        # Get benchmark IDs first
        get_response = requests.get(f"{BASE_URL}/api/policy-benchmarks", headers=admin_headers)
        benchmarks = get_response.json()
        
        # Get 2 Group Health benchmarks
        health_benchmarks = [b for b in benchmarks if b["policy_type"] == "Group Health" and not b.get("is_aarogya_addon")]
        if len(health_benchmarks) < 2:
            pytest.skip("Not enough benchmarks to compare")
        
        benchmark_ids = [health_benchmarks[0]["id"], health_benchmarks[1]["id"]]
        
        payload = {"benchmark_ids": benchmark_ids}
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/compare",
            json=payload,
            headers=admin_headers,
            timeout=60
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "policies_compared" in data
        assert len(data["policies_compared"]) == 2
        assert "comparison" in data
        assert len(data["comparison"]) > 100, "Comparison should be substantial"

    def test_compare_requires_minimum_two(self, admin_headers):
        """Compare endpoint requires at least 2 policies"""
        get_response = requests.get(f"{BASE_URL}/api/policy-benchmarks", headers=admin_headers)
        benchmarks = get_response.json()
        
        payload = {"benchmark_ids": [benchmarks[0]["id"]]}  # Only 1 ID
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/compare",
            json=payload,
            headers=admin_headers
        )
        assert response.status_code == 400, f"Expected 400 for single policy, got {response.status_code}"

    def test_compare_maximum_four(self, admin_headers):
        """Compare endpoint allows maximum 4 policies"""
        get_response = requests.get(f"{BASE_URL}/api/policy-benchmarks", headers=admin_headers)
        benchmarks = get_response.json()
        
        if len(benchmarks) < 5:
            pytest.skip("Not enough benchmarks to test max limit")
        
        payload = {"benchmark_ids": [b["id"] for b in benchmarks[:5]]}  # 5 IDs
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/compare",
            json=payload,
            headers=admin_headers
        )
        assert response.status_code == 400, f"Expected 400 for >4 policies, got {response.status_code}"

    def test_hr_can_access_compare(self, hr_headers, admin_headers):
        """HR users should be able to use compare (not admin-only)"""
        get_response = requests.get(f"{BASE_URL}/api/policy-benchmarks", headers=admin_headers)
        benchmarks = get_response.json()
        
        if len(benchmarks) < 2:
            pytest.skip("Not enough benchmarks")
        
        payload = {"benchmark_ids": [benchmarks[0]["id"], benchmarks[1]["id"]]}
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/compare",
            json=payload,
            headers=hr_headers,
            timeout=60
        )
        assert response.status_code == 200, f"HR should access compare, got {response.status_code}"


class TestPDFUpload:
    """Test POST /api/policy-explainer/upload-pdf endpoint"""

    def test_pdf_upload_requires_pdf_file(self, admin_headers):
        """Upload endpoint rejects non-PDF files"""
        # Create a fake text file
        files = {"file": ("test.txt", b"This is not a PDF", "text/plain")}
        headers = {"Authorization": admin_headers["Authorization"]}
        
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/upload-pdf",
            files=files,
            headers=headers
        )
        assert response.status_code == 400, f"Expected 400 for non-PDF, got {response.status_code}"

    def test_pdf_upload_endpoint_exists(self, admin_headers):
        """Verify PDF upload endpoint exists and requires file"""
        headers = {"Authorization": admin_headers["Authorization"]}
        
        # Send request without file
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/upload-pdf",
            headers=headers
        )
        # Should return 422 (validation error) for missing file, not 404
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"


class TestBenchmarkCounts:
    """Verify correct benchmark counts by type"""

    def test_benchmark_counts_by_type(self, admin_headers):
        """Verify 8 benchmarks: 3 Group Health, 2 Group Term, 2 Group Accident, 1 Aarogya Add-on"""
        response = requests.get(f"{BASE_URL}/api/policy-benchmarks", headers=admin_headers)
        assert response.status_code == 200
        
        data = response.json()
        
        # Count by type (excluding Aarogya add-on from type counts)
        group_health = [b for b in data if b["policy_type"] == "Group Health" and not b.get("is_aarogya_addon")]
        group_term = [b for b in data if b["policy_type"] == "Group Term"]
        group_accident = [b for b in data if b["policy_type"] == "Group Accident"]
        aarogya_addons = [b for b in data if b.get("is_aarogya_addon") == True]
        
        # Note: The Aarogya add-on has policy_type "Group Health" but is_aarogya_addon=True
        assert len(group_health) >= 3, f"Expected at least 3 Group Health, got {len(group_health)}"
        assert len(group_term) >= 2, f"Expected at least 2 Group Term, got {len(group_term)}"
        assert len(group_accident) >= 2, f"Expected at least 2 Group Accident, got {len(group_accident)}"
        assert len(aarogya_addons) >= 1, f"Expected at least 1 Aarogya Add-on, got {len(aarogya_addons)}"
        
        # Total should be at least 8
        total = len(data)
        assert total >= 8, f"Expected at least 8 total benchmarks, got {total}"

    def test_specific_insurers_present(self, admin_headers):
        """Verify specific insurers are seeded"""
        response = requests.get(f"{BASE_URL}/api/policy-benchmarks", headers=admin_headers)
        data = response.json()
        
        insurer_names = [b["insurer_name"] for b in data]
        
        expected_insurers = [
            "ICICI Lombard",
            "Star Health",
            "HDFC Ergo",
            "ICICI Prudential",
            "Max Life",
            "New India Assurance",
            "Bajaj Allianz",
            "Aarogya Assist"
        ]
        
        for insurer in expected_insurers:
            assert insurer in insurer_names, f"Missing insurer: {insurer}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
