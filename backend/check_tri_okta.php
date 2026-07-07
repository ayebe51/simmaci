<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\SkDocument;
use App\Models\Teacher;

echo "=== CEK KHUSUS TRI OKTA & AAN RUSLIANA ===\n";

$names = ['TRI OKTA ISTIYONO, S.Pd.', 'AAN RUSLIANA, S.Pd.I', 'ALFINA AMANATUL FAUZAH, S.Pd.'];

foreach ($names as $name) {
    echo "Mencari SK untuk: $name\n";
    $sks = SkDocument::withoutGlobalScopes()->where('nama', 'LIKE', "%" . explode(',', $name)[0] . "%")->get();
    
    foreach ($sks as $sk) {
        echo "  - SK ID: {$sk->id} | Nama: {$sk->nama} | School ID: {$sk->school_id} | Surat: {$sk->nomor_permohonan} | Uploader: {$sk->uploaded_by}\n";
        $t = Teacher::withoutGlobalScopes()->find($sk->teacher_id);
        if ($t) {
            echo "    -> Teacher Profile (ID: {$t->id}): School ID = {$t->school_id} | Nama = {$t->nama}\n";
        }
    }
    echo "--------------------------------------------------\n";
}
