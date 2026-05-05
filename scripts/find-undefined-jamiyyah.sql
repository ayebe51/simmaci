-- Query untuk mencari sekolah dengan status_jamiyyah "Tidak Terdefinisi"
-- Berdasarkan logika di DashboardController.php

-- 1. Tampilkan semua nilai unik status_jamiyyah
SELECT 
    COALESCE(status_jamiyyah, '(NULL/kosong)') as status,
    COUNT(*) as jumlah
FROM schools
WHERE deleted_at IS NULL
GROUP BY status_jamiyyah
ORDER BY status_jamiyyah;

-- 2. Tampilkan sekolah dengan status "undefined"
-- (tidak cocok dengan pattern 'jama'ah' atau 'jam'iyyah')
SELECT 
    id,
    nama,
    npsn,
    COALESCE(status_jamiyyah, '(NULL/kosong)') as status_jamiyyah,
    jenjang,
    kecamatan
FROM schools
WHERE deleted_at IS NULL
  AND CASE
        WHEN LOWER(status_jamiyyah) LIKE '%jama%ah%'
          OR LOWER(status_jamiyyah) LIKE '%afiliasi%' THEN 'jamaah'
        WHEN LOWER(status_jamiyyah) LIKE '%jam%iyyah%' THEN 'jamiyyah'
        ELSE 'undefined'
      END = 'undefined'
ORDER BY nama;

-- 3. Hitung total per kategori (untuk verifikasi)
SELECT 
    CASE
        WHEN LOWER(status_jamiyyah) LIKE '%jama%ah%'
          OR LOWER(status_jamiyyah) LIKE '%afiliasi%' THEN 'jamaah'
        WHEN LOWER(status_jamiyyah) LIKE '%jam%iyyah%' THEN 'jamiyyah'
        ELSE 'undefined'
    END as kategori,
    COUNT(*) as jumlah,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM schools WHERE deleted_at IS NULL), 2) as persentase
FROM schools
WHERE deleted_at IS NULL
GROUP BY kategori
ORDER BY kategori;
