<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$docs = \App\Models\SkDocument::withoutTenantScope()->where('status', 'rejected')->get();
$count = 0;
foreach ($docs as $doc) {
    $hasHistory = \App\Models\ApprovalHistory::withoutTenantScope()->where('document_id', $doc->id)->exists();
    if (!$hasHistory) {
        \App\Models\ApprovalHistory::create([
            'school_id' => $doc->school_id,
            'document_id' => $doc->id,
            'document_type' => 'sk_document',
            'action' => 'reject',
            'from_status' => 'pending',
            'to_status' => 'rejected',
            'performed_by' => null,
            'performed_at' => clone $doc->created_at,
            'comment' => 'Ditolak otomatis oleh sistem',
            'metadata' => [
                'rejection_reason' => $doc->rejection_reason ?? 'Ditolak secara otomatis karena tidak memenuhi syarat.'
            ]
        ]);
        $count++;
    }
}
echo "Backfilled $count rejection histories.\n";
