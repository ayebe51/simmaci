# Production Normalization Guide

Panduan step-by-step untuk normalisasi di production dengan aman.

## ⚠️ PENTING: Baca Ini Dulu!

**JANGAN** langsung jalankan update di production tanpa:
1. ✅ Backup database
2. ✅ Test di development/staging
3. ✅ Preview perubahan
4. ✅ Approval dari tim

---

## 📋 Pre-Flight Checklist

```
[ ] Database sudah di-backup
[ ] Sudah test di development
[ ] Sudah review preview hasil
[ ] Sudah dapat approval
[ ] Sudah siapkan rollback plan
[ ] Sudah inform user (jika perlu)
```

---

## 🔒 Step 1: Backup Database

### Via Command Line
```bash
# PostgreSQL
pg_dump -U username -d database_name > backup_$(date +%Y%m%d_%H%M%S).sql

# Atau via Laravel
php artisan db:backup
```

### Via Tinker (Backup Specific Tables)
```bash
php artisan tinker
```

```php
use App\Models\Teacher;
use App\Models\SkDocument;
use App\Models\HeadmasterTenure;

// Backup Teacher
$teacherBackup = Teacher::all()->map(fn($t) => [
    'id' => $t->id,
    'nama' => $t->nama,
    'school_id' => $t->school_id,
])->toArray();
file_put_contents('backup_teacher_' . date('YmdHis') . '.json', json_encode($teacherBackup, JSON_PRETTY_PRINT));
echo "✓ Teacher backed up: " . count($teacherBackup) . " records\n";

// Backup SkDocument
$skBackup = SkDocument::all()->map(fn($d) => [
    'id' => $d->id,
    'nama' => $d->nama,
    'school_id' => $d->school_id,
])->toArray();
file_put_contents('backup_sk_document_' . date('YmdHis') . '.json', json_encode($skBackup, JSON_PRETTY_PRINT));
echo "✓ SkDocument backed up: " . count($skBackup) . " records\n";

// Backup HeadmasterTenure
$tenureBackup = HeadmasterTenure::all()->map(fn($t) => [
    'id' => $t->id,
    'teacher_name' => $t->teacher_name,
    'school_id' => $t->school_id,
])->toArray();
file_put_contents('backup_headmaster_tenure_' . date('YmdHis') . '.json', json_encode($tenureBackup, JSON_PRETTY_PRINT));
echo "✓ HeadmasterTenure backed up: " . count($tenureBackup) . " records\n";

echo "\n✓ All backups completed!\n";
```

---

## 🔍 Step 2: Preview & Analysis

```bash
php artisan tinker
```

```php
use App\Models\Teacher;
use App\Models\SkDocument;
use App\Models\HeadmasterTenure;
use App\Services\NormalizationService;

$service = app(NormalizationService::class);

// === ANALYSIS ===
echo "=== NORMALIZATION ANALYSIS ===\n\n";

// Teacher Analysis
$teacherTotal = Teacher::count();
$teacherNeedsUpdate = 0;
$teacherSamples = [];

Teacher::chunk(100, function($teachers) use ($service, &$teacherNeedsUpdate, &$teacherSamples) {
    foreach ($teachers as $t) {
        $normalized = $service->normalizeTeacherName($t->nama);
        if ($t->nama !== $normalized) {
            $teacherNeedsUpdate++;
            if (count($teacherSamples) < 10) {
                $teacherSamples[] = [
                    'id' => $t->id,
                    'before' => $t->nama,
                    'after' => $normalized,
                ];
            }
        }
    }
});

echo "TEACHER:\n";
echo "  Total: {$teacherTotal}\n";
echo "  Needs update: {$teacherNeedsUpdate}\n";
echo "  OK: " . ($teacherTotal - $teacherNeedsUpdate) . "\n";
echo "  Percentage: " . round(($teacherNeedsUpdate / $teacherTotal) * 100, 2) . "%\n\n";

echo "Sample changes (first 10):\n";
foreach ($teacherSamples as $sample) {
    echo "  ID {$sample['id']}: '{$sample['before']}' → '{$sample['after']}'\n";
}

// SkDocument Analysis
$skTotal = SkDocument::count();
$skNeedsUpdate = 0;
$skSamples = [];

SkDocument::chunk(100, function($documents) use ($service, &$skNeedsUpdate, &$skSamples) {
    foreach ($documents as $d) {
        $normalized = $service->normalizeTeacherName($d->nama);
        if ($d->nama !== $normalized) {
            $skNeedsUpdate++;
            if (count($skSamples) < 10) {
                $skSamples[] = [
                    'id' => $d->id,
                    'before' => $d->nama,
                    'after' => $normalized,
                ];
            }
        }
    }
});

echo "\n\nSK DOCUMENT:\n";
echo "  Total: {$skTotal}\n";
echo "  Needs update: {$skNeedsUpdate}\n";
echo "  OK: " . ($skTotal - $skNeedsUpdate) . "\n";
echo "  Percentage: " . round(($skNeedsUpdate / $skTotal) * 100, 2) . "%\n\n";

echo "Sample changes (first 10):\n";
foreach ($skSamples as $sample) {
    echo "  ID {$sample['id']}: '{$sample['before']}' → '{$sample['after']}'\n";
}

// HeadmasterTenure Analysis
$tenureTotal = HeadmasterTenure::count();
$tenureNeedsUpdate = 0;
$tenureSamples = [];

HeadmasterTenure::chunk(100, function($tenures) use ($service, &$tenureNeedsUpdate, &$tenureSamples) {
    foreach ($tenures as $t) {
        $normalized = $service->normalizeTeacherName($t->teacher_name);
        if ($t->teacher_name !== $normalized) {
            $tenureNeedsUpdate++;
            if (count($tenureSamples) < 10) {
                $tenureSamples[] = [
                    'id' => $t->id,
                    'before' => $t->teacher_name,
                    'after' => $normalized,
                ];
            }
        }
    }
});

echo "\n\nHEADMASTER TENURE:\n";
echo "  Total: {$tenureTotal}\n";
echo "  Needs update: {$tenureNeedsUpdate}\n";
echo "  OK: " . ($tenureTotal - $tenureNeedsUpdate) . "\n";
echo "  Percentage: " . round(($tenureNeedsUpdate / $tenureTotal) * 100, 2) . "%\n\n";

echo "Sample changes (first 10):\n";
foreach ($tenureSamples as $sample) {
    echo "  ID {$sample['id']}: '{$sample['before']}' → '{$sample['after']}'\n";
}

// Summary
$totalRecords = $teacherTotal + $skTotal + $tenureTotal;
$totalNeedsUpdate = $teacherNeedsUpdate + $skNeedsUpdate + $tenureNeedsUpdate;

echo "\n\n=== SUMMARY ===\n";
echo "Total records: {$totalRecords}\n";
echo "Needs update: {$totalNeedsUpdate}\n";
echo "OK: " . ($totalRecords - $totalNeedsUpdate) . "\n";
echo "Overall percentage: " . round(($totalNeedsUpdate / $totalRecords) * 100, 2) . "%\n";

// Export to file for review
$report = [
    'timestamp' => date('Y-m-d H:i:s'),
    'summary' => [
        'total_records' => $totalRecords,
        'needs_update' => $totalNeedsUpdate,
        'ok' => $totalRecords - $totalNeedsUpdate,
        'percentage' => round(($totalNeedsUpdate / $totalRecords) * 100, 2),
    ],
    'teacher' => [
        'total' => $teacherTotal,
        'needs_update' => $teacherNeedsUpdate,
        'samples' => $teacherSamples,
    ],
    'sk_document' => [
        'total' => $skTotal,
        'needs_update' => $skNeedsUpdate,
        'samples' => $skSamples,
    ],
    'headmaster_tenure' => [
        'total' => $tenureTotal,
        'needs_update' => $tenureNeedsUpdate,
        'samples' => $tenureSamples,
    ],
];

file_put_contents('normalization_report_' . date('YmdHis') . '.json', json_encode($report, JSON_PRETTY_PRINT));
echo "\n✓ Report saved to normalization_report_" . date('YmdHis') . ".json\n";
```

**Review the report file and get approval before proceeding!**

---

## ✅ Step 3: Execute Normalization (Production)

**ONLY proceed if:**
- ✅ Backup completed
- ✅ Report reviewed and approved
- ✅ Ready to execute

```bash
php artisan tinker
```

```php
use App\Models\Teacher;
use App\Models\SkDocument;
use App\Models\HeadmasterTenure;
use App\Services\NormalizationService;

$service = app(NormalizationService::class);

// === EXECUTION ===
echo "=== STARTING NORMALIZATION ===\n";
echo "Started at: " . date('Y-m-d H:i:s') . "\n\n";

$startTime = microtime(true);
$stats = [
    'teacher' => ['updated' => 0, 'skipped' => 0, 'errors' => 0],
    'sk_document' => ['updated' => 0, 'skipped' => 0, 'errors' => 0],
    'headmaster_tenure' => ['updated' => 0, 'skipped' => 0, 'errors' => 0],
];

// 1. Update Teacher
echo "=== Processing Teachers ===\n";
Teacher::chunk(100, function($teachers) use ($service, &$stats) {
    foreach ($teachers as $t) {
        try {
            $normalized = $service->normalizeTeacherName($t->nama);
            if ($t->nama !== $normalized) {
                $t->update(['nama' => $normalized]);
                $stats['teacher']['updated']++;
                if ($stats['teacher']['updated'] % 100 === 0) {
                    echo "  Progress: {$stats['teacher']['updated']} updated...\n";
                }
            } else {
                $stats['teacher']['skipped']++;
            }
        } catch (\Exception $e) {
            $stats['teacher']['errors']++;
            echo "  ERROR ID {$t->id}: " . $e->getMessage() . "\n";
        }
    }
});
echo "✓ Teachers: {$stats['teacher']['updated']} updated, {$stats['teacher']['skipped']} skipped, {$stats['teacher']['errors']} errors\n\n";

// 2. Update SkDocument
echo "=== Processing SK Documents ===\n";
SkDocument::chunk(100, function($documents) use ($service, &$stats) {
    foreach ($documents as $d) {
        try {
            $normalized = $service->normalizeTeacherName($d->nama);
            if ($d->nama !== $normalized) {
                $d->update(['nama' => $normalized]);
                $stats['sk_document']['updated']++;
                if ($stats['sk_document']['updated'] % 100 === 0) {
                    echo "  Progress: {$stats['sk_document']['updated']} updated...\n";
                }
            } else {
                $stats['sk_document']['skipped']++;
            }
        } catch (\Exception $e) {
            $stats['sk_document']['errors']++;
            echo "  ERROR ID {$d->id}: " . $e->getMessage() . "\n";
        }
    }
});
echo "✓ SK Documents: {$stats['sk_document']['updated']} updated, {$stats['sk_document']['skipped']} skipped, {$stats['sk_document']['errors']} errors\n\n";

// 3. Update HeadmasterTenure
echo "=== Processing Headmaster Tenures ===\n";
HeadmasterTenure::chunk(100, function($tenures) use ($service, &$stats) {
    foreach ($tenures as $t) {
        try {
            $normalized = $service->normalizeTeacherName($t->teacher_name);
            if ($t->teacher_name !== $normalized) {
                $t->update(['teacher_name' => $normalized]);
                $stats['headmaster_tenure']['updated']++;
                if ($stats['headmaster_tenure']['updated'] % 100 === 0) {
                    echo "  Progress: {$stats['headmaster_tenure']['updated']} updated...\n";
                }
            } else {
                $stats['headmaster_tenure']['skipped']++;
            }
        } catch (\Exception $e) {
            $stats['headmaster_tenure']['errors']++;
            echo "  ERROR ID {$t->id}: " . $e->getMessage() . "\n";
        }
    }
});
echo "✓ Headmaster Tenures: {$stats['headmaster_tenure']['updated']} updated, {$stats['headmaster_tenure']['skipped']} skipped, {$stats['headmaster_tenure']['errors']} errors\n\n";

$endTime = microtime(true);
$duration = round($endTime - $startTime, 2);

// Final Summary
echo "=== NORMALIZATION COMPLETED ===\n";
echo "Finished at: " . date('Y-m-d H:i:s') . "\n";
echo "Duration: {$duration} seconds\n\n";

$totalUpdated = $stats['teacher']['updated'] + $stats['sk_document']['updated'] + $stats['headmaster_tenure']['updated'];
$totalSkipped = $stats['teacher']['skipped'] + $stats['sk_document']['skipped'] + $stats['headmaster_tenure']['skipped'];
$totalErrors = $stats['teacher']['errors'] + $stats['sk_document']['errors'] + $stats['headmaster_tenure']['errors'];

echo "SUMMARY:\n";
echo "  Total updated: {$totalUpdated}\n";
echo "  Total skipped: {$totalSkipped}\n";
echo "  Total errors: {$totalErrors}\n\n";

echo "BREAKDOWN:\n";
echo "  Teacher: {$stats['teacher']['updated']} updated, {$stats['teacher']['skipped']} skipped, {$stats['teacher']['errors']} errors\n";
echo "  SK Document: {$stats['sk_document']['updated']} updated, {$stats['sk_document']['skipped']} skipped, {$stats['sk_document']['errors']} errors\n";
echo "  Headmaster Tenure: {$stats['headmaster_tenure']['updated']} updated, {$stats['headmaster_tenure']['skipped']} skipped, {$stats['headmaster_tenure']['errors']} errors\n";

// Save execution log
$executionLog = [
    'timestamp' => date('Y-m-d H:i:s'),
    'duration_seconds' => $duration,
    'stats' => $stats,
    'summary' => [
        'total_updated' => $totalUpdated,
        'total_skipped' => $totalSkipped,
        'total_errors' => $totalErrors,
    ],
];

file_put_contents('normalization_execution_' . date('YmdHis') . '.json', json_encode($executionLog, JSON_PRETTY_PRINT));
echo "\n✓ Execution log saved to normalization_execution_" . date('YmdHis') . ".json\n";

if ($totalErrors > 0) {
    echo "\n⚠️  WARNING: There were {$totalErrors} errors during execution. Please review the log.\n";
} else {
    echo "\n✓ SUCCESS: All records processed without errors!\n";
}
```

---

## 🔄 Step 4: Verification

```php
use App\Models\Teacher;
use App\Services\NormalizationService;

$service = app(NormalizationService::class);

// Verify no more records need update
$stillNeedsUpdate = Teacher::get()->filter(fn($t) => $t->nama !== $service->normalizeTeacherName($t->nama))->count();

echo "Verification:\n";
echo "  Records still need update: {$stillNeedsUpdate}\n";

if ($stillNeedsUpdate === 0) {
    echo "✓ All records normalized successfully!\n";
} else {
    echo "⚠️  Warning: {$stillNeedsUpdate} records still need update\n";
    echo "  Run the analysis again to see which records\n";
}

// Sample check
echo "\nSample verification (10 random records):\n";
Teacher::inRandomOrder()->limit(10)->get()->each(function($t) use ($service) {
    $normalized = $service->normalizeTeacherName($t->nama);
    $status = $t->nama === $normalized ? '✓' : '✗';
    echo "  {$status} ID {$t->id}: {$t->nama}\n";
});
```

---

## 🔙 Rollback (If Needed)

### Rollback from JSON Backup

```php
// Teacher
$backup = json_decode(file_get_contents('backup_teacher_20260504123456.json'), true);
$restored = 0;
foreach ($backup as $record) {
    $teacher = Teacher::find($record['id']);
    if ($teacher && $teacher->nama !== $record['nama']) {
        $teacher->update(['nama' => $record['nama']]);
        $restored++;
    }
}
echo "✓ Restored {$restored} teachers\n";

// SkDocument
$backup = json_decode(file_get_contents('backup_sk_document_20260504123456.json'), true);
$restored = 0;
foreach ($backup as $record) {
    $doc = SkDocument::find($record['id']);
    if ($doc && $doc->nama !== $record['nama']) {
        $doc->update(['nama' => $record['nama']]);
        $restored++;
    }
}
echo "✓ Restored {$restored} SK documents\n";

// HeadmasterTenure
$backup = json_decode(file_get_contents('backup_headmaster_tenure_20260504123456.json'), true);
$restored = 0;
foreach ($backup as $record) {
    $tenure = HeadmasterTenure::find($record['id']);
    if ($tenure && $tenure->teacher_name !== $record['teacher_name']) {
        $tenure->update(['teacher_name' => $record['teacher_name']]);
        $restored++;
    }
}
echo "✓ Restored {$restored} headmaster tenures\n";
```

### Rollback from SQL Backup

```bash
# PostgreSQL
psql -U username -d database_name < backup_20260504_123456.sql
```

---

## 📊 Post-Execution Checklist

```
[ ] Verification completed - no records need update
[ ] Sample check passed
[ ] Execution log reviewed
[ ] No errors in log
[ ] Backup files archived
[ ] Team notified of completion
[ ] Documentation updated
```

---

## 🆘 Emergency Contacts

If something goes wrong:
1. **STOP** immediately (Ctrl+C in tinker)
2. **DO NOT** run any more commands
3. **CONTACT** database admin
4. **PREPARE** rollback from backup

---

## 📝 Notes

- Execution time depends on dataset size (estimate: ~1000 records/minute)
- Memory usage is optimized with chunk(100)
- All changes are logged for audit trail
- Backup files should be kept for at least 30 days

---

**Created by**: Kiro AI Assistant  
**Version**: 1.0  
**Last Updated**: 2026-05-04
