# Tinker One-Liners untuk Normalisasi Gelar

Command satu baris yang bisa langsung copy-paste ke tinker.

## 🚀 Setup (Copy ini dulu)

```php
use App\Models\Teacher; use App\Models\SkDocument; use App\Models\HeadmasterTenure; use App\Services\NormalizationService; $service = app(NormalizationService::class);
```

---

## 📊 Preview Commands

### Preview 10 Teacher pertama yang akan berubah
```php
Teacher::limit(50)->get()->filter(fn($t) => $t->nama !== $service->normalizeTeacherName($t->nama))->take(10)->each(fn($t) => print("ID {$t->id}: '{$t->nama}' → '" . $service->normalizeTeacherName($t->nama) . "'\n"));
```

### Count total yang akan berubah
```php
Teacher::get()->filter(fn($t) => $t->nama !== $service->normalizeTeacherName($t->nama))->count();
```

### Preview Teacher dengan gelar menempel (no spaces)
```php
Teacher::whereRaw("nama = UPPER(nama)")->whereRaw("nama NOT LIKE '% %'")->whereRaw("LENGTH(nama) > 8")->limit(10)->get()->each(fn($t) => print("ID {$t->id}: '{$t->nama}' → '" . $service->normalizeTeacherName($t->nama) . "'\n"));
```

### Preview Teacher dengan gelar lowercase
```php
Teacher::where('nama', 'LIKE', '% s.%')->orWhere('nama', 'LIKE', '% m.%')->limit(10)->get()->each(fn($t) => print("ID {$t->id}: '{$t->nama}' → '" . $service->normalizeTeacherName($t->nama) . "'\n"));
```

---

## ✏️ Update Commands

### Update 1 Teacher by ID
```php
$t = Teacher::find(1); $t->update(['nama' => $service->normalizeTeacherName($t->nama)]); echo "Updated: {$t->nama}\n";
```

### Update semua Teacher (dengan progress)
```php
$updated = 0; Teacher::chunk(100, function($teachers) use ($service, &$updated) { foreach ($teachers as $t) { $n = $service->normalizeTeacherName($t->nama); if ($t->nama !== $n) { $t->update(['nama' => $n]); $updated++; echo "ID {$t->id}: '{$t->nama}' → '{$n}'\n"; } } }); echo "Total: {$updated}\n";
```

### Update Teacher by School ID
```php
$schoolId = 1; $updated = 0; Teacher::where('school_id', $schoolId)->chunk(100, function($teachers) use ($service, &$updated) { foreach ($teachers as $t) { $n = $service->normalizeTeacherName($t->nama); if ($t->nama !== $n) { $t->update(['nama' => $n]); $updated++; } } }); echo "Updated: {$updated}\n";
```

### Update Teacher dengan gelar menempel saja
```php
$updated = 0; Teacher::whereRaw("nama = UPPER(nama)")->whereRaw("nama NOT LIKE '% %'")->whereRaw("LENGTH(nama) > 8")->chunk(100, function($teachers) use ($service, &$updated) { foreach ($teachers as $t) { $n = $service->normalizeTeacherName($t->nama); if ($t->nama !== $n) { $t->update(['nama' => $n]); $updated++; echo "ID {$t->id}: '{$t->nama}' → '{$n}'\n"; } } }); echo "Total: {$updated}\n";
```

### Update semua SkDocument
```php
$updated = 0; SkDocument::chunk(100, function($docs) use ($service, &$updated) { foreach ($docs as $d) { $n = $service->normalizeTeacherName($d->nama); if ($d->nama !== $n) { $d->update(['nama' => $n]); $updated++; } } }); echo "Updated: {$updated}\n";
```

### Update semua HeadmasterTenure
```php
$updated = 0; HeadmasterTenure::chunk(100, function($tenures) use ($service, &$updated) { foreach ($tenures as $t) { $n = $service->normalizeTeacherName($t->teacher_name); if ($t->teacher_name !== $n) { $t->update(['teacher_name' => $n]); $updated++; } } }); echo "Updated: {$updated}\n";
```

---

## 🔍 Search & Test Commands

### Test single name
```php
$service->normalizeTeacherName('MAFTUHSAG');
```

### Test multiple names
```php
collect(['MAFTUHSAG', 'FATIMAHMPD', 'dr. ahmad s.pd'])->each(fn($n) => print("'{$n}' → '" . $service->normalizeTeacherName($n) . "'\n"));
```

### Parse degrees (breakdown)
```php
$service->parseAcademicDegreesPublic('dr. ahmad fauzi s.pd m.ag');
```

### Find Teacher by name pattern
```php
Teacher::where('nama', 'LIKE', '%MAFTUH%')->get()->each(fn($t) => print("ID {$t->id}: {$t->nama}\n"));
```

### Find Teacher yang perlu dinormalisasi
```php
Teacher::get()->filter(fn($t) => $t->nama !== $service->normalizeTeacherName($t->nama))->take(10)->pluck('nama', 'id');
```

---

## 📈 Statistics Commands

### Count by status
```php
$total = Teacher::count(); $needsUpdate = Teacher::get()->filter(fn($t) => $t->nama !== $service->normalizeTeacherName($t->nama))->count(); echo "Total: {$total}, Needs update: {$needsUpdate}, OK: " . ($total - $needsUpdate) . "\n";
```

### Group by change type
```php
$stats = ['attached' => 0, 'lowercase' => 0, 'other' => 0]; Teacher::chunk(100, function($teachers) use ($service, &$stats) { foreach ($teachers as $t) { $n = $service->normalizeTeacherName($t->nama); if ($t->nama !== $n) { if (!str_contains($t->nama, ' ')) $stats['attached']++; elseif (preg_match('/\s[a-z]\./', $t->nama)) $stats['lowercase']++; else $stats['other']++; } } }); print_r($stats);
```

### List schools with most issues
```php
Teacher::selectRaw('school_id, COUNT(*) as total')->groupBy('school_id')->orderByDesc('total')->limit(10)->get()->each(fn($s) => print("School {$s->school_id}: {$s->total} teachers\n"));
```

---

## 💾 Backup & Restore Commands

### Backup to JSON
```php
$backup = Teacher::pluck('nama', 'id')->toArray(); file_put_contents('teacher_backup_' . date('Y-m-d_His') . '.json', json_encode($backup, JSON_PRETTY_PRINT)); echo "Backed up " . count($backup) . " teachers\n";
```

### Restore from JSON
```php
$backup = json_decode(file_get_contents('teacher_backup_2026-05-04_123456.json'), true); $restored = 0; foreach ($backup as $id => $nama) { $t = Teacher::find($id); if ($t && $t->nama !== $nama) { $t->update(['nama' => $nama]); $restored++; } } echo "Restored: {$restored}\n";
```

---

## 🎯 Specific Use Cases

### Update hanya nama yang mengandung "SAG"
```php
$updated = 0; Teacher::where('nama', 'LIKE', '%SAG%')->chunk(100, function($teachers) use ($service, &$updated) { foreach ($teachers as $t) { $n = $service->normalizeTeacherName($t->nama); if ($t->nama !== $n) { $t->update(['nama' => $n]); $updated++; echo "ID {$t->id}: '{$t->nama}' → '{$n}'\n"; } } }); echo "Updated: {$updated}\n";
```

### Update hanya nama yang mengandung "SPD"
```php
$updated = 0; Teacher::where('nama', 'LIKE', '%SPD%')->chunk(100, function($teachers) use ($service, &$updated) { foreach ($teachers as $t) { $n = $service->normalizeTeacherName($t->nama); if ($t->nama !== $n) { $t->update(['nama' => $n]); $updated++; echo "ID {$t->id}: '{$t->nama}' → '{$n}'\n"; } } }); echo "Updated: {$updated}\n";
```

### Update hanya nama yang mengandung "MPD"
```php
$updated = 0; Teacher::where('nama', 'LIKE', '%MPD%')->chunk(100, function($teachers) use ($service, &$updated) { foreach ($teachers as $t) { $n = $service->normalizeTeacherName($t->nama); if ($t->nama !== $n) { $t->update(['nama' => $n]); $updated++; echo "ID {$t->id}: '{$t->nama}' → '{$n}'\n"; } } }); echo "Updated: {$updated}\n";
```

### Update semua model sekaligus (HATI-HATI!)
```php
$stats = ['teacher' => 0, 'sk' => 0, 'tenure' => 0]; Teacher::chunk(100, function($ts) use ($service, &$stats) { foreach ($ts as $t) { $n = $service->normalizeTeacherName($t->nama); if ($t->nama !== $n) { $t->update(['nama' => $n]); $stats['teacher']++; } } }); SkDocument::chunk(100, function($docs) use ($service, &$stats) { foreach ($docs as $d) { $n = $service->normalizeTeacherName($d->nama); if ($d->nama !== $n) { $d->update(['nama' => $n]); $stats['sk']++; } } }); HeadmasterTenure::chunk(100, function($tenures) use ($service, &$stats) { foreach ($tenures as $t) { $n = $service->normalizeTeacherName($t->teacher_name); if ($t->teacher_name !== $n) { $t->update(['teacher_name' => $n]); $stats['tenure']++; } } }); print_r($stats);
```

---

## 🔧 Utility One-Liners

### Clear cache
```php
\Artisan::call('cache:clear'); echo "Cache cleared\n";
```

### Check memory usage
```php
echo "Memory: " . round(memory_get_usage() / 1024 / 1024, 2) . " MB\n";
```

### Set memory limit
```php
ini_set('memory_limit', '512M'); echo "Memory limit set to 512M\n";
```

### Get service info
```php
echo "Service: " . get_class($service) . "\n"; echo "Methods: " . implode(', ', get_class_methods($service)) . "\n";
```

---

## 📝 Quick Reference

### Most Common Commands

**Setup:**
```php
use App\Models\Teacher; use App\Services\NormalizationService; $service = app(NormalizationService::class);
```

**Preview:**
```php
Teacher::limit(10)->get()->each(fn($t) => print("'{$t->nama}' → '" . $service->normalizeTeacherName($t->nama) . "'\n"));
```

**Update All:**
```php
$updated = 0; Teacher::chunk(100, function($teachers) use ($service, &$updated) { foreach ($teachers as $t) { $n = $service->normalizeTeacherName($t->nama); if ($t->nama !== $n) { $t->update(['nama' => $n]); $updated++; } } }); echo "Updated: {$updated}\n";
```

**Test:**
```php
$service->normalizeTeacherName('MAFTUHSAG');
```

---

## ⚠️ Important Notes

1. **Selalu backup dulu** sebelum update massal
2. **Test di development** sebelum production
3. **Preview dulu** dengan limit kecil
4. **Monitor memory** untuk dataset besar
5. **Gunakan chunk()** untuk performa optimal

---

**Tip**: Copy command ke text editor dulu, edit parameter (school_id, limit, dll), baru paste ke tinker.

**Created by**: Kiro AI Assistant  
**Version**: 1.0  
**Last Updated**: 2026-05-04
