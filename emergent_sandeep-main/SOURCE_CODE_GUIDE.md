# InsureHub - Complete Source Code Documentation

## Quick Access Guide

All source code is located in: `/app/`

### Core Backend File
- **Location**: `/app/backend/server.py`
- **Size**: 950+ lines
- **Description**: Complete FastAPI backend with all APIs

### Core Frontend Files
- **Main App**: `/app/frontend/src/App.js`
- **Auth Context**: `/app/frontend/src/auth.js`
- **Pages Directory**: `/app/frontend/src/pages/`
- **Components**: `/app/frontend/src/components/ui/`

---

## Key Files Overview

### Backend (Python/FastAPI)

#### 1. `/app/backend/server.py`
**Purpose**: Complete backend application
**Features**:
- JWT authentication with Bcrypt
- User management (registration, login)
- Policy CRUD operations
- Endorsement CRUD operations
- Excel import with auto policy creation
- Excel export with complete fields
- Pro-rata premium calculation
- Approval workflow
- Statistics aggregation

**Key Functions**:
- `calculate_prorata_premium()` - Pro-rata calculation logic
- `parse_date()` - Date parsing for multiple formats
- `/api/auth/login` - User authentication
- `/api/auth/register` - User registration
- `/api/policies` - Policy management
- `/api/endorsements` - Endorsement management
- `/api/endorsements/import` - Excel import
- `/api/endorsements/template/download` - Template download
- `/api/endorsements/download/approved` - Export approved
- `/api/endorsements/{id}/approve` - Approve/reject

#### 2. `/app/backend/requirements.txt`
**Dependencies**:
```
fastapi
uvicorn
motor
python-dotenv
pandas
openpyxl
xlrd
pyjwt
passlib[bcrypt]
python-multipart
```

#### 3. `/app/backend/.env`
**Configuration**:
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
CORS_ORIGINS=*
SECRET_KEY=your-secret-key-change-in-production
```

---

### Frontend (React)

#### 1. `/app/frontend/src/App.js`
**Purpose**: Main application with routing and authentication
**Features**:
- Login/Registration UI
- Authentication context provider
- Route protection
- Role-based navigation

#### 2. `/app/frontend/src/auth.js`
**Purpose**: Authentication context and API configuration
**Exports**:
- `AuthContext` - React context for auth state
- `API` - Backend API URL
- `getAuthHeaders()` - Helper for auth headers

#### 3. `/app/frontend/src/pages/HRDashboard.js`
**Purpose**: HR portal layout
**Features**:
- Navigation with tabs
- Routing to HR pages
- Logout functionality

#### 4. `/app/frontend/src/pages/SubmitEndorsement.js`
**Purpose**: Submit individual endorsements
**Features**:
- Form with all fields
- Policy selection
- Relationship type selection
- Date pickers
- Remarks field

#### 5. `/app/frontend/src/pages/MyEndorsements.js`
**Purpose**: View HR user's submissions
**Features**:
- Statistics cards
- Filtering (status, relationship)
- Endorsements table
- Edit/delete pending endorsements

#### 6. `/app/frontend/src/pages/ImportEndorsements.js`
**Purpose**: Bulk Excel import
**Features**:
- Drag-drop file upload
- Template download (XLSX)
- Import results display
- Error reporting

#### 7. `/app/frontend/src/pages/AdminDashboard.js`
**Purpose**: Admin portal layout
**Features**:
- Navigation with tabs
- Routing to Admin pages
- Logout functionality

#### 8. `/app/frontend/src/pages/ApproveEndorsements.js`
**Purpose**: Approve/reject endorsements
**Features**:
- Pending endorsements table
- Approve/reject buttons
- Remarks dialog
- Real-time updates

#### 9. `/app/frontend/src/pages/AllEndorsements.js`
**Purpose**: View all endorsements (admin)
**Features**:
- Complete endorsements table
- Advanced filtering
- Statistics dashboard
- Edit/delete capabilities

#### 10. `/app/frontend/src/pages/PoliciesManagement.js`
**Purpose**: Manage insurance policies
**Features**:
- Policy CRUD operations
- Policy form dialog
- List view with actions

#### 11. `/app/frontend/src/pages/DownloadApproved.js`
**Purpose**: Export approved endorsements
**Features**:
- Policy filter
- Download button
- Statistics display
- XLSX export

#### 12. `/app/frontend/src/App.css`
**Purpose**: Global styles and custom CSS
**Features**:
- Tailwind base/components/utilities
- Custom drag-drop zone styles
- Color scheme variables

#### 13. `/app/frontend/package.json`
**Key Dependencies**:
```json
{
  "dependencies": {
    "react": "^19.x",
    "react-dom": "^19.x",
    "react-router-dom": "^7.x",
    "axios": "^1.x",
    "@radix-ui/*": "UI components",
    "tailwindcss": "^3.x",
    "lucide-react": "icons",
    "sonner": "toast notifications"
  }
}
```

#### 14. `/app/frontend/tailwind.config.js`
**Purpose**: Tailwind CSS configuration
**Features**:
- Custom color scheme
- ShadCN UI integration
- Plugin configuration

#### 15. `/app/frontend/.env`
**Configuration**:
```
REACT_APP_BACKEND_URL=https://claimsportal-1.preview.emergentagent.com
WDS_SOCKET_PORT=443
ENABLE_HEALTH_CHECK=false
```

---

## Database Schema

### Collections

#### 1. **users**
```javascript
{
  id: UUID,
  username: String (unique),
  password_hash: String,
  full_name: String,
  email: String,
  role: "HR" | "Admin",
  created_at: DateTime
}
```

#### 2. **policies**
```javascript
{
  id: UUID,
  policy_number: String (unique),
  policy_holder_name: String,
  inception_date: String (YYYY-MM-DD),
  expiry_date: String (YYYY-MM-DD),
  annual_premium_per_life: Float,
  total_lives_covered: Integer,
  status: "Active" | "Expired" | "Cancelled",
  created_at: DateTime
}
```

#### 3. **endorsements**
```javascript
{
  id: UUID,
  policy_id: UUID,
  policy_number: String,
  member_name: String,
  relationship_type: "Employee" | "Spouse" | "Kids" | "Mother" | "Father",
  endorsement_type: "Addition" | "Deletion" | "Correction",
  endorsement_date: String (YYYY-MM-DD),
  effective_date: String (YYYY-MM-DD),
  days_from_inception: Integer,
  days_in_policy_year: Integer,
  remaining_days: Integer,
  prorata_premium: Float,
  status: "Pending" | "Approved" | "Rejected",
  submitted_by: UUID,
  approved_by: UUID (nullable),
  approval_date: String (nullable),
  remarks: String (nullable),
  import_batch_id: UUID (nullable),
  created_at: DateTime
}
```

---

## API Endpoints Summary

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Policies
- `GET /api/policies` - List policies
- `POST /api/policies` - Create policy
- `GET /api/policies/{id}` - Get policy
- `PUT /api/policies/{id}` - Update policy
- `DELETE /api/policies/{id}` - Delete policy

### Endorsements
- `GET /api/endorsements` - List endorsements (with filters)
- `POST /api/endorsements` - Create endorsement
- `GET /api/endorsements/{id}` - Get endorsement
- `PUT /api/endorsements/{id}` - Update endorsement
- `DELETE /api/endorsements/{id}` - Delete endorsement
- `POST /api/endorsements/{id}/approve` - Approve/reject
- `POST /api/endorsements/import` - Import from Excel
- `GET /api/endorsements/template/download` - Download template
- `GET /api/endorsements/download/approved` - Export approved
- `GET /api/endorsements/stats/summary` - Get statistics

---

## Excel File Formats

### Import Template (11 columns)
1. Policy Number
2. Policy Holder
3. Policy Inception Date
4. Policy Expiry Date
5. Annual Premium Per Life
6. Member Name
7. Relationship Type
8. Endorsement Type
9. Endorsement Date
10. Effective Date
11. Remarks

### Export File (18 columns)
All import columns PLUS:
12. Days from Inception
13. Days in Policy Year
14. Remaining Days
15. Pro-rata Premium
16. Status
17. Approval Date
18. Approved By

---

## Pro-rata Calculation Formula

```javascript
function calculateProrataPremium(
  inception_date,    // Policy start date
  expiry_date,       // Policy end date
  endorsement_date,  // When endorsement received
  annual_premium     // Yearly premium per life
) {
  const total_days = (expiry_date - inception_date).days
  const days_from_start = (endorsement_date - inception_date).days
  const remaining_days = (expiry_date - endorsement_date).days
  
  const prorata_premium = (annual_premium * remaining_days) / total_days
  
  return {
    days_from_inception: days_from_start,
    days_in_policy_year: total_days,
    remaining_days: remaining_days,
    prorata_premium: Math.round(prorata_premium, 2)
  }
}
```

**Example**:
- Policy: Jan 1, 2025 - Dec 31, 2025 (364 days)
- Annual Premium: ₹5,000
- Endorsement: Feb 1, 2025
- Remaining Days: 333
- **Pro-rata Premium: ₹4,574.18**

---

## Key Features

### Authentication & Authorization
- JWT-based authentication
- Bcrypt password hashing
- Role-based access control (HR/Admin)
- Protected routes

### HR Portal
- Submit individual endorsements
- Bulk import via Excel
- View own submissions
- Track approval status
- Filter and search

### Admin Portal
- Approve/reject endorsements
- View all endorsements
- Manage policies
- Export approved endorsements
- Statistics dashboard

### Excel Operations
- Download XLSX template with instructions
- Upload XLSX/XLS files
- Auto-create policies from Excel
- Validate data row-by-row
- Export with all calculated fields

### Business Logic
- Automated pro-rata premium calculation
- Policy auto-creation from Excel
- Total lives covered auto-update
- Approval workflow
- Import batch tracking

---

## How to Access Source Code

### Option 1: Direct File Access
All files are in `/app/` directory on the server

### Option 2: View Individual Files
Use these commands:
```bash
# Backend
cat /app/backend/server.py

# Frontend pages
cat /app/frontend/src/App.js
cat /app/frontend/src/pages/HRDashboard.js
cat /app/frontend/src/pages/ImportEndorsements.js

# Configuration
cat /app/backend/requirements.txt
cat /app/frontend/package.json
```

### Option 3: Create Archive
```bash
cd /app
tar -czf insurehub_source_code.tar.gz backend/ frontend/ README.md DEPLOYMENT_GUIDE.md
```

---

## Deployment Information

### Current Status
- **Preview URL**: https://claimsportal-1.preview.emergentagent.com
- **Production URL**: insurehub.aarogya-assist.com (if deployed by user)

### Services Running
- **Backend**: FastAPI on port 8001 (via supervisor)
- **Frontend**: React dev server on port 3000 (via supervisor)
- **Database**: MongoDB on port 27017

### Environment Variables
- Backend: `/app/backend/.env`
- Frontend: `/app/frontend/.env`

---

## Documentation Files

1. **README.md** - Complete technical documentation
2. **DEPLOYMENT_GUIDE.md** - Deployment instructions
3. **THIS FILE** - Source code overview

---

## Total Lines of Code: ~8,000+ lines

### Breakdown:
- Backend (Python): ~950 lines
- Frontend Pages (React): ~3,000 lines
- Frontend Components (UI): ~2,500 lines
- Configuration & Styles: ~500 lines
- Documentation: ~2,000 lines

---

## License
Proprietary - Aarogya Assist / InsureHub

---

## Support
For issues or questions:
- Email: support@emergent.sh
- Discord: https://discord.gg/VzKfwCXC4A

---

**Last Updated**: February 2025
**Version**: 1.0.0
**Status**: Production Ready
