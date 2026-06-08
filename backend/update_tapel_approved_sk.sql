-- ============================================================
-- BACKFILL tahun_ajaran untuk SK yang sudah approved/active
-- tapi belum memiliki tahun_ajaran (NULL)
--
-- Cara jalankan di server:
--   psql -U <user> -d <database> -f update_tapel_approved_sk.sql
-- Atau paste langsung di DBeaver / pgAdmin
-- ============================================================

BEGIN;

-- Cek dulu: berapa baris yang akan diupdate dan distribusinya per tahun
SELECT
    EXTRACT(YEAR FROM created_at)::int AS tahun_buat,
    EXTRACT(YEAR FROM created_at)::text || '/' || (EXTRACT(YEAR FROM created_at) + 1)::text AS tapel_yang_akan_diisi,
    COUNT(*) AS jumlah_sk
FROM sk_documents
WHERE tahun_ajaran IS NULL
  AND status IN ('approved', 'active', 'Approved', 'Active')
  AND deleted_at IS NULL
GROUP BY EXTRACT(YEAR FROM created_at)
ORDER BY tahun_buat;

-- ============================================================
-- Jalankan UPDATE: isi tahun_ajaran dari tahun created_at
-- Contoh: created_at = 2026-xx-xx → tahun_ajaran = '2026/2027'
--         created_at = 2025-xx-xx → tahun_ajaran = '2025/2026'
-- ============================================================
UPDATE sk_documents
SET tahun_ajaran = EXTRACT(YEAR FROM created_at)::text
                   || '/'
                   || (EXTRACT(YEAR FROM created_at) + 1)::text
WHERE tahun_ajaran IS NULL
  AND status IN ('approved', 'active', 'Approved', 'Active')
  AND deleted_at IS NULL;

-- Tampilkan hasil setelah update
SELECT
    tahun_ajaran,
    COUNT(*) AS jumlah_sk
FROM sk_documents
WHERE status IN ('approved', 'active', 'Approved', 'Active')
  AND deleted_at IS NULL
GROUP BY tahun_ajaran
ORDER BY tahun_ajaran;

-- Jika hasilnya sesuai harapan, jalankan COMMIT.
-- Jika tidak sesuai, jalankan ROLLBACK.
COMMIT;
-- ROLLBACK;
