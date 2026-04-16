# Requirements Document

## Introduction

The Data Normalization feature addresses data inconsistency issues in the SIMMACI application where school names and teacher names are entered with varying capitalizations and formats. This causes problems with filtering, searching, duplicate detection, and data management. The feature will implement automatic normalization for both school names and teacher names, improve frontend input controls, and provide tools to normalize existing data.

## Glossary

- **System**: The SIMMACI backend application (Laravel 12)
- **Frontend**: The SIMMACI React frontend application
- **Normalization_Service**: A utility service that transforms text into standardized formats
- **SK_Controller**: The SkDocumentController responsible for SK document submissions
- **Teacher_Controller**: The TeacherController responsible for teacher data management
- **School_Controller**: The SchoolController responsible for school data management
- **Operator**: A user with role 'operator' scoped to a single school
- **Admin**: A user with role 'super_admin' or 'admin_yayasan' with cross-school access
- **Title_Case**: Capitalization format where each word starts with uppercase (e.g., "MI Darwata Glempang")
- **Uppercase**: All letters capitalized (e.g., "AHMAD AYUB NU'MAN")
- **Academic_Degree**: Educational qualifications like S.Pd., M.Pd., Dr., Dra., S.H., etc.
- **Artisan_Command**: A Laravel CLI command for batch operations
- **Autocomplete**: A UI component that suggests options as the user types
- **School_API**: The `/api/schools` endpoint that returns school data

## Requirements

### Requirement 1: School Name Normalization

**User Story:** As an operator or admin, I want school names to be automatically normalized to Title Case format, so that data is consistent and searchable regardless of how it was originally entered.

#### Acceptance Criteria

1. THE Normalization_Service SHALL provide a method that converts school names to Title Case format
2. WHEN a school name contains all uppercase letters, THE Normalization_Service SHALL convert it to Title Case (e.g., "MI DARWATA GLEMPANG" → "MI Darwata Glempang")
3. WHEN a school name contains mixed case letters, THE Normalization_Service SHALL convert it to Title Case (e.g., "mi darwata glempang" → "MI Darwata Glempang")
4. THE Normalization_Service SHALL preserve common abbreviations in uppercase (e.g., "MI", "MTs", "MA", "NU")
5. FOR ALL valid school name strings, normalizing twice SHALL produce the same result as normalizing once (idempotence property)

### Requirement 2: Teacher Name Normalization

**User Story:** As an operator or admin, I want teacher names to be automatically normalized with the name in UPPERCASE and academic degrees preserved, so that teacher records are consistent and professional.

#### Acceptance Criteria

1. THE Normalization_Service SHALL provide a method that converts teacher names to UPPERCASE while preserving academic degree formatting
2. WHEN a teacher name contains academic degrees (S.Pd., M.Pd., Dr., Dra., S.H., S.Pd.I, etc.), THE Normalization_Service SHALL preserve the degree formatting and convert only the name portion to UPPERCASE
3. WHEN a teacher name is "ahmad ayub nu'man, s.h", THE Normalization_Service SHALL convert it to "AHMAD AYUB NU'MAN, S.H"
4. WHEN a teacher name contains multiple degrees separated by commas, THE Normalization_Service SHALL preserve all degrees with proper formatting
5. THE Normalization_Service SHALL handle names with apostrophes, hyphens, and special characters correctly
6. FOR ALL valid teacher name strings, normalizing twice SHALL produce the same result as normalizing once (idempotence property)

### Requirement 3: SK Document Submission Normalization

**User Story:** As an operator submitting SK documents, I want school and teacher names to be automatically normalized before saving, so that I don't have to worry about capitalization consistency.

#### Acceptance Criteria

1. WHEN an individual SK request is submitted via `/api/sk-documents/submit-request`, THE SK_Controller SHALL normalize the school name before database save
2. WHEN an individual SK request is submitted via `/api/sk-documents/submit-request`, THE SK_Controller SHALL normalize the teacher name before database save
3. WHEN a bulk SK request is submitted via `/api/sk-documents/bulk-request`, THE SK_Controller SHALL normalize all school names before database save
4. WHEN a bulk SK request is submitted via `/api/sk-documents/bulk-request`, THE SK_Controller SHALL normalize all teacher names before database save
5. THE SK_Controller SHALL apply normalization to both the `unit_kerja` field and the `nama` field in SK documents
6. THE SK_Controller SHALL apply normalization before creating or updating Teacher records

### Requirement 4: Teacher Management Normalization

**User Story:** As an admin managing teacher records, I want teacher names to be automatically normalized when creating or updating records, so that all teacher data maintains consistent formatting.

#### Acceptance Criteria

1. WHEN a teacher is created via the Teacher_Controller, THE System SHALL normalize the teacher name before database save
2. WHEN a teacher is updated via the Teacher_Controller, THE System SHALL normalize the teacher name before database save
3. WHEN a teacher is imported via bulk import, THE System SHALL normalize all teacher names before database save
4. THE Teacher_Controller SHALL apply normalization to the `nama` field in all create and update operations

### Requirement 5: School Selection Autocomplete

**User Story:** As an operator submitting SK documents, I want to select schools from a dropdown with autocomplete instead of typing freely, so that I can avoid typos and ensure I'm selecting valid schools.

#### Acceptance Criteria

1. THE Frontend SHALL replace the free-text school name input with an autocomplete component on the SK submission form
2. WHEN an operator types in the school selection field, THE Frontend SHALL fetch school suggestions from the School_API
3. THE Frontend SHALL display school suggestions as the user types (minimum 2 characters)
4. WHEN an operator selects a school from the autocomplete, THE Frontend SHALL populate the `unit_kerja` field with the selected school name
5. WHERE the user is an operator with a pre-assigned school, THE Frontend SHALL pre-populate and disable the school selection field
6. THE Frontend SHALL use the Shadcn/UI Combobox component for the autocomplete implementation

### Requirement 6: School API Endpoint

**User Story:** As a frontend developer, I want a reliable API endpoint to fetch school lists, so that I can populate autocomplete dropdowns with current school data.

#### Acceptance Criteria

1. THE School_API SHALL provide a GET endpoint at `/api/schools` that returns a list of schools
2. THE School_API SHALL support optional query parameter `search` for filtering schools by name (case-insensitive)
3. THE School_API SHALL return school records with at minimum `id` and `nama` fields
4. WHEN an operator makes a request, THE School_API SHALL return only schools within their tenant scope
5. WHEN an admin makes a request, THE School_API SHALL return all schools
6. THE School_API SHALL return results in JSON format with proper HTTP status codes

### Requirement 7: Case-Insensitive School Lookup

**User Story:** As a system processing SK submissions, I want to match schools by name regardless of capitalization, so that duplicate schools aren't created due to case differences.

#### Acceptance Criteria

1. WHEN the SK_Controller looks up a school by name, THE System SHALL perform case-insensitive matching using PostgreSQL `ILIKE` operator
2. WHEN the Teacher_Controller looks up a school by name, THE System SHALL perform case-insensitive matching using PostgreSQL `ILIKE` operator
3. THE System SHALL normalize the school name before performing the lookup to ensure consistent matching
4. IF multiple schools match the normalized name, THE System SHALL return the first match ordered by creation date

### Requirement 8: Backward Compatibility - Data Migration Command

**User Story:** As a system administrator, I want an artisan command to normalize existing data in the database, so that historical records match the new normalization standards.

#### Acceptance Criteria

1. THE System SHALL provide an artisan command `php artisan normalize:data` that normalizes existing records
2. WHEN the command is executed, THE Artisan_Command SHALL normalize all school names in the `schools` table
3. WHEN the command is executed, THE Artisan_Command SHALL normalize all teacher names in the `teachers` table
4. WHEN the command is executed, THE Artisan_Command SHALL normalize all school names in the `sk_documents` table (`unit_kerja` field)
5. WHEN the command is executed, THE Artisan_Command SHALL normalize all teacher names in the `sk_documents` table (`nama` field)
6. THE Artisan_Command SHALL support a `--dry-run` option that previews changes without modifying the database
7. THE Artisan_Command SHALL output a summary showing the number of records updated
8. THE Artisan_Command SHALL log all changes for audit purposes
9. IF an error occurs during normalization, THE Artisan_Command SHALL continue processing remaining records and report errors at the end

### Requirement 9: Normalization Service Parser

**User Story:** As a developer, I want a robust parser that can identify and separate academic degrees from names, so that normalization handles edge cases correctly.

#### Acceptance Criteria

1. THE Normalization_Service SHALL recognize common Indonesian academic degrees: S.Pd., S.Pd.I, M.Pd., M.Pd.I, Dr., Dra., S.H., S.Ag., M.Ag., S.Si., M.Si., S.Kom., M.Kom.
2. THE Normalization_Service SHALL handle degrees with or without periods (e.g., "SPd" and "S.Pd.")
3. THE Normalization_Service SHALL handle multiple degrees in sequence (e.g., "Dr. Ahmad, S.Pd., M.Pd.")
4. THE Normalization_Service SHALL preserve comma separators between name and degrees
5. WHEN a name contains no recognizable degrees, THE Normalization_Service SHALL convert the entire string to UPPERCASE
6. THE Normalization_Service SHALL handle edge cases: empty strings, null values, single-word names, names with numbers

### Requirement 10: Frontend Validation Enhancement

**User Story:** As an operator, I want immediate feedback if I try to submit a school name that doesn't exist in the system, so that I can correct errors before submission.

#### Acceptance Criteria

1. WHEN an operator attempts to submit an SK request with a school not in the autocomplete list, THE Frontend SHALL display a validation error
2. THE Frontend SHALL validate that the selected school exists in the fetched school list before allowing form submission
3. WHERE the user is a super admin, THE Frontend SHALL allow free-text school entry for creating new schools
4. THE Frontend SHALL display clear error messages in Indonesian language
5. THE Frontend SHALL prevent form submission until school validation passes

### Requirement 11: Normalization Service Testing

**User Story:** As a developer, I want comprehensive tests for the normalization service, so that I can ensure it handles all edge cases correctly.

#### Acceptance Criteria

1. THE System SHALL include unit tests for school name normalization covering: all uppercase, all lowercase, mixed case, abbreviations, empty strings, null values
2. THE System SHALL include unit tests for teacher name normalization covering: names with degrees, names without degrees, multiple degrees, special characters, edge cases
3. THE System SHALL include property-based tests that verify idempotence: normalizing twice produces the same result as normalizing once
4. THE System SHALL include property-based tests that verify normalization preserves string length within reasonable bounds
5. FOR ALL valid input strings, THE normalization functions SHALL return a non-null string

### Requirement 12: Performance Optimization

**User Story:** As a system administrator, I want the data migration command to process large datasets efficiently, so that normalization doesn't cause system downtime.

#### Acceptance Criteria

1. WHEN processing more than 1000 records, THE Artisan_Command SHALL use batch processing with chunks of 500 records
2. THE Artisan_Command SHALL display a progress indicator showing percentage completion
3. THE Artisan_Command SHALL complete normalization of 10,000 records within 5 minutes on standard hardware
4. THE Artisan_Command SHALL use database transactions to ensure data integrity
5. IF the command is interrupted, THE System SHALL allow resuming from the last successful batch

### Requirement 13: Audit Logging for Normalization

**User Story:** As a system administrator, I want all normalization changes to be logged, so that I can track what data was modified and when.

#### Acceptance Criteria

1. WHEN the migration command normalizes a record, THE System SHALL create an activity log entry
2. THE activity log SHALL include: original value, normalized value, table name, record ID, timestamp, and user/command identifier
3. WHEN normalization occurs during SK submission, THE System SHALL include normalization details in the submission activity log
4. THE System SHALL use the existing `ActivityLog` model and `AuditLogTrait` for consistency
5. THE activity logs SHALL be queryable by date range, table name, and record ID
