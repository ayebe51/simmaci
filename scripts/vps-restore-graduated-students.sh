#!/usr/bin/env bash
# ==============================================================================
# SIMMACI — Script Pemulihan Siswa Terluluskan Massal (Kelas 7 & 8)
# Target Container: backend-yam0yy9a6l424v8j89hv7pqr-032515821510
# ==============================================================================
#
# Penggunaan di VPS:
#   chmod +x scripts/vps-restore-graduated-students.sh
#   ./scripts/vps-restore-graduated-students.sh --dry-run   (Hanya cek daftar siswa yang terdampak)
#   ./scripts/vps-restore-graduated-students.sh --restore   (Eksekusi pemulihan ke status 'Aktif')
#
# ==============================================================================

set -e

BACKEND_CONTAINER="backend-yam0yy9a6l424v8j89hv7pqr-032515821510"
ACTION="${1:---dry-run}"

# Pastikan container backend berjalan
if ! docker ps --format '{{.Names}}' | grep -q "^${BACKEND_CONTAINER}$"; then
    echo "❌ Error: Container ${BACKEND_CONTAINER} tidak ditemukan atau tidak sedang berjalan."
    echo "Daftar container yang berjalan saat ini:"
    docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Status}}"
    exit 1
fi

echo "=============================================================================="
echo " SIMMACI - PEMULIHAN SISWA KELAS NON-AKHIR (KELAS 7 & 8)"
echo " Container: ${BACKEND_CONTAINER}"
echo " Mode: ${ACTION}"
echo "=============================================================================="

if [ "$ACTION" == "--dry-run" ]; then
    echo "🔍 [DRY-RUN] Menghitung dan memeriksa siswa kelas non-akhir yang terhapus/Lulus..."
    echo ""

    docker exec -i "${BACKEND_CONTAINER}" php artisan tinker << 'EOF'
$students = App\Models\Student::onlyTrashed()
    ->with('school')
    ->where('status', 'Lulus')
    ->where(function($q) {
        $q->where('kelas', 'LIKE', '%7%')
          ->orWhere('kelas', 'LIKE', '%VII%')
          ->orWhere('kelas', 'LIKE', '%8%')
          ->orWhere('kelas', 'LIKE', '%VIII%')
          ->orWhere('kelas', 'LIKE', '%1%')
          ->orWhere('kelas', 'LIKE', '%2%')
          ->orWhere('kelas', 'LIKE', '%3%')
          ->orWhere('kelas', 'LIKE', '%4%')
          ->orWhere('kelas', 'LIKE', '%5%')
          ->orWhere('kelas', 'LIKE', '%10%')
          ->orWhere('kelas', 'LIKE', '%X%')
          ->orWhere('kelas', 'LIKE', '%11%')
          ->orWhere('kelas', 'LIKE', '%XI%');
    })
    ->where(function($q) {
        // Jangan sertakan kelas tingkat akhir
        $q->where('kelas', 'NOT LIKE', '%9%')
          ->where('kelas', 'NOT LIKE', '%IX%')
          ->where('kelas', 'NOT LIKE', '%6%')
          ->where('kelas', 'NOT LIKE', '%VI%')
          ->where('kelas', 'NOT LIKE', '%12%')
          ->where('kelas', 'NOT LIKE', '%XII%');
    })
    ->orderBy('school_id')
    ->orderBy('kelas')
    ->get();

$total = $students->count();
echo "\n=======================================================\n";
echo " DITEMUKAN {$total} SISWA KELAS NON-AKHIR BERSTATUS 'LULUS'\n";
echo "=======================================================\n";

if ($total === 0) {
    echo "Tidak ada siswa non-akhir yang berstatus Lulus (Soft Deleted).\n";
} else {
    $grouped = $students->groupBy('school.nama');
    foreach ($grouped as $schoolName => $items) {
        $name = $schoolName ?: 'Tanpa Nama Sekolah';
        echo "\n🏫 Sekolah: {$name} ({$items->count()} siswa)\n";
        foreach ($items as $s) {
            echo "   - [ID: {$s->id}] {$s->nama} | Kelas: {$s->kelas} | NISN: " . ($s->nisn ?: '-') . " | Dihapus: {$s->deleted_at}\n";
        }
    }
}
echo "\n💡 Untuk memulihkan siswa-siswa di atas ke status 'Aktif', jalankan:\n";
echo "   ./scripts/vps-restore-graduated-students.sh --restore\n\n";
EOF

elif [ "$ACTION" == "--restore" ]; then
    echo "⚠️  [RESTORE] Memulai proses pemulihan siswa ke status 'Aktif'..."
    echo ""

    docker exec -i "${BACKEND_CONTAINER}" php artisan tinker << 'EOF'
$students = App\Models\Student::onlyTrashed()
    ->where('status', 'Lulus')
    ->where(function($q) {
        $q->where('kelas', 'LIKE', '%7%')
          ->orWhere('kelas', 'LIKE', '%VII%')
          ->orWhere('kelas', 'LIKE', '%8%')
          ->orWhere('kelas', 'LIKE', '%VIII%')
          ->orWhere('kelas', 'LIKE', '%1%')
          ->orWhere('kelas', 'LIKE', '%2%')
          ->orWhere('kelas', 'LIKE', '%3%')
          ->orWhere('kelas', 'LIKE', '%4%')
          ->orWhere('kelas', 'LIKE', '%5%')
          ->orWhere('kelas', 'LIKE', '%10%')
          ->orWhere('kelas', 'LIKE', '%X%')
          ->orWhere('kelas', 'LIKE', '%11%')
          ->orWhere('kelas', 'LIKE', '%XI%');
    })
    ->where(function($q) {
        $q->where('kelas', 'NOT LIKE', '%9%')
          ->where('kelas', 'NOT LIKE', '%IX%')
          ->where('kelas', 'NOT LIKE', '%6%')
          ->where('kelas', 'NOT LIKE', '%VI%')
          ->where('kelas', 'NOT LIKE', '%12%')
          ->where('kelas', 'NOT LIKE', '%XII%');
    })
    ->get();

$ids = $students->pluck('id')->toArray();
$total = count($ids);

if ($total === 0) {
    echo "Tidak ada siswa yang perlu dipulihkan.\n";
} else {
    // 1. Restore soft delete
    App\Models\Student::onlyTrashed()->whereIn('id', $ids)->restore();

    // 2. Kembalikan status ke Aktif
    App\Models\Student::whereIn('id', $ids)->update([
        'status' => 'Aktif',
    ]);

    echo "\n✅ BERHASIL MEMULIHKAN {$total} SISWA!\n";
    echo "Status siswa telah dikembalikan ke 'Aktif' dan muncul kembali di daftar data siswa aktif.\n\n";
}
EOF

else
    echo "Parameter tidak dikenal: $ACTION"
    echo "Gunakan: --dry-run atau --restore"
    exit 1
fi
