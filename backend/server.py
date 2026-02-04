from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
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


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

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


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    full_name: str
    email: str
    role: UserRole
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Policy Models
class PolicyCreate(BaseModel):
    policy_number: str
    policy_holder_name: str
    inception_date: str
    expiry_date: str
    policy_type: PolicyType = PolicyType.GROUP_HEALTH
    annual_premium_per_life: float
    total_lives_covered: int = 0
    status: PolicyStatus = PolicyStatus.ACTIVE


class Policy(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    policy_number: str
    policy_holder_name: str
    inception_date: str
    expiry_date: str
    policy_type: PolicyType = PolicyType.GROUP_HEALTH
    annual_premium_per_life: float
    total_lives_covered: int
    status: PolicyStatus
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
    endorsement_date: str
    effective_date: str
    days_from_inception: int
    days_in_policy_year: int
    remaining_days: int
    prorata_premium: float
    status: EndorsementStatus = EndorsementStatus.PENDING
    submitted_by: Optional[str] = None  # user_id - optional for legacy data
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


def calculate_prorata_premium(
    inception_date_str: str,
    expiry_date_str: str,
    effective_date_str: str,
    annual_premium: float,
    endorsement_type: str = "Addition"
) -> tuple:
    """
    Calculate pro-rata premium based on endorsement type.
    - Addition/Midterm addition: Charge for (Policy Expiry - Date of Joining)
    - Deletion: Refund for (Policy Expiry - Date of Leaving)
    - Correction: No premium change (zero)
    
    Args:
        effective_date_str: For Addition = Date of Joining (DOJ), For Deletion = Date of Leaving (DOL)
    """
    try:
        inception_date = datetime.strptime(inception_date_str, "%Y-%m-%d").date()
        expiry_date = datetime.strptime(expiry_date_str, "%Y-%m-%d").date()
        effective_date = datetime.strptime(effective_date_str, "%Y-%m-%d").date()
        
        days_in_policy_year = (expiry_date - inception_date).days
        days_from_inception = (effective_date - inception_date).days
        remaining_days = (expiry_date - effective_date).days
        
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


# API Endpoints

@api_router.get("/")
async def root():
    return {"message": "InsureHub - Endorsement Portal with Approval Workflow"}


# ==================== AUTHENTICATION ENDPOINTS ====================

@api_router.post("/auth/register")
async def register_user(user_data: UserCreate):
    """Register a new user (HR or Admin)"""
    existing = await db.users.find_one({"username": user_data.username}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user = User(
        username=user_data.username,
        full_name=user_data.full_name,
        email=user_data.email,
        role=user_data.role
    )
    
    doc = user.model_dump()
    doc['password_hash'] = get_password_hash(user_data.password)
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.users.insert_one(doc)
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
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user['id'],
            "username": user['username'],
            "full_name": user['full_name'],
            "email": user['email'],
            "role": user['role']
        }
    }


@api_router.get("/auth/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current logged-in user info"""
    return current_user


# ==================== POLICY ENDPOINTS ====================

@api_router.post("/policies", response_model=Policy)
async def create_policy(policy_data: PolicyCreate, current_user: User = Depends(get_current_user)):
    """Create a new insurance policy (Admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can create policies")
    
    existing = await db.policies.find_one({"policy_number": policy_data.policy_number}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Policy number already exists")
    
    policy = Policy(**policy_data.model_dump())
    doc = policy.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.policies.insert_one(doc)
    return policy


@api_router.get("/policies", response_model=List[Policy])
async def get_policies(current_user: User = Depends(get_current_user)):
    """Get all policies"""
    policies = await db.policies.find({}, {"_id": 0}).to_list(1000)
    
    for policy in policies:
        if isinstance(policy['created_at'], str):
            policy['created_at'] = datetime.fromisoformat(policy['created_at'])
    
    return policies


@api_router.get("/policies/{policy_id}", response_model=Policy)
async def get_policy(policy_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific policy by ID"""
    policy = await db.policies.find_one({"id": policy_id}, {"_id": 0})
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    if isinstance(policy['created_at'], str):
        policy['created_at'] = datetime.fromisoformat(policy['created_at'])
    
    return policy


@api_router.put("/policies/{policy_id}", response_model=Policy)
async def update_policy(policy_id: str, policy_data: PolicyCreate, current_user: User = Depends(get_current_user)):
    """Update a policy (Admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can update policies")
    
    existing = await db.policies.find_one({"id": policy_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    update_data = policy_data.model_dump()
    await db.policies.update_one({"id": policy_id}, {"$set": update_data})
    
    updated_policy = await db.policies.find_one({"id": policy_id}, {"_id": 0})
    if isinstance(updated_policy['created_at'], str):
        updated_policy['created_at'] = datetime.fromisoformat(updated_policy['created_at'])
    
    return updated_policy


@api_router.delete("/policies/{policy_id}")
async def delete_policy(policy_id: str, current_user: User = Depends(get_current_user)):
    """Delete a policy (Admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can delete policies")
    
    result = await db.policies.delete_one({"id": policy_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    return {"message": "Policy deleted successfully"}


# ==================== ENDORSEMENT ENDPOINTS ====================

@api_router.post("/endorsements", response_model=Endorsement)
async def create_endorsement(endorsement_data: EndorsementCreate, current_user: User = Depends(get_current_user)):
    """Create a new endorsement (HR can submit, goes to Pending status)"""
    policy = await db.policies.find_one({"policy_number": endorsement_data.policy_number}, {"_id": 0})
    if not policy:
        raise HTTPException(status_code=404, detail=f"Policy {endorsement_data.policy_number} not found")
    
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
    
    return endorsement


@api_router.get("/endorsements", response_model=List[Endorsement])
async def get_endorsements(
    policy_number: Optional[str] = None,
    relationship_type: Optional[RelationshipType] = None,
    status: Optional[EndorsementStatus] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all endorsements with optional filters, sorted by latest first"""
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
    
    # Sort by created_at descending (latest first)
    endorsements = await db.endorsements.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
    
    for endorsement in endorsements:
        if isinstance(endorsement['created_at'], str):
            endorsement['created_at'] = datetime.fromisoformat(endorsement['created_at'])
    
    return endorsements


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
    
    return {"message": "Endorsement deleted successfully"}


@api_router.post("/endorsements/{endorsement_id}/approve", response_model=Endorsement)
async def approve_reject_endorsement(
    endorsement_id: str, 
    approval: EndorsementApproval, 
    current_user: User = Depends(get_current_user)
):
    """Approve or reject an endorsement (Admin only)"""
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
    
    updated_endorsement = await db.endorsements.find_one({"id": endorsement_id}, {"_id": 0})
    if isinstance(updated_endorsement['created_at'], str):
        updated_endorsement['created_at'] = datetime.fromisoformat(updated_endorsement['created_at'])
    
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
                
                # Parse date of leaving (optional)
                date_of_leaving = None
                if 'date_of_leaving' in df.columns and pd.notna(row.get('date_of_leaving')):
                    date_of_leaving = parse_date(row['date_of_leaving'])
                elif 'dol' in df.columns and pd.notna(row.get('dol')):
                    date_of_leaving = parse_date(row['dol'])
                
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
                    date_of_leaving=date_of_leaving,
                    coverage_type=coverage_type,
                    sum_insured=sum_insured,
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
            'Date of Leaving': '',
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
            'Date of Leaving': '',
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
            'Endorsement Type': 'Deletion',
            'Date of Joining': '2020-06-01',
            'Date of Leaving': '2025-06-30',
            'Coverage Type': 'Non-Floater',
            'Suminsured': 300000,
            'Endorsement Date': '2025-06-05',
            'Effective Date': '2025-06-30',
            'Remarks': 'Employee resigned - replace with actual data'
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
                'Date of Leaving',
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
                'Date when employee left - for Deletion (Optional)',
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
                '',
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
            'Date of Leaving': e.get('date_of_leaving', ''),
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


# ==================== PREMIUM CALCULATION ENDPOINT ====================

class PremiumCalculationRequest(BaseModel):
    policy_number: str
    endorsement_date: str
    endorsement_type: EndorsementType


class PremiumCalculationResponse(BaseModel):
    days_from_inception: int
    days_in_policy_year: int
    remaining_days: int
    prorata_premium: float
    premium_type: str  # "Charge", "Refund", or "No Change"
    annual_premium_per_life: float
    policy_inception_date: str
    policy_expiry_date: str


@api_router.post("/endorsements/calculate-premium", response_model=PremiumCalculationResponse)
async def calculate_premium_preview(
    request: PremiumCalculationRequest,
    current_user: User = Depends(get_current_user)
):
    """Calculate pro-rata premium preview without creating an endorsement"""
    policy = await db.policies.find_one({"policy_number": request.policy_number}, {"_id": 0})
    if not policy:
        raise HTTPException(status_code=404, detail=f"Policy {request.policy_number} not found")
    
    days_from_inception, days_in_policy_year, remaining_days, prorata_premium = calculate_prorata_premium(
        policy['inception_date'],
        policy['expiry_date'],
        request.endorsement_date,
        policy['annual_premium_per_life'],
        request.endorsement_type.value
    )
    
    premium_type = get_premium_type(request.endorsement_type.value)
    
    return PremiumCalculationResponse(
        days_from_inception=days_from_inception,
        days_in_policy_year=days_in_policy_year,
        remaining_days=remaining_days,
        prorata_premium=prorata_premium,
        premium_type=premium_type,
        annual_premium_per_life=policy['annual_premium_per_life'],
        policy_inception_date=policy['inception_date'],
        policy_expiry_date=policy['expiry_date']
    )


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
