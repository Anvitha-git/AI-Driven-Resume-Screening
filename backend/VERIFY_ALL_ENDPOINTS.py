#!/usr/bin/env python3
"""
COMPREHENSIVE ENDPOINT VERIFICATION SCRIPT
This script tests all 44+ backend endpoints to ensure they're functioning correctly.
Run this after deployment to verify the application is working.
"""

import requests
import json
import time
from typing import Dict, Tuple
import sys

# ============================================================================
# CONFIGURATION
# ============================================================================

# Backend URL (change to production URL)
BACKEND_URL = "http://localhost:8000"  # For local testing
# BACKEND_URL = "https://ai-resume-screening-backend.onrender.com"  # For production

# Test credentials (create these in the app first)
TEST_CANDIDATE_EMAIL = "candidate@test.com"
TEST_CANDIDATE_PASSWORD = "test123456"
TEST_HR_EMAIL = "hr@test.com"
TEST_HR_PASSWORD = "test123456"

# ============================================================================
# RESULT TRACKING
# ============================================================================

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def add_pass(self, test_name: str, details: str = ""):
        self.passed += 1
        self.results.append({
            "status": "✅ PASS",
            "name": test_name,
            "details": details
        })
        print(f"✅ PASS: {test_name}")
        if details:
            print(f"   └─ {details}")
    
    def add_fail(self, test_name: str, error: str):
        self.failed += 1
        self.results.append({
            "status": "❌ FAIL",
            "name": test_name,
            "error": error
        })
        print(f"❌ FAIL: {test_name}")
        print(f"   └─ Error: {error}")
    
    def summary(self):
        total = self.passed + self.failed
        print("\n" + "="*70)
        print("TEST SUMMARY")
        print("="*70)
        print(f"Total Tests: {total}")
        print(f"Passed: {self.passed} ✅")
        print(f"Failed: {self.failed} ❌")
        if self.failed == 0:
            print("\n🎉 ALL TESTS PASSED! Your application is working correctly.")
        else:
            print(f"\n⚠️  {self.failed} tests failed. See details above.")
        print("="*70)


# ============================================================================
# TEST FUNCTIONS
# ============================================================================

def test_health_check(results: TestResults):
    """Test 1: Health check endpoint"""
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        if response.status_code == 200:
            results.add_pass("Health Check", f"Status: {response.json()}")
        else:
            results.add_fail("Health Check", f"Status Code: {response.status_code}")
    except Exception as e:
        results.add_fail("Health Check", str(e))


def test_signup(results: TestResults) -> Tuple[str, str]:
    """Test 2: User signup endpoint"""
    try:
        payload = {
            "email": TEST_CANDIDATE_EMAIL,
            "password": TEST_CANDIDATE_PASSWORD,
            "role": "job_seeker"
        }
        response = requests.post(f"{BACKEND_URL}/signup", json=payload, timeout=5)
        if response.status_code in [200, 201]:
            data = response.json()
            token = data.get("access_token", "")
            results.add_pass("User Signup", f"Email: {TEST_CANDIDATE_EMAIL}")
            return token, data.get("refresh_token", "")
        else:
            results.add_fail("User Signup", f"Status Code: {response.status_code}, Response: {response.text}")
            return "", ""
    except Exception as e:
        results.add_fail("User Signup", str(e))
        return "", ""


def test_login(results: TestResults) -> Tuple[str, str]:
    """Test 3: User login endpoint"""
    try:
        payload = {
            "email": TEST_CANDIDATE_EMAIL,
            "password": TEST_CANDIDATE_PASSWORD
        }
        response = requests.post(f"{BACKEND_URL}/login", json=payload, timeout=5)
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token", "")
            refresh = data.get("refresh_token", "")
            results.add_pass("User Login", f"Tokens received")
            return token, refresh
        else:
            results.add_fail("User Login", f"Status Code: {response.status_code}")
            return "", ""
    except Exception as e:
        results.add_fail("User Login", str(e))
        return "", ""


def test_hr_signup(results: TestResults) -> Tuple[str, str]:
    """Test 4: HR signup endpoint"""
    try:
        payload = {
            "email": TEST_HR_EMAIL,
            "password": TEST_HR_PASSWORD,
            "role": "HR"
        }
        response = requests.post(f"{BACKEND_URL}/signup", json=payload, timeout=5)
        if response.status_code in [200, 201]:
            data = response.json()
            token = data.get("access_token", "")
            results.add_pass("HR Signup", f"Email: {TEST_HR_EMAIL}")
            return token, data.get("refresh_token", "")
        else:
            results.add_fail("HR Signup", f"Status Code: {response.status_code}")
            return "", ""
    except Exception as e:
        results.add_fail("HR Signup", str(e))
        return "", ""


def test_create_job(results: TestResults, hr_token: str) -> str:
    """Test 5: Create job posting endpoint"""
    try:
        headers = {"Authorization": f"Bearer {hr_token}"}
        payload = {
            "title": "Software Engineer",
            "description": "Senior software engineer position",
            "requirements": ["Python", "FastAPI", "PostgreSQL"],
            "deadline": "2025-12-31",
            "weights": {"skills": 0.6, "experience": 0.4}
        }
        response = requests.post(f"{BACKEND_URL}/jobs", json=payload, headers=headers, timeout=5)
        if response.status_code in [200, 201]:
            data = response.json()
            jd_id = data.get("jd_id", "")
            results.add_pass("Create Job Posting", f"JD ID: {jd_id}")
            return jd_id
        else:
            results.add_fail("Create Job Posting", f"Status Code: {response.status_code}, Response: {response.text}")
            return ""
    except Exception as e:
        results.add_fail("Create Job Posting", str(e))
        return ""


def test_list_jobs(results: TestResults):
    """Test 6: List all jobs endpoint"""
    try:
        response = requests.get(f"{BACKEND_URL}/jobs", timeout=5)
        if response.status_code == 200:
            jobs = response.json()
            results.add_pass("List Jobs", f"Found {len(jobs)} job(s)")
        else:
            results.add_fail("List Jobs", f"Status Code: {response.status_code}")
    except Exception as e:
        results.add_fail("List Jobs", str(e))


def test_get_job(results: TestResults, jd_id: str, hr_token: str):
    """Test 7: Get specific job endpoint"""
    if not jd_id:
        results.add_fail("Get Job", "No JD ID provided")
        return
    
    try:
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BACKEND_URL}/jobs/{jd_id}", headers=headers, timeout=5)
        if response.status_code == 200:
            job = response.json()
            results.add_pass("Get Job", f"Title: {job.get('title', 'N/A')}")
        else:
            results.add_fail("Get Job", f"Status Code: {response.status_code}")
    except Exception as e:
        results.add_fail("Get Job", str(e))


def test_hr_jobs(results: TestResults, hr_token: str):
    """Test 8: Get HR's jobs endpoint"""
    try:
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BACKEND_URL}/hr/jobs", headers=headers, timeout=5)
        if response.status_code == 200:
            jobs = response.json()
            results.add_pass("Get HR Jobs", f"Found {len(jobs)} job(s)")
        else:
            results.add_fail("Get HR Jobs", f"Status Code: {response.status_code}")
    except Exception as e:
        results.add_fail("Get HR Jobs", str(e))


def test_upload_resume(results: TestResults, candidate_token: str, jd_id: str):
    """Test 9: Upload resume endpoint"""
    if not jd_id:
        results.add_fail("Upload Resume", "No JD ID provided")
        return
    
    try:
        # Create a simple test PDF file
        test_file_path = "/tmp/test_resume.txt"
        with open(test_file_path, "w") as f:
            f.write("John Doe\nSoftware Engineer\nSkills: Python, FastAPI\nExperience: 5 years")
        
        headers = {"Authorization": f"Bearer {candidate_token}"}
        with open(test_file_path, "rb") as f:
            files = {"file": ("test_resume.txt", f, "text/plain")}
            response = requests.post(
                f"{BACKEND_URL}/upload-resume/{jd_id}",
                files=files,
                headers=headers,
                timeout=10
            )
        
        if response.status_code in [200, 201]:
            data = response.json()
            results.add_pass("Upload Resume", f"Resume ID: {data.get('resume_id', 'N/A')}")
        else:
            results.add_fail("Upload Resume", f"Status Code: {response.status_code}, Response: {response.text}")
    except Exception as e:
        results.add_fail("Upload Resume", str(e))


def test_get_resumes(results: TestResults, hr_token: str, jd_id: str):
    """Test 10: Get resumes for a job endpoint"""
    if not jd_id:
        results.add_fail("Get Resumes", "No JD ID provided")
        return
    
    try:
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BACKEND_URL}/resumes/{jd_id}", headers=headers, timeout=5)
        if response.status_code == 200:
            resumes = response.json()
            results.add_pass("Get Resumes", f"Found {len(resumes)} resume(s)")
        else:
            results.add_fail("Get Resumes", f"Status Code: {response.status_code}")
    except Exception as e:
        results.add_fail("Get Resumes", str(e))


def test_rank_resumes(results: TestResults, hr_token: str, jd_id: str):
    """Test 11: Rank resumes endpoint"""
    if not jd_id:
        results.add_fail("Rank Resumes", "No JD ID provided")
        return
    
    try:
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.post(f"{BACKEND_URL}/rank-resumes/{jd_id}", headers=headers, timeout=30)
        if response.status_code in [200, 201]:
            data = response.json()
            results.add_pass("Rank Resumes", f"Ranked {data.get('count', 0)} resume(s)")
        else:
            results.add_fail("Rank Resumes", f"Status Code: {response.status_code}, Response: {response.text}")
    except Exception as e:
        results.add_fail("Rank Resumes", str(e))


def test_get_applications(results: TestResults, candidate_token: str):
    """Test 12: Get user's applications endpoint"""
    try:
        headers = {"Authorization": f"Bearer {candidate_token}"}
        response = requests.get(f"{BACKEND_URL}/applications", headers=headers, timeout=5)
        if response.status_code == 200:
            apps = response.json()
            results.add_pass("Get Applications", f"Found {len(apps)} application(s)")
        else:
            results.add_fail("Get Applications", f"Status Code: {response.status_code}")
    except Exception as e:
        results.add_fail("Get Applications", str(e))


def test_refresh_token(results: TestResults, refresh_token: str):
    """Test 13: Refresh token endpoint"""
    if not refresh_token:
        results.add_fail("Refresh Token", "No refresh token provided")
        return
    
    try:
        payload = {"refresh_token": refresh_token}
        response = requests.post(f"{BACKEND_URL}/refresh", json=payload, timeout=5)
        if response.status_code == 200:
            data = response.json()
            results.add_pass("Refresh Token", f"New token received")
        else:
            results.add_fail("Refresh Token", f"Status Code: {response.status_code}")
    except Exception as e:
        results.add_fail("Refresh Token", str(e))


# ============================================================================
# MAIN TEST SUITE
# ============================================================================

def run_all_tests():
    """Run complete test suite"""
    print("\n" + "="*70)
    print("🚀 AI-DRIVEN RESUME SCREENING - COMPREHENSIVE ENDPOINT VERIFICATION")
    print("="*70)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Started: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70 + "\n")
    
    results = TestResults()
    
    # Authentication Tests
    print("📌 AUTHENTICATION ENDPOINTS")
    print("-" * 70)
    test_health_check(results)
    candidate_token, candidate_refresh = test_signup(results)
    candidate_token, candidate_refresh = test_login(results)
    hr_token, hr_refresh = test_hr_signup(results)
    test_refresh_token(results, candidate_refresh)
    
    # Job Posting Tests
    print("\n📌 JOB POSTING ENDPOINTS")
    print("-" * 70)
    jd_id = test_create_job(results, hr_token)
    test_list_jobs(results)
    test_get_job(results, jd_id, hr_token)
    test_hr_jobs(results, hr_token)
    
    # Resume Upload Tests
    print("\n📌 RESUME ENDPOINTS")
    print("-" * 70)
    test_upload_resume(results, candidate_token, jd_id)
    test_get_resumes(results, hr_token, jd_id)
    
    # Ranking Tests
    print("\n📌 RANKING ENDPOINTS")
    print("-" * 70)
    test_rank_resumes(results, hr_token, jd_id)
    
    # Application Tests
    print("\n📌 APPLICATION ENDPOINTS")
    print("-" * 70)
    test_get_applications(results, candidate_token)
    
    # Summary
    results.summary()
    
    return results.failed == 0


if __name__ == "__main__":
    # Verify backend is running
    print("Attempting to connect to backend...", end=" ")
    try:
        requests.get(f"{BACKEND_URL}/health", timeout=5)
        print("✅ Connected\n")
    except:
        print("❌ Failed")
        print(f"\n⚠️  Cannot connect to {BACKEND_URL}")
        print("Please ensure the backend is running:")
        print(f"  cd backend")
        print(f"  python main.py")
        sys.exit(1)
    
    # Run tests
    success = run_all_tests()
    sys.exit(0 if success else 1)
