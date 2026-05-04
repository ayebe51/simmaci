# Quick Reference: Normalisasi Gelar

## 🚀 Cara Tercepat

### Via CLI (Single Name)
```bash
php artisan tinker:normalize-gelar "dr. ahmad fauzi s.pd"
```

### Via Tinker (One-liner)
```bash
php artisan tinker
```
```php
app(App\Services\NormalizationService::class)->normalizeTeacherName('dr. ahmad s.pd')
```

---

## 📋 Command Cheat Sheet

| Command | Deskripsi |
|---------|-----------|
| `php artisan tinker:normalize-gelar "nama"` | Normalisasi single name |
| `php artisan tinker:normalize-gelar` | Mode interaktif |
| `php artisan tinker:normalize-gelar --batch` | Mode batch (multiple names) |
| `php artisan data:normalize-gelar --dry-run` | Preview normalisasi database |
| `php artisan data:normalize-gelar` | Normalisasi semua model |
| `php artisan data:normalize-gelar --model=teacher` | Normalisasi Teacher saja |
| `php artisan data:normalize-gelar --school=1` | Filter by school |

---

## 💻 Tinker Quick Commands

### Setup (Copy-paste ini dulu)
```php
$service = app(App\Services\NormalizationService::class);
```

### Normalisasi Single
```php
$service->normalizeTeacherName('dr. ahmad s.pd');
```

### Parse Degrees
```php
$service->parseAcademicDegreesPublic('ahmad s.pd m.ag');
```

### Update Single Teacher
```php
$teacher = Teacher::find(1);
$teacher->nama = $service->normalizeTeacherName($teacher->nama);
$teacher->save();
```

### Update All Teachers (with progress)
```php
$updated = 0;
Teacher::chunk(100, function($teachers) use ($service, &$updated) {
    foreach ($teachers as $t) {
        $n = $service->normalizeTeacherName($t->nama);
        if ($t->nama !== $n) {
            echo "ID {$t->id}: '{$t->nama}' → '{$n}'\n";
            $t->update(['nama' => $n]);
            $updated++;
        }
    }
});
echo "Updated: {$updated}\n";
```

---

## 📊 Contoh Input → Output

| Input | Output |
|-------|--------|
| `dr. ahmad fauzi s.pd` | `Dr. AHMAD FAUZI, S.Pd.` |
| `AHMADSPDI` | `AHMAD, S.Pd.I` |
| `siti fatimah m.ag` | `SITI FATIMAH, M.Ag.` |
| `dra. mumbasitoh` | `Dra. MUMBASITOH` |
| `fatimah, dra.` | `Dra. FATIMAH` |
| `prof. dr. ahmad s.pd m.pd` | `Prof. Dr. AHMAD, S.Pd., M.Pd.` |
| `HASANAMAPDSD` | `HASAN, A.Ma.Pd.SD.` |

---

## 🎯 Common Use Cases

### 1. Test Single Name
```bash
php artisan tinker:normalize-gelar "nama yang mau ditest"
```

### 2. Preview Database Changes
```bash
php artisan data:normalize-gelar --dry-run --show-unchanged
```

### 3. Update Specific School
```bash
php artisan data:normalize-gelar --school=1
```

### 4. Update via Tinker (Safe)
```php
// 1. Setup
$service = app(App\Services\NormalizationService::class);

// 2. Preview first
$teacher = Teacher::find(1);
echo "Before: {$teacher->nama}\n";
echo "After:  " . $service->normalizeTeacherName($teacher->nama) . "\n";

// 3. Update if looks good
$teacher->nama = $service->normalizeTeacherName($teacher->nama);
$teacher->save();
```

---

## ⚠️ Safety Checklist

- [ ] Test dengan sample data dulu
- [ ] Gunakan `--dry-run` untuk preview
- [ ] Backup database sebelum update massal
- [ ] Update per school untuk kontrol lebih baik
- [ ] Verifikasi hasil setelah update

---

## 🔍 Debugging

### Cek kenapa nama tidak berubah
```php
$service = app(App\Services\NormalizationService::class);
$parsed = $service->parseAcademicDegreesPublic('NAMA_BERMASALAH');
print_r($parsed);
```

### Find candidates untuk normalisasi
```php
// Nama dengan gelar menempel (no spaces)
Teacher::whereRaw("nama = UPPER(nama)")
    ->whereRaw("nama NOT LIKE '% %'")
    ->whereRaw("LENGTH(nama) > 10")
    ->get();

// Nama dengan gelar lowercase
Teacher::where('nama', 'LIKE', '% s.%')
    ->orWhere('nama', 'LIKE', '% m.%')
    ->get();
```

---

## 📚 Dokumentasi Lengkap

- **Full Guide**: `backend/NORMALISASI_GELAR.md`
- **Tinker Examples**: `backend/TINKER_EXAMPLES.md`
- **Service Code**: `backend/app/Services/NormalizationService.php`
- **Command Code**: `backend/app/Console/Commands/NormalizeGelarTinker.php`

---

## 🆘 Help

```bash
php artisan tinker:normalize-gelar --help
php artisan data:normalize-gelar --help
```
