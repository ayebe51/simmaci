<?php
/**
 * Script rollback SK - MI Ma'arif 04 Gentasari (auto, tanpa konfirmasi)
 * Jalankan via: php artisan tinker --execute="require 'reset_sk_gentasari_auto.php';"
 *
 * Yang dilakukan:
 * 1. Reset status dari 'approved' ke 'pending'
 * 2. Reset nomor_sk ke format REQ/2026/XXXX (berurutan)
 * 3. Clear file_url dan qr_code (hasil generate SK)
 */

use App\Models\SkDocument;
use App\Models\School;

$namaList = [
    "WIVA QURROTA 'AYUNI",
    "KENNY APRILLIA",
    "RENI WAHYUNINGSIH",
    "IKE MACHABAH FARASTUTI",
    "ANIQOTUL MA'RIFAH",
    "OKTAVIA USWATUN KHASANAH",
    "SITI KHOLIFAH",
];

$school = School::where('nama', 'like', '%Gentasari%')->first();
if (!$school) {
    echo "❌ Sekolah MI Ma'arif 04 Gentasari tidak ditemukan!\n";
    School::where('nama', 'like', "%Ma'arif%")->orWhere('nama', 'like', '%Maarif%')->get(['id', 'nama'])
        ->each(fn($s) => print("  - [{$s->id}] {$s->nama}\n"));
    return;
}

echo "✅ Sekolah: [{$school->id}] {$school->nama}\n\n";

$skDocs = SkDocument::withoutTenantScope()
    ->where('school_id', $school->id)
    ->where('status', 'approved')
    ->whereIn(\DB::raw('UPPER(nama)'), array_map('strtoupper', $namaList))
    ->orderBy('id')
    ->get();

if ($skDocs->isEmpty()) {
    echo "⚠️  Tidak ada dengan status 'approved'. Cek semua status...\n";
    $skDocs = SkDocument::withoutTenantScope()
        ->where('school_id', $school->id)
        ->whereIn(\DB::raw('UPPER(nama)'), array_map('strtoupper', $namaList))
        ->orderBy('id')
        ->get();

    if ($skDocs->isEmpty()) {
        echo "❌ Tidak ditemukan sama sekali. Data di sekolah ini:\n";
        SkDocument::withoutTenantScope()
            ->where('school_id', $school->id)
            ->get(['id', 'nama', 'status', 'nomor_sk'])
            ->each(fn($s) => print("  - [{$s->id}] {$s->nama} | {$s->status} | {$s->nomor_sk}\n"));
        return;
    }
}

echo "📋 Records yang ditemukan ({$skDocs->count()}):\n";
foreach ($skDocs as $sk) {
    echo "  - [{$sk->id}] {$sk->nama} | Status: {$sk->status} | Nomor: {$sk->nomor_sk}\n";
}

$year = 2026;
$prefix = "REQ/{$year}/";
$maxExisting = SkDocument::withoutTenantScope()
    ->where('nomor_sk', 'like', $prefix . '%')
    ->whereNotIn('id', $skDocs->pluck('id'))
    ->pluck('nomor_sk')
    ->map(fn($n) => (int) substr($n, strlen($prefix)))
    ->max() ?? 0;

echo "\n🔄 Reset dimulai (nomor REQ tertinggi existing: {$maxExisting})...\n\n";

$counter = $maxExisting + 1;

foreach ($skDocs as $sk) {
    $oldNomor  = $sk->nomor_sk;
    $oldStatus = $sk->status;
    $newNomor  = $prefix . str_pad($counter, 4, '0', STR_PAD_LEFT);

    $sk->update([
        'status'   => 'pending',
        'nomor_sk' => $newNomor,
        'file_url' => null,
        'qr_code'  => null,
    ]);

    echo "  ✅ {$sk->nama}\n";
    echo "     Nomor : {$oldNomor} → {$newNomor}\n";
    echo "     Status: {$oldStatus} → pending\n\n";

    $counter++;
}

echo "✅ Selesai! {$skDocs->count()} SK berhasil di-reset ke status pending.\n";
