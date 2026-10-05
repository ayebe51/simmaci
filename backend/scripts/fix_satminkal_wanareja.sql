-- ==============================================================================
-- SQL Script: Perbaikan Satminkal SMP Ma'arif NU 1 Wanareja -> SMP Ma'arif NU 01 Wanareja
-- Sistem Informasi Manajemen Maarif NU (SIMMACI)
-- ==============================================================================

-- ==============================================================================
-- BAGIAN 1: DRY RUN / SIMULASI (READ-ONLY, TIDAK MENGUBAH DATA)
-- Jalankan bagian ini terlebih dahulu untuk memeriksa data yang terdampak
-- ==============================================================================

-- 1. Cek master sekolah di tabel `schools`
SELECT id, nama, npsn, kecamatan, updated_at
FROM schools 
WHERE deleted_at IS NULL 
  AND (
    LOWER(nama) LIKE '%wanareja%' AND (LOWER(nama) LIKE '%smp%' OR LOWER(nama) LIKE '%1%')
  );

-- 2. Cek daftar guru yang terdeteksi dengan satminkal lama
SELECT 
    id, 
    nama, 
    nuptk, 
    nomor_induk_maarif, 
    unit_kerja AS satminkal_saat_ini, 
    'SMP Ma''arif NU 01 Wanareja' AS satminkal_baru,
    school_id AS school_id_saat_ini,
    (SELECT id FROM schools WHERE deleted_at IS NULL AND (LOWER(TRIM(nama)) = 'smp ma''arif nu 01 wanareja' OR LOWER(REPLACE(nama, '''', '')) = 'smp maarif nu 01 wanareja') LIMIT 1) AS target_school_id
FROM teachers 
WHERE deleted_at IS NULL 
  AND (
    LOWER(REPLACE(REPLACE(unit_kerja, '''', ''), '’', '')) LIKE '%smp maarif nu 1 wanareja%'
    OR LOWER(unit_kerja) LIKE '%smp%nu 1 wanareja%'
  );

-- 3. Cek dokumen SK yang terhubung
SELECT 
    id AS sk_id, 
    nomor_sk, 
    nama, 
    teacher_id, 
    unit_kerja AS unit_kerja_sk_lama,
    school_id
FROM sk_documents 
WHERE deleted_at IS NULL 
  AND (
    LOWER(REPLACE(REPLACE(unit_kerja, '''', ''), '’', '')) LIKE '%smp maarif nu 1 wanareja%'
    OR LOWER(unit_kerja) LIKE '%smp%nu 1 wanareja%'
    OR teacher_id IN (
      SELECT id FROM teachers 
      WHERE deleted_at IS NULL 
        AND (
          LOWER(REPLACE(REPLACE(unit_kerja, '''', ''), '’', '')) LIKE '%smp maarif nu 1 wanareja%'
          OR LOWER(unit_kerja) LIKE '%smp%nu 1 wanareja%'
        )
    )
  );

-- 4. Ringkasan jumlah baris yang terdampak
SELECT 
    (SELECT COUNT(*) FROM teachers WHERE deleted_at IS NULL AND (LOWER(REPLACE(REPLACE(unit_kerja, '''', ''), '’', '')) LIKE '%smp maarif nu 1 wanareja%' OR LOWER(unit_kerja) LIKE '%smp%nu 1 wanareja%')) AS total_guru_terdampak,
    (SELECT COUNT(*) FROM sk_documents WHERE deleted_at IS NULL AND (LOWER(REPLACE(REPLACE(unit_kerja, '''', ''), '’', '')) LIKE '%smp maarif nu 1 wanareja%' OR LOWER(unit_kerja) LIKE '%smp%nu 1 wanareja%')) AS total_sk_terdampak;


-- ==============================================================================
-- BAGIAN 2: EKSEKUSI / APPLY (TRANSAKSI DATABASE)
-- Hanya jalankan jika hasil pemeriksaan di BAGIAN 1 sudah sesuai
-- ==============================================================================
/*
BEGIN;

-- 1. Update master sekolah di tabel `schools` jika masih bernama lama
UPDATE schools 
SET nama = 'SMP Ma''arif NU 01 Wanareja',
    updated_at = NOW() 
WHERE deleted_at IS NULL 
  AND LOWER(REPLACE(REPLACE(nama, '''', ''), '’', '')) = 'smp maarif nu 1 wanareja'
  AND NOT EXISTS (
    SELECT 1 FROM schools s2 
    WHERE s2.deleted_at IS NULL 
      AND LOWER(REPLACE(REPLACE(s2.nama, '''', ''), '’', '')) = 'smp maarif nu 01 wanareja'
  );

-- 2. Update tabel `teachers`
UPDATE teachers 
SET unit_kerja = 'SMP Ma''arif NU 01 Wanareja',
    school_id = COALESCE(
      (SELECT id FROM schools 
       WHERE deleted_at IS NULL 
         AND LOWER(REPLACE(REPLACE(nama, '''', ''), '’', '')) = 'smp maarif nu 01 wanareja' 
       ORDER BY id ASC LIMIT 1),
      school_id
    ),
    kecamatan = CASE WHEN (kecamatan IS NULL OR TRIM(kecamatan) = '') THEN 'Wanareja' ELSE kecamatan END,
    updated_at = NOW()
WHERE deleted_at IS NULL 
  AND (
    LOWER(REPLACE(REPLACE(unit_kerja, '''', ''), '’', '')) LIKE '%smp maarif nu 1 wanareja%'
    OR LOWER(unit_kerja) LIKE '%smp%nu 1 wanareja%'
  );

-- 3. Update tabel `sk_documents` agar sinkron dengan data guru
UPDATE sk_documents 
SET unit_kerja = 'SMP Ma''arif NU 01 Wanareja',
    school_id = COALESCE(
      (SELECT id FROM schools 
       WHERE deleted_at IS NULL 
         AND LOWER(REPLACE(REPLACE(nama, '''', ''), '’', '')) = 'smp maarif nu 01 wanareja' 
       ORDER BY id ASC LIMIT 1),
      school_id
    ),
    updated_at = NOW()
WHERE deleted_at IS NULL 
  AND (
    LOWER(REPLACE(REPLACE(unit_kerja, '''', ''), '’', '')) LIKE '%smp maarif nu 1 wanareja%'
    OR LOWER(unit_kerja) LIKE '%smp%nu 1 wanareja%'
    OR teacher_id IN (
      SELECT id FROM teachers 
      WHERE deleted_at IS NULL 
        AND LOWER(REPLACE(REPLACE(unit_kerja, '''', ''), '’', '')) = 'smp maarif nu 01 wanareja'
    )
  );

-- 4. Tampilkan hasil sesudah update
SELECT id, nama, nuptk, nomor_induk_maarif, unit_kerja, school_id 
FROM teachers 
WHERE deleted_at IS NULL 
  AND LOWER(REPLACE(REPLACE(unit_kerja, '''', ''), '’', '')) = 'smp maarif nu 01 wanareja';

COMMIT;
*/
