# Laporan Kerja Harian — 26 Juni 2026
**Proyek:** SIMMACI (SIM Maarif NU Cilacap)
**Tanggal:** Jumat, 26 Juni 2026
**Total Commit Hari Ini:** 11 commit (09:09 — 15:59 WIB)

---

## Ringkasan Eksekutif

Hari ini adalah hari kerja produktif dengan fokus pada dua area besar:

1. **Fitur Absensi Staff PCNU** — pengembangan besar-besaran dari nol: geofencing GPS yang bisa dikonfigurasi, foto selfie sebagai bukti kehadiran, absen "Dinas Luar", validasi batas waktu masuk/pulang, dan pencatatan absen manual. Semua parameter dapat dikonfigurasi oleh admin melalui halaman Settings baru.
2. **Perbaikan SK Generator** — fix bug nomor SK auto-increment yang kacau akibat urutan sort yang salah, tambah pencarian by unit kerja, dan perbaikan gelar akademik di NormalizationService.

---

## 👨‍💻 FULLSTACK DEVELOPER

### 1. Fix Blank Camera pada Staff Attendance Scanner
**Commit:** `49d3736` — 09:09 WIB
**File:** `src/features/attendance/PublicScannerPage.tsx`

**Masalah:** Kamera QR scanner untuk absensi staff tampak blank/hitam saat pertama kali dibuka karena elemen `<div id="staff-qr-reader">` dibungkus dalam container dengan class `absolute opacity-0 pointer-events-none` saat tidak scanning — menyebabkan html5-qrcode gagal menginisialisasi kamera.

**Perubahan:**
```tsx
// SEBELUM — scanner tersembunyi di dalam container absolut yang opacity-0
{/* Scanner Container */}
<div className={scanning ? "block" : "absolute opacity-0 pointer-events-none"}>
   <div id="staff-qr-reader" className="w-full" style={{ minHeight: scanning ? 300 : 0 }} />
</div>

// SESUDAH — elemen reader selalu ada di DOM, hanya height yang menjadi 0
<div id="staff-qr-reader" className="w-full shrink-0" style={{ minHeight: scanning ? 300 : 0 }} />
```

**Root cause:** html5-qrcode memerlukan elemen sudah ada di DOM sebelum kamera diinisialisasi. Elemen yang tersembunyi dengan `display:none` atau `pointer-events-none` menyebabkan kamera tidak bisa mendapatkan dimensi untuk render.

---

### 2. Halaman Pengaturan Absensi Staff (File Baru)
**Commit:** `be44671` — 11:25 WIB
**File baru:** `src/features/staff/StaffAttendanceSettingsPage.tsx` (247 baris)

Halaman admin baru untuk mengkonfigurasi seluruh parameter absensi staff PCNU tanpa perlu edit kode. Fitur yang bisa dikonfigurasi:

**Foto Selfie:**
- Toggle wajibkan foto selfie saat scan QR

**Geolocation & Geofencing:**
- Toggle aktifkan/nonaktifkan validasi GPS
- Input koordinat kantor (Latitude/Longitude) dengan tombol "Gunakan Lokasi Saat Ini" yang menggunakan browser Geolocation API
- Input radius geofencing dalam meter

```tsx
// Komponen utama
export default function StaffAttendanceSettingsPage() {
  const [formState, setFormState] = useState({
    staff_geolocation_enabled: false,
    office_latitude: null,
    office_longitude: null,
    office_geofence_radius: 100,
    staff_photo_enabled: false,
  });

  // Ambil lokasi saat ini menggunakan browser API
  const handleUseCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormState({
          ...formState,
          office_latitude: position.coords.latitude,
          office_longitude: position.coords.longitude,
        });
        toast.success("Koordinat berhasil diambil dari lokasi Anda!");
      },
      (error) => { /* error handling */ },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };
}
```

---

### 3. Integrasi Geolocation & Foto ke PublicScannerPage
**Commit:** `be44671` — 11:25 WIB
**File:** `src/features/attendance/PublicScannerPage.tsx`

Scanner staff diupdate untuk membaca setting dari backend dan menerapkannya secara dinamis:

```tsx
// Baca setting dari backend
useEffect(() => {
  if (staffSettings) {
    const faceEnabled = staffSettings.face_recognition_enabled === 'true' 
                        || staffSettings.face_recognition_enabled === true;
    setIsFaceVerificationEnabled(faceEnabled);
    setIsPhotoEnabled(staffSettings.staff_photo_enabled === 'true' || ...);
    setIsGeolocationEnabled(staffSettings.staff_geolocation_enabled === 'true' || ...);
  }
}, [staffSettings]);

// Guard geolocation hanya jika diaktifkan
const startScanner = async () => {
  if (isGeolocationEnabled) {
    if (!location && !locationError) {
      toast.warning('Menunggu lokasi GPS...');
      return;
    }
    if (locationError) {
      toast.error(locationError);
      return;
    }
  }
  // lanjut buka kamera...
};

// Capture foto sebelum submit
const submitAttendance = async (qrCode: string, faceVerified: boolean = false) => {
  let photoData = undefined;
  if (isPhotoEnabled || isFaceVerificationEnabled) {
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    photoData = canvas.toDataURL('image/jpeg', 0.8);
  }
  
  await staffAttendanceApi.scan({
    qr_code: qrCode,
    latitude: location.lat,
    longitude: location.lng,
    photo: photoData  // base64 JPEG
  });
};
```

---

### 4. Pencarian SK Generator by Unit Kerja
**Commit:** `4b9b1a7` — 13:21 WIB
**File:** `backend/app/Http/Controllers/Api/SkDocumentController.php`, `src/features/sk-management/SkGeneratorPage.tsx`

**Backend — perluas WHERE clause:**
```php
// SEBELUM — hanya cari by nama guru
$query->where('nama', 'ilike', "%{$request->search}%");

// SESUDAH — cari by nama guru ATAU unit kerja
$query->where(function ($q) use ($request) {
    $q->where('nama', 'ilike', "%{$request->search}%")
      ->orWhere('unit_kerja', 'ilike', "%{$request->search}%");
});
```

**Frontend — update placeholder input:**
```tsx
// SEBELUM
<Input placeholder="Cari nama..." ... />
// SESUDAH
<Input placeholder="Cari nama atau unit kerja..." ... />
```

---

### 5. Absensi "Dinas Luar" untuk Staff
**Commit:** `8ec131c` — 14:47 WIB
**File:** `backend/app/Http/Controllers/Api/StaffAttendanceController.php`, `src/lib/api.ts`

**Backend — parameter baru `jenis_absen`:**
```php
$request->validate([
    // ...
    'jenis_absen' => 'nullable|string|in:Kantor,Dinas Luar',
]);

$isDinasLuar = $request->jenis_absen === 'Dinas Luar';

// Skip geofence jika Dinas Luar
$locationVerified = ($isGeoEnabled && !$isDinasLuar) ? ($distance <= $radius) : true;

if ($isGeoEnabled && !$isDinasLuar && $distance > $radius) {
    return $this->errorResponse("Anda berada di luar area kantor ...", 400);
}

// Status absen berbeda
'status' => $isDinasLuar ? 'Dinas Luar' : 'Hadir',
```

---

### 6. Pencatatan Absen Manual (Baru)
**Commit:** `b22df9a` — 15:31 WIB
**File:** `backend/app/Http/Controllers/Api/StaffAttendanceController.php`, `backend/routes/api.php`, `src/features/staff/StaffAttendanceReportPage.tsx`

Endpoint baru untuk admin mencatat absensi secara manual (misalnya untuk koreksi atau input izin/sakit):

```php
public function storeManual(Request $request): JsonResponse
{
    $request->validate([
        'staff_id' => 'required|exists:staffs,id',
        'tanggal'  => 'required|date',
        'status'   => 'required|string',
        'jam_masuk'  => 'nullable|date_format:H:i',
        'jam_pulang' => 'nullable|date_format:H:i',
    ]);

    $attendance = StaffAttendance::updateOrCreate(
        ['staff_id' => $request->staff_id, 'tanggal' => $request->tanggal],
        [
            'status'            => $request->status,
            'jam_masuk'         => $request->jam_masuk,
            'jam_pulang'        => $request->jam_pulang,
            'location_verified' => true, // manual entry implicitly verified
        ]
    );

    return $this->successResponse($attendance, 'Kehadiran manual berhasil dicatat.');
}
```

---

### 7. Fix Sort SK & Perbaikan Nomor Urut Auto-Increment
**Commit:** `8ec131c` (14:47) + `c09865b` (15:41) WIB
**File:** `backend/app/Http/Controllers/Api/SkDocumentController.php`, `src/features/sk-management/SkGeneratorPage.tsx`

**Masalah:** Nomor urut SK ter-generate tidak berurutan karena SK diambil dengan urutan `DESC created_at`, sehingga "SK terakhir" yang dibaca untuk auto-increment adalah SK paling baru (bukan SK dengan nomor tertinggi).

**Perubahan — Support sort dinamis:**
```php
// Commit pertama: tambah sort_dir parameter
$sortDir = strtolower($request->sort_dir ?? 'asc');
$paginated = $query->orderBy('created_at', $sortDir)->orderBy('id', $sortDir)
                   ->paginate(...);

// Commit kedua: tambah sort_by parameter + whitelist kolom
$sortBy = in_array($request->sort_by, ['id', 'created_at', 'updated_at', 'nomor_sk'])
    ? $request->sort_by : 'created_at';
$sortDir = strtolower($request->sort_dir ?? 'asc');
$paginated = $query->orderBy($sortBy, $sortDir)->orderBy('id', $sortDir)->paginate(...);
```

---

### 8. Label Teks "PCNU" → "LP Ma'arif NU Cilacap"
**Commit:** `973db2d` — 15:59 WIB
**File:** `src/features/attendance/PublicScannerPage.tsx`

Update branding pada halaman scanner staff dari "PCNU" menjadi nama resmi "LP Ma'arif NU Cilacap".


---

## 🗄️ DATABASE ADMINISTRATOR (DBA)

### 1. Migrasi Baru: Kolom `nomor_id` pada Tabel `staffs`
**Commit:** `be44671` — 11:25 WIB
**File baru:** `backend/database/migrations/2026_06_26_023500_add_nomor_id_to_staffs_table.php`

**Kebutuhan:** Staff PCNU perlu memiliki nomor ID/NIK yang bisa dicantumkan di dokumen dan laporan absensi.

```php
public function up(): void
{
    Schema::table('staffs', function (Blueprint $table) {
        $table->string('nomor_id')->nullable()->after('nama');
    });
}

public function down(): void
{
    Schema::table('staffs', function (Blueprint $table) {
        $table->dropColumn('nomor_id');
    });
}
```

**Command migrasi:**
```bash
php artisan migrate
# atau di dalam container:
docker exec -it simmaci-backend php artisan migrate
```

**Catatan:** Kolom nullable, tidak merusak data existing. Dapat diisi melalui halaman manajemen staff.

---

## 🔧 DEVOPS

### OPcache & PHP-FPM Optimization (dari commit 25 Juni malam)
**Commit:** `fd899ff` — 15:22 WIB (25 Juni, masuk window laporan)
**File:** `backend/Dockerfile`, `backend/docker/php/opcache.ini` (file baru)

Meski commit ini tanggal 25 Juni 15:22, ini adalah bagian dari persiapan deployment hari Jumat. OPcache diaktifkan untuk mengoptimalkan performa PHP di produksi.

**`backend/docker/php/opcache.ini`:**
```ini
opcache.enable=1
opcache.enable_cli=0
opcache.memory_consumption=128
opcache.interned_strings_buffer=8
opcache.max_accelerated_files=4000
opcache.revalidate_freq=60
opcache.fast_shutdown=1
```

**Dockerfile — COPY file konfigurasi:**
```dockerfile
COPY docker/php/opcache.ini /usr/local/etc/php/conf.d/opcache.ini
```

---

## 🧬 NORMALIZATION / DATA QUALITY

### Ekspansi Besar-besaran Degree Map di NormalizationService
**Commit:** `080c1db` + `2cc3c1e` + `3127cf8` + `2ece689` — 13:22–13:42 WIB
**File:** `backend/app/Services/NormalizationService.php`

Hari ini dilakukan 4 iterasi perbaikan pada peta normalisasi gelar akademik:

**Iterasi 1 (13:22):** Tambah `S.E.Sy.` ke mapping
**Iterasi 2 (13:26):** Tambah gelar + perbaikan mapping `detectGelarChange.ts`
**Iterasi 3 (13:28):** Ekspansi komprehensif — tambah 50+ gelar baru

Gelar-gelar yang ditambahkan mencakup:
- **S1 baru:** `S.Pd.AUD.I`, `S.Pd.K.I`, `S.Pd.B.I`, `S.H.Sy.`, `S.H.I`, `S.I.P.`, `S.Tr.K.`, `S.Tr.G.`, `S.P.W.K.`, `S.Ked.G.`, `S.Ked.H.`, `S.Kep.I`, `S.Farm.`, `S.Ant.`, `S.Bns.`, `S.In.`, `S.K.S.`, `S.Par.`, `S.P.`
- **S2 baru:** `M.Pd.K.I.`, `M.Pd.B.I.`, `M.Pd.Si.`, `M.H.Sy.`, `M.H.I.`, `M.H.Kes.`, `M.E.I.`, `M.M.R.S.`, `M.M.Kes.`, `M.Ed.M.`, `M.Des.`, `M.Epid.`, `M.Farm.`, `M.I.Kom.`, `M.K.K.K.`, `M.Kep.`, `M.P.`
- **Profesi/Spesialis baru:** `Akt.`, `Apt.`, `Bdn.`, `drg.`, `drh.`, `Ir.`, `Sp.An.`, `Sp.G.`, `Sp.M.`, `Sp.P.`, `Sp.THT.`
- **Pre-processing baru:** regex untuk memisahkan gelar yang menempel ke nama tanpa spasi (e.g. `"BudiS.E."` → `"Budi S.E."`)

```php
// Pre-processing baru — ensure space before degrees
$fullName = preg_replace(
    '/([a-zA-Z]{3,})(S\.|M\.|A\.Md\.|A\.Ma\.|Dr\.|Dra\.|Prof\.)/i', 
    '$1 $2', 
    $fullName
);
```

**Iterasi 4 (13:42) — Revert sebagian:** Setelah commit iterasi 3, beberapa unit test gagal karena:
1. Trailing dots yang ditambahkan di gelar Islam (`.I.`) ternyata tidak konsisten dengan format yang diharapkan test (`S.Pd.I` bukan `S.Pd.I.`)
2. Penambahan `'DR' => 'dr.'` menyebabkan nama-nama yang mengandung "DR" (seperti "Andriyanto") salah dinormalisasi

**Fix yang di-revert:**
```php
// Hapus mapping DR yang terlalu agresif
// 'DR' => 'dr.',  ← DIHAPUS karena menabrak nama orang

// Revert trailing dot pada gelar Islam
'SPDI' => 'S.Pd.I',   // bukan 'S.Pd.I.'
'STHI' => 'S.Th.I',   // bukan 'S.Th.I.'
'MPDI' => 'M.Pd.I',   // bukan 'M.Pd.I.'
// dst...
```

---

## 🧪 QA / QUALITY ASSURANCE

### Test yang Diperbaiki (dari 25 Juni sore — bagian dari rangkaian pekerjaan hari ini)

**Commit terkait:** `1a22b20` + `fac3e97` (25 Juni 15:07–15:20)

Dua file test diperbaiki sebagai bagian dari QA sebelum deployment Jumat:

**`NormalizeDataCommandTest.php`:** Test gagal karena guru tanpa gelar akademik sekarang diklasifikasikan sebagai Tendik (bukan GTY/GTT). Test payload diupdate dengan menambahkan gelar ke nama guru.

**`SkListPayloadPropertyTest.php`:** Test diupdate untuk mencerminkan field baru yang di-expose di API response: `teacher_id` dan `is_guru_baru`.

**Cara menjalankan test terkait:**
```bash
php artisan test --filter NormalizeDataCommandTest
php artisan test --filter SkListPayloadPropertyTest
```

### Verifikasi Manual — Degree Normalization
Setelah setiap iterasi penambahan gelar, dilakukan verifikasi cepat menggunakan script test sementara:
```bash
# File test_norm.php dibuat sementara, dijalankan, lalu dihapus
php backend/test_norm.php
```

Contoh isi `test_norm.php`:
```php
require 'vendor/autoload.php';
$service = new NormalizationService();
$cases = ['AHMAD SPDI', 'Budi S.E.Sy', 'SITI SPDAUDI', 'Hasan MESY'];
foreach ($cases as $name) {
    $result = $service->normalizeName($name);
    echo "$name → $result\n";
}
```

File `test_norm.php` dan `test_regex.php` kemudian dihapus di commit `7459914` — 11:25 WIB.

---

## 📋 PROJECT MANAGER (PM)

### Timeline Aktivitas Hari Ini

| Waktu | Commit | Aktivitas | Status |
|-------|--------|-----------|--------|
| 09:09 | `49d3736` | Fix blank camera pada staff QR scanner | ✅ Done |
| 11:25 | `be44671` | Mega-commit: GPS logic, auto ID staff, degree normalization, halaman settings absensi baru, integrasi scanner | ✅ Done |
| 11:25 | `7459914` | Hapus file test sementara yang tidak sengaja di-commit | ✅ Done |
| 13:21 | `4b9b1a7` | Tambah pencarian SK by unit kerja | ✅ Done |
| 13:22–13:28 | `080c1db` + `2cc3c1e` + `3127cf8` | Iterasi ekspansi gelar akademik | ✅ Done |
| 13:42 | `2ece689` | Revert trailing dot & DR yang menyebabkan test gagal | ✅ Done |
| 14:47 | `8ec131c` | Absen Dinas Luar + fix sort SK | ✅ Done |
| 15:31 | `b22df9a` | Absen manual + fix bug list attendance | ✅ Done |
| 15:41 | `c09865b` | Fix sort SK updated_at + sort_by parameter | ✅ Done |
| 15:48 | `5d331506` | Validasi batas waktu masuk/pulang + fix settings loading bug | ✅ Done |
| 15:59 | `973db2d` | Ganti label PCNU → LP Ma'arif NU Cilacap | ✅ Done |

### Isu yang Diselesaikan
1. **Bug:** Kamera staff QR scanner blank/hitam saat pertama kali dibuka
2. **Bug:** Nomor SK auto-increment tidak berurutan karena sort order salah
3. **Bug kecil:** Setting GPS dan foto tidak terbaca karena type coercion (`'true' !== true`)
4. **Fitur baru:** Seluruh sistem absensi staff PCNU dengan GPS, foto, batas waktu, dinas luar, dan absen manual
5. **Data quality:** 50+ gelar akademik baru ditambahkan ke normalization map

### Pekerjaan Tertunda
- Verifikasi tampilan halaman `StaffAttendanceSettingsPage` di mobile viewport belum dilakukan
- File `backend/merge_sri_utami.php` dan `backend/check_teachers.php` masih tersisa di repo (commit `49d3736`) — perlu dibersihkan

---

## 📌 PRODUCT OWNER (PO)

### Fitur Baru yang Siap Digunakan

#### 1. Sistem Absensi Staff PCNU yang Lengkap
Sebelumnya absensi staff hanya bisa scan QR tanpa validasi apapun. Sekarang mendukung:

| Fitur | Deskripsi |
|-------|-----------|
| **Geofencing GPS** | Absen hanya bisa dilakukan dalam radius X meter dari kantor (opsional, bisa dimatikan) |
| **Foto Selfie** | Ambil foto otomatis saat scan sebagai bukti kehadiran (opsional) |
| **Absen Dinas Luar** | Staff yang keluar kota tetap bisa absen, status tersimpan sebagai "Dinas Luar", tanpa cek GPS |
| **Batas Waktu** | Admin bisa mengatur batas jam masuk (e.g. max 08:00) dan jam pulang (e.g. min 15:30) |
| **Absen Manual** | Admin bisa menginput kehadiran secara manual untuk koreksi atau izin/sakit |
| **Halaman Settings** | Semua parameter dikonfigurasi dari UI — tidak perlu edit kode |

#### 2. SK Generator — Pencarian Lebih Lengkap
Operator sekarang bisa mencari pengajuan SK menggunakan nama sekolah/unit kerja, tidak hanya nama guru.

#### 3. Normalisasi Gelar Akademik
Lebih dari 50 gelar akademik baru ditambahkan ke sistem normalisasi. Ini berdampak langsung pada kualitas data guru di dokumen SK yang digenerate.

### Files Berubah Hari Ini (Ringkasan)

| File | Jenis | Deskripsi |
|------|-------|-----------|
| `src/features/attendance/PublicScannerPage.tsx` | Frontend | Fix blank camera, integrasi geo/foto settings |
| `src/features/staff/StaffAttendanceSettingsPage.tsx` | Frontend | **File baru** — halaman konfigurasi absensi |
| `src/features/staff/StaffAttendanceReportPage.tsx` | Frontend | Tambah UI absen manual |
| `src/features/staff/StaffPage.tsx` | Frontend | Tambah nomor ID staff |
| `src/features/sk-management/SkGeneratorPage.tsx` | Frontend | Fix sort SK, update placeholder search |
| `src/lib/api.ts` | Frontend | Tambah parameter dinas luar di staffAttendanceApi |
| `src/App.tsx` + `src/components/layout/AppShell.tsx` | Frontend | Tambah route & menu halaman settings absensi |
| `backend/app/Http/Controllers/Api/StaffAttendanceController.php` | Backend | GPS logic, dinas luar, absen manual, batas waktu |
| `backend/app/Http/Controllers/Api/SkDocumentController.php` | Backend | Fix sort by + pencarian unit kerja |
| `backend/app/Http/Controllers/Api/StaffController.php` | Backend | Tambah nomor_id ke response |
| `backend/app/Models/Staff.php` | Backend | Tambah `nomor_id` ke fillable |
| `backend/app/Services/NormalizationService.php` | Backend | +50 gelar akademik, pre-processing regex |
| `backend/database/migrations/2026_06_26_023500_add_nomor_id_to_staffs_table.php` | DB | **Migrasi baru** — kolom `nomor_id` pada tabel staffs |
| `backend/routes/api.php` | Backend | Route baru absen manual |
| `public/templates/*.docx` (4 file) | Template | Update template SK GTT, GTY, Tendik, Kamad |

---

*Laporan dibuat otomatis dari git log 2026-06-26 · Proyek SIMMACI*
