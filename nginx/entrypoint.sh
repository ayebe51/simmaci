#!/bin/sh
set -e

BACKEND_URL="${BACKEND_URL:-http://backend}"
echo "==> [SIMMACI Entrypoint] Starting frontend container (backend upstream: ${BACKEND_URL})"

TARGET_DIR="/usr/share/nginx/html"
STAGING_DIR="/app/dist"

# Ensure docroot directories exist
mkdir -p "${TARGET_DIR}/assets"

# 1. Accumulate hashed assets: Copy new hashed chunks without overwriting existing old hashed assets
if [ -d "${STAGING_DIR}/assets" ]; then
    echo "==> Syncing new hashed chunks (preserving previous release chunks)..."
    cp -n "${STAGING_DIR}/assets"/* "${TARGET_DIR}/assets/" 2>/dev/null || true

    # CRITICAL FIX: Refresh timestamp on all current release assets
    # This prevents the retention policy from accidentally deleting active chunks
    # when the container restarts after 7+ days without a new build.
    echo "==> Refreshing active release asset timestamps..."
    for f in "${STAGING_DIR}/assets"/*; do
        [ -f "$f" ] && touch "${TARGET_DIR}/assets/$(basename "$f")" 2>/dev/null || true
    done
fi

# 2. Atomic promotion: Always overwrite entrypoint files with fresh versions
echo "==> Promoting fresh entrypoint manifests..."
[ -f "${STAGING_DIR}/index.html" ] && cp -f "${STAGING_DIR}/index.html" "${TARGET_DIR}/index.html"
[ -f "${STAGING_DIR}/version.json" ] && cp -f "${STAGING_DIR}/version.json" "${TARGET_DIR}/version.json"
[ -f "${STAGING_DIR}/sw.js" ] && cp -f "${STAGING_DIR}/sw.js" "${TARGET_DIR}/sw.js"
[ -f "${STAGING_DIR}/manifest.webmanifest" ] && cp -f "${STAGING_DIR}/manifest.webmanifest" "${TARGET_DIR}/manifest.webmanifest"
[ -f "${STAGING_DIR}/registerSW.js" ] && cp -f "${STAGING_DIR}/registerSW.js" "${TARGET_DIR}/registerSW.js"

# Copy static root images/icons
cp -n "${STAGING_DIR}"/*.png "${TARGET_DIR}/" 2>/dev/null || true
cp -n "${STAGING_DIR}"/*.ico "${TARGET_DIR}/" 2>/dev/null || true
cp -n "${STAGING_DIR}"/*.svg "${TARGET_DIR}/" 2>/dev/null || true

# 3. Retention policy: Prune only truly obsolete chunks older than 14 days
# Active release assets are protected because their timestamps were refreshed above.
echo "==> Pruning obsolete chunks older than 14 days..."
find "${TARGET_DIR}/assets" -type f -mtime +14 -delete 2>/dev/null || true

echo "==> Frontend assets ready. Launching Nginx..."
exec nginx -g "daemon off;"
