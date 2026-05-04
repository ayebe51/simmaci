# Tinker Commands untuk Normalisasi Gelar

Copy-paste command ini langsung ke tinker untuk normalisasi data.

## 🚀 Quick Start

```bash
php artisan tinker
```

## 📋 Setup (Jalankan ini dulu)

```php
use App\Models\Teacher;
use App\Models\SkDocument;
use App\Models\HeadmasterTenure;
use App\Services\NormalizationService;

$service = app(NormalizationService::class);
```

---

## 1️⃣ Preview Perubahan (Dry Run)

### Preview 10 Teacher Pertama
```php
Teacher::limit(10)->get()->each(function($t) use ($service) {
    $normalized = $service->normalizeTeacherName($t->nama);
    if ($t->nama !== $normalized) {
        echo "ID {$t->id}: '{$t->nama}' → '{$normalized}'\n";
    }
});
```

### Preview Teacher dengan Gelar Menempel
```php
// Cari nama yang kemungkinan punya gelar menempel (no spaces, all caps, length > 8)
Teacher::whereRaw("nama = UPPER(nama)")
    ->whereRaw("nama NOT LIKE '% %'")
    ->whereRaw("LENGTH(nama) > 8")
    ->limit(20)
    ->get()
    ->each(function($t) use ($service) {
        $normalized = $service->normalizeTeacherName($t->nama);
        echo "ID {$t->id}: '{$t->nama}' → '{$normalized}'\n";
    });
```

### Preview Teacher dengan Gelar Lowercase
```php
Teacher::where(function($q) {
    $q->where('nama', 'LIKE', '% s.%')
      ->orWhere('nama', 'LIKE', '% m.%')
      ->orWhere('nama', 'LIKE', '% dr.%')
      ->orWhere('nama', 'LIKE', '% dra.%');
})
->limit(20)
->get()
->each(function($t) use ($service) {
    $normalized = $service->normalizeTeacherName($t->nama);
    if ($t->nama !== $normalized) {
        echo "ID {$t->id}: '{$t->nama}' → '{$normalized}'\n";
    }
});
```

### Count Total yang Akan Berubah
```php
$count = 0;
Teacher::chunk(100, function($teachers) use ($service, &$count) {
    foreach ($teachers as $t) {
        $normalized = $service->normalizeTeacherName($t->nama);
        if ($t->nama !== $normalized) {
            $count++;
        }
    }
});
echo "Total yang akan berubah: {$count}\n";
```

---

## 2️⃣ Update Single Teacher

### Update by ID
```php
$teacher = Teacher::find(1);
echo "Before: {$teacher->nama}\n";
$teacher->nama = $service->normalizeTeacherName($teacher->nama);
$teacher->save();
echo "After:  {$teacher->nama}\n";
```

### Update by Name (Search)
```php
$teacher = Teacher::where('nama', 'LIKE', '%MAFTUH%')->first();
if ($teacher) {
    echo "Before: {$teacher->nama}\n";
    $teacher->nama = $service->normalizeTeacherName($teacher->nama);
    $teacher->save();
    echo "After:  {$teacher->nama}\n";
} else {
    echo "Teacher not found\n";
}
```

---

## 3️⃣ Update Multiple Teachers

### Update Semua Teacher (dengan Progress)
```php
$updated = 0;
$skipped = 0;

Teacher::chunk(100, function($teachers) use ($service, &$updated, &$skipped) {
    foreach ($teachers as $t) {
        $normalized = $service->normalizeTeacherName($t->nama);
        if ($t->nama !== $normalized) {
            echo "ID {$t->id}: '{$t->nama}' → '{$normalized}'\n";
            $t->update(['nama' => $normalized]);
            $updated++;
        } else {
            $skipped++;
        }
    }
    echo "Progress: {$updated} updated, {$skipped} skipped\n";
});

echo "\n✓ Done! Total: {$updated} updated, {$skipped} skipped\n";
```

### Update Teacher by School
```php
$schoolId = 1; // Ganti dengan school_id yang diinginkan
$updated = 0;

Teacher::where('school_id', $schoolId)
    ->chunk(100, function($teachers) use ($service, &$updated) {
        foreach ($teachers as $t) {
            $normalized = $service->normalizeTeacherName($t->nama);
            if ($t->nama !== $normalized) {
                echo "ID {$t->id}: '{$t->nama}' → '{$normalized}'\n";
                $t->update(['nama' => $normalized]);
                $updated++;
            }
        }
    });

echo "\n✓ Done! Total updated: {$updated}\n";
```

### Update Teacher dengan Gelar Menempel Saja
```php
$updated = 0;

Teacher::whereRaw("nama = UPPER(nama)")
    ->whereRaw("nama NOT LIKE '% %'")
    ->whereRaw("LENGTH(nama) > 8")
    ->chunk(100, function($teachers) use ($service, &$updated) {
        foreach ($teachers as $t) {
            $normalized = $service->normalizeTeacherName($t->nama);
            if ($t->nama !== $normalized) {
                echo "ID {$t->id}: '{$t->nama}' → '{$normalized}'\n";
                $t->update(['nama' => $normalized]);
                $updated++;
            }
        }
    });

echo "\n✓ Done! Total updated: {$updated}\n";
```

### Update Teacher dengan Gelar Lowercase Saja
```php
$updated = 0;

Teacher::where(function($q) {
    $q->where('nama', 'LIKE', '% s.%')
      ->orWhere('nama', 'LIKE', '% m.%')
      ->orWhere('nama', 'LIKE', '% dr.%');
})
->chunk(100, function($teachers) use ($service, &$updated) {
    foreach ($teachers as $t) {
        $normalized = $service->normalizeTeacherName($t->nama);
        if ($t->nama !== $normalized) {
            echo "ID {$t->id}: '{$t->nama}' → '{$normalized}'\n";
            $t->update(['nama' => $normalized]);
            $updated++;
        }
    }
});

echo "\n✓ Done! Total updated: {$updated}\n";
```

---

## 4️⃣ Update SkDocument

### Preview SkDocument
```php
SkDocument::limit(10)->get()->each(function($doc) use ($service) {
    $normalized = $service->normalizeTeacherName($doc->nama);
    if ($doc->nama !== $normalized) {
        echo "ID {$doc->id}: '{$doc->nama}' → '{$normalized}'\n";
    }
});
```

### Update Semua SkDocument
```php
$updated = 0;
$skipped = 0;

SkDocument::chunk(100, function($documents) use ($service, &$updated, &$skipped) {
    foreach ($documents as $doc) {
        $normalized = $service->normalizeTeacherName($doc->nama);
        if ($doc->nama !== $normalized) {
            echo "ID {$doc->id}: '{$doc->nama}' → '{$normalized}'\n";
            $doc->update(['nama' => $normalized]);
            $updated++;
        } else {
            $skipped++;
        }
    }
});

echo "\n✓ Done! Total: {$updated} updated, {$skipped} skipped\n";
```

### Update SkDocument by School
```php
$schoolId = 1;
$updated = 0;

SkDocument::where('school_id', $schoolId)
    ->chunk(100, function($documents) use ($service, &$updated) {
        foreach ($documents as $doc) {
            $normalized = $service->normalizeTeacherName($doc->nama);
            if ($doc->nama !== $normalized) {
                echo "ID {$doc->id}: '{$doc->nama}' → '{$normalized}'\n";
                $doc->update(['nama' => $normalized]);
                $updated++;
            }
        }
    });

echo "\n✓ Done! Total updated: {$updated}\n";
```

---

## 5️⃣ Update HeadmasterTenure

### Preview HeadmasterTenure
```php
HeadmasterTenure::limit(10)->get()->each(function($tenure) use ($service) {
    $normalized = $service->normalizeTeacherName($tenure->teacher_name);
    if ($tenure->teacher_name !== $normalized) {
        echo "ID {$tenure->id}: '{$tenure->teacher_name}' → '{$normalized}'\n";
    }
});
```

### Update Semua HeadmasterTenure
```php
$updated = 0;
$skipped = 0;

HeadmasterTenure::chunk(100, function($tenures) use ($service, &$updated, &$skipped) {
    foreach ($tenures as $tenure) {
        $normalized = $service->normalizeTeacherName($tenure->teacher_name);
        if ($tenure->teacher_name !== $normalized) {
            echo "ID {$tenure->id}: '{$tenure->teacher_name}' → '{$normalized}'\n";
            $tenure->update(['teacher_name' => $normalized]);
            $updated++;
        } else {
            $skipped++;
        }
    }
});

echo "\n✓ Done! Total: {$updated} updated, {$skipped} skipped\n";
```

---

## 6️⃣ Update Semua Model Sekaligus

### Preview Semua Model
```php
echo "=== TEACHER ===\n";
$teacherCount = 0;
Teacher::limit(5)->get()->each(function($t) use ($service, &$teacherCount) {
    $normalized = $service->normalizeTeacherName($t->nama);
    if ($t->nama !== $normalized) {
        echo "ID {$t->id}: '{$t->nama}' → '{$normalized}'\n";
        $teacherCount++;
    }
});

echo "\n=== SK DOCUMENT ===\n";
$skCount = 0;
SkDocument::limit(5)->get()->each(function($doc) use ($service, &$skCount) {
    $normalized = $service->normalizeTeacherName($doc->nama);
    if ($doc->nama !== $normalized) {
        echo "ID {$doc->id}: '{$doc->nama}' → '{$normalized}'\n";
        $skCount++;
    }
});

echo "\n=== HEADMASTER TENURE ===\n";
$tenureCount = 0;
HeadmasterTenure::limit(5)->get()->each(function($tenure) use ($service, &$tenureCount) {
    $normalized = $service->normalizeTeacherName($tenure->teacher_name);
    if ($tenure->teacher_name !== $normalized) {
        echo "ID {$tenure->id}: '{$tenure->teacher_name}' → '{$normalized}'\n";
        $tenureCount++;
    }
});

echo "\nSample: Teacher={$teacherCount}, SK={$skCount}, Tenure={$tenureCount}\n";
```

### Update Semua Model (HATI-HATI!)
```php
$stats = ['teacher' => 0, 'sk' => 0, 'tenure' => 0];

// 1. Update Teacher
echo "=== Updating Teachers ===\n";
Teacher::chunk(100, function($teachers) use ($service, &$stats) {
    foreach ($teachers as $t) {
        $normalized = $service->normalizeTeacherName($t->nama);
        if ($t->nama !== $normalized) {
            echo "Teacher ID {$t->id}: '{$t->nama}' → '{$normalized}'\n";
            $t->update(['nama' => $normalized]);
            $stats['teacher']++;
        }
    }
});

// 2. Update SkDocument
echo "\n=== Updating SK Documents ===\n";
SkDocument::chunk(100, function($documents) use ($service, &$stats) {
    foreach ($documents as $doc) {
        $normalized = $service->normalizeTeacherName($doc->nama);
        if ($doc->nama !== $normalized) {
            echo "SK ID {$doc->id}: '{$doc->nama}' → '{$normalized}'\n";
            $doc->update(['nama' => $normalized]);
            $stats['sk']++;
        }
    }
});

// 3. Update HeadmasterTenure
echo "\n=== Updating Headmaster Tenures ===\n";
HeadmasterTenure::chunk(100, function($tenures) use ($service, &$stats) {
    foreach ($tenures as $tenure) {
        $normalized = $service->normalizeTeacherName($tenure->teacher_name);
        if ($tenure->teacher_name !== $normalized) {
            echo "Tenure ID {$tenure->id}: '{$tenure->teacher_name}' → '{$normalized}'\n";
            $tenure->update(['teacher_name' => $normalized]);
            $stats['tenure']++;
        }
    }
});

echo "\n✓ DONE!\n";
echo "Teacher: {$stats['teacher']} updated\n";
echo "SK Document: {$stats['sk']} updated\n";
echo "Headmaster Tenure: {$stats['tenure']} updated\n";
echo "Total: " . array_sum($stats) . " records updated\n";
```

---

## 7️⃣ Utility Commands

### Test Single Name
```php
$name = 'MAFTUHSAG';
echo "Input:  {$name}\n";
echo "Output: " . $service->normalizeTeacherName($name) . "\n";
```

### Test Multiple Names
```php
$names = [
    'MAFTUHSAG',
    'FATIMAHMPD',
    'dr. ahmad fauzi s.pd',
    'siti, dra.',
    'AHMADSPDI',
];

foreach ($names as $name) {
    $normalized = $service->normalizeTeacherName($name);
    echo "'{$name}' → '{$normalized}'\n";
}
```

### Parse Degrees (Breakdown)
```php
$name = 'dr. ahmad fauzi s.pd m.ag';
$parsed = $service->parseAcademicDegreesPublic($name);
echo "Input: {$name}\n";
echo "Name: {$parsed['name']}\n";
echo "Prefix: " . implode(', ', $parsed['prefix_degrees']) . "\n";
echo "Suffix: " . implode(', ', $parsed['suffix_degrees']) . "\n";
```

### Find Specific Pattern
```php
// Cari nama yang mengandung pattern tertentu
$pattern = 'SAG';
Teacher::where('nama', 'LIKE', "%{$pattern}%")
    ->limit(10)
    ->get()
    ->each(function($t) use ($service) {
        $normalized = $service->normalizeTeacherName($t->nama);
        echo "ID {$t->id}: '{$t->nama}' → '{$normalized}'\n";
    });
```

### Export to CSV (untuk review)
```php
$file = fopen('normalization_preview.csv', 'w');
fputcsv($file, ['ID', 'Before', 'After', 'Changed']);

Teacher::chunk(100, function($teachers) use ($service, $file) {
    foreach ($teachers as $t) {
        $normalized = $service->normalizeTeacherName($t->nama);
        $changed = $t->nama !== $normalized ? 'YES' : 'NO';
        fputcsv($file, [$t->id, $t->nama, $normalized, $changed]);
    }
});

fclose($file);
echo "✓ Exported to normalization_preview.csv\n";
```

---

## 8️⃣ Rollback (Jika Ada Masalah)

### Backup Before Update
```php
// Backup ke array
$backup = [];
Teacher::chunk(100, function($teachers) use (&$backup) {
    foreach ($teachers as $t) {
        $backup[$t->id] = $t->nama;
    }
});
echo "✓ Backed up " . count($backup) . " teachers\n";

// Simpan ke file
file_put_contents('teacher_backup.json', json_encode($backup, JSON_PRETTY_PRINT));
echo "✓ Saved to teacher_backup.json\n";
```

### Restore from Backup
```php
$backup = json_decode(file_get_contents('teacher_backup.json'), true);
$restored = 0;

foreach ($backup as $id => $nama) {
    $teacher = Teacher::find($id);
    if ($teacher && $teacher->nama !== $nama) {
        $teacher->update(['nama' => $nama]);
        $restored++;
        echo "Restored ID {$id}: '{$teacher->nama}' → '{$nama}'\n";
    }
}

echo "✓ Restored {$restored} teachers\n";
```

---

## ⚠️ Safety Tips

1. **Selalu preview dulu** sebelum update
2. **Backup database** sebelum update massal
3. **Test di development** dulu sebelum production
4. **Update per school** untuk kontrol lebih baik
5. **Gunakan chunk()** untuk dataset besar
6. **Monitor progress** dengan echo/print

---

## 🆘 Troubleshooting

### Jika Tinker Hang
```bash
# Ctrl+C untuk stop
# Restart tinker
php artisan tinker
```

### Jika Memory Limit
```php
// Kurangi chunk size
Teacher::chunk(50, function($teachers) { ... });

// Atau tambah memory limit
ini_set('memory_limit', '512M');
```

### Jika Ada Error
```php
// Wrap dengan try-catch
try {
    // Your code here
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
```

---

**Created by**: Kiro AI Assistant  
**Version**: 1.0  
**Last Updated**: 2026-05-04
