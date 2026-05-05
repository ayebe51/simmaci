#!/bin/bash
# Script untuk menjalankan command di production server
# 
# Usage:
#   1. Edit SSH_HOST, SSH_USER, dan SSH_PORT sesuai server Anda
#   2. Jalankan: bash scripts/run-production-command.sh
#
# Atau langsung via SSH:
#   ssh user@server "docker exec simmaci-backend php artisan school:find-undefined-jamiyyah"

# ═══════════════════════════════════════════════════════════
# KONFIGURASI - Edit sesuai server production Anda
# ═══════════════════════════════════════════════════════════
SSH_HOST="your-production-server.com"  # Ganti dengan IP atau domain server
SSH_USER="root"                         # Ganti dengan username SSH
SSH_PORT="22"                           # Port SSH (default 22)
CONTAINER_NAME="simmaci-backend"        # Nama container backend

# ═══════════════════════════════════════════════════════════
# SCRIPT - Jangan edit bagian ini
# ═══════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════════"
echo "  Menjalankan Command di Production Server"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Server: ${SSH_USER}@${SSH_HOST}:${SSH_PORT}"
echo "Container: ${CONTAINER_NAME}"
echo ""
echo "Command: php artisan school:find-undefined-jamiyyah"
echo ""
echo "─────────────────────────────────────────────────────────"
echo ""

# Jalankan command via SSH
ssh -p "${SSH_PORT}" "${SSH_USER}@${SSH_HOST}" \
  "docker exec ${CONTAINER_NAME} php artisan school:find-undefined-jamiyyah"

echo ""
echo "─────────────────────────────────────────────────────────"
echo "Selesai!"
echo ""
