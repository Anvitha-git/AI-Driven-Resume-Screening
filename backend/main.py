from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.security import OAuth2PasswordBearer
from supabase import create_client, Client
import os
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import uuid
import logging
from ai_processor import extract_text, extract_structured_data, rank_resumes, extract_skills_from_text
import requests
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(level=logging.INFO)

load_dotenv()

app = FastAPI()

# Create two separate clients:
# - supabase_auth: used ONLY for auth operations (sign up/in, token validation)
# - supabase_service: used for storage and database operations with the service role key (bypasses RLS)
SUPABASE_URL = os.getenv("SUPABASE_URL")
# Prefer explicit variables if present; fall back to SUPABASE_KEY for service role
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or SUPABASE_SERVICE_ROLE_KEY

supabase_auth: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
supabase_service: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Enable CORS
# Allow frontend from localhost and local network during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        # Add your LAN IP (React dev server) if accessed from another machine
        "http://10.195.224.144:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# Pydantic models
class JobPosting(BaseModel):
    title: str
    description: str
    requirements: List[str]
    deadline: Optional[str]
    weights: Optional[Dict[str, float]] = {}  # e.g., {"skills": 0.6, "experience": 0.3}

class User(BaseModel):
    email: str
    password: str
    role: Optional[str] = None

class Notification(BaseModel):
    user_id: str
    message: str
    type: str

class Decision(BaseModel):
    decision: str  # "selected", "rejected", "pending"
# Helpers
def _signed_url_for(file_url: Optional[str]) -> Optional[str]:
    """Create a short-lived signed URL for a stored object based on its public URL.
    Falls back to the original URL if signing fails.
    """
    try:
        if not file_url:
            return None
        parsed = urlparse(file_url)
        # Expect path like /storage/v1/object/public/resumes/<object_path>
        path = parsed.path or ""
        marker = "/object/"
        if marker not in path:
            return file_url
        # Find object path after bucket name
        # We specifically look for the 'resumes/' bucket path
        idx = path.find("/resumes/")
        if idx == -1:
            return file_url
        object_path = path[idx + len("/resumes/"):]
        # Request signed URL (1 hour)
        signed = supabase_service.storage.from_("resumes").create_signed_url(object_path, 3600)
        if isinstance(signed, dict):
            url = signed.get("data", {}).get("signedUrl") or signed.get("signedUrl")
            if url:
                # Some clients return a relative path starting with '/'
                if url.startswith("/"):
                    return f"{SUPABASE_URL}{url}"
                return url
        return file_url
    except Exception:
        return file_url


class RefreshRequest(BaseModel):
    refresh_token: str

@app.post("/signup")
async def signup(user: User):
    try:
        logging.info(f"Signup attempt: email={user.email}, role={user.role}")
        # Create user in Supabase Auth with role in user_metadata
        # Using options.data for user_metadata as per Supabase v2 Python client
        response = supabase_auth.auth.sign_up({
            "email": user.email,
            "password": user.password,
            "options": {
                "data": {"role": user.role},
                "email_redirect_to": None
            }
        })
        logging.info(f"Signup response user: {response.user}")
        logging.info(f"Signup response session: {response.session}")
        
        # Check if user was created (might be pending confirmation)
        if response.user:
            # Create user in both user_profiles and users tables
            try:
                # Create in user_profiles table
                supabase_service.table("user_profiles").insert({
                    "user_id": response.user.id,
                    "email": user.email,
                    "role": user.role
                }).execute()
                logging.info(f"User profile created for {user.email}")
                
                # Also create in users table (for foreign key constraints)
                try:
                    supabase_service.table("users").insert({
                        "user_id": response.user.id,
                        "email": user.email,
                        "role": user.role
                    }).execute()
                    logging.info(f"User created in users table for {user.email}")
                except Exception as users_error:
                    logging.warning(f"Could not create user in users table: {users_error}")
                    
            except Exception as profile_error:
                logging.warning(f"Could not create user profile: {profile_error}")
                # Continue anyway - the auth user was created successfully
            
            return {
                "message": "User created successfully. Please check your email for confirmation." if not response.session else "User created successfully"
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to create user")
    except Exception as e:
        logging.exception(f"Signup error for {user.email}")
        raise HTTPException(status_code=400, detail=f"Signup failed: {str(e)}")

# Authentication
async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        res = supabase_auth.auth.get_user(token)
        user = res.user
        # Extract role from user_metadata
        role = user.user_metadata.get("role") if user.user_metadata else None
        logging.info(f"Authenticated user: id={user.id}, email={user.email}, role={role}")
        user.role = role  # Attach role for checks
        return user
    except Exception as e:
        logging.exception("get_current_user error")
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

@app.post("/login")
async def login(user: User):
    try:
        logging.info(f"Login attempt: email={user.email}")
        response = supabase_auth.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password
        })
        logging.info(f"Login successful for {user.email}")
        # Get role from user_metadata
        role = None
        if response.user and response.user.user_metadata:
            role = response.user.user_metadata.get("role")
        logging.info(f"User role: {role}, user_id: {response.user.id}")
        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token,
            "token_type": "bearer",
            "role": role,
            "user_id": response.user.id
        }
    except Exception as e:
        logging.exception(f"Login error for {user.email}")
        raise HTTPException(status_code=401, detail=f"Invalid credentials: {str(e)}")

@app.post("/refresh")
async def refresh_token_endpoint(body: RefreshRequest):
    try:
        # Use Supabase Auth REST API for reliable refresh
        url = f"{SUPABASE_URL}/auth/v1/token?grant_type=refresh_token"
        headers = {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
            "Content-Type": "application/json",
        }
        resp = requests.post(url, headers=headers, json={"refresh_token": body.refresh_token}, timeout=10)
        if resp.status_code != 200:
            logging.error(f"Refresh failed: {resp.status_code} {resp.text}")
            raise HTTPException(status_code=401, detail="Token refresh failed")
        data = resp.json()
        return {
            "access_token": data.get("access_token"),
            "refresh_token": data.get("refresh_token", body.refresh_token),
            "token_type": data.get("token_type", "bearer"),
            "expires_in": data.get("expires_in"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("Token refresh error")
        raise HTTPException(status_code=401, detail=f"Token refresh failed: {str(e)}")

## Demo login endpoints removed

# Job postings
@app.post("/jobs", response_model=JobPosting)
async def create_job(job: JobPosting, user=Depends(get_current_user)):
    if user.role not in ["HR", "demo_hr"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        # Ensure user exists in users table (for foreign key constraint)
        try:
            user_check = supabase_service.table("users").select("user_id").eq("user_id", user.id).execute()
            if not user_check.data:
                # Create user in users table if not exists
                supabase_service.table("users").insert({
                    "user_id": user.id,
                    "email": user.email,
                    "role": user.role
                }).execute()
                logging.info(f"Created missing user in users table: {user.id}")
        except Exception as user_error:
            logging.warning(f"Error checking/creating user: {user_error}")
        
        # Extract skills from requirements if it's a paragraph
        processed_requirements = job.requirements
        if len(job.requirements) == 1 and len(job.requirements[0]) > 50:
            # It's likely a paragraph, extract skills
            extracted_skills = extract_skills_from_text(job.requirements[0])
            processed_requirements = extracted_skills if extracted_skills else job.requirements
        
        data = supabase_service.table("job_descriptions").insert({
            "hr_user_id": user.id,
            "title": job.title,
            "description": job.description,
            "requirements": processed_requirements,
            "deadline": job.deadline,
            "weights": job.weights,
            "status": "open"
        }).execute()
        return data.data[0]
    except Exception as e:
        logging.exception("Error creating job")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/jobs")
async def get_jobs():
    try:
        # Only return jobs that are not closed
        response = supabase_service.table("job_descriptions").select("*").neq("status", "closed").execute()
        return response.data
    except Exception as e:
        logging.exception("Error fetching jobs")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# Add signup endpoint
# Resume upload with AI parsing
from fastapi import Header

@app.post("/upload-resume/{jd_id}")
async def upload_resume(
    jd_id: str,
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
    refresh_token: str = Header(None)
):
    if user.role not in ["job_seeker", "demo_candidate", "Candidate"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if file.content_type not in [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/png",
        "image/jpeg"
    ]:
        raise HTTPException(status_code=400, detail="Invalid file type")
    try:
        file_content = await file.read()
        file_name = f"{uuid.uuid4()}_{file.filename}"
        
        # Use service role for storage and DB operations (bypasses RLS)
        # User authentication is already verified by get_current_user dependency
        # Upload with content-disposition: inline to view in browser instead of download
        supabase_service.storage.from_("resumes").upload(
            file_name, 
            file_content, 
            {
                "upsert": "true",
                "contentType": file.content_type,
                "cacheControl": "3600"
            }
        )
        # Normalize public URL to a plain string
        _file_url_resp = supabase_service.storage.from_("resumes").get_public_url(file_name)
        file_url = None
        try:
            if isinstance(_file_url_resp, dict):
                # supabase-py v2 typically returns {"data": {"publicUrl": "..."}}
                file_url = (
                    _file_url_resp.get("data", {}).get("publicUrl")
                    or _file_url_resp.get("publicUrl")
                    or _file_url_resp.get("public_url")
                )
            else:
                # Fallback: treat as string
                file_url = str(_file_url_resp)
        except Exception:
            file_url = None
        # Save file temporarily for AI parsing
        temp_file = f"temp_{file_name}"
        with open(temp_file, "wb") as f:
            f.write(file_content)
        text = extract_text(temp_file, file.content_type)
        structured_data = extract_structured_data(text)
        
        # Debug logging for resume parsing
        logging.info(f"[RESUME UPLOAD DEBUG] Extracted text length: {len(text)}")
        logging.info(f"[RESUME UPLOAD DEBUG] Structured data: {structured_data}")
        logging.info(f"[RESUME UPLOAD DEBUG] Skills: {structured_data.get('skills')}")
        logging.info(f"[RESUME UPLOAD DEBUG] Experience: {structured_data.get('experience')}")
        
        # Generate neutral insights for candidate improvement
        insights = "" if "project" in text.lower() else "Add specific project details for stronger impact."
        
        # Use service role client (bypasses RLS) - user already authenticated via get_current_user
        data = supabase_service.table("resumes").insert({
            "user_id": user.id,
            "jd_id": jd_id,
            "file_url": file_url,
            "extracted_text": text,
            "insights": insights,
            **structured_data
        }).execute()
        supabase_service.table("applications").insert({
            "user_id": user.id,
            "jd_id": jd_id,
            "resume_id": data.data[0]["resume_id"],
            "status": "applied"
        }).execute()
        os.remove(temp_file)
        
        # Create notification for candidate
        try:
            supabase_service.table("notifications").insert({
                "user_id": user.id,
                "message": f"Resume uploaded successfully for job posting",
                "type": "system"
            }).execute()
        except Exception as notif_error:
            logging.warning(f"Could not create notification: {notif_error}")
        
        return {"message": "Resume uploaded successfully", "resume_id": data.data[0]["resume_id"], "insights": insights}
    except Exception as e:
        logging.exception("Error inserting resume or application")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# Resume ranking
@app.post("/rank-resumes/{jd_id}")
async def rank_resumes_endpoint(jd_id: str, user=Depends(get_current_user)):
    if user.role not in ["HR", "demo_hr"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        jd = supabase_service.table("job_descriptions").select("requirements, weights").eq("jd_id", jd_id).execute().data[0]
        resumes = supabase_service.table("resumes").select("*").eq("jd_id", jd_id).execute().data
        
        # Get weights from JD or use defaults
        weights = jd.get("weights") or {}
        
        # Rank resumes with weights
        scores = rank_resumes(resumes, jd["requirements"], weights)
        
        # Update resumes with scores and explanations
        for resume, score in zip(resumes, scores):
            # Generate explanation based on actual requirements and matched skills
            explanation = f"Match Score: {score*100:.1f}%. "
            jd_requirements = jd.get("requirements", [])
            resume_skills = resume.get("skills", [])
            matched_skills = [s for s in jd_requirements if s in resume_skills]
            if matched_skills:
                explanation += f"Matched required skills: {', '.join(matched_skills)}. "
            else:
                explanation += "No required skills matched. "
            explanation += f"(Job Requirements: {', '.join(jd_requirements)}) "
            if resume.get('experience'):
                explanation += f"Relevant experience found. "
            supabase_service.table("resumes").update({
                "score": float(score),
                "explanation": explanation
            }).eq("resume_id", resume["resume_id"]).execute()
            supabase_service.table("applications").update({"match_score": float(score)}).eq("resume_id", resume["resume_id"]).execute()
        
        # Close the job posting
        supabase_service.table("job_descriptions").update({"status": "closed"}).eq("jd_id", jd_id).execute()
        
        return {"message": "Resumes ranked successfully", "count": len(resumes)}
    except Exception as e:
        logging.exception("Error ranking resumes")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# Get resumes for a specific job (for HR to review)
@app.get("/resumes/{jd_id}")
async def get_resumes(jd_id: str, user=Depends(get_current_user)):
    if user.role not in ["HR", "demo_hr"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        resumes_resp = supabase_service.table("resumes").select("*").eq("jd_id", jd_id).order("score", desc=True).execute()
        resumes = resumes_resp.data or []
        # Normalize and sign file_url for each resume
        for r in resumes:
            fu = r.get("file_url")
            if isinstance(fu, dict):
                r["file_url"] = fu.get("data", {}).get("publicUrl") or fu.get("publicUrl") or fu.get("public_url")
            r["file_url"] = _signed_url_for(r.get("file_url"))
        # Fetch candidate emails to avoid showing UUIDs
        user_ids = list({r.get("user_id") for r in resumes if r.get("user_id")})
        emails_map = {}
        if user_ids:
            try:
                profiles = supabase_service.table("user_profiles").select("user_id, email").in_("user_id", user_ids).execute()
                for p in (profiles.data or []):
                    emails_map[p["user_id"]] = p["email"]
            except Exception as e:
                logging.warning(f"get_resumes: could not fetch user emails: {e}")
        # Add rank and email field
        for idx, resume in enumerate(resumes):
            resume['rank'] = idx + 1
            resume.setdefault('user_email', emails_map.get(resume.get('user_id')))
        return resumes
    except Exception as e:
        logging.exception("Error fetching resumes")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# HR-specific: get all jobs posted by the authenticated HR (history: open and closed)
@app.get("/hr/jobs")
async def get_hr_jobs(user=Depends(get_current_user)):
    if user.role not in ["HR", "demo_hr"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        logging.info(f"Fetching jobs for HR user_id: {user.id}, role: {user.role}")
        jobs_resp = (
            supabase_service
            .table("job_descriptions")
            .select("*")
            .eq("hr_user_id", user.id)
            .order("created_at", desc=True)
            .execute()
        )
        jobs_data = jobs_resp.data or []
        logging.info(f"Found {len(jobs_data)} jobs for HR user {user.id}")
        return jobs_data
    except Exception as e:
        logging.exception("Error fetching HR jobs")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# HR-specific: get candidates for a specific job with enriched details
@app.get("/hr/jobs/{jd_id}/candidates")
async def get_hr_job_candidates(jd_id: str, user=Depends(get_current_user)):
    if user.role not in ["HR", "demo_hr"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        # Ensure the job belongs to the requesting HR
        jd_check = (
            supabase_service
            .table("job_descriptions")
            .select("jd_id, hr_user_id")
            .eq("jd_id", jd_id)
            .single()
            .execute()
        )
        if not jd_check.data or jd_check.data.get("hr_user_id") != user.id:
            raise HTTPException(status_code=404, detail="Job not found or not owned by user")

        # Fetch applications for the job
        apps_resp = (
            supabase_service
            .table("applications")
            .select("*")
            .eq("jd_id", jd_id)
            .order("updated_at", desc=True)
            .execute()
        )
        apps = apps_resp.data or []
        logging.info(f"/hr/jobs/{jd_id}/candidates: Found {len(apps)} applications for job {jd_id}")
        if len(apps) > 0:
            logging.info(f"Sample application: {apps[0]}")
        if not apps:
            return []

        resume_ids = [a.get("resume_id") for a in apps if a.get("resume_id")]
        user_ids = [a.get("user_id") for a in apps if a.get("user_id")]
        logging.info(f"Resume IDs for job {jd_id}: {resume_ids}")

        # Batch fetch resumes
        resumes_map: Dict[str, dict] = {}
        if resume_ids:
            res_resp = (
                supabase_service
                .table("resumes")
                .select("resume_id, file_url, score, explanation, decision")
                .in_("resume_id", resume_ids)
                .execute()
            )
            for r in (res_resp.data or []):
                fu = r.get("file_url")
                if isinstance(fu, dict):
                    r["file_url"] = fu.get("data", {}).get("publicUrl") or fu.get("publicUrl") or fu.get("public_url")
                r["file_url"] = _signed_url_for(r.get("file_url"))
                resumes_map[r["resume_id"]] = r

        # Batch fetch user emails
        emails_map: Dict[str, str] = {}
        if user_ids:
            profiles = (
                supabase_service
                .table("user_profiles")
                .select("user_id, email")
                .in_("user_id", user_ids)
                .execute()
            )
            for p in (profiles.data or []):
                emails_map[p["user_id"]] = p["email"]

        # Compose enriched candidate list
        enriched = []
        for a in apps:
            r = resumes_map.get(a.get("resume_id"), {})
            candidate = {
                "application_id": a.get("application_id"),
                "user_id": a.get("user_id"),
                "candidate_email": emails_map.get(a.get("user_id")),
                "resume_id": a.get("resume_id"),
                "file_url": r.get("file_url"),
                "status": a.get("status", "applied"),
                "decision": r.get("decision") or a.get("decision"),
                "match_score": a.get("match_score", r.get("score")),
                "applied_at": a.get("updated_at"),
                "explanation": r.get("explanation"),
            }
            enriched.append(candidate)

        # Sort by match_score desc if available
        enriched.sort(key=lambda x: (x.get("match_score") is None, -(x.get("match_score") or 0)), reverse=False)
        return enriched
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("Error fetching candidates for job")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# Get applications for a candidate
@app.get("/applications/{user_id}")
async def get_applications(user_id: str, user=Depends(get_current_user)):
    logging.info(f"get_applications: auth_user_id={getattr(user, 'id', None)}, requested_user_id={user_id}, role={getattr(user, 'role', None)}")
    # For non-HR users, always scope to their own applications
    if user.role not in ["HR", "demo_hr"]:
        user_id = user.id
    elif user.id != user_id and user.role in ["HR", "demo_hr"]:
        # HR can access requested user's applications
        pass
    try:
        # Fetch applications first (avoid FK join dependency)
        apps_resp = supabase_service.table("applications").select("*").eq("user_id", user_id).execute()
        apps = apps_resp.data or []
        logging.info(f"get_applications: apps_count={len(apps)} for user_id={user_id}")

        if not apps:
            return []

        # Collect IDs for batch fetch
        resume_ids = [a.get("resume_id") for a in apps if a.get("resume_id")]
        jd_ids = [a.get("jd_id") for a in apps if a.get("jd_id")]

        resumes_map = {}
        jobs_map = {}

        if resume_ids:
            res_resp = supabase_service.table("resumes").select("resume_id, decision, file_url, score, explanation").in_("resume_id", resume_ids).execute()
            for r in (res_resp.data or []):
                fu = r.get("file_url")
                if isinstance(fu, dict):
                    r["file_url"] = fu.get("data", {}).get("publicUrl") or fu.get("publicUrl") or fu.get("public_url")
                r["file_url"] = _signed_url_for(r.get("file_url"))
                resumes_map[r["resume_id"]] = r

        if jd_ids:
            jobs_resp = supabase_service.table("job_descriptions").select("jd_id, title, description").in_("jd_id", jd_ids).execute()
            for j in (jobs_resp.data or []):
                jobs_map[j["jd_id"]] = j

        # Enrich applications to keep the same response structure expected by frontend
        for a in apps:
            a["resumes"] = resumes_map.get(a.get("resume_id"))
            a["job_descriptions"] = jobs_map.get(a.get("jd_id"))

        logging.info(f"get_applications: enriched_apps_count={len(apps)}")
        if len(apps) > 0:
            logging.info(f"get_applications: sample app fields: {list(apps[0].keys())}")
        return apps
    except Exception as e:
        logging.exception("Error fetching applications")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# Notifications endpoints
@app.post("/notifications")
async def create_notification(notification: Notification, user=Depends(get_current_user)):
    if user.role not in ["HR", "demo_hr"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        data = supabase_service.table("notifications").insert({
            "user_id": notification.user_id,
            "message": notification.message,
            "type": notification.type
        }).execute()
        return {"message": "Notification created", "notif_id": data.data[0]["notif_id"]}
    except Exception as e:
        logging.exception("Error creating notification")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/notifications/{user_id}")
async def get_notifications(user_id: str, user=Depends(get_current_user)):
    if user.id != user_id and user.role not in ["HR", "demo_hr"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        notifications = supabase_service.table("notifications").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        return notifications.data
    except Exception as e:
        logging.exception("Error fetching notifications")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.patch("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, user=Depends(get_current_user)):
    try:
        supabase_service.table("notifications").update({"read": True}).eq("notif_id", notif_id).execute()
        return {"message": "Notification marked as read"}
    except Exception as e:
        logging.exception("Error marking notification as read")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# Decision endpoint (for HR to accept/reject candidates)
@app.post("/decisions/{resume_id}")
async def make_decision(resume_id: str, decision: Decision, user=Depends(get_current_user)):
    if user.role not in ["HR", "demo_hr"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        from datetime import datetime
        
        # Update resume with decision
        resume = supabase_service.table("resumes").update({
            "decision": decision.decision,
            "decided_at": datetime.now().isoformat(),
            "decided_by": user.id
        }).eq("resume_id", resume_id).execute()
        
        # Get candidate user_id
        candidate_user_id = resume.data[0]["user_id"]
        
        # Create notification for candidate
        message = f"Your application has been {decision.decision}"
        supabase_service.table("notifications").insert({
            "user_id": candidate_user_id,
            "message": message,
            "type": "decision"
        }).execute()
        
        return {"message": "Decision updated successfully"}
    except Exception as e:
        logging.exception("Error updating decision")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/")
async def root():
    return {"message": "Hello from FastAPI!"}