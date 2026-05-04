# Requirements Document

## Introduction

This feature enables super admin and admin yayasan users to view and update headmaster (kepala madrasah) profile information and tenure periods for any school in the system. Currently, only operators can update their own school's headmaster profile data through the manual profile route, while super admin/admin yayasan can only approve formal SK submissions. This creates a gap where administrative users cannot directly manage headmaster tenure data stored in the `schools` table.

The system maintains two data sources for headmaster information:
1. **Formal SK route** (`headmaster_tenures` table) - managed through SK approval workflow
2. **Manual profile route** (`schools` table) - currently only editable by operators for their own school

This feature addresses the gap by allowing super admin and admin yayasan to manage the manual profile route data for any school.

## Glossary

- **System**: The SIMMACI web application
- **Admin_User**: A user with role `super_admin` or `admin_yayasan`
- **Operator**: A user with role `operator`, scoped to their own school
- **Headmaster_Profile**: The set of fields in the `schools` table related to headmaster information (kepala_madrasah, kepala_nim, kepala_nuptk, kepala_whatsapp, kepala_jabatan_mulai, kepala_jabatan_selesai)
- **School_Profile_Page**: The existing React page at `/dashboard/schools/profile` used by operators
- **Admin_School_Management_Page**: A new or enhanced page for admin users to manage school headmaster profiles
- **Backend_API**: The Laravel API endpoint at `SchoolController`
- **Tenure_Period**: The start and end dates of a headmaster's service (kepala_jabatan_mulai, kepala_jabatan_selesai)

## Requirements

### Requirement 1: Admin User Authorization

**User Story:** As a super admin or admin yayasan, I want to access headmaster profile management for any school, so that I can maintain accurate tenure records across the network.

#### Acceptance Criteria

1. WHEN an Admin_User accesses the school management interface, THE System SHALL display a list of all schools with their current headmaster information
2. WHEN an Admin_User selects a school, THE System SHALL display the complete Headmaster_Profile for that school
3. WHEN an Operator accesses the school management interface, THE System SHALL display only their own school's information
4. THE Backend_API SHALL verify the user's role before allowing cross-school data access

### Requirement 2: Headmaster Profile Viewing

**User Story:** As an admin user, I want to view headmaster profile information for any school, so that I can review current tenure data before making updates.

#### Acceptance Criteria

1. WHEN an Admin_User views a school's profile, THE System SHALL display kepala_madrasah (name without title)
2. WHEN an Admin_User views a school's profile, THE System SHALL display kepala_nim (Nomor Induk Ma'arif)
3. WHEN an Admin_User views a school's profile, THE System SHALL display kepala_nuptk (NUPTK number)
4. WHEN an Admin_User views a school's profile, THE System SHALL display kepala_whatsapp (WhatsApp contact)
5. WHEN an Admin_User views a school's profile, THE System SHALL display kepala_jabatan_mulai (tenure start date)
6. WHEN an Admin_User views a school's profile, THE System SHALL display kepala_jabatan_selesai (tenure end date)
7. THE System SHALL display all fields in an editable form format

### Requirement 3: Headmaster Profile Editing

**User Story:** As an admin user, I want to edit headmaster profile information for any school, so that I can correct or update tenure records.

#### Acceptance Criteria

1. WHEN an Admin_User modifies any Headmaster_Profile field, THE System SHALL validate the input according to existing validation rules
2. WHEN an Admin_User submits valid changes, THE Backend_API SHALL update the corresponding school record in the database
3. WHEN an Admin_User submits changes with kepala_jabatan_mulai, THE System SHALL validate it is a valid date format
4. WHEN an Admin_User submits changes with kepala_jabatan_selesai, THE System SHALL validate it is a valid date format
5. IF kepala_jabatan_selesai is provided and kepala_jabatan_mulai is provided, THEN THE System SHALL validate that kepala_jabatan_selesai is after kepala_jabatan_mulai
6. WHEN the update succeeds, THE System SHALL display a success notification to the user
7. WHEN the update fails, THE System SHALL display an error message with details

### Requirement 4: Activity Logging

**User Story:** As a system administrator, I want all headmaster profile updates to be logged, so that I can audit changes and maintain accountability.

#### Acceptance Criteria

1. WHEN an Admin_User updates a Headmaster_Profile, THE System SHALL create an ActivityLog entry
2. THE ActivityLog SHALL record the user who performed the update (causer_id)
3. THE ActivityLog SHALL record the school that was updated (school_id)
4. THE ActivityLog SHALL record the timestamp of the update
5. THE ActivityLog SHALL include a description identifying the school name and action performed

### Requirement 5: User Interface Integration

**User Story:** As an admin user, I want an intuitive interface to manage headmaster profiles, so that I can efficiently update tenure information.

#### Acceptance Criteria

1. WHEN an Admin_User navigates to school management, THE System SHALL provide a way to search or filter schools
2. WHEN an Admin_User selects a school, THE System SHALL display the headmaster profile edit form
3. THE System SHALL use consistent UI components matching the existing School_Profile_Page design
4. THE System SHALL display loading states during data fetch and update operations
5. THE System SHALL display validation errors inline with the relevant form fields
6. WHEN an Admin_User cancels editing, THE System SHALL discard unsaved changes

### Requirement 6: Backend API Enhancement

**User Story:** As a developer, I want the backend API to support admin cross-school updates, so that the authorization model is correctly enforced.

#### Acceptance Criteria

1. THE Backend_API SHALL accept school_id as a parameter for admin users
2. WHEN an Admin_User calls the update endpoint, THE Backend_API SHALL bypass tenant scoping
3. WHEN an Operator calls the update endpoint, THE Backend_API SHALL enforce tenant scoping to their school_id only
4. THE Backend_API SHALL return the updated school record after successful update
5. IF an unauthorized user attempts cross-school update, THEN THE Backend_API SHALL return a 403 Forbidden response
6. THE Backend_API SHALL validate all Headmaster_Profile fields according to existing rules in SchoolController

### Requirement 7: Data Consistency

**User Story:** As a system administrator, I want headmaster profile updates to maintain data integrity, so that the system remains reliable.

#### Acceptance Criteria

1. WHEN an Admin_User updates a Headmaster_Profile, THE System SHALL use database transactions to ensure atomicity
2. IF the database update fails, THEN THE System SHALL roll back all changes
3. THE System SHALL refresh the displayed data after successful update to reflect the saved state
4. THE System SHALL handle concurrent updates gracefully using optimistic locking or last-write-wins strategy
5. THE System SHALL preserve existing data in fields that are not being updated

### Requirement 8: Notification and Feedback

**User Story:** As an admin user, I want clear feedback on my actions, so that I know whether my updates succeeded or failed.

#### Acceptance Criteria

1. WHEN an update succeeds, THE System SHALL display a toast notification with success message
2. WHEN an update fails due to validation errors, THE System SHALL display field-specific error messages
3. WHEN an update fails due to server error, THE System SHALL display a general error message with retry option
4. WHEN data is loading, THE System SHALL display a loading spinner or skeleton UI
5. THE System SHALL disable the submit button during update operations to prevent duplicate submissions

