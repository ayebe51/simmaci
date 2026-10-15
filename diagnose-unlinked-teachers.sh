#!/bin/bash
# ==============================================================================
# Script Diagnosa Guru yang Tidak Terhubung dengan Sekolah (Production / VPS)
# Aman digunakan saat server berjalan (Zero Downtime / Non-Destructive)
#
# Penggunaan di VPS / Docker:
#   bash diagnose-unlinked-teachers.sh                    # Tampilkan ringkasan diagnosa
#   bash diagnose-unlinked-teachers.sh --details          # Tampilkan rincian daftar guru
#   bash diagnose-unlinked-teachers.sh --match            # Tampilkan saran pencocokan sekolah
#   bash diagnose-unlinked-teachers.sh --auto-link --dry-run  # Uji simulasi auto-link
#   bash diagnose-unlinked-teachers.sh --csv=storage/unlinked.csv # Export ke CSV
# ==============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "======================================================="
echo "   DIAGNOSA INTEGRITAS RELASI GURU & SEKOLAH (SIMMACI)"
echo "======================================================="
echo "Argumen: $@"
echo ""

# 1. Cari container backend yang aktif (khusus web backend, abaikan queue & scheduler)
CONTAINER_ID=$(docker ps --filter "status=running" --format "{{.Names}}" | grep -iE 'backend' | grep -v -iE 'scheduler|queue|frontend' | head -n 1)

if [ -z "$CONTAINER_ID" ]; then
    CONTAINER_ID=$(docker ps --filter "name=app" --filter "status=running" --format "{{.Names}}" | head -n 1)
fi

if [ -z "$CONTAINER_ID" ]; then
    echo "⚠️  Container Docker backend tidak terdeteksi secara otomatis."
    echo "Mencoba menjalankan secara langsung via PHP lokal..."
    if command -v php >/dev/null 2>&1; then
        cd "$SCRIPT_DIR/backend" && php artisan teachers:analyze-unlinked "$@"
        exit $?
    else
        echo "❌ Error: Container backend tidak ditemukan dan PHP lokal tidak tersedia."
        echo "Pastikan docker running dengan: docker ps"
        exit 1
    fi
fi

echo "✓ Menggunakan container: $CONTAINER_ID"
echo "✓ Menyinkronkan file command terbaru ke dalam container..."

# 2. Hapus cache lama di dalam container
docker exec -i "$CONTAINER_ID" rm -f /var/www/html/bootstrap/cache/config.php /var/www/html/bootstrap/cache/routes-*.php /var/www/html/bootstrap/cache/packages.php /var/www/html/bootstrap/cache/services.php > /dev/null 2>&1

# 3. Sinkronkan file command ke dalam container Docker
docker cp "$SCRIPT_DIR/backend/app/Console/Commands/AnalyzeUnlinkedTeachers.php" "$CONTAINER_ID":/var/www/html/app/Console/Commands/

# 4. Bersihkan cache Laravel di dalam container
docker exec -i "$CONTAINER_ID" php artisan optimize:clear > /dev/null 2>&1

echo "Menjalankan php artisan teachers:analyze-unlinked $@ ..."
echo ""

# 5. Jalankan perintah artisan di dalam container
docker exec -i "$CONTAINER_ID" php artisan teachers:analyze-unlinked "$@"

EXIT_CODE=$?

echo ""
echo "======================================================="
echo "✓ Diagnosa Selesai!"
echo "======================================================="

exit $EXIT_CODE
