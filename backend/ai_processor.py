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

from sentence_transformers import SentenceTransformer, util
from fairlearn.metrics import MetricFrame
import pandas as pd
import re
from rapidfuzz import fuzz, process
from collections import Counter
import spacy
from datetime import datetime
from lime.lime_text import LimeTextExplainer
from sklearn.pipeline import make_pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

# Load spaCy model (singleton pattern)
_nlp_model = None

def get_nlp_model():
    global _nlp_model
    if _nlp_model is None:
        try:
            _nlp_model = spacy.load("en_core_web_sm")
        except:
            # Fallback if model not installed
            print("Warning: spaCy model not found. Install with: python -m spacy download en_core_web_sm")
            _nlp_model = None
    return _nlp_model

def extract_skills_from_text(text, use_fuzzy=True):
    """
    Extract skills and requirements from text using advanced NLP and fuzzy matching.
    
    Args:
        text: String containing job requirements or resume text
        use_fuzzy: Enable fuzzy matching for skill variants (e.g., 'React.js' matches 'React')
        
    Returns:
        List of extracted skills/requirements
    """
    if not text or not text.strip():
        return []
    
    # Comprehensive skill database with common variants
    common_skills = [
        # Programming Languages
        'python', 'java', 'javascript', 'c++', 'c#', 'ruby', 'php', 'swift', 'kotlin', 
        'go', 'golang', 'rust', 'scala', 'r', 'matlab', 'typescript', 'sql', 'html', 'css',
        'perl', 'haskell', 'dart', 'elixir', 'clojure', 'objective-c',
        
        # Frameworks & Libraries
        'react', 'react.js', 'reactjs', 'angular', 'vue', 'vue.js', 'node.js', 'nodejs',
        'express', 'express.js', 'django', 'flask', 'spring', 'spring boot', 'springboot',
        'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'sklearn', 'pandas', 'numpy',
        'next.js', 'nextjs', 'nuxt', 'svelte', 'fastapi', 'laravel', 'rails', 'asp.net',
        '.net', 'jquery', 'bootstrap', 'tailwind', 'material-ui', 'redux', 'graphql',
        
        # Technologies & Tools
        'machine learning', 'deep learning', 'artificial intelligence', 'ai', 'ml',
        'data science', 'natural language processing', 'nlp', 'computer vision', 'cv',
        'cloud computing', 'aws', 'amazon web services', 'azure', 'microsoft azure',
        'gcp', 'google cloud', 'docker', 'kubernetes', 'k8s', 'git', 'github', 'gitlab',
        'jenkins', 'ci/cd', 'devops', 'agile', 'scrum', 'kanban', 'jira', 'confluence',
        'terraform', 'ansible', 'prometheus', 'grafana', 'elasticsearch', 'kafka',
        'rabbitmq', 'nginx', 'apache', 'linux', 'unix', 'bash', 'powershell',
        
        # Databases
        'mysql', 'postgresql', 'postgres', 'mongodb', 'redis', 'elasticsearch', 'oracle',
        'sql server', 'mssql', 'cassandra', 'dynamodb', 'sqlite', 'mariadb', 'couchdb',
        'neo4j', 'firebase', 'supabase', 'snowflake', 'bigquery',
        
        # Data & Analytics
        'tableau', 'power bi', 'excel', 'data analysis', 'statistics', 'data visualization',
        'apache spark', 'hadoop', 'etl', 'data warehousing', 'business intelligence',
        
        # Mobile
        'ios development', 'android development', 'react native', 'flutter', 'xamarin',
        
        # Testing & QA
        'unit testing', 'integration testing', 'selenium', 'jest', 'pytest', 'junit',
        'test automation', 'qa', 'quality assurance',
        
        # Soft Skills
        'leadership', 'communication', 'teamwork', 'problem solving', 'analytical thinking',
        'project management', 'collaboration', 'critical thinking', 'time management',
        'adaptability', 'creativity', 'decision making', 'mentoring', 'presentation skills'
    ]
    
    text_lower = text.lower()
    extracted_skills = set()
    
    # Method 1: Exact and partial matching
    for skill in common_skills:
        if skill in text_lower:
            extracted_skills.add(skill)
    
    # Method 2: Fuzzy matching for typos and variants (optional)
    if use_fuzzy:
        # Tokenize text into words and phrases
        words = re.findall(r'\b[a-z][a-z.+#]*\b', text_lower)
        bigrams = [' '.join(words[i:i+2]) for i in range(len(words)-1)]
        trigrams = [' '.join(words[i:i+3]) for i in range(len(words)-2)]
        candidates = set(words + bigrams + trigrams)
        
        for candidate in candidates:
            # Use fuzzy matching to find close skill matches
            matches = process.extract(candidate, common_skills, scorer=fuzz.ratio, limit=1, score_cutoff=85)
            for match in matches:
                # process.extract returns tuples of (match_string, score, index)
                extracted_skills.add(match[0])
    
    # Method 3: Use spaCy NER if available (for company names, job titles)
    nlp = get_nlp_model()
    if nlp:
        doc = nlp(text[:100000])  # Limit text length for performance
        # Extract technical entities
        for ent in doc.ents:
            if ent.label_ in ['ORG', 'PRODUCT', 'GPE']:  # Organizations, products, locations
                ent_lower = ent.text.lower()
                # Check if entity matches any skill
                if any(skill in ent_lower for skill in common_skills):
                    for skill in common_skills:
                        if skill in ent_lower:
                            extracted_skills.add(skill)
    
    # Format skills properly (title case for multi-word, capitalize for single)
    result = []
    for skill in extracted_skills:
        formatted = skill.title() if ' ' in skill or '.' in skill else skill.capitalize()
        # Special cases for acronyms and specific formats
        if skill.upper() in ['AI', 'ML', 'CI/CD', 'AWS', 'GCP', 'SQL', 'HTML', 'CSS', 'API', 'UI', 'UX', 'K8S', 'ETL', 'QA', 'NLP', 'CV']:
            formatted = skill.upper()
        elif skill in ['node.js', 'react.js', 'vue.js', 'express.js', 'next.js']:
            formatted = skill.capitalize().replace('.js', '.js')  # Keep .js lowercase
        result.append(formatted)
    
    # Remove duplicates and sort
    result = sorted(list(set(result)))
    
    return result if result else []

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

    # Extract experience entries with enhanced patterns
    experience = []
    text_lower = text.lower()
    
    # Pattern 1: "Title at Company (dates)" or "Title, Company dates"
    exp_pattern1 = re.findall(
        r'([\w\s]+(?:engineer|developer|manager|analyst|scientist|consultant|designer|architect|specialist|lead|director|coordinator|intern|associate|administrator))'
        r'\s+(?:at|@|,|-|\|)\s+'
        r'([\w\s\-&\.]+?)'
        r'(?:\s*[\(\[]?\s*(?:(\d{4})\s*[-–—to]+\s*(\d{4}|present|current))?[\)\]]?)?',
        text, re.IGNORECASE
    )
    
    for match in exp_pattern1:
        role = match[0].strip()
        company = match[1].strip()
        start_year = match[2] if len(match) > 2 else None
        end_year = match[3] if len(match) > 3 else None
        
        if role and company and len(role) < 60 and len(company) < 60:
            exp_entry = {"role": role.title(), "company": company}
            
            # Calculate years of experience from dates
            if start_year and end_year:
                try:
                    start = int(start_year)
                    if end_year.lower() in ['present', 'current']:
                        end = datetime.now().year
                    else:
                        end = int(end_year)
                    years = max(0, end - start)
                    if years > 0:
                        exp_entry["years"] = years
                except:
                    pass
            
            experience.append(exp_entry)
    
    # Pattern 2: Extract total years of experience mentioned
    years_patterns = [
        r'(\d+)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp)',
        r'experience[:\s]+(\d+)\+?\s*(?:years?|yrs?)',
        r'total[:\s]+(\d+)\+?\s*(?:years?|yrs?)'
    ]
    
    total_years = 0
    for pattern in years_patterns:
        matches = re.findall(pattern, text_lower)
        if matches:
            total_years = max([int(m) for m in matches] + [total_years])
    
    if total_years > 0 and not any('years' in str(e) for e in experience):
        if experience:
            experience[0]["years"] = total_years
        else:
            experience.append({"years": total_years})

    # Extract education entries with enhanced patterns
    education = []
    degree_patterns = re.findall(
        r'(bachelor\'?s?(?:\s+(?:of\s+)?(?:science|arts|engineering|technology))?|'
        r'master\'?s?(?:\s+(?:of\s+)?(?:science|arts|engineering|technology|business administration))?|'
        r'phd|doctorate|mba|b\.?tech|m\.?tech|b\.?sc|m\.?sc|b\.?e|m\.?e|b\.?a|m\.?a)',
        text.lower()
    )
    
    for degree in degree_patterns:
        degree_clean = degree.strip()
        if "." in degree_clean:
            degree_clean = degree_clean.upper()
        else:
            degree_clean = degree_clean.title()
        
        # Standardize common abbreviations
        degree_clean = degree_clean.replace("Bachelor'S", "Bachelor's").replace("Master'S", "Master's")
        
        if not any(e.get("degree") == degree_clean for e in education):
            education.append({"degree": degree_clean})

    # If no structured experience found, extract job titles
    if not experience:
        job_title_pattern = r'\b((?:senior|junior|lead|principal|staff)?\s*(?:software|data|machine learning|frontend|backend|fullstack|full stack)?\s*(?:engineer|developer|scientist|analyst|manager|consultant|designer|architect|programmer|intern|trainee))\b'
        job_titles = re.findall(job_title_pattern, text_lower)
        if job_titles:
            unique_titles = list(dict.fromkeys([t.strip().title() for t in job_titles if len(t.strip()) > 3]))
            for title in unique_titles[:3]:  # Limit to top 3
                experience.append({"role": title})

    return {
        "skills": skills,
        "experience": experience,
        "education": education
    }

def rank_resumes(resumes, jd_requirements, weights=None):
    """
    Advanced resume ranking with multi-factor scoring:
    - Semantic similarity using sentence transformers
    - Exact and fuzzy skill matching
    - Experience relevance and duration
    - Education level matching
    
    Args:
        resumes: List of resume dictionaries with extracted_text, skills, experience, education
        jd_requirements: List of job requirement strings
        weights: Dict with custom weights (default: {"skills": 0.45, "semantic": 0.30, "experience": 0.20, "education": 0.05})
    
    Returns:
        List of tuples: (score, detailed_breakdown) for each resume
    """
    # Use all-mpnet-base-v2 for best balance of accuracy and speed
    # This model outperforms MiniLM with only 2x slower inference (still fast on CPU)
    model = SentenceTransformer('all-mpnet-base-v2')
    jd_text = " ".join(jd_requirements) if jd_requirements else "default job requirements"
    jd_embedding = model.encode(jd_text, convert_to_tensor=True)
    
    # Default weights if not provided - skills matter most
    if not weights:
        weights = {"skills": 0.45, "semantic": 0.30, "experience": 0.20, "education": 0.05}
    
    # Extract required skills from JD with fuzzy matching enabled
    required_skills = set()
    for req in jd_requirements:
        req_skills = extract_skills_from_text(req, use_fuzzy=True)
        required_skills.update([s.lower().strip() for s in req_skills])
    
    # Extract required experience years from JD
    required_years = 0
    year_mentions = re.findall(r'(\d+)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp)', jd_text.lower())
    if year_mentions:
        required_years = max([int(y) for y in year_mentions])
    
    scores = []
    
    for resume in resumes:
        resume_text = resume.get("extracted_text", "")
        if not resume_text or not resume_text.strip():
            scores.append(0.0)
            continue
        
        # Component 1: Semantic Similarity Score (0-1)
        resume_embedding = model.encode(resume_text, convert_to_tensor=True)
        semantic_score = float(util.cos_sim(jd_embedding, resume_embedding)[0][0])
        semantic_score = max(0.0, min(1.0, semantic_score))  # Clamp to [0, 1]
        
        # Component 2: Skill Match Score (0-1) with fuzzy matching
        resume_skills_list = resume.get("skills", [])
        if isinstance(resume_skills_list, str):
            resume_skills_list = [resume_skills_list]
        resume_skills = set([s.lower().strip() for s in resume_skills_list if s])
        
        # Exact match
        exact_matches = len(resume_skills.intersection(required_skills))
        
        # Fuzzy match for remaining required skills
        fuzzy_matches = 0
        resume_text_lower = resume_text.lower()
        for req_skill in required_skills:
            if req_skill not in resume_skills:
                # Check if skill appears in resume text with fuzzy matching
                if req_skill in resume_text_lower:
                    fuzzy_matches += 0.8  # Partial credit for text mention
                else:
                    # Use fuzzy string matching
                    for resume_skill in resume_skills:
                        if fuzz.ratio(req_skill, resume_skill) > 85:
                            fuzzy_matches += 0.9
                            break
        
        total_matches = exact_matches + fuzzy_matches
        skill_score = min(1.0, total_matches / len(required_skills)) if required_skills else 0.0
        
        # Component 3: Experience Score (0-1)
        experience_score = 0.0
        experience_list = resume.get("experience", [])
        
        if experience_list:
            # Calculate total years of experience
            total_years = 0
            role_count = 0
            
            for exp in experience_list:
                if isinstance(exp, dict):
                    total_years += exp.get("years", 0)
                    if exp.get("role"):
                        role_count += 1
            
            # Score based on years (0.7 weight) and number of roles (0.3 weight)
            if required_years > 0:
                year_score = min(1.0, total_years / required_years)
            else:
                year_score = min(1.0, total_years / 5.0)  # Assume 5 years is excellent if not specified
            
            role_score = min(1.0, role_count / 3.0)  # 3+ roles is excellent
            
            experience_score = (year_score * 0.7) + (role_score * 0.3)
        
        # Component 4: Education Score (0-1)
        education_score = 0.0
        education_list = resume.get("education", [])
        
        if education_list:
            # Score based on highest degree
            degree_levels = {
                'phd': 1.0, 'doctorate': 1.0,
                'master': 0.85, 'mba': 0.85, 'm.tech': 0.85, 'm.sc': 0.85, 'm.e': 0.85,
                'bachelor': 0.70, 'b.tech': 0.70, 'b.sc': 0.70, 'b.e': 0.70
            }
            
            max_degree_score = 0.0
            for edu in education_list:
                if isinstance(edu, dict) and edu.get("degree"):
                    degree_text = edu["degree"].lower()
                    for degree_key, score in degree_levels.items():
                        if degree_key in degree_text:
                            max_degree_score = max(max_degree_score, score)
            
            education_score = max_degree_score if max_degree_score > 0 else 0.5  # Default to 0.5 if degree mentioned but not matched
        
        # Final Weighted Score
        final_score = (
            weights.get("skills", 0.45) * skill_score +
            weights.get("semantic", 0.30) * semantic_score +
            weights.get("experience", 0.20) * experience_score +
            weights.get("education", 0.05) * education_score
        )
        
        # Ensure score is between 0 and 1
        final_score = max(0.0, min(1.0, final_score))
        
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


def explain_ranking_with_lime(resume_text, jd_requirements, resume_data, num_features=15, use_actual_score=False, actual_score=None):
    """
    Generate LIME explanation for why a resume received its ranking score.
    
    Args:
        resume_text: The full text content of the resume
        jd_requirements: List of job requirement strings
        resume_data: Dict containing skills, experience, education from the resume
        num_features: Number of top features to show in explanation (default: 15)
        use_actual_score: If True, use the provided actual_score instead of recalculating
        actual_score: The actual ranking score from the database (0-1 range)
    
    Returns:
        Dictionary containing:
        - score_breakdown: Dict with component scores (skills, semantic, experience, education)
        - lime_explanation: List of (word/phrase, importance_weight) tuples
        - top_positive_words: Words that boosted the score
        - top_negative_words: Words that hurt the score
        - matched_skills: List of skills that matched the JD
        - missing_skills: List of required skills not found in resume
    """
    
    # Calculate the actual ranking score with breakdown
    jd_text = " ".join(jd_requirements) if jd_requirements else "default job requirements"
    model = SentenceTransformer('all-mpnet-base-v2')
    jd_embedding = model.encode(jd_text, convert_to_tensor=True)
    resume_embedding = model.encode(resume_text, convert_to_tensor=True)
    
    # Component scores
    semantic_score = float(util.cos_sim(jd_embedding, resume_embedding)[0][0])
    semantic_score = max(0.0, min(1.0, semantic_score))
    
    # Skill matching
    required_skills = set()
    for req in jd_requirements:
        req_skills = extract_skills_from_text(req, use_fuzzy=True)
        required_skills.update([s.lower().strip() for s in req_skills])
    
    resume_skills_list = resume_data.get("skills", [])
    if isinstance(resume_skills_list, str):
        resume_skills_list = [resume_skills_list]
    resume_skills = set([s.lower().strip() for s in resume_skills_list if s])
    
    # Exact match
    exact_matches = resume_skills.intersection(required_skills)
    
    # Fuzzy match for remaining required skills
    fuzzy_match_count = 0
    resume_text_lower = resume_text.lower()
    for req_skill in required_skills:
        if req_skill not in resume_skills:
            # Check if skill appears in resume text
            if req_skill in resume_text_lower:
                fuzzy_match_count += 0.8  # Partial credit for text mention
            else:
                # Use fuzzy string matching
                for resume_skill in resume_skills:
                    if fuzz.ratio(req_skill, resume_skill) > 85:
                        fuzzy_match_count += 0.9
                        break
    
    total_matches = len(exact_matches) + fuzzy_match_count
    skill_score = min(1.0, total_matches / len(required_skills)) if required_skills else 0.0
    missing_skills = list(required_skills - resume_skills)
    
    # Experience score - FIXED to match rank_resumes logic
    experience_score = 0.0
    experience_list = resume_data.get("experience", [])
    required_years = 0
    
    # Extract required experience from JD
    year_mentions = re.findall(r'(\d+)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp)', jd_text.lower())
    if year_mentions:
        required_years = max([int(y) for y in year_mentions])
    
    if experience_list:
        total_years = 0
        role_count = 0
        for exp in experience_list:
            if isinstance(exp, dict):
                total_years += exp.get("years", 0)
                if exp.get("role"):
                    role_count += 1
        
        # Score based on years (0.7 weight) and number of roles (0.3 weight)
        if required_years > 0:
            year_score = min(1.0, total_years / required_years)
        else:
            year_score = min(1.0, total_years / 5.0)  # Assume 5 years is excellent
        
        role_score = min(1.0, role_count / 3.0)  # 3+ roles is excellent
        experience_score = (year_score * 0.7) + (role_score * 0.3)
    
    # Education score
    education_score = 0.0
    education_list = resume_data.get("education", [])
    if education_list:
        degree_levels = {
            'phd': 1.0, 'doctorate': 1.0,
            'master': 0.85, 'mba': 0.85, 'm.tech': 0.85, 'm.sc': 0.85,
            'bachelor': 0.70, 'b.tech': 0.70, 'b.sc': 0.70, 'b.e': 0.70
        }
        for edu in education_list:
            if isinstance(edu, dict) and edu.get("degree"):
                degree_text = edu["degree"].lower()
                for degree_key, score in degree_levels.items():
                    if degree_key in degree_text:
                        education_score = max(education_score, score)
    
    # Final weighted score
    weights = {"skills": 0.45, "semantic": 0.30, "experience": 0.20, "education": 0.05}
    
    # Use actual score from ranking if provided, otherwise calculate
    if use_actual_score and actual_score is not None:
        overall_score = actual_score  # Already in 0-1 range
    else:
        overall_score = (
            weights["skills"] * skill_score +
            weights["semantic"] * semantic_score +
            weights["experience"] * experience_score +
            weights["education"] * education_score
        )
        overall_score = max(0.0, min(1.0, overall_score))
    
    # LIME Text Explanation
    # Create a simple predictor function for LIME
    def score_predictor(text_samples):
        """Predict ranking scores for text samples"""
        scores = []
        for text in text_samples:
            # Simplified scoring based on text similarity to JD
            text_embedding = model.encode(text, convert_to_tensor=True)
            similarity = float(util.cos_sim(jd_embedding, text_embedding)[0][0])
            
            # Check for skill mentions
            skill_count = sum([1 for skill in required_skills if skill in text.lower()])
            skill_boost = min(0.3, skill_count * 0.05)
            
            # Final prediction (binary classification for LIME)
            # Convert to probability: high score = high probability of "good match"
            prob_good = max(0.0, min(1.0, similarity + skill_boost))
            prob_bad = 1.0 - prob_good
            scores.append([prob_bad, prob_good])
        
        return np.array(scores)
    
    # Create LIME explainer
    explainer = LimeTextExplainer(class_names=['Poor Match', 'Good Match'], random_state=42)
    
    # Generate explanation
    try:
        exp = explainer.explain_instance(
            resume_text, 
            score_predictor, 
            num_features=num_features,
            num_samples=500
        )
        
        # Extract feature weights
        lime_features = exp.as_list()
        
        # Separate positive and negative contributors
        positive_words = [(word, weight) for word, weight in lime_features if weight > 0]
        negative_words = [(word, weight) for word, weight in lime_features if weight < 0]
        
        # Sort by absolute importance
        positive_words.sort(key=lambda x: x[1], reverse=True)
        negative_words.sort(key=lambda x: x[1])
        
    except Exception as e:
        print(f"LIME explanation failed: {e}")
        lime_features = []
        positive_words = []
        negative_words = []
    
    return {
        "score_breakdown": {
            "skill_match": {
                "score": round(skill_score * 100, 2),
                "weight": weights["skills"] * 100,
                "contribution": round(weights["skills"] * skill_score * 100, 2),
                "details": f"{len(exact_matches)}/{len(required_skills)} required skills matched"
            },
            "semantic_similarity": {
                "score": round(semantic_score * 100, 2),
                "weight": weights["semantic"] * 100,
                "contribution": round(weights["semantic"] * semantic_score * 100, 2),
                "details": "Resume content relevance to job description"
            },
            "experience": {
                "score": round(experience_score * 100, 2),
                "weight": weights["experience"] * 100,
                "contribution": round(weights["experience"] * experience_score * 100, 2),
                "details": f"{len(experience_list)} work experiences found"
            },
            "education": {
                "score": round(education_score * 100, 2),
                "weight": weights["education"] * 100,
                "contribution": round(weights["education"] * education_score * 100, 2),
                "details": f"{len(education_list)} education entries found"
            }
        },
        "lime_explanation": lime_features,
        "top_positive_words": positive_words[:10],
        "top_negative_words": negative_words[:10],
        "matched_skills": list(exact_matches),
        "missing_skills": missing_skills[:10]
    }
