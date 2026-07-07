<?php
use App\Models\User;

echo "=== MENGUSUT ASAL-USUL UPLOADER ===\n\n";

$emails = [
    '111233010166@simmaci.com',
    '111233010017@simmaci.com',
    '121233010043@simmaci.com'
];

foreach ($emails as $email) {
    $user = User::withoutGlobalScopes()->where('email', $email)->first();
    if ($user) {
        $schoolName = $user->school ? $user->school->nama : 'TIDAK ADA / YAYASAN';
        echo "Email: {$email} | Role: {$user->role} | School ID: {$user->school_id} ({$schoolName})\n";
    } else {
        echo "Email: {$email} | TIDAK DITEMUKAN\n";
    }
}
