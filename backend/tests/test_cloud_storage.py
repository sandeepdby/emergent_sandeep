"""
Cloud Storage API Tests for InsureHub
Tests document upload, list, download, and delete functionality
"""
import pytest
import requests
import os
import tempfile

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_CREDENTIALS = {"username": "admin", "password": "admin123"}
HR_CREDENTIALS = {"username": "hruser1", "password": "hr123456"}

# Document categories to test
CATEGORIES = ["Policy Terms", "Endorsement Files", "Premium Receipts", "E-Cards", "Others"]


class TestCloudStorageAPI:
    """Cloud Storage API endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with auth"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.admin_token = None
        self.hr_token = None
        self.created_doc_ids = []  # Track created docs for cleanup
    
    def get_admin_token(self):
        """Get admin auth token"""
        if not self.admin_token:
            response = self.session.post(
                f"{BASE_URL}/api/auth/login",
                json=ADMIN_CREDENTIALS
            )
            if response.status_code == 200:
                self.admin_token = response.json().get("access_token")
        return self.admin_token
    
    def get_hr_token(self):
        """Get HR auth token"""
        if not self.hr_token:
            response = self.session.post(
                f"{BASE_URL}/api/auth/login",
                json=HR_CREDENTIALS
            )
            if response.status_code == 200:
                self.hr_token = response.json().get("access_token")
        return self.hr_token
    
    def auth_headers(self, token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {token}"}
    
    # ==================== Authentication Tests ====================
    
    def test_admin_login(self):
        """Test admin login works"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json=ADMIN_CREDENTIALS
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "Admin"
        print("✓ Admin login successful")
    
    def test_hr_login(self):
        """Test HR login works"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json=HR_CREDENTIALS
        )
        assert response.status_code == 200, f"HR login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "HR"
        print("✓ HR login successful")
    
    # ==================== Document List Tests ====================
    
    def test_list_documents_requires_auth(self):
        """Test that listing documents requires authentication"""
        response = requests.get(f"{BASE_URL}/api/documents")
        assert response.status_code in [401, 403], "Should require auth"
        print("✓ List documents requires authentication")
    
    def test_list_documents_admin(self):
        """Test admin can list documents"""
        token = self.get_admin_token()
        assert token, "Failed to get admin token"
        
        response = self.session.get(
            f"{BASE_URL}/api/documents",
            headers=self.auth_headers(token)
        )
        assert response.status_code == 200, f"List failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin can list documents ({len(data)} documents found)")
    
    def test_list_documents_hr(self):
        """Test HR can list documents"""
        token = self.get_hr_token()
        assert token, "Failed to get HR token"
        
        response = self.session.get(
            f"{BASE_URL}/api/documents",
            headers=self.auth_headers(token)
        )
        assert response.status_code == 200, f"List failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ HR can list documents ({len(data)} documents found)")
    
    # ==================== Document Upload Tests ====================
    
    def test_upload_document_policy_terms_admin(self):
        """Test admin can upload to Policy Terms category"""
        token = self.get_admin_token()
        assert token, "Failed to get admin token"
        
        # Create a test file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("TEST_POLICY_TERMS_CONTENT - This is a test policy terms document")
            temp_path = f.name
        
        try:
            with open(temp_path, 'rb') as f:
                files = {'file': ('TEST_policy_terms.txt', f, 'text/plain')}
                # Use requests directly without session headers for multipart
                response = requests.post(
                    f"{BASE_URL}/api/documents/upload?category=Policy%20Terms",
                    headers={"Authorization": f"Bearer {token}"},
                    files=files
                )
            
            assert response.status_code == 200, f"Upload failed: {response.text}"
            data = response.json()
            assert "id" in data
            assert data["category"] == "Policy Terms"
            self.created_doc_ids.append(data["id"])
            print(f"✓ Admin uploaded to Policy Terms (doc_id: {data['id']})")
            return data["id"]
        finally:
            os.unlink(temp_path)
    
    def test_upload_document_ecards_admin(self):
        """Test admin can upload to E-Cards category"""
        token = self.get_admin_token()
        assert token, "Failed to get admin token"
        
        # Create a test file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("TEST_ECARD_CONTENT - This is a test e-card document")
            temp_path = f.name
        
        try:
            with open(temp_path, 'rb') as f:
                files = {'file': ('TEST_ecard.txt', f, 'text/plain')}
                # Use requests directly without session headers for multipart
                response = requests.post(
                    f"{BASE_URL}/api/documents/upload?category=E-Cards",
                    headers={"Authorization": f"Bearer {token}"},
                    files=files
                )
            
            assert response.status_code == 200, f"Upload failed: {response.text}"
            data = response.json()
            assert "id" in data
            assert data["category"] == "E-Cards"
            self.created_doc_ids.append(data["id"])
            print(f"✓ Admin uploaded to E-Cards (doc_id: {data['id']})")
            return data["id"]
        finally:
            os.unlink(temp_path)
    
    def test_upload_document_hr(self):
        """Test HR can upload documents"""
        token = self.get_hr_token()
        assert token, "Failed to get HR token"
        
        # Create a test file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("TEST_HR_UPLOAD_CONTENT - This is a test document from HR")
            temp_path = f.name
        
        try:
            with open(temp_path, 'rb') as f:
                files = {'file': ('TEST_hr_document.txt', f, 'text/plain')}
                # Use requests directly without session headers for multipart
                response = requests.post(
                    f"{BASE_URL}/api/documents/upload?category=Others",
                    headers={"Authorization": f"Bearer {token}"},
                    files=files
                )
            
            assert response.status_code == 200, f"Upload failed: {response.text}"
            data = response.json()
            assert "id" in data
            assert data["category"] == "Others"
            self.created_doc_ids.append(data["id"])
            print(f"✓ HR uploaded document (doc_id: {data['id']})")
            return data["id"]
        finally:
            os.unlink(temp_path)
    
    def test_upload_requires_auth(self):
        """Test that upload requires authentication"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("TEST_UNAUTH_CONTENT")
            temp_path = f.name
        
        try:
            with open(temp_path, 'rb') as f:
                files = {'file': ('test.txt', f, 'text/plain')}
                response = requests.post(
                    f"{BASE_URL}/api/documents/upload?category=Others",
                    files=files
                )
            assert response.status_code in [401, 403], "Should require auth"
            print("✓ Upload requires authentication")
        finally:
            os.unlink(temp_path)
    
    # ==================== Document Download Tests ====================
    
    def test_download_document(self):
        """Test downloading an uploaded document"""
        token = self.get_admin_token()
        assert token, "Failed to get admin token"
        
        # First upload a document
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            test_content = "TEST_DOWNLOAD_CONTENT - Verify this content after download"
            f.write(test_content)
            temp_path = f.name
        
        try:
            # Upload - use requests directly for multipart
            with open(temp_path, 'rb') as f:
                files = {'file': ('TEST_download_test.txt', f, 'text/plain')}
                upload_response = requests.post(
                    f"{BASE_URL}/api/documents/upload?category=Premium%20Receipts",
                    headers={"Authorization": f"Bearer {token}"},
                    files=files
                )
            
            assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
            doc_id = upload_response.json()["id"]
            self.created_doc_ids.append(doc_id)
            
            # Download
            download_response = self.session.get(
                f"{BASE_URL}/api/documents/{doc_id}/download",
                headers=self.auth_headers(token)
            )
            
            assert download_response.status_code == 200, f"Download failed: {download_response.text}"
            assert test_content in download_response.text
            print(f"✓ Document download successful (doc_id: {doc_id})")
        finally:
            os.unlink(temp_path)
    
    def test_download_nonexistent_document(self):
        """Test downloading a non-existent document returns 404"""
        token = self.get_admin_token()
        assert token, "Failed to get admin token"
        
        response = self.session.get(
            f"{BASE_URL}/api/documents/nonexistent-id-12345/download",
            headers=self.auth_headers(token)
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent document returns 404")
    
    # ==================== Document Delete Tests ====================
    
    def test_delete_document_admin(self):
        """Test admin can delete documents"""
        token = self.get_admin_token()
        assert token, "Failed to get admin token"
        
        # First upload a document
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("TEST_DELETE_CONTENT - This document will be deleted")
            temp_path = f.name
        
        try:
            # Upload - use requests directly for multipart
            with open(temp_path, 'rb') as f:
                files = {'file': ('TEST_to_delete.txt', f, 'text/plain')}
                upload_response = requests.post(
                    f"{BASE_URL}/api/documents/upload?category=Endorsement%20Files",
                    headers={"Authorization": f"Bearer {token}"},
                    files=files
                )
            
            assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
            doc_id = upload_response.json()["id"]
            
            # Delete
            delete_response = self.session.delete(
                f"{BASE_URL}/api/documents/{doc_id}",
                headers=self.auth_headers(token)
            )
            
            assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
            
            # Verify deleted (should return 404 on download)
            verify_response = self.session.get(
                f"{BASE_URL}/api/documents/{doc_id}/download",
                headers=self.auth_headers(token)
            )
            assert verify_response.status_code == 404, "Deleted document should not be downloadable"
            print(f"✓ Admin deleted document successfully (doc_id: {doc_id})")
        finally:
            os.unlink(temp_path)
    
    def test_delete_nonexistent_document(self):
        """Test deleting a non-existent document returns 404"""
        token = self.get_admin_token()
        assert token, "Failed to get admin token"
        
        response = self.session.delete(
            f"{BASE_URL}/api/documents/nonexistent-id-12345",
            headers=self.auth_headers(token)
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Delete non-existent document returns 404")
    
    # ==================== Category Filter Tests ====================
    
    def test_list_documents_by_category(self):
        """Test filtering documents by category"""
        token = self.get_admin_token()
        assert token, "Failed to get admin token"
        
        # Upload to a specific category
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("TEST_CATEGORY_FILTER_CONTENT")
            temp_path = f.name
        
        try:
            # Use requests directly for multipart
            with open(temp_path, 'rb') as f:
                files = {'file': ('TEST_category_filter.txt', f, 'text/plain')}
                upload_response = requests.post(
                    f"{BASE_URL}/api/documents/upload?category=Premium%20Receipts",
                    headers={"Authorization": f"Bearer {token}"},
                    files=files
                )
            
            assert upload_response.status_code == 200
            doc_id = upload_response.json()["id"]
            self.created_doc_ids.append(doc_id)
            
            # List with category filter
            list_response = self.session.get(
                f"{BASE_URL}/api/documents?category=Premium%20Receipts",
                headers=self.auth_headers(token)
            )
            
            assert list_response.status_code == 200
            docs = list_response.json()
            
            # All returned docs should be in the filtered category
            for doc in docs:
                assert doc["category"] == "Premium Receipts", f"Wrong category: {doc['category']}"
            
            print(f"✓ Category filter works ({len(docs)} Premium Receipts found)")
        finally:
            os.unlink(temp_path)
    
    # ==================== Cleanup ====================
    
    def test_cleanup_test_documents(self):
        """Cleanup: Delete all TEST_ prefixed documents"""
        token = self.get_admin_token()
        assert token, "Failed to get admin token"
        
        # List all documents
        response = self.session.get(
            f"{BASE_URL}/api/documents",
            headers=self.auth_headers(token)
        )
        
        if response.status_code == 200:
            docs = response.json()
            deleted_count = 0
            for doc in docs:
                if doc.get("original_filename", "").startswith("TEST_"):
                    delete_response = self.session.delete(
                        f"{BASE_URL}/api/documents/{doc['id']}",
                        headers=self.auth_headers(token)
                    )
                    if delete_response.status_code == 200:
                        deleted_count += 1
            print(f"✓ Cleanup: Deleted {deleted_count} test documents")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
