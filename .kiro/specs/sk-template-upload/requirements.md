# Requirements Document

## Introduction

The SK Template Upload feature enables `super_admin` users to upload, manage, and activate `.docx` template files for SK (Surat Keputusan / official decree) generation through the SIMMACI web UI. Currently, SK templates are hardcoded files bundled in the frontend build, requiring a full redeployment to change them. This feature replaces that static approach with a dynamic template management system backed by Laravel Storage, allowing different SK types (e.g., GTY, GTT, Kamad, Tendik) to each have their own uploadable template. The SK Generator will then resolve templates from storage at generation time instead of from the bundled file.

## Glossary

- **SK**: Surat Keputusan — an official decree document issued by LP Ma'arif NU Cilacap
- **SK_Template**: A `.docx` file containing docxtemplater-compatible placeholder tags used to generate SK documents
- **SK_Type**: The category of SK being issued (e.g., `gty`, `gtt`, `kamad`, `tendik`)
- **Template_Manager**: The backend subsystem responsible for storing, retrieving, and serving SK templates
- **Template_Repository**: The database table (`sk_templates`) that records metadata for uploaded templates
- **Storage**: Laravel's file storage abstraction (local disk or S3-compatible via MinIO)
- **Active_Template**: The template currently designated for use when generating SK documents for a given SK_Type
- **super_admin**: The SIMMACI role with full system access, the only role permitted to manage templates
- **operator**: A school-scoped SIMMACI role that uses templates but cannot manage them
- **admin_yayasan**: A foundation-level SIMMACI role that uses templates but cannot manage them
- **Placeholder**: A docxtemplater tag inside a `.docx` file (e.g., `{NAMA}`, `{NOMOR_SK}`) that is replaced with real data at generation time
- **ApiResponse**: The Laravel trait used across all API controllers that produces `{ success, message, data }` shaped responses

---

## Requirements

### Requirement 1: Upload SK Template File

**User Story:** As a super_admin, I want to upload a `.docx` template file for a specific SK type, so that I can update templates without redeploying the application.

#### Acceptance Criteria

1. WHEN a super_admin submits a template upload request with a valid `.docx` file and a valid `sk_type`, THE Template_Manager SHALL store the file in Laravel Storage under the `sk-templates/` folder and persist a record in the Template_Repository with the file path, original filename, `sk_type`, uploader identity, and upload timestamp.
2. IF the uploaded file is not a `.docx` file, THEN THE Template_Manager SHALL reject the request and return a 422 response with a descriptive validation error message.
3. IF the uploaded file exceeds 10 MB, THEN THE Template_Manager SHALL reject the request and return a 422 response indicating the file size limit.
4. IF the `sk_type` value is not one of the defined SK types (`gty`, `gtt`, `kamad`, `tendik`), THEN THE Template_Manager SHALL reject the request and return a 422 response with a descriptive validation error message.
5. WHEN a template is successfully uploaded, THE Template_Manager SHALL record an activity log entry via the `ActivityLog` model with event `upload_sk_template`, including the uploader's identity and the `sk_type`.
6. WHEN a template is successfully uploaded, THE Template_Manager SHALL return a 201 response using the `ApiResponse` shape `{ success: true, message, data }` where `data` contains the created template record.

---

### Requirement 2: List SK Templates

**User Story:** As a super_admin, I want to view all uploaded SK templates, so that I can see what templates are available and which ones are currently active.

#### Acceptance Criteria

1. WHEN a super_admin requests the template list, THE Template_Manager SHALL return all records from the Template_Repository ordered by `sk_type` ascending and `created_at` descending, including fields: `id`, `sk_type`, `original_filename`, `file_path`, `is_active`, `uploaded_by`, `created_at`.
2. THE Template_Manager SHALL support filtering the list by `sk_type` query parameter so that only templates for the requested SK type are returned.
3. WHEN a non-super_admin authenticated user requests the template list, THE Template_Manager SHALL return a 403 response.

---

### Requirement 3: Activate a Template

**User Story:** As a super_admin, I want to designate one template as the active template for each SK type, so that the SK Generator always uses the correct and most up-to-date template.

#### Acceptance Criteria

1. WHEN a super_admin sends an activate request for a template record, THE Template_Manager SHALL set `is_active = true` for that record and set `is_active = false` for all other records with the same `sk_type`.
2. WHEN a template is activated, THE Template_Manager SHALL record an activity log entry with event `activate_sk_template`, including the template `id`, `sk_type`, and the activating user's identity.
3. WHEN a template is activated, THE Template_Manager SHALL return a 200 response using the `ApiResponse` shape with the updated template record in `data`.
4. IF the template record does not exist, THEN THE Template_Manager SHALL return a 404 response.
5. THE Template_Manager SHALL ensure that at most one template per `sk_type` has `is_active = true` at any given time.

---

### Requirement 4: Delete a Template

**User Story:** As a super_admin, I want to delete an SK template, so that I can remove outdated or incorrect templates from the system.

#### Acceptance Criteria

1. WHEN a super_admin sends a delete request for a template record, THE Template_Manager SHALL soft-delete the record from the Template_Repository and return a 200 response with `{ success: true }`.
2. IF the template being deleted is the currently active template for its `sk_type`, THEN THE Template_Manager SHALL also clear the active status (set `is_active = false`) before soft-deleting, so that no active template points to a deleted file.
3. WHEN a template is deleted, THE Template_Manager SHALL record an activity log entry with event `delete_sk_template`, including the template `id`, `sk_type`, and the deleting user's identity.
4. IF the template record does not exist or has already been soft-deleted, THEN THE Template_Manager SHALL return a 404 response.

---

### Requirement 5: Download / Serve a Template File

**User Story:** As a super_admin, I want to download an uploaded template file, so that I can inspect or edit it locally.

#### Acceptance Criteria

1. WHEN a super_admin requests the download URL for a template record, THE Template_Manager SHALL return a signed or direct URL to the stored `.docx` file that is valid for at least 60 minutes.
2. IF the file no longer exists in Storage, THEN THE Template_Manager SHALL return a 404 response with a descriptive error message.
3. WHEN a non-super_admin authenticated user requests a template download URL, THE Template_Manager SHALL return a 403 response.

---

### Requirement 6: SK Generator Uses Uploaded Template

**User Story:** As a super_admin or operator, I want the SK Generator to automatically use the active uploaded template for each SK type, so that generated SK documents reflect the latest approved template without requiring a redeployment.

#### Acceptance Criteria

1. WHEN the SK Generator resolves a template for a given `sk_type`, THE SK_Generator SHALL query the Template_Repository for the active template (`is_active = true`) for that `sk_type` and use its stored file URL.
2. IF no active uploaded template exists for the requested `sk_type`, THEN THE SK_Generator SHALL fall back to the bundled static template file for that `sk_type` to preserve backward compatibility.
3. WHEN the SK Generator fetches a template file from Storage, THE SK_Generator SHALL handle HTTP errors from the storage URL and surface a descriptive error message to the user if the file cannot be retrieved.
4. THE SK_Generator SHALL cache resolved template file contents in memory within a single generation session to avoid redundant storage fetches for the same `sk_type`.

---

### Requirement 7: Template Management UI

**User Story:** As a super_admin, I want a dedicated template management page in the SIMMACI UI, so that I can upload, activate, and delete templates without using the API directly.

#### Acceptance Criteria

1. THE Template_Management_Page SHALL be accessible only to users with the `super_admin` role; other roles SHALL be redirected or shown a 403 message.
2. THE Template_Management_Page SHALL display all uploaded templates grouped by `sk_type`, showing the original filename, upload date, uploader, and active status for each template.
3. WHEN a super_admin selects a `.docx` file and a target `sk_type` in the upload form and submits, THE Template_Management_Page SHALL call the upload API, show a loading indicator during the request, and display a success toast on completion or an error toast on failure.
4. WHEN a super_admin clicks the activate button for a template, THE Template_Management_Page SHALL call the activate API and optimistically update the active indicator in the UI, reverting on failure.
5. WHEN a super_admin clicks the delete button for a template, THE Template_Management_Page SHALL display a confirmation dialog before calling the delete API, and remove the template from the list on success.
6. THE Template_Management_Page SHALL use TanStack Query for data fetching and cache invalidation, React Hook Form + Zod for upload form validation, and Shadcn/UI components for all UI elements.
7. WHEN the upload form is submitted with a file that is not `.docx` or exceeds 10 MB, THE Template_Management_Page SHALL display an inline validation error before making any API call.

---

### Requirement 8: Access Control Enforcement

**User Story:** As a system administrator, I want all template management API endpoints to be restricted to super_admin only, so that operators and admin_yayasan cannot accidentally or maliciously alter SK templates.

#### Acceptance Criteria

1. THE Template_Manager SHALL apply the `auth:sanctum` middleware to all template management endpoints.
2. THE Template_Manager SHALL apply the `role:super_admin` middleware via `CheckRole` to all write endpoints (upload, activate, delete, download URL).
3. IF an authenticated user without the `super_admin` role calls a write endpoint, THEN THE Template_Manager SHALL return a 403 response.
4. THE Template_Manager SHALL not expose template file paths or storage URLs directly in list responses; instead, THE Template_Manager SHALL provide a separate authenticated download endpoint to retrieve file access URLs.
