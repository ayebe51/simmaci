# Delete SK Submissions from MI Darwata Glempang (SQL Method)

## Problem
Need to delete all SK submissions from "MI Darwata Glempang" EXCEPT for:
- WARDAH URJUWAN ARIBAH, S.Pd.
- NILNA FAIZALLUQYANA, S.Pd.

## Solution: Direct SQL Queries

### Step 1: Connect to PostgreSQL Database

```bash
# Find the database container
docker ps --format "{{.Names}}" | grep db

# Connect to PostgreSQL (replace container name if different)
docker exec -it db-yam0yy9a6l424v8j89hv7pqr-151605211967 psql -U postgres -d simmaci
```

### Step 2: Preview Records to Delete (DRY RUN)

```sql
-- First, find the school_id for MI Darwata Glempang
SELECT id, nama FROM schools WHERE nama LIKE '%Darwata%Glempang%';

-- Preview SK documents that will be deleted
SELECT 
    id, 
    nomor_sk, 
    nama, 
    unit_kerja, 
    status, 
    created_at
FROM sk_documents
WHERE unit_kerja LIKE '%Darwata%Glempang%'
  AND nama NOT LIKE '%WARDAH URJUWAN ARIBAH%'
  AND nama NOT LIKE '%NILNA FAIZALLUQYANA%'
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- Count how many will be deleted
SELECT COUNT(*) as total_to_delete
FROM sk_documents
WHERE unit_kerja LIKE '%Darwata%Glempang%'
  AND nama NOT LIKE '%WARDAH URJUWAN ARIBAH%'
  AND nama NOT LIKE '%NILNA FAIZALLUQYANA%'
  AND deleted_at IS NULL;
```

### Step 3: Soft Delete SK Documents

```sql
-- Soft delete (sets deleted_at timestamp)
UPDATE sk_documents
SET deleted_at = NOW()
WHERE unit_kerja LIKE '%Darwata%Glempang%'
  AND nama NOT LIKE '%WARDAH URJUWAN ARIBAH%'
  AND nama NOT LIKE '%NILNA FAIZALLUQYANA%'
  AND deleted_at IS NULL;

-- Verify deletion
SELECT 
    id, 
    nomor_sk, 
    nama, 
    unit_kerja, 
    deleted_at
FROM sk_documents
WHERE unit_kerja LIKE '%Darwata%Glempang%'
ORDER BY deleted_at DESC NULLS FIRST;
```

### Step 4: Delete Related Activity Logs (Optional)

```sql
-- Find activity logs for deleted SK documents
SELECT COUNT(*) as total_activity_logs
FROM activity_log
WHERE subject_type = 'App\\Models\\SkDocument'
  AND subject_id IN (
    SELECT id FROM sk_documents 
    WHERE unit_kerja LIKE '%Darwata%Glempang%'
      AND nama NOT LIKE '%WARDAH URJUWAN ARIBAH%'
      AND nama NOT LIKE '%NILNA FAIZALLUQYANA%'
      AND deleted_at IS NOT NULL
  );

-- Delete activity logs (hard delete)
DELETE FROM activity_log
WHERE subject_type = 'App\\Models\\SkDocument'
  AND subject_id IN (
    SELECT id FROM sk_documents 
    WHERE unit_kerja LIKE '%Darwata%Glempang%'
      AND nama NOT LIKE '%WARDAH URJUWAN ARIBAH%'
      AND nama NOT LIKE '%NILNA FAIZALLUQYANA%'
      AND deleted_at IS NOT NULL
  );
```

### Step 5: Hard Delete (If Needed)

```sql
-- CAUTION: This permanently deletes records
-- Only run if you're sure you want permanent deletion

DELETE FROM sk_documents
WHERE unit_kerja LIKE '%Darwata%Glempang%'
  AND nama NOT LIKE '%WARDAH URJUWAN ARIBAH%'
  AND nama NOT LIKE '%NILNA FAIZALLUQYANA%'
  AND deleted_at IS NOT NULL;
```

## Alternative: Using Docker Exec with Correct Container

If you want to use the artisan command instead:

```bash
# Get the exact backend container name
docker ps --format "{{.Names}}" | grep backend

# Example output: backend-yam0yy9a6l424v8j89hv7pqr-151605261992

# Run the command with the FULL container name (not ID)
docker exec backend-yam0yy9a6l424v8j89hv7pqr-151605261992 php artisan sk:delete-test-submissions \
  --school="MI Darwata Glempang" \
  --exclude-names="WARDAH URJUWAN ARIBAH,NILNA FAIZALLUQYANA" \
  --dry-run

# If dry-run looks good, run without --dry-run
docker exec backend-yam0yy9a6l424v8j89hv7pqr-151605261992 php artisan sk:delete-test-submissions \
  --school="MI Darwata Glempang" \
  --exclude-names="WARDAH URJUWAN ARIBAH,NILNA FAIZALLUQYANA"
```

## Verification Queries

```sql
-- Check remaining SK documents for MI Darwata Glempang
SELECT 
    id, 
    nomor_sk, 
    nama, 
    unit_kerja, 
    status,
    deleted_at
FROM sk_documents
WHERE unit_kerja LIKE '%Darwata%Glempang%'
ORDER BY deleted_at NULLS FIRST, created_at DESC;

-- Should only show the 2 preserved records (WARDAH and NILNA)
SELECT COUNT(*) as remaining_active
FROM sk_documents
WHERE unit_kerja LIKE '%Darwata%Glempang%'
  AND deleted_at IS NULL;
```

## Notes

- **Soft Delete**: Sets `deleted_at` timestamp, records can be restored
- **Hard Delete**: Permanently removes records from database
- **Activity Logs**: Related activity logs should be cleaned up to avoid orphaned records
- **Backup**: Consider backing up the database before deletion if needed

## Restore Soft-Deleted Records (If Needed)

```sql
-- Restore all soft-deleted SK documents from MI Darwata Glempang
UPDATE sk_documents
SET deleted_at = NULL
WHERE unit_kerja LIKE '%Darwata%Glempang%'
  AND deleted_at IS NOT NULL;
```
