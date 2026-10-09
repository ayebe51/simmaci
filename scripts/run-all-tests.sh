#!/usr/bin/env bash
# ==============================================================================
# SIMMACI — Automated Full Test Suite Runner
# ==============================================================================
# Menjalankan seluruh pengujian unit frontend, build check, dan backend feature
# tests secara otomatis dengan output ringkasan status pass/fail.
#
# Penggunaan:
#   bash scripts/run-all-tests.sh
# ==============================================================================

set -eo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  SIMMACI AUTOMATED TEST & HARDENING SUITE                      ${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e "Tanggal: $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "Direktori: ${ROOT_DIR}"
echo "----------------------------------------------------------------"

# 1. Frontend Offline Queue Unit Tests
echo -e "\n${YELLOW}[1/3] Menjalankan Frontend Unit Tests (Offline Queue & Sync)...${NC}"
cd "${ROOT_DIR}"
npm run test:offline

# 2. Frontend Production Build Check
echo -e "\n${YELLOW}[2/3] Menjalankan Frontend Production Build Check...${NC}"
npm run build

# 3. Backend Feature Tests (Meeting & Security Ecosystem)
echo -e "\n${YELLOW}[3/3] Menjalankan Backend Feature Tests...${NC}"
cd "${ROOT_DIR}/backend"
php artisan test \
  tests/Feature/MeetingControllerTest.php \
  tests/Feature/MeetingMinutesControllerTest.php \
  tests/Feature/MeetingPhotoControllerTest.php \
  tests/Feature/MeetingReportControllerTest.php \
  tests/Feature/PublicMeetingScannerTest.php \
  tests/Feature/PublicMeetingWalkInTest.php

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}  SEMUA PENGUJIAN OTOMATIS BERHASIL LULUS 100% (ALL TESTS PASSED)  ${NC}"
echo -e "${GREEN}================================================================${NC}"
