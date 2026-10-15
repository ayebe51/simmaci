<?php

namespace App\Console\Commands;

use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class InspectTeacherLinkage extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'teachers:inspect-linkage
                            {--name=SENTOT,ISNA : Nama guru yang ingin dicek (pisahkan dengan koma)}
                            {--school=Kalisabuk : Filter sekolah (opsional)}
                            {--relink           : Tautkan ulang SK dari guru terhapus ke guru aktif yang cocok}
                            {--dry-run          : Simulasi relink tanpa mengubah database}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Investigasi duplikasi data guru dan relasi dokumen SK (termasuk guru aktif vs terhapus)';

    public function handle(): int
    {
        $nameInput  = $this->option('name') ?: 'SENTOT,ISNA';
        $schoolFilter = $this->option('school') ?: 'Kalisabuk';
        $doRelink   = (bool) $this->option('relink');
        $isDryRun   = (bool) $this->option('dry-run');

        $names = array_filter(array_map('trim', explode(',', $nameInput)));

        $this->newLine();
        $this->line('<fg=cyan;options=bold>╔════════════════════════════════════════════════════════════════════════╗</>');
        $this->line('<fg=cyan;options=bold>║   INVESTIGASI DUPLIKASI GURU & RELINK DOKUMEN SK (SIMMACI)           ║</>');
        $this->line('<fg=cyan;options=bold>╚════════════════════════════════════════════════════════════════════════╝</>');
        $this->newLine();

        $relinkPlan = [];

        foreach ($names as $nameKeyword) {
            $lowerKey = strtolower($nameKeyword);

            $this->line("<fg=yellow;options=bold>🔎 Mencari data untuk guru: \"{$nameKeyword}\"...</>");

            // Cari semua record guru (aktif dan terhapus)
            $teachers = Teacher::withoutTenantScope()
                ->withTrashed()
                ->where(function ($q) use ($lowerKey) {
                    $q->whereRaw('LOWER(nama) LIKE ?', ["%{$lowerKey}%"]);
                })
                ->get();

            if ($teachers->isEmpty()) {
                $this->warn("  Tidak ditemukan guru dengan nama '{$nameKeyword}'.");
                $this->newLine();
                continue;
            }

            $this->info("  Ditemukan " . $teachers->count() . " record di database:");

            $activeRecords = $teachers->whereNull('deleted_at');
            $deletedRecords = $teachers->whereNotNull('deleted_at');

            $tableRows = [];
            foreach ($teachers as $t) {
                // Ambil SK yang berelasi dengan teacher_id ini
                $sks = SkDocument::withoutTenantScope()
                    ->withTrashed()
                    ->where('teacher_id', $t->id)
                    ->get();

                $skSummary = $sks->isEmpty()
                    ? '<fg=gray>Tidak ada SK</>'
                    : $sks->map(function ($sk) {
                        $deletedTag = $sk->deleted_at ? ' (SK Deleted)' : '';
                        return "#{$sk->id} ({$sk->nomor_sk}) [{$sk->status}]{$deletedTag}";
                    })->implode("\n");

                $statusLabel = $t->deleted_at
                    ? "<fg=red;options=bold>TERHAPUS</>\n({$t->deleted_at})"
                    : "<fg=green;options=bold>AKTIF</>";

                $tableRows[] = [
                    $t->id,
                    $t->nama,
                    $statusLabel,
                    $t->nuptk ?: '-',
                    $t->nomor_induk_maarif ?: '-',
                    $t->school_id ?: '<fg=yellow>NULL</>',
                    $t->unit_kerja ?: '-',
                    $skSummary,
                ];
            }

            $this->table(
                ['ID Guru', 'Nama Guru', 'Status', 'NUPTK', 'NIM', 'School ID', 'Unit Kerja', 'Dokumen SK Tertaut'],
                $tableRows
            );

            // Analisis Masalah
            if ($activeRecords->isNotEmpty() && $deletedRecords->isNotEmpty()) {
                $this->newLine();
                $this->line("  <fg=magenta;options=bold>📋 Analisis Temuan Duplikasi:</>");
                $this->line("  • Ada <fg=green>{$activeRecords->count()} record AKTIF</> dan <fg=red>{$deletedRecords->count()} record TERHAPUS</>.");

                // Cek apakah ada SK di record yang terhapus
                foreach ($deletedRecords as $del) {
                    $sksOnDeleted = SkDocument::withoutTenantScope()->withTrashed()->where('teacher_id', $del->id)->get();

                    if ($sksOnDeleted->isNotEmpty()) {
                        // Tentukan target guru aktif yang paling cocok
                        $targetActive = $activeRecords->first();

                        $this->line("  • <fg=red;options=bold>MASALAH TERKONFIRMASI:</> Record terhapus (ID: {$del->id}) memiliki " . $sksOnDeleted->count() . " SK resmi,");
                        $this->line("    sementara Record AKTIF (ID: {$targetActive->id}) yang tampil di sistem belum terhubung ke SK tersebut!");

                        foreach ($sksOnDeleted as $sk) {
                            $relinkPlan[] = [
                                'sk'            => $sk,
                                'deleted_teacher'=> $del,
                                'target_teacher'=> $targetActive,
                            ];
                        }
                    }
                }
            } elseif ($deletedRecords->isNotEmpty() && $activeRecords->isEmpty()) {
                $this->newLine();
                $this->warn("  ⚠️ Guru ini HANYA ada di record terhapus (tidak ada record aktif sama sekali).");
                $this->line("  Solusi: Gunakan perintah `php artisan teachers:check-deleted-sk --restore` untuk mengembalikannya.");
            } else {
                $this->newLine();
                $this->info("  ✅ Data normal. Hanya ada record aktif.");
            }

            $this->newLine();
        }

        // Eksekusi Relink
        if (! empty($relinkPlan)) {
            $this->line('<fg=cyan;options=bold>════════════════════════════════════════════════════════════════════════</>');
            $this->line('<fg=cyan;options=bold>  RENCANA PERBAIKAN / PENAUTAN ULANG SK (RELINK)                        </>');
            $this->line('<fg=cyan;options=bold>════════════════════════════════════════════════════════════════════════</>');

            foreach ($relinkPlan as $item) {
                $sk = $item['sk'];
                $del = $item['deleted_teacher'];
                $active = $item['target_teacher'];

                $this->line("  • SK ID #<fg=white;options=bold>{$sk->id}</> ({$sk->nomor_sk})");
                $this->line("    Pindahkan dari Teacher ID [{$del->id}] ({$del->nama} - <fg=red>TERHAPUS</>)");
                $this->line("    Ke Teacher ID         [{$active->id}] ({$active->nama} - <fg=green>AKTIF</>)");
                $this->newLine();
            }

            if ($doRelink) {
                if ($isDryRun) {
                    $this->warn('🔍 MODE SIMULASI (DRY-RUN): Tidak ada perubahan yang disimpan ke database.');
                } else {
                    if (! $this->confirm("Apakah Anda yakin ingin memindahkan " . count($relinkPlan) . " dokumen SK ke Guru yang AKTIF?", false)) {
                        $this->info("Operasi dibatalkan.");
                        return self::SUCCESS;
                    }
                }

                $relinkedCount = 0;
                foreach ($relinkPlan as $item) {
                    $sk = $item['sk'];
                    $active = $item['target_teacher'];
                    $del = $item['deleted_teacher'];

                    if (! $isDryRun) {
                        // 1. Update teacher_id pada SK
                        DB::table('sk_documents')
                            ->where('id', $sk->id)
                            ->update([
                                'teacher_id' => $active->id,
                                'school_id'  => $active->school_id ?: $sk->school_id,
                                'updated_at' => now(),
                            ]);

                        // 2. Jika guru aktif belum memiliki NUPTK / NIM tapi di record terhapus ada, migrasikan data
                        $fieldsToMerge = ['nuptk', 'nomor_induk_maarif', 'nip', 'tmt', 'tempat_lahir', 'tanggal_lahir'];
                        $updates = [];
                        foreach ($fieldsToMerge as $field) {
                            if (empty($active->$field) && ! empty($del->$field)) {
                                $updates[$field] = $del->$field;
                            }
                        }
                        if (! empty($updates)) {
                            DB::table('teachers')->where('id', $active->id)->update($updates);
                        }
                    }

                    $prefix = $isDryRun ? '[DRY-RUN] ' : '✓ ';
                    $this->line("  {$prefix}SK #{$sk->id} berhasil ditautkan ke Guru Aktif ID #{$active->id} ({$active->nama})");
                    $relinkedCount++;
                }

                $verb = $isDryRun ? 'dapat dipindahkan' : 'berhasil dipindahkan';
                $this->newLine();
                $this->info("🎉 Selesai: {$relinkedCount} dokumen SK {$verb} ke guru yang aktif!");
                $this->info("Sekarang dokumen SK akan muncul dengan benar di halaman Data GTK untuk guru aktif tersebut.");
            } else {
                $this->comment("💡 Cara memperbaiki / memindahkan SK ke Guru Aktif secara otomatis:");
                $this->line("   <fg=white>php artisan teachers:inspect-linkage --name=\"{$nameInput}\" --relink --dry-run</> (uji simulasi)");
                $this->line("   <fg=white>php artisan teachers:inspect-linkage --name=\"{$nameInput}\" --relink</> (terapkan permanen)");
            }

            $this->newLine();
        }

        return self::SUCCESS;
    }
}
