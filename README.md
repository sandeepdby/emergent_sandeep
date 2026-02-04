# InsureHub - Complete Endorsement Portal with Approval Workflow

## 🎯 Project Overview
A comprehensive insurance endorsement management system with HR and Admin portals, featuring Excel import/export, automated pro-rata premium calculations, and approval workflows.

## ✅ Complete Features Implemented

### 1. **Authentication System**
- JWT-based authentication
- Two user roles: HR and Admin
- Secure login/logout
- Role-based access control

### 2. **HR Portal Features**
- **Submit Endorsements**: Add, delete, or correct member coverage
  - Policy selection
  - Member details entry
  - Relationship types: Employee, Spouse, Kids, Mother, Father
  - Endorsement types: Addition, Deletion, Correction
  - Pro-rata premium auto-calculation
  
- **My Endorsements**: View all submitted endorsements
  - Filter by status (Pending/Approved/Rejected)
  - Filter by relationship type
  - Real-time statistics dashboard
  - Delete pending endorsements
  
- **Excel Import**: Bulk upload endorsements
  - Drag-and-drop interface
  - Support for .xlsx and .xls formats
  - Comprehensive error reporting
  - Download template

### 3. **Admin Portal Features**
- **Pending Approvals**: Review and process endorsement requests
  - Approve/Reject with remarks
  - View all endorsement details
  - Pro-rata premium visibility
  
- **All Endorsements**: View complete endorsement history
  - Advanced filtering
  - Status tracking
  - Statistics dashboard
  - Edit and delete capabilities
  
- **Policy Management**: Create and manage insurance policies
  - Policy CRUD operations
  - Automatic lives covered tracking
  - Policy status management
  
- **Download Approved**: Export approved endorsements
  - Filter by policy
  - Excel format (.xlsx)
  - Ready for insurer/client sharing

### 4. **Automated Pro-rata Premium Calculation**
**Formula:**
```
Pro-rata Premium = (Annual Premium × Remaining Days) / Total Policy Days

Where:
- Total Policy Days = Expiry Date - Inception Date
- Days from Inception = Endorsement Date - Inception Date
- Remaining Days = Expiry Date - Endorsement Date
```

**Real-world Example:**
- Policy: Jan 1, 2025 - Dec 31, 2025 (364 days)
- Annual Premium: ₹5,000
- Endorsement Date: Feb 1, 2025
- Remaining Days: 333
- **Pro-rata Premium: ₹4,574.18**

### 5. **Approval Workflow**
1. HR submits endorsement → Status: **Pending**
2. Admin reviews → Approve/Reject with remarks
3. If Approved → Status: **Approved** (updates policy lives covered)
4. If Rejected → Status: **Rejected**
5. Approved endorsements → Available for Excel download

## 📁 Complete Source Code Structure

```
/app/
├── backend/
│   ├── server.py                 # Complete FastAPI backend with authentication
│   ├── requirements.txt          # Python dependencies
│   └── .env                      # Backend configuration
│
├── frontend/
│   ├── src/
│   │   ├── App.js               # Main application with routing
│   │   ├── App.css              # Global styles
│   │   ├── auth.js              # Authentication context
│   │   ├── pages/
│   │   │   ├── LoginPage.js            # Login interface
│   │   │   ├── HRDashboard.js          # HR portal layout
│   │   │   ├── SubmitEndorsement.js    # HR: Submit form
│   │   │   ├── MyEndorsements.js       # HR: View my submissions
│   │   │   ├── ImportEndorsements.js   # HR: Excel import
│   │   │   ├── AdminDashboard.js       # Admin portal layout
│   │   │   ├── ApproveEndorsements.js  # Admin: Approval queue
│   │   │   ├── AllEndorsements.js      # Admin: All endorsements view
│   │   │   ├── PoliciesManagement.js   # Admin: Policy management
│   │   │   └── DownloadApproved.js     # Admin: Export approved
│   │   └── components/
│   │       └── ui/                      # ShadCN UI components
│   ├── package.json              # Node dependencies
│   ├── tailwind.config.js        # Tailwind configuration
│   └── .env                      # Frontend configuration
│
└── README.md                     # This documentation
```

## 🔑 Demo Credentials

### HR User
- **Username**: hr@test.com
- **Password**: password123
- **Access**: Submit endorsements, view own submissions, import Excel

### Admin User
- **Username**: admin@test.com
- **Password**: password123
- **Access**: Approve/reject endorsements, manage policies, download approved endorsements

## 🚀 API Endpoints

### Authentication
```
POST /api/auth/login           # Login and get JWT token
POST /api/auth/register        # Register new user
GET  /api/auth/me             # Get current user info
```

### Policies (Admin)
```
GET    /api/policies          # Get all policies
POST   /api/policies          # Create new policy
GET    /api/policies/{id}     # Get specific policy
PUT    /api/policies/{id}     # Update policy
DELETE /api/policies/{id}     # Delete policy
```

### Endorsements
```
GET    /api/endorsements                      # Get endorsements (HR sees own, Admin sees all)
POST   /api/endorsements                      # Submit new endorsement (HR)
GET    /api/endorsements/{id}                 # Get specific endorsement
PUT    /api/endorsements/{id}                 # Update endorsement
DELETE /api/endorsements/{id}                 # Delete endorsement
POST   /api/endorsements/{id}/approve         # Approve/Reject (Admin)
GET    /api/endorsements/stats/summary        # Get statistics
```

### Import/Export
```
POST /api/endorsements/import                  # Import from Excel (HR)
GET  /api/endorsements/download/approved       # Download approved as Excel (Admin)
```

## 📊 Excel Import Format

### Required Columns:
1. **Policy Number** - Must exist in database
2. **Member Name** - Full name of member
3. **Relationship Type** - Employee, Spouse, Kids, Mother, or Father
4. **Endorsement Type** - Addition, Deletion, or Correction
5. **Endorsement Date** - When endorsement received (YYYY-MM-DD or DD/MM/YYYY)
6. **Effective Date** - (Optional) Defaults to Endorsement Date

### Sample Excel Data:
```
Policy Number | Member Name | Relationship Type | Endorsement Type | Endorsement Date | Effective Date
POL001        | John Doe    | Employee         | Addition         | 2025-02-01       | 2025-02-01
POL001        | Jane Doe    | Spouse           | Addition         | 2025-02-01       | 2025-02-01
POL001        | Jack Doe    | Kids             | Addition         | 2025-02-05       | 2025-02-05
```

## 💾 Database Schema

### Users Collection
```javascript
{
  id: UUID,
  username: String (unique),
  password_hash: String (bcrypt),
  full_name: String,
  email: String,
  role: Enum (HR/Admin),
  created_at: DateTime
}
```

### Policies Collection
```javascript
{
  id: UUID,
  policy_number: String (unique),
  policy_holder_name: String,
  inception_date: String (YYYY-MM-DD),
  expiry_date: String (YYYY-MM-DD),
  annual_premium_per_life: Float,
  total_lives_covered: Integer,
  status: Enum (Active/Expired/Cancelled),
  created_at: DateTime
}
```

### Endorsements Collection
```javascript
{
  id: UUID,
  policy_id: UUID (reference),
  policy_number: String,
  member_name: String,
  relationship_type: Enum (Employee/Spouse/Kids/Mother/Father),
  endorsement_type: Enum (Addition/Deletion/Correction),
  endorsement_date: String (YYYY-MM-DD),
  effective_date: String (YYYY-MM-DD),
  days_from_inception: Integer,
  days_in_policy_year: Integer,
  remaining_days: Integer,
  prorata_premium: Float,
  status: Enum (Pending/Approved/Rejected),
  submitted_by: UUID (user_id),
  approved_by: UUID (user_id, optional),
  approval_date: String (optional),
  remarks: String (optional),
  import_batch_id: UUID (optional),
  created_at: DateTime
}
```

## 🔧 Technology Stack

### Backend
- **Framework**: FastAPI
- **Database**: MongoDB (Motor async driver)
- **Authentication**: JWT (PyJWT) + Bcrypt
- **Excel Processing**: pandas, openpyxl, xlrd
- **CORS**: Enabled for frontend

### Frontend
- **Framework**: React 19
- **UI Library**: ShadCN UI (Radix UI primitives)
- **Styling**: Tailwind CSS
- **Routing**: React Router v7
- **HTTP Client**: Axios
- **Notifications**: Sonner (Toast)
- **Icons**: Lucide React
- **Forms**: Controlled components

## 📝 User Workflows

### HR Workflow
1. Login with HR credentials
2. Submit individual endorsements OR bulk import via Excel
3. View submitted endorsements with status
4. Track pending/approved/rejected counts
5. Delete pending endorsements if needed
6. Wait for admin approval

### Admin Workflow
1. Login with Admin credentials
2. View pending endorsements queue
3. Review each endorsement with all details
4. Approve or reject with remarks
5. View all endorsements across HR users
6. Manage policies (create/edit/delete)
7. Download approved endorsements as Excel
8. Share Excel with insurers and client HR

## 🧪 Testing

### Backend API Testing
```bash
# Login as HR
curl -X POST "https://endorsehub.preview.emergentagent.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "hr@test.com", "password": "password123"}'

# Get policies (with JWT token)
curl -X GET "https://endorsehub.preview.emergentagent.com/api/policies" \
  -H "Authorization: Bearer {YOUR_TOKEN}"

# Submit endorsement
curl -X POST "https://endorsehub.preview.emergentagent.com/api/endorsements" \
  -H "Authorization: Bearer {YOUR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "policy_number": "POL001",
    "member_name": "John Doe",
    "relationship_type": "Employee",
    "endorsement_type": "Addition",
    "endorsement_date": "2025-02-01"
  }'
```

### Frontend Testing
1. Open: https://endorsehub.preview.emergentagent.com
2. Login as HR (hr@test.com / password123)
3. Submit an endorsement
4. Import Excel file
5. Logout and login as Admin (admin@test.com / password123)
6. Approve the endorsement
7. Download approved endorsements

## 🔐 Security Features
- JWT-based authentication with secure tokens
- Bcrypt password hashing
- Role-based access control (RBAC)
- Protected routes on frontend
- Authorization middleware on backend
- CORS configuration for allowed origins

## 📈 Pro-rata Calculation Examples

**Policy Details:**
- Policy: POL001 (Test Company Ltd)
- Period: Jan 1, 2025 - Dec 31, 2025
- Days: 364
- Annual Premium: ₹5,000

**Endorsement Scenarios:**

| Endorsement Date | Days from Start | Remaining Days | Pro-rata Premium |
|-----------------|----------------|----------------|------------------|
| Feb 1, 2025     | 31             | 333            | ₹4,574.18       |
| Feb 15, 2025    | 45             | 319            | ₹4,381.87       |
| Mar 1, 2025     | 59             | 305            | ₹4,189.56       |
| Jun 1, 2025     | 151            | 213            | ₹2,927.47       |
| Sep 1, 2025     | 243            | 121            | ₹1,661.54       |

## 🎨 UI Features
- Clean, modern design with Tailwind CSS
- Responsive layout for desktop and tablet
- Color-coded badges for status and relationships
- Real-time statistics dashboards
- Toast notifications for user feedback
- Loading states for async operations
- Drag-and-drop file upload
- Modal dialogs for forms and confirmations

## 🚦 Status Indicators

### Endorsement Status Colors
- **Pending**: Yellow (⏳ Awaiting approval)
- **Approved**: Green (✅ Processed)
- **Rejected**: Red (❌ Denied)

### Relationship Type Colors
- **Employee**: Blue
- **Spouse**: Pink
- **Kids**: Green
- **Mother**: Purple
- **Father**: Orange

## 📦 Deployment

### Current Deployment
- **Preview URL**: https://endorsehub.preview.emergentagent.com
- **Target Domain**: insurehub.aarogya-assist.com (to be linked)

### Deployment Steps for Custom Domain
1. Deploy application from Emergent dashboard
2. Link custom domain: insurehub.aarogya-assist.com
3. Configure DNS settings with your domain provider
4. Wait for DNS propagation (5-15 minutes)

## 🔄 Data Flow

### Endorsement Submission Flow
```
HR User → Submit Form → Backend API → MongoDB (Status: Pending)
                                    ↓
                            Pro-rata Calculation
                                    ↓
                         Email Notification (Future)
                                    ↓
                            Admin Review Queue
                                    ↓
                    Admin Approve/Reject → Update Status
                                    ↓
                          Policy Lives Updated
                                    ↓
                      Available for Download (if Approved)
```

### Excel Import Flow
```
HR User → Upload Excel → Backend Parse → Validate Rows
                                        ↓
                              Check Policy Exists
                                        ↓
                            Calculate Pro-rata Premium
                                        ↓
                    Create Endorsements (Status: Pending)
                                        ↓
                        Return Import Results
                                        ↓
                          HR Reviews Errors
```

## 🎯 Key Business Benefits

1. **Efficiency**: Bulk import saves time vs manual entry
2. **Accuracy**: Automated pro-rata calculations eliminate errors
3. **Compliance**: Approval workflow ensures proper authorization
4. **Audit Trail**: Complete history of submissions and approvals
5. **Integration Ready**: Excel export for insurer systems
6. **Scalability**: Handles multiple policies and large volumes

## 📋 Future Enhancement Ideas

1. Email notifications for approvals/rejections
2. Document upload (ID proofs, forms)
3. Advanced reporting and analytics
4. Policy renewal automation
5. Integration with insurer APIs
6. Mobile app for HR on-the-go
7. Bulk approval capabilities
8. Custom approval workflows
9. Multi-level approvals
10. Dashboard charts and graphs

## 🆘 Support

For issues or questions:
- Email: support@emergent.sh
- Discord: https://discord.gg/VzKfwCXC4A

## 📄 License

Proprietary - Aarogya Assist / InsureHub

---

**Built with ❤️ using Emergent AI Agent**

*Last Updated: February 2025*
