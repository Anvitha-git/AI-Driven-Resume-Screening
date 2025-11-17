from typing import Any, Text, Dict, List
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet
import requests
import random
import re
import json
from datetime import datetime

SUPABASE_URL = "https://exbmjznbphjujgngtnrz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4Ym1qem5icGhqdWpnbmd0bnJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODAyOTMwMCwiZXhwIjoyMDczNjA1MzAwfQ.jxObxiiMAmAGph2BG0sczni2cdRiz_buAPee0zIywl8"
BACKEND_URL = "http://localhost:8000"  # Backend API endpoint
headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}


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
        skills = []
        experience = []
        jd_title = "this role"
        matched_skills = []
        missing_skills = []
        focus_areas = []
        
        try:
            # Use the new chatbot context endpoint for better data
            context_url = f"{BACKEND_URL}/chatbot/candidate-context/{user_id}/{jd_id}"
            print(f"[DEBUG] 📡 Fetching context from: {context_url}")
            
            context_resp = requests.get(context_url, timeout=10)
            print(f"[DEBUG] Context response status: {context_resp.status_code}")
            
            if context_resp.status_code == 200:
                context = context_resp.json()
                print("[DEBUG] ✅ Successfully fetched context from backend!")
                print(f"[DEBUG] Context keys: {context.keys()}")
                
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
                # Fallback to old method if new endpoint fails
                print(f"[WARNING] ⚠️ Backend context endpoint failed (status {context_resp.status_code}), falling back to direct Supabase query")
                raise Exception("Using fallback method")
        
        except Exception as e:
            print(f"[WARNING] Backend endpoint failed: {e}. Will try to use backend data if available, otherwise showing error...")
            import traceback
            traceback.print_exc()
        
        # Generate 3-5 personalized questions based on extracted data
        questions = []

        # 1-2 questions from matched skills (skills they have AND JD needs)
        for i, skill in enumerate(matched_skills[:2]):
            questions.append(f"Tell me about a project where you used {skill.upper()} — what was your biggest challenge? (1-2 sentences)")

        # 1 question from missing skills (JD needs but they don't have)
        if missing_skills and len(missing_skills) > 0:
            skill = missing_skills[0]
            questions.append(f"The role requires {skill.upper()} — how would you approach learning it quickly? (1-2 sentences)")

        # 1 question from experience
        if experience and len(experience) > 0:
            exp = experience[0] if isinstance(experience, list) else {}
            if isinstance(exp, dict):
                role = exp.get('role', 'your previous role')
                company = exp.get('company', '')
                if company:
                    questions.append(f"At {company} as {role}, what was your proudest achievement? (1-2 sentences)")
                else:
                    questions.append(f"In {role}, what's one thing you learned that you'd apply here? (1-2 sentences)")
            else:
                questions.append(f"Tell me about your most impactful project. (1-2 sentences)")

        # 1 behavioral question
        questions.append(f"Describe a time you solved a difficult technical problem — how did you approach it? (1-2 sentences)")

        # 1 motivation question
        questions.append(f"Why are you excited about the {jd_title} position? (1-2 sentences)")

        # Ensure we have questions even if some sections are empty
        if len(questions) < 3:
            questions.extend([
                "Tell me about a recent project you're proud of. (1-2 sentences)",
                "How do you stay updated with new technologies? (1-2 sentences)",
                "What's your biggest strength as a developer? (1-2 sentences)"
            ])

        # Shuffle and limit to 3-5 questions for variety per candidate
        random.shuffle(questions)
        num_questions = random.randint(3, min(5, len(questions)))
        questions = questions[:num_questions]
        
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
        
        # Check if we're in the middle of interview prep
        current_question_index = tracker.get_slot("current_question_index")
        questions = tracker.get_slot("interview_questions") or []
        in_interview_mode = current_question_index is not None and current_question_index >= 0 and current_question_index < len(questions)
        
        # Check if the message has question markers
        question_markers = ["?", "what", "when", "where", "why", "how", "tell me", "can you", "do you", "does", "is this", "are there", "will i"]
        has_question_marker = any(marker in user_message for marker in question_markers)
        
        if not has_question_marker and in_interview_mode:
            # Doesn't look like a question - probably an answer during interview
            print(f"[DEBUG] No question markers found in: '{user_message}' - skipping general Q&A")
            return []
        
        # Try to fetch job-specific data for context-aware answers
        jd_id = tracker.get_slot("jd_id")
        job_title = "this position"
        deadline = None
        
        if jd_id:
            try:
                import requests
                response = requests.get(f"http://localhost:8000/jobs/{jd_id}", timeout=3)
                if response.status_code == 200:
                    job_data = response.json()
                    job_title = job_data.get("title", "this position")
                    deadline = job_data.get("deadline")
                    print(f"[DEBUG] Fetched job data: {job_title}, deadline: {deadline}")
            except Exception as e:
                print(f"[DEBUG] Could not fetch job data: {e}")
        
        # Common Q&A patterns
        if any(word in user_message for word in ["deadline", "last date", "apply by", "due date"]):
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
