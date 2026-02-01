from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
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


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Enums
class RelationshipType(str, Enum):
    EMPLOYEE = "Employee"
    SPOUSE = "Spouse"
    KIDS = "Kids"
    MOTHER = "Mother"
    FATHER = "Father"


class EndorsementType(str, Enum):
    ADDITION = "Addition"
    DELETION = "Deletion"
    MODIFICATION = "Modification"


class PolicyStatus(str, Enum):
    ACTIVE = "Active"
    EXPIRED = "Expired"
    CANCELLED = "Cancelled"


# Policy Models
class PolicyCreate(BaseModel):
    policy_number: str
    policy_holder_name: str
    inception_date: str  # Format: YYYY-MM-DD
    expiry_date: str  # Format: YYYY-MM-DD
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
    endorsement_date: str  # Format: YYYY-MM-DD
    effective_date: Optional[str] = None  # Format: YYYY-MM-DD, defaults to endorsement_date


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
    import_batch_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EndorsementUpdate(BaseModel):
    member_name: Optional[str] = None
    relationship_type: Optional[RelationshipType] = None
    endorsement_type: Optional[EndorsementType] = None
    endorsement_date: Optional[str] = None
    effective_date: Optional[str] = None


class ImportResult(BaseModel):
    success_count: int
    error_count: int
    total_rows: int
    errors: List[dict]
    import_batch_id: str


# Helper Functions
def calculate_prorata_premium(
    inception_date_str: str,
    expiry_date_str: str,
    endorsement_date_str: str,
    annual_premium: float
) -> tuple:
    """
    Calculate pro-rata premium based on policy dates and endorsement date
    Returns: (days_from_inception, days_in_policy_year, remaining_days, prorata_premium)
    """
    try:
        inception_date = datetime.strptime(inception_date_str, "%Y-%m-%d").date()
        expiry_date = datetime.strptime(expiry_date_str, "%Y-%m-%d").date()
        endorsement_date = datetime.strptime(endorsement_date_str, "%Y-%m-%d").date()
        
        # Calculate days
        days_in_policy_year = (expiry_date - inception_date).days
        days_from_inception = (endorsement_date - inception_date).days
        remaining_days = (expiry_date - endorsement_date).days
        
        # Pro-rata calculation
        if days_in_policy_year > 0 and remaining_days >= 0:
            prorata_premium = (annual_premium * remaining_days) / days_in_policy_year
        else:
            prorata_premium = 0.0
        
        return days_from_inception, days_in_policy_year, remaining_days, round(prorata_premium, 2)
    except Exception as e:
        logging.error(f"Error calculating pro-rata premium: {e}")
        return 0, 0, 0, 0.0


def parse_date(date_str: str) -> str:
    """
    Parse date from various formats and return YYYY-MM-DD
    Supports: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
    """
    if pd.isna(date_str):
        return None
    
    date_str = str(date_str).strip()
    
    # Try different formats
    formats = ["%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%Y/%m/%d", "%d.%m.%Y"]
    
    for fmt in formats:
        try:
            parsed_date = datetime.strptime(date_str, fmt)
            return parsed_date.strftime("%Y-%m-%d")
        except ValueError:
            continue
    
    # Try pandas to_datetime as fallback
    try:
        parsed_date = pd.to_datetime(date_str)
        return parsed_date.strftime("%Y-%m-%d")
    except:
        return None


# API Endpoints

@api_router.get("/")
async def root():
    return {"message": "InsureHub - Endorsement Management System"}


# ==================== POLICY ENDPOINTS ====================

@api_router.post("/policies", response_model=Policy)
async def create_policy(policy_data: PolicyCreate):
    """Create a new insurance policy"""
    # Check if policy number already exists
    existing = await db.policies.find_one({"policy_number": policy_data.policy_number}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Policy number already exists")
    
    policy = Policy(**policy_data.model_dump())
    doc = policy.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.policies.insert_one(doc)
    return policy


@api_router.get("/policies", response_model=List[Policy])
async def get_policies():
    """Get all policies"""
    policies = await db.policies.find({}, {"_id": 0}).to_list(1000)
    
    for policy in policies:
        if isinstance(policy['created_at'], str):
            policy['created_at'] = datetime.fromisoformat(policy['created_at'])
    
    return policies


@api_router.get("/policies/{policy_id}", response_model=Policy)
async def get_policy(policy_id: str):
    """Get a specific policy by ID"""
    policy = await db.policies.find_one({"id": policy_id}, {"_id": 0})
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    if isinstance(policy['created_at'], str):
        policy['created_at'] = datetime.fromisoformat(policy['created_at'])
    
    return policy


@api_router.put("/policies/{policy_id}", response_model=Policy)
async def update_policy(policy_id: str, policy_data: PolicyCreate):
    """Update a policy"""
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
async def delete_policy(policy_id: str):
    """Delete a policy"""
    result = await db.policies.delete_one({"id": policy_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    # Also delete all endorsements for this policy
    await db.endorsements.delete_many({"policy_id": policy_id})
    
    return {"message": "Policy deleted successfully"}


# ==================== ENDORSEMENT ENDPOINTS ====================

@api_router.post("/endorsements", response_model=Endorsement)
async def create_endorsement(endorsement_data: EndorsementCreate):
    """Create a new endorsement"""
    # Find policy
    policy = await db.policies.find_one({"policy_number": endorsement_data.policy_number}, {"_id": 0})
    if not policy:
        raise HTTPException(status_code=404, detail=f"Policy {endorsement_data.policy_number} not found")
    
    # Default effective date to endorsement date if not provided
    effective_date = endorsement_data.effective_date or endorsement_data.endorsement_date
    
    # Calculate pro-rata premium
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
        prorata_premium=prorata_premium
    )
    
    doc = endorsement.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.endorsements.insert_one(doc)
    
    # Update policy total lives covered
    if endorsement_data.endorsement_type == EndorsementType.ADDITION:
        await db.policies.update_one(
            {"id": policy['id']},
            {"$inc": {"total_lives_covered": 1}}
        )
    elif endorsement_data.endorsement_type == EndorsementType.DELETION:
        await db.policies.update_one(
            {"id": policy['id']},
            {"$inc": {"total_lives_covered": -1}}
        )
    
    return endorsement


@api_router.get("/endorsements", response_model=List[Endorsement])
async def get_endorsements(
    policy_number: Optional[str] = None,
    relationship_type: Optional[RelationshipType] = None,
    import_batch_id: Optional[str] = None
):
    """Get all endorsements with optional filters"""
    query = {}
    if policy_number:
        query["policy_number"] = policy_number
    if relationship_type:
        query["relationship_type"] = relationship_type
    if import_batch_id:
        query["import_batch_id"] = import_batch_id
    
    endorsements = await db.endorsements.find(query, {"_id": 0}).to_list(10000)
    
    for endorsement in endorsements:
        if isinstance(endorsement['created_at'], str):
            endorsement['created_at'] = datetime.fromisoformat(endorsement['created_at'])
    
    return endorsements


@api_router.get("/endorsements/{endorsement_id}", response_model=Endorsement)
async def get_endorsement(endorsement_id: str):
    """Get a specific endorsement by ID"""
    endorsement = await db.endorsements.find_one({"id": endorsement_id}, {"_id": 0})
    if not endorsement:
        raise HTTPException(status_code=404, detail="Endorsement not found")
    
    if isinstance(endorsement['created_at'], str):
        endorsement['created_at'] = datetime.fromisoformat(endorsement['created_at'])
    
    return endorsement


@api_router.put("/endorsements/{endorsement_id}", response_model=Endorsement)
async def update_endorsement(endorsement_id: str, update_data: EndorsementUpdate):
    """Update an endorsement"""
    existing = await db.endorsements.find_one({"id": endorsement_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Endorsement not found")
    
    # Get policy for recalculation
    policy = await db.policies.find_one({"id": existing['policy_id']}, {"_id": 0})
    
    # Prepare update
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    
    # Recalculate if dates changed
    endorsement_date = update_dict.get('endorsement_date', existing['endorsement_date'])
    effective_date = update_dict.get('effective_date', existing['effective_date'])
    
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
async def delete_endorsement(endorsement_id: str):
    """Delete an endorsement"""
    endorsement = await db.endorsements.find_one({"id": endorsement_id}, {"_id": 0})
    if not endorsement:
        raise HTTPException(status_code=404, detail="Endorsement not found")
    
    result = await db.endorsements.delete_one({"id": endorsement_id})
    
    # Update policy total lives covered
    if endorsement['endorsement_type'] == EndorsementType.ADDITION.value:
        await db.policies.update_one(
            {"id": endorsement['policy_id']},
            {"$inc": {"total_lives_covered": -1}}
        )
    elif endorsement['endorsement_type'] == EndorsementType.DELETION.value:
        await db.policies.update_one(
            {"id": endorsement['policy_id']},
            {"$inc": {"total_lives_covered": 1}}
        )
    
    return {"message": "Endorsement deleted successfully"}


# ==================== EXCEL IMPORT ENDPOINTS ====================

@api_router.post("/endorsements/import", response_model=ImportResult)
async def import_endorsements_from_excel(file: UploadFile = File(...)):
    """
    Import endorsements from Excel file
    Expected columns: Policy Number, Member Name, Relationship Type, Endorsement Type, Endorsement Date, Effective Date
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")
    
    try:
        # Read Excel file
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Normalize column names
        df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')
        
        # Validate required columns
        required_columns = ['policy_number', 'member_name', 'relationship_type', 'endorsement_type', 'endorsement_date']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise HTTPException(
                status_code=400, 
                detail=f"Missing required columns: {', '.join(missing_columns)}"
            )
        
        # Generate batch ID
        import_batch_id = str(uuid.uuid4())
        
        # Process rows
        success_count = 0
        error_count = 0
        errors = []
        
        for index, row in df.iterrows():
            try:
                # Parse policy number
                policy_number = str(row['policy_number']).strip()
                
                # Find policy
                policy = await db.policies.find_one({"policy_number": policy_number}, {"_id": 0})
                if not policy:
                    errors.append({
                        "row": index + 2,  # +2 for header and 0-index
                        "error": f"Policy {policy_number} not found"
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
                        "error": f"Invalid endorsement type: {endorsement_type_str}. Must be one of: Addition, Deletion, Modification"
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
                effective_date = endorsement_date  # Default to endorsement date
                if 'effective_date' in df.columns and pd.notna(row['effective_date']):
                    parsed_effective = parse_date(row['effective_date'])
                    if parsed_effective:
                        effective_date = parsed_effective
                
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
                    import_batch_id=import_batch_id
                )
                
                doc = endorsement.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                
                await db.endorsements.insert_one(doc)
                
                # Update policy total lives covered
                if endorsement_type == EndorsementType.ADDITION:
                    await db.policies.update_one(
                        {"id": policy['id']},
                        {"$inc": {"total_lives_covered": 1}}
                    )
                elif endorsement_type == EndorsementType.DELETION:
                    await db.policies.update_one(
                        {"id": policy['id']},
                        {"$inc": {"total_lives_covered": -1}}
                    )
                
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


@api_router.get("/endorsements/import/{import_batch_id}/results")
async def download_import_results(import_batch_id: str):
    """Download import results as Excel file"""
    endorsements = await db.endorsements.find(
        {"import_batch_id": import_batch_id}, 
        {"_id": 0}
    ).to_list(10000)
    
    if not endorsements:
        raise HTTPException(status_code=404, detail="Import batch not found")
    
    # Convert to DataFrame
    df = pd.DataFrame(endorsements)
    
    # Select and reorder columns
    columns = [
        'policy_number', 'member_name', 'relationship_type', 'endorsement_type',
        'endorsement_date', 'effective_date', 'days_from_inception', 
        'days_in_policy_year', 'remaining_days', 'prorata_premium'
    ]
    df = df[columns]
    
    # Create Excel file in memory
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Import Results')
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=import_results_{import_batch_id}.xlsx"}
    )


@api_router.get("/endorsements/stats/summary")
async def get_endorsements_summary():
    """Get summary statistics for endorsements"""
    total_endorsements = await db.endorsements.count_documents({})
    total_policies = await db.policies.count_documents({})
    
    # Count by relationship type
    pipeline = [
        {"$group": {
            "_id": "$relationship_type",
            "count": {"$sum": 1},
            "total_premium": {"$sum": "$prorata_premium"}
        }}
    ]
    by_relationship = await db.endorsements.aggregate(pipeline).to_list(100)
    
    # Count by endorsement type
    pipeline = [
        {"$group": {
            "_id": "$endorsement_type",
            "count": {"$sum": 1}
        }}
    ]
    by_type = await db.endorsements.aggregate(pipeline).to_list(100)
    
    return {
        "total_endorsements": total_endorsements,
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
