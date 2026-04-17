# Requirements Document

## Introduction

Fitur SK Nomor Periode merevisi format nomor SK pada Generator SK Masal di aplikasi SIMMACI. Saat ini, format nomor SK menggunakan placeholder `{TANGGAL}` yang diisi dengan tanggal cetak SK. Fitur ini mengganti `{TANGGAL}` dengan `{PERIODE}` yang nilainya adalah jumlah tahun penuh (dibulatkan ke bawah) dari TMT (Terhitung Mulai Tanggal) guru sampai tanggal SK dicetak. Perubahan ini merupakan aturan baku dari yayasan LP Ma'arif NU Cilacap untuk mencerminkan masa kerja guru dalam nomor SK.

## Glossary

- **SK**: Surat Keputusan — dokumen resmi yang dikeluarkan oleh LP Ma'arif NU Cilacap
- **SK_Generator**: Subsistem frontend yang menghasilkan dokumen SK secara massal menggunakan docxtemplater
- **TMT**: Terhitung Mulai Tanggal — tanggal mulai tugas guru yang tercatat di database
- **Periode**: Jumlah tahun penuh masa kerja guru dari TMT sampai tanggal cetak SK (dibulatkan ke bawah)
- **Placeholder**: Tag docxtemplater di dalam format nomor SK (contoh: `{NOMOR}`, `{TANGGAL}`, `{PERIODE}`)
- **Format_Nomor_SK**: Template string yang berisi placeholder untuk menghasilkan nomor SK unik per guru
- **Tanggal_Cetak**: Tanggal saat SK digenerate oleh SK_Generator
- **GTY**: Guru Tetap Yayasan — jenis SK untuk guru tetap
- **GTT**: Guru Tidak Tetap — jenis SK untuk guru tidak tetap
- **Tendik**: Tenaga Kependidikan — jenis SK untuk tenaga kependidikan
- **Kamad**: Kepala Madrasah — jenis SK untuk kepala sekolah (tidak menggunakan {PERIODE})

---

## Requirements

### Requirement 1: Replace {TANGGAL} Placeholder with {PERIODE}

**User Story:** As a super_admin or operator, I want the SK number format to use `{PERIODE}` instead of `{TANGGAL}`, so that the SK number reflects the teacher's years of service according to LP Ma'arif NU Cilacap standards.

#### Acceptance Criteria

1. THE SK_Generator SHALL replace all occurrences of `{TANGGAL}` placeholder in the default SK number format with `{PERIODE}` placeholder.
2. THE SK_Generator SHALL update the default format from `{NOMOR}/PC.L/A.II/H-34.B/24.29/{TANGGAL}/{BULAN}/{TAHUN}` to `{NOMOR}/PC.L/A.II/H-34.B/24.29/{PERIODE}/{BULAN}/{TAHUN}`.
3. WHEN a user views the SK Generator settings, THE SK_Generator SHALL display the updated format with `{PERIODE}` placeholder in the format input field.

---

### Requirement 2: Calculate Periode Value

**User Story:** As a super_admin or operator, I want the system to automatically calculate the periode value based on the teacher's TMT and the SK print date, so that each teacher gets an accurate SK number reflecting their years of service.

#### Acceptance Criteria

1. WHEN generating an SK for a teacher, THE SK_Generator SHALL calculate the periode value as `floor((tanggal_cetak - tmt_guru) / 1 year)` where months are counted in the calculation.
2. THE SK_Generator SHALL use the teacher's `tmt` field from the database as the starting date for the calculation.
3. THE SK_Generator SHALL use the current date (or the configured `tanggalPenetapan` value) as the ending date for the calculation.
4. WHEN TMT is 1 Juli 2000 and tanggal_cetak is 1 Juli 2026, THE SK_Generator SHALL calculate periode as 26.
5. WHEN TMT is 1 Oktober 2000 and tanggal_cetak is 1 Juli 2026, THE SK_Generator SHALL calculate periode as 25 (not yet 26 full years).
6. THE SK_Generator SHALL round down the calculated years to the nearest integer (floor operation).

---

### Requirement 3: Apply Periode to Specific SK Types

**User Story:** As a super_admin or operator, I want the periode calculation to apply only to GTY, GTT, and Tendik SK types, so that Kamad SK numbers remain unchanged per yayasan policy.

#### Acceptance Criteria

1. WHEN generating SK for jenis_sk GTY, THE SK_Generator SHALL replace `{PERIODE}` with the calculated periode value.
2. WHEN generating SK for jenis_sk GTT, THE SK_Generator SHALL replace `{PERIODE}` with the calculated periode value.
3. WHEN generating SK for jenis_sk Tendik, THE SK_Generator SHALL replace `{PERIODE}` with the calculated periode value.
4. WHEN generating SK for jenis_sk Kamad, THE SK_Generator SHALL NOT use `{PERIODE}` placeholder and SHALL maintain the original Kamad format without periode.
5. THE SK_Generator SHALL determine the SK type based on the teacher's `status` field or the `jenis_sk` field from the SkDocument record.

---

### Requirement 4: Generate Unique SK Numbers per Teacher

**User Story:** As a super_admin or operator, I want each teacher in a bulk SK generation to receive a unique SK number based on their individual TMT, so that SK numbers accurately reflect each teacher's service period.

#### Acceptance Criteria

1. WHEN generating SK in bulk for multiple teachers, THE SK_Generator SHALL calculate a separate periode value for each teacher based on their individual TMT.
2. THE SK_Generator SHALL produce different SK numbers for teachers with different TMT dates even when generated in the same batch.
3. WHEN two teachers have the same TMT, THE SK_Generator SHALL produce the same periode value but different sequential numbers (`{NOMOR}`) for their SK.
4. THE SK_Generator SHALL maintain the sequential numbering logic (`{NOMOR}`) independent of the periode calculation.

---

### Requirement 5: Validate TMT Availability

**User Story:** As a super_admin or operator, I want the system to ensure that TMT data exists before generating SK, so that periode calculation does not fail due to missing data.

#### Acceptance Criteria

1. THE SK_Generator SHALL assume that all teachers selected for SK generation have a valid `tmt` value in the database.
2. IF a teacher record does not have a `tmt` value, THE SK_Generator SHALL use the `tmt` value from the associated SkDocument record (`t.tmt`).
3. THE SK_Generator SHALL NOT implement fallback logic for missing TMT since TMT is validated at the data input stage.
4. WHEN TMT is missing for a teacher during generation, THE SK_Generator SHALL log an error and skip that teacher's SK generation.

---

### Requirement 6: Preserve Existing Placeholder Logic

**User Story:** As a super_admin or operator, I want all other placeholders in the SK number format to continue working as before, so that only the periode logic is changed without breaking existing functionality.

#### Acceptance Criteria

1. THE SK_Generator SHALL continue to replace `{NOMOR}` with the sequential number padded to 4 digits.
2. THE SK_Generator SHALL continue to replace `{BULAN}` with the numeric month (1-12) of the tanggal_cetak.
3. THE SK_Generator SHALL continue to replace `{TAHUN}` with the 4-digit year of the tanggal_cetak.
4. THE SK_Generator SHALL continue to replace `{BL_ROMA}` with the Roman numeral representation of the month.
5. THE SK_Generator SHALL apply all placeholder replacements in the same order and manner as the current implementation, with only `{TANGGAL}` replaced by `{PERIODE}`.

---

### Requirement 7: Update UI Default Format

**User Story:** As a super_admin or operator, I want the SK Generator page to show the new default format with `{PERIODE}`, so that I understand the new format when generating SK.

#### Acceptance Criteria

1. WHEN the SK Generator page loads, THE SK_Generator SHALL display the default format as `{NOMOR}/PC.L/A.II/H-34.B/24.29/{PERIODE}/{BULAN}/{TAHUN}` in the "Format Nomor SK" input field.
2. THE SK_Generator SHALL allow users to manually edit the format string if needed.
3. THE SK_Generator SHALL display a tooltip or help text explaining that `{PERIODE}` represents the teacher's years of service from TMT to print date.
4. THE SK_Generator SHALL update any documentation or help text that previously referenced `{TANGGAL}` to now reference `{PERIODE}`.

---

### Requirement 8: Maintain Backward Compatibility for Existing SK Records

**User Story:** As a super_admin, I want existing SK records with the old format to remain valid, so that historical SK numbers are not affected by the format change.

#### Acceptance Criteria

1. THE SK_Generator SHALL NOT modify or regenerate existing SK records in the database.
2. WHEN viewing historical SK records, THE System SHALL display the original nomor_sk value as stored in the database.
3. THE SK_Generator SHALL only apply the new `{PERIODE}` format to newly generated SK documents after the feature is deployed.
4. THE System SHALL support both old format (with `{TANGGAL}`) and new format (with `{PERIODE}`) SK numbers in verification and display features.
