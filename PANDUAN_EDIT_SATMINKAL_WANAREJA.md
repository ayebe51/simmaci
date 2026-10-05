# Panduan Perbaikan Satminkal: SMP Ma'arif NU 1 Wanareja ➔ SMP Ma'arif NU 01 Wanareja

Panduan ini berisi cara mengubah satminkal / unit kerja guru di SIMMACI yang masih berlabel **"SMP Ma'arif NU 1 Wanareja"** menjadi nama resmi **"SMP Ma'arif NU 01 Wanareja"** di server VPS (Docker).

---
## 📌 Ringkasan Solusi
Semua metode di bawah ini telah dilengkapi dengan mode **Dry Run (Simulasi / Read-Only)** untuk memeriksa data guru dan dokumen SK yang akan terpengaruh sebelum ada perubahan yang diterapkan ke database.
---
## ⚡ CARA 2: Direct Tinker di Container Backend (Tanpa Upload File)
Cara ini langsung dijalankan di terminal SSH VPS menggunakan Laravel Tinker.

### 🔍 2.A: Versi DRY RUN (Simulasi / Read-Only)
Jalankan perintah ini di SSH VPS. Perintah ini **100% aman (hanya membaca data)**:
```bash
docker exec -i simmaci-backend php artisan tinker << 'EOF'
use App\Models\Teacher, App\Models\School, App\Models\SkDocument;

echo "\n=======================================================\n";
echo "       [DRY RUN] PEMERIKSAAN MASTER SEKOLAH\n";
echo "=======================================================\n";
$targetSchool = School::withoutGlobalScopes()->whereNull('deleted_at')->whereRaw("LOWER(REPLACE(REPLACE(nama, '''', ''), '’', '')) = 'smp maarif nu 01 wanareja'")->first();
$oldSchool = School::withoutGlobalScopes()->whereNull('deleted_at')->whereRaw("LOWER(REPLACE(REPLACE(nama, '''', ''), '’', '')) = 'smp maarif nu 1 wanareja'")->first();

if ($targetSchool) {
    echo "✓ Target School ditemukan : [ID: {$targetSchool->id}] {$targetSchool->nama}\n";
} else {
    echo "⚠️ Target School 'SMP Ma'arif NU 01 Wanareja' belum ada di master.\n";
}

if ($oldSchool) {
    echo "✓ Master School lama      : [ID: {$oldSchool->id}] {$oldSchool->nama} (akan di-rename)\n";
}

$targetId = $targetSchool?->id ?: $oldSchool?->id;

echo "\n=======================================================\n";
echo "       [DRY RUN] DAFTAR GURU YANG AKAN TERDAMPAK\n";
echo "=======================================================\n";
$teachers = Teacher::withoutGlobalScopes()->whereNull('deleted_at')->where(function($q) use ($oldSchool) {
    $q->whereRaw("LOWER(REPLACE(REPLACE(unit_kerja, '''', ''), '’', '')) LIKE '%smp maarif nu 1 wanareja%'")
      ->orWhereRaw("LOWER(unit_kerja) LIKE '%smp%nu 1 wanareja%'");
    if ($oldSchool) $q->orWhere('school_id', $oldSchool->id);
})->get();

echo "Total Guru Terdeteksi: " . $teachers->count() . " orang\n";
echo str_repeat('-', 90) . "\n";
printf("%-6s | %-28s | %-26s | %-16s\n", "ID", "Nama Guru", "Satminkal Saat Ini", "School ID");
echo str_repeat('-', 90) . "\n";

$teacherIds = [];
foreach ($teachers as $t) {
    $teacherIds[] = $t->id;
    printf("%-6s | %-28s | %-26s | %-16s\n", $t->id, mb_substr($t->nama, 0, 28), mb_substr($t->unit_kerja ?: '<KOSONG>', 0, 26), ($t->school_id ?: '<NULL>') . ' -> ' . ($targetId ?: '?'));
}
echo str_repeat('-', 90) . "\n";

$skCount = SkDocument::withoutGlobalScopes()->whereNull('deleted_at')->where(function($q) use ($teacherIds) {
    if (!empty($teacherIds)) $q->whereIn('teacher_id', $teacherIds);
    $q->orWhereRaw("LOWER(REPLACE(REPLACE(unit_kerja, '''', ''), '’', '')) LIKE '%smp maarif nu 1 wanareja%'");
})->count();

echo "Total Dokumen SK Terdampak: {$skCount} dokumen\n";
echo "\n⚠️ STATUS: INI ADALAH DRY-RUN (SIMULASI). TIDAK ADA DATA YANG DIUBAH.\n\n";
EOF
```
---
### 🚀 2.B: Versi EKSEKUSI (Simpan Perubahan ke Database)
Jika data pada preview di atas sudah sesuai, jalankan perintah eksekusi ini:
```bash
docker exec -i simmaci-backend php artisan tinker << 'EOF'
use App\Models\Teacher, App\Models\School, App\Models\SkDocument, Illuminate\Support\Facades\DB;

DB::transaction(function() {
    $toText = "SMP Ma'arif NU 01 Wanareja";
    
    // 1. Cek & update master school jika perlu
    $sch = School::withoutGlobalScopes()->whereNull('deleted_at')->whereRaw("LOWER(REPLACE(REPLACE(nama, '''', ''), '’', '')) = 'smp maarif nu 01 wanareja'")->first()
        ?: School::withoutGlobalScopes()->whereNull('deleted_at')->whereRaw("LOWER(REPLACE(REPLACE(nama, '''', ''), '’', '')) = 'smp maarif nu 1 wanareja'")->first();

    if ($sch && $sch->nama !== $toText) {
        $sch->update(['nama' => $toText]);
        echo "✓ Master School ID {$sch->id} berhasil diupdate namanya.\n";
    }
    $targetId = $sch?->id;

    // 2. Update Guru
    $teachers = Teacher::withoutGlobalScopes()->whereNull('deleted_at')->where(function($q) use ($sch) {
        $q->whereRaw("LOWER(REPLACE(REPLACE(unit_kerja, '''', ''), '’', '')) LIKE '%smp maarif nu 1 wanareja%'")
          ->orWhereRaw("LOWER(unit_kerja) LIKE '%smp%nu 1 wanareja%'");
        if ($sch) $q->orWhere('school_id', $sch->id);
    })->get();

    echo "Mengupdate " . $teachers->count() . " guru...\n";
    foreach ($teachers as $t) {
        $t->unit_kerja = $toText;
        if ($targetId) $t->school_id = $targetId;
        if (empty($t->kecamatan)) $t->kecamatan = 'Wanareja';
        $t->save();
        echo "✓ Guru ID {$t->id}: {$t->nama} telah diperbarui.\n";
    }

    // 3. Update SK Documents
    $skUpdated = SkDocument::withoutGlobalScopes()->whereNull('deleted_at')
        ->whereIn('teacher_id', $teachers->pluck('id'))
        ->update(['unit_kerja' => $toText, 'school_id' => $targetId]);
    echo "✓ {$skUpdated} dokumen SK berhasil disinkronkan.\n";
});

// Bersihkan cache
\Artisan::call('optimize:clear');
echo "✓ Cache sistem berhasil dibersihkan.\n";
echo "✅ SEMUA PERUBAHAN SELESAI DISIMPAN!\n";
EOF
```
---
## 🗄️ CARA 3: Langsung via PostgreSQL Database (Container `simmaci-db`)
### 🔍 3.A: Versi DRY RUN (Read-Only SELECT)
Jalankan query ini di terminal VPS. Perintah ini **hanya membaca data dari database**:
```bash
docker exec -i simmaci-db psql -U sim_user -d sim_maarif << 'EOF'
-- 1. Preview master sekolah di Wanareja
SELECT id, nama, npsn, kecamatan 
FROM schools 
WHERE deleted_at IS NULL 
  AND (LOWER(nama) LIKE '%wanareja%' AND (LOWER(nama) LIKE '%smp%' OR LOWER(nama) LIKE '%1%'));

-- 2. Preview guru yang terdampak
SELECT 
    id, 
    nama, 
    nuptk, 
    nomor_induk_maarif, 
    unit_kerja AS satminkal_saat_ini, 
    'SMP Ma''arif NU 01 Wanareja' AS satminkal_baru,
    school_id AS school_id_saat_ini,
    (SELECT id FROM schools WHERE deleted_at IS NULL AND (LOWER(TRIM(nama)) = 'smp ma''arif nu 01 wanareja' OR LOWER(REPLACE(nama, '''', '')) = 'smp maarif nu 01 wanareja') LIMIT 1) AS target_school_id
FROM teachers 
WHERE deleted_at IS NULL 
  AND (
    LOWER(REPLACE(REPLACE(unit_kerja, '''', ''), '’', '')) LIKE '%smp maarif nu 1 wanareja%'
    OR LOWER(unit_kerja) LIKE '%smp%nu 1 wanareja%'
  );

-- 3. Ringkasan total guru & dokumen SK
SELECT 
    (SELECT COUNT(*) FROM teachers WHERE deleted_at IS NULL AND (LOWER(REPLACE(REPLACE(unit_kerja, '''', ''), '’', '')) LIKE '%smp maarif nu 1 wanareja%' OR LOWER(unit_kerja) LIKE '%smp%nu 1 wanareja%')) AS total_guru_terdampak,
    (SELECT COUNT(*) FROM sk_documents WHERE deleted_at IS NULL AND (LOWER(REPLACE(REPLACE(unit_kerja, '''', ''), '’', '')) LIKE '%smp maarif nu 1 wanareja%' OR LOWER(unit_kerja) LIKE '%smp%nu 1 wanareja%')) AS total_sk_terdampak;
EOF
```
---
### 🚀 3.B: Versi EKSEKUSI (Transaksi Database dengan COMMIT)
Setelah memeriksa hasil pada langkah 3.A, eksekusi pembaruan permanen:
```bash
docker exec -i simmaci-db psql -U sim_user -d sim_maarif << 'EOF'
BEGIN;

-- 1. Update nama sekolah di tabel master jika masih pakai nama lama
UPDATE schools 
SET nama = 'SMP Ma''arif NU 01 Wanareja', updated_at = NOW() 
WHERE deleted_at IS NULL 
  AND LOWER(REPLACE(REPLACE(nama, '''', ''), '’', '')) = 'smp maarif nu 1 wanareja'
  AND NOT EXISTS (
    SELECT 1 FROM schools s2 
    WHERE s2.deleted_at IS NULL 
      AND LOWER(REPLACE(REPLACE(s2.nama, '''', ''), '’', '')) = 'smp maarif nu 01 wanareja'
  );

-- 2. Update satminkal dan school_id pada tabel teachers
UPDATE teachers 
SET unit_kerja = 'SMP Ma''arif NU 01 Wanareja',
    school_id = COALESCE(
      (SELECT id FROM schools 
       WHERE deleted_at IS NULL 
         AND LOWER(REPLACE(REPLACE(nama, '''', ''), '’', '')) = 'smp maarif nu 01 wanareja' 
       ORDER BY id ASC LIMIT 1),
      school_id
    ),
    kecamatan = CASE WHEN (kecamatan IS NULL OR TRIM(kecamatan) = '') THEN 'Wanareja' ELSE kecamatan END,
    updated_at = NOW()
WHERE deleted_at IS NULL 
  AND (
    LOWER(REPLACE(REPLACE(unit_kerja, '''', ''), '’', '')) LIKE '%smp maarif nu 1 wanareja%'
    OR LOWER(unit_kerja) LIKE '%smp%nu 1 wanareja%'
  );

-- 3. Update dokumen SK agar sinkron
UPDATE sk_documents 
SET unit_kerja = 'SMP Ma''arif NU 01 Wanareja',
    school_id = COALESCE(
      (SELECT id FROM schools 
       WHERE deleted_at IS NULL 
         AND LOWER(REPLACE(REPLACE(nama, '''', ''), '’', '')) = 'smp maarif nu 01 wanareja' 
       ORDER BY id ASC LIMIT 1),
      school_id
    ),
    updated_at = NOW()
WHERE deleted_at IS NULL 
  AND (
    LOWER(REPLACE(REPLACE(unit_kerja, '''', ''), '’', '')) LIKE '%smp maarif nu 1 wanareja%'
    OR LOWER(unit_kerja) LIKE '%smp%nu 1 wanareja%'
    OR teacher_id IN (
      SELECT id FROM teachers 
      WHERE deleted_at IS NULL 
        AND LOWER(REPLACE(REPLACE(unit_kerja, '''', ''), '’', '')) = 'smp maarif nu 01 wanareja'
    )
  );

COMMIT;
EOF

# Bersihkan cache Laravel
docker exec -i simmaci-backend php artisan optimize:clear
```
---
## 🔍 Verifikasi Akhir
Untuk memastikan bahwa satminkal sudah berubah sempurna:
```bash
docker exec -i simmaci-backend php artisan tinker --execute="use App\Models\Teacher; Teacher::withoutGlobalScopes()->whereNull('deleted_at')->where('unit_kerja', 'SMP Ma\'arif NU 01 Wanareja')->get(['id', 'nama', 'unit_kerja', 'school_id'])->each(fn(\$t) => print(\"ID: {\$t->id} | {\$t->nama} | Satminkal: {\$t->unit_kerja} | School ID: {\$t->school_id}\n\"));"
```
