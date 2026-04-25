# Fixes Summary - April 25, 2026

## 1. ✅ A.Md.Kom. Degree Normalization Fixed

**Issue**: Teacher name "AFIQ RIZQY WIGUNA AMDKOM" was not being normalized to include proper degree formatting "A.Md.Kom."

**Root Cause**: `AMDKOM` was not in the DEGREE_MAP

**Fix Applied**:
- Added `'AMDKOM' => 'A.Md.Kom.',` to DEGREE_MAP in `backend/app/Services/NormalizationService.php`
- Also added `'AMDTI' => 'A.Md.T.I.',` for IT diploma degrees

**Files Changed**:
- `backend/app/Services/NormalizationService.php`

**Next Steps**:
1. Run normalization command to fix existing data:
   ```bash
   docker exec simmaci-backend php artisan normalize:data
   ```
2. Verify the fix:
   ```bash
   docker exec db-yam0yy9a6l424v8j89hv7pqr-053223983483 psql -U sim_user -d sim_maarif -c "SELECT id, nama FROM teachers WHERE nama LIKE '%AFIQ%';"
   ```

---

## 2. ⚠️ NIP Column Contains Status Values

**Issue**: The `nip` column in the teachers table contains status values like 'GTY', 'GTT', 'PNS', 'Non PNS' instead of actual NIP numbers.

**Root Cause**: During a previous data import, the `nip` and `status` columns got swapped.

**Fix Provided**:
- Created SQL script: `backend/database/fix_nip_status_swap.sql`
- The script will:
  1. Swap NIP and status values back to their correct columns
  2. Normalize status values to valid ones (GTY, GTT, Tendik, PNS)
  3. Set NULL for NIP values that are still status values

**How to Apply**:
```bash
# Option 1: Run the SQL file directly
docker exec -i db-yam0yy9a6l424v8j89hv7pqr-053223983483 psql -U sim_user -d sim_maarif < backend/database/fix_nip_status_swap.sql

# Option 2: Run step by step (safer)
docker exec db-yam0yy9a6l424v8j89hv7pqr-053223983483 psql -U sim_user -d sim_maarif -c "
-- Step 1: Create temporary column
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS temp_swap VARCHAR(255);

-- Step 2: Move NIP values (which contain status) to temp column
UPDATE teachers SET temp_swap = nip WHERE nip IN ('GTY', 'GTT', 'PNS', 'Tendik', 'Non PNS', 'Draft', 'Aktif', 'Guru Tetap Yayasan', 'Guru Tidak Tetap', 'GTTY', 'Kepala Madrasah', 'Tenaga Kependidikan');

-- Step 3: Move status values to NIP column
UPDATE teachers SET nip = status WHERE temp_swap IS NOT NULL AND status NOT IN ('GTY', 'GTT', 'PNS', 'Tendik', 'Non PNS', 'Draft', 'Aktif', 'Guru Tetap Yayasan', 'Guru Tidak Tetap', 'GTTY', 'Kepala Madrasah', 'Tenaga Kependidikan');

-- Step 4: Move temp values to status column
UPDATE teachers SET status = temp_swap WHERE temp_swap IS NOT NULL;

-- Step 5: Drop temporary column
ALTER TABLE teachers DROP COLUMN temp_swap;

-- Step 6: Normalize status values
UPDATE teachers SET status = 'GTY' WHERE status IN ('Guru Tetap Yayasan', 'Kepala Madrasah');
UPDATE teachers SET status = 'GTT' WHERE status IN ('Guru Tidak Tetap', 'GTTY', 'Non PNS');
UPDATE teachers SET status = 'Tendik' WHERE status IN ('Tenaga Kependidikan');
UPDATE teachers SET status = 'GTT' WHERE status = 'Aktif' AND (tmt IS NULL OR tmt::date > NOW() - INTERVAL '2 years');
UPDATE teachers SET status = 'GTY' WHERE status = 'Aktif' AND tmt::date <= NOW() - INTERVAL '2 years';

-- Step 7: Clean up NIP column
UPDATE teachers SET nip = NULL WHERE nip IN ('GTY', 'GTT', 'PNS', 'Tendik', 'Non PNS', 'Draft', 'Aktif');
"

# Verify the fix
docker exec db-yam0yy9a6l424v8j89hv7pqr-053223983483 psql -U sim_user -d sim_maarif -c "
SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN nip IN ('GTY', 'GTT', 'PNS', 'Tendik', 'Non PNS', 'Draft', 'Aktif') THEN 1 END) as nip_with_status,
    COUNT(CASE WHEN status NOT IN ('GTY', 'GTT', 'PNS', 'Tendik') THEN 1 END) as invalid_status
FROM teachers;
"
```

**Expected Result After Fix**:
- `nip_with_status` should be 0
- `invalid_status` should be 0

---

## 3. ✅ School Edit 504 Timeout Fixed

**Issue**: Editing school data as superadmin results in 504 Gateway Timeout error.

**Root Cause**: The update method was not validating input and might have been processing unnecessary data.

**Fix Applied**:
- Added proper validation to the `update()` method in `SchoolController`
- Added unique constraints for NSM, NPSN, and NPSM_NU (excluding current record)
- Only update fields that are present in the request
- Use `fresh()` to return updated model

**Files Changed**:
- `backend/app/Http/Controllers/Api/SchoolController.php`

**Testing**:
1. Login as superadmin
2. Edit a school record
3. Save changes
4. Should complete within 5-10 seconds (no timeout)

---

## Summary of Changes

### Files Modified:
1. `backend/app/Services/NormalizationService.php` - Added AMDKOM and AMDTI degree mappings
2. `backend/app/Http/Controllers/Api/SchoolController.php` - Optimized update method with validation

### Files Created:
1. `backend/database/fix_nip_status_swap.sql` - SQL script to fix NIP/status column swap

### Commands to Run:
```bash
# 1. Fix NIP/Status swap (IMPORTANT - run this first)
docker exec db-yam0yy9a6l424v8j89hv7pqr-053223983483 psql -U sim_user -d sim_maarif < backend/database/fix_nip_status_swap.sql

# 2. Normalize teacher names (includes A.Md.Kom. fix)
docker exec simmaci-backend php artisan normalize:data

# 3. Verify fixes
docker exec db-yam0yy9a6l424v8j89hv7pqr-053223983483 psql -U sim_user -d sim_maarif -c "
SELECT id, nama, nip, status FROM teachers WHERE nama LIKE '%AFIQ%' OR nip IN ('GTY', 'GTT', 'PNS') LIMIT 10;
"
```

---

## Deployment Checklist

- [ ] Commit changes to Git
- [ ] Push to GitHub
- [ ] Redeploy backend in Coolify
- [ ] Run NIP/Status swap fix SQL script
- [ ] Run normalize:data command
- [ ] Verify teacher names are normalized correctly
- [ ] Verify NIP column contains actual NIP numbers (not status)
- [ ] Test school edit as superadmin (should not timeout)
- [ ] Check application logs for any errors

---

## Notes

- The NIP/Status swap fix is **critical** and should be run before any new data imports
- The normalization command can be run multiple times safely (idempotent)
- All fixes are backward compatible and won't break existing functionality
- Database backups are recommended before running SQL scripts
