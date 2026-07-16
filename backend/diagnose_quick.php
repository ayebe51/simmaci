<?php
/**
 * Quick diagnostic script untuk dijalankan via:
 *   php artisan tinker --execute="require 'diagnose_quick.php';"
 * atau copy-paste isinya ke tinker session.
 *
 * Jalankan dari direktori backend/.
 */

use Illuminate\Support\Facades\DB;

echo "\n=== DIAGNOSA SK GENERATOR — DATA GURU TIDAK LENGKAP ===\n\n";

// ── Ringkasan per sekolah ──
echo "── RINGKASAN PER SEKOLAH ──\n";
$summary = DB::select("
    SELECT
        sc.nama AS sekolah,
        COUNT(*) AS total,
        COUNT(*) FILTER (
            WHERE sd.teacher_id IS NULL
               OR t.deleted_at IS NOT NULL
               OR (t.nomor_induk_maarif IS NULL OR t.nomor_induk_maarif = '')
               OR (t.tmt IS NULL OR t.tmt = '')
        ) AS tidak_lengkap,
        COUNT(*) FILTER (WHERE sd.teacher_id IS NULL) AS teacher_id_null,
        COUNT(*) FILTER (WHERE t.deleted_at IS NOT NULL) AS teacher_deleted
    FROM sk_documents sd
    LEFT JOIN teachers t  ON t.id = sd.teacher_id
    LEFT JOIN schools  sc ON sc.id = sd.school_id
    WHERE sd.status IN ('pending','draft') AND sd.deleted_at IS NULL
    GROUP BY sc.id, sc.nama
    ORDER BY tidak_lengkap DESC
");

foreach ($summary as $row) {
    echo sprintf(
        "  %-40s | total:%3d | kosong:%3d | no_link:%3d | deleted:%3d\n",
        $row->sekolah ?? '(null)',
        $row->total,
        $row->tidak_lengkap,
        $row->teacher_id_null,
        $row->teacher_deleted
    );
}

// ── Detail nama-nama yang bermasalah ──
echo "\n── DETAIL NAMA YANG DATANYA TIDAK LENGKAP ──\n";
$details = DB::select("
    SELECT
        sd.id AS sk_id,
        sd.nama AS nama_di_sk,
        sc.nama AS sekolah,
        sd.teacher_id,
        t.nomor_induk_maarif AS nim,
        t.tmt,
        t.deleted_at AS teacher_deleted,

        -- exact match aktif
        (SELECT t2.id FROM teachers t2
         WHERE LOWER(TRIM(t2.nama)) = LOWER(TRIM(sd.nama))
           AND t2.school_id = sd.school_id AND t2.deleted_at IS NULL LIMIT 1) AS match_aktif_id,

        -- exact match deleted
        (SELECT t3.id FROM teachers t3
         WHERE LOWER(TRIM(t3.nama)) = LOWER(TRIM(sd.nama))
           AND t3.deleted_at IS NOT NULL LIMIT 1) AS match_deleted_id,
        (SELECT t3.deleted_at FROM teachers t3
         WHERE LOWER(TRIM(t3.nama)) = LOWER(TRIM(sd.nama))
           AND t3.deleted_at IS NOT NULL LIMIT 1) AS match_deleted_at,

        CASE
            WHEN sd.teacher_id IS NOT NULL AND t.deleted_at IS NOT NULL THEN 'TEACHER_SOFT_DELETED'
            WHEN sd.teacher_id IS NULL AND EXISTS (
                SELECT 1 FROM teachers ta
                WHERE LOWER(TRIM(ta.nama))=LOWER(TRIM(sd.nama)) AND ta.school_id=sd.school_id AND ta.deleted_at IS NULL
            ) THEN 'NO_LINK__AKTIF_ADA'
            WHEN sd.teacher_id IS NULL AND EXISTS (
                SELECT 1 FROM teachers td
                WHERE LOWER(TRIM(td.nama))=LOWER(TRIM(sd.nama)) AND td.deleted_at IS NOT NULL
            ) THEN 'NO_LINK__DELETED_ADA'
            WHEN sd.teacher_id IS NULL THEN 'NAMA_TIDAK_ADA_DI_DB'
            ELSE 'DATA_KOSONG_DI_TEACHER'
        END AS status
    FROM sk_documents sd
    LEFT JOIN teachers t  ON t.id = sd.teacher_id
    LEFT JOIN schools  sc ON sc.id = sd.school_id
    WHERE sd.status IN ('pending','draft') AND sd.deleted_at IS NULL
      AND (
          sd.teacher_id IS NULL OR t.deleted_at IS NOT NULL
          OR (t.nomor_induk_maarif IS NULL OR t.nomor_induk_maarif = '')
          OR (t.tmt IS NULL OR t.tmt = '')
      )
    ORDER BY sc.nama, sd.nama
");

$prevSchool = null;
foreach ($details as $r) {
    if ($r->sekolah !== $prevSchool) {
        echo "\n  ▶ " . ($r->sekolah ?? 'Unknown') . "\n";
        $prevSchool = $r->sekolah;
    }
    $statusIcon = match($r->status) {
        'TEACHER_SOFT_DELETED'    => '🗑  TERHAPUS',
        'NO_LINK__AKTIF_ADA'      => '🔗 NO-LINK (teacher aktif ada, perlu di-link)',
        'NO_LINK__DELETED_ADA'    => '🔗🗑 NO-LINK (teacher deleted ada)',
        'NAMA_TIDAK_ADA_DI_DB'    => '❌ TIDAK ADA DI DB',
        'DATA_KOSONG_DI_TEACHER'  => '⚠️  DATA KOSONG',
        default                   => $r->status,
    };
    echo sprintf(
        "    [SK#%d] %-45s | NIM:%-12s | TMT:%-12s | %s\n",
        $r->sk_id,
        $r->nama_di_sk,
        $r->nim ?: '-',
        $r->tmt ?: '-',
        $statusIcon
    );
    if ($r->match_deleted_id) {
        echo sprintf("           └─ Match deleted: teacher_id=%d, deleted_at=%s\n",
            $r->match_deleted_id, $r->match_deleted_at);
    }
}

// ── Status count ──
echo "\n── STATUS COUNT ──\n";
$counts = collect($details)->groupBy('status');
foreach ($counts as $status => $items) {
    echo "  {$status}: " . count($items) . "\n";
}

echo "\n═══════════════════════════════════\n";
echo "Rekomendasi:\n";
echo "  TEACHER_SOFT_DELETED   → restore teacher atau buat ulang\n";
echo "  NO_LINK__AKTIF_ADA     → jalankan: php artisan sk:link-teachers --dry-run\n";
echo "  NO_LINK__DELETED_ADA   → restore teacher dulu, lalu sk:link-teachers\n";
echo "  NAMA_TIDAK_ADA_DI_DB   → input manual ke Data GTK\n";
echo "  DATA_KOSONG_DI_TEACHER → lengkapi data di halaman Data GTK\n";
echo "\n";
