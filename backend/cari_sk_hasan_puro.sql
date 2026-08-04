-- ============================================================
-- Script: cari_sk_hasan_puro.sql
-- Tujuan: Cari pengajuan SK "Hasan Puro" termasuk soft-deleted
--
-- Cara menjalankan via Docker VPS (SSH ke server dulu):
--
--   docker exec -i simmaci-db psql -U sim_user -d sim_maarif < cari_sk_hasan_puro.sql
--
-- Atau one-liner langsung tanpa copy file:
--   docker exec simmaci-db psql -U sim_user -d sim_maarif \
--     -c "SELECT id,nomor_sk,nama,unit_kerja,jenis_sk,status,created_at,deleted_at FROM sk_documents WHERE LOWER(nama) LIKE '%hasan%puro%';"
-- ============================================================

-- ── 1. SK Documents (aktif + soft-deleted) ──────────────────
\echo '=== SK DOCUMENTS (termasuk soft-deleted) ==='
SELECT
    id,
    nomor_sk,
    nama,
    jabatan,
    unit_kerja,
    jenis_sk,
    jenis_pengajuan,
    status,
    tanggal_penetapan,
    teacher_id,
    school_id,
    created_at,
    deleted_at,
    CASE WHEN deleted_at IS NOT NULL THEN 'SOFT-DELETED' ELSE 'AKTIF' END AS kondisi
FROM sk_documents
WHERE LOWER(nama) LIKE '%hasan%puro%'
ORDER BY created_at DESC;

-- ── 2. Teachers (aktif + soft-deleted) ──────────────────────
\echo ''
\echo '=== TEACHERS (termasuk soft-deleted) ==='
SELECT
    id,
    nama,
    nuptk,
    nomor_induk_maarif,
    nip,
    unit_kerja,
    school_id,
    status,
    is_active,
    created_at,
    deleted_at,
    CASE WHEN deleted_at IS NOT NULL THEN 'SOFT-DELETED' ELSE 'AKTIF' END AS kondisi
FROM teachers
WHERE LOWER(nama) LIKE '%hasan%puro%'
ORDER BY created_at DESC;

-- ── 3. Semua SK yang dimiliki teacher bernama "hasan puro" ──
\echo ''
\echo '=== SEMUA SK MILIK TEACHER "HASAN PURO" ==='
SELECT
    sk.id,
    sk.nomor_sk,
    sk.nama,
    sk.jabatan,
    sk.unit_kerja,
    sk.jenis_sk,
    sk.jenis_pengajuan,
    sk.status,
    sk.tanggal_penetapan,
    sk.teacher_id,
    sk.created_at,
    sk.deleted_at,
    CASE WHEN sk.deleted_at IS NOT NULL THEN 'SOFT-DELETED' ELSE 'AKTIF' END AS kondisi
FROM sk_documents sk
INNER JOIN teachers t ON sk.teacher_id = t.id
WHERE LOWER(t.nama) LIKE '%hasan%puro%'
ORDER BY sk.created_at DESC;

-- ── 4. Cari juga berdasarkan unit_kerja "puro" (jika nama beda) ──
\echo ''
\echo '=== SK DENGAN UNIT_KERJA MENGANDUNG "PURO" ==='
SELECT
    id,
    nomor_sk,
    nama,
    jabatan,
    unit_kerja,
    jenis_sk,
    status,
    created_at,
    deleted_at,
    CASE WHEN deleted_at IS NOT NULL THEN 'SOFT-DELETED' ELSE 'AKTIF' END AS kondisi
FROM sk_documents
WHERE LOWER(unit_kerja) LIKE '%puro%'
  AND LOWER(nama) LIKE '%hasan%'
ORDER BY created_at DESC;

-- ── 5. Activity log — jejak operasi delete/update ───────────
\echo ''
\echo '=== ACTIVITY LOG (jejak hapus/perubahan) ==='
SELECT
    id,
    description,
    event,
    subject_type,
    subject_id,
    causer_id,
    created_at,
    properties
FROM activity_log
WHERE LOWER(description) LIKE '%hasan%puro%'
   OR LOWER(properties::text) LIKE '%hasan%puro%'
ORDER BY created_at DESC
LIMIT 20;

-- ── 6. Jika soft-deleted ditemukan — tampilkan untuk restore ──
\echo ''
\echo '=== KANDIDAT RESTORE (SK soft-deleted bernama hasan puro) ==='
SELECT
    id,
    nomor_sk,
    nama,
    unit_kerja,
    jenis_sk,
    status,
    created_at,
    deleted_at
FROM sk_documents
WHERE LOWER(nama) LIKE '%hasan%puro%'
  AND deleted_at IS NOT NULL
ORDER BY deleted_at DESC;
