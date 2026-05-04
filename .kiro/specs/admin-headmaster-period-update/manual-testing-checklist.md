# Manual Testing Checklist: Admin Headmaster Period Update

## Test Environment Setup

Before starting manual testing, ensure:
- [ ] Backend server is running (`php artisan serve` or `composer run dev`)
- [ ] Frontend dev server is running (`npm run dev`)
- [ ] Database is seeded with test data
- [ ] You have test accounts for all three roles:
  - Super Admin
  - Admin Yayasan  
  - Operator

## Automated Tests Status

✅ **All automated tests passing** (10/10 tests)
- Backend integration tests: 9/9 passed
- Backend authorization tests: 1/1 passed

---

## Manual Test Cases

### 1. Role-Based Access Control

#### 1.1 Super Admin Access
- [ ] Login as super_admin
- [ ] Navigate to `/dashboard/admin/schools` (or find "Kelola Sekolah" in menu)
- [ ] **Expected**: Can access the school management page
- [ ] **Expected**: See list of all schools in the system
- [ ] **Expected**: "Kelola Sekolah" menu item is visible

#### 1.2 Admin Yayasan Access
- [ ] Login as admin_yayasan
- [ ] Navigate to `/dashboard/admin/schools`
- [ ] **Expected**: Can access the school management page
- [ ] **Expected**: See list of all schools in the system
- [ ] **Expected**: "Kelola Sekolah" menu item is visible

#### 1.3 Operator Access Restriction
- [ ] Login as operator
- [ ] Check navigation menu
- [ ] **Expected**: "Kelola Sekolah" menu item is NOT visible
- [ ] Try to manually navigate to `/dashboard/admin/schools`
- [ ] **Expected**: Redirected or see "Access Denied" message
- [ ] **Expected**: Operator can only see their own school profile at `/dashboard/schools/profile`

---

### 2. School List Display

#### 2.1 School List Rendering
- [ ] Login as super_admin or admin_yayasan
- [ ] Navigate to school management page
- [ ] **Expected**: See paginated list of schools
- [ ] **Expected**: Each school shows:
  - School name (nama)
  - Kecamatan
  - Current headmaster name (kepala_madrasah)
  - Tenure start date (kepala_jabatan_mulai)
  - Tenure end date (kepala_jabatan_selesai)

#### 2.2 Search Functionality
- [ ] Type a school name in the search box
- [ ] **Expected**: List filters to show only matching schools
- [ ] **Expected**: Search is debounced (doesn't search on every keystroke)
- [ ] Clear the search
- [ ] **Expected**: Full list returns

#### 2.3 Kecamatan Filter
- [ ] Select a kecamatan from the dropdown filter
- [ ] **Expected**: List filters to show only schools in that kecamatan
- [ ] Clear the filter
- [ ] **Expected**: Full list returns

#### 2.4 Pagination
- [ ] If there are more than 15 schools, check pagination controls
- [ ] **Expected**: Can navigate between pages
- [ ] **Expected**: Page number updates correctly

---

### 3. Headmaster Profile Form

#### 3.1 Form Display
- [ ] Click on a school from the list
- [ ] **Expected**: Headmaster profile edit form appears
- [ ] **Expected**: Form shows all fields:
  - Nama Kepala Madrasah (kepala_madrasah)
  - NIM (kepala_nim)
  - NUPTK (kepala_nuptk)
  - WhatsApp (kepala_whatsapp)
  - Tanggal Mulai Jabatan (kepala_jabatan_mulai)
  - Tanggal Selesai Jabatan (kepala_jabatan_selesai)
- [ ] **Expected**: Fields are pre-filled with current data

#### 3.2 Date Picker Functionality
- [ ] Click on the "Tanggal Mulai Jabatan" field
- [ ] **Expected**: Date picker opens
- [ ] Select a date
- [ ] **Expected**: Date is populated in the field
- [ ] Repeat for "Tanggal Selesai Jabatan"
- [ ] **Expected**: Date picker works correctly

---

### 4. Form Validation

#### 4.1 Client-Side Validation - Invalid Date Range
- [ ] Fill in "Tanggal Mulai Jabatan": `2024-12-31`
- [ ] Fill in "Tanggal Selesai Jabatan": `2020-01-01` (earlier than start date)
- [ ] Click "Simpan" or "Update"
- [ ] **Expected**: Inline error message appears
- [ ] **Expected**: Error message says end date must be after or equal to start date
- [ ] **Expected**: Form is not submitted

#### 4.2 Client-Side Validation - String Length
- [ ] Try to enter more than 255 characters in "Nama Kepala Madrasah"
- [ ] **Expected**: Field limits input or shows validation error
- [ ] Try to enter more than 50 characters in "NIM"
- [ ] **Expected**: Field limits input or shows validation error

#### 4.3 Server-Side Validation
- [ ] Use browser dev tools to bypass client validation
- [ ] Submit invalid data (e.g., end date before start date)
- [ ] **Expected**: Server returns 422 validation error
- [ ] **Expected**: Inline error messages display next to fields
- [ ] **Expected**: Form is not submitted

---

### 5. Form Submission

#### 5.1 Successful Update
- [ ] Fill in valid data for all headmaster fields
- [ ] Click "Simpan" or "Update"
- [ ] **Expected**: Loading spinner appears
- [ ] **Expected**: Submit button is disabled during submission
- [ ] **Expected**: Success toast notification appears
- [ ] **Expected**: Toast message: "Data sekolah berhasil diperbarui" or similar
- [ ] **Expected**: Form closes or returns to list view
- [ ] **Expected**: School list refreshes with updated data

#### 5.2 Partial Update
- [ ] Open a school's headmaster profile form
- [ ] Change only one field (e.g., "Nama Kepala Madrasah")
- [ ] Leave other fields unchanged
- [ ] Submit the form
- [ ] **Expected**: Only the changed field is updated
- [ ] **Expected**: Other fields remain unchanged
- [ ] **Expected**: Success notification appears

#### 5.3 Cancel Button
- [ ] Open a school's headmaster profile form
- [ ] Make some changes to the fields
- [ ] Click "Batal" or "Cancel"
- [ ] **Expected**: Form closes without saving
- [ ] **Expected**: Changes are discarded
- [ ] **Expected**: Returns to school list view

---

### 6. Loading States

#### 6.1 Initial Data Load
- [ ] Navigate to school management page
- [ ] **Expected**: Loading spinner or skeleton UI appears while fetching schools
- [ ] **Expected**: Loading state disappears when data loads

#### 6.2 Form Submission Loading
- [ ] Submit a headmaster profile update
- [ ] **Expected**: Loading spinner appears on submit button
- [ ] **Expected**: Submit button is disabled
- [ ] **Expected**: User cannot click submit multiple times

#### 6.3 School Selection Loading
- [ ] Click on a school to edit
- [ ] **Expected**: Loading indicator appears while fetching school details
- [ ] **Expected**: Form appears when data is loaded

---

### 7. Error Handling

#### 7.1 Network Error
- [ ] Disconnect from network or stop backend server
- [ ] Try to submit a form update
- [ ] **Expected**: Error message appears
- [ ] **Expected**: Error message mentions network or connection issue
- [ ] **Expected**: Option to retry is available

#### 7.2 Authorization Error (403)
- [ ] As operator, try to access another school's profile (if possible via URL manipulation)
- [ ] **Expected**: 403 Forbidden error
- [ ] **Expected**: Error message: "Anda tidak memiliki akses untuk mengubah data sekolah ini"

#### 7.3 Validation Error (422)
- [ ] Submit invalid data (tested in section 4.3)
- [ ] **Expected**: Inline validation errors display
- [ ] **Expected**: User can correct errors and resubmit

---

### 8. Activity Logging

#### 8.1 Activity Log Creation
- [ ] Login as super_admin
- [ ] Update a school's headmaster profile
- [ ] Navigate to activity logs (if accessible in admin panel)
- [ ] **Expected**: New activity log entry created
- [ ] **Expected**: Log shows:
  - Description: "Memperbarui data sekolah: {school_name}"
  - Event: "update_school"
  - Causer: Your user ID
  - School ID: The updated school's ID
  - Timestamp: Current time

#### 8.2 Multiple Updates Create Multiple Logs
- [ ] Update the same school's headmaster profile 3 times
- [ ] Check activity logs
- [ ] **Expected**: 3 separate log entries created
- [ ] **Expected**: Each log has correct timestamp and causer

---

### 9. Data Consistency

#### 9.1 Immediate UI Refresh
- [ ] Update a school's headmaster profile
- [ ] **Expected**: School list immediately shows updated data
- [ ] **Expected**: No need to manually refresh the page

#### 9.2 Data Persistence
- [ ] Update a school's headmaster profile
- [ ] Refresh the browser page
- [ ] **Expected**: Updated data persists
- [ ] **Expected**: Changes are saved in the database

#### 9.3 Concurrent Updates
- [ ] Open the same school in two browser tabs
- [ ] Update different fields in each tab
- [ ] Submit both forms
- [ ] **Expected**: Last update wins (or optimistic locking prevents conflict)
- [ ] **Expected**: No data corruption

---

### 10. Cross-Browser Testing

#### 10.1 Chrome/Edge
- [ ] Test all functionality in Chrome or Edge
- [ ] **Expected**: All features work correctly

#### 10.2 Firefox
- [ ] Test all functionality in Firefox
- [ ] **Expected**: All features work correctly

#### 10.3 Safari (if available)
- [ ] Test all functionality in Safari
- [ ] **Expected**: All features work correctly

---

### 11. Mobile Responsiveness

#### 11.1 Mobile View
- [ ] Open the school management page on a mobile device or use browser dev tools
- [ ] **Expected**: Layout adapts to mobile screen size
- [ ] **Expected**: All buttons and inputs are accessible
- [ ] **Expected**: Form is usable on mobile

#### 11.2 Tablet View
- [ ] Test on tablet or tablet-sized browser window
- [ ] **Expected**: Layout works well on tablet
- [ ] **Expected**: All functionality is accessible

---

## Test Results Summary

### Automated Tests
- ✅ Backend Integration Tests: **10/10 passed**
- ✅ Backend Authorization Tests: **1/1 passed**
- ⏳ Frontend Unit Tests: **Pending manual verification**
- ⏳ E2E Tests (Playwright): **Pending manual verification**

### Manual Tests
- ⏳ Role-Based Access Control: **Pending**
- ⏳ School List Display: **Pending**
- ⏳ Headmaster Profile Form: **Pending**
- ⏳ Form Validation: **Pending**
- ⏳ Form Submission: **Pending**
- ⏳ Loading States: **Pending**
- ⏳ Error Handling: **Pending**
- ⏳ Activity Logging: **Pending**
- ⏳ Data Consistency: **Pending**
- ⏳ Cross-Browser Testing: **Pending**
- ⏳ Mobile Responsiveness: **Pending**

---

## Issues Found

Document any issues found during manual testing:

| Issue # | Description | Severity | Status |
|---------|-------------|----------|--------|
| | | | |

---

## Sign-Off

- [ ] All automated tests passing
- [ ] All manual test cases completed
- [ ] No critical issues found
- [ ] Feature ready for production deployment

**Tested By**: ___________________  
**Date**: ___________________  
**Signature**: ___________________
