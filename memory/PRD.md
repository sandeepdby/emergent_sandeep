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
- **Claims Template**: Matches user format — Policy Number, Claim Number, Claim Type, Policy Type, Claims Report Date, Employee Name, Patient Name, Claimed Amount, Incurred Amount, Paid Amount, Status, Remarks
- **Column Alias Support**: Handles flexible column names
- **HR Visibility**: Imported claims auto-appear in HR portal filtered by assigned policies
- **Annual Claims Trend Formula**: `(Claims / No of Days) * 365 * 1.1` where No of Days = `Today() - Policy inception date`
- **Fields Updated**: Replaced old Cashless/Reimb counts + Approved/Settled amounts with Employee Name, Patient Name, Incurred Amount, Paid Amount

### Phase 6 - Policy T&C Explainer & Benchmarking Tool (DONE - Feb 2026)
- **AI T&C Explainer**: Select policy type (Group Health/Term/Accident) + focus area → AI generates comprehensive explanation
- **Policy Benchmarking**: Select 2-4 pre-loaded benchmarks → AI generates side-by-side comparison with recommendations
- **PDF Upload & Analysis**: Upload policy PDF → AI extracts and explains key T&C, exclusions, waiting periods
- **Admin Benchmark Management**: CRUD for benchmark configurations with flexible parameters
- **Pre-loaded Benchmarks**: 8 industry benchmarks seeded (ICICI Lombard, Star Health, HDFC Ergo, ICICI Prudential, Max Life, New India Assurance, Bajaj Allianz, Aarogya Assist Wellness Add-on)
- **Dual Portal Access**: Admin sees 5 tabs (incl. AI Recommend + Manage Benchmarks), HR sees 4 tabs
- **Aarogya Assist Wellness Add-ons**: AI highlights modern wellness features as premium enhancements
- **AI Policy Recommendation Engine**: HR enters company size, industry, budget, priorities → AI recommends best-fit policies with fit scores, budget estimates, coverage gap analysis, and implementation roadmap
- **Unified Compare & Benchmark**: Upload multiple policy PDFs + select pre-loaded benchmarks → AI side-by-side comparison with enhancement advice, coverage gap analysis, and downloadable results
- **Visual Benchmark Report**: Graphical report preview on screen with score cards (coverage, value, network, claims, satisfaction bars), side-by-side comparison table, Top Pick recommendation, Enhancement Advice, and Aarogya Assist wellness add-ons
- **PDF Report Download + Email**: Generates formatted PDF report with tables, scores, strengths/weaknesses and auto-emails to Master Admin with attachment
- **Policy Type Selection**: Dedicated flow per insurance type (Group Health, Group Term, Group Accident)

### Phase 7 - UI/UX Redesign (DONE - Feb 2026)
- **Sidebar Navigation**: Migrated from cramped horizontal top bar to categorized vertical left sidebar
- **Admin Portal**: 15 nav items organized in 5 groups (Overview, Operations, Policies & Claims, Finance, System)
- **HR Portal**: 9 nav items organized in 4 groups (Overview, Endorsements, Policies & Claims, Finance & Storage)
- **Collapsible Sidebar**: Toggle button to collapse/expand (240px ↔ 68px) with smooth animation
- **Glassmorphism Header**: Sticky top header with backdrop-blur-xl, semi-transparent white overlay
- **Organic & Earthy Theme**: Warm background (#FDFBF7), terracotta accent (#E05A47), stone-based neutrals
- **Typography**: Work Sans (headings) + IBM Plex Sans (body) via Google Fonts
- **Active Nav State**: White card with left terracotta border accent and subtle shadow

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
- POST /api/policy-explainer/recommend (AI policy recommendation)
- Various Cloud Storage, CD Ledger, Analytics endpoints

## Database Collections
- users, policies, policy_assignments, claims, endorsements
- documents, testimonials, career_applications, contact_leads
- cd_ledger, audit_log, import_batches, email_settings

### Bug Fix - Dashboard Metrics (DONE - Jul 2026)
- **Root Cause**: 6 backend endpoints used `submitted_by` filter for HR users instead of `policy_number` based on policy assignments. This meant HR users only saw endorsements they personally submitted (often 0), not endorsements for their assigned policies.
- **Endpoints Fixed**: `GET /api/dashboard/analytics`, `GET /api/endorsements`, `GET /api/endorsements/import-batches`, `GET /api/endorsements/batch/{batch_id}`, `GET /api/endorsements/batch/{batch_id}/download`, `GET /api/endorsements/stats/summary`
- **Result**: HR users now correctly see all endorsement data (premium charges, refunds, net premium impact, counts) for policies assigned to them. Admin view unaffected.

### Financial Summary PDF Export (DONE - Jul 2026)
- **Endpoint**: `POST /api/financial-summary/export?send_email_flag=<bool>` — accessible by both HR and Admin
- **PDF Contents**: Policy breakdown table (FY-filtered), endorsement premium impact (charges, refunds, net), claims summary (total, incurred, paid, ratio, trend), endorsement status distribution, endorsement type breakdown, monthly endorsement trend
- **HR Isolation**: PDF only includes data for HR user's assigned policies
- **Email**: When send_email_flag=true, PDF is emailed to the logged-in user as attachment via SMTP
- **Frontend**: "Export FY Report" button on both HR Dashboard (HRSummary.js) and Admin Analytics Dashboard (AnalyticsDashboard.js)

### Rate Cards / Raters Feature (DONE - Jul 2026)
- **Data Model**: Each rater has name, policy_number, custom age_bands (min_age, max_age, per_life_rate), assigned_hr_users list
- **Multiple raters per policy**: Different rate cards can exist for the same policy
- **Admin CRUD**: Create/Edit/Delete raters with custom age ranges, assign to policy + specific HR users. Policy metadata (type, insurer) auto-populated from policy collection.
- **HR Read-Only**: HR users see only raters assigned to them. No create/edit/delete controls. View the rate table inline (expandable card) or in a dialog.
- **Download**: Both Excel (.xlsx) and PDF formats available for both Admin and HR users. Excel includes header with rater name/policy/insurer info.
- **Sidebar Placement**: Under "Finance" section for Admin, under "Finance & Storage" for HR
- **Endpoints**: POST/GET/PUT/DELETE /api/raters, GET /api/raters/{id}/download?format=xlsx|pdf

### Submit Endorsement Enhancements (DONE - Jul 2026)
- **Policy Type (Family Definition)**: New dropdown with E (Employee Only), ESK (Employee+Spouse+Kids), ESKP (Employee+Spouse+Kids+Parents). Controls which relationship types are available.
- **Extended Relationship Types**: Added Kids1 and Kids2. Full list: Employee, Spouse, Kids1, Kids2, Mother, Father.
- **Rate Card Auto-Fill**: Per Life Premium auto-populates from rate card based on member's age. Shows green "From Rate Card" badge. Editable.
- **Bug Fix**: Fixed `annual_premium_per_life` KeyError for policies missing this field.

### Add Family — Batch Submission (DONE - Jul 2026)
- **Mode Toggle**: "Single Member" (default) and "Add Family" modes on the Submit Endorsement page
- **Family Mode**: Common fields at top (Policy, Employee ID, Endorsement Type, dates). Employee row pre-added. HR clicks "+ Add Dependent" buttons (Spouse, Kids1, Kids2, Mother, Father) to add more rows.
- **Per-member fields**: Each member has Relationship, Name, DOB, Age (auto-calc), Gender, Per Life Rate (auto-filled from rate card per member's age)
- **Batch submit**: All members submitted as individual endorsements under the same Employee ID. Success shows count of submitted members.
- **Family Premium Summary**: Shows total premium across all members with pro-rata calculation preview

## Remaining Backlog

### P0 - Critical Tech Debt
- Backend modularization: server.py (~5500+ lines) needs splitting into /routes, /models, /services

### P1 - Upcoming
- Twilio SMS notifications for user workflows
- WhatsApp Business API for automated messages

### P2 - Future
- Resume/file upload on career applications
- Admin panel to view career applications
- About Us page content
