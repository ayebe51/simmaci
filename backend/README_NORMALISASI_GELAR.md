# Normalisasi Gelar Akademik - Command & Tinker Guide

Command Artisan untuk normalisasi gelar akademik pada nama guru, dapat digunakan via CLI atau tinker.

## 🎯 Quick Start

### Cara Tercepat (CLI)
```bash
php artisan tinker:normalize-gelar "dr. ahmad fauzi s.pd"
```

Output:
```
Input: dr. ahmad fauzi s.pd

Hasil normalisasi:
Dr. AHMAD FAUZI, S.Pd.

Breakdown:
  Gelar depan: Dr.
  Nama: AHMAD FAUZI
  Gelar belakang: S.Pd.
```

### Cara Tercepat (Tinker)
```bash
php artisan tinker
```
```php
app(App\Services\NormalizationService::class)->normalizeTeacherName('dr. ahmad s.pd')
// Output: "Dr. AHMAD FAUZI, S.Pd."
```

## 📖 Dokumentasi

| File | Deskripsi |
|------|-----------|
| **[QUICK_REFERENCE_NORMALISASI.md](QUICK_REFERENCE_NORMALISASI.md)** | 📋 Cheat sheet & quick commands |
| **[NORMALISASI_GELAR.md](NORMALISASI_GELAR.md)** | 📚 Dokumentasi lengkap semua fitur |
| **[TINKER_EXAMPLES.md](TINKER_EXAMPLES.md)** | 💻 Contoh penggunaan via tinker |

## 🚀 Fitur Utama

### 1. CLI Command
- ✅ Single name normalization
- ✅ Interactive mode
- ✅ Batch mode (multiple names)
- ✅ Colored output with breakdown

### 2. Database Normalization
- ✅ Normalize Teacher model
- ✅ Normalize SkDocument model
- ✅ Normalize HeadmasterTenure model
- ✅ Dry run mode (preview only)
- ✅ Filter by school
- ✅ Limit records
- ✅ Show unchanged records

### 3. Tinker Integration
- ✅ Direct service access
- ✅ Parse degrees (breakdown)
- ✅ Batch processing with collections
- ✅ Database updates

## 📋 Command Options

### tinker:normalize-gelar
```bash
# Single name
php artisan tinker:normalize-gelar "nama"

# Interactive mode
php artisan tinker:normalize-gelar

# Batch mode
php artisan tinker:normalize-gelar --batch
```

### data:normalize-gelar
```bash
# Dry run (preview only)
php artisan data:normalize-gelar --dry-run

# Normalize all models
php artisan data:normalize-gelar

# Normalize specific model
php artisan data:normalize-gelar --model=teacher
php artisan data:normalize-gelar --model=sk-document
php artisan data:normalize-gelar --model=headmaster

# Filter by school
php artisan data:normalize-gelar --school=1

# Limit records
php artisan data:normalize-gelar --limit=100

# Show unchanged records
php artisan data:normalize-gelar --show-unchanged
```

## 🎓 Format Gelar yang Didukung

### Gelar Depan (Prefix)
- `Prof.` - Profesor
- `Dr.` - Doktor
- `Dra.` - Doktoranda

### Gelar Sarjana (S1)
`S.Pd.`, `S.Pd.I`, `S.Pd.SD.`, `S.Ag.`, `S.H.`, `S.E.`, `S.Si.`, `S.Kom.`, dll.

### Gelar Diploma
`A.Ma.`, `A.Ma.Pd.`, `A.Ma.Pd.SD.`, `A.Md.`, `D.III`, `D.II`, `D.IV`, `D.I`

### Gelar Magister (S2)
`M.Pd.`, `M.Pd.I`, `M.Ag.`, `M.H.`, `M.E.`, `M.Si.`, `M.Kom.`, `M.M.`, dll.

### Gelar Doktor (S3)
`Ph.D.`

### Gelar Profesi
`Ns.`, `Lc.`, `Sp.OG.`, `Sp.A.`, dll.

**Total: 100+ format gelar** - Lihat `app/Services/NormalizationService.php` untuk daftar lengkap.

## 💡 Contoh Penggunaan

### CLI Examples
```bash
# Test single name
php artisan tinker:normalize-gelar "dr. ahmad fauzi s.pd"

# Interactive mode
php artisan tinker:normalize-gelar
# Ketik nama satu per satu, "exit" untuk keluar

# Batch mode
php artisan tinker:normalize-gelar --batch
# Masukkan multiple nama, "DONE" untuk proses
```

### Tinker Examples
```php
// Setup
$service = app(App\Services\NormalizationService::class);

// Normalize single
$service->normalizeTeacherName('dr. ahmad s.pd');
// → "Dr. AHMAD, S.Pd."

// Parse degrees
$service->parseAcademicDegreesPublic('ahmad s.pd m.ag');
// → ["name" => "AHMAD", "prefix_degrees" => [], "suffix_degrees" => ["S.Pd.", "M.Ag."]]

// Update teacher
$teacher = Teacher::find(1);
$teacher->nama = $service->normalizeTeacherName($teacher->nama);
$teacher->save();

// Batch update
Teacher::chunk(100, function($teachers) use ($service) {
    foreach ($teachers as $t) {
        $n = $service->normalizeTeacherName($t->nama);
        if ($t->nama !== $n) {
            $t->update(['nama' => $n]);
        }
    }
});
```

### Database Normalization Examples
```bash
# Preview changes (safe)
php artisan data:normalize-gelar --dry-run

# Normalize all teachers
php artisan data:normalize-gelar --model=teacher

# Normalize specific school
php artisan data:normalize-gelar --school=1

# Normalize with limit
php artisan data:normalize-gelar --limit=100 --dry-run
```

## 📊 Contoh Transformasi

| Input | Output | Keterangan |
|-------|--------|------------|
| `dr. ahmad fauzi s.pd` | `Dr. AHMAD FAUZI, S.Pd.` | Gelar depan + belakang |
| `AHMADSPDI` | `AHMAD, S.Pd.I` | Gelar menempel |
| `siti fatimah m.ag` | `SITI FATIMAH, M.Ag.` | Lowercase → uppercase |
| `dra. mumbasitoh` | `Dra. MUMBASITOH` | Gelar depan saja |
| `fatimah, dra.` | `Dra. FATIMAH` | Gelar terbalik |
| `prof. dr. ahmad s.pd m.pd` | `Prof. Dr. AHMAD, S.Pd., M.Pd.` | Multiple gelar |
| `HASANAMAPDSD` | `HASAN, A.Ma.Pd.SD.` | Gelar diploma menempel |

## ⚠️ Best Practices

1. **Selalu test dulu** dengan sample data
2. **Gunakan `--dry-run`** untuk preview sebelum update database
3. **Backup database** sebelum normalisasi massal
4. **Update per school** untuk kontrol lebih baik
5. **Gunakan `--limit`** untuk memproses data secara bertahap
6. **Verifikasi hasil** setelah normalisasi

## 🔧 Troubleshooting

### Gelar tidak dikenali
Tambahkan ke `DEGREE_MAP` di `app/Services/NormalizationService.php`

### Nama tidak berubah
```php
// Debug via tinker
$service = app(App\Services\NormalizationService::class);
$parsed = $service->parseAcademicDegreesPublic('NAMA_BERMASALAH');
print_r($parsed);
```

### Gelar menempel tidak terdeteksi
Gelar dengan < 4 karakter tidak akan di-split untuk menghindari false positive. Contoh: `MAFTUHSAG` tidak akan di-split karena `SAG` hanya 3 karakter.

## 📚 Related Commands

| Command | Deskripsi |
|---------|-----------|
| `data:normalize-degrees` | Normalisasi field nama dan pendidikan_terakhir |
| `data:normalize-teacher-names` | Re-normalize teacher names (legacy) |
| `normalize:data` | Normalize school and teacher names |
| `schools:normalize-names` | Normalize school names only |

## 🆘 Help

```bash
php artisan tinker:normalize-gelar --help
php artisan data:normalize-gelar --help
```

## 📝 Notes

- Command ini menggunakan `NormalizationService` yang sama dengan import Excel
- Semua normalisasi mengikuti aturan yang sama di seluruh aplikasi
- Gelar yang tidak dikenali akan tetap dipertahankan dalam format aslinya
- Nama tanpa gelar akan di-uppercase saja

## 🔗 Links

- Service: `app/Services/NormalizationService.php`
- Command: `app/Console/Commands/NormalizeGelarTinker.php`
- Tests: `tests/Unit/Services/NormalizationServiceTest.php`

---

**Created by**: Kiro AI Assistant  
**Version**: 1.0  
**Last Updated**: 2026-05-04
