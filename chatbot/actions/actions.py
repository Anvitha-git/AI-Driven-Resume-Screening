from typing import Any, Text, Dict, List
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet
import requests
import random
import re
import json
from datetime import datetime

import os

# Read sensitive config from environment; fall back to safe defaults for local dev.
SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://exbmjznbphjujgngtnrz.supabase.co')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:8000')  # Backend API endpoint

if not SUPABASE_KEY:
    print('[WARNING] SUPABASE_KEY not set in environment; chat logging will be disabled.')

headers = {"apikey": SUPABASE_KEY or '', "Authorization": f"Bearer {SUPABASE_KEY}" if SUPABASE_KEY else ''}


def save_chat_log(user_id: str, jd_id: str, user_message: str, bot_response: str):
    """Save chat interaction to database"""
    try:
        conversation_data = {
            "user_message": user_message,
            "bot_response": bot_response,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Check if a log exists for this user and job
        check_url = f"{SUPABASE_URL}/rest/v1/chat_logs"
        params = {
            "user_id": f"eq.{user_id}",
            "jd_id": f"eq.{jd_id}",
            "select": "log_id,conversation"
        }
        response = requests.get(check_url, headers=headers, params=params)
        
        if response.status_code == 200 and response.json():
            # Update existing log
            existing = response.json()[0]
            log_id = existing["log_id"]
            existing_conversation = existing.get("conversation", [])
            if not isinstance(existing_conversation, list):
                existing_conversation = []
            existing_conversation.append(conversation_data)
            
            update_url = f"{SUPABASE_URL}/rest/v1/chat_logs?log_id=eq.{log_id}"
            update_data = {"conversation": existing_conversation}
            requests.patch(update_url, headers=headers, json=update_data)
            print(f"[DEBUG] Updated chat log for user {user_id}")
        else:
            # Create new log
            insert_url = f"{SUPABASE_URL}/rest/v1/chat_logs"
            insert_data = {
                "user_id": user_id,
                "jd_id": jd_id,
                "conversation": [conversation_data]
            }
            requests.post(insert_url, headers=headers, json=insert_data)
            print(f"[DEBUG] Created new chat log for user {user_id}")
            
    except Exception as e:
        print(f"[WARNING] Failed to save chat log: {e}")


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

        # Fetch resume + JD from Backend API (enhanced with extracted data)
        # Initialize context variables so the action is robust to timeouts
        resume_data = {}
        jd_data = {}
        skill_analysis = {}
        question_hints = {}

        skills = []
        experience = []
        jd_title = "this role"
        matched_skills = []
        missing_skills = []
        focus_areas = []
        
        try:
            # Use the new chatbot context endpoint for better data
            base_context_url = f"{BACKEND_URL}/chatbot/candidate-context/{user_id}/{jd_id}"
            # Try several possible hostnames to be resilient in Docker/local setups
            candidate_urls = [
                base_context_url,
                base_context_url.replace("localhost", "127.0.0.1"),
                base_context_url.replace("localhost", "host.docker.internal")
            ]

            context = None
            last_exc = None
            for url in candidate_urls:
                try:
                    print(f"[DEBUG] 📡 Attempting to fetch context from: {url}")
                    resp = requests.get(url, timeout=15)
                    print(f"[DEBUG] Context response status from {url}: {getattr(resp, 'status_code', None)}")
                    if resp.status_code == 200:
                        context = resp.json()
                        print("[DEBUG] ✅ Successfully fetched context from backend!")
                        break
                    else:
                        print(f"[WARNING] Received non-200 ({resp.status_code}) from {url}")
                except requests.exceptions.ReadTimeout as rt:
                    print(f"[WARNING] ReadTimeout when contacting {url}: {rt}")
                    last_exc = rt
                except requests.exceptions.ConnectionError as ce:
                    print(f"[WARNING] ConnectionError when contacting {url}: {ce}")
                    last_exc = ce
                except Exception as e:
                    print(f"[WARNING] Error when contacting {url}: {e}")
                    last_exc = e

            if context:
                resume_data = context.get("resume", {})
                jd_data = context.get("job_description", {})
                skill_analysis = context.get("skill_analysis", {})
                question_hints = context.get("question_hints", {})

                # Extract key info
                skills = resume_data.get("skills", []) or []
                experience = resume_data.get("experience", []) or []
                jd_title = jd_data.get("title", "this role")
                matched_skills = skill_analysis.get("matched_skills", [])
                missing_skills = skill_analysis.get("missing_skills", [])
                focus_areas = question_hints.get("focus_areas", [])

                print(f"[DEBUG] Skills: {skills}")
                print(f"[DEBUG] Experience: {experience}")
                print(f"[DEBUG] Matched Skills: {matched_skills}")
                print(f"[DEBUG] Missing Skills: {missing_skills}")
                print(f"[DEBUG] Focus Areas: {focus_areas}")
            else:
                print(f"[WARNING] ⚠️ Could not fetch chatbot context from backend. Last error: {last_exc}")
                # Keep initialized empty context so question generation can fall back

        except Exception as e:
            print(f"[WARNING] Backend endpoint fetch failed with unexpected error: {e}. Falling back to generic questions.")
            import traceback
            traceback.print_exc()
        
        # Generate 4-5 personalized questions based on extracted data
        questions = []

        # Add questions focused on matched skills (one per top matched skill)
        for skill in matched_skills[:3]:
            s = skill.strip()
            if s:
                questions.append(f"Tell me about a project where you used {s}. What was the biggest challenge and how did you overcome it? (1-2 sentences)")

        # Add questions about growth areas (missing skills) - ask approach to learn
        for skill in missing_skills[:2]:
            s = skill.strip()
            if s:
                questions.append(f"The role mentions {s}. How would you go about learning or applying {s} quickly in a real project? (1-2 sentences)")

        # Experience-based questions (ask for achievements or key responsibilities)
        if isinstance(experience, list) and len(experience) > 0:
            for exp in experience[:2]:
                if isinstance(exp, dict):
                    role = exp.get('role') or exp.get('title') or 'your previous role'
                    company = exp.get('company') or ''
                    if company:
                        questions.append(f"At {company} as {role}, what was one measurable outcome you achieved? (1-2 sentences)")
                    else:
                        questions.append(f"In {role}, what's one thing you learned that you'd apply here? (1-2 sentences)")

        # Education/project-specific questions using resume preview (if available)
        resume_preview = (resume_data.get('extracted_text_preview') or '')
        if resume_preview:
            # If resume mentions 'project' or 'thesis' pull a short snippet to ask about
            try:
                if 'project' in resume_preview.lower():
                    # Ask a generic project-question referencing resume
                    questions.append("I see you listed projects on your resume — what's one project you led and what was the outcome? (1-2 sentences)")
            except Exception:
                pass

        # Behavioral + motivation
        questions.append("Describe a time you solved a difficult technical problem — how did you approach it? (1-2 sentences)")
        questions.append(f"Why are you excited about the {jd_title} position? (1-2 sentences)")

        # Deduplicate while preserving order
        seen = set()
        uniq = []
        for q in questions:
            if q not in seen:
                uniq.append(q)
                seen.add(q)
        questions = uniq

        # If we still have fewer than 4 questions, pad with resume-relevant prompts
        pad_pool = [
            "How do you stay updated with new technologies? (1-2 sentences)",
            "What's your biggest strength as a developer? (1-2 sentences)",
            "Tell me about a technical decision you made and why. (1-2 sentences)"
        ]
        i = 0
        while len(questions) < 4 and i < len(pad_pool):
            questions.append(pad_pool[i])
            i += 1

        # Limit to 4-5 questions (prefer 5 if available)
        if len(questions) >= 5:
            questions = questions[:5]
        elif len(questions) >= 4:
            questions = questions[:4]
        
        print(f"[DEBUG] 🎯 Generated {len(questions)} personalized questions:")
        for i, q in enumerate(questions, 1):
            print(f"[DEBUG]   {i}. {q}")
        
        # Check if we actually got resume data
        if not skills and not experience and not matched_skills:
            print("[ERROR] ❌ No resume data was fetched!")
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
        
        # Send intro message and first question immediately
        intro_msg = "Great! Let's do a quick 2-min interview prep. I'll ask you a few short questions to help you practice. 🚀"
        dispatcher.utter_message(text=intro_msg)
        
        # Ask the first question immediately
        if len(questions) > 0:
            first_question = f"Question 1: {questions[0]}"
            dispatcher.utter_message(text=first_question)
            
            # Log the conversation start
            save_chat_log(user_id, jd_id, "yes (start interview)", intro_msg + " " + first_question)

        # Save to slots
        return [
            SlotSet("interview_questions", questions),
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
        user_id = tracker.get_slot("user_id")
        jd_id = tracker.get_slot("jd_id")

        if index >= len(questions):
            completion_msg = "🎉 You're all set! Great prep session — you've got this! Good luck with your application! 💪"
            dispatcher.utter_message(text=completion_msg)
            
            # Log completion
            if user_id and jd_id:
                save_chat_log(user_id, jd_id, "[Interview completed]", completion_msg)
            
            return [SlotSet("current_question_index", None)]

        question = questions[index]
        question_msg = f"Question {index + 1}: {question}"
        dispatcher.utter_message(text=question_msg)
        
        # Log the question being asked (no user message for auto-next question)
        if user_id and jd_id:
            save_chat_log(user_id, jd_id, "[Next question]", question_msg)
        
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
        questions = tracker.get_slot("interview_questions") or []
        
        # Check if user is asking a question instead of answering
        if any(word in answer.lower() for word in ["what is", "what are", "how many", "when will", "can you tell", "is this", "where is"]):
            # User is asking a question - handle it and remind them to continue
            # Let the general Q&A action handle it via intent classification
            # Then remind them to continue
            if current_index < len(questions):
                dispatcher.utter_message(text=f"Let's get back to your prep! Here's the question again:\n\nQuestion {current_index + 1}: {questions[current_index]}")
            return []

        # Validate: 1-2 sentences, no rubbish
        sentences = re.split(r'[.!?]+', answer)
        sentences = [s.strip() for s in sentences if s.strip() and len(s.strip()) > 3]

        if len(sentences) == 0 or len(answer) < 10:
            dispatcher.utter_message(text="Hmm, I didn't catch that. Can you try with 1-2 clear sentences? 🤔")
            return []

        if len(sentences) > 3:
            dispatcher.utter_message(text="Keep it concise — just 1-2 sentences! Let's try that again. 😊")
            return []

        # Analyze answer quality
        answer_lower = answer.lower()
        
        # Detect negative/weak answers
        negative_indicators = [
            "don't have", "dont have", "no experience", "never", "not sure",
            "i don't know", "i dont know", "haven't", "havent", "didn't", "didnt",
            "no idea", "not familiar", "tried all", "just tried", "somehow solved"
        ]
        
        vague_indicators = [
            "something", "somehow", "just did it", "figured it out", 
            "eventually", "finally solved", "all the ways"
        ]
        
        is_negative = any(indicator in answer_lower for indicator in negative_indicators)
        is_vague = any(indicator in answer_lower for indicator in vague_indicators)
        
        # Save the answer
        answers.append(answer)
        
        # Give contextual feedback
        if is_negative:
            feedback = "Honest answer! 👍 In interviews, try to pivot to related skills or willingness to learn. For example: 'I haven't used R yet, but I've worked with Python for data analysis and am eager to learn R.' Keep going!"
        elif is_vague:
            feedback = "Good start! 💡 Try to be more specific — mention the actual approach, tools, or steps you used. Interviewers love concrete details!"
        else:
            # Positive feedback for good answers
            feedback_options = [
                "Strong answer! 💪",
                "Clear and concise — nice! ✨",
                "Great example! 👏",
                "That's exactly what they look for! 🎯",
                "Perfect! 🌟"
            ]
            feedback = random.choice(feedback_options)
            
            # Extra praise for quantifiable answers
            if any(word in answer_lower for word in ["%", "percent", "x", "time", "times", "reduced", "improved", "increased", "led", "managed", "achieved", "built", "created"]):
                feedback += " Love the specific details!"

        dispatcher.utter_message(text=feedback)
        
        # Log the Q&A exchange
        user_id = tracker.get_slot("user_id")
        jd_id = tracker.get_slot("jd_id")
        if user_id and jd_id and current_index < len(questions):
            question_text = questions[current_index]
            save_chat_log(user_id, jd_id, f"[Q{current_index + 1}] {answer}", feedback)

        # Move to next question
        next_index = current_index + 1
        
        # Automatically ask the next question or end
        if next_index < len(questions):
            next_question = f"Question {next_index + 1}: {questions[next_index]}"
            dispatcher.utter_message(text=next_question)
        else:
            completion_msg = "🎉 You're all set! Great prep session — you've got this! Good luck with your application! 💪"
            dispatcher.utter_message(text=completion_msg)
        
        return [
            SlotSet("question_answers", answers),
            SlotSet("current_question_index", next_index)
        ]


class ActionAnswerGeneralQuestion(Action):
    """Handle general questions from candidates about the job, company, or interview process"""
    
    def name(self) -> Text:
        return "action_answer_general_question"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        user_message = tracker.latest_message.get("text", "").lower()
        user_intent = tracker.latest_message.get("intent", {}).get("name", "")
        
        # Check if we're in the middle of interview prep
        current_question_index = tracker.get_slot("current_question_index")
        questions = tracker.get_slot("interview_questions") or []
        in_interview_mode = current_question_index is not None and current_question_index >= 0 and current_question_index < len(questions)
        
        # Get user and job context
        metadata = tracker.latest_message.get("metadata", {})
        user_id = metadata.get("user_id") or tracker.get_slot("user_id") or tracker.sender_id
        jd_id = tracker.get_slot("jd_id")
        
        # Try to fetch job-specific data for context-aware answers
        job_title = "this position"
        deadline = None
        
        if jd_id:
            try:
                response = requests.get(f"{BACKEND_URL}/jobs/{jd_id}", timeout=3)
                if response.status_code == 200:
                    job_data = response.json()
                    job_title = job_data.get("title", "this position")
                    deadline = job_data.get("deadline")
                    print(f"[DEBUG] Fetched job data: {job_title}, deadline: {deadline}")
            except Exception as e:
                print(f"[DEBUG] Could not fetch job data: {e}")
        
        # Handle specific intent: ask_deadline
        if user_intent == "ask_deadline":
            if deadline:
                from datetime import datetime
                try:
                    deadline_date = datetime.fromisoformat(deadline.replace('Z', '+00:00'))
                    formatted_deadline = deadline_date.strftime("%B %d, %Y")
                    dispatcher.utter_message(text=f"The application deadline for {job_title} is {formatted_deadline}. Make sure to submit your application before then! 📅")
                except:
                    dispatcher.utter_message(text=f"The application deadline is {deadline}. You can check the job posting for exact details! 📅")
            else:
                dispatcher.utter_message(text="I don't have the deadline information right now. Please check the job posting or contact HR for the application deadline! 📅")
            
            if in_interview_mode and current_question_index < len(questions):
                dispatcher.utter_message(text=f"Let's continue your prep!\n\nQuestion {current_question_index + 1}: {questions[current_question_index]}")
            return []
        
        # Handle specific intent: ask_interview_schedule
        if user_intent == "ask_interview_schedule":
            if user_id and jd_id:
                try:
                    # Fetch application data to check for interview schedule
                    check_url = f"{SUPABASE_URL}/rest/v1/applications"
                    params = {
                        "user_id": f"eq.{user_id}",
                        "jd_id": f"eq.{jd_id}",
                        "select": "status,interview_date,interview_time"
                    }
                    response = requests.get(check_url, headers=headers, params=params, timeout=5)
                    
                    if response.status_code == 200 and response.json():
                        app_data = response.json()[0]
                        interview_date = app_data.get("interview_date")
                        interview_time = app_data.get("interview_time")
                        status = app_data.get("status", "").lower()
                        
                        if interview_date:
                            from datetime import datetime
                            try:
                                date_obj = datetime.fromisoformat(interview_date.replace('Z', '+00:00'))
                                formatted_date = date_obj.strftime("%B %d, %Y")
                                time_info = f" at {interview_time}" if interview_time else ""
                                dispatcher.utter_message(text=f"Your interview is scheduled for {formatted_date}{time_info}! 📅 Good luck with your preparation! 💪")
                            except:
                                time_info = f" at {interview_time}" if interview_time else ""
                                dispatcher.utter_message(text=f"Your interview is scheduled for {interview_date}{time_info}! 📅")
                        elif status in ["shortlisted", "selected"]:
                            dispatcher.utter_message(text="Your application has been shortlisted! The interview will be scheduled soon. HR will contact you with the details. Keep an eye on your email! 📧")
                        else:
                            dispatcher.utter_message(text="No interview has been scheduled yet. Once your application is reviewed and shortlisted, HR will reach out with interview details! 📧")
                    else:
                        dispatcher.utter_message(text="I couldn't find your application details. Please make sure you've submitted your application for this position!")
                except Exception as e:
                    print(f"[ERROR] Failed to fetch interview schedule: {e}")
                    dispatcher.utter_message(text="I'm having trouble fetching your interview details right now. Please check your email or contact HR directly! 📧")
            else:
                dispatcher.utter_message(text="I need to know which position you're asking about. Please make sure you've applied for a position first!")
            
            if in_interview_mode and current_question_index < len(questions):
                dispatcher.utter_message(text=f"Let's continue your prep!\n\nQuestion {current_question_index + 1}: {questions[current_question_index]}")
            return []
        
        # Handle specific intent: ask_application_status
        if user_intent == "ask_application_status":
            if user_id and jd_id:
                try:
                    # Fetch application status from database
                    check_url = f"{SUPABASE_URL}/rest/v1/applications"
                    params = {
                        "user_id": f"eq.{user_id}",
                        "jd_id": f"eq.{jd_id}",
                        "select": "status,score,ai_recommendation"
                    }
                    response = requests.get(check_url, headers=headers, params=params, timeout=5)
                    
                    if response.status_code == 200 and response.json():
                        app_data = response.json()[0]
                        status = app_data.get("status", "pending").lower()
                        score = app_data.get("score")
                        recommendation = app_data.get("ai_recommendation", "").lower()
                        
                        # Create status-specific messages
                        if status == "selected" or status == "shortlisted":
                            msg = f"🎉 Great news! Your application has been {status}! "
                            if score:
                                msg += f"Your resume scored {score}/100. "
                            msg += "The HR team will contact you soon with next steps. Keep an eye on your email! 📧"
                            dispatcher.utter_message(text=msg)
                        elif status == "rejected":
                            msg = "Unfortunately, your application wasn't selected for this position. "
                            msg += "Don't be discouraged! Keep applying and improving your skills. There are many opportunities out there! 💪"
                            dispatcher.utter_message(text=msg)
                        elif status == "pending" or status == "under review":
                            msg = "Your application is currently under review. "
                            if score:
                                msg += f"Your initial resume score is {score}/100. "
                            msg += "The hiring team will evaluate it soon. Hang tight! ⏳"
                            dispatcher.utter_message(text=msg)
                        else:
                            msg = f"Your application status is: {status}. "
                            if score:
                                msg += f"Resume score: {score}/100. "
                            msg += "You'll be notified of any updates via email!"
                            dispatcher.utter_message(text=msg)
                    else:
                        dispatcher.utter_message(text="I couldn't find your application. Have you submitted your resume for this position yet?")
                except Exception as e:
                    print(f"[ERROR] Failed to fetch application status: {e}")
                    dispatcher.utter_message(text="I'm having trouble checking your application status right now. Please try again later or contact HR! 📧")
            else:
                dispatcher.utter_message(text="I need to know which position you're asking about. Please make sure you've applied for a position first!")
            
            if in_interview_mode and current_question_index < len(questions):
                dispatcher.utter_message(text=f"Let's continue your prep!\n\nQuestion {current_question_index + 1}: {questions[current_question_index]}")
            return []
        
        # Check if the message has question markers (for fallback general questions)
        question_markers = ["?", "what", "when", "where", "why", "how", "tell me", "can you", "do you", "does", "is this", "are there", "will i"]
        has_question_marker = any(marker in user_message for marker in question_markers)
        
        if not has_question_marker and in_interview_mode:
            # Doesn't look like a question - probably an answer during interview
            print(f"[DEBUG] No question markers found in: '{user_message}' - skipping general Q&A")
            return []
        
        # Common Q&A patterns (legacy support for non-specific intents)
        if any(word in user_message for word in ["deadline", "last date", "apply by", "due date"]) and user_intent != "ask_deadline":
            if deadline:
                from datetime import datetime
                try:
                    deadline_date = datetime.fromisoformat(deadline.replace('Z', '+00:00'))
                    formatted_deadline = deadline_date.strftime("%B %d, %Y")
                    dispatcher.utter_message(text=f"The application deadline for {job_title} is {formatted_deadline}. Make sure to submit your application before then! 📅")
                except:
                    dispatcher.utter_message(text=f"The application deadline is {deadline}. You can check the job posting for exact details! 📅")
            else:
                dispatcher.utter_message(text="I don't have the deadline information right now. Please check the job posting or contact HR for the application deadline! 📅")
        
        elif any(word in user_message for word in ["salary", "pay", "compensation", "benefits"]):
            dispatcher.utter_message(text="For salary and benefits details, I'd recommend reaching out to the HR team directly or checking the job posting. They'll have the most accurate information!")
        
        elif any(word in user_message for word in ["location", "remote", "office", "work from home", "wfh"]):
            dispatcher.utter_message(text="Work location details should be in the job description. If you need clarification, feel free to ask the recruiter during your interview!")
        
        elif any(word in user_message for word in ["interview", "rounds", "process", "next steps"]):
            dispatcher.utter_message(text="The interview process typically includes multiple rounds. You'll be contacted by HR with specific details about the next steps after your application is reviewed!")
        
        elif any(word in user_message for word in ["culture", "team", "environment", "work culture"]):
            dispatcher.utter_message(text="That's a great question! Company culture is important. I'd suggest asking the interviewer about team dynamics and work environment during your interview. You can also check their website or LinkedIn!")
        
        elif any(word in user_message for word in ["when", "timeline", "hear back", "response"]):
            dispatcher.utter_message(text="Hiring timelines vary by company. Most organizations respond within 1-2 weeks. If you haven't heard back, it's perfectly fine to follow up with the HR team!")
        
        elif any(word in user_message for word in ["dress code", "what to wear", "attire"]):
            dispatcher.utter_message(text="For interviews, business casual or formal attire is usually a safe choice. When in doubt, it's better to be slightly overdressed!")
        
        elif any(word in user_message for word in ["prepare", "preparation", "tips", "advice"]):
            dispatcher.utter_message(text="Great question! Research the company, review the job description, prepare examples from your experience, and practice common interview questions. That's exactly what we're doing now! 😊")
        
        else:
            dispatcher.utter_message(text="That's a good question! For specific details about the role or company, I'd recommend reaching out to the HR team or asking during your interview.")
        
        # If in interview mode, remind them to continue
        if in_interview_mode and current_question_index < len(questions):
            dispatcher.utter_message(text=f"Let's continue your prep! \n\nQuestion {current_question_index + 1}: {questions[current_question_index]}")
        
        return []


class ActionHandleAcknowledgment(Action):
    """Handle acknowledgments like 'ok', 'got it', 'thanks' without restarting interview"""
    
    def name(self) -> Text:
        return "action_handle_acknowledgment"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        # Check if we were just answering a question
        last_bot_message = None
        for event in reversed(tracker.events):
            if event.get("event") == "bot":
                last_bot_message = event.get("text", "")
                break
        
        # If we just provided information (deadline, salary, etc.), offer help
        if last_bot_message and any(keyword in last_bot_message.lower() for keyword in ["deadline", "salary", "location", "interview", "culture", "check", "contact hr"]):
            dispatcher.utter_message(text="Glad I could help! If you have any other questions, feel free to ask. Otherwise, best of luck with your application! 🚀")
        else:
            # Generic acknowledgment
            dispatcher.utter_message(text="Great! If you need anything else, just let me know. Good luck! 👍")
        
        return []
