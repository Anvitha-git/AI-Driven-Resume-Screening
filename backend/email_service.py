"""
Email notification service for candidate decision updates
"""
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# Email configuration from environment variables
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True').lower() == 'true'
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
EMAIL_FROM_NAME = os.getenv('EMAIL_FROM_NAME', 'HR Team - Resume Screening System')

# Log email configuration (without password)
logger.info(f"Email service initialized: HOST={EMAIL_HOST}, PORT={EMAIL_PORT}, USER={EMAIL_HOST_USER}, TLS={EMAIL_USE_TLS}")
if not EMAIL_HOST_USER or not EMAIL_HOST_PASSWORD:
    logger.warning("Email service NOT configured - EMAIL_HOST_USER or EMAIL_HOST_PASSWORD is missing!")

def send_decision_email(
    candidate_email: str,
    candidate_name: str,
    job_title: str,
    decision: str,
    company_name: str = "Our Company"
) -> bool:
    """
    Send email notification to candidate about their application decision
    
    Args:
        candidate_email: Candidate's email address
        candidate_name: Candidate's name
        job_title: Job position title
        decision: 'selected', 'rejected', or 'pending'
        company_name: Name of the company
        
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    
    logger.info(f"[EMAIL] Attempting to send email to {candidate_email} for decision: {decision}")
    logger.info(f"[EMAIL] Config: HOST={EMAIL_HOST}, PORT={EMAIL_PORT}, USER={EMAIL_HOST_USER}, PASSWORD_SET={bool(EMAIL_HOST_PASSWORD)}")
    
    # Check if email is configured
    if not EMAIL_HOST_USER or not EMAIL_HOST_PASSWORD:
        logger.warning("Email service not configured. Skipping email notification.")
        return False
    
    try:
        # Create email content based on decision
        if decision == 'selected':
            subject = f"Congratulations! You've been selected for - {job_title}"
            body = f"""
Dear {candidate_name},

Congratulations! 🎊

We're thrilled to inform you that your application for the {job_title} position at {company_name} has been shortlisted!

Your skills, experience, and qualifications truly impressed our hiring team. After carefully reviewing all applications, we believe you have the potential to make a significant impact in this role.

📅 What Happens Next?

• Interview Invitation: Our recruitment team will reach out within 2-3 business days to schedule your interview
• Be Prepared: We recommend reviewing the job description and preparing examples of your relevant experience
• Stay Connected: Please ensure your phone and email are accessible for our upcoming communication.

We're genuinely excited about the possibility of you joining our team and look forward to getting to know you better.

Warm regards,
The {company_name} Hiring Team
{EMAIL_FROM_NAME}

---
📧 This is an automated notification from our AI-Powered Resume Screening System
If you have any questions, please don't hesitate to reach out to our HR department.
            """
            
        elif decision == 'rejected':
            subject = f"Thank You for Your Application - {job_title}"
            body = f"""
Dear {candidate_name},

Thank you for taking the time to apply for the {job_title} position at {company_name}. We truly appreciate your interest in joining our team.

After thoughtful consideration of all applications, we've decided to move forward with candidates whose experience more closely aligns with our specific requirements for this particular role.

However, we want you to know:

✨ Your Application Matters
Your skills and experience are valuable, and this decision doesn't diminish your professional worth. The hiring process often comes down to finding the most specific match for a role's unique requirements.

🚀 Keep Moving Forward
• We encourage you to explore other opportunities that may be an even better fit for your talents
• Keep an eye on our careers page for future openings that align with your expertise
• Continue building your skills - the right opportunity is out there!

🔔 Stay in Touch
We maintain all applications on file and may reach out if a suitable position becomes available in the future.

We sincerely wish you all the best in your career journey and future endeavors. Keep pursuing your goals with confidence!

Best wishes,
The {company_name} Hiring Team
{EMAIL_FROM_NAME}

---
📧 This is an automated notification from our AI-Powered Resume Screening System
            """
            
        else:  # pending
            subject = f"Application Received - {job_title} at {company_name}"
            body = f"""
Dear {candidate_name},

Thank you for applying for the {job_title} position at {company_name}! We've successfully received your application. ✅

🔍 Current Status: Under Review

Your resume is currently being carefully evaluated by our hiring team. We use an AI-powered screening system to ensure fair and thorough assessment of every candidate.

⏰ Timeline & Next Steps:

• Review Period: 5-7 business days
• Shortlisted Candidates: Will receive interview invitations via email
• Decision Updates: You'll be notified regardless of the outcome
• Contact Info: Please ensure your phone and email are up to date

💼 In the Meantime:

• Keep your application status dashboard updated
• Check your spam folder regularly to avoid missing important updates
• Feel free to explore other open positions on our careers page

We understand how important this opportunity is to you, and we're committed to providing updates in a timely manner. Thank you for your patience!

Best regards,
The {company_name} Hiring Team
{EMAIL_FROM_NAME}

---
📧 This is an automated notification from our AI-Powered Resume Screening System
Questions? Contact our HR department for assistance.
            """
        
        # Create message
        message = MIMEMultipart()
        message['From'] = f"{EMAIL_FROM_NAME} <{EMAIL_HOST_USER}>"
        message['To'] = candidate_email
        message['Subject'] = subject
        
        # Attach body
        message.attach(MIMEText(body, 'plain'))
        
        # Connect to SMTP server and send
        logger.info(f"Connecting to SMTP server {EMAIL_HOST}:{EMAIL_PORT}")
        
        if EMAIL_USE_TLS:
            server = smtplib.SMTP(EMAIL_HOST, EMAIL_PORT)
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(EMAIL_HOST, EMAIL_PORT)
        
        server.login(EMAIL_HOST_USER, EMAIL_HOST_PASSWORD)
        server.send_message(message)
        server.quit()
        
        logger.info(f"Email sent successfully to {candidate_email} for decision: {decision}")
        return True
        
    except smtplib.SMTPAuthenticationError:
        logger.error("SMTP authentication failed. Check EMAIL_HOST_USER and EMAIL_HOST_PASSWORD in .env")
        return False
    except smtplib.SMTPException as e:
        logger.error(f"SMTP error sending email to {candidate_email}: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending email to {candidate_email}: {str(e)}")
        return False


def send_bulk_decision_emails(decisions_data: list) -> dict:
    """
    Send decision emails to multiple candidates
    
    Args:
        decisions_data: List of dicts with keys: candidate_email, candidate_name, job_title, decision
        
    Returns:
        dict: Summary with success_count, failed_count, and failed_emails list
    """
    success_count = 0
    failed_count = 0
    failed_emails = []
    
    for data in decisions_data:
        success = send_decision_email(
            candidate_email=data.get('candidate_email'),
            candidate_name=data.get('candidate_name', 'Candidate'),
            job_title=data.get('job_title', 'Position'),
            decision=data.get('decision', 'pending'),
            company_name=data.get('company_name', 'Our Company')
        )
        
        if success:
            success_count += 1
        else:
            failed_count += 1
            failed_emails.append(data.get('candidate_email'))
    
    return {
        'success_count': success_count,
        'failed_count': failed_count,
        'failed_emails': failed_emails
    }
