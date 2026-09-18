<?php

namespace App\Console\Commands;

use App\Models\Competition;
use App\Models\CompetitionParticipant;
use Illuminate\Console\Command;

class CheckFestivalBeregu extends Command
{
    protected $signature = 'competition:check-festival-beregu
                            {--type=all : Tipe lomba beregu (mars_maarif, puji_pujian, film_dokumenter, atau all)}
                            {--details : Tampilkan rincian daftar anggota regu}';

    protected $description = 'Periksa data pendaftar/peserta cabang lomba Festival Aswaja Beregu (Mars Ma\'arif NU, Puji-Pujian Jawa, Film Dokumenter NU)';

    public function handle(): int
    {
        $typeOption = strtolower(trim((string) $this->option('type')));
        $showDetails = (bool) $this->option('details');

        $this->info("================================================================================");
        $this->info("      PEMERIKSAAN DATA PESERTA FESTIVAL ASWAJA (KATEGORI BEREGU)");
        $this->info("================================================================================");

        // Query cabang lomba beregu Festival Aswaja
        $bereguTypes = ['mars_maarif', 'puji_pujian', 'film_dokumenter'];

        $query = Competition::query()->with(['event']);

        if ($typeOption !== 'all' && !empty($typeOption)) {
            $query->where(function ($q) use ($typeOption) {
                $q->where('lomba_type', $typeOption)
                  ->orWhere('name', 'ilike', "%{$typeOption}%");
            });
        } else {
            $query->where(function ($q) use ($bereguTypes) {
                $q->whereIn('lomba_type', $bereguTypes)
                  ->orWhere('type', 'Beregu')
                  ->orWhere('type', 'Group')
                  ->orWhere('name', 'ilike', '%mars%')
                  ->orWhere('name', 'ilike', '%puji%')
                  ->orWhere('name', 'ilike', '%film%');
            });
        }

        $competitions = $query->orderBy('id')->get();

        if ($competitions->isEmpty()) {
            $this->warn("Cabang lomba Festival Aswaja Beregu belum ditemukan di database.");
            $this->line("Catatan: Jika database lokal belum disinkronkan dari server produksi, jalankan script ini di container server VPS.");
            return 0;
        }

        $totalAllParticipants = 0;

        foreach ($competitions as $comp) {
            $this->line("");
            $this->info("--------------------------------------------------------------------------------");
            $this->info(sprintf("CABANG LOMBA: [ID: %d] %s", $comp->id, $comp->name));
            $this->line(sprintf("  Tipe: %s | Lomba Type: %s | Jenjang: %s | Status: %s", 
                $comp->type ?? 'Beregu', 
                $comp->lomba_type ?? '-', 
                $comp->jenjang ?? 'Semua', 
                $comp->status ?? '-'
            ));

            $participants = CompetitionParticipant::where('competition_id', $comp->id)
                ->with(['result', 'school'])
                ->orderBy('id')
                ->get();

            $pCount = $participants->count();
            $totalAllParticipants += $pCount;

            $this->line("  Total Peserta Terdaftar: <comment>{$pCount}</comment>");

            if ($pCount === 0) {
                $this->line("  <fg=yellow>(Belum ada pendaftar untuk cabang lomba ini)</>");
                continue;
            }

            $tableHeaders = ['No', 'ID', 'Nama Regu / Grup', 'Nama Pendaftar', 'Madrasah / Lembaga', 'Jenjang', 'Jml Anggota', 'Status Reg', 'Skor', 'Peringkat'];
            $tableRows = [];

            foreach ($participants as $idx => $p) {
                $score = $p->result?->score !== null ? number_format((float) $p->result->score, 2) : '-';
                $rank = $p->result?->rank !== null ? 'Juara ' . $p->result->rank : '-';

                $tableRows[] = [
                    $idx + 1,
                    $p->id,
                    $p->group_name ?: ($p->name ?: '-'),
                    $p->name ?: '-',
                    $p->institution ?: ($p->school?->name ?: '-'),
                    $p->jenjang ?: '-',
                    $p->member_count ?: (is_array($p->members) ? count($p->members) : '-'),
                    $p->registration_status ?: 'submitted',
                    $score,
                    $rank,
                ];
            }

            $this->table($tableHeaders, $tableRows);

            if ($showDetails) {
                $this->line("");
                $this->line("  <fg=cyan>📋 Rincian Nama Anggota Peserta Tiap Regu:</>");
                foreach ($participants as $p) {
                    $rawMembers = $p->members;
                    if (is_string($rawMembers)) {
                        $rawMembers = json_decode($rawMembers, true) ?? [];
                    }
                    $members = is_array($rawMembers) ? $rawMembers : [];
                    $reguTitle = $p->group_name ? "Regu: {$p->group_name}" : "Grup/Perwakilan: {$p->name}";
                    $this->line("    ┌─ [ID: {$p->id}] <comment>{$reguTitle}</comment> | {$p->institution} (Jenjang: {$p->jenjang})");
                    $this->line("    │  Kontak Pendaftar: {$p->name} | HP: " . ($p->contact_phone ?: '-'));
                    if (!empty($members)) {
                        $this->line("    │  Daftar Anggota (" . count($members) . " orang):");
                        foreach ($members as $mIdx => $m) {
                            $mName = is_array($m) ? ($m['name'] ?? '-') : (is_object($m) ? ($m->name ?? '-') : (string) $m);
                            $mNim = is_array($m) ? ($m['nim'] ?? $m['class'] ?? '') : '';
                            $mRole = is_array($m) ? ($m['role'] ?? '') : '';
                            $extraInfo = [];
                            if ($mNim) $extraInfo[] = "NIM/Kelas: {$mNim}";
                            if ($mRole) $extraInfo[] = "Peran: {$mRole}";
                            $extraStr = !empty($extraInfo) ? " [" . implode(', ', $extraInfo) . "]" : "";
                            $this->line("    │    " . ($mIdx + 1) . ". <info>{$mName}</info>{$extraStr}");
                        }
                    } else {
                        $this->line("    │  (Daftar nama rincian anggota kosong/belum diinput secara terperinci)");
                    }
                    $this->line("    └──────────────────────────────────────────────────────────");
                }
            } else {
                $this->line("  <fg=gray>💡 Tambahkan argumen --details untuk melihat daftar nama lengkap anggota masing-masing regu.</>");
            }
        }

        $this->line("");
        $this->info("================================================================================");
        $this->info("TOTAL KESELURUHAN PESERTA FESTIVAL BEREGU: {$totalAllParticipants} Regu/Peserta");
        $this->info("================================================================================");

        return 0;
    }
}
