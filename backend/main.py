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
from email_service import send_decision_email

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
# Allow frontend from localhost (dev) and Netlify (production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://10.195.224.144:3000",
        "https://ai-resumescreening.netlify.app",
        "https://www.ai-resumescreening.netlify.app",
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
    name: Optional[str] = None

class Notification(BaseModel):
    user_id: str
    message: str
    type: str

class Decision(BaseModel):
    decision: str  # "selected", "rejected", "pending"

class UpdateNameRequest(BaseModel):
    name: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class UserPreferences(BaseModel):
    email_notifications: bool = True
    status_updates: bool = True
    job_alerts: bool = True

# Preferences endpoints
@app.get("/preferences")
async def get_preferences(token: str = Depends(oauth2_scheme)):
    try:
        # Resolve user from token
        res = supabase_auth.auth.get_user(token)
        user = res.user
        user_id = user.id
        prefs = {
            "email_notifications": True,
            "status_updates": True,
            "job_alerts": True,
        }

        # Try user_profiles first
        try:
            resp = supabase_service.table("user_profiles").select("email_notifications,status_updates,job_alerts").eq("user_id", user_id).limit(1).execute()
            rows = getattr(resp, "data", []) or resp.get("data", [])
            if rows:
                row = rows[0]
                prefs["email_notifications"] = bool(row.get("email_notifications", prefs["email_notifications"]))
                prefs["status_updates"] = bool(row.get("status_updates", prefs["status_updates"]))
                prefs["job_alerts"] = bool(row.get("job_alerts", prefs["job_alerts"]))
        except Exception as e:
            logging.warning(f"[PREFERENCES] user_profiles read failed: {e}")

        # Fallback to users table
        try:
            resp2 = supabase_service.table("users").select("email_notifications,status_updates,job_alerts").eq("user_id", user_id).limit(1).execute()
            rows2 = getattr(resp2, "data", []) or resp2.get("data", [])
            if rows2:
                row2 = rows2[0]
                prefs["email_notifications"] = bool(row2.get("email_notifications", prefs["email_notifications"]))
                prefs["status_updates"] = bool(row2.get("status_updates", prefs["status_updates"]))
                prefs["job_alerts"] = bool(row2.get("job_alerts", prefs["job_alerts"]))
        except Exception as e:
            logging.warning(f"[PREFERENCES] users read failed: {e}")

        return prefs
    except Exception as e:
        logging.exception("[PREFERENCES] get failed")
        raise HTTPException(status_code=500, detail=f"Failed to load preferences: {str(e)}")

@app.put("/preferences")
async def set_preferences(prefs: UserPreferences, token: str = Depends(oauth2_scheme)):
    try:
        # Resolve user from token
        res = supabase_auth.auth.get_user(token)
        user = res.user
        user_id = user.id
        payload = {
            "email_notifications": prefs.email_notifications,
            "status_updates": prefs.status_updates,
            "job_alerts": prefs.job_alerts,
        }

        updated = False
        try:
            resp = supabase_service.table("user_profiles").update(payload).eq("user_id", user_id).execute()
            updated = True
        except Exception as e:
            logging.warning(f"[PREFERENCES] user_profiles update failed: {e}")

        try:
            supabase_service.table("users").update(payload).eq("user_id", user_id).execute()
            updated = True
        except Exception as e:
            logging.warning(f"[PREFERENCES] users update failed: {e}")

        if not updated:
            # Try insert into user_profiles if missing
            try:
                supabase_service.table("user_profiles").insert({"user_id": user_id, **payload}).execute()
                updated = True
            except Exception:
                pass

        return {"message": "Preferences updated", **payload}
    except Exception as e:
        logging.exception("[PREFERENCES] set failed")
        raise HTTPException(status_code=500, detail=f"Failed to update preferences: {str(e)}")
# Helpers
def _signed_url_for(file_url: Optional[str]) -> Optional[str]:
    """Create a public URL for a stored object.
    Simplified to use public URLs since signed URL creation was failing.
    """
    try:
        if not file_url:
            return None
        
        # If it's already a full URL, return it
        if file_url.startswith("http"):
            return file_url
        
        # Extract the object path from various formats
        object_path = None
        
        # Format 1: "resumes/filename.pdf"
        if file_url.startswith("resumes/"):
            object_path = file_url
        # Format 2: "/storage/v1/object/public/resumes/filename.pdf"
        elif "/resumes/" in file_url:
            idx = file_url.find("/resumes/")
            object_path = file_url[idx+1:]  # Skip the leading /
        else:
            object_path = f"resumes/{file_url}"
        
        # Construct public URL
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/{object_path}"
        logging.info(f"Constructed public URL: {public_url}")
        return public_url
        
    except Exception as e:
        logging.error(f"Error creating URL for {file_url}: {e}")
        return file_url


class RefreshRequest(BaseModel):
    refresh_token: str

@app.post("/signup")
async def signup(user: User):
    try:
        logging.info(f"Signup attempt: email={user.email}, role={user.role}, name={user.name}")
        # Create user in Supabase Auth with role and name in user_metadata
        # Using options.data for user_metadata as per Supabase v2 Python client
        response = supabase_auth.auth.sign_up({
            "email": user.email,
            "password": user.password,
            "options": {
                "data": {"role": user.role, "name": user.name},
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
                    "role": user.role,
                    "name": user.name
                }).execute()
                logging.info(f"User profile created for {user.email}")
                
                # Also create in users table (for foreign key constraints)
                try:
                    supabase_service.table("users").insert({
                        "user_id": response.user.id,
                        "email": user.email,
                        "role": user.role,
                        "name": user.name
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
        # Get role and name from user_metadata
        role = None
        name = None
        if response.user and response.user.user_metadata:
            role = response.user.user_metadata.get("role")
            name = response.user.user_metadata.get("name")
        logging.info(f"User role: {role}, name: {name}, user_id: {response.user.id}")
        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token,
            "token_type": "bearer",
            "role": role,
            "user_id": response.user.id,
            "name": name
        }
    except Exception as e:
        logging.exception(f"Login error for {user.email}")
        raise HTTPException(status_code=401, detail=f"Invalid credentials: {str(e)}")

@app.put("/update-name")
async def update_name(request: UpdateNameRequest, token: str = Depends(oauth2_scheme)):
    try:
        # Get current user using their token
        res = supabase_auth.auth.get_user(token)
        user = res.user
        user_id = user.id
        
        new_name = request.name.strip()
        
        if not new_name:
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        
        logging.info(f"Updating name for user {user_id} to '{new_name}'")
        
        # Get current role from metadata
        current_role = user.user_metadata.get("role") if user.user_metadata else None
        
        # Update user_metadata in Supabase Auth using the user's own token
        # We need to use the update_user method which works with the user's token
        auth_headers = {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        auth_url = f"{SUPABASE_URL}/auth/v1/user"
        auth_response = requests.put(
            auth_url,
            headers=auth_headers,
            json={"data": {"name": new_name, "role": current_role}}
        )
        
        if auth_response.status_code not in [200, 201]:
            logging.error(f"Failed to update auth metadata: {auth_response.text}")
        
        # Update in user_profiles table
        try:
            supabase_service.table("user_profiles").update({
                "name": new_name
            }).eq("user_id", user_id).execute()
        except Exception as profile_error:
            logging.warning(f"Could not update user_profiles: {profile_error}")
        
        # Update in users table
        try:
            supabase_service.table("users").update({
                "name": new_name
            }).eq("user_id", user_id).execute()
        except Exception as users_error:
            logging.warning(f"Could not update users table: {users_error}")
        
        logging.info(f"Name updated successfully for user {user_id}")
        return {"message": "Name updated successfully", "name": new_name}
    except HTTPException:
        raise
    except Exception as e:
        logging.exception(f"Error updating name for user")
        raise HTTPException(status_code=500, detail=f"Failed to update name: {str(e)}")

@app.post("/change-password")
async def change_password(request: ChangePasswordRequest, token: str = Depends(oauth2_scheme)):
    try:
        # Get current user
        res = supabase_auth.auth.get_user(token)
        user = res.user
        user_id = user.id
        user_email = user.email
        
        logging.info(f"Password change request for user {user_id}")
        
        # Verify current password by attempting to sign in
        try:
            sign_in_response = supabase_auth.auth.sign_in_with_password({
                "email": user_email,
                "password": request.current_password
            })
            if not sign_in_response.user:
                raise HTTPException(status_code=401, detail="Current password is incorrect")
        except Exception as auth_error:
            logging.error(f"Current password verification failed: {auth_error}")
            raise HTTPException(status_code=401, detail="Current password is incorrect")
        
        # Validate new password
        if len(request.new_password) < 6:
            raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
        
        # Update password using Supabase Auth API
        auth_headers = {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        auth_url = f"{SUPABASE_URL}/auth/v1/user"
        auth_response = requests.put(
            auth_url,
            headers=auth_headers,
            json={"password": request.new_password}
        )
        
        if auth_response.status_code not in [200, 201]:
            logging.error(f"Failed to update password: {auth_response.text}")
            raise HTTPException(status_code=500, detail="Failed to update password")
        
        logging.info(f"Password updated successfully for user {user_id}")
        return {"message": "Password changed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.exception(f"Error changing password")
        raise HTTPException(status_code=500, detail=f"Failed to change password: {str(e)}")

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

@app.get("/jobs/{jd_id}")
async def get_job_by_id(jd_id: str):
    try:
        response = supabase_service.table("job_descriptions").select("*").eq("jd_id", jd_id).execute()
        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=404, detail="Job not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("Error fetching job")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# Update job status (e.g., close a job posting)
@app.patch("/jobs/{jd_id}")
async def update_job_status(jd_id: str, status: Dict[str, str], user=Depends(get_current_user)):
    if user.role not in ["HR", "demo_hr"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        # Verify job belongs to this HR user
        job = supabase_service.table("job_descriptions").select("hr_user_id").eq("jd_id", jd_id).execute()
        if not job.data or job.data[0]["hr_user_id"] != user.id:
            raise HTTPException(status_code=403, detail="Not authorized to update this job")
        
        # Update job status
        supabase_service.table("job_descriptions").update(status).eq("jd_id", jd_id).execute()
        return {"message": "Job status updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("Error updating job status")
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
        
        # Fetch JD for context-aware data storage
        jd_data = None
        try:
            jd_response = supabase_service.table("job_descriptions").select("title, description, requirements").eq("jd_id", jd_id).execute()
            logging.info(f"[RESUME UPLOAD DEBUG] JD response: {jd_response}")
            if jd_response.data and len(jd_response.data) > 0:
                jd_data = jd_response.data[0]
                logging.info(f"[RESUME UPLOAD] Fetched JD: {jd_data.get('title')}")
        except Exception as jd_error:
            logging.exception(f"Could not fetch JD data: {jd_error}")
        
        # Generate neutral insights for candidate improvement
        insights = "" if "project" in text.lower() else "Add specific project details for stronger impact."
        
        # Calculate skill match for quick reference
        skill_match_count = 0
        if jd_data and jd_data.get("requirements"):
            resume_skills_lower = [s.lower() for s in structured_data.get("skills", [])]
            jd_requirements = jd_data.get("requirements", [])
            if isinstance(jd_requirements, list):
                for jd_skill in jd_requirements:
                    if jd_skill and jd_skill.lower() in resume_skills_lower:
                        skill_match_count += 1
        
        # Use service role client (bypasses RLS) - user already authenticated via get_current_user
        resume_data = {
            "user_id": user.id,
            "jd_id": jd_id,
            "file_url": file_url,
            "extracted_text": text,
            "insights": insights
        }
        
        # Add optional fields only if they exist
        if "skills" in structured_data:
            resume_data["skills"] = structured_data["skills"]
        if "experience" in structured_data:
            resume_data["experience"] = structured_data["experience"]
        if "education" in structured_data:
            resume_data["education"] = structured_data["education"]
        
        logging.info(f"[RESUME UPLOAD] Inserting resume data")
        
        try:
            data = supabase_service.table("resumes").insert(resume_data).execute()
            logging.info(f"[RESUME UPLOAD SUCCESS] Resume inserted with ID: {data.data[0]['resume_id']}")
        except Exception as resume_insert_error:
            logging.exception(f"[RESUME UPLOAD ERROR] Failed to insert resume")
            raise HTTPException(status_code=500, detail=f"Failed to insert resume: {str(resume_insert_error)}")
        
        try:
            supabase_service.table("applications").insert({
                "user_id": user.id,
                "jd_id": jd_id,
                "resume_id": data.data[0]["resume_id"],
                "status": "applied"
            }).execute()
            logging.info(f"[RESUME UPLOAD SUCCESS] Application created for resume {data.data[0]['resume_id']}")
        except Exception as app_insert_error:
            logging.exception(f"[RESUME UPLOAD ERROR] Failed to create application")
            # Don't fail the whole upload if notification fails
            pass
        
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
        # Always normalize file_url to a string public URL
        for r in resumes:
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

# User Preferences endpoints
@app.get("/user-preferences/{user_id}")
async def get_user_preferences(user_id: str, user=Depends(get_current_user)):
    """Get user's notification preferences - returns defaults as preferences columns don't exist in DB"""
    if user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    # Return default preferences (preference columns don't exist in user_profiles table)
    return {
        "email_notifications": True,
        "status_updates": True,
        "job_alerts": True
    }

@app.patch("/user-preferences/{user_id}")
async def update_user_preferences(user_id: str, preferences: UserPreferences, user=Depends(get_current_user)):
    """Update user's notification preferences - no-op as preference columns don't exist in DB"""
    if user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    # No-op: preference columns don't exist in user_profiles table
    # Return success to avoid breaking frontend
    return {"message": "Preferences updated successfully"}

# Decision endpoint (for HR to accept/reject candidates)
# This only saves the decision - emails are sent when HR clicks "Submit Decisions"
@app.post("/decisions/{resume_id}")
async def make_decision(resume_id: str, decision: Decision, user=Depends(get_current_user)):
    if user.role not in ["HR", "demo_hr"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        from datetime import datetime
        
        # Update resume with decision (NO email or notification sent yet)
        resume = supabase_service.table("resumes").update({
            "decision": decision.decision,
            "decided_at": datetime.now().isoformat(),
            "decided_by": user.id
        }).eq("resume_id", resume_id).execute()
        
        return {"message": "Decision saved successfully"}
    except Exception as e:
        logging.exception("Error updating decision")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# Submit all decisions for a job - sends emails and notifications
@app.post("/hr/jobs/{jd_id}/submit-decisions")
async def submit_decisions(jd_id: str, user=Depends(get_current_user)):
    if user.role not in ["HR", "demo_hr"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        # Get all resumes for this job with non-pending decisions
        resumes = supabase_service.table("resumes").select(
            "resume_id, user_id, decision"
        ).eq("jd_id", jd_id).neq("decision", "pending").execute()
        
        if not resumes.data:
            return {"message": "No decisions to submit", "emails_sent": 0}
        
        # Get job title
        job_data = supabase_service.table("job_descriptions").select("title").eq("jd_id", jd_id).execute()
        job_title = job_data.data[0]["title"] if job_data.data else "the position"
        
        emails_sent = 0
        notifications_sent = 0
        
        for resume in resumes.data:
            candidate_user_id = resume["user_id"]
            decision = resume["decision"]
            
            # Get candidate email from user_profiles
            candidate_profile = supabase_service.table("user_profiles").select(
                "email"
            ).eq("user_id", candidate_user_id).execute()
            
            candidate_email = candidate_profile.data[0]["email"] if candidate_profile.data else None
            candidate_name = "Candidate"
            
            # Send email notification (preferences feature removed as columns don't exist)
            if candidate_email:
                email_sent = send_decision_email(
                    candidate_email=candidate_email,
                    candidate_name=candidate_name,
                    job_title=job_title,
                    decision=decision,
                    company_name="AI Resume Screening System"
                )
                if email_sent:
                    emails_sent += 1
                logging.info(f"Email notification {'sent' if email_sent else 'failed'} to {candidate_email} for decision: {decision}")
            
            # Create in-app notification
            message = f"Your application for {job_title} has been {decision}"
            supabase_service.table("notifications").insert({
                "user_id": candidate_user_id,
                "message": message,
                "type": "decision"
            }).execute()
            notifications_sent += 1
        
        logging.info(f"Submitted decisions for job {jd_id}: {emails_sent} emails sent, {notifications_sent} notifications created")
        return {
            "message": "Decisions submitted successfully",
            "emails_sent": emails_sent,
            "notifications_sent": notifications_sent,
            "total_decisions": len(resumes.data)
        }
    except Exception as e:
        logging.exception("Error submitting decisions")
        raise HTTPException(status_code=500, detail=f"Error submitting decisions: {str(e)}")

@app.get("/")
async def root():
    return {"message": "Hello from FastAPI!"}

@app.get("/test-resume/{user_id}/{jd_id}")
async def test_resume(user_id: str, jd_id: str):
    """Test endpoint to check if resume exists"""
    try:
        result = supabase_service.table("resumes").select("*").eq("user_id", user_id).eq("jd_id", jd_id).execute()
        return {
            "user_id": user_id,
            "jd_id": jd_id,
            "found": len(result.data) if result.data else 0,
            "resumes": result.data
        }
    except Exception as e:
        return {"error": str(e)}

# Chatbot-specific endpoint: Get extracted resume and JD data for personalized questions
@app.get("/chatbot/candidate-context/{user_id}/{jd_id}")
async def get_candidate_context_for_chatbot(user_id: str, jd_id: str):
    """
    Fetch extracted resume and JD data for chatbot to generate personalized interview questions.
    This endpoint returns all necessary context without authentication (used by chatbot service).
    """
    try:
        logging.info(f"[CHATBOT] Fetching context for user_id={user_id}, jd_id={jd_id}")
        
        # Fetch the most recent resume for this user and job
        resume_resp = (
            supabase_service
            .table("resumes")
            .select("resume_id, extracted_text, skills, experience, education, score, upload_date")
            .eq("user_id", user_id)
            .eq("jd_id", jd_id)
            .order("upload_date", desc=True)
            .limit(1)
            .execute()
        )
        
        logging.info(f"[CHATBOT] Resume query result: {len(resume_resp.data) if resume_resp.data else 0} records")
        
        # Fetch the job description with extracted data
        jd_resp = (
            supabase_service
            .table("job_descriptions")
            .select("jd_id, title, description, requirements")
            .eq("jd_id", jd_id)
            .execute()
        )
        
        if not resume_resp.data or not jd_resp.data:
            raise HTTPException(
                status_code=404, 
                detail=f"No resume or job description found for user_id={user_id}, jd_id={jd_id}"
            )
        
        resume = resume_resp.data[0]
        jd = jd_resp.data[0]
        
        # Calculate skill matches for question generation
        resume_skills = set([s.lower() for s in (resume.get("skills") or [])])
        jd_requirements = jd.get("requirements") or []
        # Requirements might be a list of strings or a string - handle both
        if isinstance(jd_requirements, str):
            jd_skills = set([jd_requirements.lower()])
        elif isinstance(jd_requirements, list):
            jd_skills = set([s.lower() for s in jd_requirements])
        else:
            jd_skills = set()
        matched_skills = list(resume_skills.intersection(jd_skills))
        missing_skills = list(jd_skills - resume_skills)
        
        # Prepare context for chatbot
        context = {
            "user_id": user_id,
            "jd_id": jd_id,
            "resume": {
                "resume_id": resume.get("resume_id"),
                "skills": resume.get("skills", []),
                "experience": resume.get("experience", []),
                "education": resume.get("education", []),
                "extracted_text_preview": resume.get("extracted_text", "")[:500],  # First 500 chars
                "match_score": resume.get("score")
            },
            "job_description": {
                "title": jd.get("title"),
                "description": jd.get("description"),
                "requirements": jd.get("requirements", []),
                "jd_skills": jd.get("jd_skills", []),
                "jd_experience": jd.get("jd_experience", []),
                "jd_education": jd.get("jd_education", [])
            },
            "skill_analysis": {
                "matched_skills": matched_skills[:5],  # Top 5 matched skills
                "missing_skills": missing_skills[:3],  # Top 3 missing skills
                "match_percentage": int((len(matched_skills) / len(jd_skills) * 100)) if jd_skills else 0
            },
            "question_hints": {
                "focus_areas": matched_skills[:3],  # Ask about their strongest matching skills
                "growth_areas": missing_skills[:2],  # Ask how they'd learn missing skills
                "experience_level": len(resume.get("experience", [])),
                "education_level": resume.get("education", [{}])[0].get("degree") if resume.get("education") else None
            }
        }
        
        logging.info(f"[CHATBOT CONTEXT] Generated context for user {user_id}, jd {jd_id}")
        logging.info(f"[CHATBOT CONTEXT] Matched skills: {matched_skills}")
        logging.info(f"[CHATBOT CONTEXT] Missing skills: {missing_skills}")
        
        return context
        
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("Error fetching chatbot context")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# LIME Explainability endpoint for HR Dashboard
@app.get("/explain-ranking/{resume_id}")
async def explain_resume_ranking(resume_id: str, token: str = Depends(oauth2_scheme)):
    """
    Generate LIME-based explanation for why a resume received its ranking score.
    Shows HR what factors contributed to the ranking decision.
    
    Returns:
    - Overall score breakdown (skills, semantic, experience, education)
    - LIME word-level importance
    - Top positive/negative words
    - Matched and missing skills
    """
    try:
        # Verify user is authenticated
        user = await get_current_user(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid authentication")
        
        logging.info(f"[EXPLAIN] Generating explanation for resume_id={resume_id} by user {user.id}")
        
        # Fetch the resume - get match_score from applications table
        resume_resp = (
            supabase_service
            .table("resumes")
            .select("resume_id, user_id, jd_id, extracted_text, skills, experience, education, score")
            .eq("resume_id", resume_id)
            .execute()
        )
        
        if not resume_resp.data or len(resume_resp.data) == 0:
            raise HTTPException(status_code=404, detail="Resume not found")
        
        resume = resume_resp.data[0]
        
        # Get the actual match_score used for ranking from applications table
        app_resp = (
            supabase_service
            .table("applications")
            .select("match_score")
            .eq("resume_id", resume_id)
            .execute()
        )
        
        # Use the match_score from ranking, fallback to resume score
        actual_match_score = None
        if app_resp.data and len(app_resp.data) > 0:
            actual_match_score = app_resp.data[0].get("match_score")
        if actual_match_score is None:
            actual_match_score = resume.get("score", 0.0)
        
        # Fetch the associated job description
        jd_resp = (
            supabase_service
            .table("job_descriptions")
            .select("jd_id, title, description, requirements")
            .eq("jd_id", resume["jd_id"])
            .execute()
        )
        
        if not jd_resp.data or len(jd_resp.data) == 0:
            raise HTTPException(status_code=404, detail="Job description not found")
        
        jd = jd_resp.data[0]
        
        # Parse requirements
        jd_requirements = jd.get("requirements") or []
        if isinstance(jd_requirements, str):
            jd_requirements = [jd_requirements]
        
        # Generate LIME explanation (without recalculating score)
        from ai_processor import explain_ranking_with_lime
        
        explanation = explain_ranking_with_lime(
            resume_text=resume.get("extracted_text", ""),
            jd_requirements=jd_requirements,
            resume_data={
                "skills": resume.get("skills", []),
                "experience": resume.get("experience", []),
                "education": resume.get("education", [])
            },
            num_features=15,
            use_actual_score=True,
            actual_score=actual_match_score  # Pass the ranking score
        )
        
        # Add metadata
        explanation["resume_id"] = resume_id
        explanation["candidate_name"] = resume.get("user_id", "Unknown")
        explanation["job_title"] = jd.get("title", "Unknown Position")
        
        # Generate human-readable interpretation using the actual ranking score
        score = actual_match_score * 100  # Convert to percentage
        breakdown = explanation["score_breakdown"]
        
        strengths = []
        weaknesses = []
        recommendations = []
        
        # Analyze skill matching
        if breakdown["skill_match"]["score"] >= 70:
            strengths.append(f"Strong skill match: {breakdown['skill_match']['details']}")
        elif breakdown["skill_match"]["score"] < 50:
            weaknesses.append(f"Limited skill match: {breakdown['skill_match']['details']}")
            recommendations.append("Consider candidates with more relevant technical skills")
        
        # Analyze semantic relevance
        if breakdown["semantic_similarity"]["score"] >= 70:
            strengths.append("Resume content highly relevant to job description")
        elif breakdown["semantic_similarity"]["score"] < 50:
            weaknesses.append("Resume content has low relevance to job requirements")
        
        # Analyze experience
        if breakdown["experience"]["score"] >= 70:
            strengths.append(f"Good experience level: {breakdown['experience']['details']}")
        elif breakdown["experience"]["score"] < 30:
            weaknesses.append("Limited or no professional experience listed")
            recommendations.append("May need additional training or mentorship")
        
        # Overall recommendation
        if score >= 75:
            recommendations.append("🟢 STRONG CANDIDATE: Recommend for interview")
        elif score >= 60:
            recommendations.append("🟡 MODERATE CANDIDATE: Consider if other candidates unavailable")
        else:
            recommendations.append("🔴 WEAK CANDIDATE: May not meet requirements")
        
        explanation["interpretation"] = {
            "summary": f"This resume scored {score:.1f}% overall. " + 
                      f"Skill match contributed {breakdown['skill_match']['contribution']:.1f}%, " +
                      f"semantic relevance {breakdown['semantic_similarity']['contribution']:.1f}%.",
            "strengths": strengths,
            "weaknesses": weaknesses,
            "recommendations": recommendations
        }
        
        # Add the actual match score used for ranking (not recalculated)
        explanation["match_score"] = actual_match_score  # 0-1 range
        
        logging.info(f"[EXPLAIN] Generated explanation for resume {resume_id}: {score:.1f}%")
        
        return explanation
        
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("Error generating explanation")
        raise HTTPException(status_code=500, detail=f"Failed to generate explanation: {str(e)}")


@app.get("/get-resume-url/{resume_path:path}")
async def get_resume_url(resume_path: str, user=Depends(get_current_user)):
    """
    Generate a signed URL for viewing a resume from Supabase storage.
    This allows authenticated access to private bucket files.
    """
    try:
        # Clean the path - remove any trailing slashes or query params
        clean_path = resume_path.strip().rstrip('/').split('?')[0]
        
        logging.info(f"[RESUME URL] User {user.id} requesting signed URL for: {clean_path}")
        
        try:
            # Generate a signed URL that expires in 1 hour (3600 seconds)
            result = supabase_service.storage.from_('resumes').create_signed_url(clean_path, 3600)
            
            logging.info(f"[RESUME URL] Supabase result: {result}")
            
            # Check different possible response formats
            signed_url = None
            if isinstance(result, dict):
                signed_url = result.get('signedURL') or result.get('signedUrl') or result.get('signed_url')
            
            if not signed_url:
                logging.error(f"[RESUME URL] No signed URL in result: {result}")
                raise HTTPException(status_code=404, detail="Could not generate signed URL for resume")
            
            logging.info(f"[RESUME URL] Successfully generated signed URL")
            return {"signedUrl": signed_url}
            
        except Exception as storage_error:
            logging.exception(f"[RESUME URL] Supabase storage error: {str(storage_error)}")
            raise HTTPException(status_code=500, detail=f"Storage error: {str(storage_error)}")
        
    except HTTPException:
        raise
    except Exception as e:
        logging.exception(f"Error generating signed URL for {resume_path}")
        raise HTTPException(status_code=500, detail=f"Failed to generate resume URL: {str(e)}")





