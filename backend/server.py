from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks, Query
from fastapi.responses import StreamingResponse, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, date
import pandas as pd
import io
from enum import Enum
import jwt
from passlib.context import CryptContext
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from emergentintegrations.llm.chat import LlmChat, UserMessage
import requests as http_requests


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ==================== Object Storage Configuration ====================
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = "insurehub"
storage_key = None

def init_storage():
    """Initialize object storage. Call once at startup."""
    global storage_key
    if storage_key:
        return storage_key
    resp = http_requests.post(
        f"{STORAGE_URL}/init",
        json={"emergent_key": os.environ.get('EMERGENT_LLM_KEY')},
        timeout=30
    )
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Upload file to object storage."""
    key = init_storage()
    resp = http_requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    """Download file from object storage."""
    key = init_storage()
    resp = http_requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT and Password settings
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Email Configuration (Gmail SMTP)
SMTP_SERVER = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))
SMTP_USERNAME = os.environ.get('SMTP_USERNAME', '')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')  # App password for Gmail
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', '')

# AI/LLM Configuration
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")


# Enums
class UserRole(str, Enum):
    HR = "HR"
    ADMIN = "Admin"


class RelationshipType(str, Enum):
    EMPLOYEE = "Employee"
    SPOUSE = "Spouse"
    KIDS = "Kids"
    MOTHER = "Mother"
    FATHER = "Father"


class EndorsementType(str, Enum):
    ADDITION = "Addition"
    DELETION = "Deletion"
    CORRECTION = "Correction"
    MIDTERM_ADDITION = "Midterm addition"


class PolicyType(str, Enum):
    GROUP_HEALTH = "Group Health"
    GROUP_ACCIDENT = "Group Accident"
    GROUP_TERM = "Group Term"
    GPA = "GPA"
    GTL = "GTL"


class FamilyDefinition(str, Enum):
    ESKP = "ESKP"
    ESK = "ESK"
    E = "E"


class Gender(str, Enum):
    MALE = "Male"
    FEMALE = "Female"
    OTHER = "Other"


class CoverageType(str, Enum):
    FLOATER = "Floater"
    NON_FLOATER = "Non-Floater"


class EndorsementStatus(str, Enum):
    PENDING = "Pending"
    APPROVED = "Approved"
    REJECTED = "Rejected"


class PolicyStatus(str, Enum):
    ACTIVE = "Active"
    EXPIRED = "Expired"
    CANCELLED = "Cancelled"


# Authentication Models
class UserLogin(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    password: str
    role: UserRole
    full_name: str
    email: str
    phone: Optional[str] = None  # Phone number for SMS notifications


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    full_name: str
    email: str
    phone: Optional[str] = None
    role: UserRole
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Policy Models
class PolicyCreate(BaseModel):
    policy_number: str
    policy_holder_name: str
    policy_date: Optional[str] = None
    inception_date: Optional[str] = None
    expiry_date: Optional[str] = None
    policy_type: str = "Group Health"
    family_definition: Optional[str] = None
    premium: float = 0
    employees_count: int = 0
    spouse_count: int = 0
    kids_count: int = 0
    parents_count: int = 0
    addition_lives: int = 0
    deletion_lives: int = 0
    status: PolicyStatus = PolicyStatus.ACTIVE


class Policy(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    policy_number: str
    policy_holder_name: str
    policy_date: Optional[str] = None
    inception_date: Optional[str] = None
    expiry_date: Optional[str] = None
    policy_type: str = "Group Health"
    family_definition: Optional[str] = None
    premium: float = 0
    employees_count: int = 0
    spouse_count: int = 0
    kids_count: int = 0
    parents_count: int = 0
    total_lives_count: int = 0
    addition_lives: int = 0
    deletion_lives: int = 0
    annual_premium_per_life: Optional[float] = 0
    total_lives_covered: Optional[int] = 0
    status: PolicyStatus = PolicyStatus.ACTIVE
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Endorsement Models
class EndorsementCreate(BaseModel):
    policy_number: str
    employee_id: Optional[str] = None
    member_name: str
    dob: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[Gender] = None
    relationship_type: RelationshipType
    endorsement_type: EndorsementType
    date_of_joining: Optional[str] = None
    date_of_leaving: Optional[str] = None
    coverage_type: Optional[CoverageType] = None
    sum_insured: Optional[float] = None
    endorsement_date: str
    effective_date: Optional[str] = None
    remarks: Optional[str] = None


class Endorsement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    policy_id: str
    policy_number: str
    employee_id: Optional[str] = None
    member_name: str
    dob: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    relationship_type: RelationshipType
    endorsement_type: EndorsementType
    date_of_joining: Optional[str] = None
    date_of_leaving: Optional[str] = None
    coverage_type: Optional[str] = None
    sum_insured: Optional[float] = None
    annual_premium_per_life: Optional[float] = None
    endorsement_date: str
    effective_date: str
    days_from_inception: int
    days_in_policy_year: int
    remaining_days: int
    prorata_premium: float
    status: EndorsementStatus = EndorsementStatus.PENDING
    submitted_by: Optional[str] = None
    approved_by: Optional[str] = None
    approval_date: Optional[str] = None
    remarks: Optional[str] = None
    import_batch_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EndorsementUpdate(BaseModel):
    employee_id: Optional[str] = None
    member_name: Optional[str] = None
    dob: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[Gender] = None
    relationship_type: Optional[RelationshipType] = None
    endorsement_type: Optional[EndorsementType] = None
    date_of_joining: Optional[str] = None
    date_of_leaving: Optional[str] = None
    coverage_type: Optional[CoverageType] = None
    sum_insured: Optional[float] = None
    endorsement_date: Optional[str] = None
    effective_date: Optional[str] = None
    remarks: Optional[str] = None


class EndorsementApproval(BaseModel):
    status: EndorsementStatus
    remarks: Optional[str] = None


class ImportResult(BaseModel):
    success_count: int
    error_count: int
    total_rows: int
    errors: List[dict]
    import_batch_id: str


# Email Models
class EmailRequest(BaseModel):
    to_emails: List[str]
    cc_emails: Optional[List[str]] = []
    bcc_emails: Optional[List[str]] = []
    subject: str
    body: str
    from_email: Optional[str] = None
    attach_excel: bool = False
    attach_pdf: bool = False
    policy_number: Optional[str] = None


class EmailConfig(BaseModel):
    smtp_server: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str
    smtp_password: str
    default_from_email: str


class BulkApprovalRequest(BaseModel):
    endorsement_ids: List[str]
    status: EndorsementStatus
    remarks: Optional[str] = None


# Document Storage Models
class DocumentCategory(str, Enum):
    POLICY_TERMS = "Policy Terms"
    ENDORSEMENT_FILES = "Endorsement Files"
    PREMIUM_RECEIPTS = "Premium Receipts"
    ECARDS = "E-Cards"
    OTHERS = "Others"


# CD Ledger Models
class CDLedgerEntryCreate(BaseModel):
    date: str
    reference: str
    description: Optional[str] = None
    amount: float  # positive = deposit, negative = withdrawal
    policy_number: Optional[str] = None


class CDLedgerEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    reference: str
    description: Optional[str] = None
    amount: float
    policy_number: Optional[str] = None
    entry_type: str = "Manual"  # Manual, Endorsement Deduction, Refund Credit
    endorsement_id: Optional[str] = None
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# Policy Assignment Models
class PolicyAssignmentCreate(BaseModel):
    policy_id: str
    hr_user_id: str


class PolicyAssignment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    policy_id: str
    policy_number: str
    hr_user_id: str
    hr_username: str
    hr_full_name: str
    assigned_by: str
    assigned_by_name: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# Helper Functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def create_access_token(data: dict):
    to_encode = data.copy()
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except:
        return None


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    if isinstance(user.get('created_at'), str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    return User(**user)


async def get_hr_assigned_policy_numbers(hr_user_id: str) -> list:
    """Get list of policy_numbers assigned to an HR user. Returns empty list if none assigned."""
    assignments = await db.policy_assignments.find(
        {"hr_user_id": hr_user_id}, {"_id": 0, "policy_number": 1}
    ).to_list(1000)
    return [a["policy_number"] for a in assignments]


def calculate_prorata_premium(
    inception_date_str: str,
    expiry_date_str: str,
    endorsement_date_str: str,
    annual_premium: float,
    endorsement_type: str = "Addition"
) -> tuple:
    """
    Calculate pro-rata premium based on endorsement type.
    - Addition/Midterm addition: Charge for remaining days (positive premium)
    - Deletion: Refund for remaining days (negative premium)
    - Correction: No premium change (zero)
    """
    try:
        inception_date = datetime.strptime(inception_date_str, "%Y-%m-%d").date()
        expiry_date = datetime.strptime(expiry_date_str, "%Y-%m-%d").date()
        endorsement_date = datetime.strptime(endorsement_date_str, "%Y-%m-%d").date()
        
        days_in_policy_year = (expiry_date - inception_date).days
        days_from_inception = (endorsement_date - inception_date).days
        remaining_days = (expiry_date - endorsement_date).days
        
        if days_in_policy_year > 0 and remaining_days >= 0:
            prorata_premium = (annual_premium * remaining_days) / days_in_policy_year
        else:
            prorata_premium = 0.0
        
        # Apply sign based on endorsement type
        if endorsement_type == "Deletion":
            # Deletion = Refund (negative premium)
            prorata_premium = -abs(prorata_premium)
        elif endorsement_type == "Correction":
            # Correction = No premium change
            prorata_premium = 0.0
        # Addition and Midterm addition remain positive (charge)
        
        return days_from_inception, days_in_policy_year, remaining_days, round(prorata_premium, 2)
    except Exception as e:
        logging.error(f"Error calculating pro-rata premium: {e}")
        return 0, 0, 0, 0.0


def parse_date(date_str: str) -> str:
    if pd.isna(date_str):
        return None
    
    date_str = str(date_str).strip()
    formats = ["%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%Y/%m/%d", "%d.%m.%Y"]
    
    for fmt in formats:
        try:
            parsed_date = datetime.strptime(date_str, fmt)
            return parsed_date.strftime("%Y-%m-%d")
        except ValueError:
            continue
    
    try:
        parsed_date = pd.to_datetime(date_str)
        return parsed_date.strftime("%Y-%m-%d")
    except:
        return None


def get_premium_type(endorsement_type: str) -> str:
    """Get premium type label based on endorsement type"""
    if endorsement_type in ["Addition", "Midterm addition"]:
        return "Charge"
    elif endorsement_type == "Deletion":
        return "Refund"
    else:
        return "No Change"


async def send_email_notification(
    to_emails: List[str],
    subject: str,
    body: str,
    cc_emails: List[str] = None,
    bcc_emails: List[str] = None,
    from_email: str = None,
    attachments: List[tuple] = None  # List of (filename, content_bytes)
):
    """Send email via Gmail SMTP with attachments support"""
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        logging.warning("Email not configured - SMTP credentials missing")
        return False
    
    try:
        msg = MIMEMultipart()
        msg['From'] = from_email or DEFAULT_FROM_EMAIL or SMTP_USERNAME
        msg['To'] = ', '.join(to_emails)
        msg['Subject'] = subject
        
        if cc_emails:
            msg['Cc'] = ', '.join(cc_emails)
        
        # Add body
        msg.attach(MIMEText(body, 'html'))
        
        # Add attachments
        if attachments:
            for filename, content in attachments:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(content)
                encoders.encode_base64(part)
                part.add_header('Content-Disposition', f'attachment; filename="{filename}"')
                msg.attach(part)
        
        # Build recipient list
        all_recipients = to_emails.copy()
        if cc_emails:
            all_recipients.extend(cc_emails)
        if bcc_emails:
            all_recipients.extend(bcc_emails)
        
        # Send email
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(msg['From'], all_recipients, msg.as_string())
        
        logging.info(f"Email sent successfully to {to_emails}")
        return True
    except Exception as e:
        logging.error(f"Failed to send email: {e}")
        return False


# ==================== AI NOTIFICATION GENERATION ====================

async def generate_ai_notification(notification_type: str, context: dict) -> dict:
    """Generate AI-powered notification content for email and WhatsApp"""
    if not EMERGENT_LLM_KEY:
        logging.warning("AI notifications disabled - EMERGENT_LLM_KEY not configured")
        return None
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"notification-{uuid.uuid4()}",
            system_message="""You are InsureHub's notification assistant. Generate professional, warm, and concise notification messages for insurance endorsement workflows.

Guidelines:
- Be professional yet friendly
- Keep messages concise but informative
- Use bullet points for key details
- Include relevant emojis sparingly for WhatsApp messages
- For emails, use proper HTML formatting
- Always include the key information: member name, policy, endorsement type, status
- Add a brief contextual message that feels human, not robotic
- Sign off appropriately for business communication"""
        ).with_model("openai", "gpt-4o-mini")
        
        if notification_type == "endorsement_submitted":
            prompt = f"""Generate notification content for a NEW ENDORSEMENT SUBMISSION.

Context:
- Submitted by: {context.get('submitted_by', 'HR User')}
- Policy Number: {context.get('policy_number', 'N/A')}
- Member Name: {context.get('member_name', 'N/A')}
- Endorsement Type: {context.get('endorsement_type', 'N/A')}
- Relationship: {context.get('relationship_type', 'N/A')}
- Pro-rata Premium: ₹{context.get('prorata_premium', 0):,.2f}
- Submitted At: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}

Generate two versions:
1. EMAIL_SUBJECT: A brief subject line (max 60 chars)
2. EMAIL_BODY: HTML formatted email body (professional, include all details in a styled card)
3. WHATSAPP_MESSAGE: Plain text with WhatsApp formatting (*bold*, _italic_) and appropriate emojis

Format your response exactly as:
EMAIL_SUBJECT: [subject here]
---EMAIL_BODY---
[html body here]
---WHATSAPP_MESSAGE---
[whatsapp message here]"""

        elif notification_type == "endorsement_approved":
            prompt = f"""Generate notification content for an APPROVED ENDORSEMENT.

Context:
- Approved by: {context.get('approved_by', 'Admin')}
- HR who submitted: {context.get('hr_name', 'HR User')}
- Policy Number: {context.get('policy_number', 'N/A')}
- Member Name: {context.get('member_name', 'N/A')}
- Endorsement Type: {context.get('endorsement_type', 'N/A')}
- Pro-rata Premium: ₹{context.get('prorata_premium', 0):,.2f}
- Remarks: {context.get('remarks', 'None')}
- Processed At: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}

Generate two versions:
1. EMAIL_SUBJECT: A brief subject line (max 60 chars) - positive tone
2. EMAIL_BODY: HTML formatted email body (celebratory but professional, green accents)
3. WHATSAPP_MESSAGE: Plain text with WhatsApp formatting and ✅ emoji

Format your response exactly as:
EMAIL_SUBJECT: [subject here]
---EMAIL_BODY---
[html body here]
---WHATSAPP_MESSAGE---
[whatsapp message here]"""

        elif notification_type == "endorsement_rejected":
            prompt = f"""Generate notification content for a REJECTED ENDORSEMENT.

Context:
- Rejected by: {context.get('approved_by', 'Admin')}
- HR who submitted: {context.get('hr_name', 'HR User')}
- Policy Number: {context.get('policy_number', 'N/A')}
- Member Name: {context.get('member_name', 'N/A')}
- Endorsement Type: {context.get('endorsement_type', 'N/A')}
- Remarks/Reason: {context.get('remarks', 'No specific reason provided')}
- Processed At: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}

Generate two versions:
1. EMAIL_SUBJECT: A brief subject line (max 60 chars) - professional, not harsh
2. EMAIL_BODY: HTML formatted email body (empathetic, constructive, explain next steps)
3. WHATSAPP_MESSAGE: Plain text with WhatsApp formatting, professional tone

Format your response exactly as:
EMAIL_SUBJECT: [subject here]
---EMAIL_BODY---
[html body here]
---WHATSAPP_MESSAGE---
[whatsapp message here]"""

        elif notification_type == "user_registered":
            prompt = f"""Generate notification content for a NEW USER REGISTRATION.

Context:
- New User: {context.get('full_name', 'New User')}
- Username: {context.get('username', 'N/A')}
- Role: {context.get('role', 'N/A')}
- Email: {context.get('email', 'N/A')}
- Phone: {context.get('phone', 'Not provided')}
- Registered At: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}

Generate TWO sets of notifications:
A) WELCOME EMAIL for the new user (warm, welcoming)
B) NOTIFICATION for existing HR/Admin users about the new registration

Format your response exactly as:
WELCOME_SUBJECT: [subject here]
---WELCOME_BODY---
[html body here]
---WELCOME_WHATSAPP---
[whatsapp message here]
---NOTIFY_SUBJECT---
[subject here]
---NOTIFY_BODY---
[html body here]
---NOTIFY_WHATSAPP---
[whatsapp message here]"""

        else:
            return None
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse the response
        result = parse_ai_notification_response(response, notification_type)
        return result
        
    except Exception as e:
        logging.error(f"AI notification generation failed: {e}")
        return None


def parse_ai_notification_response(response: str, notification_type: str) -> dict:
    """Parse AI response into structured notification content"""
    result = {}
    
    try:
        if notification_type == "user_registered":
            # Parse welcome and notify sections
            if "WELCOME_SUBJECT:" in response:
                result['welcome_subject'] = response.split("WELCOME_SUBJECT:")[1].split("---")[0].strip()
            if "---WELCOME_BODY---" in response:
                result['welcome_body'] = response.split("---WELCOME_BODY---")[1].split("---WELCOME_WHATSAPP---")[0].strip()
            if "---WELCOME_WHATSAPP---" in response:
                result['welcome_whatsapp'] = response.split("---WELCOME_WHATSAPP---")[1].split("---NOTIFY_SUBJECT---")[0].strip()
            if "---NOTIFY_SUBJECT---" in response:
                result['notify_subject'] = response.split("---NOTIFY_SUBJECT---")[1].split("---")[0].strip()
            if "---NOTIFY_BODY---" in response:
                result['notify_body'] = response.split("---NOTIFY_BODY---")[1].split("---NOTIFY_WHATSAPP---")[0].strip()
            if "---NOTIFY_WHATSAPP---" in response:
                result['notify_whatsapp'] = response.split("---NOTIFY_WHATSAPP---")[1].strip()
        else:
            # Parse standard notification
            if "EMAIL_SUBJECT:" in response:
                result['email_subject'] = response.split("EMAIL_SUBJECT:")[1].split("---")[0].strip()
            if "---EMAIL_BODY---" in response:
                result['email_body'] = response.split("---EMAIL_BODY---")[1].split("---WHATSAPP_MESSAGE---")[0].strip()
            if "---WHATSAPP_MESSAGE---" in response:
                result['whatsapp_message'] = response.split("---WHATSAPP_MESSAGE---")[1].strip()
        
        return result
    except Exception as e:
        logging.error(f"Failed to parse AI notification response: {e}")
        return {}


def generate_pdf_report(endorsements: List[dict], policies: dict, report_type: str = "detailed") -> bytes:
    """Generate PDF report for endorsements"""
    buffer = io.BytesIO()
    
    if report_type == "summary":
        doc = SimpleDocTemplate(buffer, pagesize=A4)
    else:
        doc = SimpleDocTemplate(buffer, pagesize=landscape(A4))
    
    elements = []
    styles = getSampleStyleSheet()
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=30,
        alignment=1  # Center
    )
    elements.append(Paragraph("InsureHub - Approved Endorsements Report", title_style))
    elements.append(Paragraph(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    if report_type == "summary":
        # Summary statistics
        total_endorsements = len(endorsements)
        total_additions = sum(1 for e in endorsements if e.get('endorsement_type') in ['Addition', 'Midterm addition'])
        total_deletions = sum(1 for e in endorsements if e.get('endorsement_type') == 'Deletion')
        total_premium = sum(e.get('prorata_premium', 0) for e in endorsements)
        total_charge = sum(e.get('prorata_premium', 0) for e in endorsements if e.get('prorata_premium', 0) > 0)
        total_refund = abs(sum(e.get('prorata_premium', 0) for e in endorsements if e.get('prorata_premium', 0) < 0))
        
        summary_data = [
            ['Metric', 'Value'],
            ['Total Endorsements', str(total_endorsements)],
            ['Additions', str(total_additions)],
            ['Deletions', str(total_deletions)],
            ['Total Premium (Charge)', f'₹{total_charge:,.2f}'],
            ['Total Refund', f'₹{total_refund:,.2f}'],
            ['Net Premium Impact', f'₹{total_premium:,.2f}'],
        ]
        
        summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f0f9ff')),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 30))
        
        # Premium breakdown by type
        elements.append(Paragraph("Premium Breakdown by Endorsement Type", styles['Heading2']))
        elements.append(Spacer(1, 10))
        
        type_breakdown = {}
        for e in endorsements:
            etype = e.get('endorsement_type', 'Unknown')
            if etype not in type_breakdown:
                type_breakdown[etype] = {'count': 0, 'premium': 0}
            type_breakdown[etype]['count'] += 1
            type_breakdown[etype]['premium'] += e.get('prorata_premium', 0)
        
        breakdown_data = [['Endorsement Type', 'Count', 'Premium']]
        for etype, data in type_breakdown.items():
            premium_str = f'₹{data["premium"]:,.2f}'
            if data["premium"] < 0:
                premium_str += ' (Refund)'
            breakdown_data.append([etype, str(data['count']), premium_str])
        
        breakdown_table = Table(breakdown_data, colWidths=[2.5*inch, 1.5*inch, 2*inch])
        breakdown_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#059669')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        elements.append(breakdown_table)
        
    else:
        # Detailed table
        headers = ['Policy', 'Employee ID', 'Member', 'Type', 'Premium Type', 'Premium', 'Status']
        data = [headers]
        
        for e in endorsements:
            premium = e.get('prorata_premium', 0)
            premium_type = get_premium_type(e.get('endorsement_type', ''))
            premium_str = f'₹{abs(premium):,.2f}'
            if premium < 0:
                premium_str = f'-{premium_str}'
            
            data.append([
                e.get('policy_number', ''),
                e.get('employee_id', '-'),
                e.get('member_name', ''),
                e.get('endorsement_type', ''),
                premium_type,
                premium_str,
                e.get('status', ''),
            ])
        
        table = Table(data, colWidths=[1.2*inch, 1*inch, 1.5*inch, 1*inch, 1*inch, 1*inch, 0.8*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0f9ff')]),
        ]))
        elements.append(table)
    
    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()


# ==================== Audit Log Helper ====================
async def log_audit(user_id: str, username: str, role: str, action: str, resource: str, resource_id: str = None, details: str = None):
    """Log a user action to the audit_log collection"""
    entry = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "username": username,
        "role": role,
        "action": action,
        "resource": resource,
        "resource_id": resource_id,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.audit_log.insert_one(entry)


# API Endpoints

@api_router.get("/")
async def root():
    return {"message": "InsureHub - Endorsement Portal with Approval Workflow"}


@api_router.get("/health")
async def health_check():
    """Health check endpoint for deployment monitoring"""
    return {"status": "healthy", "service": "insurehub-api"}


class ContactForm(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    company: Optional[str] = None
    message: str


@api_router.post("/contact")
async def submit_contact(form: ContactForm):
    """Save contact form submission and send email notification"""
    entry = {
        "id": str(uuid.uuid4()),
        "name": form.name,
        "email": form.email,
        "phone": form.phone,
        "company": form.company,
        "message": form.message,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.contact_leads.insert_one(entry)

    # Try to send notification email to admin
    try:
        smtp_host = os.environ.get("SMTP_HOST")
        smtp_user = os.environ.get("SMTP_USER")
        smtp_pass = os.environ.get("SMTP_PASS")
        if smtp_host and smtp_user and smtp_pass:
            subject = f"New Contact Lead: {form.name} ({form.company or 'N/A'})"
            body = f"Name: {form.name}\nEmail: {form.email}\nPhone: {form.phone or 'N/A'}\nCompany: {form.company or 'N/A'}\n\nMessage:\n{form.message}"
            msg = MIMEMultipart()
            msg['From'] = smtp_user
            msg['To'] = "ks@aarogya-assist.com"
            msg['Subject'] = subject
            msg.attach(MIMEText(body, 'plain'))
            smtp_port = int(os.environ.get("SMTP_PORT", 465))
            with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
    except Exception as e:
        logging.error(f"Failed to send contact notification: {e}")

    return {"message": "Thank you! We'll get back to you shortly."}


@app.get("/health")
async def app_health_check():
    """Root-level health check endpoint"""
    return {"status": "healthy", "service": "insurehub-api"}


# ==================== AUTHENTICATION ENDPOINTS ====================

@api_router.post("/auth/register")
async def register_user(user_data: UserCreate, background_tasks: BackgroundTasks):
    """Register a new user (HR only via public registration) and send notifications"""
    # Public registration restricted to HR role only
    if user_data.role != UserRole.HR:
        raise HTTPException(status_code=403, detail="Only HR accounts can be registered. Contact an Admin for Admin access.")
    
    existing = await db.users.find_one({"username": user_data.username}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    existing_email = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered. One email per account only.")
    
    user = User(
        username=user_data.username,
        full_name=user_data.full_name,
        email=user_data.email,
        phone=user_data.phone,
        role=user_data.role
    )
    
    doc = user.model_dump()
    doc['password_hash'] = get_password_hash(user_data.password)
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.users.insert_one(doc)
    
    await log_audit(user.id, user.username, user.role.value, "REGISTER", "user", user.id, f"New {user.role.value} user registered: {user.full_name}")
    
    # Send notification email to the newly registered user
    if user_data.email and SMTP_USERNAME:
        welcome_subject = f"Welcome to InsureHub - Account Created"
        welcome_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">InsureHub</h1>
                <p style="color: #bfdbfe; margin: 10px 0 0;">Endorsement Management Portal</p>
            </div>
            <div style="padding: 30px; background: #f8fafc;">
                <h2 style="color: #1e40af;">Welcome, {user_data.full_name}!</h2>
                <p style="color: #475569;">Your account has been successfully created on InsureHub.</p>
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Username:</strong> {user_data.username}</p>
                    <p style="margin: 5px 0;"><strong>Role:</strong> {user_data.role.value}</p>
                    <p style="margin: 5px 0;"><strong>Email:</strong> {user_data.email}</p>
                    {f'<p style="margin: 5px 0;"><strong>Phone:</strong> {user_data.phone}</p>' if user_data.phone else ''}
                </div>
                <p style="color: #475569;">You can now log in and start managing insurance endorsements.</p>
                <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
                    This is an automated message from InsureHub by Aarogya-Assist.
                </p>
            </div>
        </div>
        """
        background_tasks.add_task(send_email_notification, [user_data.email], welcome_subject, welcome_body)
    
    # Notify all existing HR and Admin users about the new registration
    if SMTP_USERNAME:
        # Get all HR and Admin users to notify
        all_users = await db.users.find(
            {"role": {"$in": ["HR", "Admin"]}, "id": {"$ne": user.id}},
            {"_id": 0, "email": 1, "phone": 1, "role": 1, "full_name": 1}
        ).to_list(100)
        
        notify_emails = [u['email'] for u in all_users if u.get('email')]
        
        if notify_emails:
            notify_subject = f"New {user_data.role.value} User Registered - InsureHub"
            notify_body = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">InsureHub</h1>
                    <p style="color: #a7f3d0; margin: 10px 0 0;">New User Registration Alert</p>
                </div>
                <div style="padding: 30px; background: #f8fafc;">
                    <h2 style="color: #059669;">New User Registered</h2>
                    <p style="color: #475569;">A new {user_data.role.value} user has registered on InsureHub.</p>
                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
                        <p style="margin: 5px 0;"><strong>Name:</strong> {user_data.full_name}</p>
                        <p style="margin: 5px 0;"><strong>Username:</strong> {user_data.username}</p>
                        <p style="margin: 5px 0;"><strong>Role:</strong> {user_data.role.value}</p>
                        <p style="margin: 5px 0;"><strong>Email:</strong> {user_data.email}</p>
                        {f'<p style="margin: 5px 0;"><strong>Phone:</strong> {user_data.phone}</p>' if user_data.phone else ''}
                        <p style="margin: 5px 0;"><strong>Registered At:</strong> {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</p>
                    </div>
                    <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
                        This is an automated notification from InsureHub by Aarogya-Assist.
                    </p>
                </div>
            </div>
            """
            background_tasks.add_task(send_email_notification, notify_emails, notify_subject, notify_body)
    
    return {"message": "User registered successfully", "user": user}


@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    """Login and get access token"""
    user = await db.users.find_one({"username": credentials.username}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    if not verify_password(credentials.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    token = create_access_token({"user_id": user['id'], "role": user['role']})
    
    await log_audit(user['id'], user['username'], user['role'], "LOGIN", "auth", details="User logged in")
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user['id'],
            "username": user['username'],
            "full_name": user['full_name'],
            "email": user['email'],
            "phone": user.get('phone'),
            "role": user['role']
        }
    }


@api_router.get("/auth/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current logged-in user info"""
    return current_user


# ==================== POLICY ENDPOINTS ====================

@api_router.post("/policies")
async def create_policy(policy_data: PolicyCreate, current_user: User = Depends(get_current_user)):
    """Create a new insurance policy (Admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can create policies")
    
    existing = await db.policies.find_one({"policy_number": policy_data.policy_number}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Policy number already exists")
    
    data = policy_data.model_dump()
    data["total_lives_count"] = data.get("employees_count", 0) + data.get("spouse_count", 0) + data.get("kids_count", 0) + data.get("parents_count", 0)
    data["total_lives_covered"] = data["total_lives_count"]
    data["annual_premium_per_life"] = round(data.get("premium", 0) / data["total_lives_count"], 2) if data["total_lives_count"] > 0 else 0
    policy = Policy(**data)
    doc = policy.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.policies.insert_one(doc)
    result = await db.policies.find_one({"id": policy.id}, {"_id": 0})
    await log_audit(current_user.id, current_user.username, current_user.role.value, "CREATE", "policy", policy.id, f"Created policy {policy_data.policy_number}")
    return result


@api_router.get("/policies")
async def get_policies(current_user: User = Depends(get_current_user)):
    """Get all policies (HR users see only assigned policies)"""
    query = {}
    if current_user.role == UserRole.HR:
        assigned = await get_hr_assigned_policy_numbers(current_user.id)
        if not assigned:
            return []
        query["policy_number"] = {"$in": assigned}
    policies = await db.policies.find(query, {"_id": 0}).to_list(1000)
    return policies


@api_router.get("/policies/{policy_id}")
async def get_policy(policy_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific policy by ID"""
    policy = await db.policies.find_one({"id": policy_id}, {"_id": 0})
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy


@api_router.put("/policies/{policy_id}")
async def update_policy(policy_id: str, policy_data: PolicyCreate, current_user: User = Depends(get_current_user)):
    """Update a policy (Admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can update policies")
    
    existing = await db.policies.find_one({"id": policy_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    update_data = policy_data.model_dump()
    update_data["total_lives_count"] = update_data.get("employees_count", 0) + update_data.get("spouse_count", 0) + update_data.get("kids_count", 0) + update_data.get("parents_count", 0)
    update_data["total_lives_covered"] = update_data["total_lives_count"]
    update_data["annual_premium_per_life"] = round(update_data.get("premium", 0) / update_data["total_lives_count"], 2) if update_data["total_lives_count"] > 0 else 0
    await db.policies.update_one({"id": policy_id}, {"$set": update_data})
    
    updated_policy = await db.policies.find_one({"id": policy_id}, {"_id": 0})
    await log_audit(current_user.id, current_user.username, current_user.role.value, "UPDATE", "policy", policy_id, f"Updated policy {policy_data.policy_number}")
    return updated_policy


@api_router.delete("/policies/{policy_id}")
async def delete_policy(policy_id: str, current_user: User = Depends(get_current_user)):
    """Delete a policy (Admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can delete policies")
    
    result = await db.policies.delete_one({"id": policy_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    await log_audit(current_user.id, current_user.username, current_user.role.value, "DELETE", "policy", policy_id, "Deleted policy")
    return {"message": "Policy deleted successfully"}


# ==================== USER NOTIFICATION ENDPOINTS ====================

@api_router.get("/users/admins")
async def get_admin_users(current_user: User = Depends(get_current_user)):
    """Get all admin users for notifications (phone and email)"""
    admins = await db.users.find(
        {"role": "Admin"},
        {"_id": 0, "id": 1, "full_name": 1, "email": 1, "phone": 1}
    ).to_list(100)
    return admins


@api_router.get("/users/hr")
async def get_hr_users(current_user: User = Depends(get_current_user)):
    """Get all HR users for notifications (phone and email)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can view HR users")
    
    hr_users = await db.users.find(
        {"role": "HR"},
        {"_id": 0, "id": 1, "full_name": 1, "email": 1, "phone": 1}
    ).to_list(100)
    return hr_users


@api_router.get("/users")
async def list_all_users(current_user: User = Depends(get_current_user)):
    """List all users (Admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can view users")
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    return users


@api_router.post("/users/create")
async def admin_create_user(user_data: UserCreate, current_user: User = Depends(get_current_user)):
    """Admin-only endpoint to create any user (HR or Admin)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can create users")
    
    existing = await db.users.find_one({"username": user_data.username}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    existing_email = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered. One email per account only.")
    
    hashed_password = get_password_hash(user_data.password)
    
    user = User(
        username=user_data.username,
        full_name=user_data.full_name,
        email=user_data.email,
        phone=user_data.phone,
        role=user_data.role,
    )
    
    user_dict = user.model_dump()
    user_dict['password_hash'] = hashed_password
    user_dict['created_at'] = datetime.now(timezone.utc).isoformat()
    await db.users.insert_one(user_dict)
    
    await log_audit(current_user.id, current_user.username, current_user.role.value, "CREATE_USER", "user", user.id, f"Created {user.role.value} user: {user.username}")
    return {"id": user.id, "username": user.username, "role": user.role.value, "message": f"{user.role.value} user created successfully"}


@api_router.delete("/users/{user_id}")
async def admin_delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Admin-only endpoint to delete a user"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can delete users")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if target_user and target_user.get("is_master_admin"):
        raise HTTPException(status_code=400, detail="Cannot delete Master Admin account")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await log_audit(current_user.id, current_user.username, current_user.role.value, "DELETE_USER", "user", user_id, "Deleted user")
    return {"message": "User deleted"}


@api_router.put("/users/{user_id}/promote")
async def promote_user_to_admin(user_id: str, current_user: User = Depends(get_current_user)):
    """Promote an HR user to Admin (Admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can promote users")
    
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    if target.get("role") == "Admin":
        raise HTTPException(status_code=400, detail="User is already an Admin")
    
    await db.users.update_one({"id": user_id}, {"$set": {"role": "Admin"}})
    await log_audit(current_user.id, current_user.username, current_user.role.value, "PROMOTE", "user", user_id, f"Promoted '{target.get('username')}' to Admin")
    return {"message": f"User '{target.get('username')}' promoted to Admin"}


@api_router.get("/users/{user_id}/contact")
async def get_user_contact(user_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific user's contact info for notifications"""
    user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "id": 1, "full_name": 1, "email": 1, "phone": 1, "role": 1}
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ==================== AI NOTIFICATION GENERATION ENDPOINT ====================

class AINotificationRequest(BaseModel):
    notification_type: str  # endorsement_submitted, endorsement_approved, endorsement_rejected
    context: dict

@api_router.post("/notifications/generate")
async def generate_notification_content(request: AINotificationRequest, current_user: User = Depends(get_current_user)):
    """Generate AI-powered notification content for email and WhatsApp"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=503, detail="AI notifications not configured")
    
    ai_content = await generate_ai_notification(request.notification_type, request.context)
    
    if not ai_content:
        raise HTTPException(status_code=500, detail="Failed to generate AI notification")
    
    return {
        "success": True,
        "content": ai_content
    }


# ==================== POLICY ASSIGNMENT ENDPOINTS ====================

@api_router.post("/policy-assignments")
async def assign_policy_to_hr(
    data: PolicyAssignmentCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Assign a policy to an HR user (Admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can assign policies")

    policy = await db.policies.find_one({"id": data.policy_id}, {"_id": 0})
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    hr_user = await db.users.find_one({"id": data.hr_user_id, "role": "HR"}, {"_id": 0})
    if not hr_user:
        raise HTTPException(status_code=404, detail="HR user not found")

    existing = await db.policy_assignments.find_one(
        {"policy_id": data.policy_id, "hr_user_id": data.hr_user_id}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Policy already assigned to this HR user")

    assignment = PolicyAssignment(
        policy_id=data.policy_id,
        policy_number=policy["policy_number"],
        hr_user_id=data.hr_user_id,
        hr_username=hr_user["username"],
        hr_full_name=hr_user["full_name"],
        assigned_by=current_user.id,
        assigned_by_name=current_user.full_name,
    )
    doc = assignment.model_dump()
    await db.policy_assignments.insert_one(doc)
    result = await db.policy_assignments.find_one({"id": assignment.id}, {"_id": 0})
    await log_audit(current_user.id, current_user.username, current_user.role.value, "ASSIGN_POLICY", "policy_assignment", assignment.id, f"Assigned policy {policy['policy_number']} to HR {hr_user['username']}")

    # Send email notification to HR user
    hr_email = hr_user.get("email")
    if hr_email:
        subject = f"Policy Assigned - {policy['policy_number']} | InsureHub"
        body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #3b82f6, #6366f1); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                <h2 style="color: white; margin: 0;">Policy Assigned to You</h2>
            </div>
            <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
                <p style="color: #334155;">Hi <strong>{hr_user['full_name']}</strong>,</p>
                <p style="color: #475569;">A new policy has been assigned to you on InsureHub. You can now view the policy details and claims.</p>
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 16px 0;">
                    <p style="margin: 5px 0;"><strong>Policy Number:</strong> {policy['policy_number']}</p>
                    <p style="margin: 5px 0;"><strong>Policy Holder:</strong> {policy.get('policy_holder_name', 'N/A')}</p>
                    <p style="margin: 5px 0;"><strong>Policy Type:</strong> {policy.get('policy_type', 'N/A')}</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> {policy.get('status', 'N/A')}</p>
                    <p style="margin: 5px 0;"><strong>Assigned By:</strong> {current_user.full_name}</p>
                </div>
                <p style="color: #64748b; font-size: 13px;">Log in to InsureHub to view the full policy details, claims, and analytics.</p>
            </div>
        </div>"""
        background_tasks.add_task(send_email_notification, [hr_email], subject, body)

    return result


@api_router.get("/policy-assignments")
async def get_policy_assignments(
    hr_user_id: Optional[str] = None,
    policy_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get policy assignments. Admin sees all, HR sees own."""
    query = {}
    if current_user.role == UserRole.HR:
        query["hr_user_id"] = current_user.id
    else:
        if hr_user_id:
            query["hr_user_id"] = hr_user_id
        if policy_id:
            query["policy_id"] = policy_id
    assignments = await db.policy_assignments.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)
    return assignments


@api_router.delete("/policy-assignments/{assignment_id}")
async def revoke_policy_assignment(
    assignment_id: str,
    current_user: User = Depends(get_current_user)
):
    """Revoke a policy assignment (Admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can revoke assignments")

    assignment = await db.policy_assignments.find_one({"id": assignment_id}, {"_id": 0})
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    await db.policy_assignments.delete_one({"id": assignment_id})
    await log_audit(current_user.id, current_user.username, current_user.role.value, "REVOKE_POLICY", "policy_assignment", assignment_id, f"Revoked policy {assignment['policy_number']} from HR {assignment['hr_username']}")
    return {"message": "Policy assignment revoked successfully"}


@api_router.post("/policy-assignments/bulk")
async def bulk_assign_policies(
    assignments: List[PolicyAssignmentCreate],
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Bulk assign multiple policies to HR users (Admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can assign policies")

    results = []
    # Track newly assigned policies per HR for email notifications
    hr_notifications = {}
    for data in assignments:
        policy = await db.policies.find_one({"id": data.policy_id}, {"_id": 0})
        if not policy:
            results.append({"policy_id": data.policy_id, "status": "error", "detail": "Policy not found"})
            continue
        hr_user = await db.users.find_one({"id": data.hr_user_id, "role": "HR"}, {"_id": 0})
        if not hr_user:
            results.append({"policy_id": data.policy_id, "status": "error", "detail": "HR user not found"})
            continue
        existing = await db.policy_assignments.find_one(
            {"policy_id": data.policy_id, "hr_user_id": data.hr_user_id}, {"_id": 0}
        )
        if existing:
            results.append({"policy_id": data.policy_id, "status": "skipped", "detail": "Already assigned"})
            continue
        assignment = PolicyAssignment(
            policy_id=data.policy_id,
            policy_number=policy["policy_number"],
            hr_user_id=data.hr_user_id,
            hr_username=hr_user["username"],
            hr_full_name=hr_user["full_name"],
            assigned_by=current_user.id,
            assigned_by_name=current_user.full_name,
        )
        doc = assignment.model_dump()
        await db.policy_assignments.insert_one(doc)
        await log_audit(current_user.id, current_user.username, current_user.role.value, "ASSIGN_POLICY", "policy_assignment", assignment.id, f"Assigned policy {policy['policy_number']} to HR {hr_user['username']}")
        results.append({"policy_id": data.policy_id, "hr_user_id": data.hr_user_id, "status": "assigned"})

        # Collect for email notification
        hr_email = hr_user.get("email")
        if hr_email:
            if data.hr_user_id not in hr_notifications:
                hr_notifications[data.hr_user_id] = {
                    "email": hr_email,
                    "full_name": hr_user["full_name"],
                    "policies": [],
                }
            hr_notifications[data.hr_user_id]["policies"].append({
                "policy_number": policy["policy_number"],
                "policy_holder_name": policy.get("policy_holder_name", "N/A"),
                "policy_type": policy.get("policy_type", "N/A"),
                "status": policy.get("status", "N/A"),
            })

    # Send one email per HR user with all newly assigned policies
    for hr_id, info in hr_notifications.items():
        policy_rows = ""
        for p in info["policies"]:
            policy_rows += f"""<tr>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">{p['policy_number']}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">{p['policy_holder_name']}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">{p['policy_type']}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">{p['status']}</td>
            </tr>"""
        count = len(info["policies"])
        subject = f"{count} {'Policy' if count == 1 else 'Policies'} Assigned to You | InsureHub"
        body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #3b82f6, #6366f1); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                <h2 style="color: white; margin: 0;">{count} {'Policy' if count == 1 else 'Policies'} Assigned to You</h2>
            </div>
            <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
                <p style="color: #334155;">Hi <strong>{info['full_name']}</strong>,</p>
                <p style="color: #475569;">The following {'policy has' if count == 1 else 'policies have'} been assigned to you on InsureHub by <strong>{current_user.full_name}</strong>.</p>
                <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #e2e8f0; border-radius: 6px; margin: 16px 0;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #64748b;">Policy #</th>
                            <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #64748b;">Holder</th>
                            <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #64748b;">Type</th>
                            <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #64748b;">Status</th>
                        </tr>
                    </thead>
                    <tbody>{policy_rows}</tbody>
                </table>
                <p style="color: #64748b; font-size: 13px;">Log in to InsureHub to view full policy details, claims, and analytics.</p>
            </div>
        </div>"""
        background_tasks.add_task(send_email_notification, [info["email"]], subject, body)

    return {"results": results}


# ==================== ENDORSEMENT ENDPOINTS ====================

@api_router.post("/endorsements", response_model=Endorsement)
async def create_endorsement(endorsement_data: EndorsementCreate, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user)):
    """Create a new endorsement (HR can submit, goes to Pending status) and notify Admins"""
    policy = await db.policies.find_one({"policy_number": endorsement_data.policy_number}, {"_id": 0})
    if not policy:
        raise HTTPException(status_code=404, detail=f"Policy {endorsement_data.policy_number} not found")
    
    # Parents not allowed for Midterm addition
    if endorsement_data.relationship_type in [RelationshipType.FATHER, RelationshipType.MOTHER]:
        if endorsement_data.endorsement_type == EndorsementType.MIDTERM_ADDITION:
            raise HTTPException(
                status_code=400,
                detail=f"Parents ({endorsement_data.relationship_type.value}) are not allowed for Midterm addition."
            )
    
    # 45-day backdating validation for DOJ and DOL
    today = date.today()
    min_allowed_date = today - __import__('datetime').timedelta(days=45)
    
    if endorsement_data.date_of_joining:
        try:
            doj = datetime.strptime(endorsement_data.date_of_joining, "%Y-%m-%d").date()
            if doj < min_allowed_date:
                raise HTTPException(status_code=400, detail="Date of Joining cannot be more than 45 days backdated")
        except ValueError:
            pass
    
    if endorsement_data.date_of_leaving:
        try:
            dol = datetime.strptime(endorsement_data.date_of_leaving, "%Y-%m-%d").date()
            if dol < min_allowed_date:
                raise HTTPException(status_code=400, detail="Date of Leaving cannot be more than 45 days backdated")
        except ValueError:
            pass
    
    effective_date = endorsement_data.effective_date or endorsement_data.endorsement_date
    
    days_from_inception, days_in_policy_year, remaining_days, prorata_premium = calculate_prorata_premium(
        policy['inception_date'],
        policy['expiry_date'],
        endorsement_data.endorsement_date,
        policy['annual_premium_per_life'],
        endorsement_data.endorsement_type.value
    )
    
    endorsement = Endorsement(
        policy_id=policy['id'],
        policy_number=endorsement_data.policy_number,
        employee_id=endorsement_data.employee_id,
        member_name=endorsement_data.member_name,
        dob=endorsement_data.dob,
        age=endorsement_data.age,
        gender=endorsement_data.gender.value if endorsement_data.gender else None,
        relationship_type=endorsement_data.relationship_type,
        endorsement_type=endorsement_data.endorsement_type,
        date_of_joining=endorsement_data.date_of_joining,
        date_of_leaving=endorsement_data.date_of_leaving,
        coverage_type=endorsement_data.coverage_type.value if endorsement_data.coverage_type else None,
        sum_insured=endorsement_data.sum_insured,
        annual_premium_per_life=policy['annual_premium_per_life'],
        endorsement_date=endorsement_data.endorsement_date,
        effective_date=effective_date,
        days_from_inception=days_from_inception,
        days_in_policy_year=days_in_policy_year,
        remaining_days=remaining_days,
        prorata_premium=prorata_premium,
        status=EndorsementStatus.PENDING,
        submitted_by=current_user.id,
        remarks=endorsement_data.remarks
    )
    
    doc = endorsement.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.endorsements.insert_one(doc)
    
    # Generate Excel attachment for the endorsement
    excel_attachment = None
    try:
        excel_rows = [{
            'Policy Number': endorsement_data.policy_number,
            'Member Name': endorsement_data.member_name,
            'Employee ID': endorsement_data.employee_id or '',
            'DOB': endorsement_data.dob or '',
            'Age': endorsement_data.age or '',
            'Gender': endorsement_data.gender.value if endorsement_data.gender else '',
            'Relationship Type': endorsement_data.relationship_type.value,
            'Endorsement Type': endorsement_data.endorsement_type.value,
            'Date of Joining': endorsement_data.date_of_joining or '',
            'Date of Leaving': endorsement_data.date_of_leaving or '',
            'Sum Insured': endorsement_data.sum_insured or '',
            'Annual Premium/Life': policy.get('annual_premium_per_life', ''),
            'Pro-rata Premium': prorata_premium,
            'Endorsement Date': endorsement_data.endorsement_date,
            'Effective Date': effective_date,
            'Remarks': endorsement_data.remarks or '',
            'Submitted By': current_user.full_name,
        }]
        edf = pd.DataFrame(excel_rows)
        excel_buf = io.BytesIO()
        with pd.ExcelWriter(excel_buf, engine='openpyxl') as writer:
            edf.to_excel(writer, index=False, sheet_name='Endorsement')
        excel_buf.seek(0)
        excel_attachment = [(f"Endorsement_{endorsement_data.member_name.replace(' ','_')}.xlsx", excel_buf.read())]
    except Exception as ex:
        logging.error(f"Failed to generate Excel attachment: {ex}")
    
    # Fixed notification recipients
    FIXED_NOTIFY_EMAILS = ["ks@aarogya-assist.com", "connect@aarogya-assist.com"]
    
    # Generate AI notification and send to fixed recipients + all Admins
    if SMTP_USERNAME:
        admin_users = await db.users.find(
            {"role": "Admin"},
            {"_id": 0, "email": 1, "phone": 1, "full_name": 1}
        ).to_list(100)
        
        admin_emails = [u['email'] for u in admin_users if u.get('email')]
        
        # Combine fixed + admin emails (deduplicate)
        all_notify_emails = list(set(FIXED_NOTIFY_EMAILS + admin_emails))
        
        if all_notify_emails:
            # Try AI-generated content first
            ai_content = await generate_ai_notification("endorsement_submitted", {
                "submitted_by": current_user.full_name,
                "policy_number": endorsement_data.policy_number,
                "member_name": endorsement_data.member_name,
                "endorsement_type": endorsement_data.endorsement_type.value,
                "relationship_type": endorsement_data.relationship_type.value,
                "prorata_premium": prorata_premium
            })
            
            if ai_content and ai_content.get('email_subject') and ai_content.get('email_body'):
                notify_subject = ai_content['email_subject']
                notify_body = ai_content['email_body']
            else:
                # Fallback to static template
                notify_subject = f"New Endorsement Submitted - {endorsement_data.member_name}"
                notify_body = f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0;">InsureHub</h1>
                        <p style="color: #fef3c7; margin: 10px 0 0;">New Endorsement Pending Approval</p>
                    </div>
                    <div style="padding: 30px; background: #f8fafc;">
                        <h2 style="color: #f59e0b;">New Endorsement Submitted</h2>
                        <p style="color: #475569;">A new endorsement has been submitted and requires your approval.</p>
                        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                            <p style="margin: 5px 0;"><strong>Submitted By:</strong> {current_user.full_name}</p>
                            <p style="margin: 5px 0;"><strong>Policy Number:</strong> {endorsement_data.policy_number}</p>
                            <p style="margin: 5px 0;"><strong>Member Name:</strong> {endorsement_data.member_name}</p>
                            <p style="margin: 5px 0;"><strong>Endorsement Type:</strong> {endorsement_data.endorsement_type.value}</p>
                            <p style="margin: 5px 0;"><strong>Relationship:</strong> {endorsement_data.relationship_type.value}</p>
                            <p style="margin: 5px 0;"><strong>Pro-rata Premium:</strong> ₹{prorata_premium:,.2f}</p>
                            <p style="margin: 5px 0;"><strong>Submitted At:</strong> {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</p>
                        </div>
                        <p style="color: #475569;">Please log in to the Admin portal to review and approve/reject this endorsement.</p>
                        <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
                            This is an automated notification from InsureHub by Aarogya-Assist.
                        </p>
                    </div>
                </div>
                """
            background_tasks.add_task(send_email_notification, all_notify_emails, notify_subject, notify_body, None, None, None, excel_attachment)
    
    await log_audit(current_user.id, current_user.username, current_user.role.value, "CREATE", "endorsement", endorsement.id, f"Created endorsement for {endorsement_data.member_name} on {endorsement_data.policy_number}")
    return endorsement


@api_router.get("/endorsements", response_model=List[Endorsement])
async def get_endorsements(
    policy_number: Optional[str] = None,
    relationship_type: Optional[RelationshipType] = None,
    status: Optional[EndorsementStatus] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all endorsements with optional filters"""
    query = {}
    
    # HR users can only see their own submissions
    if current_user.role == UserRole.HR:
        query["submitted_by"] = current_user.id
    
    if policy_number:
        query["policy_number"] = policy_number
    if relationship_type:
        query["relationship_type"] = relationship_type
    if status:
        query["status"] = status
    
    endorsements = await db.endorsements.find(query, {"_id": 0}).to_list(10000)
    
    for endorsement in endorsements:
        if isinstance(endorsement['created_at'], str):
            endorsement['created_at'] = datetime.fromisoformat(endorsement['created_at'])
    
    return endorsements


# ==================== EXCEL PREVIEW ENDPOINT ====================
@api_router.post("/endorsements/preview")
async def preview_excel_import(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Preview Excel data before importing - returns parsed rows with calculated premiums"""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")
    
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')
        
        required_columns = ['policy_number', 'member_name', 'relationship_type', 'endorsement_type', 'endorsement_date']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise HTTPException(status_code=400, detail=f"Missing required columns: {', '.join(missing_columns)}")
        
        preview_rows = []
        errors = []
        
        for index, row in df.iterrows():
            try:
                policy_number = str(row['policy_number']).strip()
                member_name = str(row['member_name']).strip()
                relationship_type = str(row['relationship_type']).strip()
                endorsement_type = str(row['endorsement_type']).strip()
                endorsement_date = parse_date(str(row['endorsement_date']))
                
                if not endorsement_date:
                    errors.append({"row": index + 2, "error": "Invalid endorsement date"})
                    continue
                
                policy = await db.policies.find_one({"policy_number": policy_number}, {"_id": 0})
                annual_premium = 0
                prorata_premium = 0
                
                if policy:
                    annual_premium = policy.get('annual_premium_per_life', 0)
                    _, _, _, prorata_premium = calculate_prorata_premium(
                        policy['inception_date'], policy['expiry_date'],
                        endorsement_date, annual_premium, endorsement_type
                    )
                elif 'annual_premium_per_life' in df.columns and pd.notna(row.get('annual_premium_per_life')):
                    annual_premium = float(row['annual_premium_per_life'])
                    if 'policy_inception_date' in df.columns and 'policy_expiry_date' in df.columns:
                        inc = parse_date(str(row['policy_inception_date']))
                        exp = parse_date(str(row['policy_expiry_date']))
                        if inc and exp:
                            _, _, _, prorata_premium = calculate_prorata_premium(inc, exp, endorsement_date, annual_premium, endorsement_type)
                
                # Check parent midterm restriction
                parent_restricted = False
                parent_warning = ""
                if relationship_type in ["Father", "Mother"] and endorsement_type == "Midterm addition":
                    parent_restricted = True
                    parent_warning = f"Parents ({relationship_type}) not allowed for Midterm addition"
                
                preview_rows.append({
                    "row_num": index + 2,
                    "policy_number": policy_number,
                    "member_name": member_name,
                    "relationship_type": relationship_type,
                    "endorsement_type": endorsement_type,
                    "endorsement_date": endorsement_date,
                    "employee_id": str(row.get('employee_id', '')).strip() if pd.notna(row.get('employee_id')) else '',
                    "dob": parse_date(str(row.get('dob', ''))) if pd.notna(row.get('dob')) else '',
                    "age": int(row['age']) if 'age' in df.columns and pd.notna(row.get('age')) else None,
                    "gender": str(row.get('gender', '')).strip() if pd.notna(row.get('gender')) else '',
                    "sum_insured": float(row.get('suminsured', 0)) if pd.notna(row.get('suminsured')) else 0,
                    "annual_premium_per_life": annual_premium,
                    "prorata_premium": prorata_premium,
                    "policy_exists": policy is not None,
                    "remarks": str(row.get('remarks', '')).strip() if pd.notna(row.get('remarks')) else '',
                    "parent_restricted": parent_restricted,
                    "parent_warning": parent_warning
                })
            except Exception as e:
                errors.append({"row": index + 2, "error": str(e)})
        
        restricted_count = sum(1 for r in preview_rows if r.get("parent_restricted"))
        return {
            "total_rows": len(df),
            "valid_rows": len(preview_rows),
            "error_count": len(errors),
            "restricted_count": restricted_count,
            "rows": preview_rows,
            "errors": errors
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing Excel: {str(e)}")


# ==================== IMPORT BATCHES ENDPOINT ====================
@api_router.get("/endorsements/import-batches")
async def get_import_batches(current_user: User = Depends(get_current_user)):
    """Get list of import batches - HR sees only their own, Admin sees all"""
    match_filter = {"import_batch_id": {"$exists": True, "$ne": None}}
    if current_user.role == UserRole.HR:
        match_filter["submitted_by"] = current_user.id
    
    pipeline = [
        {"$match": match_filter},
        {"$group": {
            "_id": "$import_batch_id",
            "count": {"$sum": 1},
            "policy_numbers": {"$addToSet": "$policy_number"},
            "first_created": {"$min": "$created_at"},
            "submitted_by": {"$first": "$submitted_by"},
            "statuses": {"$addToSet": "$status"},
            "total_premium": {"$sum": "$prorata_premium"}
        }},
        {"$sort": {"first_created": -1}},
        {"$limit": 50}
    ]
    batches = await db.endorsements.aggregate(pipeline).to_list(50)
    
    user_ids = list(set([b.get('submitted_by') for b in batches if b.get('submitted_by')]))
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "full_name": 1}).to_list(100)
    user_map = {u['id']: u['full_name'] for u in users}
    
    result = []
    for b in batches:
        result.append({
            "batch_id": b["_id"],
            "count": b["count"],
            "policy_numbers": b["policy_numbers"],
            "created_at": b["first_created"],
            "submitted_by_name": user_map.get(b.get("submitted_by"), "Unknown"),
            "statuses": b["statuses"],
            "total_premium": round(b["total_premium"], 2)
        })
    
    return result


@api_router.get("/endorsements/batch/{batch_id}")
async def get_batch_endorsements(batch_id: str, current_user: User = Depends(get_current_user)):
    """Get all endorsements in an import batch"""
    query = {"import_batch_id": batch_id}
    if current_user.role == UserRole.HR:
        query["submitted_by"] = current_user.id
    endorsements = await db.endorsements.find(
        query, {"_id": 0}
    ).to_list(10000)
    
    for e in endorsements:
        if isinstance(e.get('created_at'), str):
            e['created_at'] = datetime.fromisoformat(e['created_at'])
    
    return endorsements


@api_router.get("/endorsements/batch/{batch_id}/download")
async def download_batch_excel(batch_id: str, current_user: User = Depends(get_current_user)):
    """Download all endorsements from a batch as Excel"""
    query = {"import_batch_id": batch_id}
    if current_user.role == UserRole.HR:
        query["submitted_by"] = current_user.id
    endorsements = await db.endorsements.find(
        query, {"_id": 0}
    ).to_list(10000)
    
    if not endorsements:
        raise HTTPException(status_code=404, detail="No endorsements found for this batch")
    
    policy_ids = list(set([e['policy_id'] for e in endorsements]))
    policies = await db.policies.find({"id": {"$in": policy_ids}}, {"_id": 0}).to_list(1000)
    policy_map = {p['id']: p for p in policies}
    
    rows = []
    for e in endorsements:
        policy = policy_map.get(e.get('policy_id'), {})
        rows.append({
            'Policy Number': e.get('policy_number', ''),
            'Member Name': e.get('member_name', ''),
            'Employee ID': e.get('employee_id', ''),
            'DOB': e.get('dob', ''),
            'Age': e.get('age', ''),
            'Gender': e.get('gender', ''),
            'Relationship Type': e.get('relationship_type', ''),
            'Endorsement Type': e.get('endorsement_type', ''),
            'Date of Joining': e.get('date_of_joining', ''),
            'Date of Leaving': e.get('date_of_leaving', ''),
            'Coverage Type': e.get('coverage_type', ''),
            'Sum Insured': e.get('sum_insured', ''),
            'Annual Premium Per Life': e.get('annual_premium_per_life', policy.get('annual_premium_per_life', '')),
            'Endorsement Date': e.get('endorsement_date', ''),
            'Effective Date': e.get('effective_date', ''),
            'Pro-rata Premium': e.get('prorata_premium', 0),
            'Status': e.get('status', ''),
            'Remarks': e.get('remarks', '')
        })
    
    df = pd.DataFrame(rows)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Import Batch')
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=batch_{batch_id[:8]}.xlsx"}
    )


@api_router.get("/endorsements/{endorsement_id}", response_model=Endorsement)
async def get_endorsement(endorsement_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific endorsement by ID"""
    endorsement = await db.endorsements.find_one({"id": endorsement_id}, {"_id": 0})
    if not endorsement:
        raise HTTPException(status_code=404, detail="Endorsement not found")
    
    if isinstance(endorsement['created_at'], str):
        endorsement['created_at'] = datetime.fromisoformat(endorsement['created_at'])
    
    return endorsement


@api_router.put("/endorsements/{endorsement_id}", response_model=Endorsement)
async def update_endorsement(endorsement_id: str, update_data: EndorsementUpdate, current_user: User = Depends(get_current_user)):
    """Update an endorsement (only if Pending status)"""
    existing = await db.endorsements.find_one({"id": endorsement_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Endorsement not found")
    
    # HR can only edit their own pending endorsements
    if current_user.role == UserRole.HR:
        if existing['submitted_by'] != current_user.id:
            raise HTTPException(status_code=403, detail="You can only edit your own endorsements")
        if existing['status'] != EndorsementStatus.PENDING.value:
            raise HTTPException(status_code=403, detail="You can only edit pending endorsements")
    
    policy = await db.policies.find_one({"id": existing['policy_id']}, {"_id": 0})
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    
    endorsement_date = update_dict.get('endorsement_date', existing['endorsement_date'])
    endorsement_type = update_dict.get('endorsement_type', existing['endorsement_type'])
    
    # Recalculate premium if date or type changed
    if 'endorsement_date' in update_dict or 'endorsement_type' in update_dict:
        days_from_inception, days_in_policy_year, remaining_days, prorata_premium = calculate_prorata_premium(
            policy['inception_date'],
            policy['expiry_date'],
            endorsement_date,
            policy['annual_premium_per_life'],
            endorsement_type
        )
        
        update_dict['days_from_inception'] = days_from_inception
        update_dict['days_in_policy_year'] = days_in_policy_year
        update_dict['remaining_days'] = remaining_days
        update_dict['prorata_premium'] = prorata_premium
    
    await db.endorsements.update_one({"id": endorsement_id}, {"$set": update_dict})
    
    updated_endorsement = await db.endorsements.find_one({"id": endorsement_id}, {"_id": 0})
    if isinstance(updated_endorsement['created_at'], str):
        updated_endorsement['created_at'] = datetime.fromisoformat(updated_endorsement['created_at'])
    
    return updated_endorsement


@api_router.delete("/endorsements/{endorsement_id}")
async def delete_endorsement(endorsement_id: str, current_user: User = Depends(get_current_user)):
    """Delete an endorsement"""
    endorsement = await db.endorsements.find_one({"id": endorsement_id}, {"_id": 0})
    if not endorsement:
        raise HTTPException(status_code=404, detail="Endorsement not found")
    
    # HR can only delete their own pending endorsements
    if current_user.role == UserRole.HR:
        if endorsement['submitted_by'] != current_user.id:
            raise HTTPException(status_code=403, detail="You can only delete your own endorsements")
        if endorsement['status'] != EndorsementStatus.PENDING.value:
            raise HTTPException(status_code=403, detail="You can only delete pending endorsements")
    
    result = await db.endorsements.delete_one({"id": endorsement_id})
    
    await log_audit(current_user.id, current_user.username, current_user.role.value, "DELETE", "endorsement", endorsement_id, "Deleted endorsement")
    return {"message": "Endorsement deleted successfully"}


@api_router.post("/endorsements/{endorsement_id}/approve", response_model=Endorsement)
async def approve_reject_endorsement(
    endorsement_id: str, 
    approval: EndorsementApproval,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Approve or reject an endorsement (Admin only) and notify HR who submitted"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can approve/reject endorsements")
    
    endorsement = await db.endorsements.find_one({"id": endorsement_id}, {"_id": 0})
    if not endorsement:
        raise HTTPException(status_code=404, detail="Endorsement not found")
    
    if endorsement['status'] != EndorsementStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Endorsement is already processed")
    
    update_data = {
        "status": approval.status.value,
        "approved_by": current_user.id,
        "approval_date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
    }
    
    if approval.remarks:
        update_data["remarks"] = approval.remarks
    
    await db.endorsements.update_one({"id": endorsement_id}, {"$set": update_data})
    
    # Update policy lives covered if approved
    if approval.status == EndorsementStatus.APPROVED:
        if endorsement['endorsement_type'] == EndorsementType.ADDITION.value:
            await db.policies.update_one(
                {"id": endorsement['policy_id']},
                {"$inc": {"total_lives_covered": 1}}
            )
        elif endorsement['endorsement_type'] == EndorsementType.DELETION.value:
            await db.policies.update_one(
                {"id": endorsement['policy_id']},
                {"$inc": {"total_lives_covered": -1}}
            )
        
        # Auto-adjust CD Ledger balance
        premium = endorsement.get('prorata_premium', 0)
        if premium != 0:
            cd_entry = {
                "id": str(uuid.uuid4()),
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "reference": f"END-{endorsement_id[:8].upper()}",
                "description": f"{'Premium Charge' if premium > 0 else 'Refund Credit'} - {endorsement['member_name']} ({endorsement['endorsement_type']})",
                "amount": -premium,  # Deduct charge (negative), credit refund (positive since premium is negative)
                "policy_number": endorsement.get('policy_number'),
                "entry_type": "Endorsement Deduction" if premium > 0 else "Refund Credit",
                "endorsement_id": endorsement_id,
                "created_by": current_user.id,
                "created_by_name": current_user.full_name,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.cd_ledger.insert_one(cd_entry)
    
    # Send email notification to HR who submitted the endorsement
    if SMTP_USERNAME and endorsement.get('submitted_by'):
        submitter = await db.users.find_one(
            {"id": endorsement['submitted_by']},
            {"_id": 0, "email": 1, "phone": 1, "full_name": 1}
        )
        
        if submitter and submitter.get('email'):
            status_text = "Approved" if approval.status == EndorsementStatus.APPROVED else "Rejected"
            notification_type = "endorsement_approved" if approval.status == EndorsementStatus.APPROVED else "endorsement_rejected"
            
            # Try AI-generated content first
            ai_content = await generate_ai_notification(notification_type, {
                "approved_by": current_user.full_name,
                "hr_name": submitter.get('full_name', 'HR User'),
                "policy_number": endorsement['policy_number'],
                "member_name": endorsement['member_name'],
                "endorsement_type": endorsement['endorsement_type'],
                "prorata_premium": endorsement['prorata_premium'],
                "remarks": approval.remarks or "None"
            })
            
            if ai_content and ai_content.get('email_subject') and ai_content.get('email_body'):
                notify_subject = ai_content['email_subject']
                notify_body = ai_content['email_body']
            else:
                # Fallback to static template
                status_color = "#059669" if approval.status == EndorsementStatus.APPROVED else "#dc2626"
                notify_subject = f"Endorsement {status_text} - {endorsement['member_name']}"
                notify_body = f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, {status_color} 0%, {status_color}cc 100%); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0;">InsureHub</h1>
                        <p style="color: #ffffffcc; margin: 10px 0 0;">Endorsement {status_text}</p>
                    </div>
                    <div style="padding: 30px; background: #f8fafc;">
                        <h2 style="color: {status_color};">Your Endorsement Has Been {status_text}</h2>
                        <p style="color: #475569;">Dear {submitter['full_name']},</p>
                        <p style="color: #475569;">Your endorsement submission has been <strong>{status_text.lower()}</strong> by {current_user.full_name}.</p>
                        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid {status_color};">
                            <p style="margin: 5px 0;"><strong>Policy Number:</strong> {endorsement['policy_number']}</p>
                            <p style="margin: 5px 0;"><strong>Member Name:</strong> {endorsement['member_name']}</p>
                            <p style="margin: 5px 0;"><strong>Endorsement Type:</strong> {endorsement['endorsement_type']}</p>
                            <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: {status_color}; font-weight: bold;">{status_text}</span></p>
                            <p style="margin: 5px 0;"><strong>Pro-rata Premium:</strong> ₹{endorsement['prorata_premium']:,.2f}</p>
                            {f'<p style="margin: 5px 0;"><strong>Remarks:</strong> {approval.remarks}</p>' if approval.remarks else ''}
                            <p style="margin: 5px 0;"><strong>Processed By:</strong> {current_user.full_name}</p>
                            <p style="margin: 5px 0;"><strong>Processed At:</strong> {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</p>
                        </div>
                        <p style="color: #475569;">Please log in to the HR portal to view the details.</p>
                        <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
                            This is an automated notification from InsureHub by Aarogya-Assist.
                        </p>
                    </div>
                </div>
                """
            background_tasks.add_task(send_email_notification, [submitter['email']], notify_subject, notify_body)
    
    updated_endorsement = await db.endorsements.find_one({"id": endorsement_id}, {"_id": 0})
    if isinstance(updated_endorsement['created_at'], str):
        updated_endorsement['created_at'] = datetime.fromisoformat(updated_endorsement['created_at'])
    
    await log_audit(current_user.id, current_user.username, current_user.role.value, approval.status.value.upper(), "endorsement", endorsement_id, f"{approval.status.value} endorsement for {endorsement.get('member_name')}")
    return updated_endorsement


# ==================== EXCEL IMPORT ENDPOINTS ====================

@api_router.post("/endorsements/import", response_model=ImportResult)
async def import_endorsements_from_excel(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Import endorsements from Excel file with complete policy and endorsement details
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")
    
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')
        
        # Required columns for endorsement
        required_columns = ['policy_number', 'member_name', 'relationship_type', 'endorsement_type', 'endorsement_date']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise HTTPException(
                status_code=400, 
                detail=f"Missing required columns: {', '.join(missing_columns)}"
            )
        
        import_batch_id = str(uuid.uuid4())
        
        success_count = 0
        error_count = 0
        errors = []
        
        for index, row in df.iterrows():
            try:
                policy_number = str(row['policy_number']).strip()
                
                # Check if policy exists
                policy = await db.policies.find_one({"policy_number": policy_number}, {"_id": 0})
                
                # If policy doesn't exist and we have policy details in Excel, create it
                if not policy:
                    # Check if Excel has policy details
                    has_policy_details = all([
                        'policy_holder' in df.columns,
                        'policy_inception_date' in df.columns,
                        'policy_expiry_date' in df.columns,
                        'annual_premium_per_life' in df.columns
                    ])
                    
                    if has_policy_details and pd.notna(row.get('policy_holder')):
                        # Create policy from Excel data
                        inception_date = parse_date(row['policy_inception_date'])
                        expiry_date = parse_date(row['policy_expiry_date'])
                        
                        if not inception_date or not expiry_date:
                            errors.append({
                                "row": index + 2,
                                "error": f"Invalid policy dates for new policy {policy_number}"
                            })
                            error_count += 1
                            continue
                        
                        # Parse policy type if provided
                        policy_type_val = PolicyType.GROUP_HEALTH
                        if 'type_of_policy' in df.columns and pd.notna(row.get('type_of_policy')):
                            policy_type_str = str(row['type_of_policy']).strip()
                            try:
                                policy_type_val = PolicyType(policy_type_str)
                            except ValueError:
                                pass  # Use default
                        
                        new_policy = Policy(
                            policy_number=policy_number,
                            policy_holder_name=str(row['policy_holder']).strip(),
                            inception_date=inception_date,
                            expiry_date=expiry_date,
                            policy_type=policy_type_val,
                            annual_premium_per_life=float(row['annual_premium_per_life']),
                            total_lives_covered=0,
                            status=PolicyStatus.ACTIVE
                        )
                        
                        policy_doc = new_policy.model_dump()
                        policy_doc['created_at'] = policy_doc['created_at'].isoformat()
                        await db.policies.insert_one(policy_doc)
                        
                        policy = policy_doc
                        logging.info(f"Created new policy: {policy_number}")
                    else:
                        errors.append({
                            "row": index + 2,
                            "error": f"Policy {policy_number} not found and policy details not provided in Excel"
                        })
                        error_count += 1
                        continue
                
                # Parse employee ID
                employee_id = None
                if 'employee_id' in df.columns and pd.notna(row.get('employee_id')):
                    employee_id = str(row['employee_id']).strip()
                
                # Parse member name
                member_name = str(row['member_name']).strip()
                
                # Parse DOB
                dob = None
                if 'dob' in df.columns and pd.notna(row.get('dob')):
                    dob = parse_date(row['dob'])
                
                # Parse age
                age = None
                if 'age' in df.columns and pd.notna(row.get('age')):
                    try:
                        age = int(row['age'])
                    except (ValueError, TypeError):
                        pass
                
                # Parse gender
                gender = None
                if 'gender' in df.columns and pd.notna(row.get('gender')):
                    gender_str = str(row['gender']).strip()
                    try:
                        gender = Gender(gender_str).value
                    except ValueError:
                        pass
                
                # Parse relationship type
                relationship_str = str(row['relationship_type']).strip()
                try:
                    relationship_type = RelationshipType(relationship_str)
                except ValueError:
                    errors.append({
                        "row": index + 2,
                        "error": f"Invalid relationship type: {relationship_str}. Must be one of: Employee, Spouse, Kids, Mother, Father"
                    })
                    error_count += 1
                    continue
                
                # Parse endorsement type
                endorsement_type_str = str(row['endorsement_type']).strip()
                try:
                    endorsement_type = EndorsementType(endorsement_type_str)
                except ValueError:
                    errors.append({
                        "row": index + 2,
                        "error": f"Invalid endorsement type: {endorsement_type_str}. Must be one of: Addition, Deletion, Correction, Midterm addition"
                    })
                    error_count += 1
                    continue
                
                # Parents not allowed for Midterm addition
                if relationship_type in [RelationshipType.FATHER, RelationshipType.MOTHER]:
                    if endorsement_type == EndorsementType.MIDTERM_ADDITION:
                        errors.append({
                            "row": index + 2,
                            "error": f"Parents ({relationship_type.value}) not allowed for Midterm addition"
                        })
                        error_count += 1
                        continue
                
                # Parse date of joining
                date_of_joining = None
                if 'date_of_joining' in df.columns and pd.notna(row.get('date_of_joining')):
                    date_of_joining = parse_date(row['date_of_joining'])
                
                # Parse coverage type
                coverage_type = None
                if 'coverage_type' in df.columns and pd.notna(row.get('coverage_type')):
                    coverage_type_str = str(row['coverage_type']).strip()
                    try:
                        coverage_type = CoverageType(coverage_type_str).value
                    except ValueError:
                        pass
                
                # Parse sum insured
                sum_insured = None
                if 'suminsured' in df.columns and pd.notna(row.get('suminsured')):
                    try:
                        sum_insured = float(row['suminsured'])
                    except (ValueError, TypeError):
                        pass
                elif 'sum_insured' in df.columns and pd.notna(row.get('sum_insured')):
                    try:
                        sum_insured = float(row['sum_insured'])
                    except (ValueError, TypeError):
                        pass
                
                # Parse endorsement date
                endorsement_date = parse_date(row['endorsement_date'])
                if not endorsement_date:
                    errors.append({
                        "row": index + 2,
                        "error": f"Invalid endorsement date format"
                    })
                    error_count += 1
                    continue
                
                # Parse effective date (optional)
                effective_date = endorsement_date
                if 'effective_date' in df.columns and pd.notna(row.get('effective_date')):
                    parsed_effective = parse_date(row['effective_date'])
                    if parsed_effective:
                        effective_date = parsed_effective
                
                # Get remarks if provided
                remarks = str(row['remarks']).strip() if 'remarks' in df.columns and pd.notna(row.get('remarks')) else None
                
                # Calculate pro-rata premium based on endorsement type
                days_from_inception, days_in_policy_year, remaining_days, prorata_premium = calculate_prorata_premium(
                    policy['inception_date'],
                    policy['expiry_date'],
                    endorsement_date,
                    policy['annual_premium_per_life'],
                    endorsement_type.value  # Pass endorsement type for refund calculation
                )
                
                # Create endorsement
                endorsement = Endorsement(
                    policy_id=policy['id'],
                    policy_number=policy_number,
                    employee_id=employee_id,
                    member_name=member_name,
                    dob=dob,
                    age=age,
                    gender=gender,
                    relationship_type=relationship_type,
                    endorsement_type=endorsement_type,
                    date_of_joining=date_of_joining,
                    date_of_leaving=parse_date(str(row.get('date_of_leaving', ''))) if 'date_of_leaving' in df.columns and pd.notna(row.get('date_of_leaving')) else None,
                    coverage_type=coverage_type,
                    sum_insured=sum_insured,
                    annual_premium_per_life=policy.get('annual_premium_per_life', 0),
                    endorsement_date=endorsement_date,
                    effective_date=effective_date,
                    days_from_inception=days_from_inception,
                    days_in_policy_year=days_in_policy_year,
                    remaining_days=remaining_days,
                    prorata_premium=prorata_premium,
                    status=EndorsementStatus.PENDING,
                    submitted_by=current_user.id,
                    remarks=remarks,
                    import_batch_id=import_batch_id
                )
                
                doc = endorsement.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                
                await db.endorsements.insert_one(doc)
                
                success_count += 1
                
            except Exception as e:
                errors.append({
                    "row": index + 2,
                    "error": str(e)
                })
                error_count += 1
        
        return ImportResult(
            success_count=success_count,
            error_count=error_count,
            total_rows=len(df),
            errors=errors,
            import_batch_id=import_batch_id
        )
        
    except Exception as e:
        logging.error(f"Error importing Excel file: {e}")
        raise HTTPException(status_code=400, detail=f"Error processing Excel file: {str(e)}")


@api_router.get("/endorsements/template/download")
async def download_import_template(current_user: User = Depends(get_current_user)):
    """Download Excel template for importing endorsements"""
    
    # Create sample data for template with all fields
    template_data = [
        {
            'Policy Number': 'POL001',
            'Policy Holder': 'Test Company Ltd',
            'Policy Inception Date': '2025-01-01',
            'Policy Expiry Date': '2025-12-31',
            'Type of Policy': 'Group Health',
            'Annual Premium Per Life': 5000,
            'Employee ID': 'EMP001',
            'Member Name': 'John Doe',
            'DOB': '1990-05-15',
            'Age': 34,
            'Gender': 'Male',
            'Relationship Type': 'Employee',
            'Endorsement Type': 'Addition',
            'Date of Joining': '2025-01-15',
            'Coverage Type': 'Non-Floater',
            'Suminsured': 500000,
            'Endorsement Date': '2025-02-01',
            'Effective Date': '2025-02-01',
            'Remarks': 'Sample endorsement - replace with actual data'
        },
        {
            'Policy Number': 'POL001',
            'Policy Holder': 'Test Company Ltd',
            'Policy Inception Date': '2025-01-01',
            'Policy Expiry Date': '2025-12-31',
            'Type of Policy': 'Group Health',
            'Annual Premium Per Life': 5000,
            'Employee ID': 'EMP001',
            'Member Name': 'Jane Doe',
            'DOB': '1992-08-20',
            'Age': 32,
            'Gender': 'Female',
            'Relationship Type': 'Spouse',
            'Endorsement Type': 'Addition',
            'Date of Joining': '2025-01-15',
            'Coverage Type': 'Floater',
            'Suminsured': 500000,
            'Endorsement Date': '2025-02-01',
            'Effective Date': '2025-02-01',
            'Remarks': 'Spouse coverage - replace with actual data'
        },
        {
            'Policy Number': 'POL001',
            'Policy Holder': 'Test Company Ltd',
            'Policy Inception Date': '2025-01-01',
            'Policy Expiry Date': '2025-12-31',
            'Type of Policy': 'Group Health',
            'Annual Premium Per Life': 5000,
            'Employee ID': 'EMP002',
            'Member Name': 'Jack Smith',
            'DOB': '1985-03-10',
            'Age': 39,
            'Gender': 'Male',
            'Relationship Type': 'Employee',
            'Endorsement Type': 'Midterm addition',
            'Date of Joining': '2025-06-01',
            'Coverage Type': 'Non-Floater',
            'Suminsured': 300000,
            'Endorsement Date': '2025-06-05',
            'Effective Date': '2025-06-01',
            'Remarks': 'Midterm joining - replace with actual data'
        }
    ]
    
    df = pd.DataFrame(template_data)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Endorsement Import Template')
        
        # Add instructions sheet
        instructions = pd.DataFrame({
            'Column Name': [
                'Policy Number',
                'Policy Holder',
                'Policy Inception Date',
                'Policy Expiry Date',
                'Type of Policy',
                'Annual Premium Per Life',
                'Employee ID',
                'Member Name',
                'DOB',
                'Age',
                'Gender',
                'Relationship Type',
                'Endorsement Type',
                'Date of Joining',
                'Coverage Type',
                'Suminsured',
                'Endorsement Date',
                'Effective Date',
                'Remarks'
            ],
            'Description': [
                'Unique policy identifier (Required)',
                'Company/Organization name (Required if new policy)',
                'Policy start date in YYYY-MM-DD format (Required if new policy)',
                'Policy end date in YYYY-MM-DD format (Required if new policy)',
                'Group Health, Group Accident, or Group Term (Optional)',
                'Annual premium amount per person (Required if new policy)',
                'Unique employee identifier (Optional)',
                'Full name of the member (Required)',
                'Date of birth in YYYY-MM-DD format (Optional)',
                'Age of the member (Optional)',
                'Male, Female, or Other (Optional)',
                'Employee, Spouse, Kids, Mother, or Father (Required)',
                'Addition, Deletion, Correction, or Midterm addition (Required)',
                'Date when employee joined (Optional)',
                'Floater or Non-Floater (Optional)',
                'Sum insured/Coverage amount (Optional)',
                'Date when endorsement was received (Required)',
                'Date from which endorsement is effective (Optional)',
                'Additional notes or comments (Optional)'
            ],
            'Example': [
                'POL001',
                'ABC Corporation',
                '2025-01-01',
                '2025-12-31',
                'Group Health',
                '5000',
                'EMP001',
                'John Doe',
                '1990-05-15',
                '34',
                'Male',
                'Employee',
                'Addition',
                '2025-01-15',
                'Non-Floater',
                '500000',
                '2025-02-01',
                '2025-02-01',
                'New employee addition'
            ]
        })
        instructions.to_excel(writer, index=False, sheet_name='Instructions')
    
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=endorsement_import_template.xlsx"}
    )


@api_router.get("/endorsements/download/approved")
async def download_approved_endorsements(
    policy_number: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Download approved endorsements as Excel file with complete details"""
    query = {"status": EndorsementStatus.APPROVED.value}
    if policy_number:
        query["policy_number"] = policy_number
    
    endorsements = await db.endorsements.find(query, {"_id": 0}).to_list(10000)
    
    if not endorsements:
        raise HTTPException(status_code=404, detail="No approved endorsements found")
    
    # Get all unique policy IDs
    policy_ids = list(set([e['policy_id'] for e in endorsements]))
    
    # Fetch all relevant policies
    policies = await db.policies.find({"id": {"$in": policy_ids}}, {"_id": 0}).to_list(1000)
    policy_map = {p['id']: p for p in policies}
    
    # Get all unique user IDs for approved_by lookup
    user_ids = list(set([e.get('approved_by') for e in endorsements if e.get('approved_by')]))
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(1000)
    user_map = {u['id']: u.get('full_name', u.get('username', '')) for u in users}
    
    # Enrich endorsements with policy data and all new fields
    enriched_data = []
    for e in endorsements:
        policy = policy_map.get(e['policy_id'], {})
        approved_by_name = user_map.get(e.get('approved_by', ''), '')
        premium_type = get_premium_type(e.get('endorsement_type', ''))
        
        enriched_data.append({
            'Policy Number': e.get('policy_number', ''),
            'Policy Holder': policy.get('policy_holder_name', ''),
            'Policy Inception Date': policy.get('inception_date', ''),
            'Policy Expiry Date': policy.get('expiry_date', ''),
            'Type of Policy': policy.get('policy_type', 'Group Health'),
            'Annual Premium Per Life': policy.get('annual_premium_per_life', 0),
            'Employee ID': e.get('employee_id', ''),
            'Member Name': e.get('member_name', ''),
            'DOB': e.get('dob', ''),
            'Age': e.get('age', ''),
            'Gender': e.get('gender', ''),
            'Relationship Type': e.get('relationship_type', ''),
            'Endorsement Type': e.get('endorsement_type', ''),
            'Date of Joining': e.get('date_of_joining', ''),
            'Coverage Type': e.get('coverage_type', ''),
            'Suminsured': e.get('sum_insured', ''),
            'Endorsement Date': e.get('endorsement_date', ''),
            'Effective Date': e.get('effective_date', ''),
            'Remarks': e.get('remarks', ''),
            'Days from Inception': e.get('days_from_inception', 0),
            'Days in Policy Year': e.get('days_in_policy_year', 0),
            'Remaining Days': e.get('remaining_days', 0),
            'Premium Type': premium_type,
            'Pro-rata Premium': e.get('prorata_premium', 0),
            'Status': e.get('status', ''),
            'Approval Date': e.get('approval_date', ''),
            'Approved By': approved_by_name
        })
    
    df = pd.DataFrame(enriched_data)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Approved Endorsements')
    output.seek(0)
    
    filename = f"approved_endorsements_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@api_router.get("/endorsements/stats/summary")
async def get_endorsements_summary(current_user: User = Depends(get_current_user)):
    """Get summary statistics for endorsements"""
    query = {}
    if current_user.role == UserRole.HR:
        query["submitted_by"] = current_user.id
    
    total_endorsements = await db.endorsements.count_documents(query)
    pending = await db.endorsements.count_documents({**query, "status": EndorsementStatus.PENDING.value})
    approved = await db.endorsements.count_documents({**query, "status": EndorsementStatus.APPROVED.value})
    rejected = await db.endorsements.count_documents({**query, "status": EndorsementStatus.REJECTED.value})
    
    total_policies = await db.policies.count_documents({})
    
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$relationship_type",
            "count": {"$sum": 1},
            "total_premium": {"$sum": "$prorata_premium"}
        }}
    ]
    by_relationship = await db.endorsements.aggregate(pipeline).to_list(100)
    
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$endorsement_type",
            "count": {"$sum": 1}
        }}
    ]
    by_type = await db.endorsements.aggregate(pipeline).to_list(100)
    
    return {
        "total_endorsements": total_endorsements,
        "pending": pending,
        "approved": approved,
        "rejected": rejected,
        "total_policies": total_policies,
        "by_relationship_type": by_relationship,
        "by_endorsement_type": by_type
    }


# ==================== BULK APPROVAL ENDPOINTS ====================

@api_router.post("/endorsements/bulk-approve")
async def bulk_approve_endorsements(
    request: BulkApprovalRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Bulk approve or reject multiple endorsements (Admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can approve/reject endorsements")
    
    success_count = 0
    failed_ids = []
    processed_endorsements = []
    
    for endorsement_id in request.endorsement_ids:
        endorsement = await db.endorsements.find_one({"id": endorsement_id}, {"_id": 0})
        if not endorsement:
            failed_ids.append({"id": endorsement_id, "error": "Not found"})
            continue
        
        if endorsement.get('status') != EndorsementStatus.PENDING.value:
            failed_ids.append({"id": endorsement_id, "error": "Already processed"})
            continue
        
        update_data = {
            "status": request.status.value,
            "approved_by": current_user.id,
            "approval_date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
        }
        
        if request.remarks:
            update_data["remarks"] = request.remarks
        
        await db.endorsements.update_one({"id": endorsement_id}, {"$set": update_data})
        
        # Update policy lives covered if approved
        if request.status == EndorsementStatus.APPROVED:
            if endorsement.get('endorsement_type') == EndorsementType.ADDITION.value:
                await db.policies.update_one(
                    {"id": endorsement['policy_id']},
                    {"$inc": {"total_lives_covered": 1}}
                )
            elif endorsement.get('endorsement_type') == EndorsementType.DELETION.value:
                await db.policies.update_one(
                    {"id": endorsement['policy_id']},
                    {"$inc": {"total_lives_covered": -1}}
                )
        
        processed_endorsements.append(endorsement)
        success_count += 1
    
    # Send email notification for bulk approval (in background)
    if processed_endorsements and SMTP_USERNAME:
        # Get submitter emails
        submitter_ids = list(set([e.get('submitted_by') for e in processed_endorsements if e.get('submitted_by')]))
        submitters = await db.users.find({"id": {"$in": submitter_ids}}, {"_id": 0}).to_list(100)
        submitter_emails = [u.get('email') for u in submitters if u.get('email')]
        
        if submitter_emails:
            subject = f"Endorsements {request.status.value} - {success_count} endorsements processed"
            body = f"""
            <h2>Endorsement Status Update</h2>
            <p>Dear User,</p>
            <p>{success_count} endorsement(s) have been <strong>{request.status.value}</strong> by {current_user.full_name}.</p>
            <p>Remarks: {request.remarks or 'No remarks'}</p>
            <p>Please log in to the portal to view details.</p>
            <br>
            <p>Best regards,<br>InsureHub Team</p>
            """
            background_tasks.add_task(send_email_notification, submitter_emails, subject, body)
    
    return {
        "success_count": success_count,
        "failed_count": len(failed_ids),
        "failed_ids": failed_ids,
        "status": request.status.value
    }


# ==================== EMAIL ENDPOINTS ====================

@api_router.post("/email/send")
async def send_custom_email(
    email_request: EmailRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Send custom email with optional attachments"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can send emails")
    
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        raise HTTPException(status_code=400, detail="Email not configured. Please set SMTP credentials.")
    
    attachments = []
    
    # Generate attachments if requested
    if email_request.attach_excel or email_request.attach_pdf:
        query = {"status": EndorsementStatus.APPROVED.value}
        if email_request.policy_number:
            query["policy_number"] = email_request.policy_number
        
        endorsements = await db.endorsements.find(query, {"_id": 0}).to_list(10000)
        
        if endorsements:
            policy_ids = list(set([e['policy_id'] for e in endorsements]))
            policies = await db.policies.find({"id": {"$in": policy_ids}}, {"_id": 0}).to_list(1000)
            policy_map = {p['id']: p for p in policies}
            
            if email_request.attach_excel:
                # Generate Excel
                excel_buffer = await generate_excel_for_email(endorsements, policy_map)
                attachments.append((f"approved_endorsements_{datetime.now().strftime('%Y%m%d')}.xlsx", excel_buffer))
            
            if email_request.attach_pdf:
                # Generate PDF
                pdf_buffer = generate_pdf_report(endorsements, policy_map, "summary")
                attachments.append((f"endorsements_report_{datetime.now().strftime('%Y%m%d')}.pdf", pdf_buffer))
    
    # Send email in background
    background_tasks.add_task(
        send_email_notification,
        email_request.to_emails,
        email_request.subject,
        email_request.body,
        email_request.cc_emails,
        email_request.bcc_emails,
        email_request.from_email,
        attachments
    )
    
    return {"message": "Email queued for delivery", "recipients": len(email_request.to_emails)}


async def generate_excel_for_email(endorsements: List[dict], policy_map: dict) -> bytes:
    """Generate Excel bytes for email attachment"""
    user_ids = list(set([e.get('approved_by') for e in endorsements if e.get('approved_by')]))
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(1000)
    user_map = {u['id']: u.get('full_name', u.get('username', '')) for u in users}
    
    enriched_data = []
    for e in endorsements:
        policy = policy_map.get(e['policy_id'], {})
        approved_by_name = user_map.get(e.get('approved_by', ''), '')
        premium_type = get_premium_type(e.get('endorsement_type', ''))
        
        enriched_data.append({
            'Policy Number': e.get('policy_number', ''),
            'Policy Holder': policy.get('policy_holder_name', ''),
            'Type of Policy': policy.get('policy_type', 'Group Health'),
            'Employee ID': e.get('employee_id', ''),
            'Member Name': e.get('member_name', ''),
            'DOB': e.get('dob', ''),
            'Age': e.get('age', ''),
            'Gender': e.get('gender', ''),
            'Relationship Type': e.get('relationship_type', ''),
            'Endorsement Type': e.get('endorsement_type', ''),
            'Coverage Type': e.get('coverage_type', ''),
            'Suminsured': e.get('sum_insured', ''),
            'Endorsement Date': e.get('endorsement_date', ''),
            'Effective Date': e.get('effective_date', ''),
            'Remaining Days': e.get('remaining_days', 0),
            'Premium Type': premium_type,
            'Pro-rata Premium': e.get('prorata_premium', 0),
            'Status': e.get('status', ''),
            'Approval Date': e.get('approval_date', ''),
            'Approved By': approved_by_name,
            'Remarks': e.get('remarks', '')
        })
    
    df = pd.DataFrame(enriched_data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Approved Endorsements')
    output.seek(0)
    return output.getvalue()


@api_router.get("/email/config")
async def get_email_config(current_user: User = Depends(get_current_user)):
    """Get email configuration status (Admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can view email config")
    
    return {
        "configured": bool(SMTP_USERNAME and SMTP_PASSWORD),
        "smtp_server": SMTP_SERVER,
        "smtp_port": SMTP_PORT,
        "default_from_email": DEFAULT_FROM_EMAIL or SMTP_USERNAME or "Not configured"
    }


@api_router.post("/email/config")
async def update_email_config(config: EmailConfig, current_user: User = Depends(get_current_user)):
    """Update email configuration (stores in database)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can update email config")
    
    # Store in database for persistence
    await db.settings.update_one(
        {"key": "email_config"},
        {"$set": {
            "key": "email_config",
            "smtp_server": config.smtp_server,
            "smtp_port": config.smtp_port,
            "smtp_username": config.smtp_username,
            "smtp_password": config.smtp_password,
            "default_from_email": config.default_from_email,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": current_user.id
        }},
        upsert=True
    )
    
    return {"message": "Email configuration updated successfully"}


# ==================== PDF EXPORT ENDPOINTS ====================

@api_router.get("/endorsements/download/pdf")
async def download_endorsements_pdf(
    report_type: str = "detailed",  # "detailed" or "summary"
    policy_number: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Download approved endorsements as PDF report"""
    query = {"status": EndorsementStatus.APPROVED.value}
    if policy_number:
        query["policy_number"] = policy_number
    
    endorsements = await db.endorsements.find(query, {"_id": 0}).to_list(10000)
    
    if not endorsements:
        raise HTTPException(status_code=404, detail="No approved endorsements found")
    
    policy_ids = list(set([e['policy_id'] for e in endorsements]))
    policies = await db.policies.find({"id": {"$in": policy_ids}}, {"_id": 0}).to_list(1000)
    policy_map = {p['id']: p for p in policies}
    
    pdf_content = generate_pdf_report(endorsements, policy_map, report_type)
    
    filename = f"endorsements_{report_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    
    return StreamingResponse(
        io.BytesIO(pdf_content),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ==================== ENHANCED DASHBOARD STATS ====================

@api_router.get("/dashboard/analytics")
async def get_dashboard_analytics(current_user: User = Depends(get_current_user)):
    """Get comprehensive dashboard analytics for charts"""
    query = {}
    if current_user.role == UserRole.HR:
        query["submitted_by"] = current_user.id
    
    # Basic stats
    total = await db.endorsements.count_documents(query)
    pending = await db.endorsements.count_documents({**query, "status": EndorsementStatus.PENDING.value})
    approved = await db.endorsements.count_documents({**query, "status": EndorsementStatus.APPROVED.value})
    rejected = await db.endorsements.count_documents({**query, "status": EndorsementStatus.REJECTED.value})
    
    # By endorsement type with premium
    by_type_pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$endorsement_type",
            "count": {"$sum": 1},
            "total_premium": {"$sum": "$prorata_premium"}
        }}
    ]
    by_type = await db.endorsements.aggregate(by_type_pipeline).to_list(100)
    
    # By relationship type
    by_relationship_pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$relationship_type",
            "count": {"$sum": 1}
        }}
    ]
    by_relationship = await db.endorsements.aggregate(by_relationship_pipeline).to_list(100)
    
    # By policy
    by_policy_pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$policy_number",
            "count": {"$sum": 1},
            "total_premium": {"$sum": "$prorata_premium"}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    by_policy = await db.endorsements.aggregate(by_policy_pipeline).to_list(10)
    
    # Monthly trend (last 12 months)
    twelve_months_ago = datetime.now(timezone.utc).replace(day=1) - pd.DateOffset(months=11)
    monthly_pipeline = [
        {"$match": {
            **query,
            "created_at": {"$gte": twelve_months_ago.isoformat()}
        }},
        {"$addFields": {
            "month": {"$substr": ["$created_at", 0, 7]}
        }},
        {"$group": {
            "_id": "$month",
            "count": {"$sum": 1},
            "total_premium": {"$sum": "$prorata_premium"}
        }},
        {"$sort": {"_id": 1}}
    ]
    monthly_trend = await db.endorsements.aggregate(monthly_pipeline).to_list(12)
    
    # Premium summary
    premium_pipeline = [
        {"$match": {**query, "status": EndorsementStatus.APPROVED.value}},
        {"$group": {
            "_id": None,
            "total_charge": {
                "$sum": {"$cond": [{"$gt": ["$prorata_premium", 0]}, "$prorata_premium", 0]}
            },
            "total_refund": {
                "$sum": {"$cond": [{"$lt": ["$prorata_premium", 0]}, {"$abs": "$prorata_premium"}, 0]}
            },
            "net_premium": {"$sum": "$prorata_premium"}
        }}
    ]
    premium_summary = await db.endorsements.aggregate(premium_pipeline).to_list(1)
    premium_data = premium_summary[0] if premium_summary else {"total_charge": 0, "total_refund": 0, "net_premium": 0}
    
    return {
        "status_distribution": {
            "total": total,
            "pending": pending,
            "approved": approved,
            "rejected": rejected
        },
        "by_endorsement_type": by_type,
        "by_relationship_type": by_relationship,
        "by_policy": by_policy,
        "monthly_trend": monthly_trend,
        "premium_summary": {
            "total_charge": premium_data.get("total_charge", 0),
            "total_refund": premium_data.get("total_refund", 0),
            "net_premium": premium_data.get("net_premium", 0)
        }
    }



# ==================== CD LEDGER ENDPOINTS ====================
@api_router.get("/cd-ledger")
async def get_cd_ledger(
    policy_number: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get CD Ledger entries and running balance"""
    query = {}
    if policy_number:
        query["policy_number"] = policy_number
    
    entries = await db.cd_ledger.find(query, {"_id": 0}).sort("date", 1).to_list(10000)
    
    # Calculate running balance
    running_balance = 0
    for entry in entries:
        running_balance += entry.get("amount", 0)
        entry["running_balance"] = round(running_balance, 2)
    
    return {
        "entries": entries,
        "total_balance": round(running_balance, 2)
    }


@api_router.post("/cd-ledger")
async def create_cd_ledger_entry(
    entry: CDLedgerEntryCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new CD Ledger entry (Admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can manage CD Ledger")
    
    new_entry = {
        "id": str(uuid.uuid4()),
        "date": entry.date,
        "reference": entry.reference,
        "description": entry.description or "",
        "amount": entry.amount,
        "policy_number": entry.policy_number,
        "entry_type": "Manual",
        "endorsement_id": None,
        "created_by": current_user.id,
        "created_by_name": current_user.full_name,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.cd_ledger.insert_one(new_entry)
    
    return {
        "id": new_entry["id"],
        "message": "CD Ledger entry created",
        "amount": entry.amount,
        "policy_number": entry.policy_number,
        "date": entry.date,
        "reference": entry.reference
    }


@api_router.delete("/cd-ledger/{entry_id}")
async def delete_cd_ledger_entry(entry_id: str, current_user: User = Depends(get_current_user)):
    """Delete a manual CD Ledger entry (Admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can manage CD Ledger")
    
    entry = await db.cd_ledger.find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    if entry.get("entry_type") != "Manual":
        raise HTTPException(status_code=400, detail="Only manual entries can be deleted")
    
    await db.cd_ledger.delete_one({"id": entry_id})
    await log_audit(current_user.id, current_user.username, current_user.role.value, "DELETE", "cd_ledger", entry_id, "Deleted CD ledger entry")
    return {"message": "Entry deleted"}


# ==================== Claims Management Endpoints ====================

class ClaimStatus(str, Enum):
    SUBMITTED = "Submitted"
    IN_PROCESS = "In Process"
    SETTLED = "Settled"
    REJECTED = "Rejected"
    CLOSED = "Closed"


class ClaimType(str, Enum):
    CASHLESS = "Cashless"
    REIMBURSEMENT = "Reimbursement"


class ClaimCreate(BaseModel):
    policy_number: str
    claim_number: Optional[str] = None
    claim_type: ClaimType = ClaimType.CASHLESS
    cashless_claims_count: int = 0
    reimbursement_claims_count: int = 0
    claims_report_date: Optional[str] = None
    claimed_amount: float = 0
    approved_amount: float = 0
    settled_amount: float = 0
    status: ClaimStatus = ClaimStatus.SUBMITTED
    remarks: Optional[str] = None
    policy_type: Optional[str] = None


class Claim(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    policy_number: str
    claim_number: str = Field(default_factory=lambda: f"CLM-{uuid.uuid4().hex[:8].upper()}")
    claim_type: ClaimType = ClaimType.CASHLESS
    cashless_claims_count: int = 0
    reimbursement_claims_count: int = 0
    claims_report_date: Optional[str] = None
    claimed_amount: float = 0
    approved_amount: float = 0
    settled_amount: float = 0
    status: ClaimStatus = ClaimStatus.SUBMITTED
    remarks: Optional[str] = None
    policy_type: Optional[str] = None
    created_by: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@api_router.post("/claims")
async def create_claim(claim_data: ClaimCreate, current_user: User = Depends(get_current_user)):
    """Create a new claim (Admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can manage claims")
    data = claim_data.model_dump()
    if not data.get("claim_number"):
        data.pop("claim_number", None)
    claim = Claim(**data)
    claim.created_by = current_user.id
    doc = claim.model_dump()
    doc['created_at'] = datetime.now(timezone.utc).isoformat()
    await db.claims.insert_one(doc)
    result = await db.claims.find_one({"id": claim.id}, {"_id": 0})
    await log_audit(current_user.id, current_user.username, current_user.role.value, "CREATE", "claim", claim.id, f"Created claim {claim.claim_number}")
    return result


@api_router.get("/claims")
async def get_claims(
    policy_number: Optional[str] = None,
    status: Optional[str] = None,
    policy_type: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all claims (HR users see only claims for assigned policies)"""
    query = {}
    if current_user.role == UserRole.HR:
        assigned = await get_hr_assigned_policy_numbers(current_user.id)
        if not assigned:
            return []
        query["policy_number"] = {"$in": assigned}
    if policy_number:
        query["policy_number"] = policy_number
    if status:
        query["status"] = status
    if policy_type:
        query["policy_type"] = policy_type
    claims = await db.claims.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)
    return claims


@api_router.get("/claims/{claim_id}")
async def get_claim(claim_id: str, current_user: User = Depends(get_current_user)):
    """Get a single claim by ID"""
    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claim


@api_router.put("/claims/{claim_id}")
async def update_claim(claim_id: str, claim_data: ClaimCreate, current_user: User = Depends(get_current_user)):
    """Update a claim (Admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can manage claims")
    existing = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Claim not found")
    update_data = claim_data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.claims.update_one({"id": claim_id}, {"$set": update_data})
    updated = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    await log_audit(current_user.id, current_user.username, current_user.role.value, "UPDATE", "claim", claim_id, f"Updated claim {claim_id}")
    return updated


@api_router.delete("/claims/{claim_id}")
async def delete_claim(claim_id: str, current_user: User = Depends(get_current_user)):
    """Delete a claim (Admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can manage claims")
    result = await db.claims.delete_one({"id": claim_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Claim not found")
    await log_audit(current_user.id, current_user.username, current_user.role.value, "DELETE", "claim", claim_id, "Deleted claim")
    return {"message": "Claim deleted"}


@api_router.get("/claims-analytics")
async def get_claims_analytics(
    policy_type: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get claims analytics (HR sees only assigned policies' claims)"""
    query = {}
    if current_user.role == UserRole.HR:
        assigned = await get_hr_assigned_policy_numbers(current_user.id)
        if not assigned:
            return {
                "total_claims": 0, "total_claimed_amount": 0, "total_approved_amount": 0,
                "total_settled_amount": 0, "reimbursement_claims": 0, "reimbursement_count": 0,
                "cashless_claims": 0, "cashless_count": 0, "rejected_claims": 0,
                "rejected_count": 0, "under_process_claims": 0, "under_process_count": 0,
                "total_premium": 0, "claims_ratio": 0, "annual_claims_trend": 0,
                "settlement_ratio": 0, "status_distribution": [], "type_distribution": [],
                "monthly_trend": []
            }
        query["policy_number"] = {"$in": assigned}
    if policy_type:
        query["policy_type"] = policy_type

    claims = await db.claims.find(query, {"_id": 0}).to_list(10000)

    total_claims_count = len(claims)
    total_claimed = sum(c.get("claimed_amount", 0) for c in claims)
    total_approved = sum(c.get("approved_amount", 0) for c in claims)
    total_settled = sum(c.get("settled_amount", 0) for c in claims)

    reimbursement_amount = sum(c.get("claimed_amount", 0) for c in claims if c.get("claim_type") == "Reimbursement")
    cashless_amount = sum(c.get("claimed_amount", 0) for c in claims if c.get("claim_type") == "Cashless")
    rejected_amount = sum(c.get("claimed_amount", 0) for c in claims if c.get("status") == "Rejected")
    under_process_amount = sum(c.get("claimed_amount", 0) for c in claims if c.get("status") == "In Process")

    reimbursement_count = sum(1 for c in claims if c.get("claim_type") == "Reimbursement")
    cashless_count = sum(1 for c in claims if c.get("claim_type") == "Cashless")
    rejected_count = sum(1 for c in claims if c.get("status") == "Rejected")
    under_process_count = sum(1 for c in claims if c.get("status") == "In Process")

    # Get total premium from policies for claims ratio
    policy_query = {}
    if current_user.role == UserRole.HR:
        assigned_pn = await get_hr_assigned_policy_numbers(current_user.id)
        if assigned_pn:
            policy_query["policy_number"] = {"$in": assigned_pn}
        else:
            policy_query["policy_number"] = {"$in": []}
    policies = await db.policies.find(policy_query, {"_id": 0}).to_list(1000)
    total_premium = sum(p.get("premium", 0) or (p.get("annual_premium_per_life", 0) * p.get("total_lives_covered", 0)) for p in policies)

    claims_ratio = round((total_claimed / total_premium * 100) if total_premium > 0 else 0, 1)

    # Annual Claims Trend = (Claims / (Policy Expiry - Policy Start in days)) * 365
    total_policy_days = 0
    for p in policies:
        start = p.get("policy_date") or p.get("inception_date") or p.get("start_date")
        end = p.get("expiry_date") or p.get("end_date")
        if start and end:
            try:
                from dateutil import parser as date_parser
                start_dt = date_parser.parse(start)
                end_dt = date_parser.parse(end)
                days = (end_dt - start_dt).days
                if days > 0:
                    total_policy_days += days
            except Exception:
                pass
    annual_claims_trend = round((total_claimed / total_policy_days) * 365, 2) if total_policy_days > 0 else 0

    status_counts = {}
    type_counts = {}
    monthly_data = {}

    for c in claims:
        st = c.get("status", "Unknown")
        status_counts[st] = status_counts.get(st, 0) + 1

        ct = c.get("claim_type", "Unknown")
        type_counts[ct] = type_counts.get(ct, 0) + 1

        created = c.get("created_at", "")
        if created and len(created) >= 7:
            month_key = created[:7]
            if month_key not in monthly_data:
                monthly_data[month_key] = {"month": month_key, "count": 0, "amount": 0}
            monthly_data[month_key]["count"] += 1
            monthly_data[month_key]["amount"] += c.get("claimed_amount", 0)

    return {
        "total_claims": total_claims_count,
        "total_claimed_amount": round(total_claimed, 2),
        "total_approved_amount": round(total_approved, 2),
        "total_settled_amount": round(total_settled, 2),
        "reimbursement_claims": round(reimbursement_amount, 2),
        "reimbursement_count": reimbursement_count,
        "cashless_claims": round(cashless_amount, 2),
        "cashless_count": cashless_count,
        "rejected_claims": round(rejected_amount, 2),
        "rejected_count": rejected_count,
        "under_process_claims": round(under_process_amount, 2),
        "under_process_count": under_process_count,
        "total_premium": round(total_premium, 2),
        "claims_ratio": claims_ratio,
        "annual_claims_trend": annual_claims_trend,
        "settlement_ratio": round((total_settled / total_claimed * 100) if total_claimed > 0 else 0, 1),
        "status_distribution": [{"name": k, "value": v} for k, v in status_counts.items()],
        "type_distribution": [{"name": k, "value": v} for k, v in type_counts.items()],
        "monthly_trend": sorted(monthly_data.values(), key=lambda x: x["month"]),
    }


@api_router.get("/policies-analytics")
async def get_policies_analytics(current_user: User = Depends(get_current_user)):
    """Get policy analytics (HR sees only assigned policies)"""
    query = {}
    if current_user.role == UserRole.HR:
        assigned = await get_hr_assigned_policy_numbers(current_user.id)
        if not assigned:
            return {
                "total_policies": 0, "active_policies": 0, "expired_policies": 0,
                "total_employees": 0, "total_spouse": 0, "total_kids": 0, "total_parents": 0,
                "total_lives": 0, "total_premium": 0, "total_addition_lives": 0,
                "total_deletion_lives": 0, "type_breakdown": [], "policies": []
            }
        query["policy_number"] = {"$in": assigned}
    policies = await db.policies.find(query, {"_id": 0}).to_list(1000)

    total_policies = len(policies)
    active_count = sum(1 for p in policies if p.get("status") == "Active")
    expired_count = sum(1 for p in policies if p.get("status") == "Expired")

    total_employees = sum(p.get("employees_count", 0) for p in policies)
    total_spouse = sum(p.get("spouse_count", 0) for p in policies)
    total_kids = sum(p.get("kids_count", 0) for p in policies)
    total_parents = sum(p.get("parents_count", 0) for p in policies)
    total_lives = sum(p.get("total_lives_count", 0) or p.get("total_lives_covered", 0) for p in policies)
    total_premium = sum(p.get("premium", 0) or (p.get("annual_premium_per_life", 0) * p.get("total_lives_covered", 0)) for p in policies)
    total_addition = sum(p.get("addition_lives", 0) for p in policies)
    total_deletion = sum(p.get("deletion_lives", 0) for p in policies)

    by_type = {}
    for p in policies:
        pt = p.get("policy_type", "Unknown")
        if pt not in by_type:
            by_type[pt] = {"count": 0, "lives": 0, "premium": 0}
        by_type[pt]["count"] += 1
        lives = p.get("total_lives_count", 0) or p.get("total_lives_covered", 0)
        prem = p.get("premium", 0) or (p.get("annual_premium_per_life", 0) * p.get("total_lives_covered", 0))
        by_type[pt]["lives"] += lives
        by_type[pt]["premium"] += prem

    type_breakdown = [
        {"name": k, "count": v["count"], "lives": v["lives"], "premium": round(v["premium"], 2)}
        for k, v in by_type.items()
    ]

    return {
        "total_policies": total_policies,
        "active_policies": active_count,
        "expired_policies": expired_count,
        "total_employees": total_employees,
        "total_spouse": total_spouse,
        "total_kids": total_kids,
        "total_parents": total_parents,
        "total_lives": total_lives,
        "total_premium": round(total_premium, 2),
        "total_addition_lives": total_addition,
        "total_deletion_lives": total_deletion,
        "type_breakdown": type_breakdown,
        "policies": [{
            "policy_number": p.get("policy_number"),
            "policy_holder_name": p.get("policy_holder_name"),
            "policy_date": p.get("policy_date") or p.get("inception_date"),
            "policy_type": p.get("policy_type"),
            "family_definition": p.get("family_definition"),
            "status": p.get("status"),
            "premium": p.get("premium", 0) or (p.get("annual_premium_per_life", 0) * p.get("total_lives_covered", 0)),
            "employees_count": p.get("employees_count", 0),
            "spouse_count": p.get("spouse_count", 0),
            "kids_count": p.get("kids_count", 0),
            "parents_count": p.get("parents_count", 0),
            "total_lives_count": p.get("total_lives_count", 0) or p.get("total_lives_covered", 0),
            "addition_lives": p.get("addition_lives", 0),
            "deletion_lives": p.get("deletion_lives", 0),
        } for p in policies],
    }


# ==================== Audit Log Endpoints ====================

@api_router.get("/audit-log")
async def get_audit_log(
    page: int = 1,
    limit: int = 50,
    action: Optional[str] = None,
    resource: Optional[str] = None,
    username: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get audit log entries (Admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can view audit logs")
    
    query = {}
    if action:
        query["action"] = action
    if resource:
        query["resource"] = resource
    if username:
        query["username"] = {"$regex": username, "$options": "i"}
    
    skip = (page - 1) * limit
    total = await db.audit_log.count_documents(query)
    entries = await db.audit_log.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "entries": entries,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


@app.on_event("startup")
async def startup_storage():
    try:
        init_storage()
        logging.getLogger(__name__).info("Object storage initialized successfully")
    except Exception as e:
        logging.getLogger(__name__).error(f"Object storage init failed: {e}")


@app.on_event("startup")
async def seed_master_admin():
    """Seed the Master Admin account on startup (idempotent)"""
    master = await db.users.find_one({"username": "masteradmin"}, {"_id": 0})
    if not master:
        user = User(
            username="masteradmin",
            full_name="Master Admin",
            email="sandeepdby@gmail.com",
            phone="9886260579",
            role=UserRole.ADMIN,
        )
        doc = user.model_dump()
        doc['password_hash'] = get_password_hash("Admin@123")
        doc['is_master_admin'] = True
        doc['created_at'] = datetime.now(timezone.utc).isoformat()
        await db.users.insert_one(doc)
        logging.getLogger(__name__).info("Master Admin seeded: masteradmin / Admin@123")
    else:
        # Ensure flag is set on existing record
        await db.users.update_one({"username": "masteradmin"}, {"$set": {"is_master_admin": True}})


# ==================== Document Storage Endpoints ====================
@api_router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    category: str = Query(...),
    assigned_to_hr: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Upload a document to cloud storage. Admin can assign to HR user."""
    allowed_types = [
        "application/pdf", "image/jpeg", "image/png", "image/webp",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel", "text/csv", "text/plain",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/octet-stream"
    ]
    
    max_size = 25 * 1024 * 1024  # 25MB
    data = await file.read()
    if len(data) > max_size:
        raise HTTPException(status_code=400, detail="File size exceeds 25MB limit")

    ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
    storage_path = f"{APP_NAME}/documents/{current_user.id}/{uuid.uuid4()}.{ext}"
    
    content_type = file.content_type or "application/octet-stream"
    
    try:
        result = put_object(storage_path, data, content_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {str(e)}")
    
    doc_id = str(uuid.uuid4())
    doc_record = {
        "id": doc_id,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "category": category,
        "uploaded_by": current_user.id,
        "uploaded_by_name": current_user.full_name,
        "uploaded_by_role": current_user.role,
        "assigned_to_hr": assigned_to_hr if assigned_to_hr and current_user.role == UserRole.ADMIN else None,
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    # If Admin assigned to HR, look up HR details
    if assigned_to_hr and current_user.role == UserRole.ADMIN:
        hr_user = await db.users.find_one({"id": assigned_to_hr, "role": "HR"}, {"_id": 0})
        if hr_user:
            doc_record["assigned_to_hr_name"] = hr_user.get("full_name", "")
            doc_record["assigned_to_hr_email"] = hr_user.get("email", "")
            doc_record["assigned_to_hr_phone"] = hr_user.get("phone", "")

    await db.documents.insert_one(doc_record)
    
    return {
        "id": doc_id,
        "filename": file.filename,
        "category": category,
        "size": result.get("size", len(data)),
        "assigned_to_hr": assigned_to_hr,
        "created_at": doc_record["created_at"]
    }


@api_router.get("/documents")
async def list_documents(
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """List documents. HR users see only documents assigned to them or uploaded by them."""
    query = {"is_deleted": False}
    if category:
        query["category"] = category
    if current_user.role == UserRole.HR:
        query["$or"] = [
            {"assigned_to_hr": current_user.id},
            {"uploaded_by": current_user.id}
        ]
    
    docs = await db.documents.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api_router.get("/documents/{doc_id}/download")
async def download_document(
    doc_id: str,
    current_user: User = Depends(get_current_user)
):
    """Download a document by its ID."""
    record = await db.documents.find_one({"id": doc_id, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        data, ct = get_object(record["storage_path"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve file: {str(e)}")
    
    return Response(
        content=data,
        media_type=record.get("content_type", ct),
        headers={
            "Content-Disposition": f'attachment; filename="{record["original_filename"]}"'
        }
    )


@api_router.delete("/documents/{doc_id}")
async def delete_document(
    doc_id: str,
    current_user: User = Depends(get_current_user)
):
    """Soft-delete a document."""
    record = await db.documents.find_one({"id": doc_id, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Only allow delete by uploader or Admin
    if record["uploaded_by"] != current_user.id and current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this document")
    
    await db.documents.update_one({"id": doc_id}, {"$set": {"is_deleted": True}})
    await log_audit(current_user.id, current_user.username, current_user.role.value, "DELETE", "document", doc_id, "Deleted document")
    return {"message": "Document deleted successfully"}


@api_router.post("/documents/{doc_id}/send-ecard")
async def send_ecard(
    doc_id: str,
    background_tasks: BackgroundTasks,
    email: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Send an E-Card document via email to the assigned HR user."""
    record = await db.documents.find_one({"id": doc_id, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Document not found")

    target_email = email or record.get("assigned_to_hr_email")
    if not target_email:
        raise HTTPException(status_code=400, detail="No email address found for this document's HR user")

    # Download file from storage
    try:
        file_data, ct = get_object(record["storage_path"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve file: {str(e)}")

    hr_name = record.get("assigned_to_hr_name", "HR User")
    filename = record.get("original_filename", "e-card")

    subject = f"Your E-Card: {filename} | InsureHub"
    body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #ec4899, #f43f5e); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h2 style="color: white; margin: 0;">E-Card Shared With You</h2>
        </div>
        <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
            <p style="color: #334155;">Hi <strong>{hr_name}</strong>,</p>
            <p style="color: #475569;">An E-Card has been shared with you from InsureHub.</p>
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 16px 0;">
                <p style="margin: 5px 0;"><strong>File:</strong> {filename}</p>
                <p style="margin: 5px 0;"><strong>Sent by:</strong> {current_user.full_name}</p>
            </div>
            <p style="color: #64748b; font-size: 13px;">The E-Card is attached to this email. You can also log in to InsureHub to view and download it.</p>
        </div>
    </div>"""

    # Send email with attachment
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.base import MIMEBase
    from email import encoders

    def send_ecard_email():
        try:
            smtp_email = os.environ.get("SMTP_EMAIL")
            smtp_password = os.environ.get("SMTP_PASSWORD")
            smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
            smtp_port = int(os.environ.get("SMTP_PORT", "587"))

            msg = MIMEMultipart()
            msg["From"] = smtp_email
            msg["To"] = target_email
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "html"))

            attachment = MIMEBase("application", "octet-stream")
            attachment.set_payload(file_data)
            encoders.encode_base64(attachment)
            attachment.add_header("Content-Disposition", f'attachment; filename="{filename}"')
            msg.attach(attachment)

            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_email, smtp_password)
                server.sendmail(smtp_email, [target_email], msg.as_string())
            logging.getLogger().info(f"E-Card email sent to {target_email}")
        except Exception as e:
            logging.getLogger().error(f"Failed to send E-Card email: {e}")

    background_tasks.add_task(send_ecard_email)
    await log_audit(current_user.id, current_user.username, current_user.role.value, "SEND_ECARD", "document", doc_id, f"Sent E-Card {filename} to {target_email}")
    return {"message": f"E-Card sent to {target_email}"}


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
