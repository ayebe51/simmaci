<?php
use App\Models\Teacher;
use App\Models\SkDocument;

$sk1 = SkDocument::withoutGlobalScopes()->find(461);
$sk2 = SkDocument::withoutGlobalScopes()->find(1277);

$t1 = Teacher::withoutGlobalScopes()->find(3101);
$allT = Teacher::withoutGlobalScopes()->where('nama', 'like', '%AHMAD MAHRUM%')->get(['id', 'nama', 'school_id', 'deleted_at', 'tmt']);

echo "SK 461: " . json_encode($sk1) . "\n";
echo "SK 1277: " . json_encode($sk2) . "\n";
echo "Teacher 3101: " . json_encode($t1) . "\n";
echo "All Ahmad Mahrums: " . json_encode($allT) . "\n";
