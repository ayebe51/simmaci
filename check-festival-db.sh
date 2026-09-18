#!/bin/bash
# ==============================================================================
# Script Direct SQL Audit ke Container Database PostgreSQL di VPS
# Target Container: db-yam0yy9a6l424v8j89hv7pqr-063719836954
# Database: sim_maarif
# User: sim_user
# ==============================================================================

DB_CONTAINER="db-yam0yy9a6l424v8j89hv7pqr-063719836954"

if ! docker ps --format "{{.Names}}" | grep -q "^${DB_CONTAINER}$"; then
    DB_CONTAINER=$(docker ps --filter "name=db" --filter "status=running" --format "{{.Names}}" | head -n 1)
fi

if [ -z "$DB_CONTAINER" ]; then
    echo "❌ Error: Container database tidak ditemukan."
    exit 1
fi

echo "================================================================================"
echo "  AUDIT DATABASE DIRECT (POSTGRESQL): FESTIVAL ASWAJA BEREGU"
echo "  Container: $DB_CONTAINER"
echo "================================================================================"
echo ""

echo ">>> 1. CABANG LOMBA BEREGU & REKAP JUMLAH PESERTA:"
docker exec -i "$DB_CONTAINER" psql -U sim_user -d sim_maarif -c "
SELECT 
    c.id, 
    c.name AS nama_lomba, 
    c.type, 
    c.lomba_type, 
    c.jenjang,
    COUNT(p.id) AS total_peserta
FROM competitions c
LEFT JOIN competition_participants p ON p.competition_id = c.id AND p.deleted_at IS NULL
WHERE c.lomba_type IN ('mars_maarif', 'puji_pujian', 'film_dokumenter')
   OR c.type IN ('Beregu', 'Group')
   OR c.name ILIKE '%mars%'
   OR c.name ILIKE '%puji%'
   OR c.name ILIKE '%film%'
GROUP BY c.id, c.name, c.type, c.lomba_type, c.jenjang
ORDER BY c.id;
"

echo ""
echo ">>> 2. DETAIL DATA PENDAFTAR / PESERTA BEREGU:"
docker exec -i "$DB_CONTAINER" psql -U sim_user -d sim_maarif -c "
SELECT 
    p.id,
    c.name AS cabang_lomba,
    COALESCE(p.group_name, p.name) AS nama_regu,
    p.name AS pendaftar,
    p.institution AS madrasah_sekolah,
    p.jenjang,
    p.member_count AS jml_anggota,
    p.registration_status AS status,
    CASE WHEN p.video_url IS NOT NULL AND p.video_url <> '' THEN 'ADA' ELSE 'TIDAK ADA' END AS video
FROM competition_participants p
JOIN competitions c ON c.id = p.competition_id
WHERE c.lomba_type IN ('mars_maarif', 'puji_pujian', 'film_dokumenter')
   OR c.type IN ('Beregu', 'Group')
   OR p.group_name IS NOT NULL
   OR p.member_count > 1
ORDER BY c.id, p.id;
"

echo ""
echo ">>> 3. TOTAL PESERTA TERDAFTAR:"
docker exec -i "$DB_CONTAINER" psql -U sim_user -d sim_maarif -t -c "
SELECT COUNT(*) FROM competition_participants p
JOIN competitions c ON c.id = p.competition_id
WHERE (c.lomba_type IN ('mars_maarif', 'puji_pujian', 'film_dokumenter') OR c.type IN ('Beregu', 'Group') OR p.group_name IS NOT NULL OR p.member_count > 1)
  AND p.deleted_at IS NULL;
"
