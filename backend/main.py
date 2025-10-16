# from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
# from fastapi.security import OAuth2PasswordBearer
# from supabase import create_client, Client
# import os
# from dotenv import load_dotenv
# from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel
# from typing import List, Optional
# import uuid

# load_dotenv()

# app = FastAPI()
# supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# # Enable CORS
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["http://localhost:3000"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# # Pydantic models
# class JobPosting(BaseModel):
#     title: str
#     description: str
#     requirements: List[str]
#     deadline: Optional[str]

# class User(BaseModel):
#     email: str
#     password: str

# # Authentication
# async def get_current_user(token: str = Depends(oauth2_scheme)):
#     try:
#         user = supabase.auth.get_user(token).user
#         return user
#     except Exception:
#         raise HTTPException(status_code=401, detail="Invalid token")

# @app.post("/login")
# async def login(user: User):
#     try:
#         response = supabase.auth.sign_in_with_password({
#             "email": user.email,
#             "password": user.password
#         })
#         return {"access_token": response.session.access_token, "token_type": "bearer"}
#     except Exception:
#         raise HTTPException(status_code=401, detail="Invalid credentials")

# @app.post("/demo-login/{role}")
# async def demo_login(role: str):
#     if role not in ["demo_hr", "demo_candidate"]:
#         raise HTTPException(status_code=400, detail="Invalid demo role")
#     email = "demo_hr@project.com" if role == "demo_hr" else "demo_candidate@project.com"
#     password = "DemoHR123" if role == "demo_hr" else "DemoCandidate123"
#     try:
#         response = supabase.auth.sign_in_with_password({
#             "email": email,
#             "password": password
#         })
#         return {"access_token": response.session.access_token, "token_type": "bearer"}
#     except Exception:
#         raise HTTPException(status_code=401, detail="Demo login failed")

# # Job postings
# @app.post("/jobs", response_model=JobPosting)
# async def create_job(job: JobPosting, user: dict = Depends(get_current_user)):
#     if user.role not in ["HR", "demo_hr"]:
#         raise HTTPException(status_code=403, detail="Not authorized")
#     data = supabase.table("job_descriptions").insert({
#         "hr_user_id": user.id,
#         "title": job.title,
#         "description": job.description,
#         "requirements": job.requirements,
#         "deadline": job.deadline
#     }).execute()
#     return data.data[0]
# @app.get("/")
# async def root():
#     return {"message": "Backend running. Use /docs for API docs."}
# @app.get("/jobs")
# async def get_jobs():
#     response = supabase.table("job_descriptions").select("*").execute()
#     return response.data

# # Resume upload
# @app.post("/upload-resume/{jd_id}")
# async def upload_resume(jd_id: str, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
#     if user.role not in ["job_seeker", "demo_candidate"]:
#         raise HTTPException(status_code=403, detail="Not authorized")
#     if file.content_type not in ["application/pdf", "application/msword", "image/png", "image/jpeg"]:
#         raise HTTPException(status_code=400, detail="Invalid file type")
#     file_content = await file.read()
#     file_name = f"{uuid.uuid4()}_{file.filename}"
#     supabase.storage.from_("resumes").upload(file_name, file_content)
#     file_url = supabase.storage.from_("resumes").get_public_url(file_name)
#     data = supabase.table("resumes").insert({
#         "user_id": user.id,
#         "jd_id": jd_id,
#         "file_url": file_url
#     }).execute()
#     supabase.table("applications").insert({
#         "user_id": user.id,
#         "jd_id": jd_id,
#         "resume_id": data.data[0]["resume_id"],
#         "status": "applied"
#     }).execute()
#     return {"message": "Resume uploaded successfully", "resume_id": data.data[0]["resume_id"]}

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.security import OAuth2PasswordBearer
from supabase import create_client, Client
import os
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uuid
import logging
from ai_processor import extract_text, extract_structured_data, rank_resumes

# Configure logging
logging.basicConfig(level=logging.INFO)

load_dotenv()

app = FastAPI()
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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

class User(BaseModel):
    email: str
    password: str

# Authentication
async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        res = supabase.auth.get_user(token)
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
        response = supabase.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password
        })
        return {"access_token": response.session.access_token, "token_type": "bearer"}
    except Exception as e:
        logging.exception("Login error")
        raise HTTPException(status_code=401, detail="Invalid credentials")

@app.post("/demo-login/{role}")
async def demo_login(role: str):
    if role not in ["demo_hr", "demo_candidate"]:
        raise HTTPException(status_code=400, detail="Invalid demo role")
    email = "demo_hr@project.com" if role == "demo_hr" else "demo_candidate@project.com"
    password = "DemoHR123" if role == "demo_hr" else "DemoCandidate123"
    try:
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        return {"access_token": response.session.access_token, "token_type": "bearer"}
    except Exception as e:
        logging.exception(f"Demo login failed for role: {role}")
        raise HTTPException(status_code=401, detail="Demo login failed")

# Job postings
@app.post("/jobs", response_model=JobPosting)
async def create_job(job: JobPosting, user=Depends(get_current_user)):
    if user.role not in ["HR", "demo_hr"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        data = supabase.table("job_descriptions").insert({
            "hr_user_id": user.id,
            "title": job.title,
            "description": job.description,
            "requirements": job.requirements,
            "deadline": job.deadline
        }).execute()
        return data.data[0]
    except Exception as e:
        logging.exception("Error creating job")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/jobs")
async def get_jobs():
    try:
        response = supabase.table("job_descriptions").select("*").execute()
        return response.data
    except Exception as e:
        logging.exception("Error fetching jobs")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# Resume upload with AI parsing
@app.post("/upload-resume/{jd_id}")
async def upload_resume(jd_id: str, file: UploadFile = File(...), user=Depends(get_current_user)):
    if user.role not in ["job_seeker", "demo_candidate"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if file.content_type not in ["application/pdf", "application/msword", "image/png", "image/jpeg"]:
        raise HTTPException(status_code=400, detail="Invalid file type")
    try:
        file_content = await file.read()
        file_name = f"{uuid.uuid4()}_{file.filename}"
        supabase.storage.from_("resumes").upload(file_name, file_content)
        file_url = supabase.storage.from_("resumes").get_public_url(file_name)
        # Save file temporarily for AI parsing
        temp_file = f"temp_{file_name}"
        with open(temp_file, "wb") as f:
            f.write(file_content)
        text = extract_text(temp_file, file.content_type)
        structured_data = extract_structured_data(text)
        data = supabase.table("resumes").insert({
            "user_id": user.id,
            "jd_id": jd_id,
            "file_url": file_url,
            "extracted_text": text,
            **structured_data
        }).execute()
        supabase.table("applications").insert({
            "user_id": user.id,
            "jd_id": jd_id,
            "resume_id": data.data[0]["resume_id"],
            "status": "applied"
        }).execute()
        os.remove(temp_file)
        return {"message": "Resume uploaded successfully", "resume_id": data.data[0]["resume_id"]}
    except Exception as e:
        logging.exception("Error inserting resume or application")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# Resume ranking
@app.post("/rank-resumes/{jd_id}")
async def rank_resumes_endpoint(jd_id: str, user=Depends(get_current_user)):
    if user.role not in ["HR", "demo_hr"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        jd = supabase.table("job_descriptions").select("requirements").eq("jd_id", jd_id).execute().data[0]
        resumes = supabase.table("resumes").select("*").eq("jd_id", jd_id).execute().data
        scores = rank_resumes(resumes, jd["requirements"])
        for resume, score in zip(resumes, scores):
            supabase.table("applications").update({"match_score": float(score)}).eq("resume_id", resume["resume_id"]).execute()
        return {"message": "Resumes ranked successfully"}
    except Exception as e:
        logging.exception("Error ranking resumes")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/")
async def root():
    return {"message": "Hello from FastAPI!"}