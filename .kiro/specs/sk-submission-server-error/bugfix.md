# Bugfix Requirements Document

## Introduction

Users are experiencing a generic "Server Error" (displayed as "Gagal menyimpan pengajuan: Server Error") when attempting to submit SK (Surat Keputusan) documents through the SK submission form at `/dashboard/sk/new`. This error occurs because the backend `submitRequest` method in `SkDocumentController` lacks proper exception handling, causing any database-level errors to bubble up as unhelpful generic error messages. This prevents users from understanding what went wrong and how to fix their submission.

The bug affects operators submitting SK requests for teachers, blocking a critical workflow in the SIMMACI system.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user submits an SK request through the form AND any database operation fails (e.g., constraint violation, missing required field, null school_id) THEN the system returns a generic "Server Error" message without specific details about what caused the failure

1.2 WHEN a database exception occurs during teacher creation/update in the submitRequest method THEN the exception propagates unhandled to the user as "Server Error"

1.3 WHEN a database exception occurs during SK document creation in the submitRequest method THEN the exception propagates unhandled to the user as "Server Error"

1.4 WHEN a database exception occurs during activity log creation in the submitRequest method THEN the exception propagates unhandled to the user as "Server Error"

1.5 WHEN an operator with null school_id attempts to submit an SK request THEN the system may fail with a generic error instead of a clear validation message

### Expected Behavior (Correct)

2.1 WHEN a user submits an SK request through the form AND any database operation fails THEN the system SHALL return a specific, user-friendly error message describing what went wrong (e.g., "Nomor SK sudah digunakan", "Data sekolah tidak valid", "Field X wajib diisi")

2.2 WHEN a database exception occurs during teacher creation/update in the submitRequest method THEN the system SHALL catch the exception, log it for debugging, and return a meaningful error message to the user

2.3 WHEN a database exception occurs during SK document creation in the submitRequest method THEN the system SHALL catch the exception, log it for debugging, and return a meaningful error message to the user (e.g., unique constraint violations, missing required fields)

2.4 WHEN a database exception occurs during activity log creation in the submitRequest method THEN the system SHALL catch the exception, log it for debugging, but still return success if the main SK creation succeeded (activity log failure should not block the submission)

2.5 WHEN an operator with null school_id attempts to submit an SK request THEN the system SHALL return a clear validation error message: "Akun operator belum terhubung ke sekolah. Hubungi administrator."

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user submits a valid SK request with all required fields properly filled THEN the system SHALL CONTINUE TO successfully create the teacher record, SK document record, and activity log, returning a 201 status with the created SK data

3.2 WHEN a user submits an SK request with valid data AND the teacher already exists (matched by NUPTK, NIP, or name+school_id) THEN the system SHALL CONTINUE TO update the existing teacher record instead of creating a duplicate

3.3 WHEN the system generates a temporary nomor_sk (REQ/{year}/{sequence}) for pending requests THEN it SHALL CONTINUE TO ensure uniqueness by incrementing the sequence number until a unique value is found

3.4 WHEN an SK request is successfully submitted THEN the system SHALL CONTINUE TO create an activity log entry with description "Pengajuan SK Individual: {nama} ({unit_kerja})"

3.5 WHEN an operator submits an SK request THEN the system SHALL CONTINUE TO force the school_id to match the operator's school_id, overriding any unit_kerja lookup
