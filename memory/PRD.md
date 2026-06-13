# InsureHub - Product Requirements Document

## Original Problem Statement
Build an AI-powered insurance endorsement management portal (InsureHub) for Aarogya Assist. The platform serves HR teams and Insurance Admins with features including: Gmail SMTP notifications, WhatsApp alerts, Cloud Storage, CD Ledger financial tracking, Claims analytics, Policy assignment, User management, Landing page, and automated AI notifications.

## Architecture
- **Frontend**: React.js (CRA + Tailwind CSS + Shadcn/UI)
- **Backend**: FastAPI (Python) with Motor (Async MongoDB)
- **Database**: MongoDB
- **Integrations**: OpenAI GPT-4o-mini (Emergent LLM Key), Emergent Object Storage, Gmail SMTP

## Core User Personas
1. **Master Admin** - Full system access, user management, testimonials management
2. **Admin** - Endorsement approvals, policy management, claims, analytics
3. **HR User** - Submit endorsements, view assigned policies/claims, access cloud storage

## Implemented Features

### Phase 1 - Core Portal (DONE)
- HR & Admin registration/login with JWT auth
- Endorsement submission (Addition, Deletion, Correction)
- Endorsement approval workflow
- AI-powered email & WhatsApp notifications
- Gmail SMTP integration
- Analytics dashboard

### Phase 2 - Advanced Features (DONE)
- Policy management and assignment to HR users
- HR data isolation (only see assigned policies/claims/documents)
- Cloud Storage with HR-specific file assignment
- E-card view/email/WhatsApp/download actions
- Claims management with corporate synopsis (no PHI)
- Annual Claims Trend calculation
- CD Ledger with auto-deduction from endorsement pro-rata premiums
- Per Life Premium pro-rata calculations
- Excel bulk import for endorsements
- Audit log

### Phase 3 - User & Landing (DONE)
- User profile management with Change Password
- Forgot Password flow with email reset codes
- Master Admin user management (cleaned up to masteradmin + arpita)
- Landing Page with hero, features, pricing, contact form
- Employee email & mobile columns in endorsements

### Phase 4 - Testimonials & Legal Pages (DONE - Feb 2026)
- **Corporate Testimonials Management**: Master Admin CRUD at /admin/testimonials
- **Dynamic Landing Page Testimonials**: Fetches from /api/testimonials/public, displays with star ratings
- **Privacy Policy Page**: /privacy-policy with comprehensive content
- **Terms of Service Page**: /terms-of-service with full legal terms
- **Career Page**: /careers with 5 job listings and applicant capture form (POST /api/careers/apply)
- **Copyright Disclaimer**: Footer includes trademark/IP notice
- **Navigation Links**: Header and footer properly link to all new pages
- 3 sample corporate testimonials seeded (TCS, Infosys BPM, Wipro Technologies)

### Phase 5 - Claims Excel Import (DONE - Feb 2026)
- **Claims Excel Upload**: Admin/Master Admin can bulk import claims via Excel (POST /api/claims/import)
- **Claims Template Download**: GET /api/claims/template/download provides pre-formatted template
- **Column Alias Support**: Handles flexible column names (policy_no, amount_claimed, etc.)
- **Validation**: Requires Policy Number column; defaults invalid claim types and statuses
- **HR Visibility**: Imported claims auto-appear in HR portal filtered by assigned policies
- **Import Result UI**: Success/error counts displayed after import with row-level error details

### Phase 6 - Policy T&C Explainer & Benchmarking Tool (DONE - Feb 2026)
- **AI T&C Explainer**: Select policy type (Group Health/Term/Accident) + focus area → AI generates comprehensive explanation
- **Policy Benchmarking**: Select 2-4 pre-loaded benchmarks → AI generates side-by-side comparison with recommendations
- **PDF Upload & Analysis**: Upload policy PDF → AI extracts and explains key T&C, exclusions, waiting periods
- **Admin Benchmark Management**: CRUD for benchmark configurations with flexible parameters
- **Pre-loaded Benchmarks**: 8 industry benchmarks seeded (ICICI Lombard, Star Health, HDFC Ergo, ICICI Prudential, Max Life, New India Assurance, Bajaj Allianz, Aarogya Assist Wellness Add-on)
- **Dual Portal Access**: Admin sees 4 tabs (incl. Manage Benchmarks), HR sees 3 tabs
- **Aarogya Assist Wellness Add-ons**: AI highlights modern wellness features as premium enhancements

## Key API Endpoints
- POST /api/auth/login, /api/auth/register
- POST /api/auth/forgot-password, /api/auth/reset-password
- GET/POST/PUT/DELETE /api/testimonials (admin auth)
- GET /api/testimonials/public (no auth)
- PATCH /api/testimonials/{id}/toggle
- POST /api/careers/apply
- POST /api/contact
- POST /api/policy-assignments/
- GET /api/claims, POST /api/claims
- POST /api/claims/import (Excel bulk upload)
- GET /api/claims/template/download
- GET /api/claims-analytics
- GET /api/policies, /api/endorsements
- GET/POST/PUT/DELETE /api/policy-benchmarks
- POST /api/policy-explainer/explain (AI T&C explanation)
- POST /api/policy-explainer/compare (AI policy comparison)
- POST /api/policy-explainer/upload-pdf (PDF analysis)
- Various Cloud Storage, CD Ledger, Analytics endpoints

## Database Collections
- users, policies, policy_assignments, claims, endorsements
- documents, testimonials, career_applications, contact_leads
- cd_ledger, audit_log, import_batches, email_settings

## Remaining Backlog

### P0 - Critical Tech Debt
- Backend modularization: server.py (~4000+ lines) needs splitting into /routes, /models, /services

### P1 - Upcoming
- Twilio SMS notifications for user workflows
- WhatsApp Business API for automated messages

### P2 - Future
- Resume/file upload on career applications
- Admin panel to view career applications
- About Us page content
