# Mencari Sekolah dengan Status Jamiyyah "Tidak Terdefinisi"

## Latar Belakang

Dashboard menampilkan 4 sekolah (2%) dengan status jamiyyah "Tidak Terdefinisi". Status ini dihitung berdasarkan logika di `DashboardController.php`:

- **Jama'ah**: `status_jamiyyah` mengandung pattern `jama'ah` atau `afiliasi` (case-insensitive)
- **Jam'iyyah**: `status_jamiyyah` mengandung pattern `jam'iyyah` (case-insensitive)
- **Tidak Terdefinisi**: Semua nilai lainnya (termasuk NULL, kosong, atau nilai yang tidak cocok dengan pattern di atas)

## Cara Mencari Sekolah Tersebut

### Opsi 1: Menggunakan Artisan Command (Recommended)

```bash
# Di server production/staging
cd backend
php artisan school:find-undefined-jamiyyah
```

Command ini akan menampilkan:
1. Semua nilai unik `status_jamiyyah` yang ada di database
2. Daftar lengkap sekolah dengan status "Tidak Terdefinisi"

### Opsi 2: Menggunakan PHP Script

```bash
# Dari root project
php scripts/find-undefined-jamiyyah.php
```

### Opsi 3: Menggunakan SQL Query Langsung

```bash
# Connect ke PostgreSQL
psql -U sim_user -d sim_maarif

# Jalankan query dari file
\i scripts/find-undefined-jamiyyah.sql

# Atau copy-paste query dari file tersebut
```

### Opsi 4: Menggunakan Tinker

```bash
cd backend
php artisan tinker
```

Kemudian jalankan:

```php
// Lihat semua nilai unik
School::select('status_jamiyyah')
    ->distinct()
    ->get()
    ->each(function($s) {
        $status = $s->status_jamiyyah ?: '(NULL)';
        $count = School::where('status_jamiyyah', $s->status_jamiyyah)->count();
        echo "{$status}: {$count}\n";
    });

// Cari sekolah dengan status undefined
$schools = School::whereRaw("
    CASE
        WHEN LOWER(status_jamiyyah) LIKE '%jama%ah%'
          OR LOWER(status_jamiyyah) LIKE '%afiliasi%' THEN 'jamaah'
        WHEN LOWER(status_jamiyyah) LIKE '%jam%iyyah%' THEN 'jamiyyah'
        ELSE 'undefined'
    END = 'undefined'
")->get();

echo "Total: " . $schools->count() . "\n\n";

$schools->each(function($s) {
    echo "ID: {$s->id}\n";
    echo "Nama: {$s->nama}\n";
    echo "NPSN: {$s->npsn}\n";
    echo "Status: " . ($s->status_jamiyyah ?: '(NULL)') . "\n";
    echo "Jenjang: {$s->jenjang}\n";
    echo "Kecamatan: {$s->kecamatan}\n\n";
});
```

## Kemungkinan Penyebab

Sekolah masuk kategori "Tidak Terdefinisi" jika `status_jamiyyah`:

1. **NULL** (belum diisi)
2. **String kosong** (`''`)
3. **Typo atau variasi ejaan** yang tidak cocok dengan pattern, misalnya:
   - `"Jama'ah"` dengan tanda petik berbeda
   - `"Jamiah"` (salah eja)
   - `"Jamiyah"` (salah eja)
   - `"Lainnya"` atau nilai custom lainnya
4. **Spasi atau karakter khusus** yang mengganggu pattern matching

## Solusi

Setelah menemukan 4 sekolah tersebut, Anda bisa:

1. **Update manual** melalui Filament admin panel
2. **Update via SQL**:
   ```sql
   UPDATE schools 
   SET status_jamiyyah = 'Jama''ah'  -- atau 'Jam''iyyah'
   WHERE id IN (id1, id2, id3, id4);
   ```
3. **Update via Tinker**:
   ```php
   School::whereIn('id', [id1, id2, id3, id4])
       ->update(['status_jamiyyah' => 'Jama''ah']);
   ```

## Catatan

- Database lokal (Docker) kosong, jadi command harus dijalankan di environment production/staging
- Gunakan `docker exec simmaci-backend php artisan school:find-undefined-jamiyyah` jika menggunakan Docker
- Pastikan sudah login ke server production sebelum menjalankan command
