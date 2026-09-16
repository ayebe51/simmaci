#!/bin/bash
# ==============================================================================
# Script Hitung Ulang & Rekalkulasi Nilai Lomba SIMMACI (Production VPS)
# Aman digunakan saat server berjalan (Zero Downtime / Non-Destructive)
#
# Penggunaan:
#   bash recalculate-scores.sh
#   bash recalculate-scores.sh <competition_id>
#   bash recalculate-scores.sh --normalize
# ==============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "======================================================="
echo "   REKALKULASI NILAI JURI SIMMACI (APA ADANYA)"
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
echo "✓ Menyinkronkan file backend terbaru ke dalam container..."

# 2. Sinkronkan file app dan bootstrap ke dalam container Docker
docker cp "$SCRIPT_DIR/backend/app/." "$CONTAINER_ID":/var/www/html/app/
docker cp "$SCRIPT_DIR/backend/bootstrap/." "$CONTAINER_ID":/var/www/html/bootstrap/

# 3. Bersihkan cache Laravel di dalam container
docker exec -i "$CONTAINER_ID" php artisan optimize:clear > /dev/null 2>&1

echo "Menjalankan php artisan competition:recalculate-scores $@ ..."
echo ""

# 4. Jalankan perintah artisan di dalam container
docker exec -i "$CONTAINER_ID" php artisan competition:recalculate-scores "$@"

echo ""
echo "======================================================="
echo "✓ Selesai! Semua nilai dan peringkat telah diperbarui."
echo "======================================================="
