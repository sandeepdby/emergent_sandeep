# InsureHub - Endorsement Management System

## Overview
Complete insurance endorsement management system with Excel import functionality and automated pro-rata premium calculations.

## Features Implemented

### 1. **Policy Management**
- Create, view, edit, and delete insurance policies
- Track policy inception and expiry dates
- Configure annual premium per life
- Auto-update total lives covered
- Policy status management (Active/Expired/Cancelled)

### 2. **Endorsement Management**
- View all endorsements with filtering capabilities
- Edit endorsement details
- Delete endorsements
- Filter by policy number and relationship type
- Real-time statistics dashboard

### 3. **Excel Import**
- Drag-and-drop file upload interface
- Support for .xlsx and .xls formats
- Bulk import of endorsements
- Comprehensive error reporting
- Download import results as Excel

### 4. **Automated Pro-rata Premium Calculation**
The system automatically calculates pro-rata premiums based on:
- Policy inception date
- Policy expiry date
- Endorsement received date
- Annual premium per life

**Formula:**
```
Pro-rata Premium = (Annual Premium × Remaining Days) / Total Policy Days

Where:
- Total Policy Days = Expiry Date - Inception Date
- Days from Inception = Endorsement Date - Inception Date
- Remaining Days = Expiry Date - Endorsement Date
```

### 5. **Relationship Types Supported**
- Employee
- Spouse
- Kids
- Mother
- Father

### 6. **Endorsement Types Supported**
- Addition (increases total lives covered)
- Deletion (decreases total lives covered)
- Modification

## Excel Import Format

### Required Columns:
1. **Policy Number** - Must exist in the database
2. **Member Name** - Name of the member
3. **Relationship Type** - Employee, Spouse, Kids, Mother, or Father
4. **Endorsement Type** - Addition, Deletion, or Modification
5. **Endorsement Date** - When endorsement was received (YYYY-MM-DD or DD/MM/YYYY)
6. **Effective Date** - (Optional) Defaults to Endorsement Date

### Sample Excel Data:
```
| Policy Number | Member Name | Relationship Type | Endorsement Type | Endorsement Date | Effective Date |
|--------------|-------------|------------------|------------------|------------------|----------------|
| POL001       | John Doe    | Employee         | Addition         | 2025-02-01       | 2025-02-01     |
| POL001       | Jane Doe    | Spouse           | Addition         | 2025-02-01       | 2025-02-01     |
| POL001       | Jack Doe    | Kids             | Addition         | 2025-02-05       | 2025-02-05     |
```

## API Endpoints

### Policies
- `GET /api/policies` - Get all policies
- `POST /api/policies` - Create a new policy
- `GET /api/policies/{id}` - Get specific policy
- `PUT /api/policies/{id}` - Update policy
- `DELETE /api/policies/{id}` - Delete policy

### Endorsements
- `GET /api/endorsements` - Get all endorsements (with optional filters)
- `POST /api/endorsements` - Create an endorsement
- `GET /api/endorsements/{id}` - Get specific endorsement
- `PUT /api/endorsements/{id}` - Update endorsement
- `DELETE /api/endorsements/{id}` - Delete endorsement
- `GET /api/endorsements/stats/summary` - Get endorsement statistics

### Import
- `POST /api/endorsements/import` - Import endorsements from Excel
- `GET /api/endorsements/import/{batch_id}/results` - Download import results

## Technology Stack

### Backend
- **Framework:** FastAPI
- **Database:** MongoDB (Motor async driver)
- **Excel Processing:** pandas, openpyxl, xlrd
- **Authentication:** CORS enabled

### Frontend
- **Framework:** React 19
- **UI Components:** ShadCN UI (Radix UI)
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **HTTP Client:** Axios
- **Notifications:** Sonner (Toast)
- **Routing:** React Router v7

## Usage Guide

### 1. Create a Policy
1. Navigate to the "Policies" tab
2. Click "Add Policy" button
3. Fill in policy details:
   - Policy Number (must be unique)
   - Policy Holder Name
   - Inception Date
   - Expiry Date
   - Annual Premium Per Life
   - Status
4. Click "Create"

### 2. Import Endorsements
1. Navigate to the "Import Excel" tab
2. Download the template (optional)
3. Prepare your Excel file with required columns
4. Drag and drop the file or click to browse
5. Click "Import Endorsements"
6. View import results
7. Download results Excel if needed

### 3. View and Manage Endorsements
1. Navigate to the "Endorsements" tab
2. View statistics dashboard
3. Use filters to find specific endorsements
4. Edit or delete endorsements as needed

## Pro-rata Calculation Examples

**Example Policy:**
- Policy Number: POL001
- Inception: Jan 1, 2025
- Expiry: Dec 31, 2025
- Annual Premium: ₹5,000
- Total Days: 364 days

**Endorsement Examples:**

1. **Feb 1, 2025 (31 days from inception)**
   - Remaining Days: 333
   - Pro-rata Premium: (5000 × 333) / 364 = **₹4,574.18**

2. **Feb 15, 2025 (45 days from inception)**
   - Remaining Days: 319
   - Pro-rata Premium: (5000 × 319) / 364 = **₹4,381.87**

3. **Jun 1, 2025 (151 days from inception)**
   - Remaining Days: 213
   - Pro-rata Premium: (5000 × 213) / 364 = **₹2,927.47**

## Error Handling

### Import Errors
The system validates each row and reports errors for:
- Missing policy number
- Policy not found in database
- Invalid relationship type
- Invalid endorsement type
- Invalid date format
- Missing required fields

### Success Response
```json
{
  "success_count": 5,
  "error_count": 0,
  "total_rows": 5,
  "errors": [],
  "import_batch_id": "uuid"
}
```

### Error Response
```json
{
  "success_count": 3,
  "error_count": 2,
  "total_rows": 5,
  "errors": [
    {
      "row": 4,
      "error": "Policy POL999 not found"
    },
    {
      "row": 5,
      "error": "Invalid relationship type: Friend. Must be one of: Employee, Spouse, Kids, Mother, Father"
    }
  ],
  "import_batch_id": "uuid"
}
```

## Database Schema

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
  relationship_type: Enum,
  endorsement_type: Enum,
  endorsement_date: String (YYYY-MM-DD),
  effective_date: String (YYYY-MM-DD),
  days_from_inception: Integer,
  days_in_policy_year: Integer,
  remaining_days: Integer,
  prorata_premium: Float,
  import_batch_id: UUID (optional),
  created_at: DateTime
}
```

## Testing

### Sample Test Data Created:
- **Policy:** POL001 - Test Company Ltd
- **Endorsements:** 5 members (Employee, Spouse, Kids, Mother, Father)
- **Import Batch ID:** Available for download

### Test the APIs:
```bash
# Get all policies
curl https://excel-import-5.preview.emergentagent.com/api/policies

# Get all endorsements
curl https://excel-import-5.preview.emergentagent.com/api/endorsements

# Get statistics
curl https://excel-import-5.preview.emergentagent.com/api/endorsements/stats/summary
```

## Notes

- All endorsements are automatically linked to policies via `policy_id`
- Pro-rata premiums are calculated automatically based on the endorsement date
- Total lives covered is automatically updated when adding/deleting endorsements
- Import batch IDs allow tracking and downloading specific import results
- Date parsing supports multiple formats: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
- All monetary values are in Indian Rupees (₹)

## Future Enhancements (Potential)

1. Export endorsements to Excel
2. Bulk delete/edit endorsements
3. Email notifications on import completion
4. Advanced reporting and analytics
5. Policy renewal management
6. Claim tracking integration
7. User authentication and role-based access
8. Audit trail for all changes
9. Dashboard with charts and graphs
10. Mobile responsive improvements
