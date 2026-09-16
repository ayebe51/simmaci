#!/bin/bash
# ==============================================================================
# Script Hapus Nilai Juri Muhtarom (Non-MI) pada Lomba Guru Berprestasi SIMMACI
# Aman digunakan saat server berjalan (Zero Downtime / Non-Destructive)
#
# Penggunaan di VPS:
#   bash fix-muhtarom.sh            # Eksekusi langsung (hapus non-MI & hitung ulang)
#   bash fix-muhtarom.sh --dry-run  # Preview daftar nilai tanpa mengubah data
# ==============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "======================================================="
echo "   HAPUS NILAI NON-MI JURI MUHTAROM (GURU BERPRESTASI)"
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

# 2. Sinkronkan file app, bootstrap, dan runner script ke dalam container Docker
docker cp "$SCRIPT_DIR/backend/app/." "$CONTAINER_ID":/var/www/html/app/
docker cp "$SCRIPT_DIR/backend/bootstrap/." "$CONTAINER_ID":/var/www/html/bootstrap/
docker cp "$SCRIPT_DIR/backend/run_muhtarom_fix.php" "$CONTAINER_ID":/var/www/html/run_muhtarom_fix.php

# 3. Bersihkan cache Laravel di dalam container
docker exec -i "$CONTAINER_ID" php artisan optimize:clear > /dev/null 2>&1

echo "✓ Menjalankan pembersihan nilai..."
echo ""

# 4. Jalankan script runner di dalam container
docker exec -i "$CONTAINER_ID" php /var/www/html/run_muhtarom_fix.php "$@"

echo ""
echo "======================================================="
echo "✓ Selesai!"
echo "======================================================="
