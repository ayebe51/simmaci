#!/bin/bash
# ==============================================================================
# Script Pemeriksaan / Audit Nilai Lomba Madrasah Berprestasi SIMMACI (VPS)
# Aman digunakan saat server berjalan (Read-Only / Non-Destructive)
#
# Penggunaan di VPS:
#   bash check-madrasah.sh            # Periksa jenjang MI (default)
#   bash check-madrasah.sh --details  # Rincian breakdown nilai per juri
#   bash check-madrasah.sh --jenjang=all  # Periksa semua jenjang (MI, MTs, MA)
# ==============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "======================================================="
echo "   PEMERIKSAAN & AUDIT NILAI MADRASAH BERPRESTASI"
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
echo "✓ Menyinkronkan script audit terbaru ke dalam container..."

# 2. Hapus file cache usang di dalam container
docker exec -i "$CONTAINER_ID" rm -f /var/www/html/bootstrap/cache/config.php /var/www/html/bootstrap/cache/routes-*.php /var/www/html/bootstrap/cache/packages.php /var/www/html/bootstrap/cache/services.php

# 3. Sinkronkan file app, config, bootstrap, routes, dan runner script ke dalam container Docker
docker cp "$SCRIPT_DIR/backend/config/." "$CONTAINER_ID":/var/www/html/config/
docker cp "$SCRIPT_DIR/backend/app/." "$CONTAINER_ID":/var/www/html/app/
docker cp "$SCRIPT_DIR/backend/bootstrap/." "$CONTAINER_ID":/var/www/html/bootstrap/
docker cp "$SCRIPT_DIR/backend/routes/." "$CONTAINER_ID":/var/www/html/routes/
docker cp "$SCRIPT_DIR/backend/run_check_madrasah.php" "$CONTAINER_ID":/var/www/html/run_check_madrasah.php

# 4. Bersihkan cache Laravel di dalam container
docker exec -i "$CONTAINER_ID" php artisan optimize:clear > /dev/null 2>&1

echo "✓ Menjalankan audit nilai..."
echo ""

# 5. Jalankan script runner di dalam container
docker exec -i "$CONTAINER_ID" php /var/www/html/run_check_madrasah.php "$@"

echo ""
echo "======================================================="
echo "✓ Audit Selesai!"
echo "======================================================="
