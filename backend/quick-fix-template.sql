-- Quick Fix: Aktifkan Template Surat Permohonan
-- Jalankan script ini jika template sudah diupload tapi belum aktif

-- Step 1: Cek template yang ada
SELECT 
    id,
    sk_type,
    original_filename,
    is_active,
    file_path,
    created_at
FROM sk_templates
WHERE sk_type = 'surat_permohonan'
AND deleted_at IS NULL
ORDER BY created_at DESC;

-- Step 2: Nonaktifkan semua template surat permohonan
UPDATE sk_templates 
SET is_active = false 
WHERE sk_type = 'surat_permohonan'
AND deleted_at IS NULL;

-- Step 3: Aktifkan template terbaru
-- GANTI <TEMPLATE_ID> dengan ID dari Step 1 (biasanya yang paling baru)
UPDATE sk_templates 
SET is_active = true 
WHERE id = <TEMPLATE_ID>;

-- Step 4: Verifikasi
SELECT 
    id,
    sk_type,
    original_filename,
    is_active,
    file_path
FROM sk_templates
WHERE sk_type = 'surat_permohonan'
AND is_active = true
AND deleted_at IS NULL;

-- Jika tidak ada hasil di Step 4, berarti template belum ada atau sudah dihapus
-- Solusi: Upload template baru via admin panel
