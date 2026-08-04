<?php
/**
 * Script: restore_sk_hasan_puro.php
 * Tujuan: Restore (undelete) SK soft-deleted atas nama "Hasan Puro".
 *
 * PENTING: Jalankan cari_sk_hasan_puro.php DULU untuk konfirmasi ID yang akan di-restore.
 * Isi $targetIds di bawah dengan ID yang ditemukan, lalu jalankan script ini.
 *
 * Cara menjalankan via Docker VPS:
 *
 *   # Copy file ke container backend
 *   docker cp restore_sk_hasan_puro.php simmaci-backend:/var/www/
 *
 *   # Jalankan (default dry run)
 *   docker exec -it simmaci-backend php /var/www/restore_sk_hasan_puro.php
 *
 *   # Setelah yakin, ubah $dryRun = false lalu copy & jalankan ulang
 */

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

// ── KONFIGURASI: isi setelah menjalankan script pencarian ──
// Contoh: $targetIds = [123, 456];
// Kosongkan [] untuk restore SEMUA SK soft-deleted bernama "hasan puro"
$targetIds = [];

$dryRun = true; // Set false untuk benar-benar merestore

// ──────────────────────────────────────────────────────────
echo "======================================================\n";
echo " RESTORE SK: HASAN PURO\n";
echo " Mode: " . ($dryRun ? "DRY RUN (tidak ada perubahan)" : "EKSEKUSI NYATA") . "\n";
echo "======================================================\n\n";

// ── Cari SK soft-deleted ──
$query = DB::table('sk_documents')
    ->whereRaw("LOWER(nama) LIKE ?", ['%hasan%puro%'])
    ->whereNotNull('deleted_at');

if (!empty($targetIds)) {
    $query->whereIn('id', $targetIds);
    echo "Filter by ID: [" . implode(', ', $targetIds) . "]\n\n";
} else {
    echo "Filter: semua SK soft-deleted bernama 'hasan puro'\n\n";
}

$candidates = $query->get([
    'id', 'nomor_sk', 'nama', 'jabatan', 'unit_kerja',
    'jenis_sk', 'status', 'created_at', 'deleted_at',
]);

if ($candidates->isEmpty()) {
    echo "❌ Tidak ada SK soft-deleted ditemukan.\n";
    echo "   Cek dengan script cari_sk_hasan_puro.php terlebih dahulu.\n";
    exit(0);
}

echo "Ditemukan {$candidates->count()} SK untuk di-restore:\n\n";

foreach ($candidates as $sk) {
    echo "  ID:{$sk->id} | {$sk->nomor_sk} | {$sk->nama} | {$sk->jenis_sk} | {$sk->status}\n";
    echo "  Dihapus pada: {$sk->deleted_at}\n\n";
}

if ($dryRun) {
    echo "──────────────────────────────────────────────────────\n";
    echo "⚠️  DRY RUN aktif — tidak ada yang disimpan.\n";
    echo "   Untuk eksekusi nyata, ubah: \$dryRun = false;\n";
    exit(0);
}

// ── Konfirmasi ──
echo "──────────────────────────────────────────────────────\n";
echo "Lanjutkan restore {$candidates->count()} SK? (yes/no): ";
$confirm = trim(fgets(STDIN));
if (strtolower($confirm) !== 'yes') {
    echo "Dibatalkan.\n";
    exit(0);
}

// ── Eksekusi restore ──
$ids = $candidates->pluck('id')->toArray();

DB::beginTransaction();
try {
    $restoredCount = DB::table('sk_documents')
        ->whereIn('id', $ids)
        ->update(['deleted_at' => null]);

    // Restore teacher juga jika soft-deleted
    $teacherIds = DB::table('sk_documents')
        ->whereIn('id', $ids)
        ->whereNotNull('teacher_id')
        ->pluck('teacher_id')
        ->unique()
        ->toArray();

    $restoredTeachers = 0;
    if (!empty($teacherIds)) {
        $restoredTeachers = DB::table('teachers')
            ->whereIn('id', $teacherIds)
            ->whereNotNull('deleted_at')
            ->update(['deleted_at' => null]);
    }

    DB::commit();

    echo "\n✅ BERHASIL!\n";
    echo "   SK di-restore    : {$restoredCount}\n";
    echo "   Guru di-restore  : {$restoredTeachers}\n\n";

    // Tampilkan hasil
    $restored = DB::table('sk_documents')
        ->whereIn('id', $ids)
        ->get(['id', 'nomor_sk', 'nama', 'jenis_sk', 'status', 'deleted_at']);

    foreach ($restored as $sk) {
        $ok = is_null($sk->deleted_at) ? '✅' : '❌ MASIH TERHAPUS';
        echo "  {$ok} ID:{$sk->id} | {$sk->nomor_sk} | {$sk->nama} | {$sk->status}\n";
    }

} catch (\Exception $e) {
    DB::rollBack();
    echo "\n❌ ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

echo "\n======================================================\n";
echo " SELESAI\n";
echo "======================================================\n";
