#!/bin/bash
# ==============================================================================
# Script Perbaikan Satminkal Guru Wanareja di Docker VPS
# SMP Ma'arif NU 1 Wanareja  ==>  SMP Ma'arif NU 01 Wanareja
#
# Penggunaan di VPS:
#   1. Mode Simulasi / Preview (Aman, tanpa ubah data):
#      bash fix-satminkal-wanareja.sh
#      bash fix-satminkal-wanareja.sh --dry-run
#
#   2. Mode Eksekusi / Simpan Perubahan ke Database:
#      bash fix-satminkal-wanareja.sh --apply
#
#   3. Ubah hanya guru-guru tertentu berdasarkan ID:
#      bash fix-satminkal-wanareja.sh --apply --ids=12,15,48
# ==============================================================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "======================================================================"
echo "    PERBAIKAN SATMINKAL GURU SIMMACI (SMP MA'ARIF NU WANAREJA)"
echo "======================================================================"
echo "Argumen: $@"
echo ""

# 1. Cari container backend yang aktif (support simmaci-backend, backend, atau coolify container)
CONTAINER_ID=$(docker ps --filter "name=backend" --filter "status=running" --format "{{.Names}}" | head -n 1)

if [ -z "$CONTAINER_ID" ]; then
    CONTAINER_ID=$(docker ps --filter "name=app" --filter "status=running" --format "{{.Names}}" | head -n 1)
fi

if [ -z "$CONTAINER_ID" ]; then
    echo "❌ Error: Container backend tidak ditemukan atau tidak sedang berjalan."
    echo "Periksa container yang aktif dengan: docker ps"
    exit 1
fi

echo "✓ Container backend terdeteksi: $CONTAINER_ID"

# 2. Sinkronkan file command ke dalam container
COMMAND_SRC="$SCRIPT_DIR/backend/app/Console/Commands/FixSatminkalWanareja.php"
if [ -f "$COMMAND_SRC" ]; then
    echo "✓ Menyinkronkan file command FixSatminkalWanareja.php ke container..."
    docker exec -i "$CONTAINER_ID" mkdir -p /var/www/html/app/Console/Commands
    docker cp "$COMMAND_SRC" "$CONTAINER_ID":/var/www/html/app/Console/Commands/FixSatminkalWanareja.php
fi

# 3. Hapus cache bootstrap lama agar command langsung terbaca oleh Laravel
docker exec -i "$CONTAINER_ID" rm -f /var/www/html/bootstrap/cache/config.php /var/www/html/bootstrap/cache/routes-*.php /var/www/html/bootstrap/cache/packages.php /var/www/html/bootstrap/cache/services.php > /dev/null 2>&1 || true

# 4. Jalankan perintah artisan di dalam container
echo "✓ Menjalankan perintah di dalam container..."
echo ""

docker exec -i "$CONTAINER_ID" php artisan teachers:fix-satminkal-wanareja "$@"

echo ""
echo "======================================================================"
echo "✓ Selesai!"
echo "======================================================================"
