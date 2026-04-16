# Bulk SK Submission Timeout Fix

## 🔍 Problem

Upload Excel dengan >15 baris guru untuk pengajuan SK kolektif mengalami **timeout 3000ms** (3 detik). Upload dengan jumlah guru lebih sedikit berhasil.

### Root Cause:

1. **Synchronous processing** - Semua rows diproses dalam satu request
2. **Frontend timeout** - Axios timeout 3 detik terlalu pendek untuk bulk operation
3. **Per-row overhead** - Setiap row: validate → upsert teacher → create SK → create activity log
4. **15+ rows** = ~5-10 detik processing time → melebihi timeout

---

## ✅ Solution: Background Job Processing

### Strategy:

- **Small batches (≤10 rows)**: Process synchronously untuk immediate feedback
- **Large batches (>10 rows)**: Dispatch ke queue untuk background processing

### Benefits:

- ✅ No timeout untuk batch besar
- ✅ User dapat langsung feedback (202 Accepted)
- ✅ Processing berjalan di background via queue worker
- ✅ Small batches tetap instant (< 3s)

---

## 🛠️ Implementation

### 1. Background Job

**File**: `backend/app/Jobs/ProcessBulkSkSubmission.php`

**Features:**
- Timeout: 10 minutes (handle up to 100+ rows)
- Retry: 1 attempt (no retry on failure)
- Logging: Progress every 10 records
- Error handling: Skip failed rows, continue processing
- Activity log: Created after completion

**Usage:**
```php
ProcessBulkSkSubmission::dispatch(
    documents: $documents,
    suratPermohonanUrl: $fileUrl,
    userId: $user->id,
    userEmail: $user->email,
    userSchoolId: $user->school_id,
    userRole: $user->role
);
```

---

### 2. Controller Logic

**File**: `backend/app/Http/Controllers/Api/SkDocumentController.php`

**Method**: `bulkRequest()`

**Logic:**
```php
if (count($documents) <= 10) {
    // Process synchronously
    return $this->processBulkRequestSync($request);
} else {
    // Dispatch to queue
    ProcessBulkSkSubmission::dispatch(...);
    return response()->json([
        'success' => true,
        'message' => 'Pengajuan sedang diproses di background...',
        'queued' => true,
        'count' => count($documents),
    ], 202); // 202 Accepted
}
```

---

### 3. Frontend Handling

**File**: `src/features/sk-management/components/BulkSkSubmission.tsx`

**Changes:**
```typescript
onSuccess: (res) => {
  if (res.queued) {
    // Large batch queued
    toast.success(res.message, { duration: 5000 })
  } else {
    // Small batch processed immediately
    toast.success(`${res.count} SK berhasil diajukan`)
  }
  setShowSuccessModal(true)
}
```

---

## 📊 Performance Comparison

| Rows | Before | After |
|------|--------|-------|
| 5 rows | ✅ < 2s (sync) | ✅ < 2s (sync) |
| 10 rows | ✅ ~3s (sync) | ✅ ~3s (sync) |
| 15 rows | ❌ Timeout (3s) | ✅ 202 Queued (instant) |
| 20 rows | ❌ Timeout (3s) | ✅ 202 Queued (instant) |
| 50 rows | ❌ Timeout (3s) | ✅ 202 Queued (instant) |
| 100 rows | ❌ Timeout (3s) | ✅ 202 Queued (instant) |

**Processing Time (Background):**
- 15 rows: ~5-7 seconds
- 50 rows: ~15-20 seconds
- 100 rows: ~30-40 seconds

---

## 🚀 Deployment

### 1. Redeploy Application

Coolify akan auto-deploy setelah push.

### 2. Verify Queue Worker Running

```bash
# Check supervisor processes
docker exec <backend-container> supervisorctl status

# Expected output:
# queue-worker                     RUNNING
```

### 3. Test Bulk Upload

**Small batch (≤10 rows):**
- Upload Excel dengan 5-10 guru
- Expected: Immediate success response (< 3s)

**Large batch (>10 rows):**
- Upload Excel dengan 15+ guru
- Expected: "Pengajuan sedang diproses di background..." (instant)
- Check queue logs untuk progress

---

## 🔧 Monitoring

### Check Queue Processing

```bash
# Watch queue worker logs
docker logs -f <backend-container> | grep "ProcessBulkSkSubmission"

# Expected output:
# [timestamp] ProcessBulkSkSubmission: Starting (total_documents: 20)
# [timestamp] ProcessBulkSkSubmission: Progress 10/20
# [timestamp] ProcessBulkSkSubmission: Completed (created: 20, skipped: 0)
```

### Check Job Status

```bash
# Check jobs table
docker exec <backend-container> php artisan tinker
```

In tinker:
```php
// Check pending jobs
DB::table('jobs')->count();

// Check failed jobs
DB::table('failed_jobs')->count();

// View recent failed jobs
DB::table('failed_jobs')->latest()->take(5)->get();
```

---

## 🐛 Troubleshooting

### Issue: Queue Worker Not Running

**Check:**
```bash
docker exec <backend-container> supervisorctl status queue-worker
```

**Fix:**
```bash
docker exec <backend-container> supervisorctl restart queue-worker
```

### Issue: Jobs Not Processing

**Check queue connection:**
```bash
docker exec <backend-container> php artisan queue:listen --once
```

**Check database driver:**
```bash
# Verify QUEUE_CONNECTION=database in .env
docker exec <backend-container> cat .env | grep QUEUE_CONNECTION
```

### Issue: Job Failed

**View failed job details:**
```bash
docker exec <backend-container> php artisan queue:failed
```

**Retry failed job:**
```bash
docker exec <backend-container> php artisan queue:retry <job-id>
```

**Retry all failed jobs:**
```bash
docker exec <backend-container> php artisan queue:retry all
```

---

## 📈 Scalability

### Current Limits:

- **Small batch**: ≤10 rows (synchronous)
- **Large batch**: >10 rows (background)
- **Job timeout**: 10 minutes
- **Max rows per batch**: ~200 rows (estimated)

### To Handle Larger Batches:

**Option 1: Increase job timeout**
```php
// In ProcessBulkSkSubmission.php
public $timeout = 1200; // 20 minutes
```

**Option 2: Chunk processing**
```php
// Process in chunks of 50
foreach (array_chunk($documents, 50) as $chunk) {
    ProcessBulkSkSubmission::dispatch($chunk, ...);
}
```

**Option 3: Lower threshold**
```php
// Dispatch to queue for >5 rows instead of >10
if (count($documents) > 5) {
    // dispatch to queue
}
```

---

## ✅ Testing Checklist

After deployment:

- [ ] Upload 5 rows → Immediate success (< 3s)
- [ ] Upload 10 rows → Immediate success (< 3s)
- [ ] Upload 15 rows → Queued message (instant)
- [ ] Upload 20 rows → Queued message (instant)
- [ ] Check queue logs → Job processing
- [ ] Check SK documents → All created successfully
- [ ] Check activity logs → Bulk submission logged
- [ ] No timeout errors in frontend

---

## 📚 Related Files

- `backend/app/Jobs/ProcessBulkSkSubmission.php` - Background job
- `backend/app/Http/Controllers/Api/SkDocumentController.php` - Controller logic
- `src/features/sk-management/components/BulkSkSubmission.tsx` - Frontend component
- `backend/docker/supervisor/backend.conf` - Queue worker config

---

**Last Updated**: 2026-04-15
**Commit**: 60100a7
