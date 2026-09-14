#!/bin/bash
# ==============================================================================
# Script Reset Nilai Cabang Lomba SIMMACI (Production VPS)
# Aman digunakan saat lomba lain sedang berlangsung (Zero Downtime / Tanpa Restart)
# ==============================================================================

COMPETITION_ID=${1:-6}

echo "======================================================="
echo "   RESET NILAI CABANG LOMBA SIMMACI"
echo "   Target Cabang Lomba ID: $COMPETITION_ID"
echo "======================================================="
echo ""

# 1. Cari container backend yang aktif
CONTAINER_ID=$(docker ps --filter "name=backend" --filter "status=running" --format "{{.Names}}" | head -n 1)

if [ -z "$CONTAINER_ID" ]; then
    echo "❌ Error: Container backend tidak ditemukan atau tidak sedang berjalan."
    echo "Pastikan docker running dengan: docker ps"
    exit 1
fi

echo "✓ Menggunakan container: $CONTAINER_ID"
echo ""

# 2. Cek data yang ada saat ini sebelum dihapus (Preview)
docker exec -i "$CONTAINER_ID" php artisan tinker --execute="
\$comp = \App\Models\Competition::find($COMPETITION_ID);
if (!\$comp) {
    echo 'NOT_FOUND';
    exit;
}
echo 'NAMA: ' . \$comp->name . PHP_EOL;
echo 'TIPE: ' . \$comp->lomba_type . PHP_EOL;
echo 'TOTAL_NILAI_JURI: ' . \App\Models\CompetitionJuryScore::where('competition_id', $COMPETITION_ID)->count() . PHP_EOL;
if (in_array(\$comp->lomba_type, ['guru_berprestasi', 'madrasah_berprestasi'])) {
    echo 'TOTAL_PESERTA_ANUGERAH: ' . \App\Models\AnugerahRegistration::where('competition_id', $COMPETITION_ID)->count() . PHP_EOL;
}
"

echo ""
echo "PERINGATAN: Tindakan ini akan menghapus semua nilai juri untuk Lomba ID $COMPETITION_ID."
echo "Lomba lain (ID selain $COMPETITION_ID) TIDAK AKAN terpengaruh sama sekali."
echo ""
read -p "Ketik 'RESET' untuk melanjutkan eksekusi: " CONFIRM

if [ "$CONFIRM" != "RESET" ]; then
    echo "Operasi dibatalkan. Data tetap aman."
    exit 0
fi

echo ""
echo "Sedang mereset nilai..."

# 3. Eksekusi Reset via Laravel Eloquent (Aman dan Cepat < 1 detik)
docker exec -i "$CONTAINER_ID" php artisan tinker --execute="
\Illuminate\Support\Facades\DB::transaction(function() {
    \$delScores = \App\Models\CompetitionJuryScore::where('competition_id', $COMPETITION_ID)->delete();
    \$comp = \App\Models\Competition::find($COMPETITION_ID);
    
    if (\$comp && in_array(\$comp->lomba_type, ['guru_berprestasi', 'madrasah_berprestasi'])) {
        \$affected = \App\Models\AnugerahRegistration::where('competition_id', $COMPETITION_ID)->update([
            'total_score'     => null,
            'final_score'     => null,
            'rank'            => null,
            'reviewer_notes'  => null,
            'score_breakdown' => null,
            'status'          => 'submitted',
        ]);
        echo '✓ Berhasil menghapus ' . \$delScores . ' baris nilai juri.' . PHP_EOL;
        echo '✓ Berhasil mengembalikan ' . \$affected . ' peserta ke status submitted awal.' . PHP_EOL;
    } else {
        \$delRes = \App\Models\CompetitionResult::where('competition_id', $COMPETITION_ID)->delete();
        echo '✓ Berhasil menghapus ' . \$delScores . ' baris nilai juri.' . PHP_EOL;
        echo '✓ Berhasil menghapus ' . \$delRes . ' hasil lomba.' . PHP_EOL;
    }
});
echo '✓ SELESAI! Lomba ID $COMPETITION_ID telah bersih kembali.' . PHP_EOL;
"

echo ""
echo "======================================================="
echo "Selesai! Dewan Juri untuk lomba ID $COMPETITION_ID"
echo "sekarang dapat langsung memasukkan nilai dari awal."
echo "======================================================="
