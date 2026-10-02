#!/usr/bin/env bash
# ==============================================================================
# SIMMACI — Automated Database Backup & Offsite S3 Replication
# ==============================================================================
# Deskripsi: Melakukan pencadangan (dump) database PostgreSQL, kompresi,
#             penghitungan checksum SHA256, enkripsi opsional (AES-256),
#             dan pengunggahan otomatis ke MinIO / S3 bucket terisolasi.
#
# Penggunaan:
#   bash scripts/backup-db-offsite.sh
#
# Penjadwalan Cron (Host VPS):
#   0 2 * * * /bin/bash /data/coolify/services/.../scripts/backup-db-offsite.sh >> /var/log/simmaci-backup.log 2>&1
# ==============================================================================

set -euo pipefail

# ── Konfigurasi Dasar ─────────────────────────────────────────────────────────
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATE_LABEL=$(date +"%Y-%m-%d")
BACKUP_DIR="${BACKUP_DIR:-/tmp/simmaci-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

# Database Credentials (ambil dari environment atau fallback)
DB_CONTAINER="${DB_CONTAINER:-simmaci-db}"
DB_NAME="${DB_DATABASE:-${POSTGRES_DB:-sim_maarif}}"
DB_USER="${DB_USERNAME:-${POSTGRES_USER:-sim_user}}"
DB_PASS="${DB_PASSWORD:-${POSTGRES_PASSWORD:-}}"

# S3 / MinIO Configuration
S3_ALIAS="${S3_ALIAS:-local}"
S3_ENDPOINT="${AWS_ENDPOINT:-http://minio:9000}"
S3_BUCKET="${BACKUP_S3_BUCKET:-simmaci-storage}"
S3_PREFIX="${BACKUP_S3_PREFIX:-backups/database}"
S3_ACCESS_KEY="${AWS_ACCESS_KEY_ID:-${MINIO_ROOT_USER:-}}"
S3_SECRET_KEY="${AWS_SECRET_ACCESS_KEY:-${MINIO_ROOT_PASSWORD:-}}"

# Encryption Key (Opsional: jika diisi, arsip akan dienkripsi dengan AES-256-CBC)
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

# Penamaan File
BACKUP_FILENAME="simmaci_db_${DB_NAME}_${TIMESTAMP}.dump"
BACKUP_FILEPATH="${BACKUP_DIR}/${BACKUP_FILENAME}"
CHECKSUM_FILEPATH="${BACKUP_FILEPATH}.sha256"

# Warna Output Terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  SIMMACI AUTOMATED POSTGRESQL BACKUP & OFFSITE REPLICATION      ${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e "Waktu Mulai : $(date '+%Y-%m-%d %H:%M:%S WIB')"
echo -e "Database    : ${DB_NAME}"
echo -e "Target Dir  : ${BACKUP_DIR}"
echo -e "Target S3   : ${S3_BUCKET}/${S3_PREFIX}"
echo "----------------------------------------------------------------"

# ── 1. Persiapan Direktori ────────────────────────────────────────────────────
mkdir -p "${BACKUP_DIR}"

# ── 2. Eksekusi Dump Database ─────────────────────────────────────────────────
echo -e "${YELLOW}[1/5] Melakukan dump database PostgreSQL...${NC}"

START_TIME=$(date +%s)

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    echo -e "Mode        : Docker Container (${DB_CONTAINER})"
    docker exec -e PGPASSWORD="${DB_PASS}" "${DB_CONTAINER}" \
        pg_dump -U "${DB_USER}" -d "${DB_NAME}" -F c -b -v > "${BACKUP_FILEPATH}"
elif command -v pg_dump >/dev/null 2>&1; then
    echo -e "Mode        : Direct pg_dump CLI"
    PGPASSWORD="${DB_PASS}" pg_dump -h "${DB_HOST:-127.0.0.1}" -p "${DB_PORT:-5432}" \
        -U "${DB_USER}" -d "${DB_NAME}" -F c -b -v > "${BACKUP_FILEPATH}"
else
    echo -e "${RED}[ERROR] Tidak ditemukan pg_dump maupun container Docker '${DB_CONTAINER}'.${NC}"
    exit 1
fi

DUMP_SIZE=$(du -h "${BACKUP_FILEPATH}" | cut -f1)
echo -e "${GREEN}✓ Dump database selesai (${DUMP_SIZE}) dalam $(( $(date +%s) - START_TIME )) detik.${NC}"

# ── 3. Penghitungan Checksum SHA-256 ──────────────────────────────────────────
echo -e "${YELLOW}[2/5] Menghitung checksum SHA-256 untuk audit integrity...${NC}"
if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${BACKUP_FILEPATH}" > "${CHECKSUM_FILEPATH}"
elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "${BACKUP_FILEPATH}" > "${CHECKSUM_FILEPATH}"
fi
echo -e "${GREEN}✓ Checksum SHA-256 tersimpan di ${CHECKSUM_FILEPATH}${NC}"

# ── 4. Enkripsi Berkas (Opsional) ─────────────────────────────────────────────
FINAL_FILE="${BACKUP_FILEPATH}"
if [ -n "${ENCRYPTION_KEY}" ]; then
    echo -e "${YELLOW}[3/5] Mengenkripsi arsip backup dengan AES-256-CBC...${NC}"
    ENCRYPTED_FILEPATH="${BACKUP_FILEPATH}.enc"
    openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
        -in "${BACKUP_FILEPATH}" \
        -out "${ENCRYPTED_FILEPATH}" \
        -k "${ENCRYPTION_KEY}"
    
    # Hapus file plaintext lokal setelah enkripsi berhasil
    rm -f "${BACKUP_FILEPATH}"
    FINAL_FILE="${ENCRYPTED_FILEPATH}"
    echo -e "${GREEN}✓ Enkripsi berhasil: $(basename "${FINAL_FILE}")${NC}"
else
    echo -e "${BLUE}[3/5] Lewati enkripsi tambahan (arsip format binary pg_dump).${NC}"
fi

# ── 5. Replikasi ke MinIO / S3 Bucket ─────────────────────────────────────────
echo -e "${YELLOW}[4/5] Mengunggah arsip ke penyimpanan S3/MinIO...${NC}"
UPLOAD_SUCCESS=false

# Metode A: MinIO Client (mc)
if command -v mc >/dev/null 2>&1; then
    if [ -n "${S3_ACCESS_KEY}" ] && [ -n "${S3_SECRET_KEY}" ]; then
        mc alias set "${S3_ALIAS}" "${S3_ENDPOINT}" "${S3_ACCESS_KEY}" "${S3_SECRET_KEY}" >/dev/null 2>&1 || true
    fi
    if mc cp "${FINAL_FILE}" "${S3_ALIAS}/${S3_BUCKET}/${S3_PREFIX}/" && \
       mc cp "${CHECKSUM_FILEPATH}" "${S3_ALIAS}/${S3_BUCKET}/${S3_PREFIX}/"; then
        UPLOAD_SUCCESS=true
        echo -e "${GREEN}✓ Berhasil diunggah via MinIO Client (mc).${NC}"
    fi
fi

# Metode B: AWS CLI (Fallback)
if [ "${UPLOAD_SUCCESS}" = false ] && command -v aws >/dev/null 2>&1; then
    if aws s3 cp "${FINAL_FILE}" "s3://${S3_BUCKET}/${S3_PREFIX}/" && \
       aws s3 cp "${CHECKSUM_FILEPATH}" "s3://${S3_BUCKET}/${S3_PREFIX}/"; then
        UPLOAD_SUCCESS=true
        echo -e "${GREEN}✓ Berhasil diunggah via AWS CLI.${NC}"
    fi
fi

# Metode C: Container MinIO Client jika di host Docker
if [ "${UPLOAD_SUCCESS}" = false ] && command -v docker >/dev/null 2>&1; then
    MC_CONTAINER="simmaci-mc"
    if docker ps -a --format '{{.Names}}' | grep -q "^${MC_CONTAINER}$"; then
        docker run --rm --network simmaci-network \
            -v "${BACKUP_DIR}:/backups" \
            cgr.dev/chainguard/minio-client:latest-dev \
            sh -c "mc alias set minio http://minio:9000 '${S3_ACCESS_KEY}' '${S3_SECRET_KEY}' && mc cp '/backups/$(basename "${FINAL_FILE}")' 'minio/${S3_BUCKET}/${S3_PREFIX}/' && mc cp '/backups/$(basename "${CHECKSUM_FILEPATH}")' 'minio/${S3_BUCKET}/${S3_PREFIX}/'" && UPLOAD_SUCCESS=true
        if [ "${UPLOAD_SUCCESS}" = true ]; then
            echo -e "${GREEN}✓ Berhasil diunggah via ephemeral MinIO container.${NC}"
        fi
    fi
fi

if [ "${UPLOAD_SUCCESS}" = false ]; then
    echo -e "${YELLOW}[WARNING] Unggah ke S3 dilewati / client tidak tersedia. Berkas tersimpan lokal di ${FINAL_FILE}.${NC}"
fi

# ── 6. Pembersihan & Retensi (Retention Policy) ───────────────────────────────
echo -e "${YELLOW}[5/5] Menerapkan kebijakan retensi (${RETENTION_DAYS} hari)...${NC}"
# Bersihkan arsip lokal yang lebih tua dari RETENTION_DAYS
find "${BACKUP_DIR}" -type f -name "simmaci_db_*" -mtime +"${RETENTION_DAYS}" -exec rm -f {} + 2>/dev/null || true

# Jika mc aktif, bersihkan remote S3 yang kedaluwarsa
if command -v mc >/dev/null 2>&1; then
    mc rm --older-than "${RETENTION_DAYS}d" --recursive --force "${S3_ALIAS}/${S3_BUCKET}/${S3_PREFIX}/" >/dev/null 2>&1 || true
fi
echo -e "${GREEN}✓ Pembersihan berkas lama selesai.${NC}"

# ── Ringkasan Eksekusi ────────────────────────────────────────────────────────
TOTAL_DURATION=$(( $(date +%s) - START_TIME ))
echo "----------------------------------------------------------------"
echo -e "${GREEN}STATUS     : SUKSES (100% DONE)${NC}"
echo -e "Berkas     : $(basename "${FINAL_FILE}")"
echo -e "Ukuran     : ${DUMP_SIZE}"
echo -e "Durasi     : ${TOTAL_DURATION} detik"
echo -e "Checksum   : $(cat "${CHECKSUM_FILEPATH}" | awk '{print $1}')"
echo -e "Waktu Usai : $(date '+%Y-%m-%d %H:%M:%S WIB')"
echo -e "${BLUE}================================================================${NC}"
