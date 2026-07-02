#!/bin/bash
# =============================================================================
# run-maintenance.sh
# Jalankan perintah maintenance SIMMACI via Docker container yang sedang aktif.
#
# Cara pakai:
#   bash run-maintenance.sh fill-kecamatan [--dry-run]
#   bash run-maintenance.sh normalize-months [--dry-run]
#   bash run-maintenance.sh all [--dry-run]
# =============================================================================

set -euo pipefail

# ── Deteksi container backend yang sedang running ─────────────────────────────
BACKEND=$(docker ps --filter "name=backend" --filter "status=running" --format "{{.Names}}" | head -1)

if [ -z "$BACKEND" ]; then
    echo "❌  Tidak ada container backend yang sedang running."
    echo "    Pastikan docker ps menampilkan container backend."
    exit 1
fi

echo "🐳  Container: $BACKEND"
echo ""

CMD="${1:-all}"
EXTRA_ARGS="${@:2}"   # teruskan argumen sisanya (misal: --dry-run)

run_artisan() {
    docker exec "$BACKEND" php artisan "$@"
}

case "$CMD" in
    fill-kecamatan)
        echo "📍  Mengisi kecamatan sekolah yang kosong..."
        run_artisan schools:fill-kecamatan $EXTRA_ARGS
        ;;
    normalize-months)
        echo "📅  Normalisasi penulisan bulan tidak baku..."
        run_artisan data:normalize-months $EXTRA_ARGS
        ;;
    all)
        echo "🚀  Menjalankan semua maintenance..."
        echo ""
        echo "── 1/2  Fill Kecamatan ──────────────────────────────────────────"
        run_artisan schools:fill-kecamatan $EXTRA_ARGS
        echo ""
        echo "── 2/2  Normalize Month Names ───────────────────────────────────"
        run_artisan data:normalize-months $EXTRA_ARGS
        echo ""
        echo "✅  Selesai."
        ;;
    *)
        echo "Usage: $0 {fill-kecamatan|normalize-months|all} [--dry-run] [--only-alamat] ..."
        exit 1
        ;;
esac
