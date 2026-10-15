#!/bin/bash
# ==============================================================================
# Script Cek Guru Terhapus & Status SK MI Ma'arif NU 01 Kalisabuk (VPS / Docker)
#
# Penggunaan di VPS:
#   bash check-kalisabuk.sh             # Cek apakah ada guru Kalisabuk yang terhapus & punya SK
#   bash check-kalisabuk.sh --restore   # Pulihkan guru yang terhapus (dengan konfirmasi)
#   bash check-kalisabuk.sh --dry-run   # Simulasi restore tanpa ubah database
# ==============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "======================================================="
echo "   CEK GURU TERHAPUS & STATUS SK: KALISABUK (SIMMACI)  "
echo "======================================================="
echo "Argumen: $@"
echo ""

# 1. Cari container backend yang aktif
CONTAINER_ID=$(docker ps --filter "status=running" --format "{{.Names}}" | grep -iE 'backend' | grep -v -iE 'scheduler|queue|frontend' | head -n 1)

if [ -z "$CONTAINER_ID" ]; then
    CONTAINER_ID=$(docker ps --filter "name=app" --filter "status=running" --format "{{.Names}}" | head -n 1)
fi

if [ -z "$CONTAINER_ID" ]; then
    echo "⚠️  Container Docker backend tidak terdeteksi secara otomatis."
    echo "Mencoba menjalankan secara langsung via PHP lokal..."
    if command -v php >/dev/null 2>&1; then
        cd "$SCRIPT_DIR/backend" && php artisan teachers:check-deleted-sk --school="Kalisabuk" "$@"
        exit $?
    else
        echo "❌ Error: Container backend tidak ditemukan dan PHP lokal tidak tersedia."
        exit 1
    fi
fi

echo "✓ Menggunakan container: $CONTAINER_ID"
echo "✓ Menyinkronkan file command terbaru ke dalam container..."

# 2. Hapus cache lama di dalam container
docker exec -i "$CONTAINER_ID" rm -f /var/www/html/bootstrap/cache/config.php /var/www/html/bootstrap/cache/routes-*.php /var/www/html/bootstrap/cache/packages.php /var/www/html/bootstrap/cache/services.php > /dev/null 2>&1 || true

# 3. Sinkronkan file command ke dalam container Docker
docker cp "$SCRIPT_DIR/backend/app/Console/Commands/CheckDeletedTeachersWithSk.php" "$CONTAINER_ID":/var/www/html/app/Console/Commands/

# 4. Bersihkan cache Laravel di dalam container
docker exec -i "$CONTAINER_ID" php artisan optimize:clear > /dev/null 2>&1

echo "Menjalankan php artisan teachers:check-deleted-sk --school=\"Kalisabuk\" $@ ..."
echo ""

# 5. Jalankan perintah artisan di dalam container
docker exec -it "$CONTAINER_ID" php artisan teachers:check-deleted-sk --school="Kalisabuk" "$@"

EXIT_CODE=$?

echo ""
echo "======================================================="
echo "✓ Selesai!"
echo "======================================================="

exit $EXIT_CODE
