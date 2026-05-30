# Bugfix Requirements Document

## Introduction

The SK Excel bulk import process has two data integrity bugs that cause duplicate teacher records and allow non-unique NIM values. When uploading an Excel file for SK submission (pengajuan SK kolektif), the teacher matching logic fails to find existing teachers in certain edge cases — particularly when the teacher's identifier fields (nuptk, nip, nomor_induk_maarif) are empty in the database and name matching fails due to casing or degree differences. This results in duplicate teacher records with conflicting statuses. Additionally, the import process does not validate NIM (nomor_induk_maarif) uniqueness within the tenant, allowing the same NIM to be assigned to multiple teachers.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a teacher exists in the database without nuptk/nip/nomor_induk_maarif AND the Excel row contains a name that differs only in casing (e.g., "RATINO" vs "Ratino") after bare-name normalization THEN the system creates a duplicate teacher record instead of matching the existing one

1.2 WHEN a teacher exists in the database with a full name including academic degrees (e.g., "Ratino, S.Pd.") AND the Excel row contains the bare name without degrees (e.g., "RATINO") AND the bare-name fallback query uses `UPPER(nama) = ?` which compares against the full name with degrees THEN the system fails to match and creates a duplicate teacher record

1.3 WHEN a teacher exists in the database with status "Tendik" AND the Excel row lists the same teacher with status "GTY" AND the matching logic fails to find the existing record (due to 1.1 or 1.2) THEN the system creates a new teacher record with status "GTY" resulting in two records for the same person

1.4 WHEN an Excel row contains a nomor_induk_maarif (NIM) value that is already assigned to a different teacher in the same school THEN the system accepts the row without validation error and either assigns the duplicate NIM to a new teacher or overwrites the existing teacher's data

1.5 WHEN an Excel row contains a nomor_induk_maarif (NIM) value that is already assigned to a different teacher in a different school (global duplicate) THEN the system accepts the row without validation error

### Expected Behavior (Correct)

2.1 WHEN a teacher exists in the database without nuptk/nip/nomor_induk_maarif AND the Excel row contains a name that matches after case-insensitive bare-name normalization THEN the system SHALL match the existing teacher record and update it

2.2 WHEN a teacher exists in the database with a full name including academic degrees AND the Excel row contains the bare name without degrees THEN the system SHALL extract the bare name from the database record (stripping degrees) and compare case-insensitively to find the match

2.3 WHEN a teacher exists in the database with a different status AND the Excel row has a different status value AND the teacher is matched by any identifier or name THEN the system SHALL update the existing teacher's status field instead of creating a new record

2.4 WHEN an Excel row contains a nomor_induk_maarif (NIM) value that is already assigned to a different teacher within the same tenant (school_id) THEN the system SHALL reject the row with a clear error message indicating the NIM is already in use

2.5 WHEN an Excel row contains a nomor_induk_maarif (NIM) value that is already assigned to a different teacher globally (different school) THEN the system SHALL reject the row with a clear error message indicating the NIM is already in use by another teacher

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a teacher is matched by nuptk THEN the system SHALL CONTINUE TO update the existing teacher record with data from the Excel row

3.2 WHEN a teacher is matched by nip THEN the system SHALL CONTINUE TO update the existing teacher record with data from the Excel row

3.3 WHEN a teacher is matched by nomor_induk_maarif THEN the system SHALL CONTINUE TO update the existing teacher record with data from the Excel row

3.4 WHEN a teacher is matched by exact nama + school_id THEN the system SHALL CONTINUE TO update the existing teacher record with data from the Excel row

3.5 WHEN no existing teacher matches any identifier or name within the school THEN the system SHALL CONTINUE TO create a new teacher record

3.6 WHEN a teacher has PNS status THEN the system SHALL CONTINUE TO reject the row with the PNS rejection message

3.7 WHEN a teacher exists but has no NIM and no TMT THEN the system SHALL CONTINUE TO reject the row with the "NIM dan TMT belum terisi" message

3.8 WHEN an Excel row contains a nomor_induk_maarif that belongs to the same teacher being matched (self-reference) THEN the system SHALL CONTINUE TO accept and process the row normally

---

## Bug Condition (Formal)

### Bug 1: Duplicate Teacher on Name Mismatch

```pascal
FUNCTION isBugCondition_Duplicate(X)
  INPUT: X of type ExcelImportRow
  OUTPUT: boolean
  
  // Bug triggers when:
  // 1. Teacher exists in DB without nuptk/nip/nomor_induk_maarif
  // 2. Name matching fails due to case or degree differences
  existingTeacher ← findTeacherInDB(X.school_id)
  
  RETURN existingTeacher EXISTS
    AND existingTeacher.nuptk IS EMPTY
    AND existingTeacher.nip IS EMPTY
    AND existingTeacher.nomor_induk_maarif IS EMPTY
    AND exactNameMatch(X.nama, existingTeacher.nama) = FALSE
    AND bareNameMatch(X.nama, existingTeacher.nama) SHOULD_MATCH_BUT_FAILS
END FUNCTION
```

```pascal
// Property: Fix Checking - No Duplicate Teachers
FOR ALL X WHERE isBugCondition_Duplicate(X) DO
  result ← importExcelRow'(X)
  ASSERT countTeachersWithBareName(X.nama, X.school_id) = 1
    AND result.teacher_id = existingTeacher.id
END FOR
```

### Bug 2: NIM Not Validated for Uniqueness

```pascal
FUNCTION isBugCondition_NimDuplicate(X)
  INPUT: X of type ExcelImportRow
  OUTPUT: boolean
  
  // Bug triggers when NIM in Excel is already used by a DIFFERENT teacher
  RETURN X.nomor_induk_maarif IS NOT EMPTY
    AND EXISTS teacher IN DB WHERE teacher.nomor_induk_maarif = X.nomor_induk_maarif
    AND teacher.id ≠ matchedTeacher(X).id
END FUNCTION
```

```pascal
// Property: Fix Checking - NIM Uniqueness Enforced
FOR ALL X WHERE isBugCondition_NimDuplicate(X) DO
  result ← importExcelRow'(X)
  ASSERT result.status = 'rejected'
    AND result.rejection_reason CONTAINS 'NIM sudah digunakan'
END FOR
```

### Preservation Property

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_Duplicate(X) AND NOT isBugCondition_NimDuplicate(X) DO
  ASSERT importExcelRow(X) = importExcelRow'(X)
END FOR
```
