import pdfplumber
from docx import Document
import pytesseract
from PIL import Image
import cv2
import numpy as np
from transformers import pipeline
from fairlearn.metrics import MetricFrame
import pandas as pd

def preprocess_image(file_path):
    img = cv2.imread(file_path, cv2.IMREAD_GRAYSCALE)
    img = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    return img

def extract_text(file_path, file_type):
    if file_type == "application/pdf":
        with pdfplumber.open(file_path) as pdf:
            text = "".join(page.extract_text() for page in pdf.pages)
    elif file_type == "application/msword":
        doc = Document(file_path)
        text = "".join(paragraph.text for paragraph in doc.paragraphs)
    elif file_type in ["image/png", "image/jpeg"]:
        img = preprocess_image(file_path)
        text = pytesseract.image_to_string(Image.fromarray(img))
    else:
        raise ValueError("Unsupported file type")
    return text

def extract_structured_data(text):
    # Simplified extraction (expand with regex/NLP as needed)
    return {
        "skills": ["Python", "Java"] if "Python" in text else [],
        "experience": [{"role": "Developer", "years": 2}] if "developer" in text.lower() else [],
        "education": [{"degree": "B.Tech"}] if "b.tech" in text.lower() else []
    }

def rank_resumes(resumes, jd_requirements):
    nlp = pipeline("feature-extraction", model="bert-base-uncased", truncation=True, max_length=512)
    jd_text = " ".join(jd_requirements) if jd_requirements else "default job requirements"
    jd_embedding = nlp(jd_text)[0][0]
    scores = []
    for resume in resumes:
        resume_text = resume.get("extracted_text", "")
        # Handle empty or None text
        if not resume_text or not resume_text.strip():
            scores.append(0.0)
            continue
        resume_embedding = nlp(resume_text)[0][0]
        score = np.dot(jd_embedding, resume_embedding) / (
            np.linalg.norm(jd_embedding) * np.linalg.norm(resume_embedding)
        )
        scores.append(score)
    # Note: Fairlearn MetricFrame is for evaluating predictions against ground truth
    # For ranking/scoring without ground truth, we simply return the computed scores
    return scores