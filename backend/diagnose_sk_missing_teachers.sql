-- ============================================================
-- DIAGNOSA: SK Generator — Nama Guru Data Tidak Lengkap
-- Jalankan di psql atau pgAdmin terhadap database sim_maarif
-- ============================================================

-- ── 1. RINGKASAN: Berapa SK dengan data kosong per sekolah ──

SELECT
    sc.nama                                          AS sekolah,
    COUNT(*)                                         AS total_sk_generator,
    COUNT(*) FILTER (
        WHERE (t.nomor_induk_maarif IS NULL OR t.nomor_induk_maarif = '')
           OR (t.tmt IS NULL OR t.tmt = '')
           OR sd.teacher_id IS NULL
    )                                                AS data_tidak_lengkap,
    COUNT(*) FILTER (WHERE sd.teacher_id IS NULL)    AS teacher_id_null,
    COUNT(*) FILTER (
        WHERE t.deleted_at IS NOT NULL
    )                                                AS teacher_soft_deleted
FROM sk_documents sd
LEFT JOIN teachers  t  ON t.id = sd.teacher_id
LEFT JOIN schools   sc ON sc.id = sd.school_id
WHERE sd.status IN ('pending', 'draft')
  AND sd.deleted_at IS NULL
GROUP BY sc.id, sc.nama
ORDER BY data_tidak_lengkap DESC;


-- ── 2. DETAIL: Semua SK dengan data guru tidak lengkap ─────

SELECT
    sd.id                                            AS sk_id,
    sd.nomor_sk,
    sd.nama                                          AS nama_di_sk,
    sd.unit_kerja,
    sc.nama                                          AS nama_sekolah,
    sd.teacher_id,
    t.nama                                           AS nama_teacher_linked,
    t.nomor_induk_maarif                             AS nim,
    t.tmt,
    t.tempat_lahir,
    t.tanggal_lahir,
    t.deleted_at                                     AS teacher_deleted_at,

    -- Cari exact match teacher AKTIF dengan nama sama (bisa beda school)
    (
        SELECT string_agg(
            'ID:' || ta.id::text ||
            ' | ' || ta.nama ||
            ' | school_id:' || ta.school_id::text ||
            ' | NIM:' || COALESCE(ta.nomor_induk_maarif, '-') ||
            ' | TMT:' || COALESCE(ta.tmt, '-'),
            ' ;; '
        )
        FROM teachers ta
        WHERE LOWER(TRIM(ta.nama)) = LOWER(TRIM(sd.nama))
          AND ta.deleted_at IS NULL
    )                                                AS exact_match_aktif,

    -- Cari exact match teacher TERHAPUS dengan nama sama
    (
        SELECT string_agg(
            'ID:' || td.id::text ||
            ' | ' || td.nama ||
            ' | school_id:' || td.school_id::text ||
            ' | NIM:' || COALESCE(td.nomor_induk_maarif, '-') ||
            ' | TMT:' || COALESCE(td.tmt, '-') ||
            ' | DELETED:' || td.deleted_at::text,
            ' ;; '
        )
        FROM teachers td
        WHERE LOWER(TRIM(td.nama)) = LOWER(TRIM(sd.nama))
          AND td.deleted_at IS NOT NULL
    )                                                AS exact_match_deleted,

    -- Diagnosis otomatis
    CASE
        WHEN sd.teacher_id IS NOT NULL AND t.deleted_at IS NOT NULL
            THEN 'TEACHER_SOFT_DELETED'
        WHEN sd.teacher_id IS NULL AND EXISTS (
            SELECT 1 FROM teachers ta
            WHERE LOWER(TRIM(ta.nama)) = LOWER(TRIM(sd.nama))
              AND ta.school_id = sd.school_id
              AND ta.deleted_at IS NULL
        )   THEN 'NO_LINK__TEACHER_AKTIF_ADA'
        WHEN sd.teacher_id IS NULL AND EXISTS (
            SELECT 1 FROM teachers td
            WHERE LOWER(TRIM(td.nama)) = LOWER(TRIM(sd.nama))
              AND td.deleted_at IS NOT NULL
        )   THEN 'NO_LINK__TEACHER_DELETED'
        WHEN sd.teacher_id IS NULL AND NOT EXISTS (
            SELECT 1 FROM teachers tx
            WHERE LOWER(TRIM(tx.nama)) = LOWER(TRIM(sd.nama))
        )   THEN 'NAMA_TIDAK_ADA_DI_DB'
        WHEN sd.teacher_id IS NOT NULL AND t.id IS NOT NULL
            THEN 'DATA_KOSONG_DI_RECORD_TEACHER'
        ELSE 'UNKNOWN'
    END                                              AS status_diagnosis,

    sd.created_at

FROM sk_documents sd
LEFT JOIN teachers  t  ON t.id = sd.teacher_id
LEFT JOIN schools   sc ON sc.id = sd.school_id
WHERE sd.status IN ('pending', 'draft')
  AND sd.deleted_at IS NULL
  AND (
      sd.teacher_id IS NULL
      OR t.deleted_at IS NOT NULL
      OR (t.nomor_induk_maarif IS NULL OR t.nomor_induk_maarif = '')
      OR (t.tmt IS NULL OR t.tmt = '')
  )
ORDER BY sc.nama, sd.nama;


-- ── 3. TEACHERS YANG TERHAPUS (soft-deleted) dan ada di SK generator ──

SELECT
    t.id                                             AS teacher_id,
    t.nama                                           AS nama_teacher,
    sc.nama                                          AS nama_sekolah,
    t.school_id,
    t.nomor_induk_maarif                             AS nim,
    t.tmt,
    t.tempat_lahir,
    t.tanggal_lahir,
    t.deleted_at                                     AS tanggal_hapus,
    COUNT(sd.id)                                     AS jumlah_sk_terkait,
    string_agg(sd.nomor_sk, ', ')                    AS nomor_sk_terkait
FROM teachers t
LEFT JOIN schools sc ON sc.id = t.school_id
JOIN sk_documents sd
    ON (
        sd.teacher_id = t.id
        OR LOWER(TRIM(sd.nama)) = LOWER(TRIM(t.nama))
    )
WHERE t.deleted_at IS NOT NULL
  AND sd.status IN ('pending', 'draft')
  AND sd.deleted_at IS NULL
GROUP BY t.id, t.nama, sc.nama, t.school_id, t.nomor_induk_maarif,
         t.tmt, t.tempat_lahir, t.tanggal_lahir, t.deleted_at
ORDER BY t.deleted_at DESC;


-- ── 4. ACTIVITY LOG: Siapa yang menghapus teacher tersebut ──

SELECT
    al.id,
    al.subject_id                                    AS teacher_id,
    t.nama                                           AS nama_teacher,
    al.event,
    al.description,
    al.causer_id,
    u.name                                           AS dihapus_oleh,
    u.email                                          AS email_penghapus,
    al.created_at                                    AS waktu_aksi
FROM activity_logs al
LEFT JOIN teachers t ON t.id::text = al.subject_id
LEFT JOIN users u ON u.id = al.causer_id
WHERE al.subject_type = 'App\Models\Teacher'
  AND al.event IN ('deleted', 'forceDeleted', 'force_deleted')
  AND t.deleted_at IS NOT NULL
  AND EXISTS (
      SELECT 1 FROM sk_documents sd
      WHERE sd.status IN ('pending', 'draft')
        AND sd.deleted_at IS NULL
        AND (
            sd.teacher_id = t.id
            OR LOWER(TRIM(sd.nama)) = LOWER(TRIM(t.nama))
        )
  )
ORDER BY al.created_at DESC;


-- ── 5. QUICK FIX PREVIEW: SK yang bisa langsung di-link ke teacher aktif ──
--    (jalankan UPDATE-nya hanya setelah yakin datanya benar)

SELECT
    sd.id                                            AS sk_id,
    sd.nomor_sk,
    sd.nama                                          AS nama_di_sk,
    sd.school_id,
    sc.nama                                          AS nama_sekolah,
    t.id                                             AS teacher_id_cocok,
    t.nama                                           AS nama_teacher,
    t.nomor_induk_maarif                             AS nim,
    t.tmt
FROM sk_documents sd
LEFT JOIN schools sc ON sc.id = sd.school_id
JOIN teachers t
    ON LOWER(TRIM(t.nama)) = LOWER(TRIM(sd.nama))
    AND t.school_id = sd.school_id
    AND t.deleted_at IS NULL
WHERE sd.status IN ('pending', 'draft')
  AND sd.deleted_at IS NULL
  AND sd.teacher_id IS NULL
ORDER BY sc.nama, sd.nama;

-- JALANKAN UPDATE INI SETELAH YAKIN:
-- UPDATE sk_documents sd
-- SET teacher_id = t.id,
--     updated_at = NOW()
-- FROM teachers t
-- WHERE LOWER(TRIM(t.nama)) = LOWER(TRIM(sd.nama))
--   AND t.school_id = sd.school_id
--   AND t.deleted_at IS NULL
--   AND sd.teacher_id IS NULL
--   AND sd.status IN ('pending', 'draft')
--   AND sd.deleted_at IS NULL;


-- ── 6. RESTORE TEACHERS: Preview teacher yang bisa di-restore ────────────
--    (untuk kasus TEACHER_SOFT_DELETED yang masih dibutuhkan SK)

SELECT
    t.id,
    t.nama,
    sc.nama                                          AS sekolah,
    t.nomor_induk_maarif                             AS nim,
    t.tmt,
    t.deleted_at                                     AS deleted_on,
    COUNT(sd.id)                                     AS jumlah_sk_pending
FROM teachers t
LEFT JOIN schools sc ON sc.id = t.school_id
JOIN sk_documents sd
    ON (sd.teacher_id = t.id OR LOWER(TRIM(sd.nama)) = LOWER(TRIM(t.nama)))
WHERE t.deleted_at IS NOT NULL
  AND sd.status IN ('pending', 'draft')
  AND sd.deleted_at IS NULL
GROUP BY t.id, t.nama, sc.nama, t.nomor_induk_maarif, t.tmt, t.deleted_at
ORDER BY t.deleted_at DESC;

-- RESTORE (hilangkan soft-delete) — jalankan setelah konfirmasi:
-- UPDATE teachers SET deleted_at = NULL, updated_at = NOW()
-- WHERE id IN (<id1>, <id2>, ...);
