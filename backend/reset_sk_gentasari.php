<?php
/**
 * Script rollback SK - MI Ma'arif 04 Gentasari
 * Jalankan via: php artisan tinker --execute="require 'reset_sk_gentasari.php';"
 *
 * Yang dilakukan:
 * 1. Reset status dari 'approved' ke 'pending'
 * 2. Reset nomor_sk ke format REQ/2026/XXXX (berurutan ulang dari 0001)
 * 3. Clear file_url dan qr_code (hasil generate SK)
 */

use App\Models\SkDocument;
use App\Models\School;

// Nama-nama yang perlu di-reset (dari gambar)
$namaList = [
    "WIVA QURROTA 'AYUNI",
    "KENNY APRILLIA",
    "RENI WAHYUNINGSIH",
    "IKE MACHABAH FARASTUTI",
    "ANIQOTUL MA'RIFAH",
    "OKTAVIA USWATUN KHASANAH",
    "SITI KHOLIFAH",
];

// Cari sekolah
$school = School::where('nama', 'like', '%Gentasari%')->first();
if (!$school) {
    echo "❌ Sekolah MI Ma'arif 04 Gentasari tidak ditemukan!\n";
    echo "Daftar sekolah yang ada:\n";
    School::where('nama', 'like', '%Ma%arif%')->get(['id', 'nama'])->each(fn($s) => print("  - [{$s->id}] {$s->nama}\n"));
    return;
}

echo "✅ Sekolah ditemukan: [{$school->id}] {$school->nama}\n\n";

// Cari SK documents yang perlu di-reset
$skDocs = SkDocument::withoutTenantScope()
    ->where('school_id', $school->id)
    ->where('status', 'approved')
    ->whereIn(\DB::raw('UPPER(nama)'), array_map('strtoupper', $namaList))
    ->orderBy('id')
    ->get();

if ($skDocs->isEmpty()) {
    echo "❌ Tidak ada SK dokumen yang ditemukan dengan kriteria tersebut.\n";
    echo "Mencoba tanpa filter status...\n";
    
    $skDocs = SkDocument::withoutTenantScope()
        ->where('school_id', $school->id)
        ->whereIn(\DB::raw('UPPER(nama)'), array_map('strtoupper', $namaList))
        ->orderBy('id')
        ->get();
    
    if ($skDocs->isEmpty()) {
        echo "❌ Masih tidak ditemukan. Cek nama di database:\n";
        SkDocument::withoutTenantScope()
            ->where('school_id', $school->id)
            ->get(['id', 'nama', 'status', 'nomor_sk'])
            ->each(fn($s) => print("  - [{$s->id}] {$s->nama} | {$s->status} | {$s->nomor_sk}\n"));
        return;
    }
}

echo "📋 SK dokumen yang akan di-reset ({$skDocs->count()} records):\n";
foreach ($skDocs as $sk) {
    echo "  - [{$sk->id}] {$sk->nama} | Status: {$sk->status} | Nomor SK: {$sk->nomor_sk}\n";
}

echo "\n⚠️  Konfirmasi: ketik 'ya' untuk lanjutkan, atau tekan Enter untuk batal: ";
$confirm = trim(fgets(STDIN));

if (strtolower($confirm) !== 'ya') {
    echo "❌ Dibatalkan.\n";
    return;
}

// Cari nomor REQ tertinggi yang sudah ada untuk tahun 2026
$year = 2026;
$prefix = "REQ/{$year}/";
$maxExisting = SkDocument::withoutTenantScope()
    ->where('nomor_sk', 'like', $prefix . '%')
    ->whereNotIn('id', $skDocs->pluck('id'))
    ->pluck('nomor_sk')
    ->map(fn($n) => (int) substr($n, strlen($prefix)))
    ->max() ?? 0;

echo "\n🔄 Memulai reset...\n";
echo "   Nomor REQ tertinggi yang sudah ada (diluar records ini): {$maxExisting}\n\n";

$counter = $maxExisting + 1;
$updated = [];

foreach ($skDocs as $sk) {
    $newNomorSk = $prefix . str_pad($counter, 4, '0', STR_PAD_LEFT);
    
    $sk->update([
        'status'   => 'pending',
        'nomor_sk' => $newNomorSk,
        'file_url' => null,
        'qr_code'  => null,
    ]);
    
    $updated[] = [
        'nama'        => $sk->nama,
        'old_nomor'   => $sk->nomor_sk,
        'new_nomor'   => $newNomorSk,
    ];
    
    echo "  ✅ [{$sk->id}] {$sk->nama}\n";
    echo "     Nomor SK: {$sk->nomor_sk} → {$newNomorSk}\n";
    echo "     Status: approved → pending\n\n";
    
    $counter++;
}

echo "✅ Selesai! {$skDocs->count()} SK dokumen berhasil di-reset ke status pending.\n";
echo "   Nomor SK baru menggunakan format REQ/2026/XXXX.\n";
echo "   Saat generate SK ulang nanti, nomor akan otomatis mulai dari 0001.\n";
