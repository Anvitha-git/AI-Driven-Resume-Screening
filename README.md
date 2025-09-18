# AI-Driven Resume Screening System with Chatbot Integration

A web-based application to streamline hiring for HR teams and enhance the job application experience for candidates. It automates resume screening using AI (Hugging Face, Fairlearn) to parse resumes (PDF, DOC, PNG, JPG) and rank candidates based on job descriptions, with bias mitigation. A Rasa chatbot provides screening questions, resume tips, and FAQs. Features include HR and candidate dashboards, job postings, and email notifications.

## Team
- **Anvitha**: Frontend (React.js), Chatbot (Rasa)
- **Pranav**: Backend (FastAPI, Supabase), AI/ML (Hugging Face, Tesseract)

## Setup
- **Frontend**: `cd frontend && npm install && npm start`
- **Backend**: `cd backend && .\venv\Scripts\activate && pip install -r requirements.txt && uvicorn main:app --reload`
