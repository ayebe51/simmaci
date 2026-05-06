-- Quick Fix: Aktifkan Template Surat Permohonan
-- Jalankan di production database

-- Step 1: Cek template yang ada
SELECT 
    id,
    sk_type,
    original_filename,
    is_active,
    file_path,
    disk,
    created_at,
    deleted_at
FROM sk_templates
WHERE sk_type = 'surat_permohonan'
ORDER BY created_at DESC;

-- Step 2: Jika ada template, nonaktifkan semua dulu
UPDATE sk_templates 
SET is_active = false 
WHERE sk_type = 'surat_permohonan'
AND deleted_at IS NULL;

-- Step 3: Aktifkan template terbaru (yang paling baru diupload)
-- Ini akan mengaktifkan template dengan ID terbesar (paling baru)
UPDATE sk_templates 
SET is_active = true 
WHERE id = (
    SELECT id 
    FROM sk_templates 
    WHERE sk_type = 'surat_permohonan' 
    AND deleted_at IS NULL
    ORDER BY created_at DESC 
    LIMIT 1
);

-- Step 4: Verifikasi hasil
SELECT 
    id,
    sk_type,
    original_filename,
    is_active,
    file_path,
    disk,
    created_at
FROM sk_templates
WHERE sk_type = 'surat_permohonan'
AND is_active = true
AND deleted_at IS NULL;

-- Jika Step 4 tidak mengembalikan hasil, berarti:
-- 1. Belum ada template yang diupload, ATAU
-- 2. Template sudah dihapus (soft deleted)
-- 
-- Solusi: Upload template baru via admin panel
