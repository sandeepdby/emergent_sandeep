from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, date
import pandas as pd
import io
from enum import Enum
import jwt
from passlib.context import CryptContext


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
    annual_premium_per_life: float
    total_lives_covered: int
    status: PolicyStatus
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Endorsement Models
class EndorsementCreate(BaseModel):
    policy_number: str
    member_name: str
    relationship_type: RelationshipType
    endorsement_type: EndorsementType
    endorsement_date: str
    effective_date: Optional[str] = None
    remarks: Optional[str] = None


class Endorsement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    policy_id: str
    policy_number: str
    member_name: str
    relationship_type: RelationshipType
    endorsement_type: EndorsementType
    endorsement_date: str
    effective_date: str
    days_from_inception: int
    days_in_policy_year: int
    remaining_days: int
    prorata_premium: float
    status: EndorsementStatus = EndorsementStatus.PENDING
    submitted_by: str  # user_id
    approved_by: Optional[str] = None
    approval_date: Optional[str] = None
    remarks: Optional[str] = None
    import_batch_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EndorsementUpdate(BaseModel):
    member_name: Optional[str] = None
    relationship_type: Optional[RelationshipType] = None
    endorsement_type: Optional[EndorsementType] = None
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
    endorsement_date_str: str,
    annual_premium: float
) -> tuple:
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
        policy['annual_premium_per_life']
    )
    
    endorsement = Endorsement(
        policy_id=policy['id'],
        policy_number=endorsement_data.policy_number,
        member_name=endorsement_data.member_name,
        relationship_type=endorsement_data.relationship_type,
        endorsement_type=endorsement_data.endorsement_type,
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
    
    if 'endorsement_date' in update_dict:
        days_from_inception, days_in_policy_year, remaining_days, prorata_premium = calculate_prorata_premium(
            policy['inception_date'],
            policy['expiry_date'],
            endorsement_date,
            policy['annual_premium_per_life']
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
                        
                        new_policy = Policy(
                            policy_number=policy_number,
                            policy_holder_name=str(row['policy_holder']).strip(),
                            inception_date=inception_date,
                            expiry_date=expiry_date,
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
                
                # Parse member name
                member_name = str(row['member_name']).strip()
                
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
                        "error": f"Invalid endorsement type: {endorsement_type_str}. Must be one of: Addition, Deletion, Correction"
                    })
                    error_count += 1
                    continue
                
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
                if 'effective_date' in df.columns and pd.notna(row['effective_date']):
                    parsed_effective = parse_date(row['effective_date'])
                    if parsed_effective:
                        effective_date = parsed_effective
                
                # Get remarks if provided
                remarks = str(row['remarks']).strip() if 'remarks' in df.columns and pd.notna(row['remarks']) else None
                
                # Calculate pro-rata premium
                days_from_inception, days_in_policy_year, remaining_days, prorata_premium = calculate_prorata_premium(
                    policy['inception_date'],
                    policy['expiry_date'],
                    endorsement_date,
                    policy['annual_premium_per_life']
                )
                
                # Create endorsement
                endorsement = Endorsement(
                    policy_id=policy['id'],
                    policy_number=policy_number,
                    member_name=member_name,
                    relationship_type=relationship_type,
                    endorsement_type=endorsement_type,
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
    
    # Create sample data for template
    template_data = [
        {
            'Policy Number': 'POL001',
            'Policy Holder': 'Test Company Ltd',
            'Policy Inception Date': '2025-01-01',
            'Policy Expiry Date': '2025-12-31',
            'Annual Premium Per Life': 5000,
            'Member Name': 'John Doe',
            'Relationship Type': 'Employee',
            'Endorsement Type': 'Addition',
            'Endorsement Date': '2025-02-01',
            'Effective Date': '2025-02-01',
            'Remarks': 'Sample endorsement - replace with actual data'
        },
        {
            'Policy Number': 'POL001',
            'Policy Holder': 'Test Company Ltd',
            'Policy Inception Date': '2025-01-01',
            'Policy Expiry Date': '2025-12-31',
            'Annual Premium Per Life': 5000,
            'Member Name': 'Jane Doe',
            'Relationship Type': 'Spouse',
            'Endorsement Type': 'Addition',
            'Endorsement Date': '2025-02-01',
            'Effective Date': '2025-02-01',
            'Remarks': 'Spouse coverage - replace with actual data'
        },
        {
            'Policy Number': 'POL001',
            'Policy Holder': 'Test Company Ltd',
            'Policy Inception Date': '2025-01-01',
            'Policy Expiry Date': '2025-12-31',
            'Annual Premium Per Life': 5000,
            'Member Name': 'Jack Doe',
            'Relationship Type': 'Kids',
            'Endorsement Type': 'Addition',
            'Endorsement Date': '2025-02-05',
            'Effective Date': '2025-02-05',
            'Remarks': 'Child coverage - replace with actual data'
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
                'Annual Premium Per Life',
                'Member Name',
                'Relationship Type',
                'Endorsement Type',
                'Endorsement Date',
                'Effective Date',
                'Remarks'
            ],
            'Description': [
                'Unique policy identifier (Required)',
                'Company/Organization name (Required if new policy)',
                'Policy start date in YYYY-MM-DD format (Required if new policy)',
                'Policy end date in YYYY-MM-DD format (Required if new policy)',
                'Annual premium amount per person (Required if new policy)',
                'Full name of the member (Required)',
                'Employee, Spouse, Kids, Mother, or Father (Required)',
                'Addition, Deletion, or Correction (Required)',
                'Date when endorsement was received (Required)',
                'Date from which endorsement is effective (Optional)',
                'Additional notes or comments (Optional)'
            ],
            'Example': [
                'POL001',
                'ABC Corporation',
                '2025-01-01',
                '2025-12-31',
                '5000',
                'John Doe',
                'Employee',
                'Addition',
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
    
    # Enrich endorsements with policy data
    enriched_data = []
    for e in endorsements:
        policy = policy_map.get(e['policy_id'], {})
        enriched_data.append({
            'Policy Number': e.get('policy_number', ''),
            'Policy Holder': policy.get('policy_holder_name', ''),
            'Policy Inception Date': policy.get('inception_date', ''),
            'Policy Expiry Date': policy.get('expiry_date', ''),
            'Annual Premium Per Life': policy.get('annual_premium_per_life', 0),
            'Member Name': e.get('member_name', ''),
            'Relationship Type': e.get('relationship_type', ''),
            'Endorsement Type': e.get('endorsement_type', ''),
            'Endorsement Date': e.get('endorsement_date', ''),
            'Effective Date': e.get('effective_date', ''),
            'Days from Inception': e.get('days_from_inception', 0),
            'Days in Policy Year': e.get('days_in_policy_year', 0),
            'Remaining Days': e.get('remaining_days', 0),
            'Pro-rata Premium': e.get('prorata_premium', 0),
            'Status': e.get('status', ''),
            'Approval Date': e.get('approval_date', ''),
            'Approved By': e.get('approved_by', ''),
            'Remarks': e.get('remarks', '')
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
