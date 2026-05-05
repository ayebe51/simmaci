#!/bin/bash
# Script untuk menjalankan command di Coolify backend container
# Container name: backend-yam0yy9a6l424v8j89hv7pqr-025135358293

CONTAINER_NAME="backend-yam0yy9a6l424v8j89hv7pqr-025135358293"

echo "═══════════════════════════════════════════════════════════"
echo "  Mencari Sekolah dengan Status Jamiyyah Tidak Terdefinisi"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Container: ${CONTAINER_NAME}"
echo ""

# Jalankan command
docker exec ${CONTAINER_NAME} php artisan school:find-undefined-jamiyyah

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Selesai!"
