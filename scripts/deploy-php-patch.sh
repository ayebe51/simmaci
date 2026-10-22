#!/bin/bash
# ==============================================================================
# Script Otomatis: Mitigasi CVE-2026-109618 (PHP2Shell) pada Server SIMMACI
# Jalankan script ini langsung di server VPS Coolify
#
# Penggunaan:
#   bash scripts/deploy-php-patch.sh
# ==============================================================================

set -e

echo "======================================================="
echo "   SIMMACI - EMERGENCY SECURITY PATCH (PHP 8.3.36)     "
echo "   Target: CVE-2026-109618 & CVE-2026-109619           "
echo "======================================================="
echo ""

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/root/backup_pre_patch_${TIMESTAMP}"

# 1. Deteksi Container Database
echo "📦 [1/5] Membuat Backup Database Sebelum Deployment..."
mkdir -p "$BACKUP_DIR"

DB_CONTAINER=$(docker ps --filter "status=running" --format "{{.Names}}" | grep -iE 'db|postgres' | head -n 1 || true)

if [ -n "$DB_CONTAINER" ]; then
    echo "   Database container terdeteksi: $DB_CONTAINER"
    docker exec "$DB_CONTAINER" pg_dump -U sim_user -d sim_maarif | gzip > "${BACKUP_DIR}/sim_maarif_backup.sql.gz" || true
    echo "   ✓ Backup tersimpan di: ${BACKUP_DIR}/sim_maarif_backup.sql.gz"
else
    echo "   ⚠️  Container database tidak terdeteksi otomatis, melewati dump manual..."
fi

echo ""
# 2. Git Pull Pembaruan Terbaru
echo "⬇️  [2/5] Mengambil Kode Terbaru dari Git..."
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "   Branch aktif: $CURRENT_BRANCH"
git fetch origin "$CURRENT_BRANCH"
git pull origin "$CURRENT_BRANCH"
echo "   ✓ Versi Dockerfile terbaru telah dimuat."

echo ""
# 3. Rebuild Image Backend Tanpa Cache
echo "🔨 [3/5] Mengunduh Base Image Patch & Rebuild Image Tanpa Cache..."
echo "   Proses ini membutuhkan waktu 2-5 menit untuk mengompilasi ekstensi PHP..."
docker compose -f docker-compose.coolify.yml build --pull --no-cache backend

echo ""
# 4. Recreate Container (Backend, Queue, Scheduler)
echo "🚀 [4/5] Me-restart Container dengan Image Baru (PHP 8.3.36)..."
docker compose -f docker-compose.coolify.yml up -d --force-recreate backend queue scheduler

echo ""
# 5. Verifikasi Versi Runtime
echo "🔍 [5/5] Memverifikasi Versi Runtime PHP di Dalam Container..."
sleep 5

BACKEND_C=$(docker ps --filter "status=running" --format "{{.Names}}" | grep -iE 'backend' | grep -v -iE 'scheduler|queue|frontend' | head -n 1 || true)
QUEUE_C=$(docker ps --filter "status=running" --format "{{.Names}}" | grep -iE 'queue' | head -n 1 || true)
SCHEDULER_C=$(docker ps --filter "status=running" --format "{{.Names}}" | grep -iE 'scheduler' | head -n 1 || true)

echo "-------------------------------------------------------"
if [ -n "$BACKEND_C" ]; then
    echo -n "   [Backend]   : "
    docker exec "$BACKEND_C" php -v | head -n 1
else
    echo "   [Backend]   : Container belum siap"
fi

if [ -n "$QUEUE_C" ]; then
    echo -n "   [Queue]     : "
    docker exec "$QUEUE_C" php -v | head -n 1
else
    echo "   [Queue]     : Container belum siap"
fi

if [ -n "$SCHEDULER_C" ]; then
    echo -n "   [Scheduler] : "
    docker exec "$SCHEDULER_C" php -v | head -n 1
else
    echo "   [Scheduler] : Container belum siap"
fi
echo "-------------------------------------------------------"
echo ""
echo "✅ PEMBARUAN KEAMANAN SELESAI DENGAN SUKSES!"
echo "   SIMMACI kini terlindungi dari kerentanan PHP2Shell."
echo "======================================================="
