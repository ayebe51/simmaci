<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SyncSkUnitKerja extends Command
{
    protected $signature = 'sk:sync-unit-kerja';

    protected $description = 'Sinkronkan kolom unit_kerja di sk_documents dengan nama resmi sekolah dari tabel schools berdasarkan school_id';

    public function handle()
    {
        $this->info('Memulai sinkronisasi unit_kerja di pengajuan SK dengan nama resmi sekolah...');

        // Get all sk_documents that have a school_id linked
        $rows = DB::table('sk_documents as sk')
            ->join('schools as s', 'sk.school_id', '=', 's.id')
            ->whereNotNull('sk.school_id')
            ->whereNull('sk.deleted_at')
            ->where(function ($q) {
                // Only update if unit_kerja is different from the official school name
                $q->whereNull('sk.unit_kerja')
                  ->orWhere('sk.unit_kerja', '')
                  ->orWhereRaw('LOWER(TRIM(sk.unit_kerja)) <> LOWER(TRIM(s.nama))');
            })
            ->select('sk.id', 'sk.unit_kerja as lama', 's.nama as nama_resmi')
            ->get();

        $updatedCount = 0;

        foreach ($rows as $row) {
            DB::table('sk_documents')
                ->where('id', $row->id)
                ->update(['unit_kerja' => $row->nama_resmi]);

            $updatedCount++;
            $this->line("- ID {$row->id}: \"{$row->lama}\" → \"{$row->nama_resmi}\"");
        }

        $this->info('');
        $this->info('✅ SELESAI!');
        $this->info("Total sk_documents yang unit_kerja-nya berhasil diperbarui: {$updatedCount}");
    }
}
