<?php

namespace App\Console\Commands;

use App\Models\School;
use Illuminate\Console\Command;

class NormalizeSchoolNames extends Command
{
    protected $signature = 'schools:normalize-names {--dry-run : Preview changes without saving}';
    protected $description = 'Normalize school names: fix prefix casing (MTs, MI, MA, SMK) and convert ALL CAPS to Title Case';

    // Kata yang harus tetap uppercase
    private const KEEP_UPPER = ['MI', 'MTs', 'MA', 'SMK', 'SD', 'SMP', 'SMA', 'NU', 'LP', 'PGRI'];

    // Kata yang harus tetap lowercase (kata sambung)
    private const KEEP_LOWER = ['dan', 'di', 'ke', 'dari', 'yang', 'untuk', 'dengan', 'al', 'bin', 'binti'];

    public function handle(): int
    {
        $isDryRun = $this->option('dry-run');
        $schools  = School::all();
        $changed  = 0;

        foreach ($schools as $school) {
            $original    = $school->nama;
            $normalized  = $this->normalizeName($original);

            if ($original === $normalized) {
                continue;
            }

            $this->line(sprintf(
                "  <fg=yellow>BEFORE:</> %s\n  <fg=green>AFTER: </> %s\n",
                $original,
                $normalized
            ));

            if (! $isDryRun) {
                $school->update(['nama' => $normalized]);
            }

            $changed++;
        }

        $mode = $isDryRun ? '<fg=cyan>[DRY RUN]</>' : '<fg=green>[SAVED]</>';
        $this->info("\n{$mode} {$changed} nama sekolah " . ($isDryRun ? 'akan diubah' : 'berhasil diubah') . " dari {$schools->count()} total.");

        return self::SUCCESS;
    }

    private function normalizeName(string $name): string
    {
        // Step 1: Normalize prefix variants
        // MTsS, MTSS, MTS → MTs (case-insensitive, at start of string)
        $name = preg_replace('/^(MTsS|MTSS|MTS)\s+/i', 'MTs ', $name);

        // MIS, Mis, Mi → MI
        $name = preg_replace('/^(MIS|Mis|Mi)\s+/i', 'MI ', $name);

        // MAS, Mas → MA
        $name = preg_replace('/^(MAS|Mas)\s+/i', 'MA ', $name);

        // Step 2: Convert to Title Case word by word
        $words  = explode(' ', $name);
        $result = [];

        foreach ($words as $i => $word) {
            if (empty($word)) continue;

            $upper = strtoupper($word);
            $lower = strtolower($word);

            // Keep known acronyms uppercase
            if (in_array($upper, self::KEEP_UPPER, true)) {
                $result[] = $upper;
                continue;
            }

            // Keep MTs specifically (mixed case acronym)
            if (strtolower($word) === 'mts') {
                $result[] = 'MTs';
                continue;
            }

            // Keep conjunctions lowercase (except first word)
            if ($i > 0 && in_array($lower, self::KEEP_LOWER, true)) {
                $result[] = $lower;
                continue;
            }

            // Handle apostrophe words: MA'ARIF → Ma'arif, NU'MAN → Nu'man
            if (str_contains($word, "'") || str_contains($word, "'")) {
                $result[] = $this->titleCaseWithApostrophe($word);
                continue;
            }

            // Standard title case
            $result[] = ucfirst($lower);
        }

        return implode(' ', $result);
    }

    private function titleCaseWithApostrophe(string $word): string
    {
        // Split on apostrophe, title-case each part, rejoin
        $parts = preg_split("/(['''])/u", $word, -1, PREG_SPLIT_DELIM_CAPTURE);
        $out   = [];
        foreach ($parts as $i => $part) {
            if (in_array($part, ["'", "'", "'"], true)) {
                $out[] = $part;
            } else {
                $out[] = $i === 0 ? ucfirst(strtolower($part)) : strtolower($part);
            }
        }
        return implode('', $out);
    }
}
