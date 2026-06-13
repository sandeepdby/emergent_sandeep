"""
Test suite for Policy Recommendation Engine (Iteration 23)
Tests POST /api/policy-explainer/recommend endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDS = {"username": "masteradmin", "password": "Admin@123"}
HR_CREDS = {"username": "arpita", "password": "Password@123"}


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def hr_token():
    """Get HR authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_CREDS)
    assert response.status_code == 200, f"HR login failed: {response.text}"
    return response.json()["access_token"]


class TestPolicyRecommendEndpoint:
    """Tests for POST /api/policy-explainer/recommend"""

    def test_recommend_basic_request_admin(self, admin_token):
        """Test basic recommendation request with admin user"""
        payload = {
            "company_size": "51-200",
            "industry": "IT / Software",
            "policy_types_needed": ["Group Health"]
        }
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/recommend",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Request failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "company_profile" in data
        assert "benchmarks_considered" in data
        assert "recommendation" in data
        
        # Verify company profile echoed back
        assert data["company_profile"]["size"] == "51-200"
        assert data["company_profile"]["industry"] == "IT / Software"
        assert data["company_profile"]["policies_needed"] == ["Group Health"]
        
        # Verify benchmarks were considered
        assert data["benchmarks_considered"] >= 1
        
        # Verify recommendation is non-empty markdown
        assert len(data["recommendation"]) > 100
        print(f"PASS: Admin can get AI recommendation, {data['benchmarks_considered']} benchmarks considered")

    def test_recommend_hr_user_can_access(self, hr_token):
        """Test that HR user can access recommend endpoint (not admin-only)"""
        payload = {
            "company_size": "201-500",
            "industry": "Manufacturing",
            "policy_types_needed": ["Group Health", "Group Term"]
        }
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/recommend",
            json=payload,
            headers={"Authorization": f"Bearer {hr_token}"}
        )
        assert response.status_code == 200, f"HR access failed: {response.text}"
        data = response.json()
        
        assert "recommendation" in data
        assert data["benchmarks_considered"] >= 1
        print("PASS: HR user can access recommend endpoint (not admin-only)")

    def test_recommend_validates_missing_industry(self, admin_token):
        """Test that industry field is required"""
        payload = {
            "company_size": "51-200",
            "policy_types_needed": ["Group Health"]
            # Missing industry
        }
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/recommend",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        # Check that industry is mentioned in validation error
        error_fields = [e.get("loc", [])[-1] for e in data["detail"]]
        assert "industry" in error_fields
        print("PASS: Validates required field - industry")

    def test_recommend_validates_missing_policy_types(self, admin_token):
        """Test that policy_types_needed field is required"""
        payload = {
            "company_size": "51-200",
            "industry": "IT / Software"
            # Missing policy_types_needed
        }
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/recommend",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        data = response.json()
        error_fields = [e.get("loc", [])[-1] for e in data["detail"]]
        assert "policy_types_needed" in error_fields
        print("PASS: Validates required field - policy_types_needed")

    def test_recommend_with_all_optional_fields(self, admin_token):
        """Test recommendation with all optional fields populated"""
        payload = {
            "company_size": "501-2000",
            "industry": "BFSI / Finance",
            "annual_budget_per_employee": "10000-20000",
            "policy_types_needed": ["Group Health", "Group Term", "Group Accident"],
            "priorities": ["Maternity cover", "Mental health", "No room rent cap"],
            "current_insurer": "ICICI Lombard",
            "pain_points": "Slow claims processing",
            "employee_avg_age": "30-35"
        }
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/recommend",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Request failed: {response.text}"
        data = response.json()
        
        # Verify all policy types considered
        assert data["benchmarks_considered"] >= 3  # Should include all 3 types + Aarogya addon
        
        # Verify company profile includes budget
        assert data["company_profile"]["budget"] == "10000-20000"
        
        print(f"PASS: Full request with all fields, {data['benchmarks_considered']} benchmarks considered")

    def test_recommend_returns_benchmarks_count(self, admin_token):
        """Test that response includes benchmarks_considered count"""
        payload = {
            "company_size": "1-50",
            "industry": "Healthcare / Pharma",
            "policy_types_needed": ["Group Health"]
        }
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/recommend",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # benchmarks_considered should be a positive integer
        assert isinstance(data["benchmarks_considered"], int)
        assert data["benchmarks_considered"] >= 1
        print(f"PASS: Returns benchmarks_considered count: {data['benchmarks_considered']}")

    def test_recommend_unauthenticated_blocked(self):
        """Test that unauthenticated requests are blocked"""
        payload = {
            "company_size": "51-200",
            "industry": "IT / Software",
            "policy_types_needed": ["Group Health"]
        }
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/recommend",
            json=payload
            # No Authorization header
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Unauthenticated requests blocked")

    def test_recommend_different_company_sizes(self, admin_token):
        """Test recommendation works for different company sizes"""
        sizes = ["1-50", "51-200", "201-500", "501-2000", "2000+"]
        
        for size in sizes:
            payload = {
                "company_size": size,
                "industry": "Retail / E-commerce",
                "policy_types_needed": ["Group Health"]
            }
            response = requests.post(
                f"{BASE_URL}/api/policy-explainer/recommend",
                json=payload,
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert response.status_code == 200, f"Failed for size {size}: {response.text}"
            data = response.json()
            assert data["company_profile"]["size"] == size
        
        print(f"PASS: All company sizes work: {sizes}")

    def test_recommend_different_industries(self, admin_token):
        """Test recommendation works for different industries"""
        industries = [
            "IT / Software",
            "Manufacturing", 
            "BFSI / Finance",
            "Healthcare / Pharma",
            "Education"
        ]
        
        for industry in industries:
            payload = {
                "company_size": "51-200",
                "industry": industry,
                "policy_types_needed": ["Group Health"]
            }
            response = requests.post(
                f"{BASE_URL}/api/policy-explainer/recommend",
                json=payload,
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert response.status_code == 200, f"Failed for industry {industry}: {response.text}"
            data = response.json()
            assert data["company_profile"]["industry"] == industry
        
        print(f"PASS: All industries work")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
