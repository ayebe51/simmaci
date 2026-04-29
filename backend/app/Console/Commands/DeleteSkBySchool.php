<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\SkDocument;
use App\Models\School;

class DeleteSkBySchool extends Command
{
    protected $signature = 'sk:delete-by-school
                            {school_name : Nama sekolah (partial match)}
                            {--dry-run : Tampilkan data yang akan dihapus tanpa menghapus}';

    protected $description = 'Permanent delete SK documents (pending & approved) dari sekolah tertentu';

    public function handle(): int
    {
        $schoolName = $this->argument('school_name');
        $isDryRun = $this->option('dry-run');

        // Find school
        $school = School::where('nama', 'like', "%{$schoolName}%")->first();

        if (!$school) {
            $this->error("Sekolah dengan nama \"{$schoolName}\" tidak ditemukan.");
            return 1;
        }

        $this->info("Sekolah ditemukan: [{$school->id}] {$school->nama}");
        $this->newLine();

        // Query — withTrashed agar soft-deleted juga ikut dihapus permanen
        $pendingQuery = SkDocument::withTrashed()
            ->where('school_id', $school->id)
            ->where('status', 'pending');

        $approvedQuery = SkDocument::withTrashed()
            ->where('school_id', $school->id)
            ->where('status', 'approved');

        $pendingCount  = $pendingQuery->count();
        $approvedCount = $approvedQuery->count();
        $totalCount    = $pendingCount + $approvedCount;

        // Preview table
        $this->table(
            ['Status', 'Jumlah Data'],
            [
                ['pending (menunggu)',  $pendingCount],
                ['approved (generated)', $approvedCount],
                ['TOTAL', $totalCount],
            ]
        );

        if ($isDryRun) {
            $this->newLine();
            $this->warn('DRY RUN — tidak ada data yang dihapus.');
            $this->warn('Jalankan tanpa --dry-run untuk eksekusi permanent delete.');

            // Show sample rows
            $samples = SkDocument::withTrashed()
                ->where('school_id', $school->id)
                ->whereIn('status', ['pending', 'approved'])
                ->select('id', 'nama', 'status', 'nomor_sk', 'created_at')
                ->orderByDesc('id')
                ->limit(10)
                ->get();

            if ($samples->isNotEmpty()) {
                $this->newLine();
                $this->info('Sample 10 data terakhir:');
                $this->table(
                    ['ID', 'Nama', 'Status', 'Nomor SK', 'Created At'],
                    $samples->map(fn($r) => [
                        $r->id,
                        $r->nama,
                        $r->status,
                        $r->nomor_sk ?? '-',
                        $r->created_at,
                    ])->toArray()
                );
            }

            return 0;
        }

        // Confirm before delete
        if (!$this->confirm("Hapus PERMANEN {$totalCount} data SK dari \"{$school->nama}\"? Ini tidak bisa di-undo!")) {
            $this->info('Dibatalkan.');
            return 0;
        }

        $deletedPending  = (clone $pendingQuery)->forceDelete();
        $deletedApproved = (clone $approvedQuery)->forceDelete();

        $this->newLine();
        $this->info("✅ Selesai. Dihapus permanen:");
        $this->line("   - pending  : {$deletedPending} data");
        $this->line("   - approved : {$deletedApproved} data");

        return 0;
    }
}
