# 🚀 PRODUCTION READY - Command Siap Pakai

Command `school:find-undefined-jamiyyah` belum ada di production karena file baru dibuat di lokal.

**Solusi:** Gunakan metode alternatif yang tidak perlu deploy!

---

## ✅ **METODE 1: Via Tinker Interactive** (RECOMMENDED)

### Step-by-step:

```bash
# 1. Masuk ke Tinker
docker exec -it backend-yam0yy9a6l424v8j89hv7pqr-025135358293 php artisan tinker
```

Setelah masuk ke Tinker, **copy-paste command ini** (satu per satu):

```php
// Lihat semua nilai unik status_jamiyyah
echo "=== Nilai Unik Status Jamiyyah ===\n";
DB::table('schools')->whereNull('deleted_at')->select('status_jamiyyah')->distinct()->get()->each(function($s) {
    $status = $s->status_jamiyyah ?: '(NULL/kosong)';
    $count = DB::table('schools')->whereNull('deleted_at')->where('status_jamiyyah', $s->status_jamiyyah)->count();
    echo "{$status}: {$count} sekolah\n";
});
```

Kemudian:

```php
// Cari sekolah dengan status "undefined"
echo "\n=== Sekolah dengan Status Tidak Terdefinisi ===\n";
$schools = DB::table('schools')->whereNull('deleted_at')->whereRaw("
    CASE
        WHEN LOWER(status_jamiyyah) LIKE '%jama%ah%'
          OR LOWER(status_jamiyyah) LIKE '%afiliasi%' THEN 'jamaah'
        WHEN LOWER(status_jamiyyah) LIKE '%jam%iyyah%' THEN 'jamiyyah'
        ELSE 'undefined'
    END = 'undefined'
")->select('id', 'nama', 'npsn', 'status_jamiyyah', 'jenjang', 'kecamatan')->get();

echo "Ditemukan: " . $schools->count() . " sekolah\n\n";

$schools->each(function($s) {
    echo "─────────────────────────────────────────\n";
    echo "ID           : {$s->id}\n";
    echo "Nama         : {$s->nama}\n";
    echo "NPSN         : {$s->npsn}\n";
    echo "Jenjang      : {$s->jenjang}\n";
    echo "Kecamatan    : {$s->kecamatan}\n";
    echo "Status Jamiyyah: " . ($s->status_jamiyyah ?: '(NULL/kosong)') . "\n\n";
});
```

Keluar dari Tinker:
```php
exit
```

---

## ✅ **METODE 2: Via PostgreSQL Langsung** (PALING MUDAH)

```bash
# Masuk ke PostgreSQL
docker exec -it backend-yam0yy9a6l424v8j89hv7pqr-025135358293 psql -U sim_user -d sim_maarif
```

Kemudian jalankan query ini:

```sql
-- Lihat semua nilai unik
SELECT 
    COALESCE(status_jamiyyah, '(NULL/kosong)') as status,
    COUNT(*) as jumlah
FROM schools
WHERE deleted_at IS NULL
GROUP BY status_jamiyyah
ORDER BY status_jamiyyah;
```

Dan query ini untuk mencari 4 sekolah:

```sql
-- Cari sekolah dengan status "undefined"
SELECT 
    id,
    nama,
    npsn,
    COALESCE(status_jamiyyah, '(NULL/kosong)') as status_jamiyyah,
    jenjang,
    kecamatan
FROM schools
WHERE deleted_at IS NULL
  AND CASE
        WHEN LOWER(status_jamiyyah) LIKE '%jama%ah%'
          OR LOWER(status_jamiyyah) LIKE '%afiliasi%' THEN 'jamaah'
        WHEN LOWER(status_jamiyyah) LIKE '%jam%iyyah%' THEN 'jamiyyah'
        ELSE 'undefined'
      END = 'undefined'
ORDER BY nama;
```

Keluar dari psql:
```
\q
```

---

## ✅ **METODE 3: One-Liner (Copy-Paste Langsung)**

### Lihat nilai unik:
```bash
docker exec backend-yam0yy9a6l424v8j89hv7pqr-025135358293 php artisan tinker --execute="DB::table('schools')->whereNull('deleted_at')->select('status_jamiyyah')->distinct()->get()->each(function(\$s) { \$status = \$s->status_jamiyyah ?: '(NULL)'; \$count = DB::table('schools')->whereNull('deleted_at')->where('status_jamiyyah', \$s->status_jamiyyah)->count(); echo \"\$status: \$count sekolah\n\"; });"
```

### Cari 4 sekolah:
```bash
docker exec backend-yam0yy9a6l424v8j89hv7pqr-025135358293 php artisan tinker --execute="\$schools = DB::table('schools')->whereNull('deleted_at')->whereRaw(\"CASE WHEN LOWER(status_jamiyyah) LIKE '%jama%ah%' OR LOWER(status_jamiyyah) LIKE '%afiliasi%' THEN 'jamaah' WHEN LOWER(status_jamiyyah) LIKE '%jam%iyyah%' THEN 'jamiyyah' ELSE 'undefined' END = 'undefined'\")->select('id', 'nama', 'npsn', 'status_jamiyyah', 'jenjang', 'kecamatan')->get(); echo \"Ditemukan: \" . \$schools->count() . \" sekolah\n\n\"; \$schools->each(function(\$s) { echo \"ID: {\$s->id} | Nama: {\$s->nama} | NPSN: {\$s->npsn} | Status: \" . (\$s->status_jamiyyah ?: '(NULL)') . \" | Jenjang: {\$s->jenjang} | Kecamatan: {\$s->kecamatan}\n\"; });"
```

---

## 📊 Output yang Diharapkan

```
=== Nilai Unik Status Jamiyyah ===
(NULL/kosong): 4 sekolah
Jama'ah: 100 sekolah
Jam'iyyah: 96 sekolah

=== Sekolah dengan Status Tidak Terdefinisi ===
Ditemukan: 4 sekolah

─────────────────────────────────────────
ID           : 123
Nama         : MI Contoh 1
NPSN         : 12345678
Jenjang      : MI
Kecamatan    : Cilacap Tengah
Status Jamiyyah: (NULL/kosong)

[... 3 sekolah lainnya ...]
```

---

## 🔧 Setelah Menemukan 4 Sekolah

### Update via Tinker:

```bash
docker exec -it backend-yam0yy9a6l424v8j89hv7pqr-025135358293 php artisan tinker
```

Kemudian:

```php
// Update satu per satu (ganti ID sesuai hasil)
DB::table('schools')->where('id', 123)->update(['status_jamiyyah' => 'Jama\'ah']);
DB::table('schools')->where('id', 124)->update(['status_jamiyyah' => 'Jam\'iyyah']);
DB::table('schools')->where('id', 125)->update(['status_jamiyyah' => 'Jama\'ah']);
DB::table('schools')->where('id', 126)->update(['status_jamiyyah' => 'Jam\'iyyah']);

// Atau batch update (jika semua sama):
DB::table('schools')->whereIn('id', [123, 124, 125, 126])->update(['status_jamiyyah' => 'Jama\'ah']);

exit
```

### Atau update via SQL:

```bash
docker exec -it backend-yam0yy9a6l424v8j89hv7pqr-025135358293 psql -U sim_user -d sim_maarif
```

```sql
-- Update satu per satu
UPDATE schools SET status_jamiyyah = 'Jama''ah' WHERE id = 123;
UPDATE schools SET status_jamiyyah = 'Jam''iyyah' WHERE id = 124;

-- Atau batch
UPDATE schools 
SET status_jamiyyah = 'Jama''ah' 
WHERE id IN (123, 124, 125, 126);

\q
```

---

## 💡 Tips

- **Metode 2 (PostgreSQL)** paling mudah dan output paling rapi
- **Metode 1 (Tinker)** lebih fleksibel untuk manipulasi data
- **Metode 3 (One-liner)** paling cepat tapi output kurang rapi

---

## 🎯 Rekomendasi

**Gunakan Metode 2 (PostgreSQL)** karena:
- ✅ Output paling rapi dan mudah dibaca
- ✅ Tidak perlu escape character
- ✅ Bisa copy-paste langsung
- ✅ Familiar jika sudah biasa SQL

---

**Silakan pilih metode yang paling nyaman untuk Anda!** 🚀
