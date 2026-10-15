-- ==============================================================================
-- SIMMACI: CEK GURU TERHAPUS & STATUS DOKUMEN SK - MI MA'ARIF NU 01 KALISABUK
-- Database: PostgreSQL (sim_maarif)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DATA MASTER SEKOLAH KALISABUK
-- ------------------------------------------------------------------------------
SELECT id, nama, npsn, jenjang, kecamatan, deleted_at
FROM schools
WHERE nama ILIKE '%Kalisabuk%';

-- ------------------------------------------------------------------------------
-- 2. REKAP STATUS GURU KALISABUK (AKTIF VS TERHAPUS)
-- ------------------------------------------------------------------------------
SELECT 
    CASE 
        WHEN t.deleted_at IS NOT NULL THEN 'GURU TERHAPUS (Soft-Deleted)'
        ELSE 'GURU AKTIF'
    END AS status_guru,
    COUNT(*) AS jumlah_guru
FROM teachers t
WHERE t.school_id IN (SELECT id FROM schools WHERE nama ILIKE '%Kalisabuk%')
   OR t.unit_kerja ILIKE '%Kalisabuk%'
GROUP BY status_guru;

-- ------------------------------------------------------------------------------
-- 3. DAFTAR LENGKAP GURU KALISABUK YANG TERHAPUS (SOFT-DELETED)
--    Beserta jumlah dokumen SK yang dimiliki masing-masing guru
-- ------------------------------------------------------------------------------
SELECT 
    t.id AS teacher_id,
    t.nama AS nama_guru,
    t.nuptk,
    t.nomor_induk_maarif AS nim,
    t.nip,
    t.unit_kerja,
    t.school_id,
    t.deleted_at AS waktu_guru_dihapus,
    -- Hitung SK aktif yang dimiliki
    (
        SELECT COUNT(*) 
        FROM sk_documents sk 
        WHERE sk.teacher_id = t.id AND sk.deleted_at IS NULL
    ) AS jumlah_sk_aktif,
    -- Hitung SK terhapus yang dimiliki
    (
        SELECT COUNT(*) 
        FROM sk_documents sk 
        WHERE sk.teacher_id = t.id AND sk.deleted_at IS NOT NULL
    ) AS jumlah_sk_terhapus
FROM teachers t
WHERE t.deleted_at IS NOT NULL
  AND (
      t.school_id IN (SELECT id FROM schools WHERE nama ILIKE '%Kalisabuk%')
      OR t.unit_kerja ILIKE '%Kalisabuk%'
  )
ORDER BY waktu_guru_dihapus DESC;

-- ------------------------------------------------------------------------------
-- 4. DETAIL DOKUMEN SK DARI GURU KALISABUK YANG SUDAH TERHAPUS
-- ------------------------------------------------------------------------------
SELECT 
    sk.id AS sk_id,
    sk.nomor_sk,
    sk.jenis_sk,
    sk.jabatan,
    sk.status AS status_sk,
    sk.deleted_at AS sk_deleted_at,
    t.id AS teacher_id,
    t.nama AS nama_guru_terhapus,
    t.deleted_at AS waktu_guru_dihapus
FROM sk_documents sk
INNER JOIN teachers t ON t.id = sk.teacher_id
WHERE t.deleted_at IS NOT NULL
  AND (
      sk.school_id IN (SELECT id FROM schools WHERE nama ILIKE '%Kalisabuk%')
      OR sk.unit_kerja ILIKE '%Kalisabuk%'
      OR t.school_id IN (SELECT id FROM schools WHERE nama ILIKE '%Kalisabuk%')
      OR t.unit_kerja ILIKE '%Kalisabuk%'
  )
ORDER BY sk.id DESC;

-- ------------------------------------------------------------------------------
-- 5. SEMUA DOKUMEN SK DI KALISABUK (UNTUK CROSS-CHECK KELENGKAPAN)
-- ------------------------------------------------------------------------------
SELECT 
    sk.id AS sk_id,
    sk.nomor_sk,
    sk.nama AS nama_pada_sk,
    sk.status,
    sk.teacher_id,
    CASE 
        WHEN sk.teacher_id IS NULL THEN 'BELUM ADA TEACHER_ID'
        WHEN t.deleted_at IS NOT NULL THEN 'TEACHER TERHAPUS'
        ELSE 'TEACHER AKTIF'
    END AS status_relasi_guru,
    t.nama AS nama_di_tabel_teachers,
    sk.created_at
FROM sk_documents sk
LEFT JOIN teachers t ON t.id = sk.teacher_id
WHERE (
    sk.school_id IN (SELECT id FROM schools WHERE nama ILIKE '%Kalisabuk%')
    OR sk.unit_kerja ILIKE '%Kalisabuk%'
)
ORDER BY sk.created_at DESC;
