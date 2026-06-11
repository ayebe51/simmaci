<?php
$rejectedDocs = \App\Models\SkDocument::withoutGlobalScopes()
    ->where('status', 'rejected')
    ->orderBy('id', 'desc')
    ->take(10)
    ->get(['nama', 'rejection_reason', 'created_at']);

foreach ($rejectedDocs as $doc) {
    echo "NAMA: " . $doc->nama . " | ALASAN: " . $doc->rejection_reason . " | WAKTU: " . $doc->created_at . "\n";
}
