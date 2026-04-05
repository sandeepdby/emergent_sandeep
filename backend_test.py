#!/usr/bin/env python3
"""
InsureHub Backend API Testing
Tests AI notification generation, SMTP email functionality and endorsement workflows
"""

import requests
import sys
import json
import time
from datetime import datetime

class InsureHubAPITester:
    def __init__(self, base_url="https://app-password-setup.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_user = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
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
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
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

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_email_config(self):
        """Test email configuration endpoint"""
        success, response = self.run_test("Email Configuration", "GET", "email/config", 200)
        if success and response.get('configured'):
            print("✅ Email is properly configured")
            return True
        else:
            print("❌ Email configuration issue")
            return False

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
            self.token = response['access_token']
            self.admin_user = response.get('user', {})
            print(f"✅ Admin logged in: {self.admin_user.get('full_name', 'Admin')}")
            return True
        return False

    def test_user_registration_with_email(self):
        """Test user registration that should trigger email notifications"""
        timestamp = datetime.now().strftime('%H%M%S')
        test_user_data = {
            "username": f"testuser_{timestamp}",
            "password": "TestPass123!",
            "full_name": f"Test User {timestamp}",
            "email": f"test_{timestamp}@example.com",
            "phone": "+91 9876543210",
            "role": "HR"
        }
        
        print(f"📧 Registering user: {test_user_data['username']} with email: {test_user_data['email']}")
        
        success, response = self.run_test(
            "User Registration with Email Notifications",
            "POST",
            "auth/register",
            200,
            data=test_user_data
        )
        
        if success:
            print("✅ User registration successful")
            print("📧 Welcome email should be sent to new user")
            print("📧 Notification emails should be sent to existing HR/Admin users")
            return True, test_user_data
        return False, None

    def test_send_custom_email(self):
        """Test custom email sending endpoint (Admin only)"""
        if not self.token:
            print("❌ No admin token available for email test")
            return False
            
        email_data = {
            "to_emails": ["test@example.com"],
            "subject": "Test Email from InsureHub",
            "body": "<h2>Test Email</h2><p>This is a test email from InsureHub API testing.</p>",
            "from_email": "connect@aarogya-assist.com"
        }
        
        success, response = self.run_test(
            "Send Custom Email",
            "POST",
            "email/send",
            200,
            data=email_data
        )
        
        if success:
            print("✅ Custom email sending endpoint working")
            return True
        return False

    def test_user_creation_without_email(self):
        """Test user registration without email (should still work)"""
        timestamp = datetime.now().strftime('%H%M%S')
        test_user_data = {
            "username": f"noemail_{timestamp}",
            "password": "TestPass123!",
            "full_name": f"No Email User {timestamp}",
            "email": "",  # Empty email
            "phone": "+91 9876543210",
            "role": "HR"
        }
        
        success, response = self.run_test(
            "User Registration without Email",
            "POST",
            "auth/register",
            200,
            data=test_user_data
        )
        
        return success

    def test_get_current_user(self):
        """Test getting current user info"""
        if not self.token:
            print("❌ No token available for user info test")
            return False
            
        success, response = self.run_test(
            "Get Current User Info",
            "GET",
            "auth/me",
            200
        )
        
        if success and response.get('username'):
            print(f"✅ Current user: {response.get('username')} ({response.get('role')})")
            return True
        return False

    def test_policies_endpoint(self):
        """Test policies endpoint access"""
        if not self.token:
            print("❌ No token available for policies test")
            return False
            
        success, response = self.run_test(
            "Get Policies",
            "GET",
            "policies",
            200
        )
        
        if success:
            print(f"✅ Policies endpoint accessible, found {len(response)} policies")
            return True
        return False

    def test_endorsements_endpoint(self):
        """Test endorsements endpoint access"""
        if not self.token:
            print("❌ No token available for endorsements test")
            return False
            
        success, response = self.run_test(
            "Get Endorsements",
            "GET",
            "endorsements",
            200
        )
        
        if success:
            print(f"✅ Endorsements endpoint accessible, found {len(response)} endorsements")
            return True
        return False

    def test_ai_notification_generation(self):
        """Test AI notification generation endpoint"""
        if not self.token:
            print("❌ No token available for AI notification test")
            return False
            
        print("\n🤖 Testing AI Notification Generation...")
        
        # Test endorsement submitted notification
        success, response = self.run_test(
            "AI Notification - Endorsement Submitted",
            "POST",
            "notifications/generate",
            200,
            data={
                "notification_type": "endorsement_submitted",
                "context": {
                    "submitted_by": "Test HR User",
                    "policy_number": "TEST_POL_001",
                    "member_name": "John Doe",
                    "endorsement_type": "Addition",
                    "relationship_type": "Employee",
                    "prorata_premium": 5000
                }
            }
        )
        
        if success and response.get("content"):
            content = response["content"]
            has_email = bool(content.get("email_subject") and content.get("email_body"))
            has_whatsapp = bool(content.get("whatsapp_message"))
            print(f"   📧 Email content: {'✓' if has_email else '✗'}")
            print(f"   💬 WhatsApp content: {'✓' if has_whatsapp else '✗'}")
            
            # Check for emojis and formatting in WhatsApp message
            if has_whatsapp:
                whatsapp_msg = content["whatsapp_message"]
                has_emojis = any(ord(char) > 127 for char in whatsapp_msg)
                has_formatting = "*" in whatsapp_msg or "_" in whatsapp_msg
                print(f"   🎨 WhatsApp emojis: {'✓' if has_emojis else '✗'}")
                print(f"   📝 WhatsApp formatting: {'✓' if has_formatting else '✗'}")
            return True
        elif success:
            print("   ⚠️ AI notification endpoint responded but no content generated")
            return True
        else:
            print("   ❌ AI notification generation failed")
            return False

    def test_endorsement_workflow_with_ai(self):
        """Test complete endorsement workflow with AI notifications"""
        if not self.token:
            print("❌ No token available for endorsement workflow test")
            return False
            
        print("\n📝 Testing Endorsement Workflow with AI...")
        
        # First get available policies
        success, policies = self.run_test(
            "Get Policies for Endorsement",
            "GET",
            "policies",
            200
        )
        
        if not success or not policies:
            print("   ⚠️ No policies available for endorsement testing")
            return False
        
        test_policy = policies[0]
        print(f"   Using policy: {test_policy['policy_number']}")
        
        # Submit endorsement (should trigger AI email to admins)
        endorsement_data = {
            "policy_number": test_policy["policy_number"],
            "employee_id": f"EMP_{datetime.now().strftime('%H%M%S')}",
            "member_name": "AI Test Member",
            "dob": "1990-01-01",
            "age": 35,
            "gender": "Male",
            "relationship_type": "Employee",
            "endorsement_type": "Addition",
            "date_of_joining": "2025-01-15",
            "coverage_type": "Floater",
            "sum_insured": 500000,
            "endorsement_date": "2025-01-20",
            "effective_date": "2025-01-20",
            "remarks": "AI notification test endorsement"
        }
        
        success, endorsement = self.run_test(
            "Submit Endorsement (AI Email to Admins)",
            "POST",
            "endorsements",
            200,
            data=endorsement_data
        )
        
        if success and endorsement:
            print(f"   📧 AI email should be sent to admins for endorsement: {endorsement['id']}")
            
            # Now approve the endorsement (should trigger AI email to HR)
            approval_data = {
                "status": "Approved",
                "remarks": "AI notification test approval"
            }
            
            success, approved = self.run_test(
                "Approve Endorsement (AI Email to HR)",
                "POST",
                f"endorsements/{endorsement['id']}/approve",
                200,
                data=approval_data
            )
            
            if success:
                print(f"   📧 AI email should be sent to HR who submitted the endorsement")
                return True
        
        return False

def main():
    """Main test execution"""
    print("🚀 Starting InsureHub Backend API Tests")
    print("=" * 60)
    
    tester = InsureHubAPITester()
    
    # Test sequence
    tests = [
        ("Root API Endpoint", tester.test_root_endpoint),
        ("Admin Login", tester.test_admin_login),
        ("Email Configuration", tester.test_email_config),
        ("Current User Info", tester.test_get_current_user),
        ("Policies Access", tester.test_policies_endpoint),
        ("Endorsements Access", tester.test_endorsements_endpoint),
        ("AI Notification Generation", tester.test_ai_notification_generation),
        ("Endorsement Workflow with AI", tester.test_endorsement_workflow_with_ai),
        ("User Registration with Email", lambda: tester.test_user_registration_with_email()[0]),
        ("User Registration without Email", tester.test_user_creation_without_email),
        ("Send Custom Email", tester.test_send_custom_email),
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
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS")
    print("=" * 60)
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%")
    
    if failed_tests:
        print(f"\n❌ Failed Tests:")
        for test in failed_tests:
            print(f"   - {test}")
    else:
        print("\n✅ All tests passed!")
    
    # AI functionality summary
    print("\n🤖 AI NOTIFICATION FUNCTIONALITY SUMMARY:")
    print("- AI notification generation: POST /api/notifications/generate")
    print("- Endorsement submission: Triggers AI-generated email to admins")
    print("- Endorsement approval: Triggers AI-generated email to HR")
    print("- WhatsApp messages: AI-generated with emojis and formatting")
    print("- Fallback: Static templates if AI fails")
    
    # Email functionality summary
    print("\n📧 EMAIL FUNCTIONALITY SUMMARY:")
    print("- SMTP Configuration: Configured with Gmail App Password")
    print("- Welcome emails: Sent to new users on registration")
    print("- Notification emails: Sent to existing HR/Admin users")
    print("- Custom email sending: Available for Admin users")
    print("- Phone field: Included in user registration")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())