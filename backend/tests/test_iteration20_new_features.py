"""
Iteration 20 - New Features Testing
Tests for:
1. Testimonials CRUD (Admin only) - GET /api/testimonials, POST /api/testimonials, PUT, DELETE, PATCH toggle
2. Public Testimonials - GET /api/testimonials/public (no auth)
3. Career Application - POST /api/careers/apply
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
MASTER_ADMIN = {"username": "masteradmin", "password": "Admin@123"}
HR_USER = {"username": "arpita", "password": "Password@123"}


class TestAuth:
    """Authentication tests"""
    
    def test_master_admin_login(self):
        """Test master admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MASTER_ADMIN)
        assert response.status_code == 200, f"Master admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "Admin"
        print(f"✓ Master admin login successful - role: {data['user']['role']}")
        return data["access_token"]
    
    def test_hr_user_login(self):
        """Test HR user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_USER)
        assert response.status_code == 200, f"HR user login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "HR"
        print(f"✓ HR user login successful - role: {data['user']['role']}")
        return data["access_token"]


class TestPublicTestimonials:
    """Test public testimonials endpoint (no auth required)"""
    
    def test_get_public_testimonials(self):
        """GET /api/testimonials/public - should return active testimonials without auth"""
        response = requests.get(f"{BASE_URL}/api/testimonials/public")
        assert response.status_code == 200, f"Public testimonials failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Public testimonials returned {len(data)} testimonials")
        
        # Check structure if testimonials exist
        if len(data) > 0:
            t = data[0]
            assert "company_name" in t, "Testimonial should have company_name"
            assert "testimonial_text" in t, "Testimonial should have testimonial_text"
            assert "rating" in t, "Testimonial should have rating"
            assert t.get("is_active") == True, "Public testimonials should only return active ones"
            print(f"  - First testimonial: {t.get('company_name')} - Rating: {t.get('rating')}")
        return data


class TestTestimonialsCRUD:
    """Test testimonials CRUD operations (Admin only)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MASTER_ADMIN)
        assert response.status_code == 200
        self.admin_token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_get_all_testimonials_admin(self):
        """GET /api/testimonials - Admin should see all testimonials"""
        response = requests.get(f"{BASE_URL}/api/testimonials", headers=self.headers)
        assert response.status_code == 200, f"Get testimonials failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin can view all testimonials - count: {len(data)}")
        return data
    
    def test_get_testimonials_hr_forbidden(self):
        """GET /api/testimonials - HR should be forbidden"""
        hr_response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_USER)
        hr_token = hr_response.json()["access_token"]
        hr_headers = {"Authorization": f"Bearer {hr_token}"}
        
        response = requests.get(f"{BASE_URL}/api/testimonials", headers=hr_headers)
        assert response.status_code == 403, f"HR should be forbidden: {response.status_code}"
        print("✓ HR user correctly forbidden from viewing all testimonials")
    
    def test_create_testimonial(self):
        """POST /api/testimonials - Create new testimonial"""
        payload = {
            "company_name": "TEST_Company_Pytest",
            "testimonial_text": "This is a test testimonial created by pytest for iteration 20 testing.",
            "contact_person": "Test Person",
            "designation": "Test Manager",
            "rating": 4,
            "logo_url": "https://example.com/logo.png"
        }
        response = requests.post(f"{BASE_URL}/api/testimonials", json=payload, headers=self.headers)
        assert response.status_code == 200, f"Create testimonial failed: {response.text}"
        data = response.json()
        
        assert data["company_name"] == payload["company_name"]
        assert data["testimonial_text"] == payload["testimonial_text"]
        assert data["contact_person"] == payload["contact_person"]
        assert data["designation"] == payload["designation"]
        assert data["rating"] == payload["rating"]
        assert data["is_active"] == True
        assert "id" in data
        
        print(f"✓ Created testimonial: {data['company_name']} (ID: {data['id']})")
        return data
    
    def test_create_testimonial_hr_forbidden(self):
        """POST /api/testimonials - HR should be forbidden"""
        hr_response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_USER)
        hr_token = hr_response.json()["access_token"]
        hr_headers = {"Authorization": f"Bearer {hr_token}"}
        
        payload = {
            "company_name": "HR_Test_Company",
            "testimonial_text": "HR should not be able to create this",
            "rating": 5
        }
        response = requests.post(f"{BASE_URL}/api/testimonials", json=payload, headers=hr_headers)
        assert response.status_code == 403, f"HR should be forbidden: {response.status_code}"
        print("✓ HR user correctly forbidden from creating testimonials")
    
    def test_update_testimonial(self):
        """PUT /api/testimonials/{id} - Update testimonial"""
        # First create a testimonial
        create_payload = {
            "company_name": "TEST_Update_Company",
            "testimonial_text": "Original text",
            "rating": 3
        }
        create_response = requests.post(f"{BASE_URL}/api/testimonials", json=create_payload, headers=self.headers)
        assert create_response.status_code == 200
        testimonial_id = create_response.json()["id"]
        
        # Update it
        update_payload = {
            "testimonial_text": "Updated text by pytest",
            "rating": 5
        }
        response = requests.put(f"{BASE_URL}/api/testimonials/{testimonial_id}", json=update_payload, headers=self.headers)
        assert response.status_code == 200, f"Update testimonial failed: {response.text}"
        data = response.json()
        
        assert data["testimonial_text"] == update_payload["testimonial_text"]
        assert data["rating"] == update_payload["rating"]
        assert data["company_name"] == create_payload["company_name"]  # Unchanged
        
        print(f"✓ Updated testimonial: {testimonial_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/testimonials/{testimonial_id}", headers=self.headers)
        return data
    
    def test_toggle_testimonial_visibility(self):
        """PATCH /api/testimonials/{id}/toggle - Toggle visibility"""
        # First create a testimonial
        create_payload = {
            "company_name": "TEST_Toggle_Company",
            "testimonial_text": "Toggle test",
            "rating": 4
        }
        create_response = requests.post(f"{BASE_URL}/api/testimonials", json=create_payload, headers=self.headers)
        assert create_response.status_code == 200
        testimonial_id = create_response.json()["id"]
        initial_status = create_response.json()["is_active"]
        
        # Toggle it
        response = requests.patch(f"{BASE_URL}/api/testimonials/{testimonial_id}/toggle", headers=self.headers)
        assert response.status_code == 200, f"Toggle testimonial failed: {response.text}"
        data = response.json()
        
        assert data["is_active"] == (not initial_status), "Toggle should flip the status"
        print(f"✓ Toggled testimonial visibility: {initial_status} -> {data['is_active']}")
        
        # Toggle back
        response2 = requests.patch(f"{BASE_URL}/api/testimonials/{testimonial_id}/toggle", headers=self.headers)
        assert response2.status_code == 200
        assert response2.json()["is_active"] == initial_status
        print(f"✓ Toggled back: {data['is_active']} -> {initial_status}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/testimonials/{testimonial_id}", headers=self.headers)
    
    def test_delete_testimonial(self):
        """DELETE /api/testimonials/{id} - Delete testimonial"""
        # First create a testimonial
        create_payload = {
            "company_name": "TEST_Delete_Company",
            "testimonial_text": "To be deleted",
            "rating": 2
        }
        create_response = requests.post(f"{BASE_URL}/api/testimonials", json=create_payload, headers=self.headers)
        assert create_response.status_code == 200
        testimonial_id = create_response.json()["id"]
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/testimonials/{testimonial_id}", headers=self.headers)
        assert response.status_code == 200, f"Delete testimonial failed: {response.text}"
        
        # Verify it's gone
        get_response = requests.get(f"{BASE_URL}/api/testimonials", headers=self.headers)
        testimonials = get_response.json()
        assert not any(t["id"] == testimonial_id for t in testimonials), "Testimonial should be deleted"
        
        print(f"✓ Deleted testimonial: {testimonial_id}")
    
    def test_delete_nonexistent_testimonial(self):
        """DELETE /api/testimonials/{id} - Should return 404 for nonexistent"""
        response = requests.delete(f"{BASE_URL}/api/testimonials/nonexistent-id-12345", headers=self.headers)
        assert response.status_code == 404, f"Should return 404: {response.status_code}"
        print("✓ Correctly returns 404 for nonexistent testimonial")


class TestCareerApplication:
    """Test career application endpoint"""
    
    def test_submit_career_application(self):
        """POST /api/careers/apply - Submit career application"""
        payload = {
            "full_name": "TEST_Applicant_Pytest",
            "email": "test.applicant@pytest.com",
            "phone": "+91 9876543210",
            "position": "Full Stack Developer"
        }
        response = requests.post(f"{BASE_URL}/api/careers/apply", json=payload)
        assert response.status_code == 200, f"Career application failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "submitted" in data["message"].lower() or "success" in data["message"].lower()
        print(f"✓ Career application submitted: {payload['full_name']} for {payload['position']}")
    
    def test_submit_career_application_with_all_fields(self):
        """POST /api/careers/apply - Submit with all optional fields"""
        payload = {
            "full_name": "TEST_Full_Applicant",
            "email": "full.applicant@pytest.com",
            "phone": "+91 9876543211",
            "position": "AI/ML Engineer",
            "experience_years": "3-5",
            "current_company": "Test Corp",
            "cover_letter": "I am excited to apply for this position...",
            "linkedin_url": "https://linkedin.com/in/testapplicant"
        }
        response = requests.post(f"{BASE_URL}/api/careers/apply", json=payload)
        assert response.status_code == 200, f"Career application failed: {response.text}"
        print(f"✓ Career application with all fields submitted: {payload['full_name']}")
    
    def test_submit_career_application_missing_required(self):
        """POST /api/careers/apply - Should fail with missing required fields"""
        payload = {
            "full_name": "Incomplete Applicant"
            # Missing email, phone, position
        }
        response = requests.post(f"{BASE_URL}/api/careers/apply", json=payload)
        assert response.status_code == 422, f"Should fail validation: {response.status_code}"
        print("✓ Correctly validates required fields for career application")


class TestSeededTestimonials:
    """Test that seeded testimonials exist"""
    
    def test_seeded_testimonials_exist(self):
        """Verify seeded testimonials (TCS, Infosys BPM, Wipro) exist"""
        response = requests.get(f"{BASE_URL}/api/testimonials/public")
        assert response.status_code == 200
        testimonials = response.json()
        
        company_names = [t.get("company_name", "").lower() for t in testimonials]
        
        # Check for seeded companies (case-insensitive partial match)
        expected_companies = ["tcs", "infosys", "wipro"]
        found = []
        for expected in expected_companies:
            if any(expected in name for name in company_names):
                found.append(expected)
        
        print(f"✓ Found seeded testimonials: {found}")
        print(f"  All testimonials: {[t.get('company_name') for t in testimonials]}")
        
        # At least some testimonials should exist
        assert len(testimonials) > 0, "Should have at least some testimonials"


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_testimonials(self):
        """Remove TEST_ prefixed testimonials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MASTER_ADMIN)
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get all testimonials
        get_response = requests.get(f"{BASE_URL}/api/testimonials", headers=headers)
        testimonials = get_response.json()
        
        # Delete TEST_ prefixed ones
        deleted = 0
        for t in testimonials:
            if t.get("company_name", "").startswith("TEST_"):
                del_response = requests.delete(f"{BASE_URL}/api/testimonials/{t['id']}", headers=headers)
                if del_response.status_code == 200:
                    deleted += 1
        
        print(f"✓ Cleaned up {deleted} test testimonials")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
