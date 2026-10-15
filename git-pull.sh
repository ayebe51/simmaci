#!/bin/bash
# ==============================================================================
# Script Git Pull & Auto-Sync Docker Container (VPS / Coolify Production)
#
# Penggunaan di VPS:
#   bash git-pull.sh                  # Pull code terbaru & sync ke container backend
#   bash git-pull.sh --diagnose       # Pull, sync, dan langsung jalankan diagnosa guru
#   bash git-pull.sh --migrate        # Pull, sync, dan jalankan php artisan migrate
# ==============================================================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "======================================================="
echo "   SIMMACI - GIT PULL & CONTAINER SYNC (PRODUCTION)    "
echo "======================================================="
echo ""

# 1. Pastikan repo git valid
if [ ! -d ".git" ]; then
    echo "❌ Error: Direktori ini bukan repositori Git."
    exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "📍 Branch aktif saat ini : $CURRENT_BRANCH"

# 2. Cek status working directory
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Ada perubahan lokal yang belum di-commit. Menyimpan ke git stash..."
    git stash
    STASHED=true
else
    STASHED=false
fi

# 3. Jalankan git pull
echo "⬇️  Mengambil pembaruan terbaru dari remote (git pull origin $CURRENT_BRANCH)..."
git fetch origin "$CURRENT_BRANCH"
git pull origin "$CURRENT_BRANCH"

echo ""
echo "✓ Commit terakhir:"
git log -1 --pretty=format:"   [%h] %s (%cr) <%an>"
echo ""
echo ""

# Kembalikan stash jika ada
if [ "$STASHED" = true ]; then
    echo "📦 Mengembalikan perubahan lokal dari stash..."
    git stash pop || true
fi

# 4. Deteksi Container Docker Coolify
echo "🔍 Mendeteksi container backend Docker yang aktif..."
BACKEND_CONTAINER=$(docker ps --filter "status=running" --format "{{.Names}}" | grep -iE 'backend' | grep -v -iE 'scheduler|queue|frontend' | head -n 1)
QUEUE_CONTAINER=$(docker ps --filter "status=running" --format "{{.Names}}" | grep -iE 'queue' | head -n 1)
SCHEDULER_CONTAINER=$(docker ps --filter "status=running" --format "{{.Names}}" | grep -iE 'scheduler' | head -n 1)

if [ -n "$BACKEND_CONTAINER" ]; then
    echo "✓ Container Backend ditemukan   : $BACKEND_CONTAINER"
else
    echo "⚠️  Container Backend tidak ditemukan. Melewati proses sync container."
fi

if [ -n "$QUEUE_CONTAINER" ]; then
    echo "✓ Container Queue ditemukan     : $QUEUE_CONTAINER"
fi

if [ -n "$SCHEDULER_CONTAINER" ]; then
    echo "✓ Container Scheduler ditemukan : $SCHEDULER_CONTAINER"
fi

echo ""

# 5. Sinkronisasi File ke dalam Container Docker (Zero Downtime)
if [ -n "$BACKEND_CONTAINER" ]; then
    echo "🔄 Menyinkronkan file aplikasi terbaru ke dalam container..."

    # Hapus cache bootstrap lama agar route & config ter-refresh
    docker exec -i "$BACKEND_CONTAINER" rm -f /var/www/html/bootstrap/cache/config.php \
                                           /var/www/html/bootstrap/cache/routes-*.php \
                                           /var/www/html/bootstrap/cache/packages.php \
                                           /var/www/html/bootstrap/cache/services.php > /dev/null 2>&1 || true

    # Salin file backend ke dalam container backend
    if [ -d "$SCRIPT_DIR/backend/app" ]; then
        docker cp "$SCRIPT_DIR/backend/app/." "$BACKEND_CONTAINER":/var/www/html/app/
    fi
    if [ -d "$SCRIPT_DIR/backend/routes" ]; then
        docker cp "$SCRIPT_DIR/backend/routes/." "$BACKEND_CONTAINER":/var/www/html/routes/
    fi
    if [ -d "$SCRIPT_DIR/backend/config" ]; then
        docker cp "$SCRIPT_DIR/backend/config/." "$BACKEND_CONTAINER":/var/www/html/config/
    fi
    if [ -d "$SCRIPT_DIR/backend/bootstrap" ]; then
        docker cp "$SCRIPT_DIR/backend/bootstrap/." "$BACKEND_CONTAINER":/var/www/html/bootstrap/
    fi
    if [ -d "$SCRIPT_DIR/backend/database" ]; then
        docker cp "$SCRIPT_DIR/backend/database/." "$BACKEND_CONTAINER":/var/www/html/database/
    fi

    # Salin juga ke queue container jika ada perubahan job/service
    if [ -n "$QUEUE_CONTAINER" ]; then
        docker cp "$SCRIPT_DIR/backend/app/." "$QUEUE_CONTAINER":/var/www/html/app/ > /dev/null 2>&1 || true
    fi

    # Bersihkan cache Laravel
    echo "🧹 Membersihkan cache Laravel (optimize:clear)..."
    docker exec -i "$BACKEND_CONTAINER" php artisan optimize:clear

    # Jalankan migrasi jika diminta opsi --migrate
    if [[ "$*" == *"--migrate"* ]]; then
        echo ""
        echo "🗄️ Menjalankan migrasi database..."
        docker exec -i "$BACKEND_CONTAINER" php artisan migrate --force
    fi

    # Jalankan diagnosa jika diminta opsi --diagnose
    if [[ "$*" == *"--diagnose"* ]]; then
        echo ""
        echo "🩺 Menjalankan diagnosa guru tidak terhubung..."
        docker exec -i "$BACKEND_CONTAINER" php artisan teachers:analyze-unlinked --details --match
    fi

    echo ""
    echo "======================================================="
    echo "✓ Git pull & sinkronisasi container BERHASIL!"
    echo "======================================================="
    echo ""
    echo "💡 Perintah diagnosa cepat berikutnya:"
    echo "   bash diagnose-unlinked-teachers.sh --details --match"
    echo "======================================================="
else
    echo "======================================================="
    echo "✓ Git pull selesai di sistem lokal/host."
    echo "======================================================="
fi
