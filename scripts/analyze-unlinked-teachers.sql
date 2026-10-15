-- ==============================================================================
-- SIMMACI: ANALISIS GURU YANG TIDAK TERHUBUNG DENGAN SEKOLAH
-- Database: PostgreSQL (sim_maarif)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RINGKASAN STATISTIK STATUS KETERHUBUNGAN GURU DENGAN SEKOLAH
-- ------------------------------------------------------------------------------
SELECT 
    CASE 
        -- Terhubung normal
        WHEN t.school_id IS NOT NULL 
             AND s.id IS NOT NULL 
             AND s.deleted_at IS NULL THEN '1. Terhubung Normal ke Sekolah Aktif'
        
        -- school_id NULL tapi ada unit_kerja
        WHEN t.school_id IS NULL 
             AND t.unit_kerja IS NOT NULL 
             AND TRIM(t.unit_kerja) != '' 
             AND TRIM(t.unit_kerja) != '-' THEN '2. school_id NULL (Ada Nama Unit Kerja)'
        
        -- school_id NULL dan unit_kerja kosong (Yatim Piatu)
        WHEN t.school_id IS NULL 
             AND (t.unit_kerja IS NULL OR TRIM(t.unit_kerja) = '' OR TRIM(t.unit_kerja) = '-') THEN '3. school_id NULL & Unit Kerja Kosong (Yatim)'
        
        -- school_id mengarah ke sekolah yang di-soft-delete
        WHEN t.school_id IS NOT NULL 
             AND s.id IS NOT NULL 
             AND s.deleted_at IS NOT NULL THEN '4. Terhubung ke Sekolah Soft-Deleted'
        
        -- school_id orphan (id tidak ada di tabel schools)
        WHEN t.school_id IS NOT NULL 
             AND s.id IS NULL THEN '5. school_id Orphan (ID Sekolah Hilang)'
        
        ELSE '6. Status Lainnya'
    END AS status_relasi,
    COUNT(*) AS jumlah_guru,
    ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM teachers WHERE deleted_at IS NULL), 0), 2) AS persentase
FROM teachers t
LEFT JOIN schools s ON s.id = t.school_id
WHERE t.deleted_at IS NULL
GROUP BY status_relasi
ORDER BY status_relasi;


-- ------------------------------------------------------------------------------
-- 2. DAFTAR GURU DENGAN school_id NULL TETAPI ADA NAMA UNIT KERJA
--    Disertai pencarian otomatis sekolah yang namanya sama/mirip di tabel schools
-- ------------------------------------------------------------------------------
SELECT 
    t.id AS teacher_id,
    t.nama AS nama_guru,
    COALESCE(t.nuptk, '-') AS nuptk,
    COALESCE(t.nomor_induk_maarif, '-') AS nim,
    t.unit_kerja,
    t.is_active AS status_aktif,
    s_exact.id AS id_sekolah_cocok,
    s_exact.nama AS nama_sekolah_cocok,
    s_exact.kecamatan AS kecamatan_sekolah
FROM teachers t
-- Cek exact match (case-insensitive & trim)
LEFT JOIN schools s_exact 
    ON LOWER(TRIM(s_exact.nama)) = LOWER(TRIM(t.unit_kerja))
    AND s_exact.deleted_at IS NULL
WHERE t.deleted_at IS NULL
  AND t.school_id IS NULL
  AND t.unit_kerja IS NOT NULL
  AND TRIM(t.unit_kerja) NOT IN ('', '-', 'null', 'NULL')
ORDER BY t.unit_kerja, t.nama;


-- ------------------------------------------------------------------------------
-- 3. DAFTAR GURU YATIM PIATU (school_id NULL DAN unit_kerja KOSONG)
-- ------------------------------------------------------------------------------
SELECT 
    t.id AS teacher_id,
    t.nama AS nama_guru,
    COALESCE(t.nuptk, '-') AS nuptk,
    COALESCE(t.nomor_induk_maarif, '-') AS nim,
    COALESCE(t.nip, '-') AS nip,
    t.kecamatan,
    t.is_active AS status_aktif,
    t.created_at
FROM teachers t
WHERE t.deleted_at IS NULL
  AND t.school_id IS NULL
  AND (t.unit_kerja IS NULL OR TRIM(t.unit_kerja) IN ('', '-', 'null', 'NULL'))
ORDER BY t.created_at DESC;


-- ------------------------------------------------------------------------------
-- 4. DAFTAR GURU DENGAN school_id ORPHAN (ID SEKOLAH TIDAK ADA DI TABEL SCHOOLS)
-- ------------------------------------------------------------------------------
SELECT 
    t.id AS teacher_id,
    t.nama AS nama_guru,
    t.school_id AS invalid_school_id,
    t.unit_kerja,
    t.is_active AS status_aktif
FROM teachers t
LEFT JOIN schools s ON s.id = t.school_id
WHERE t.deleted_at IS NULL
  AND t.school_id IS NOT NULL
  AND s.id IS NULL
ORDER BY t.school_id;


-- ------------------------------------------------------------------------------
-- 5. DAFTAR GURU YANG TERHUBUNG KE SEKOLAH SOFT-DELETED
-- ------------------------------------------------------------------------------
SELECT 
    t.id AS teacher_id,
    t.nama AS nama_guru,
    t.school_id,
    s.nama AS nama_sekolah_terhapus,
    s.npsn,
    s.deleted_at AS waktu_sekolah_dihapus,
    t.is_active AS status_guru_aktif
FROM teachers t
INNER JOIN schools s ON s.id = t.school_id
WHERE t.deleted_at IS NULL
  AND s.deleted_at IS NOT NULL
ORDER BY s.deleted_at DESC;


-- ------------------------------------------------------------------------------
-- 6. POTENSI MISMATCH NAMA (unit_kerja berbeda jauh dari nama sekolah terhubung)
-- ------------------------------------------------------------------------------
SELECT 
    t.id AS teacher_id,
    t.nama AS nama_guru,
    t.unit_kerja AS unit_kerja_guru,
    t.school_id,
    s.nama AS nama_sekolah_terhubung,
    s.kecamatan AS kecamatan_sekolah
FROM teachers t
INNER JOIN schools s ON s.id = t.school_id AND s.deleted_at IS NULL
WHERE t.deleted_at IS NULL
  AND t.unit_kerja IS NOT NULL
  AND TRIM(t.unit_kerja) NOT IN ('', '-', 'null', 'NULL')
  AND LOWER(TRIM(t.unit_kerja)) != LOWER(TRIM(s.nama))
  AND POSITION(LOWER(TRIM(t.unit_kerja)) IN LOWER(TRIM(s.nama))) = 0
  AND POSITION(LOWER(TRIM(s.nama)) IN LOWER(TRIM(t.unit_kerja))) = 0
ORDER BY s.nama, t.nama;


-- ------------------------------------------------------------------------------
-- 7. DAMPAK KE DOKUMEN SK & LAYANAN TERKAIT DARI GURU TANPA SEKOLAH
-- ------------------------------------------------------------------------------
SELECT 
    t.id AS teacher_id,
    t.nama AS nama_guru,
    t.unit_kerja,
    (SELECT COUNT(*) FROM sk_documents sk WHERE sk.teacher_id = t.id AND sk.deleted_at IS NULL) AS jumlah_sk,
    (SELECT COUNT(*) FROM headmaster_tenures ht WHERE ht.teacher_id = t.id) AS riwayat_kepala_madrasah,
    (SELECT COUNT(*) FROM nuptk_submissions ns WHERE ns.teacher_id = t.id) AS pengajuan_nuptk
FROM teachers t
WHERE t.deleted_at IS NULL
  AND (
      t.school_id IS NULL 
      OR t.school_id NOT IN (SELECT id FROM schools WHERE deleted_at IS NULL)
  )
ORDER BY jumlah_sk DESC, t.nama;


-- ------------------------------------------------------------------------------
-- 8. QUERY PERBAIKAN CEPAT (EXACT MATCH AUTO-LINK)
--    Gunakan query ini HANYA jika ingin menghubungkan guru yang nama unit_kerja-nya
--    sama persis (case-insensitive) dengan nama sekolah aktif di database:
-- ------------------------------------------------------------------------------
-- UPDATE teachers t
-- SET school_id = s.id, updated_at = NOW()
-- FROM schools s
-- WHERE t.deleted_at IS NULL
--   AND t.school_id IS NULL
--   AND t.unit_kerja IS NOT NULL
--   AND s.deleted_at IS NULL
--   AND LOWER(TRIM(t.unit_kerja)) = LOWER(TRIM(s.nama));
