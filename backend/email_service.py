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
            subject = f"Congratulations! You've been selected for {job_title}"
            body = f"""
Dear {candidate_name},

We are pleased to inform you that you have been selected for the position of {job_title} at {company_name}!

Your resume and qualifications stood out among the applicants, and we believe you would be a great fit for our team.

Next Steps:
- Our HR team will contact you within 2-3 business days to schedule an interview
- Please keep an eye on your email and phone for further communication
- Prepare any questions you may have about the role and company

We look forward to speaking with you soon!

Best regards,
{EMAIL_FROM_NAME}
{company_name}

---
This is an automated notification from our Resume Screening System.
            """
            
        elif decision == 'rejected':
            subject = f"Update on your application for {job_title}"
            body = f"""
Dear {candidate_name},

Thank you for your interest in the {job_title} position at {company_name} and for taking the time to submit your application.

After careful consideration, we regret to inform you that we have decided to move forward with other candidates whose qualifications more closely match our current needs.

We appreciate your interest in joining our team and encourage you to apply for future positions that align with your skills and experience.

We wish you the best in your job search and future career endeavors.

Best regards,
{EMAIL_FROM_NAME}
{company_name}

---
This is an automated notification from our Resume Screening System.
            """
            
        else:  # pending
            subject = f"Your application for {job_title} is under review"
            body = f"""
Dear {candidate_name},

Thank you for applying for the {job_title} position at {company_name}.

Your application is currently under review by our hiring team. We are carefully evaluating all candidates to ensure the best fit for this role.

What to expect:
- You will receive an update on your application status within 5-7 business days
- If selected for the next round, we will contact you to schedule an interview
- Please ensure your contact information is up to date

Thank you for your patience and interest in joining our team.

Best regards,
{EMAIL_FROM_NAME}
{company_name}

---
This is an automated notification from our Resume Screening System.
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
