# Contoh Penggunaan Tinker untuk Normalisasi Gelar

## Quick Start

### 1. Normalisasi Single Name via CLI

```bash
php artisan tinker:normalize-gelar "dr. ahmad fauzi s.pd"
```

### 2. Normalisasi via Tinker

```bash
php artisan tinker
```

Kemudian di dalam tinker:

```php
// Import service
$service = app(App\Services\NormalizationService::class);

// Normalisasi single name
$service->normalizeTeacherName('dr. ahmad fauzi s.pd');
// Output: "Dr. AHMAD FAUZI, S.Pd."

// Parse degrees (breakdown)
$service->parseAcademicDegreesPublic('ahmad s.pd.i m.ag');
// Output:
// [
//   "name" => "AHMAD",
//   "prefix_degrees" => [],
//   "suffix_degrees" => ["S.Pd.I", "M.Ag."]
// ]
```

## Contoh Kasus Umum

### Kasus 1: Gelar Menempel (Attached Degrees)

```php
$service->normalizeTeacherName('AHMADSPDI');
// Output: "AHMAD, S.Pd.I"

$service->normalizeTeacherName('FATIMAHMPD');
// Output: "FATIMAH, M.Pd."

$service->normalizeTeacherName('HASANAMAPDSD');
// Output: "HASAN, A.Ma.Pd.SD."
```

### Kasus 2: Gelar Depan (Prefix Degrees)

```php
$service->normalizeTeacherName('dr. ahmad fauzi');
// Output: "Dr. AHMAD FAUZI"

$service->normalizeTeacherName('dra. siti fatimah');
// Output: "Dra. SITI FATIMAH"

$service->normalizeTeacherName('prof. dr. ahmad');
// Output: "Prof. Dr. AHMAD"
```

### Kasus 3: Multiple Gelar

```php
$service->normalizeTeacherName('ahmad s.pd m.pd');
// Output: "AHMAD, S.Pd., M.Pd."

$service->normalizeTeacherName('dr. ahmad s.pd m.pd');
// Output: "Dr. AHMAD, S.Pd., M.Pd."

$service->normalizeTeacherName('prof. dr. ahmad s.pd m.pd');
// Output: "Prof. Dr. AHMAD, S.Pd., M.Pd."
```

### Kasus 4: Gelar Terbalik (Reversed)

```php
$service->normalizeTeacherName('fatimah, dra.');
// Output: "Dra. FATIMAH"

$service->normalizeTeacherName('mumbasitoh, dra.');
// Output: "Dra. MUMBASITOH"
```

### Kasus 5: Format Campuran

```php
$service->normalizeTeacherName('AHMAD FAUZI SPD');
// Output: "AHMAD FAUZI, S.Pd."

$service->normalizeTeacherName('siti fatimah mag');
// Output: "SITI FATIMAH, M.Ag."
```

## Update Database via Tinker

### Update Single Teacher

```php
use App\Models\Teacher;
use App\Services\NormalizationService;

$service = app(NormalizationService::class);

// Find teacher by ID
$teacher = Teacher::find(1);

// Normalize name
$normalized = $service->normalizeTeacherName($teacher->nama);

// Show before/after
echo "Before: {$teacher->nama}\n";
echo "After:  {$normalized}\n";

// Update if changed
if ($teacher->nama !== $normalized) {
    $teacher->nama = $normalized;
    $teacher->save();
    echo "✓ Updated!\n";
}
```

### Update Multiple Teachers (Batch)

```php
use App\Models\Teacher;
use App\Services\NormalizationService;

$service = app(NormalizationService::class);

$updated = 0;
$skipped = 0;

Teacher::chunk(100, function($teachers) use ($service, &$updated, &$skipped) {
    foreach ($teachers as $teacher) {
        $normalized = $service->normalizeTeacherName($teacher->nama);
        
        if ($teacher->nama !== $normalized) {
            echo "ID {$teacher->id}: '{$teacher->nama}' → '{$normalized}'\n";
            $teacher->update(['nama' => $normalized]);
            $updated++;
        } else {
            $skipped++;
        }
    }
});

echo "\nTotal: {$updated} updated, {$skipped} skipped\n";
```

### Update Teachers by School

```php
use App\Models\Teacher;
use App\Services\NormalizationService;

$service = app(NormalizationService::class);
$schoolId = 1; // Ganti dengan school_id yang diinginkan

$updated = 0;

Teacher::where('school_id', $schoolId)
    ->chunk(100, function($teachers) use ($service, &$updated) {
        foreach ($teachers as $teacher) {
            $normalized = $service->normalizeTeacherName($teacher->nama);
            
            if ($teacher->nama !== $normalized) {
                echo "ID {$teacher->id}: '{$teacher->nama}' → '{$normalized}'\n";
                $teacher->update(['nama' => $normalized]);
                $updated++;
            }
        }
    });

echo "\nTotal updated: {$updated}\n";
```

### Dry Run (Preview Only)

```php
use App\Models\Teacher;
use App\Services\NormalizationService;

$service = app(NormalizationService::class);

$changes = [];

Teacher::chunk(100, function($teachers) use ($service, &$changes) {
    foreach ($teachers as $teacher) {
        $normalized = $service->normalizeTeacherName($teacher->nama);
        
        if ($teacher->nama !== $normalized) {
            $changes[] = [
                'id' => $teacher->id,
                'before' => $teacher->nama,
                'after' => $normalized,
            ];
        }
    }
});

// Show preview
foreach ($changes as $change) {
    echo "ID {$change['id']}: '{$change['before']}' → '{$change['after']}'\n";
}

echo "\nTotal changes: " . count($changes) . "\n";
echo "Run the update command to apply changes.\n";
```

## Testing & Validation

### Test Specific Names

```php
$service = app(App\Services\NormalizationService::class);

$testCases = [
    'dr. ahmad fauzi s.pd',
    'AHMADSPDI',
    'siti fatimah m.ag',
    'dra. mumbasitoh',
    'prof. dr. ahmad s.pd m.pd',
    'fatimah, dra.',
];

foreach ($testCases as $name) {
    $normalized = $service->normalizeTeacherName($name);
    echo "'{$name}' → '{$normalized}'\n";
}
```

### Find Teachers with Attached Degrees

```php
use App\Models\Teacher;

// Find names that might have attached degrees (no spaces, all caps, length > 10)
$candidates = Teacher::whereRaw("nama = UPPER(nama)")
    ->whereRaw("nama NOT LIKE '% %'")
    ->whereRaw("LENGTH(nama) > 10")
    ->get();

echo "Found {$candidates->count()} candidates\n";

foreach ($candidates as $teacher) {
    echo "ID {$teacher->id}: {$teacher->nama}\n";
}
```

### Find Teachers with Lowercase Degrees

```php
use App\Models\Teacher;

// Find names with lowercase degrees (e.g., "ahmad s.pd" instead of "AHMAD, S.Pd.")
$candidates = Teacher::where('nama', 'LIKE', '% s.%')
    ->orWhere('nama', 'LIKE', '% m.%')
    ->orWhere('nama', 'LIKE', '% dr.%')
    ->get();

echo "Found {$candidates->count()} candidates\n";

foreach ($candidates as $teacher) {
    echo "ID {$teacher->id}: {$teacher->nama}\n";
}
```

## Utility Functions

### Create Helper Function

```php
// Add to tinker session for quick access
function normalize($name) {
    return app(App\Services\NormalizationService::class)->normalizeTeacherName($name);
}

function parse($name) {
    return app(App\Services\NormalizationService::class)->parseAcademicDegreesPublic($name);
}

// Usage
normalize('dr. ahmad s.pd');
// Output: "Dr. AHMAD, S.Pd."

parse('ahmad s.pd m.ag');
// Output: ["name" => "AHMAD", "prefix_degrees" => [], "suffix_degrees" => ["S.Pd.", "M.Ag."]]
```

### Batch Normalize with Collection

```php
$names = [
    'dr. ahmad s.pd',
    'siti m.ag',
    'AHMADSPDI',
    'fatimah, dra.',
];

$service = app(App\Services\NormalizationService::class);

$results = collect($names)->map(function($name) use ($service) {
    return [
        'input' => $name,
        'output' => $service->normalizeTeacherName($name),
    ];
});

$results->each(function($result) {
    echo "'{$result['input']}' → '{$result['output']}'\n";
});
```

## Tips

1. **Selalu test dulu** dengan beberapa sample sebelum update massal
2. **Gunakan dry run** untuk preview perubahan
3. **Backup database** sebelum update massal
4. **Update per school** untuk kontrol yang lebih baik
5. **Gunakan chunk()** untuk menghindari memory issues pada dataset besar

## Troubleshooting

### Gelar tidak dikenali

Jika ada gelar yang tidak dikenali, cek di `app/Services/NormalizationService.php` pada konstanta `DEGREE_MAP`. Tambahkan gelar baru jika perlu.

### Nama tidak berubah

Kemungkinan:
- Nama sudah dalam format yang benar
- Gelar terlalu pendek (< 4 karakter) dan menempel pada nama
- Format tidak dikenali

Gunakan `parseAcademicDegreesPublic()` untuk debug:

```php
$service = app(App\Services\NormalizationService::class);
$parsed = $service->parseAcademicDegreesPublic('NAMA_YANG_BERMASALAH');
print_r($parsed);
```
