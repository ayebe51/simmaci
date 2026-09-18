#!/bin/bash
# ==============================================================================
# Script Pemeriksaan Data Peserta Festival Aswaja Beregu SIMMACI (VPS)
# Aman digunakan saat server berjalan (Read-Only / Non-Destructive)
#
# Penggunaan di VPS:
#   bash check-festival-beregu.sh              # Ringkasan semua lomba beregu
#   bash check-festival-beregu.sh --details    # Rincian anggota regu
#   bash check-festival-beregu.sh --type=mars_maarif
#   bash check-festival-beregu.sh --type=puji_pujian
#   bash check-festival-beregu.sh --type=film_dokumenter
# ==============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "======================================================="
echo "   PEMERIKSAAN PESERTA FESTIVAL ASWAJA BEREGU"
echo "======================================================="
echo "Argumen: $@"
echo ""

# 1. Tentukan container backend (default: backend-yam0yy9a6l424v8j89hv7pqr-063719964430)
TARGET_BACKEND="backend-yam0yy9a6l424v8j89hv7pqr-063719964430"

if docker ps --format "{{.Names}}" | grep -q "^${TARGET_BACKEND}$"; then
    CONTAINER_ID="$TARGET_BACKEND"
else
    CONTAINER_ID=$(docker ps --filter "name=backend" --filter "status=running" --format "{{.Names}}" | head -n 1)
fi

if [ -z "$CONTAINER_ID" ]; then
    CONTAINER_ID=$(docker ps --filter "name=app" --filter "status=running" --format "{{.Names}}" | head -n 1)
fi

if [ -z "$CONTAINER_ID" ]; then
    echo "❌ Error: Container backend tidak ditemukan atau tidak sedang berjalan."
    echo "Pastikan docker running dengan: docker ps"
    exit 1
fi

echo "✓ Menggunakan container: $CONTAINER_ID"
echo "✓ Menyinkronkan command ke dalam container..."

# 2. Hapus file cache usang di dalam container
docker exec -i "$CONTAINER_ID" rm -f /var/www/html/bootstrap/cache/config.php /var/www/html/bootstrap/cache/routes-*.php /var/www/html/bootstrap/cache/packages.php /var/www/html/bootstrap/cache/services.php

# 3. Sinkronkan file command & runner script ke dalam container Docker
docker cp "$SCRIPT_DIR/backend/app/Console/Commands/CheckFestivalBeregu.php" "$CONTAINER_ID":/var/www/html/app/Console/Commands/CheckFestivalBeregu.php
docker cp "$SCRIPT_DIR/backend/run_check_festival_beregu.php" "$CONTAINER_ID":/var/www/html/run_check_festival_beregu.php

# 4. Bersihkan cache Laravel di dalam container
docker exec -i "$CONTAINER_ID" php artisan optimize:clear > /dev/null 2>&1

echo "✓ Menjalankan pemeriksaan data..."
echo ""

# 5. Jalankan audit dengan argumen yang diberikan
docker exec -it "$CONTAINER_ID" php /var/www/html/run_check_festival_beregu.php "$@"
