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

## Key API Endpoints
- POST /api/auth/login, /api/auth/register
- POST /api/auth/forgot-password, /api/auth/reset-password
- GET/POST/PUT/DELETE /api/testimonials (admin auth)
- GET /api/testimonials/public (no auth)
- PATCH /api/testimonials/{id}/toggle
- POST /api/careers/apply
- POST /api/contact
- POST /api/policy-assignments/
- GET /api/claims, /api/policies, /api/endorsements
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
