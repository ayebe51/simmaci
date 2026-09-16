#!/bin/bash
# ==============================================================================
# Script Hapus Nilai Juri Muhtarom (Non-MI) pada Lomba Guru Berprestasi SIMMACI
# Aman digunakan saat server berjalan (Zero Downtime / Non-Destructive)
#
# Penggunaan di VPS:
#   bash fix-muhtarom.sh            # Eksekusi langsung (hapus non-MI & hitung ulang)
#   bash fix-muhtarom.sh --dry-run  # Preview daftar nilai tanpa mengubah data
# ==============================================================================

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
echo "Menjalankan php artisan competition:fix-guru-muhtarom --force $@ ..."
echo ""

# 2. Jalankan perintah artisan di dalam container
docker exec -i "$CONTAINER_ID" php artisan competition:fix-guru-muhtarom --force "$@"

echo ""
echo "======================================================="
echo "✓ Selesai!"
echo "======================================================="
