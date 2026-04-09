# InsureHub - Endorsement Management Portal PRD

## Original Problem Statement
Build a comprehensive health insurance endorsement management system with:
- Gmail SMTP email notifications
- WhatsApp Web direct messaging
- AI-generated notification content (Emergent LLM Key / GPT-4o-mini)
- Landing page with AI insights
- Cloud storage for document management
- CD Ledger for cash deposit tracking
- Smart form with auto-calculations and validations

## Architecture
- **Frontend**: React.js (CRA + Shadcn/UI + Tailwind)
- **Backend**: FastAPI + Motor (async MongoDB)
- **Database**: MongoDB
- **AI**: GPT-4o-mini via Emergent LLM Key + litellm
- **Storage**: Emergent Object Storage
- **Email**: Gmail SMTP with App Password

## Completed Features

### Session 1-3 - Core Platform
- [x] User registration with phone numbers (HR/Admin roles)
- [x] JWT authentication with login/logout
- [x] Policy CRUD management
- [x] Endorsement submission (single + Excel bulk import)
- [x] Endorsement approval/rejection workflow
- [x] Pro-rata premium calculation engine
- [x] Analytics dashboard with charts
- [x] Excel download of approved endorsements
- [x] Gmail SMTP email notifications
- [x] WhatsApp Web direct messaging links
- [x] AI-generated notification content (GPT-4o-mini)

### Session 4 - Landing Page
- [x] High-contrast landing page with hero section
- [x] Features bento grid, AI section, testimonials, footer
- [x] Framer Motion animations, responsive design

### Session 5 - Cloud Storage (April 2026)
- [x] Emergent Object Storage integration
- [x] 5 categories: Policy Terms, Endorsement Files, Premium Receipts, E-Cards, Others
- [x] Upload/download/soft-delete with role-based permissions

### Session 6 - Advanced Features (April 2026)
- [x] Auto age calculation from DOB
- [x] Dynamic form fields: Addition→DOJ, Deletion→DOL, Midterm addition→hide Employee
- [x] 45-day backdating lock on DOJ/DOL (frontend min + backend validation)
- [x] Excel Preview step before import (HR reviews data before submitting)
- [x] Admin Import Batches viewer with Excel download
- [x] CD Ledger tab: manual cash deposits, auto-deduction on endorsement approval
- [x] Premium sign convention: Addition=positive charge, Deletion=negative refund
- [x] Annual Premium Per Life column in All Endorsements & Approve tables

### Session 7 - Product Types, HR Isolation & Policy CD Ledger (April 2026)
- [x] GPA & GTL product types added to policies
- [x] GPA/GTL policies restrict relationship type to Employee only
- [x] Policy-wise CD Ledger filtering with dropdown and balance recalculation
- [x] HR Data Isolation: HR users only see own endorsements, import batches, batch details
- [x] Full E2E Excel import tested: Upload → Preview → Confirm → Admin batch view → Approve → CD auto-deduct → Download

### Session 8 - HR Dashboard Summary (April 2026)
- [x] New HR Dashboard landing page with summary stats
- [x] 4 stat cards: Total Submitted, Pending, Approved, Rejected
- [x] 3 premium cards: Charges, Refunds, Net Premium Impact
- [x] Status Distribution donut chart + By Endorsement Type bar chart
- [x] Recent Endorsements table (latest 8)
- [x] Dashboard is default tab for HR (redirects from /hr to /hr/dashboard)

### Session 9 - View/Edit & Registration Security (April 2026)
- [x] HR My Endorsements: View (all), Edit (Pending only), Delete (Pending only) with full detail dialog
- [x] Admin All Endorsements: View, Edit, Delete with full detail dialog (16 fields)
- [x] Registration restricted to HR role only — Admin registration blocked (403)
- [x] Frontend registration form shows "HR User" as fixed role (no dropdown)

### Session 10 - User Management & Data Display (April 2026)
- [x] Admin User Management page: create HR or Admin accounts, list all users, delete users
- [x] One email per login — unique email enforcement on both registration and admin creation (400 error)
- [x] My Endorsements table now shows DOB, Gender, Sum Insured columns
- [x] View dialog shows all 17 fields (including DOJ, DOL, annual premium, prorata)

### Session 11 - Master Admin, Promote & Email Notifications (April 2026)
- [x] Master Admin seeded on startup: masteradmin / Admin@123 (email: sandeepdby@gmail.com, phone: 9886260579)
- [x] Promote HR to Admin: PUT /api/users/{id}/promote (Admin only, ArrowUp button in UI)
- [x] Endorsement submission sends email with Excel attachment to ks@aarogya-assist.com, connect@aarogya-assist.com + all Admin users

## API Endpoints

### Auth
- POST /api/auth/register
- POST /api/auth/login
- GET /api/users/admins

### Endorsements
- POST /api/endorsements - Create with 45-day validation
- GET /api/endorsements - List all
- GET /api/endorsements/{id} - Get specific
- PUT /api/endorsements/{id} - Update pending
- DELETE /api/endorsements/{id} - Delete
- POST /api/endorsements/{id}/approve - Approve/reject (auto CD deduct)
- POST /api/endorsements/preview - Excel preview before import
- POST /api/endorsements/import - Bulk import from Excel
- GET /api/endorsements/import-batches - List import batches
- GET /api/endorsements/batch/{id} - View batch detail
- GET /api/endorsements/batch/{id}/download - Download batch as Excel
- GET /api/endorsements/template/download
- GET /api/endorsements/download/approved
- GET /api/endorsements/stats/summary
- POST /api/endorsements/bulk-approve

### Policies
- CRUD at /api/policies

### CD Ledger
- GET /api/cd-ledger - List entries with running balance
- POST /api/cd-ledger - Add manual entry (Admin only)
- DELETE /api/cd-ledger/{id} - Delete manual entry (Admin only)

### Documents
- POST /api/documents/upload?category=...
- GET /api/documents
- GET /api/documents/{id}/download
- DELETE /api/documents/{id}

### Email & Notifications
- GET/POST /api/email/config
- POST /api/notifications/generate

## Database Schema
- `users`: id, username, password, full_name, email, phone, role
- `endorsements`: id, policy_id, policy_number, member_name, dob, age, endorsement_type, date_of_joining, date_of_leaving, annual_premium_per_life, prorata_premium, status, import_batch_id, ...
- `policies`: id, policy_number, inception_date, expiry_date, annual_premium_per_life, ...
- `cd_ledger`: id, date, reference, description, amount, entry_type, endorsement_id, ...
- `documents`: id, storage_path, original_filename, category, uploaded_by, is_deleted, ...

## Future/Backlog Tasks
- P1: SMS notifications via Twilio
- P2: Pricing/contact page for lead generation
- P2: Audit log for all user actions
- P2: WhatsApp Business API for automated messages
- P3: Backend refactoring (server.py modularization)
