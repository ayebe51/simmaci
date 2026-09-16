#!/bin/bash
# ==============================================================================
# Script Hitung Ulang & Normalisasi Nilai Lomba SIMMACI (Production VPS)
# Aman digunakan saat server berjalan (Zero Downtime / Non-Destructive)
#
# Penggunaan:
#   bash recalculate-scores.sh
#   bash recalculate-scores.sh --normalize
#   bash recalculate-scores.sh <competition_id>
#   bash recalculate-scores.sh <competition_id> --normalize
# ==============================================================================

echo "======================================================="
echo "   REKALKULASI & NORMALISASI NILAI JURI SIMMACI"
echo "======================================================="
echo "Argumen: $@"
echo ""

# 1. Cari container backend yang aktif
CONTAINER_ID=$(docker ps --filter "name=backend" --filter "status=running" --format "{{.Names}}" | head -n 1)

if [ -z "$CONTAINER_ID" ]; then
    CONTAINER_ID=$(docker ps --filter "name=app" --filter "status=running" --format "{{.Names}}" | head -n 1)
fi

if [ -z "$CONTAINER_ID" ]; then
    echo "❌ Error: Container backend tidak ditemukan atau tidak sedang berjalan."
    echo "Pastikan docker running dengan: docker ps"
    exit 1
fi

echo "✓ Menggunakan container: $CONTAINER_ID"
echo "Menjalankan php artisan competition:recalculate-scores $@ ..."
echo ""

# 2. Jalankan perintah artisan di dalam container
docker exec -i "$CONTAINER_ID" php artisan competition:recalculate-scores "$@"

echo ""
echo "======================================================="
echo "✓ Selesai! Semua nilai dan peringkat telah diperbarui."
echo "======================================================="
