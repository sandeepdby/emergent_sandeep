"""
Test suite for Policy Compare Documents feature (Iteration 25)
Tests the new unified Compare & Benchmark tab functionality:
- POST /api/policy-explainer/compare-documents - Upload 2+ PDFs for AI comparison
- Mix of PDFs + benchmark_ids in query param
- Validates minimum 2 sources
- Validates max 5 sources
- Rejects non-PDF files
"""

import pytest
import requests
import os
import io

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
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def hr_headers(hr_token):
    """HR auth headers"""
    return {"Authorization": f"Bearer {hr_token}"}


@pytest.fixture(scope="module")
def benchmark_ids(admin_headers):
    """Get benchmark IDs for testing"""
    response = requests.get(f"{BASE_URL}/api/policy-benchmarks", headers={**admin_headers, "Content-Type": "application/json"})
    if response.status_code == 200:
        benchmarks = response.json()
        return [b["id"] for b in benchmarks[:3]]  # Get first 3 benchmark IDs
    return []


def create_fake_pdf(content="This is a test PDF content for insurance policy comparison."):
    """Create a minimal valid PDF file for testing"""
    # Create a minimal PDF structure
    pdf_content = f"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length {len(content) + 50} >>
stream
BT
/F1 12 Tf
100 700 Td
({content}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
{300 + len(content)}
%%EOF"""
    return pdf_content.encode()


class TestCompareDocumentsValidation:
    """Test validation rules for compare-documents endpoint"""

    def test_requires_minimum_two_sources(self, admin_headers):
        """Endpoint requires at least 2 sources (PDFs or benchmarks)"""
        # Test with no files and no benchmarks
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/compare-documents",
            headers=admin_headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "at least 2" in response.json().get("detail", "").lower()

    def test_requires_minimum_two_with_one_benchmark(self, admin_headers, benchmark_ids):
        """Endpoint requires at least 2 sources - 1 benchmark is not enough"""
        if not benchmark_ids:
            pytest.skip("No benchmarks available")
        
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/compare-documents?benchmark_ids={benchmark_ids[0]}",
            headers=admin_headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "at least 2" in response.json().get("detail", "").lower()

    def test_maximum_five_sources(self, admin_headers, benchmark_ids):
        """Endpoint allows maximum 5 sources"""
        if len(benchmark_ids) < 3:
            pytest.skip("Not enough benchmarks")
        
        # Create 3 fake PDFs + 3 benchmarks = 6 sources (exceeds limit)
        files = [
            ("files", (f"test{i}.pdf", create_fake_pdf(f"Policy content {i}"), "application/pdf"))
            for i in range(3)
        ]
        benchmark_param = ",".join(benchmark_ids[:3])
        
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/compare-documents?benchmark_ids={benchmark_param}",
            files=files,
            headers=admin_headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "maximum 5" in response.json().get("detail", "").lower()

    def test_rejects_non_pdf_files(self, admin_headers, benchmark_ids):
        """Endpoint rejects non-PDF files"""
        if not benchmark_ids:
            pytest.skip("No benchmarks available")
        
        # Create a text file instead of PDF
        files = [
            ("files", ("test.txt", b"This is not a PDF", "text/plain")),
        ]
        benchmark_param = benchmark_ids[0]
        
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/compare-documents?benchmark_ids={benchmark_param}",
            files=files,
            headers=admin_headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "not a pdf" in response.json().get("detail", "").lower()

    def test_rejects_docx_files(self, admin_headers, benchmark_ids):
        """Endpoint rejects .docx files"""
        if not benchmark_ids:
            pytest.skip("No benchmarks available")
        
        files = [
            ("files", ("test.docx", b"Fake docx content", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")),
        ]
        benchmark_param = benchmark_ids[0]
        
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/compare-documents?benchmark_ids={benchmark_param}",
            files=files,
            headers=admin_headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "not a pdf" in response.json().get("detail", "").lower()


class TestCompareDocumentsWithBenchmarks:
    """Test compare-documents with benchmark_ids only"""

    def test_compare_two_benchmarks(self, admin_headers, benchmark_ids):
        """Compare 2 benchmarks successfully"""
        if len(benchmark_ids) < 2:
            pytest.skip("Not enough benchmarks")
        
        benchmark_param = ",".join(benchmark_ids[:2])
        
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/compare-documents?benchmark_ids={benchmark_param}",
            headers=admin_headers,
            timeout=90  # AI calls may take time
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "sources" in data
        assert "total_sources" in data
        assert data["total_sources"] == 2
        assert "comparison" in data
        assert len(data["comparison"]) > 100, "Comparison should be substantial"
        
        # Verify sources info
        for source in data["sources"]:
            assert source["type"] == "benchmark"
            assert "name" in source
            assert "id" in source

    def test_compare_three_benchmarks(self, admin_headers, benchmark_ids):
        """Compare 3 benchmarks successfully"""
        if len(benchmark_ids) < 3:
            pytest.skip("Not enough benchmarks")
        
        benchmark_param = ",".join(benchmark_ids[:3])
        
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/compare-documents?benchmark_ids={benchmark_param}",
            headers=admin_headers,
            timeout=90
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["total_sources"] == 3

    def test_hr_can_compare_benchmarks(self, hr_headers, benchmark_ids):
        """HR users can use compare-documents endpoint"""
        if len(benchmark_ids) < 2:
            pytest.skip("Not enough benchmarks")
        
        benchmark_param = ",".join(benchmark_ids[:2])
        
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/compare-documents?benchmark_ids={benchmark_param}",
            headers=hr_headers,
            timeout=90
        )
        assert response.status_code == 200, f"HR should access compare-documents, got {response.status_code}"


class TestCompareDocumentsAuthentication:
    """Test authentication requirements"""

    def test_unauthenticated_blocked(self, benchmark_ids):
        """Unauthenticated requests should be blocked"""
        if len(benchmark_ids) < 2:
            pytest.skip("Not enough benchmarks")
        
        benchmark_param = ",".join(benchmark_ids[:2])
        
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/compare-documents?benchmark_ids={benchmark_param}"
        )
        assert response.status_code in [401, 403], f"Unauthenticated should be blocked, got {response.status_code}"


class TestCompareDocumentsResponseStructure:
    """Test response structure of compare-documents endpoint"""

    def test_response_has_required_fields(self, admin_headers, benchmark_ids):
        """Response should have sources, total_sources, and comparison fields"""
        if len(benchmark_ids) < 2:
            pytest.skip("Not enough benchmarks")
        
        benchmark_param = ",".join(benchmark_ids[:2])
        
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/compare-documents?benchmark_ids={benchmark_param}",
            headers=admin_headers,
            timeout=90
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Required fields
        assert "sources" in data, "Response missing 'sources' field"
        assert "total_sources" in data, "Response missing 'total_sources' field"
        assert "comparison" in data, "Response missing 'comparison' field"
        
        # Sources should be a list
        assert isinstance(data["sources"], list)
        
        # total_sources should match sources length
        assert data["total_sources"] == len(data["sources"])
        
        # comparison should be a non-empty string (markdown)
        assert isinstance(data["comparison"], str)
        assert len(data["comparison"]) > 0

    def test_comparison_contains_markdown(self, admin_headers, benchmark_ids):
        """Comparison response should contain markdown formatting"""
        if len(benchmark_ids) < 2:
            pytest.skip("Not enough benchmarks")
        
        benchmark_param = ",".join(benchmark_ids[:2])
        
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/compare-documents?benchmark_ids={benchmark_param}",
            headers=admin_headers,
            timeout=90
        )
        assert response.status_code == 200
        
        data = response.json()
        comparison = data["comparison"]
        
        # Check for markdown elements (headers, tables, etc.)
        has_markdown = (
            "##" in comparison or  # Headers
            "|" in comparison or   # Tables
            "**" in comparison or  # Bold
            "- " in comparison     # Lists
        )
        assert has_markdown, "Comparison should contain markdown formatting"


class TestExistingEndpointsStillWork:
    """Verify existing endpoints still work after changes"""

    def test_explainer_endpoint_works(self, admin_headers):
        """POST /api/policy-explainer/explain still works"""
        payload = {
            "policy_type": "Group Health",
            "focus_area": None
        }
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/explain",
            json=payload,
            headers={**admin_headers, "Content-Type": "application/json"},
            timeout=60
        )
        assert response.status_code == 200, f"Explainer endpoint failed: {response.status_code}"
        
        data = response.json()
        assert "explanation" in data

    def test_recommend_endpoint_works(self, admin_headers):
        """POST /api/policy-explainer/recommend still works"""
        payload = {
            "company_size": "51-200",
            "industry": "IT / Software",
            "policy_types_needed": ["Group Health"],
            "priorities": ["Maternity cover"]
        }
        response = requests.post(
            f"{BASE_URL}/api/policy-explainer/recommend",
            json=payload,
            headers={**admin_headers, "Content-Type": "application/json"},
            timeout=60
        )
        assert response.status_code == 200, f"Recommend endpoint failed: {response.status_code}"
        
        data = response.json()
        assert "recommendation" in data

    def test_benchmarks_crud_works(self, admin_headers):
        """GET /api/policy-benchmarks still works"""
        response = requests.get(
            f"{BASE_URL}/api/policy-benchmarks",
            headers={**admin_headers, "Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Benchmarks endpoint failed: {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 8, "Should have at least 8 benchmarks"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
