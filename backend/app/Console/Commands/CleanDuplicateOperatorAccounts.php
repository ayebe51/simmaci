<?php

namespace App\Console\Commands;

use App\Models\School;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CleanDuplicateOperatorAccounts extends Command
{
    protected $signature = 'operators:clean-duplicates
                            {--dry-run : Tampilkan duplikat tanpa menghapus}
                            {--school= : Filter berdasarkan school_id tertentu}';

    protected $description = 'Hapus akun operator duplikat per sekolah. Pertahankan akun terlama, sinkronkan email/password dengan NSM terkini.';

    public function handle(): int
    {
        $isDryRun  = $this->option('dry-run');
        $schoolFilter = $this->option('school');

        if ($isDryRun) {
            $this->info('🔍 DRY RUN — tidak ada data yang dihapus.');
        } else {
            if (! $this->confirm('⚠️  Ini akan MENGHAPUS akun operator duplikat secara permanen. Lanjutkan?')) {
                return self::FAILURE;
            }
        }

        // Cari school_id yang memiliki lebih dari 1 user operator aktif
        $query = DB::table('users')
            ->select('school_id', DB::raw('COUNT(*) as cnt'))
            ->where('role', 'operator')
            ->whereNotNull('school_id');

        if ($schoolFilter) {
            $query->where('school_id', $schoolFilter);
        }

        $duplicateSchools = $query
            ->groupBy('school_id')
            ->having(DB::raw('COUNT(*)'), '>', 1)
            ->orderByDesc('cnt')
            ->get();

        if ($duplicateSchools->isEmpty()) {
            $this->info('✅ Tidak ditemukan akun operator duplikat.');
            return self::SUCCESS;
        }

        $this->warn("Ditemukan {$duplicateSchools->count()} sekolah dengan akun operator duplikat:");
        $this->newLine();

        $totalDeleted  = 0;
        $totalUpdated  = 0;

        foreach ($duplicateSchools as $row) {
            $school = School::find($row->school_id);
            $schoolName = $school?->nama ?? "School ID {$row->school_id}";

            // Hitung email & password yang seharusnya (dari NSM terkini)
            $nsm           = $school && $school->nsm ? strtolower(trim($school->nsm)) : null;
            $correctEmail  = $nsm
                ? "{$nsm}@simmaci.com"
                : ('school' . $row->school_id . '@simmaci.com');
            $correctPass   = ($school && $school->nsm) ? $school->nsm : ('school' . $row->school_id);

            // Ambil semua akun operator untuk sekolah ini, urutkan dari terlama
            $operators = User::where('school_id', $row->school_id)
                ->where('role', 'operator')
                ->orderBy('id')   // terlama = id terkecil
                ->get();

            $keep     = $operators->first();
            $toDelete = $operators->slice(1);

            $this->line("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            $this->info("Sekolah : {$schoolName} (ID: {$row->school_id})");
            $this->info("NSM terkini : " . ($school?->nsm ?? '-'));
            $this->line("  ✅ PERTAHANKAN: ID={$keep->id} | email={$keep->email} | created_at={$keep->created_at}");

            // Sinkronkan email & password akun yang dipertahankan jika berbeda
            $needsSync = ($keep->email !== $correctEmail);
            if ($needsSync) {
                $this->line("  🔄 SINKRONKAN email: {$keep->email} → {$correctEmail}");
                if (! $isDryRun) {
                    $keep->update([
                        'name'     => $school?->nama ?? $keep->name,
                        'email'    => $correctEmail,
                        'password' => $correctPass,
                    ]);
                    $totalUpdated++;
                }
            }

            foreach ($toDelete as $dup) {
                $this->line("  ❌ HAPUS: ID={$dup->id} | email={$dup->email} | created_at={$dup->created_at}");
                if (! $isDryRun) {
                    // Cabut semua token Sanctum sebelum hapus
                    $dup->tokens()->delete();
                    $dup->delete();
                    $totalDeleted++;
                }
            }
        }

        $this->newLine();
        $this->line("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        if ($isDryRun) {
            $this->warn('📋 Dry run selesai. Jalankan tanpa --dry-run untuk menerapkan perubahan.');
        } else {
            $this->info("🗑️  Dihapus  : {$totalDeleted} akun duplikat.");
            $this->info("🔄 Disinkron: {$totalUpdated} akun email/password.");
        }

        return self::SUCCESS;
    }
}
