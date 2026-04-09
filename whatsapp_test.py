#!/usr/bin/env python3
"""
InsureHub WhatsApp Notification API Testing
Tests the new WhatsApp notification endpoints and endorsement workflows
"""

import requests
import sys
import json
import time
from datetime import datetime

class WhatsAppNotificationTester:
    def __init__(self, base_url="https://insurehub-dashboard.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.hr_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_policy_id = None
        self.test_endorsement_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:300]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"username": "admin", "password": "admin123"}
        )
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            return True
        return False

    def test_hr_login(self):
        """Test HR login"""
        success, response = self.run_test(
            "HR Login",
            "POST",
            "auth/login",
            200,
            data={"username": "hruser1", "password": "hr123456"}
        )
        if success and 'access_token' in response:
            self.hr_token = response['access_token']
            return True
        return False

    def test_get_admin_users(self):
        """Test GET /api/users/admins endpoint"""
        if not self.hr_token:
            print("❌ No HR token available")
            return False
            
        success, response = self.run_test(
            "Get Admin Users for Notifications",
            "GET",
            "users/admins",
            200,
            headers={'Authorization': f'Bearer {self.hr_token}'}
        )
        
        if success and isinstance(response, list):
            print(f"✅ Found {len(response)} admin users")
            for admin in response:
                print(f"   - {admin.get('full_name', 'Unknown')} (Phone: {admin.get('phone', 'None')})")
            return True
        return False

    def test_get_hr_users(self):
        """Test GET /api/users/hr endpoint (Admin only)"""
        if not self.admin_token:
            print("❌ No admin token available")
            return False
            
        success, response = self.run_test(
            "Get HR Users (Admin only)",
            "GET",
            "users/hr",
            200,
            headers={'Authorization': f'Bearer {self.admin_token}'}
        )
        
        if success and isinstance(response, list):
            print(f"✅ Found {len(response)} HR users")
            for hr in response:
                print(f"   - {hr.get('full_name', 'Unknown')} (Phone: {hr.get('phone', 'None')})")
            return True
        return False

    def test_get_user_contact(self):
        """Test GET /api/users/{user_id}/contact endpoint"""
        if not self.admin_token:
            print("❌ No admin token available")
            return False
        
        # First get admin user ID from login
        success, me_response = self.run_test(
            "Get Current User for Contact Test",
            "GET",
            "auth/me",
            200,
            headers={'Authorization': f'Bearer {self.admin_token}'}
        )
        
        if not success:
            return False
            
        user_id = me_response.get('id')
        if not user_id:
            print("❌ No user ID found")
            return False
            
        success, response = self.run_test(
            f"Get User Contact Info",
            "GET",
            f"users/{user_id}/contact",
            200,
            headers={'Authorization': f'Bearer {self.admin_token}'}
        )
        
        if success and response.get('id'):
            print(f"✅ Contact info retrieved for {response.get('full_name', 'Unknown')}")
            print(f"   Email: {response.get('email', 'None')}")
            print(f"   Phone: {response.get('phone', 'None')}")
            return True
        return False

    def test_create_test_policy(self):
        """Create a test policy for endorsement testing"""
        if not self.admin_token:
            print("❌ No admin token available")
            return False
            
        policy_data = {
            "policy_number": f"TEST_POL_{datetime.now().strftime('%H%M%S')}",
            "policy_holder_name": "Test Company Ltd",
            "inception_date": "2025-01-01",
            "expiry_date": "2025-12-31",
            "policy_type": "Group Health",
            "annual_premium_per_life": 5000.0,
            "total_lives_covered": 0,
            "status": "Active"
        }
        
        success, response = self.run_test(
            "Create Test Policy",
            "POST",
            "policies",
            200,
            data=policy_data,
            headers={'Authorization': f'Bearer {self.admin_token}'}
        )
        
        if success and response.get('id'):
            self.test_policy_id = response['id']
            print(f"✅ Test policy created: {response.get('policy_number')}")
            return True
        return False

    def test_submit_endorsement(self):
        """Test endorsement submission (HR) with email notifications"""
        if not self.hr_token or not self.test_policy_id:
            print("❌ No HR token or test policy available")
            return False
        
        # First get the policy number
        success, policies = self.run_test(
            "Get Policies for Endorsement",
            "GET",
            "policies",
            200,
            headers={'Authorization': f'Bearer {self.hr_token}'}
        )
        
        if not success or not policies:
            print("❌ No policies found")
            return False
            
        test_policy = next((p for p in policies if p['id'] == self.test_policy_id), None)
        if not test_policy:
            print("❌ Test policy not found")
            return False
            
        endorsement_data = {
            "policy_number": test_policy['policy_number'],
            "employee_id": "EMP001",
            "member_name": "John Doe Test",
            "dob": "1990-05-15",
            "age": 34,
            "gender": "Male",
            "relationship_type": "Employee",
            "endorsement_type": "Addition",
            "date_of_joining": "2025-01-15",
            "coverage_type": "Non-Floater",
            "sum_insured": 500000.0,
            "endorsement_date": "2025-02-01",
            "effective_date": "2025-02-01",
            "remarks": "Test endorsement for WhatsApp notifications"
        }
        
        success, response = self.run_test(
            "Submit Endorsement (HR) - Should notify Admins",
            "POST",
            "endorsements",
            200,
            data=endorsement_data,
            headers={'Authorization': f'Bearer {self.hr_token}'}
        )
        
        if success and response.get('id'):
            self.test_endorsement_id = response['id']
            print(f"✅ Endorsement submitted: {response.get('member_name')}")
            print(f"   Status: {response.get('status')}")
            print(f"   Pro-rata Premium: ₹{response.get('prorata_premium', 0)}")
            print("📧 Email notifications should be sent to all Admin users")
            return True
        return False

    def test_approve_endorsement(self):
        """Test endorsement approval (Admin) with email notifications"""
        if not self.admin_token or not self.test_endorsement_id:
            print("❌ No admin token or test endorsement available")
            return False
            
        approval_data = {
            "status": "Approved",
            "remarks": "Test approval with WhatsApp notification"
        }
        
        success, response = self.run_test(
            "Approve Endorsement (Admin) - Should notify HR",
            "POST",
            f"endorsements/{self.test_endorsement_id}/approve",
            200,
            data=approval_data,
            headers={'Authorization': f'Bearer {self.admin_token}'}
        )
        
        if success and response.get('status') == 'Approved':
            print(f"✅ Endorsement approved: {response.get('member_name')}")
            print(f"   Approved by: {response.get('approved_by')}")
            print(f"   Approval date: {response.get('approval_date')}")
            print("📧 Email notification should be sent to HR who submitted")
            return True
        return False

def main():
    """Main test execution"""
    print("🚀 Starting InsureHub WhatsApp Notification API Tests")
    print("=" * 70)
    
    tester = WhatsAppNotificationTester()
    
    # Test sequence
    tests = [
        ("Admin Login", tester.test_admin_login),
        ("HR Login", tester.test_hr_login),
        ("Get Admin Users for Notifications", tester.test_get_admin_users),
        ("Get HR Users (Admin only)", tester.test_get_hr_users),
        ("Get User Contact Info", tester.test_get_user_contact),
        ("Create Test Policy", tester.test_create_test_policy),
        ("Submit Endorsement (HR notification to Admins)", tester.test_submit_endorsement),
        ("Approve Endorsement (Admin notification to HR)", tester.test_approve_endorsement),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            if not result:
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
            failed_tests.append(test_name)
        
        # Small delay between tests
        time.sleep(1)
    
    # Print results
    print("\n" + "=" * 70)
    print("📊 WHATSAPP NOTIFICATION TEST RESULTS")
    print("=" * 70)
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%")
    
    if failed_tests:
        print(f"\n❌ Failed Tests:")
        for test in failed_tests:
            print(f"   - {test}")
    else:
        print("\n✅ All WhatsApp notification tests passed!")
    
    # WhatsApp functionality summary
    print("\n📱 WHATSAPP NOTIFICATION SUMMARY:")
    print("- GET /api/users/admins: Returns admin users with contact info")
    print("- GET /api/users/hr: Returns HR users (Admin only)")
    print("- GET /api/users/{id}/contact: Returns specific user contact info")
    print("- Endorsement submission: Triggers email to Admins (WhatsApp via frontend)")
    print("- Endorsement approval: Triggers email to HR (WhatsApp via frontend)")
    print("- WhatsApp Web links: Generated in frontend using wa.me format")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())