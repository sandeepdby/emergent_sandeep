# InsureHub - Endorsement Management Portal PRD

## Overview
InsureHub is a comprehensive endorsement management portal for insurance companies. It allows HR users to submit endorsements (additions, deletions, corrections) for policy members, and Admin users to approve or reject these endorsements.

## Core Features

### Authentication System
- JWT-based authentication with "HR" and "Admin" roles
- Registration and login functionality
- Role-based access control
- Phone number field for users (for WhatsApp notifications)

### HR Portal
- Submit individual endorsements with all member details
- Import endorsements in bulk via Excel file upload
- View and manage submitted endorsements
- Download Excel template for bulk imports
- **WhatsApp notification dialog** after submission to notify Admins

### Admin Portal  
- Review pending endorsements
- Approve or reject endorsements with remarks
- Manage policies (CRUD operations)
- Download approved endorsements as Excel report
- Email Settings for Gmail SMTP configuration
- **WhatsApp notification dialog** after approval/rejection to notify HR

### Email Notifications (SMTP - Gmail App Password)
- **SMTP Configured**: connect@aarogya-assist.com
- **Welcome Email**: Sent to new users upon registration
- **Notification Email**: Sent to all existing HR/Admin users when new user registers
- **Endorsement Submission Email**: Sent to all Admins when HR submits new endorsement
- **Approval/Rejection Email**: Sent to HR who submitted when Admin approves/rejects
- **Custom Email**: Admin can send emails with Excel/PDF attachments

### WhatsApp Web Notifications
- **WhatsApp Web Links**: Using wa.me format (click-to-open)
- **HR Submission**: After submitting endorsement, HR sees dialog with WhatsApp links to notify all Admin users
- **Admin Approval/Rejection**: After processing, Admin sees dialog with WhatsApp link to notify the HR who submitted
- **Pre-filled Messages**: Links include formatted message with endorsement details
- **Dual Notification**: Email sent automatically + WhatsApp link for manual sending

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
- smtplib for email sending via Gmail SMTP
- Background tasks for async email notifications

### Frontend (React)
- `/app/frontend/src/` - React application
- ShadCN UI components
- Role-based routing and dashboards
- Axios for API calls
- Sonner for toast notifications
- WhatsApp Web link generation (wa.me format)

### Database Collections
- **users**: username, password_hash, role, full_name, email, phone
- **policies**: policy_number, policy_holder_name, inception_date, expiry_date, policy_type, annual_premium_per_life, status
- **endorsements**: All member details, policy reference, premium calculations, approval status

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user (sends notifications)
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user info

### User Notifications
- `GET /api/users/admins` - Get all admin users for notifications
- `GET /api/users/hr` - Get all HR users (Admin only)
- `GET /api/users/{user_id}/contact` - Get user contact info

### Policies (Admin only)
- `GET /api/policies` - List all policies
- `POST /api/policies` - Create policy
- `PUT /api/policies/{id}` - Update policy
- `DELETE /api/policies/{id}` - Delete policy

### Endorsements
- `GET /api/endorsements` - List endorsements (filtered by role)
- `POST /api/endorsements` - Create endorsement (sends email to Admins)
- `PUT /api/endorsements/{id}` - Update endorsement
- `DELETE /api/endorsements/{id}` - Delete endorsement
- `POST /api/endorsements/{id}/approve` - Approve/reject (sends email to HR)
- `POST /api/endorsements/import` - Import from Excel
- `GET /api/endorsements/download/approved` - Download approved as Excel
- `GET /api/endorsements/template/download` - Download import template

### Email
- `GET /api/email/config` - Get SMTP configuration status
- `POST /api/email/config` - Update SMTP settings
- `POST /api/email/send` - Send custom email with attachments

## Completed Features (April 2026)

### Session 1 - SMTP Email Setup
- [x] Configured Gmail SMTP with App Password (connect@aarogya-assist.com)
- [x] Added phone number field to user model and registration form
- [x] Welcome email sent to new users upon registration
- [x] Notification email sent to all HR/Admin users when new user registers
- [x] Email settings page shows "Email configured" status
- [x] Custom email sending with Excel/PDF attachments working

### Session 2 - WhatsApp Web Notifications
- [x] WhatsApp Web link generation (wa.me format)
- [x] HR submission triggers email to all Admins + WhatsApp dialog
- [x] Admin approval/rejection triggers email to HR + WhatsApp dialog
- [x] Pre-filled WhatsApp messages with endorsement details
- [x] Added /api/users/admins endpoint for HR to get admin contacts
- [x] Added /api/users/{id}/contact endpoint for Admin to get HR contact
- [x] Notification dialogs show email sent confirmation + WhatsApp buttons

### Session 3 - AI-Generated Notification Content
- [x] Integrated GPT-4o-mini via Emergent LLM Key for notification generation
- [x] AI generates personalized email subjects and HTML bodies
- [x] AI generates WhatsApp messages with emojis and formatting
- [x] Added /api/notifications/generate endpoint for on-demand AI generation
- [x] Fallback to static templates if AI fails
- [x] Frontend shows "AI Email Sent" badge after actions
- [x] Professional, warm, and contextual notification content

### Session 4 - Landing Page
- [x] Created beautiful landing page with Swiss/High-Contrast design
- [x] Hero section: "Health Endorsement Made Intelligent" with AI badge
- [x] Features bento grid: Member Additions, Deletions, Corrections, Real-time Sync
- [x] AI & Notifications section: WhatsApp Integration, Smart Email Alerts
- [x] Testimonials from HR professionals
- [x] Dark footer with CTA
- [x] Smooth scroll navigation
- [x] Framer Motion animations
- [x] Responsive design

## Test Credentials
- **Admin User**: admin / admin123
- **HR User**: hruser1 / hr123456

## SMTP Configuration
- **Server**: smtp.gmail.com
- **Port**: 587
- **Username**: connect@aarogya-assist.com
- **Password**: (Gmail App Password configured in backend .env)

## Backlog / Future Enhancements
- [ ] SMS notifications using Twilio (phone numbers already captured)
- [ ] Audit log for all user actions
- [ ] Multi-policy comparison view
- [ ] Export templates for different insurers
- [ ] Push notifications for mobile
- [ ] WhatsApp Business API integration for automated messages
