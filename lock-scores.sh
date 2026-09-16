#!/bin/bash
# ==============================================================================
# Script Kunci Nilai Cabang Lomba SIMMACI (Production VPS)
# Mengunci seluruh nilai yang telah diinput agar tidak ada lagi yang bisa merubah
#
# Penggunaan di VPS:
#   bash lock-scores.sh --phase1            # Kunci seleksi berkas FASE 1 (Fase 2 wawancara tetap bisa dinilai)
#   bash lock-scores.sh                     # Kunci TOTAL SELURUH cabang lomba (setelah semua selesai)
#   bash lock-scores.sh --freeze-submitted  # Kunci nilai yang SUDAH diisi (peserta sisa tetap bisa dinilai)
#   bash lock-scores.sh <id_lomba>          # Kunci satu cabang lomba tertentu
#   bash lock-scores.sh --unlock            # Buka kembali kunci (jika diperlukan)
# ==============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "======================================================="
echo "   KUNCI NILAI CABANG LOMBA SIMMACI (FINALISASI HASIL)"
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

# 2. Hapus file cache usang di dalam container
docker exec -i "$CONTAINER_ID" rm -f /var/www/html/bootstrap/cache/config.php /var/www/html/bootstrap/cache/routes-*.php /var/www/html/bootstrap/cache/packages.php /var/www/html/bootstrap/cache/services.php

# 3. Sinkronkan file app, config, bootstrap, routes, dan runner script ke dalam container Docker
docker cp "$SCRIPT_DIR/backend/config/." "$CONTAINER_ID":/var/www/html/config/
docker cp "$SCRIPT_DIR/backend/app/." "$CONTAINER_ID":/var/www/html/app/
docker cp "$SCRIPT_DIR/backend/bootstrap/." "$CONTAINER_ID":/var/www/html/bootstrap/
docker cp "$SCRIPT_DIR/backend/routes/." "$CONTAINER_ID":/var/www/html/routes/
docker cp "$SCRIPT_DIR/backend/run_lock_scores.php" "$CONTAINER_ID":/var/www/html/run_lock_scores.php

# 4. Bersihkan cache Laravel di dalam container
docker exec -i "$CONTAINER_ID" php artisan optimize:clear > /dev/null 2>&1

echo "✓ Mengeksekusi penguncian nilai..."
echo ""

# 5. Jalankan script runner di dalam container
docker exec -i "$CONTAINER_ID" php /var/www/html/run_lock_scores.php "$@"

echo ""
echo "======================================================="
echo "✓ Selesai!"
echo "======================================================="
