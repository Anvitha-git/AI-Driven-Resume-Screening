from typing import Any, Text, Dict, List
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet
import requests
import random
import re

SUPABASE_URL = "https://exbmjznbphjujgngtnrz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4Ym1qem5icGhqdWpnbmd0bnJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODAyOTMwMCwiZXhwIjoyMDczNjA1MzAwfQ.jxObxiiMAmAGph2BG0sczni2cdRiz_buAPee0zIywl8"
headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}


class ActionStartInterviewPrep(Action):
    def name(self) -> Text:
        return "action_start_interview_prep"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        # Get user_id and jd_id from metadata or slots
        metadata = tracker.latest_message.get("metadata", {})
        user_id = metadata.get("user_id") or tracker.sender_id
        jd_id = metadata.get("jd_id") or tracker.get_slot("jd_id")

        print(f"[DEBUG] 🔍 Received user_id: {user_id}, jd_id: {jd_id}")

        if not jd_id:
            dispatcher.utter_message(text="I couldn't find which job you applied to. Please make sure you've uploaded your resume to a job posting.")
            return []

        # Fetch resume + JD from Supabase
        try:
            # Get the most recent resume for this user and job
            resume_url = f"{SUPABASE_URL}/rest/v1/resumes?user_id=eq.{user_id}&jd_id=eq.{jd_id}&select=*&order=created_at.desc&limit=1"
            jd_url = f"{SUPABASE_URL}/rest/v1/job_descriptions?jd_id=eq.{jd_id}&select=*"
            
            print(f"[DEBUG] 📡 Fetching resume from: {resume_url}")
            print(f"[DEBUG] 📡 Fetching JD from: {jd_url}")
            
            resume_resp = requests.get(resume_url, headers=headers)
            jd_resp = requests.get(jd_url, headers=headers)
            
            print(f"[DEBUG] Resume response status: {resume_resp.status_code}")
            print(f"[DEBUG] JD response status: {jd_resp.status_code}")

            resumes = resume_resp.json()
            jds = jd_resp.json()
            
            print(f"[DEBUG] Found {len(resumes) if isinstance(resumes, list) else 0} resumes")
            print(f"[DEBUG] Found {len(jds) if isinstance(jds, list) else 0} job descriptions")

            if not resumes or not jds or len(resumes) == 0 or len(jds) == 0:
                # Fallback: Try to get ANY resume for this user (maybe jd_id is wrong)
                print(f"[WARNING] ⚠️ No resume found with jd_id={jd_id}. Trying to fetch any resume for user {user_id}...")
                fallback_resume_resp = requests.get(
                    f"{SUPABASE_URL}/rest/v1/resumes?user_id=eq.{user_id}&select=*&order=created_at.desc&limit=1",
                    headers=headers
                )
                fallback_resumes = fallback_resume_resp.json()
                
                if fallback_resumes and len(fallback_resumes) > 0:
                    print(f"[DEBUG] ✅ Found a resume! Using resume_id: {fallback_resumes[0].get('resume_id')}")
                    resumes = fallback_resumes
                    # Also get the correct JD for this resume
                    actual_jd_id = fallback_resumes[0].get('jd_id')
                    if actual_jd_id:
                        jd_resp = requests.get(
                            f"{SUPABASE_URL}/rest/v1/job_descriptions?jd_id=eq.{actual_jd_id}&select=*",
                            headers=headers
                        )
                        jds = jd_resp.json()
                        jd_id = actual_jd_id  # Update jd_id
                        print(f"[DEBUG] ✅ Updated jd_id to: {jd_id}")
                
                if not resumes or not jds or len(resumes) == 0 or len(jds) == 0:
                    raise Exception(f"No resume found for user {user_id} at all. User may not have uploaded a resume yet.")

            resume = resumes[0]
            jd = jds[0]

            # Debug logging
            print("=" * 60)
            print("[DEBUG] ✅ Successfully fetched resume and JD!")
            print(f"[DEBUG] Resume ID: {resume.get('resume_id')}")
            print(f"[DEBUG] Resume Skills: {resume.get('skills')}")
            print(f"[DEBUG] Resume Experience: {resume.get('experience')}")
            print(f"[DEBUG] Resume Text Length: {len(resume.get('extracted_text', ''))}")
            print(f"[DEBUG] Job Title: {jd.get('title')}")
            print(f"[DEBUG] Job Requirements: {jd.get('requirements')}")
            print("=" * 60)

            # Extract key info
            skills = resume.get("skills", []) or []
            experience = resume.get("experience", []) or []
            jd_requirements = jd.get("requirements", []) or []
            jd_title = jd.get("title", "this role")
            resume_text = resume.get("extracted_text", "").lower()
            
            # Additional validation
            if not skills and not experience and not jd_requirements:
                print("[WARNING] ⚠️ No skills, experience, or requirements found!")
                print("[WARNING] This will result in generic questions.")
            
            print(f"[DEBUG] Extracted Skills: {skills}")
            print(f"[DEBUG] Extracted Experience: {experience}")
            print(f"[DEBUG] JD Requirements: {jd_requirements}")

            # Generate 3-5 personalized questions
            questions = []

            # 1-2 questions from JD requirements
            for i, skill in enumerate(jd_requirements[:2]):
                if skill.lower() in resume_text:
                    questions.append(f"Tell me about a time you used **{skill}** in a project. (Keep it to 1-2 sentences)")
                else:
                    questions.append(f"How would you approach learning **{skill}** for this role? (Keep it to 1-2 sentences)")

            # 1 question from resume skills
            if skills and len(skills) > 0:
                skill = skills[0] if isinstance(skills, list) else str(skills)
                questions.append(f"You mentioned **{skill}** in your resume — give me one example of how you've used it. (1-2 sentences)")

            # 1 question from experience
            if experience and len(experience) > 0:
                exp = experience[0] if isinstance(experience, list) else {}
                if isinstance(exp, dict):
                    role = exp.get('role', 'your previous role')
                    questions.append(f"In **{role}**, what was your biggest achievement? (1-2 sentences)")
                else:
                    questions.append(f"Tell me about your most impactful project. (1-2 sentences)")

            # 1 general question
            questions.append(f"Why are you excited about the **{jd_title}** position? (1-2 sentences)")

            # Limit to 3-5 questions
            questions = questions[:random.randint(3, min(5, len(questions)))]
            
            print(f"[DEBUG] 🎯 Generated {len(questions)} questions:")
            for i, q in enumerate(questions, 1):
                print(f"[DEBUG]   {i}. {q}")

            # Send intro message and first question immediately
            dispatcher.utter_message(text="Great! Let's do a quick 2-min interview prep. I'll ask you a few short questions to help you practice. 🚀")
            
            # Ask the first question immediately
            if len(questions) > 0:
                dispatcher.utter_message(text=f"**Question 1:** {questions[0]}")

            # Save to slots
            return [
                SlotSet("interview_questions", questions),
                SlotSet("current_question_index", 0),
                SlotSet("question_answers", []),
                SlotSet("jd_id", jd_id),
                SlotSet("user_id", user_id)
            ]

        except Exception as e:
            import traceback
            print(f"[ERROR] Exception occurred: {e}")
            print(f"[ERROR] Full traceback:")
            traceback.print_exc()
            print(f"[ERROR] user_id: {user_id}, jd_id: {jd_id}")
            # Fallback to generic questions
            dispatcher.utter_message(text="I couldn't fetch your resume data. Let me ask some general questions instead...")
            return [
                SlotSet("interview_questions", [
                    "Tell me about a project you're proud of. (1-2 sentences)",
                    "How do you handle tight deadlines? (1-2 sentences)",
                    "Why are you interested in this role? (1-2 sentences)"
                ]),
                SlotSet("current_question_index", 0),
                SlotSet("question_answers", []),
                SlotSet("jd_id", jd_id),
                SlotSet("user_id", user_id)
            ]


class ActionAskNextQuestion(Action):
    def name(self) -> Text:
        return "action_ask_next_question"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        questions = tracker.get_slot("interview_questions") or []
        index = tracker.get_slot("current_question_index") or 0

        if index >= len(questions):
            dispatcher.utter_message(text="🎉 You're all set! Great prep session — you've got this! Good luck with your application! 💪")
            return [SlotSet("current_question_index", None)]

        question = questions[index]
        dispatcher.utter_message(text=f"**Question {index + 1}:** {question}")
        return []


class ActionValidateAnswer(Action):
    def name(self) -> Text:
        return "action_validate_answer"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        answer = tracker.latest_message.get("text", "").strip()
        answers = tracker.get_slot("question_answers") or []
        current_index = tracker.get_slot("current_question_index") or 0

        # Validate: 1-2 sentences, no rubbish
        sentences = re.split(r'[.!?]+', answer)
        sentences = [s.strip() for s in sentences if s.strip() and len(s.strip()) > 3]

        if len(sentences) == 0 or len(answer) < 10:
            dispatcher.utter_message(text="Hmm, I didn't catch that. Can you try with 1-2 clear sentences? 🤔")
            return []

        if len(sentences) > 3:
            dispatcher.utter_message(text="Keep it concise — just 1-2 sentences! Let's try that again. 😊")
            return []

        # Good answer! Save it
        answers.append(answer)
        
        # Give encouraging feedback
        feedback_options = [
            "Strong answer! 💪",
            "Clear and concise — nice! ✨",
            "Great example! 👏",
            "That's exactly what they look for! 🎯",
            "Perfect! 🌟"
        ]
        
        feedback = random.choice(feedback_options)
        
        # Extra praise for quantifiable answers
        if any(word in answer.lower() for word in ["%", "percent", "x", "time", "times", "reduced", "improved", "increased", "led", "managed", "achieved"]):
            feedback += " Love the specific details!"

        dispatcher.utter_message(text=feedback)

        # Move to next question
        next_index = current_index + 1
        questions = tracker.get_slot("interview_questions") or []
        
        # Automatically ask the next question or end
        if next_index < len(questions):
            dispatcher.utter_message(text=f"**Question {next_index + 1}:** {questions[next_index]}")
        else:
            dispatcher.utter_message(text="🎉 You're all set! Great prep session — you've got this! Good luck with your application! 💪")
        
        return [
            SlotSet("question_answers", answers),
            SlotSet("current_question_index", next_index)
        ]
