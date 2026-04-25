-- Fix NIP and Status column swap issue
-- This script swaps the values back to their correct columns

-- Step 1: Create a temporary column to hold the swapped values
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS temp_swap VARCHAR(255);

-- Step 2: Move NIP values (which contain status) to temp column
UPDATE teachers SET temp_swap = nip WHERE nip IN ('GTY', 'GTT', 'PNS', 'Tendik', 'Non PNS', 'Draft', 'Aktif', 'Guru Tetap Yayasan', 'Guru Tidak Tetap', 'GTTY', 'Kepala Madrasah', 'Tenaga Kependidikan');

-- Step 3: Move status values (which might contain NIP) to NIP column
UPDATE teachers SET nip = status WHERE temp_swap IS NOT NULL AND status NOT IN ('GTY', 'GTT', 'PNS', 'Tendik', 'Non PNS', 'Draft', 'Aktif', 'Guru Tetap Yayasan', 'Guru Tidak Tetap', 'GTTY', 'Kepala Madrasah', 'Tenaga Kependidikan');

-- Step 4: Move temp values (original NIP values that were status) to status column
UPDATE teachers SET status = temp_swap WHERE temp_swap IS NOT NULL;

-- Step 5: Drop the temporary column
ALTER TABLE teachers DROP COLUMN temp_swap;

-- Step 6: Normalize the status values to valid ones (GTY, GTT, Tendik, PNS)
UPDATE teachers SET status = 'GTY' WHERE status IN ('Guru Tetap Yayasan', 'Kepala Madrasah');
UPDATE teachers SET status = 'GTT' WHERE status IN ('Guru Tidak Tetap', 'GTTY', 'Non PNS');
UPDATE teachers SET status = 'Tendik' WHERE status IN ('Tenaga Kependidikan');
UPDATE teachers SET status = 'GTT' WHERE status = 'Aktif' AND (tmt IS NULL OR tmt::date > NOW() - INTERVAL '2 years');
UPDATE teachers SET status = 'GTY' WHERE status = 'Aktif' AND tmt::date <= NOW() - INTERVAL '2 years';

-- Step 7: Set NULL for NIP values that are still status values (edge cases)
UPDATE teachers SET nip = NULL WHERE nip IN ('GTY', 'GTT', 'PNS', 'Tendik', 'Non PNS', 'Draft', 'Aktif');

-- Verification query
SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN nip IN ('GTY', 'GTT', 'PNS', 'Tendik', 'Non PNS', 'Draft', 'Aktif') THEN 1 END) as nip_with_status,
    COUNT(CASE WHEN status NOT IN ('GTY', 'GTT', 'PNS', 'Tendik') THEN 1 END) as invalid_status
FROM teachers;
