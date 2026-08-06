<?php

namespace App\Console\Commands;

use App\Models\HeadmasterTenure;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AnalyzeHeadmasterTenures extends Command
{
    protected $signature = 'headmaster:analyze
                            {--name= : Filter berdasarkan nama guru (partial match)}
                            {--purge : Hapus semua record yang cocok (forceDelete)}
                            {--dry-run : Tampilkan saja tanpa hapus}';

    protected $description = 'Analisa dan/atau hapus record headmaster_tenures di database';

    public function handle(): int
    {
        $name     = $this->option('name');
        $purge    = $this->option('purge');
        $isDryRun = $this->option('dry-run') || ! $purge;

        // ── Query: semua record termasuk soft-deleted ──────────────────
        $query = HeadmasterTenure::withoutTenantScope()->withTrashed();

        if ($name) {
            $query->where('teacher_name', 'like', "%{$name}%");
        }

        $records = $query->orderBy('id')->get([
            'id', 'teacher_name', 'school_name', 'periode',
            'status', 'deleted_at', 'created_at',
        ]);

        if ($records->isEmpty()) {
            $this->info('Tidak ditemukan record' . ($name ? " dengan nama \"{$name}\"" : '') . '.');
            return self::SUCCESS;
        }

        $this->info("Ditemukan {$records->count()} record" . ($name ? " untuk \"{$name}\"" : '') . ':');
        $this->newLine();

        $headers = ['ID', 'Nama Guru', 'Sekolah', 'Periode', 'Status', 'Deleted At', 'Created At'];
        $rows    = $records->map(fn($r) => [
            $r->id,
            $r->teacher_name,
            $r->school_name,
            $r->periode,
            $r->status,
            $r->deleted_at ?? '-',
            $r->created_at,
        ])->toArray();

        $this->table($headers, $rows);
        $this->newLine();

        // ── Ringkasan duplikat ─────────────────────────────────────────
        $active = $records->whereNull('deleted_at')->count();
        $deleted = $records->whereNotNull('deleted_at')->count();
        $this->line("Active (deleted_at NULL): {$active}");
        $this->line("Soft-deleted            : {$deleted}");
        $this->newLine();

        if (! $purge) {
            $this->warn('Tambahkan --purge untuk hard-delete semua record di atas.');
            $this->warn('Contoh: php artisan headmaster:analyze --name="KHUSNUL" --purge');
            return self::SUCCESS;
        }

        // ── Purge ──────────────────────────────────────────────────────
        if ($isDryRun) {
            $this->warn('[DRY RUN] Tidak ada yang dihapus.');
            return self::SUCCESS;
        }

        if (! $this->confirm("Hapus {$records->count()} record secara permanen?")) {
            return self::FAILURE;
        }

        $deleted = HeadmasterTenure::withoutTenantScope()
            ->withTrashed()
            ->whereIn('id', $records->pluck('id'))
            ->forceDelete();

        $this->info("✅ Berhasil hapus {$deleted} record.");

        return self::SUCCESS;
    }
}
