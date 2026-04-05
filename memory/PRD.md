# InsureHub - Endorsement Management Portal PRD

## Overview
InsureHub is a comprehensive endorsement management portal for insurance companies. It allows HR users to submit endorsements (additions, deletions, corrections) for policy members, and Admin users to approve or reject these endorsements.

## Core Features

### Authentication System
- JWT-based authentication with "HR" and "Admin" roles
- Registration and login functionality
- Role-based access control

### HR Portal
- Submit individual endorsements with all member details
- Import endorsements in bulk via Excel file upload
- View and manage submitted endorsements
- Download Excel template for bulk imports

### Admin Portal  
- Review pending endorsements
- Approve or reject endorsements with remarks
- Manage policies (CRUD operations)
- Download approved endorsements as Excel report

### Excel Import/Export
- **Import Template (19 columns)**:
  - Policy Number, Policy Holder, Policy Inception Date, Policy Expiry Date
  - Type of Policy (Group Health/Group Accident/Group Term)
  - Annual Premium Per Life, Employee ID, Member Name
  - DOB, Age, Gender, Relationship Type
  - Endorsement Type (Addition/Deletion/Correction/Midterm addition)
  - Date of Joining, Coverage Type (Floater/Non-Floater), Suminsured
  - Endorsement Date, Effective Date, Remarks

- **Export Report (26 columns)**:
  - All import fields plus: Days from Inception, Days in Policy Year
  - Remaining Days, Pro-rata Premium (auto-calculated), Status
  - Approval Date, Approved By (actual user name)

### Pro-rata Premium Calculation
- Automatic calculation based on policy dates and annual premium
- Formula: (Annual Premium × Remaining Days) / Days in Policy Year
- **Addition/Midterm addition**: Positive premium (charge to client)
- **Deletion**: Negative premium (refund to client)
- **Correction**: Zero premium impact

## Technical Architecture

### Backend (FastAPI)
- `/app/backend/server.py` - Main API server
- MongoDB database for data persistence
- JWT authentication with bcrypt password hashing
- Async motor driver for MongoDB operations
- Pandas/openpyxl for Excel processing

### Frontend (React)
- `/app/frontend/src/` - React application
- ShadCN UI components
- Role-based routing and dashboards
- Axios for API calls
- Sonner for toast notifications

### Database Collections
- **users**: username, password_hash, role, full_name, email
- **policies**: policy_number, policy_holder_name, inception_date, expiry_date, policy_type, annual_premium_per_life, status
- **endorsements**: All member details, policy reference, premium calculations, approval status

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user info

### Policies (Admin only)
- `GET /api/policies` - List all policies
- `POST /api/policies` - Create policy
- `PUT /api/policies/{id}` - Update policy
- `DELETE /api/policies/{id}` - Delete policy

### Endorsements
- `GET /api/endorsements` - List endorsements (filtered by role)
- `POST /api/endorsements` - Create endorsement
- `PUT /api/endorsements/{id}` - Update endorsement
- `DELETE /api/endorsements/{id}` - Delete endorsement
- `POST /api/endorsements/{id}/approve` - Approve/reject (Admin only)
- `POST /api/endorsements/import` - Import from Excel
- `GET /api/endorsements/download/approved` - Download approved as Excel
- `GET /api/endorsements/template/download` - Download import template

## Completed Features (Feb 2025)

### Session 1
- [x] Full authentication system with HR/Admin roles
- [x] Endorsement submission form
- [x] Excel import functionality
- [x] Approval workflow
- [x] Pro-rata premium calculation

### Session 2
- [x] Added Employee ID field to import/export
- [x] Added Type of Policy field
- [x] Added DOB, Age, Gender fields
- [x] Added Endorsement Type "Midterm addition"
- [x] Added Date of Joining field
- [x] Added Coverage Type (Floater/Non-Floater)
- [x] Added Suminsured (Coverage) field
- [x] Updated all frontend forms and tables
- [x] Fixed legacy data handling (submitted_by optional)
- [x] **Premium Calculation for Deletion = Refund (negative value)**
- [x] **UI displays refund amounts in red with "(Refund)" label**
- [x] **Excel export preserves negative premium values for deletions**

### Session 3 (Latest)
- [x] **Added "Premium Type" column (Charge/Refund) to Excel export**
- [x] **Bulk Approval/Rejection with checkbox selection**
- [x] **Email Settings page with Gmail SMTP configuration**
- [x] **Send emails with CC, BCC, and attachment options**
- [x] **Analytics Dashboard with interactive charts:**
  - Status Distribution pie chart
  - Endorsements by Type bar chart
  - Monthly Trend area chart
  - Relationship Type distribution
  - Top Policies breakdown
  - Premium summary cards (Charge vs Refund)
- [x] **PDF Export with two options:**
  - Summary Report (statistics and totals)
  - Detailed Report (full table format)
- [x] **Enhanced UI with gradient cards and better visuals**

## Test Credentials
- **HR User**: hr@test.com / password123
- **Admin User**: admin@test.com / password123

## Backlog / Future Enhancements
- [ ] Auto-send email notifications on submission/approval (requires Gmail App Password)
- [ ] Audit log for all user actions
- [ ] Multi-policy comparison view
- [ ] Export templates for different insurers
