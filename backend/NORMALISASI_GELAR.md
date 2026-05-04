# Normalisasi Gelar Akademik

Command untuk normalisasi gelar akademik pada nama guru, dapat digunakan via CLI atau tinker.

## Penggunaan via CLI

### 1. Mode Single (Normalisasi satu nama)

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

### 2. Mode Interaktif

```bash
php artisan tinker:normalize-gelar
```

Akan masuk ke mode interaktif di mana Anda bisa memasukkan nama satu per satu:

```
=== Mode Interaktif Normalisasi Gelar ===
Ketik nama guru untuk dinormalisasi, atau "exit" untuk keluar.

Nama guru: dr. ahmad fauzi s.pd

Hasil normalisasi:
Dr. AHMAD FAUZI, S.Pd.

Breakdown:
  Gelar depan: Dr.
  Nama: AHMAD FAUZI
  Gelar belakang: S.Pd.

────────────────────────────────────────────────────────────

Nama guru: exit
Selesai.
```

### 3. Mode Batch (Multiple nama sekaligus)

```bash
php artisan tinker:normalize-gelar --batch
```

Masukkan multiple nama, lalu ketik "DONE":

```
=== Mode Batch Normalisasi Gelar ===
Masukkan nama-nama guru (satu per baris).
Ketik "DONE" pada baris baru untuk memproses.

Baris 1: dr. ahmad fauzi s.pd
Baris 2: siti fatimah m.ag
Baris 3: dra. mumbasitoh
Baris 4: DONE

Memproses 3 nama...

┌─────────────────────────┬─────────────────────────┬──────────────┐
│ Input                   │ Output                  │ Status       │
├─────────────────────────┼─────────────────────────┼──────────────┤
│ dr. ahmad fauzi s.pd    │ Dr. AHMAD FAUZI, S.Pd.  │ ✓ Berubah    │
│ siti fatimah m.ag       │ SITI FATIMAH, M.Ag.     │ ✓ Berubah    │
│ dra. mumbasitoh         │ Dra. MUMBASITOH         │ ✓ Berubah    │
└─────────────────────────┴─────────────────────────┴──────────────┘

Total: 3 berubah, 0 tidak berubah
```

## Penggunaan via Tinker

### 1. Normalisasi langsung

```php
php artisan tinker

>>> app(App\Services\NormalizationService::class)->normalizeTeacherName('dr. ahmad fauzi s.pd')
=> "Dr. AHMAD FAUZI, S.Pd."

>>> $service = app(App\Services\NormalizationService::class)
>>> $service->normalizeTeacherName('siti fatimah m.ag')
=> "SITI FATIMAH, M.Ag."
```

### 2. Parse degrees (breakdown)

```php
>>> $service = app(App\Services\NormalizationService::class)
>>> $service->parseAcademicDegreesPublic('dr. ahmad fauzi s.pd m.ag')
=> [
     "name" => "AHMAD FAUZI",
     "prefix_degrees" => [
       "Dr.",
     ],
     "suffix_degrees" => [
       "S.Pd.",
       "M.Ag.",
     ],
   ]
```

### 3. Normalisasi batch via tinker

```php
>>> $service = app(App\Services\NormalizationService::class)
>>> $names = ['dr. ahmad s.pd', 'siti m.ag', 'dra. fatimah']
>>> collect($names)->map(fn($n) => $service->normalizeTeacherName($n))
=> Illuminate\Support\Collection {
     all: [
       "Dr. AHMAD, S.Pd.",
       "SITI, M.Ag.",
       "Dra. FATIMAH",
     ],
   }
```

### 4. Update database via tinker

```php
>>> use App\Models\Teacher;
>>> use App\Services\NormalizationService;

>>> $service = app(NormalizationService::class)

// Update single teacher
>>> $teacher = Teacher::find(1)
>>> $teacher->nama = $service->normalizeTeacherName($teacher->nama)
>>> $teacher->save()

// Update multiple teachers
>>> Teacher::chunk(100, function($teachers) use ($service) {
...     foreach ($teachers as $teacher) {
...         $normalized = $service->normalizeTeacherName($teacher->nama);
...         if ($teacher->nama !== $normalized) {
...             $teacher->update(['nama' => $normalized]);
...         }
...     }
... });
```

## Format Gelar yang Didukung

### Gelar Depan (Prefix)
- `Prof.` - Profesor
- `Dr.` - Doktor
- `Dra.` - Doktoranda

### Gelar Sarjana (S1)
- `S.Pd.` - Sarjana Pendidikan
- `S.Pd.I` - Sarjana Pendidikan Islam
- `S.Pd.SD.` - Sarjana Pendidikan Sekolah Dasar
- `S.Ag.` - Sarjana Agama
- `S.H.` - Sarjana Hukum
- `S.E.` - Sarjana Ekonomi
- `S.Si.` - Sarjana Sains
- `S.Kom.` - Sarjana Komputer
- Dan banyak lagi...

### Gelar Diploma
- `A.Ma.` - Ahli Madya
- `A.Ma.Pd.` - Ahli Madya Pendidikan
- `A.Ma.Pd.SD.` - Ahli Madya Pendidikan Sekolah Dasar
- `A.Md.` - Ahli Madya
- `D.III`, `D.II`, `D.IV`, `D.I`

### Gelar Magister (S2)
- `M.Pd.` - Magister Pendidikan
- `M.Pd.I` - Magister Pendidikan Islam
- `M.Ag.` - Magister Agama
- `M.H.` - Magister Hukum
- `M.E.` - Magister Ekonomi
- `M.Si.` - Magister Sains
- `M.Kom.` - Magister Komputer
- `M.M.` - Magister Manajemen
- Dan banyak lagi...

## Contoh Normalisasi

| Input | Output |
|-------|--------|
| `dr. ahmad fauzi s.pd` | `Dr. AHMAD FAUZI, S.Pd.` |
| `siti fatimah m.ag` | `SITI FATIMAH, M.Ag.` |
| `dra. mumbasitoh` | `Dra. MUMBASITOH` |
| `ahmad s.pd.i m.ag` | `AHMAD, S.Pd.I, M.Ag.` |
| `MAFTUHSAG` | `MAFTUH, S.Ag.` |
| `AHMADSPDI` | `AHMAD, S.Pd.I` |
| `prof. dr. ahmad s.pd m.pd` | `Prof. Dr. AHMAD, S.Pd., M.Pd.` |
| `fatimah, dra.` | `Dra. FATIMAH` |

## Command Lain untuk Normalisasi

### 1. Normalisasi gelar di database (semua model)

```bash
# Dry run (preview saja)
php artisan data:normalize-gelar --dry-run

# Normalisasi Teacher, SkDocument, dan HeadmasterTenure
php artisan data:normalize-gelar

# Normalisasi hanya Teacher
php artisan data:normalize-gelar --model=teacher

# Filter by school
php artisan data:normalize-gelar --school=1

# Limit jumlah record
php artisan data:normalize-gelar --limit=100
```

### 2. Normalisasi degrees only (field nama dan pendidikan_terakhir)

```bash
# Normalisasi field nama
php artisan data:normalize-degrees --field=nama

# Normalisasi field pendidikan_terakhir
php artisan data:normalize-degrees --field=pendidikan_terakhir

# Normalisasi both fields
php artisan data:normalize-degrees --field=all
```

## Tips

1. **Selalu gunakan `--dry-run` terlebih dahulu** untuk preview perubahan sebelum menyimpan ke database
2. **Backup database** sebelum menjalankan normalisasi massal
3. **Gunakan `--limit`** untuk memproses data secara bertahap
4. **Gunakan `--show-unchanged`** untuk melihat record yang tidak berubah
5. **Filter by school** dengan `--school=ID` untuk normalisasi per sekolah

## Troubleshooting

### Gelar tidak dikenali
Jika ada gelar yang tidak dikenali, tambahkan ke `DEGREE_MAP` di `app/Services/NormalizationService.php`

### Nama tidak berubah
Periksa apakah format input sudah benar. Gunakan mode interaktif untuk testing.

### Error saat update database
Pastikan model menggunakan trait `HasTenantScope` dan user memiliki permission yang sesuai.
