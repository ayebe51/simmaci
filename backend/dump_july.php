<?php

use App\Models\SkDocument;
use App\Models\Teacher;

echo "=== MEMULAI PENYELAMATAN DATA DATABASE HARI INI ===\n";

$backupData = [
    'sk_documents' => SkDocument::withoutGlobalScopes()->get()->toArray(),
    'teachers' => Teacher::withoutGlobalScopes()->get()->toArray(),
];

$backupJson = json_encode($backupData, JSON_PRETTY_PRINT);
$backupPath = storage_path('app/public/simmaci_backup_db_6juli.json');

file_put_contents($backupPath, $backupJson);

echo "✅ Berhasil men-dump ".count($backupData['sk_documents'])." SK dan ".count($backupData['teachers'])." Guru.\n";
echo "File tersimpan di: {$backupPath}\n";
echo "Silakan lanjut ke proses ZIP (compress) folder public!\n";
