# Requirements Document

## Introduction

Fitur statistik jumlah siswa per jenjang pendidikan di SIMMACI. Memungkinkan pengguna (super_admin, admin_yayasan, operator) untuk melihat ringkasan jumlah siswa yang dikelompokkan berdasarkan jenjang pendidikan (RA, MI, MTs, MA), serta mengunduh data detail jumlah siswa per kelas dan total siswa per madrasah dalam format Excel.

## Glossary

- **Dashboard**: Halaman utama aplikasi yang menampilkan ringkasan statistik
- **Jenjang**: Tingkat pendidikan madrasah (RA, MI, MTs, MA)
- **Madrasah**: Sekolah/lembaga pendidikan Islam yang terdaftar di sistem
- **Kelas**: Rombongan belajar dalam satu madrasah (contoh: 1A, 2B, VII-A)
- **Student_Statistics_API**: Endpoint API backend yang menyediakan data statistik siswa per jenjang
- **Student_Statistics_View**: Komponen frontend yang menampilkan statistik siswa per jenjang
- **Excel_Exporter**: Modul backend yang menghasilkan file Excel berisi data jumlah siswa
- **Operator**: Pengguna yang hanya dapat mengakses data sekolah miliknya sendiri
- **Super_Admin**: Pengguna dengan akses penuh ke seluruh data lintas sekolah
- **Admin_Yayasan**: Pengguna level yayasan dengan akses lintas sekolah

## Requirements

### Requirement 1: Menampilkan Statistik Jumlah Siswa per Jenjang

**User Story:** As a super_admin/admin_yayasan, I want to see the total number of students grouped by education level (jenjang), so that I can monitor student distribution across the madrasah network.

#### Acceptance Criteria

1. WHEN the user navigates to the student statistics page, THE Student_Statistics_API SHALL return the total count of students with status "Aktif" grouped by jenjang categories: RA, MI, MTs, and MA, within 5 seconds
2. WHEN the Student_Statistics_API receives a request from a super_admin or admin_yayasan, THE Student_Statistics_API SHALL aggregate active student counts across all madrasah for each jenjang by joining students to their associated school's jenjang field
3. WHEN the Student_Statistics_API receives a request from an operator, THE Student_Statistics_API SHALL return active student counts only for the madrasah associated with that operator's school_id
4. THE Student_Statistics_View SHALL display each jenjang category (RA, MI, MTs, MA, Tidak Terdefinisi, Lainnya) with its corresponding total student count and percentage relative to the total, in a card or summary format
5. WHEN a madrasah has a jenjang value that is NULL or empty string, THE Student_Statistics_API SHALL categorize the student count under "Tidak Terdefinisi"
6. WHEN a madrasah has a jenjang value that does not match any of RA, MI, MTs, or MA (case-insensitive comparison), THE Student_Statistics_API SHALL categorize the student count under "Lainnya"
7. IF the Student_Statistics_API request fails or returns an error, THEN THE Student_Statistics_View SHALL display a fallback message indicating that statistics data is unavailable
8. WHEN a jenjang category has zero students, THE Student_Statistics_View SHALL display that category with a count of 0 and percentage of 0%

### Requirement 2: Menampilkan Detail Jumlah Siswa per Madrasah per Jenjang

**User Story:** As a super_admin/admin_yayasan, I want to see a breakdown of student counts per madrasah within each jenjang, so that I can identify which schools have the most or fewest students.

#### Acceptance Criteria

1. WHEN the user selects a jenjang category, THE Student_Statistics_View SHALL display a list of all madrasah within that jenjang category along with the count of active students (status = 'Aktif') for each madrasah
2. THE Student_Statistics_API SHALL return madrasah names and their respective active student counts sorted by student count in descending order
3. WHEN a madrasah within the selected jenjang category has zero active students, THE Student_Statistics_API SHALL include that madrasah in the list with a count of zero
4. THE Student_Statistics_View SHALL display the madrasah name (nama) and NPSN alongside the student count for each entry in the list
5. IF the Student_Statistics_API request fails or returns an error, THEN THE Student_Statistics_View SHALL display an error message indicating the data could not be loaded and allow the user to retry the request

### Requirement 3: Menampilkan Detail Jumlah Siswa per Kelas

**User Story:** As a super_admin/admin_yayasan/operator, I want to see the number of students in each class (kelas) within a madrasah, so that I can understand class-level distribution.

#### Acceptance Criteria

1. WHEN the user selects a specific madrasah, THE Student_Statistics_API SHALL return the count of students with status "Aktif" grouped by kelas for that madrasah
2. THE Student_Statistics_View SHALL display each kelas with its corresponding student count as a whole number
3. WHEN a student has a kelas value that is NULL, empty string, or contains only whitespace, THE Student_Statistics_API SHALL group that student under "Belum Ditentukan"
4. THE Student_Statistics_API SHALL sort the kelas list in ascending alphanumeric order, with "Belum Ditentukan" placed at the end of the list
5. IF the selected madrasah has zero active students, THEN THE Student_Statistics_API SHALL return an empty kelas list

### Requirement 4: Download Data Jumlah Siswa per Kelas dalam Format Excel

**User Story:** As a super_admin/admin_yayasan/operator, I want to download an Excel file containing student counts per class for a specific madrasah, so that I can use the data for offline reporting.

#### Acceptance Criteria

1. WHEN the user clicks the download button for a specific madrasah, THE Excel_Exporter SHALL generate an .xlsx file containing the count of students with status "Aktif" grouped by kelas for that madrasah
2. THE Excel_Exporter SHALL include columns: Nama Madrasah, NPSN, Kelas, and Jumlah Siswa, with rows ordered by kelas ascending
3. THE Excel_Exporter SHALL include a summary row at the bottom with the total student count across all kelas for the madrasah
4. THE Excel_Exporter SHALL name the downloaded file using the pattern: "Jumlah_Siswa_{nama_madrasah}_{YYYYMMdd_HHmmss}.xlsx", where special characters in nama_madrasah are replaced with underscores
5. IF the Excel generation fails, THEN THE Excel_Exporter SHALL return an error message indicating the failure reason without initiating a file download
6. IF the selected madrasah has no active students, THEN THE Excel_Exporter SHALL generate the file containing only the header row and a summary row showing a total of 0

### Requirement 5: Download Rekap Total Siswa per Madrasah per Jenjang dalam Format Excel

**User Story:** As a super_admin/admin_yayasan, I want to download an Excel file containing the total student count per madrasah for a specific jenjang, so that I can produce summary reports for the foundation.

#### Acceptance Criteria

1. WHEN the user clicks the download rekap button for a specific jenjang, THE Excel_Exporter SHALL generate an .xlsx file containing total counts of students with status "Aktif" per madrasah for that jenjang
2. THE Excel_Exporter SHALL include columns: No, Nama Madrasah, NPSN, Kecamatan, and Jumlah Siswa
3. THE Excel_Exporter SHALL include a grand total row at the bottom with the sum of all student counts
4. THE Excel_Exporter SHALL sort madrasah by name in ascending alphabetical order
5. THE Excel_Exporter SHALL name the downloaded file using the pattern: "Rekap_Siswa_{jenjang}_{YYYYMMdd_HHmmss}.xlsx"
6. WHEN an operator requests this download, THE Excel_Exporter SHALL only include data for the madrasah associated with that operator's school_id
7. IF the Excel generation fails, THEN THE Excel_Exporter SHALL return an error message indicating the failure reason without initiating a file download
8. IF the selected jenjang has no madrasah with active students, THEN THE Excel_Exporter SHALL generate the file containing only the header row and a grand total row showing 0

### Requirement 6: Akses dan Otorisasi

**User Story:** As a system administrator, I want the student statistics feature to respect role-based access control, so that data visibility is properly scoped.

#### Acceptance Criteria

1. THE Student_Statistics_API SHALL require authentication via Sanctum token for all endpoints
2. IF an unauthenticated request is made to any student statistics endpoint, THEN THE Student_Statistics_API SHALL return a 401 Unauthorized response with a JSON body containing `{ success: false, message: "Unauthorized." }`
3. IF an authenticated user with a role other than super_admin, admin_yayasan, or operator attempts to access any student statistics endpoint, THEN THE Student_Statistics_API SHALL return a 403 Forbidden response with a JSON body containing `{ success: false, message: <error message indicating insufficient role> }`
4. THE Student_Statistics_API SHALL allow access to users with super_admin, admin_yayasan, or operator roles only
5. WHILE an operator is accessing the student statistics, THE Student_Statistics_API SHALL scope all queries to the operator's associated school_id only, returning zero results if the operator has no valid school_id
6. WHILE a super_admin or admin_yayasan is accessing the student statistics, THE Student_Statistics_API SHALL return data across all madrasah without tenant scoping

### Requirement 7: Performa dan Responsivitas

**User Story:** As a user, I want the student statistics page to load quickly, so that I can access the information without delay.

#### Acceptance Criteria

1. THE Student_Statistics_API SHALL return aggregated statistics using database-level aggregation (GROUP BY) and respond within 2 seconds under normal load
2. WHILE the Student_Statistics_View is fetching data from the API, THE Student_Statistics_View SHALL display a loading skeleton in place of the statistics content
3. IF the API request fails or does not respond within 10 seconds, THEN THE Student_Statistics_View SHALL display an error message indicating the failure reason and a retry button that re-initiates the data fetch
4. WHEN the user activates the retry button, THE Student_Statistics_View SHALL re-fetch the statistics data from the API and display the loading skeleton during the request
