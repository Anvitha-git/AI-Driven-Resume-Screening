import os
import pdfplumber
from docx import Document
import pytesseract
from PIL import Image
import cv2
import numpy as np

# Force Transformers to avoid importing TensorFlow/Flax; use PyTorch only
os.environ.setdefault("TRANSFORMERS_NO_TF", "1")
os.environ.setdefault("TRANSFORMERS_NO_FLAX", "1")

from sentence_transformers import SentenceTransformer
from fairlearn.metrics import MetricFrame
import pandas as pd
import re

def extract_skills_from_text(text):
    """
    Extract skills and requirements from a paragraph of text.
    Uses NLP and keyword matching to identify technical skills, soft skills, and experience.
    
    Args:
        text: String containing job requirements in paragraph form
        
    Returns:
        List of extracted skills/requirements
    """
    if not text or not text.strip():
        return []
    
    # Common technical skills and keywords
    common_skills = [
        # Programming Languages
        'python', 'java', 'javascript', 'c++', 'c#', 'ruby', 'php', 'swift', 'kotlin', 
        'go', 'rust', 'scala', 'r', 'matlab', 'typescript', 'sql', 'html', 'css',
        
        # Frameworks & Libraries
        'react', 'angular', 'vue', 'node.js', 'express', 'django', 'flask', 'spring',
        'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'pandas', 'numpy',
        
        # Technologies & Tools
        'machine learning', 'deep learning', 'artificial intelligence', 'ai', 'ml',
        'data science', 'natural language processing', 'nlp', 'computer vision',
        'cloud computing', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'git',
        'jenkins', 'ci/cd', 'devops', 'agile', 'scrum',
        
        # Databases
        'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'oracle',
        'sql server', 'cassandra', 'dynamodb',
        
        # Soft Skills
        'leadership', 'communication', 'teamwork', 'problem solving', 'analytical',
        'project management', 'collaboration', 'critical thinking'
    ]
    
    text_lower = text.lower()
    extracted = []
    
    # Extract skills that appear in the text
    for skill in common_skills:
        if skill in text_lower:
            # Add the skill in proper case
            extracted.append(skill.title() if ' ' in skill else skill.capitalize())
    
    # Extract experience patterns (e.g., "5 years", "3+ years")
    experience_patterns = re.findall(r'(\d+[\+]?\s*(?:year|yr)s?(?:\s+(?:of\s+)?experience)?)', text_lower)
    for exp in experience_patterns:
        extracted.append(exp.strip().title())
    
    # Extract degree patterns (e.g., "Bachelor's", "Master's", "PhD")
    degree_patterns = re.findall(r'(bachelor[\'s]*|master[\'s]*|phd|doctorate|mba|b\.tech|m\.tech|b\.sc|m\.sc)', text_lower)
    for degree in degree_patterns:
        extracted.append(degree.upper() if '.' in degree else degree.title())
    
    # Remove duplicates while preserving order
    seen = set()
    result = []
    for item in extracted:
        if item.lower() not in seen:
            seen.add(item.lower())
            result.append(item)
    
    return result if result else [text.strip()]  # Return original text if no skills found

def preprocess_image(file_path):
    img = cv2.imread(file_path, cv2.IMREAD_GRAYSCALE)
    img = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    return img

def extract_text(file_path, file_type):
    if file_type == "application/pdf":
        with pdfplumber.open(file_path) as pdf:
            text = "".join(page.extract_text() for page in pdf.pages)
    elif file_type in ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]:
        doc = Document(file_path)
        text = "".join(paragraph.text for paragraph in doc.paragraphs)
    elif file_type in ["image/png", "image/jpeg"]:
        img = preprocess_image(file_path)
        text = pytesseract.image_to_string(Image.fromarray(img))
    else:
        raise ValueError("Unsupported file type")
    return text

def extract_structured_data(text):
    # Extract skills using NLP/keyword matching
    skills = extract_skills_from_text(text)
    
    # Remove year/degree entries from skills (they were added by extract_skills_from_text)
    skills = [s for s in skills if not re.search(r'\d+\s*(?:year|yr)', s.lower()) and not re.search(r'bachelor|master|phd|b\.tech|m\.tech', s.lower())]

    # Extract experience entries with multiple patterns
    experience = []
    text_lower = text.lower()
    
    # Pattern 1: "Software Engineer at Google" or "Developer at Microsoft"
    exp_pattern1 = re.findall(r'([\w\s]+(?:engineer|developer|manager|analyst|scientist|consultant|designer|architect|specialist|lead|director|coordinator))\s+(?:at|@)\s+([\w\s\-&\.]+)', text, re.IGNORECASE)
    for match in exp_pattern1:
        role = match[0].strip()
        company = match[1].strip()
        if role and company and len(role) < 50 and len(company) < 50:
            experience.append({"role": role, "company": company})
    
    # Pattern 2: Extract years of experience mentioned anywhere
    years_pattern = re.findall(r'(\d+)[\+]?\s*(?:year|yr)s?\s+(?:of\s+)?(?:experience|exp)', text_lower)
    if years_pattern and not experience:
        # If we found years but no specific roles, add a general entry
        total_years = max([int(y) for y in years_pattern])
        experience.append({"years": total_years})

    # Extract education entries
    education = []
    degree_patterns = re.findall(r'(bachelor[\'s]*|master[\'s]*|phd|doctorate|mba|b\.tech|m\.tech|b\.sc|m\.sc|b\.e|m\.e)', text.lower())
    for degree in degree_patterns:
        degree_clean = degree.upper() if "." in degree else degree.title()
        if not any(e.get("degree") == degree_clean for e in education):  # avoid duplicates
            education.append({"degree": degree_clean})

    # If no structured experience found, try to extract any job-related keywords
    if not experience:
        job_titles = re.findall(r'\b(software engineer|developer|data scientist|analyst|manager|consultant|designer|architect|intern|trainee)\b', text_lower)
        if job_titles:
            # Use first found job title
            experience.append({"role": job_titles[0].title()})

    return {
        "skills": skills,
        "experience": experience,
        "education": education
    }

def rank_resumes(resumes, jd_requirements, weights=None):
    """
    Rank resumes based on similarity to job requirements with optional weighting.
    
    Args:
        resumes: List of resume dictionaries with extracted_text, skills, experience
        jd_requirements: List of job requirement strings
        weights: Dict with optional weights like {"skills": 0.6, "experience": 0.3, "education": 0.1}
    
    Returns:
        List of scores (0-1) for each resume
    """
    ## Use sentence-transformers for fast, accurate semantic similarity
    model = SentenceTransformer('all-MiniLM-L6-v2')
    jd_text = " ".join(jd_requirements) if jd_requirements else "default job requirements"
    jd_embedding = model.encode(jd_text)
    scores = []
    
    # Default weights if not provided
    if not weights:
        weights = {"skills": 0.4, "experience": 0.4, "education": 0.2}
    
    # Prepare for ensemble scoring
    # Extract required skills from JD requirements (lowercase and cleaned)
    required_skills = set()
    for req in jd_requirements:
        # Extract skills from requirement text using the same function
        req_skills = extract_skills_from_text(req)
        required_skills.update([s.lower().strip() for s in req_skills])
    
    # If no skills extracted, use the requirements as-is
    if not required_skills:
        required_skills = set([s.lower().strip() for s in jd_requirements])
    
    for resume in resumes:
        resume_text = resume.get("extracted_text", "")
        if not resume_text or not resume_text.strip():
            scores.append(0.0)
            continue
        
        # 1. Semantic similarity (MiniLM)
        resume_embedding = model.encode(resume_text)
        base_score = np.dot(jd_embedding, resume_embedding) / (
            np.linalg.norm(jd_embedding) * np.linalg.norm(resume_embedding)
        )

        # 2. Keyword match score (proportion of required skills present)
        resume_skills_list = resume.get("skills", [])
        if isinstance(resume_skills_list, str):
            resume_skills_list = [resume_skills_list]
        resume_skills = set([s.lower().strip() for s in resume_skills_list if s])
        
        # Also check if skills appear in resume text (partial matching)
        resume_text_lower = resume_text.lower()
        matched_skills = 0
        for req_skill in required_skills:
            if req_skill in resume_skills or req_skill in resume_text_lower:
                matched_skills += 1
        
        if required_skills:
            keyword_score = matched_skills / len(required_skills)
        else:
            keyword_score = 0.0

        # 3. Experience boost
        experience_boost = 1.0
        experience_list = resume.get("experience", [])
        if experience_list:
            # Boost score if candidate has experience
            experience_boost = 1.1
            # Additional boost for years of experience
            total_years = sum([exp.get("years", 0) for exp in experience_list if isinstance(exp, dict)])
            if total_years > 0:
                experience_boost += min(total_years * 0.02, 0.2)  # Max 20% boost

        # 4. Weighted combination of scores
        skill_weight = weights.get("skills", 0.4)
        exp_weight = weights.get("experience", 0.4)
        edu_weight = weights.get("education", 0.2)
        
        # Combine: semantic similarity + keyword match + experience boost
        # Give more weight to keyword matching (direct skill match)
        final_score = (base_score * 0.3) + (keyword_score * 0.5) + (base_score * experience_boost * 0.2)
        
        # Ensure score is between 0 and 1
        final_score = min(max(final_score, 0.0), 1.0)
        scores.append(final_score)
    
    # Fairlearn bias check (optional, for transparency)
    try:
        if len(resumes) > 0:
            df = pd.DataFrame({
                "scores": scores,
                "group": [resume.get("education", [{}])[0].get("degree", "Unknown") if resume.get("education") else "Unknown" for resume in resumes]
            })
            mf = MetricFrame(metrics={"mean_score": np.mean}, y_true=[1]*len(scores), y_pred=scores, sensitive_features=df["group"])
            print(f"Bias metrics by group: {mf.by_group}")
    except Exception as e:
        print(f"Fairlearn bias check failed: {e}")
    
    return scores