# Gelar Normalization Fix Bugfix Design

## Overview

Gelar akademik tertentu tidak dinormalisasi dengan benar oleh NormalizationService. Gelar S.Pd.SD. (Sarjana Pendidikan untuk SD), A.Md. (Ahli Madya), dan A.Ma. (Ahli Madya) tidak dikenali atau salah diformat, menyebabkan data guru menjadi tidak konsisten. Fix ini akan menambahkan entri yang hilang ke DEGREE_MAP dan memastikan parsing bekerja dengan benar.

## Glossary

- **Bug_Condition (C)**: Kondisi yang memicu bug - ketika gelar S.Pd.SD., A.Md., atau A.Ma. perlu dinormalisasi
- **Property (P)**: Perilaku yang diharapkan - gelar harus dipertahankan dalam format kanoniknya
- **Preservation**: Perilaku normalisasi yang sudah ada untuk gelar-gelar lain harus tetap tidak berubah
- **DEGREE_MAP**: Lookup table di NormalizationService yang memetakan gelar tanpa titik/spasi ke format kanonik
- **degreeKey()**: Fungsi yang mengubah string gelar menjadi key lookup (strip dots/spaces, uppercase)
- **parseAcademicDegrees()**: Fungsi yang mem-parsing gelar dari nama lengkap menggunakan DEGREE_MAP

## Bug Details

### Bug Condition

Bug terjadi ketika gelar S.Pd.SD., A.Md., atau A.Ma. perlu dinormalisasi. DEGREE_MAP tidak memiliki entri untuk:
1. `SPDSD` → `S.Pd.SD.` (Sarjana Pendidikan SD)
2. `AMD` → `A.Md.` (Ahli Madya) - yang ada hanya `AMD` → `Amd.`

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type string (teacher name with degree)
  OUTPUT: boolean
  
  degreeKey := stripAllDotsAndSpacesAndUppercase(input)
  
  RETURN (degreeKey contains "SPDSD" AND NOT existsInDegreeMap("SPDSD"))
      OR (degreeKey contains "AMD" AND degreeMap("AMD") != "A.Md.")
      OR (degreeKey contains "AMA" AND parsingFails(input))
END FUNCTION
```

### Examples

- **S.Pd.SD. Bug**: "Ahmad S.Pd.SD." → "AHMAD, SPDSD" (salah) seharusnya "AHMAD, S.Pd.SD."
- **A.Md. Bug**: "Siti A.Md." → "SITI, Amd." (format berbeda) seharusnya "SITI, A.Md."
- **A.Ma. Bug**: "Budi A.Ma." → sudah ada di map sebagai `AMA` → `A.Ma.`, seharusnya bekerja dengan benar

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Gelar yang sudah ada seperti S.Pd., M.Pd., Dr., Dra. harus tetap dinormalisasi dengan benar
- Amd.Keb. (Ahli Madya Keperawatan) harus tetap dinormalisasi ke "Amd.Keb."
- Nama guru tanpa gelar harus tetap dikonversi ke UPPERCASE
- Nama guru dengan multiple degrees harus tetap dipisahkan dengan ", "
- A.Ma.Pust. dan A.Ma.Pd. harus tetap dinormalisasi dengan benar

**Scope:**
Semua input yang TIDAK melibatkan gelar S.Pd.SD., A.Md., atau A.Ma. harus tetap tidak terpengaruh oleh fix ini.

## Hypothesized Root Cause

Berdasarkan analisis kode, penyebab masalah adalah:

1. **Missing DEGREE_MAP Entry for S.Pd.SD.**: Tidak ada entri `SPDSD` → `S.Pd.SD.` di DEGREE_MAP. Ketika "S.Pd.SD." diinput, `degreeKey()` menghasilkan "SPDSD" yang tidak ditemukan di map, sehingga gelar tidak dikenali.

2. **Wrong Canonical Format for A.Md.**: Entry yang ada adalah `AMD` → `Amd.` (tanpa titik setelah "A"), bukan `A.Md.` (dengan titik setelah "A"). Ini menyebabkan inkonsistensi format.

3. **Potential Parsing Order Issue**: Meskipun A.Ma. sudah ada di map (`AMA` → `A.Ma.`), ada potensi masalah jika urutan parsing tidak benar karena `AMAPUST` dan `AMAPD` harus dicocokkan terlebih dahulu sebelum `AMA`.

## Correctness Properties

Property 1: Bug Condition - Missing Degree Recognition

_For any_ teacher name input containing S.Pd.SD. or A.Md. degrees, the fixed NormalizationService SHALL recognize and preserve these degrees in their canonical format ("S.Pd.SD." and "A.Md." respectively).

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - Existing Degree Normalization

_For any_ teacher name input that does NOT contain S.Pd.SD. or A.Md. degrees, the fixed NormalizationService SHALL produce exactly the same result as the original function, preserving all existing degree normalization behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**File**: `backend/app/Services/NormalizationService.php`

**Specific Changes**:

1. **Add S.Pd.SD. to DEGREE_MAP**: Tambahkan entry baru untuk Sarjana Pendidikan SD
   - Tambahkan `'SPDSD' => 'S.Pd.SD.'` di DEGREE_MAP
   - Letakkan setelah entry `SPD` untuk menjaga urutan alphabetical

2. **Update A.Md. Canonical Format**: Ubah format kanonik dari "Amd." ke "A.Md."
   - Ubah `'AMD' => 'Amd.'` menjadi `'AMD' => 'A.Md.'`
   - Ini akan mempengaruhi semua variasi input A.Md.

3. **Verify A.Ma. Entry**: Pastikan entry `AMA` → `A.Ma.` sudah benar dan tidak tertimpa
   - Entry sudah ada dan benar
   - Pastikan urutan sorting tidak menyebabkan masalah

4. **Update Related Tests**: Tambahkan test cases untuk gelar-gelar yang baru ditambahkan
   - Test untuk S.Pd.SD.
   - Test untuk A.Md. dengan format baru
   - Test untuk kombinasi gelar

## Testing Strategy

### Validation Approach

Strategi testing mengikuti pendekatan dua fase: pertama, surface counterexamples yang mendemonstrasikan bug pada kode yang belum di-fix, kemudian verifikasi fix bekerja dengan benar dan tidak merusak perilaku yang sudah ada.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples yang mendemonstrasikan bug SEBELUM mengimplementasikan fix. Konfirmasi atau sangkal analisis root cause.

**Test Plan**: Tulis test yang memanggil normalizeTeacherName dengan input yang mengandung S.Pd.SD. dan A.Md. Assert bahwa output seharusnya mengandung format kanonik yang benar. Run test pada kode UNFIXED untuk mengamati failure.

**Test Cases**:
1. **S.Pd.SD. Test**: "Ahmad S.Pd.SD." → expect "AHMAD, S.Pd.SD." (will fail on unfixed code)
2. **A.Md. Test**: "Siti A.Md." → expect "SITI, A.Md." (will fail on unfixed code)
3. **A.Ma. Test**: "Budi A.Ma." → expect "BUDI, A.Ma." (may pass on unfixed code)
4. **Combined Degrees Test**: "Ahmad S.Pd.SD. M.Pd." → expect "AHMAD, S.Pd.SD., M.Pd." (will fail on unfixed code)

**Expected Counterexamples**:
- S.Pd.SD. tidak dikenali, muncul sebagai "SPDSD" atau bagian dari nama
- A.Md. dinormalisasi ke "Amd." bukan "A.Md."

### Fix Checking

**Goal**: Verifikasi bahwa untuk semua input di mana bug condition terpenuhi, fixed function menghasilkan perilaku yang diharapkan.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := normalizeTeacherName_fixed(input)
  ASSERT result contains "S.Pd.SD." OR result contains "A.Md."
END FOR
```

### Preservation Checking

**Goal**: Verifikasi bahwa untuk semua input di mana bug condition TIDAK terpenuhi, fixed function menghasilkan hasil yang sama dengan original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT normalizeTeacherName_original(input) = normalizeTeacherName_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing direkomendasikan untuk preservation checking karena:
- Menghasilkan banyak test case secara otomatis
- Menangkap edge cases yang mungkin terlewat oleh manual unit tests
- Memberikan jaminan kuat bahwa perilaku tidak berubah untuk semua input non-buggy

**Test Plan**: Observe behavior pada UNFIXED code untuk gelar-gelar yang sudah ada, kemudian tulis property-based tests yang menangkap pola behavior tersebut.

**Test Cases**:
1. **Existing Degrees Preservation**: Verifikasi S.Pd., M.Pd., Dr., Dra. tetap bekerja
2. **Amd.Keb. Preservation**: Verifikasi Amd.Keb. tetap dinormalisasi dengan benar
3. **No Degree Preservation**: Verifikasi nama tanpa gelar tetap di-UPPERCASE-kan
4. **Multiple Degrees Preservation**: Verifikasi multiple degrees tetap dipisahkan dengan ", "

### Unit Tests

- Test normalisasi S.Pd.SD. dalam berbagai format input
- Test normalisasi A.Md. dalam berbagai format input
- Test kombinasi gelar S.Pd.SD. dengan gelar lain
- Test edge cases (gelar di awal, di tengah, multiple gelar)

### Property-Based Tests

- Generate random teacher names dengan S.Pd.SD. dan verifikasi normalisasi benar
- Generate random teacher names dengan gelar yang sudah ada dan verifikasi preservation
- Test idempotence untuk semua kombinasi gelar

### Integration Tests

- Test full normalization flow dengan data guru real-world
- Test import/export data dengan gelar-gelar baru
- Test database storage dan retrieval dengan gelar yang sudah dinormalisasi
