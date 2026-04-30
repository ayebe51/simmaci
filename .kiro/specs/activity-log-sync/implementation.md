# Sinkronisasi Activity Log untuk Tab Guru dan Sekolah

## 📋 Ringkasan

Activity logging untuk operasi Guru dan Sekolah telah dilengkapi agar semua aktivitas tercatat dan muncul di tab "Guru" dan "Sekolah" pada Riwayat Aktivitas Dashboard.

## 🔧 Perubahan Backend

### 1. SchoolController.php

**Import yang ditambahkan:**
```php
use App\Models\ActivityLog;
```

**Method yang dimodifikasi:**

#### a. `store()` - Tambah Sekolah Baru
```php
$school = School::create($data);

// Log activity
ActivityLog::create([
    'description' => "Menambahkan sekolah: {$school->nama}",
    'event' => 'create_school',
    'log_name' => 'school',
    'subject_id' => $school->id,
    'subject_type' => get_class($school),
    'causer_id' => $request->user()->id,
    'causer_type' => get_class($request->user()),
    'school_id' => $school->id,
]);
```

#### b. `update()` - Update Data Sekolah
```php
if (!empty($updateData)) {
    $school->update($updateData);

    // Log activity
    ActivityLog::create([
        'description' => "Memperbarui data sekolah: {$school->nama}",
        'event' => 'update_school',
        'log_name' => 'school',
        'subject_id' => $school->id,
        'subject_type' => get_class($school),
        'causer_id' => $request->user()->id,
        'causer_type' => get_class($request->user()),
        'school_id' => $school->id,
    ]);
}
```

#### c. `destroy()` - Hapus Sekolah
```php
$schoolName = $school->nama;
$schoolId = $school->id;

$school->delete();

// Log activity
ActivityLog::create([
    'description' => "Menghapus sekolah: {$schoolName}",
    'event' => 'delete_school',
    'log_name' => 'school',
    'subject_id' => $schoolId,
    'subject_type' => School::class,
    'causer_id' => $request->user()->id,
    'causer_type' => get_class($request->user()),
    'school_id' => null, // School sudah dihapus
]);
```

#### d. `import()` - Import Sekolah
```php
$newSchool = School::create($saveData);
$created++;

// Log activity for newly created school
try {
    ActivityLog::create([
        'description' => "Import sekolah: {$newSchool->nama}",
        'event' => 'import_school',
        'log_name' => 'school',
        'subject_id' => $newSchool->id,
        'subject_type' => get_class($newSchool),
        'causer_id' => $request->user()->id,
        'causer_type' => get_class($request->user()),
        'school_id' => $newSchool->id,
    ]);
} catch (\Exception $e) {
    // Don't fail import if logging fails
    Log::warning("Failed to log school import: " . $e->getMessage());
}
```

### 2. TeacherController.php

**Method yang dimodifikasi:**

#### a. `update()` - Update Data Guru
Menambahkan logging untuk update biasa (sebelumnya hanya ada logging untuk normalisasi):
```php
$this->teacherService->updateTeacher($teacher, $data);

// Log activity for teacher update
ActivityLog::create([
    'description' => "Memperbarui data guru: {$teacher->nama}",
    'event' => 'update_teacher',
    'log_name' => 'teacher',
    'subject_id' => $teacher->id,
    'subject_type' => get_class($teacher),
    'causer_id' => $request->user()->id,
    'causer_type' => get_class($request->user()),
    'school_id' => $teacher->school_id,
]);

// Log normalization changes if any occurred
if (!empty($normalizationChanges)) {
    ActivityLog::create([
        'description' => "Normalisasi data guru: {$teacher->nama}",
        'event' => 'normalize_teacher',
        'log_name' => 'master',
        'subject_id' => $teacher->id,
        'subject_type' => get_class($teacher),
        'causer_id' => $request->user()->id,
        'causer_type' => get_class($request->user()),
        'school_id' => $teacher->school_id,
        'properties' => ['normalization' => $normalizationChanges],
    ]);
}
```

#### b. `destroy()` - Hapus Guru
```php
$teacherName = $teacher->nama;
$teacherId = $teacher->id;
$schoolId = $teacher->school_id;

$teacher->delete();

// Log activity
ActivityLog::create([
    'description' => "Menghapus guru: {$teacherName}",
    'event' => 'delete_teacher',
    'log_name' => 'teacher',
    'subject_id' => $teacherId,
    'subject_type' => Teacher::class,
    'causer_id' => $request->user()->id,
    'causer_type' => get_class($request->user()),
    'school_id' => $schoolId,
]);
```

**Catatan:** Method `store()` dan `import()` untuk guru sudah memiliki logging sebelumnya.

## 📊 Event Mapping di DashboardController

Event yang sudah di-map untuk label yang user-friendly:

### Guru (Teacher)
- `create_teacher` → "Tambah Guru"
- `update_teacher` → "Update Guru"
- `delete_teacher` → "Hapus Guru"
- `import_teacher` → "Import Guru"
- `normalize_teacher` → "Normalisasi Guru"
- `update_nim` → "Update NIM Guru"

### Sekolah (School)
- `create_school` → "Tambah Sekolah"
- `update_school` → "Update Sekolah"
- `delete_school` → "Hapus Sekolah"
- `import_school` → "Import Sekolah"

### SK
- `create_sk` → "Buat SK"
- `submit_sk` → "Ajukan SK"
- `approve_sk` → "Setujui SK"
- `reject_sk` → "Tolak SK"
- `generate_sk` → "Generate SK"

## 🎯 Filter Tab di Dashboard

Filter di `DashboardPage.tsx`:

```typescript
const filteredLogs = logs?.filter((log: any) => {
  if (logFilter === "all") return true;
  if (logFilter === "sk") return log.action?.toLowerCase().includes('sk');
  if (logFilter === "guru") return log.action?.toLowerCase().includes('guru') || log.action?.toLowerCase().includes('teacher');
  if (logFilter === "sekolah") return log.action?.toLowerCase().includes('sekolah') || log.action?.toLowerCase().includes('school');
  return true;
});
```

**Cara kerja filter:**
- **Tab "Semua"**: Menampilkan semua aktivitas
- **Tab "SK"**: Menampilkan aktivitas yang mengandung kata "sk" di action
- **Tab "Guru"**: Menampilkan aktivitas yang mengandung kata "guru" atau "teacher" di action
- **Tab "Sekolah"**: Menampilkan aktivitas yang mengandung kata "sekolah" atau "school" di action

## 📝 Struktur Activity Log

```php
[
    'description' => 'Deskripsi aktivitas yang user-friendly',
    'event' => 'event_name', // Digunakan untuk mapping label
    'log_name' => 'category', // teacher, school, sk, master, dll
    'subject_id' => 'ID objek yang dimodifikasi',
    'subject_type' => 'Class name objek',
    'causer_id' => 'ID user yang melakukan aksi',
    'causer_type' => 'Class name user',
    'school_id' => 'ID sekolah (untuk tenant scoping)',
    'properties' => [], // Data tambahan (opsional)
]
```

## 🔍 Cara Menggunakan

### Untuk User

1. Buka **Dashboard**
2. Scroll ke bawah ke card **"Riwayat Aktivitas"**
3. Klik tab yang diinginkan:
   - **Semua**: Lihat semua aktivitas
   - **SK**: Lihat aktivitas terkait SK
   - **Guru**: Lihat aktivitas terkait Guru
   - **Sekolah**: Lihat aktivitas terkait Sekolah

### Contoh Tampilan

**Tab Guru:**
```
🟢 Update Guru
   Admin Yayasan • super_admin
   2 jam yang lalu
   Memperbarui data guru: Ahmad Fauzi, S.Pd.
   MI Miftahul Huda

🟢 Tambah Guru
   Operator Sekolah • operator
   1 hari yang lalu
   Menambahkan guru: Siti Aminah, S.Pd.I.
   MTs Al-Ikhlas
```

**Tab Sekolah:**
```
🟢 Update Sekolah
   Admin Yayasan • super_admin
   3 jam yang lalu
   Memperbarui data sekolah: MI Miftahul Huda

🟢 Import Sekolah
   Super Admin • super_admin
   2 hari yang lalu
   Import sekolah: MA Al-Hidayah
```

## ✅ Testing

### Manual Testing

1. **Test Guru:**
   - Tambah guru baru → Cek tab "Guru" → Harus ada entry "Tambah Guru"
   - Update guru → Cek tab "Guru" → Harus ada entry "Update Guru"
   - Hapus guru → Cek tab "Guru" → Harus ada entry "Hapus Guru"
   - Import guru → Cek tab "Guru" → Harus ada entry "Import Guru"

2. **Test Sekolah:**
   - Tambah sekolah → Cek tab "Sekolah" → Harus ada entry "Tambah Sekolah"
   - Update sekolah → Cek tab "Sekolah" → Harus ada entry "Update Sekolah"
   - Hapus sekolah → Cek tab "Sekolah" → Harus ada entry "Hapus Sekolah"
   - Import sekolah → Cek tab "Sekolah" → Harus ada entry "Import Sekolah"

3. **Test Filter:**
   - Klik tab "Semua" → Harus tampil semua aktivitas
   - Klik tab "SK" → Hanya tampil aktivitas SK
   - Klik tab "Guru" → Hanya tampil aktivitas Guru
   - Klik tab "Sekolah" → Hanya tampil aktivitas Sekolah

### Database Check

```sql
-- Cek activity log untuk guru
SELECT * FROM activity_logs 
WHERE log_name = 'teacher'
ORDER BY created_at DESC
LIMIT 10;

-- Cek activity log untuk sekolah
SELECT * FROM activity_logs 
WHERE log_name = 'school'
ORDER BY created_at DESC
LIMIT 10;

-- Cek statistik activity log
SELECT log_name, event, COUNT(*) as total
FROM activity_logs
GROUP BY log_name, event
ORDER BY total DESC;
```

## 🐛 Troubleshooting

### Tab Guru/Sekolah kosong

1. **Cek backend:**
   ```bash
   # Cek log Laravel
   tail -f backend/storage/logs/laravel.log
   
   # Cek database
   SELECT COUNT(*) FROM activity_logs WHERE log_name IN ('teacher', 'school');
   ```

2. **Cek filter:**
   - Pastikan filter di `DashboardPage.tsx` sudah benar
   - Cek apakah `log.action` mengandung kata kunci yang tepat

3. **Cek event mapping:**
   - Pastikan event di `DashboardController::formatActivityLabel()` sudah di-map dengan benar

### Data lama tidak muncul

Data guru/sekolah yang dibuat/diupdate sebelum implementasi ini tidak akan memiliki activity log. Ini normal karena logging baru dimulai setelah implementasi.

## 📝 Catatan

- Activity log untuk guru dan sekolah menggunakan `log_name` yang berbeda:
  - Guru: `log_name = 'teacher'`
  - Sekolah: `log_name = 'school'`
  - SK: `log_name = 'sk'`
- Filter tab menggunakan keyword matching pada field `action` yang sudah di-format
- Tenant scoping otomatis diterapkan untuk operator (hanya melihat log sekolah mereka)
- Super admin dan admin yayasan melihat semua log

## 🚀 Future Enhancements

1. **Advanced Filter** - Filter berdasarkan tanggal, user, atau sekolah tertentu
2. **Export** - Export activity log ke Excel atau PDF
3. **Real-time Updates** - WebSocket untuk update real-time
4. **Audit Trail** - Integrasi dengan sistem audit yang lebih komprehensif
5. **Rollback** - Kemampuan untuk rollback perubahan data
