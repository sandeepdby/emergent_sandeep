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

### Notification Log + User Edit + WhatsApp Template SIDs (DONE - Sep 2026)
- **Notification Log**: every email/SMS/WhatsApp send is recorded to `notification_logs` (channel, recipient, resolved recipient_user_id/name, status sent/failed/skipped, provider SID, error, subject/preview, timestamp) via a central `log_notification` helper wired into all 4 send functions. GET /api/notification-logs (admin, filters: channel/status/q/user_id). UI: "Sent Log" tab on the SMS Consent page with channel/status filters, search, delivery-status badges, and CSV export.
- **WhatsApp Template SIDs**: TWILIO_WA_TEMPLATE_SUBMITTED and TWILIO_WA_TEMPLATE_STATUS both set to HX28a70cf88ef1162aa3ceddbee18f942f (user's approved template, used for both events). Verified: template send succeeded (MM… SID, no fallback) with the 5 content variables.
- **User Edit + missing-phone flag**: PATCH /api/users/{id} (admin) updates full_name/email/phone. UI: Edit (pencil) action in User Management with a dialog; rows without a phone show a "No phone" badge; an amber banner lists accounts missing a phone number (SMS/WhatsApp can't reach them).
- Verified in preview: PATCH updates phone (200), notification-logs returns entries with SIDs + resolved names, both pages render (screenshots). Recurring visual-edits Babel plugin error appeared during build; cleared on frontend restart.


- Unified recipient rule for submission, approval AND rejection: **SMS + WhatsApp go to both the HR user and their respective admin**, and the **email (with endorsement Excel) also goes to both** (consulting@ CC retained).
- Added `get_assigned_admin_phone` (assigned admin phone, master fallback). Submission admin SMS/WhatsApp now targets the assigned admin (was scoped master+assigned). Approval/rejection now sends SMS + WhatsApp to submitter AND assigned admin (previously submitter only); approval block made self-contained (safe if submitter has no email). Neutral message wording works for both recipients.
- Verified in preview: submit + approve → HTTP 200, email(submitter+admin) + SMS + WhatsApp firing on both, no errors.
- NEEDS REDEPLOY to reach production.


- On endorsement submit (POST /api/endorsements — used by both single and family-batch flows), the HR submitter now receives: email (already added), plus a **SMS + WhatsApp confirmation** to current_user.phone ("submitted successfully… pending approval"). Admins still get their separate alert SMS/WhatsApp. WhatsApp confirmation is free-form (send_whatsapp_notification).
- Verified in preview: submission log shows submitter email + admin SMS/WhatsApp + HR confirmation SMS/WhatsApp firing.
- NOTE: "email not reaching HR" on production is because the earlier submitter-email change hadn't been redeployed — a redeploy applies both.

### Endorsement Email Recipients + Excel on Approval (DONE - Sep 2026)- **Requirement**: On endorsement submit AND approve/reject, email the HR submitter with the uploaded Excel attached; limit recipients to "User + respective admin".
- **Change (server.py, submit ~2607 & approve ~3143)**: recipients now = HR submitter email + their assigned admin (`managed_by_admin_id`) email. New helper `get_assigned_admin_email` falls back to master admin only when the HR has no assigned admin (so an approver is always notified). Removed fixed recipients ks@/connect@aarogya-assist.com from these emails. Master admin no longer force-added. `consulting@aarogya-assist.com` still CC'd via the global GLOBAL_CC (unchanged). Approval email now generates + attaches the endorsement Excel (previously none). Scope: endorsement submit/approve emails only; all other system emails unchanged.
- **Verified**: live submit + approve as masteradmin → HTTP 200, log recipients `['sandeepdby@gmail.com']` (ks@/connect@ gone), Excel generated without error on both paths; helper returns master fallback for arpita (no assigned admin) and assigned-admin email otherwise.


- **Opt-Out Admin View** (ConsentManagement.js, route /admin/consent, nav "SMS Consent"): two tabs — Opted In (from /api/sms-optins) and Opted Out/STOP (from /api/sms-suppressions) — with summary cards, search, and **CSV export** per tab for Twilio toll-free verification. Verified with seeded data + screenshots.
- **Reset code note**: User Management reset dialog Option 2 now shows "The emailed reset code is valid for 1 hour" (matches backend enforcement).

### Admin Force Password Reset (DONE - Sep 2026)- **Endpoint**: POST /api/users/reset-password (Admin/Master Admin only) — sets another user's password by `email` or `user_id`. Validates min 6 chars + 72-byte bcrypt limit, reuses get_password_hash, audit-logged (ADMIN_RESET_PASSWORD). Email lookup is exact then case-insensitive.
- **UI**: User Management → key icon per row opens a Reset Password dialog with two options: (1) set a new password directly, (2) email a reset code via existing /auth/forgot-password flow.
- **Verified in preview**: reset temp user → login with new password 200, old password 401, HR blocked 403.
- **Note**: prachi@meron.ai is a PRODUCTION-only user (not in preview) — after redeploy, Master Admin can set her password to Password123 from User Management.


- **Symptom**: Production showed all modules broken/empty across all roles (Analytics, Cloud Storage, CD Ledger, Dashboard, endorsements). Preview was healthy.
- **RCA (deployer agent)**: Some prod records held non-finite floats (NaN/Infinity from legacy divide-by-zero where days_in_policy_year=0). FastAPI's default JSONResponse uses json.dumps(allow_nan=False) → `ValueError: Out of range float values are not JSON compliant` → HTTP 500 on every endpoint touching such a record. Pod/DB/secrets all confirmed healthy; NOT a deploy/DB issue.
- **Fix (server.py)**: (1) `SafeJSONResponse` set as FastAPI `default_response_class` — recursively converts NaN/Inf → null on ALL responses (StreamingResponse/Response file downloads unaffected). (2) Startup hook `sanitize_nonfinite_data` repairs stored NaN/Inf → 0.0 in endorsements/policies/cd_ledger/claims on every boot (idempotent). Write-path divisors already guarded.
- **Verified in preview**: injected NaN+Infinity into an endorsement → endpoints returned 200 (value null); after restart, cleanup logged "Sanitized non-finite floats in 1 documents" and record repaired to 0.0.
- **ACTION**: Must redeploy to production for the fix to take effect.


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

### Employee Directory (DONE - Jul 2026)
- **Active Members View**: Shows all active employees/dependents derived from approved Addition endorsements minus approved Deletions. Searchable by name or employee ID, filterable by policy.
- **HR Isolation**: HR users see only members from their assigned policies. Admin sees all.
- **Stats Badges**: Total active members, employees, dependents counts. Shows "X of Y" when filtered.
- **View Details**: Eye icon opens dialog with full member details (Employee ID, DOB, Age, Gender, Rate, Sum Insured, Coverage, DOJ, Email, Mobile)
- **Initiate Deletion**: Delete icon navigates to Submit Endorsement with ALL fields auto-populated (Policy, Endorsement Type=Deletion, Member Name, Relationship, DOB, Age, Gender, Rate, etc.) using synchronous sessionStorage pre-fill for reliable Select component rendering.
- **Sidebar**: Under "Endorsements" for HR, under "Operations" for Admin
- **Endpoint**: GET /api/employee-directory with optional search and policy_number filters

### Employee Coverage History (DONE - Jul 2026)
- **Timeline View**: Click History icon on any member in Employee Directory to see their complete endorsement journey — all additions, deletions, corrections in chronological order
- **Visual Timeline**: Colored icons per endorsement type (green for Addition, red for Deletion, blue for Correction, violet for Midterm addition) with status badges (Approved/Pending/Rejected)
- **Event Details**: Each event shows member name, relationship badge, per-life premium, pro-rata amount, endorsement date, DOJ/DOL, remarks, submitted by, approved by
- **HR Isolation**: History only shows events from HR's assigned policies
- **Endpoint**: GET /api/employee-directory/history with employee_id, member_name, policy_number query params

### Family Group View (DONE - Jul 2026)
- **Feature**: Click Family icon (pink people icon) on any member in Employee Directory to see all family members linked by the same Employee ID + Policy
- **Summary Card**: Shows count (e.g. "4 — 1 Employee + 3 Dependents") and Total Family Premium (sum of all per-life rates)
- **Member Cards**: Each family member displayed in a card with avatar initial, name, relationship badge (color-coded), age, gender, DOB, and per-life rate
- **Edge Cases**: Members without employee_id show just themselves. Solo employees show "No other family members found" message
- **Client-side grouping**: No extra API needed — groups from already-loaded directory data by employee_id + policy_number

### Family Deletion (DONE - Jul 2026)
- **Feature**: Red "Delete Entire Family (N)" button inside the Family Group dialog. Two-click safety: first click shows confirmation warning, second click submits all.
- **Batch Deletion**: Submits individual Deletion endorsements for each family member, with remarks "Family exit — bulk deletion". All need admin approval.
- **Success/Error Feedback**: Green result banner shows count. Refreshes directory after completion.

### Bulk Family Import Enhancement (DONE - Jul 2026)
- **Family Import Template**: New dedicated template (GET /api/endorsements/template/family) with 3 sheets: Family Import (7 sample rows with full ESKP family), Instructions, and Tips. Pink "Family Import Template" button on Import page.
- **Rate Card Auto-Fill**: During Excel import, if Per Life Premium column is blank, system auto-looks up the rate from the assigned Rate Card based on member's age. Explicit values in Excel override the rate card.
- **Priority Chain**: Excel per_life_premium → Rate Card band lookup by age → policy.annual_premium_per_life fallback
- **UI Info Box**: Green "Rate Card Auto-Fill" info box on Import page explaining the auto-fill behavior
- **Updated Format Guide**: Now lists Kids1, Kids2 as valid relationship types, notes Employee ID links family members

### Admin Edit Premium on Approved Endorsements (DONE - Jul 2026)
- **Feature**: Admin can now edit annual premium, per-life premium, and prorated premium on approved endorsements
- **Smart Recalculation**: Prorata auto-recalcs only when date/type actually changes AND user didn't explicitly provide prorata value
- **HR Restriction**: HR users still cannot edit approved endorsements (403)

### Profile Photo Fix (DONE - Jul 2026)
- **Root Cause**: Object storage put_object returns {path, size, etag} with NO url field. Fixed with backend-served endpoint.
- **Fix**: New GET /api/auth/profile-photo/{user_id} streams photos from object storage. Frontend resolvePhotoUrl constructs full URLs.

### CD Ledger Excel Import (DONE - Jul 2026)
- **Template Download**: GET /api/cd-ledger/template/download — Excel with sample entries and Instructions sheet
- **Excel Import**: POST /api/cd-ledger/import — bulk-creates CD Ledger entries with smart column normalization
- **Admin Only**: HR users get 403 on both template download and import

### CD Ledger Infographics Fix (DONE - Jul 2026)
- **Root Cause**: Frontend calculated deposits/deductions client-side → broke with string amounts. Fix: backend returns pre-computed totals.
- **Case-insensitive Policy Filter**: CD entries with different casing (e.g., "RELYON(SELF+5)" vs "Relyon(self+5)") now match via regex. Special chars handled via re.escape().
- **Policy Tagging Required**: Add Entry form now requires policy selection. Import normalizes policy_number against canonical name from policies collection.
- **Untagged Filter**: Admin has "Untagged (No Policy)" filter option to find orphaned entries. Red "Untagged" badge on entries without policy.
- **Bulk Tag**: POST /api/cd-ledger/bulk-tag endpoint + UI bar to assign untagged entries to a policy in bulk.

### Employee Directory Excel Upload & Copyright Update (DONE - Jul 2026)
- **Active Members Upload**: Admin can upload Excel with active members (Employee ID, Name, Relationship, DOB, Age, Gender, Policy, Mobile, Email, Sum Insured, Coverage Type). Creates Addition endorsements. Includes template download.
- **Policy Filter Fix**: Employee Directory policy filter now shows ALL system policies (from /api/policies), not just policies with active members.
- **All Policy Filter**: "All Policies" option correctly shows all members unfiltered.
- **Email on Endorsement Import**: POST /api/endorsements/import and POST /api/employee-directory/upload both send background email notifications to mapped HR users and Admins.
- **Copyright Update**: All pages display "Aarogya Innovate Pvt Ltd" in copyright footers and branding.
- **Mobile Number Fix**: Excel uploads read all columns as strings (dtype=str) to prevent pandas float coercion corrupting mobile numbers like +919876543210.
- **Endpoints**: GET /api/employee-directory/template, POST /api/employee-directory/upload

## Remaining Backlog

### Security Audit & Fixes (DONE - Jul 2026)
- **SEC-001 (CRITICAL)**: Password reset regex injection → account takeover. FIX: Exact match on stored token_prefix.
- **SEC-002 (HIGH)**: HR policy filter override → cross-policy PII. FIX: Intersect with assigned policies.
- **SEC-003 (HIGH)**: Hardcoded admin credential. FIX: Reads from env vars.
- **SEC-004 (MEDIUM)**: Non-expiring JWT. FIX: 24h exp claim added.
- **SEC-005 (MEDIUM)**: Document download missing authz. FIX: HR ownership check.
- **Hardening**: Rotated SECRET_KEY, sanitized error messages.

### Batch Approve/Reject Endorsements (DONE - Jul 2026)
- **Feature**: Admin + Master Admin can select multiple pending endorsements via checkboxes and approve/reject all at once
- **Status Filter**: New "Status" dropdown in filters (All/Pending/Approved/Rejected) for client-side filtering
- **Checkboxes**: Only appear on Pending endorsement rows. Header "Select All" checkbox selects all visible pending items
- **Batch Action Bar**: Blue bar appears when items are selected with "Approve All" and "Reject All" buttons and count
- **Confirmation Dialog**: Opens with optional remarks textarea, shows summary of what will happen (CD Ledger entries, policy lives update, email notifications)
- **CD Ledger Integration**: Batch approve auto-creates CD Ledger deduction/credit entries for each endorsement's pro-rata premium
- **Policy Lives Update**: Approved additions increment, approved deletions decrement policy total_lives_covered
- **Email Notifications**: Submitting HR users are notified when their endorsements are batch approved/rejected
- **Endpoint**: POST /api/endorsements/bulk-approve (already existed; enhanced with CD Ledger auto-deduction)

### AI Email Preview on Policy Assignment (DONE - Jul 2026)
- **Feature**: When Admin assigns policies to HR, an AI-generated email preview dialog opens automatically
- **AI Generation**: Uses GPT-4o-mini to craft a personalized email with policy details, coverage info, insurer, period, lives covered, and a welcome message
- **Editable Preview**: Admin sees rendered HTML preview with To, Subject fields. Can toggle raw HTML editor to customize
- **Send/Skip**: Admin can send the email or skip. No duplicate emails (removed auto-send from bulk assignment)
- **Fallback**: If AI fails, a professional static HTML template with terracotta branding is used
- **Endpoints**: POST /api/policy-assignments/preview-email, POST /api/policy-assignments/send-email

### Excel Attachment on Endorsement Import Emails (DONE - Jul 2026)
- **Feature**: When endorsements are imported via Excel (POST /api/endorsements/import), the notification email to HR & Admin now includes the uploaded Excel file as an attachment
- **Employee Directory Upload**: POST /api/employee-directory/upload also attaches the uploaded Excel to notification emails
- **Implementation**: Uses existing `send_email_notification` attachments parameter with `[(filename, contents)]`

### Admin Assignment to HR Users (DONE - Jul 2026)
- **Feature**: HR registration form now includes "Assigned Admin" dropdown to select which Admin manages the HR user
- **Data Model**: `managed_by_admin_id` field added to User model (UserCreate + User)
- **Public Endpoint**: GET /api/users/admins/public returns admin list (id + full_name) without auth for registration form
- **Scoped Notifications**: Registration emails now go only to assigned admin + master admin (not all admins)

### Scoped Email Notifications (DONE - Jul 2026)
- **Feature**: All notification emails now scoped to assigned admin + master admin instead of broadcasting to all admins
- **Helper**: `get_scoped_admin_emails(hr_user_id)` always includes master admin + HR's assigned admin
- **Affected Flows**: User registration, endorsement submission notifications
- **Fixed Recipients**: FIXED_NOTIFY_EMAILS (ks@, connect@) still included for endorsement submissions

### WhatsApp Share Buttons (DONE - Jul 2026)
- **Feature**: "Share via WhatsApp" buttons added to endorsement import results and batch approve/reject flows
- **Implementation**: Uses `wa.me` links with pre-filled text (no API needed)
- **Endorsement Import**: Green WhatsApp button appears in import results section after successful import
- **Batch Approve/Reject**: WhatsApp share dialog opens after successful batch operation with "Open WhatsApp" button

### Cloud Storage Policy Filter (DONE - Sep 2026)
- **Feature**: Documents can now be tagged to a specific policy during upload and filtered by policy
- **Upload to Policy**: New dropdown when uploading to tag documents to a specific policy_number
- **Filter by Policy**: New dropdown to filter document list by policy
- **Endpoints**: GET /api/documents now accepts `policy_number` query param; POST upload/bulk-upload accept `policy_number`

### Rate Cards — Flat Rate & Per Family (DONE - Sep 2026)
- **Feature**: Rate cards now support 3 rate types: Age Band (default), Per Life Flat Rate, Per Family Rate
- **Flat Rate**: Single fixed premium per life regardless of age
- **Per Family**: Single rate per family unit
- **Data Model**: `rate_type`, `flat_rate`, `per_family_rate` fields added to raters collection
- **Auto-fill**: Endorsement rate lookup handles all 3 types — flat rate and per-family rates don't need age

### P0 - Critical Tech Debt
- Backend modularization: server.py (~6450 lines) needs splitting into /routes, /models, /services

### P1 - Upcoming
- Twilio SMS notifications for user workflows
- WhatsApp Business API for automated messages

### P2 - Future
- Resume/file upload on career applications
- Admin panel to view career applications
- About Us page content

### Twilio SMS + WhatsApp Notifications (DONE - Jun 2026)
- **Integration**: Twilio SDK. Credentials in backend/.env (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_NUMBER=+18775170579 toll-free, TWILIO_WHATSAPP_NUMBER=+917618740675, DEFAULT_COUNTRY_CODE=+91)
- **Helpers**: `normalize_phone` (E.164, defaults +91 for 10-digit), `send_sms_notification`, `send_whatsapp_notification` (async via asyncio.to_thread, best-effort), `get_scoped_admin_phones`
- **Auto notifications wired into**: endorsement submission (→ scoped admins), approval/rejection (→ submitting HR), new user registration (welcome → new user). Reuses AI-generated whatsapp_message when available, else concise fallback.
- **Test endpoint**: POST /api/notifications/test-sms (Admin only) — sends real SMS/WhatsApp, returns per-channel status+SID. UI: "SMS & WhatsApp Notifications" test card on Email Settings page.
- **Verified**: real send to +919886260579 returned SIDs for both channels; HR gets 403.

### Twilio Toll-Free Opt-In Consent + QR (DONE - Jun 2026)
- **Public opt-in lead form**: /sms-optin page (Name, Phone, Company, Channel, consent checkbox with Twilio-compliant text). POST /api/sms-optin stores to `sms_optins` collection + sends double opt-in confirmation message. Consent required (400 if unchecked).
- **Landing page QR**: terracotta band with QRCodeCanvas encoding {origin}/sms-optin, "Opt in now" button, and SMS & Calling number +1 (877) 517-0579 displayed.
- **Post-login consent toggle**: SMS & WhatsApp updates toggle in UserProfileMenu → POST /api/auth/sms-consent. `sms_consent`/`sms_consent_at` stored on user; returned in login + /auth/me.
- **Admin view**: GET /api/sms-optins lists opt-in leads (Admin only) — proof of consent for Twilio verification.
- **Consent text**: "I agree to receive service updates, endorsement notifications, and occasional offerings from InsureHub (Aarogya Innovate Pvt Ltd) via SMS and WhatsApp at the number provided. Message & data rates may apply. Message frequency varies. Reply STOP to unsubscribe, HELP for help."

### Rate Card Auto-Fill Bug Fix (DONE - Jun 2026)
- **Bug**: POST /api/endorsements (single submit) never looked up rate cards — always used policy blended rate. Bulk-import path wrongly nested rater lookup inside `if age is not None`, skipping flat_rate/per_family raters for age-less rows.
- **Fix**: Extracted shared helper `resolve_per_life_from_rater(policy_number, age)`. Now used in all 3 endorsement paths (single POST, Excel import, employee-directory bulk). flat_rate/per_family resolve without age; age_band matches by age. Only applies when per_life_premium not explicitly provided.
- **Verified**: flat_rate=9999 rater → single POST returns per_life=9999 (was 6338 policy fallback).

### DB Indexes (DONE - Jun 2026)
- Startup hook `ensure_indexes`: cd_ledger (policy_number ASC, date DESC), endorsements (policy_number ASC, status ASC).

### Cloud Storage — HR + Policy Filter & Columns (DONE - Jun 2026)- **Bug**: Admin Cloud Storage showed the Assigned HR only on the E-Cards tab, never showed the Policy, and had no "Filter by HR" — so HR/policy assignment details didn't populate.
- **Fix (backend)**: GET /api/documents now accepts `assigned_to_hr` query param (Admin only).
- **Fix (frontend, CloudStorage.js)**: added "Filter by HR" dropdown; Assigned HR + Policy columns now render on ALL category tabs (admin); search now matches policy_number too.
- **Verified**: filter by HR → 4 docs, by policy → 2, no filter → 8; columns render.

### Bulk Re-tag Documents + Webhook URL + WhatsApp Templates (DONE - Jun 2026)
- **Bulk Tag (Re-tag Old Files)**: POST /api/documents/bulk-tag (Admin) sets assigned_to_hr and/or policy_number on selected docs ("none" clears). UI: "Tag HR / Policy" button in Cloud Storage bulk bar → dialog with HR + Policy selects ("— Don't change —" default). Verified via curl (policy set while HR preserved, then cleared) + screenshot.
- **Webhook URL in-app**: Email Settings SMS card shows the copyable Twilio inbound webhook URL ({BACKEND_URL}/api/twilio/inbound) with a Copy button + STOP/HELP setup note.
- **WhatsApp templates**: `send_whatsapp_template(to, content_sid, variables, fallback_body)` sends via approved template Content SID with numbered variables; falls back to free-form if SID unset. Env: TWILIO_WA_TEMPLATE_SUBMITTED, TWILIO_WA_TEMPLATE_STATUS (empty until approved). Wired into endorsement submit (→admins) and approve/reject (→HR). Template copy to submit: /app/memory/whatsapp_templates.md.
- **Inbound webhook**: POST /api/twilio/inbound (public, returns TwiML). Handles STOP/STOPALL/UNSUBSCRIBE/CANCEL/END/QUIT → adds to `sms_suppressions`, sets sms_consent=false on matching users/opt-ins, replies unsubscribe confirmation. HELP/INFO → help reply. START/YES/UNSTOP → removes suppression, replies resubscribe confirmation.
- **Suppression enforcement**: `is_suppressed()` checked in send_sms_notification and send_whatsapp_notification — opted-out numbers are silently skipped.
- **Admin view**: GET /api/sms-suppressions lists opted-out numbers (Admin only).
- **SETUP REQUIRED**: In Twilio Console, set the number's "A message comes in" webhook to {BACKEND_URL}/api/twilio/inbound (preview: https://insurehub-portal.preview.emergentagent.com/api/twilio/inbound ; prod after deploy: https://endorsement-ai.emergent.host/api/twilio/inbound). US toll-free also auto-handles STOP at carrier level by default.
