<?php

namespace App\Console\Commands;

use App\Models\School;
use App\Models\User;
use Illuminate\Console\Command;

class FixTenantDataCorruption extends Command
{
    protected $signature = 'fix:tenant-corruption';
    protected $description = 'Fix tenant data corruption - align user school_id with correct schools';

    public function handle()
    {
        $this->info('Starting tenant data corruption fix...');

        // Step 1: Find all schools
        $this->info("\n=== Step 1: Finding schools ===");
        
        // Find MA Al Madinah Kroya (exclude MTs Plus)
        $alMadinah = School::where('nama', 'ilike', '%MA Al Madinah%')
            ->where('nama', 'not ilike', '%MTs%')
            ->first();

        if (!$alMadinah) {
            $this->error('MA Al Madinah Kroya not found!');
            return 1;
        }

        $this->info("Found: MA Al Madinah Kroya (ID: {$alMadinah->id}, NSM: {$alMadinah->nsm})");

        // Find MTs Plus Al Madinah Kroya
        $mtsAlMadinah = School::where('nama', 'ilike', '%MTs Plus Al Madinah%')->first();

        if (!$mtsAlMadinah) {
            $this->error('MTs Plus Al Madinah Kroya not found!');
            return 1;
        }

        $this->info("Found: MTs Plus Al Madinah Kroya (ID: {$mtsAlMadinah->id}, NSM: {$mtsAlMadinah->nsm})");

        // Find MI Nurul Huda Serang
        $miNurulHuda = School::where('nama', 'ilike', '%Nurul Huda%')
            ->where('nama', 'ilike', '%Serang%')
            ->first();

        if (!$miNurulHuda) {
            $this->error('MI Nurul Huda Serang not found!');
            return 1;
        }

        $this->info("Found: MI Nurul Huda Serang (ID: {$miNurulHuda->id}, NSM: {$miNurulHuda->nsm})");

        // Step 2: Fix user accounts
        $this->info("\n=== Step 2: Fixing user accounts ===");

        // Find correct schools first
        $maAlMadinah = School::where('nama', 'ilike', '%MA Al Madinah%')->where('nama', 'not ilike', '%MTs%')->first();
        $mtsAlMadinah = School::where('nama', 'ilike', '%MTs Plus Al Madinah%')->first();

        if (!$maAlMadinah) {
            $this->error('MA Al Madinah Kroya not found!');
            return 1;
        }

        if (!$mtsAlMadinah) {
            $this->error('MTs Plus Al Madinah Kroya not found!');
            return 1;
        }

        $this->info("Correct schools identified:");
        $this->info("  - MA Al Madinah Kroya: ID={$maAlMadinah->id}, NSM={$maAlMadinah->nsm}");
        $this->info("  - MTs Plus Al Madinah Kroya: ID={$mtsAlMadinah->id}, NSM={$mtsAlMadinah->nsm}");

        // Fix MA Al Madinah Kroya user (NSM stored in email column)
        $alMadinahUser = User::where('email', '131233010035@simmaci.com')->first();
        if ($alMadinahUser) {
            $oldSchoolId = $alMadinahUser->school_id;
            $alMadinahUser->update(['school_id' => $maAlMadinah->id]);
            $this->info("✓ Updated user 'MA Al Madinah Kroya': school_id {$oldSchoolId} → {$maAlMadinah->id}");
        } else {
            $this->warn("User with NSM 131233010035 not found");
        }

        // Verify MTs Plus Al Madinah Kroya user (NSM stored in email column)
        $mtsUser = User::where('email', '121233010067@simmaci.com')->first();
        if ($mtsUser) {
            if ($mtsUser->school_id === $mtsAlMadinah->id) {
                $this->info("✓ User 'MTs Plus Al Madinah Kroya' already correct (school_id: {$mtsAlMadinah->id})");
            } else {
                $oldSchoolId = $mtsUser->school_id;
                $mtsUser->update(['school_id' => $mtsAlMadinah->id]);
                $this->info("✓ Updated user 'MTs Plus Al Madinah Kroya': school_id {$oldSchoolId} → {$mtsAlMadinah->id}");
            }
        } else {
            $this->warn("User with NSM 121233010067 not found");
        }

        // Update references for Step 3
        $alMadinah = $maAlMadinah;
        $miNurulHuda = $mtsAlMadinah;

        // Step 3: Find and auto-fix corrupt teacher records
        $this->info("\n=== Step 3: Checking for corrupt teacher records ===");

        // Find teachers with unit_kerja = "MA Al Madinah Kroya" but school_id != 187
        $alMadinahTeachers = \App\Models\Teacher::withoutTenantScope()
            ->where('school_id', '!=', $alMadinah->id)
            ->where('unit_kerja', 'ilike', '%Al Madinah%')
            ->whereNotNull('unit_kerja')
            ->select('id', 'nama', 'unit_kerja', 'school_id')
            ->get();

        if ($alMadinahTeachers->count() > 0) {
            $this->info("Found {$alMadinahTeachers->count()} teachers with unit_kerja='MA Al Madinah Kroya' but wrong school_id:");
            foreach ($alMadinahTeachers as $teacher) {
                $oldSchoolId = $teacher->school_id;
                $teacher->update(['school_id' => $alMadinah->id]);
                $this->line("  ✓ Fixed ID: {$teacher->id} | Nama: {$teacher->nama} | school_id: {$oldSchoolId} → {$alMadinah->id}");
            }
        }

        // Find teachers with unit_kerja = "MTs Plus Al Madinah" but school_id != 144
        $mtsTeachers = \App\Models\Teacher::withoutTenantScope()
            ->where('school_id', '!=', $miNurulHuda->id)
            ->where('unit_kerja', 'ilike', '%MTs Plus%')
            ->whereNotNull('unit_kerja')
            ->select('id', 'nama', 'unit_kerja', 'school_id')
            ->get();

        if ($mtsTeachers->count() > 0) {
            $this->info("Found {$mtsTeachers->count()} teachers with unit_kerja='MTs Plus Al Madinah' but wrong school_id:");
            foreach ($mtsTeachers as $teacher) {
                $oldSchoolId = $teacher->school_id;
                $teacher->update(['school_id' => $miNurulHuda->id]);
                $this->line("  ✓ Fixed ID: {$teacher->id} | Nama: {$teacher->nama} | school_id: {$oldSchoolId} → {$miNurulHuda->id}");
            }
        }

        // Find other corrupt teachers that need manual review
        $otherCorruptTeachers = \App\Models\Teacher::withoutTenantScope()
            ->where('unit_kerja', 'not ilike', '%Al Madinah%')
            ->where('unit_kerja', 'not ilike', '%MTs Plus%')
            ->where('unit_kerja', 'not ilike', '%Nurul Huda%')
            ->whereNotNull('unit_kerja')
            ->select('id', 'nama', 'unit_kerja', 'school_id')
            ->get();

        if ($otherCorruptTeachers->count() > 0) {
            $this->warn("\nFound {$otherCorruptTeachers->count()} other corrupt teacher records that need manual review:");
            foreach ($otherCorruptTeachers as $teacher) {
                $school = School::find($teacher->school_id);
                $this->line("  - ID: {$teacher->id} | Nama: {$teacher->nama} | Unit Kerja: {$teacher->unit_kerja} | School: {$school->nama}");
            }
            $this->warn("\nThese teachers need manual review and correction.");
        } else {
            $this->info("✓ No other corrupt teacher records found");
        }

        $this->info("\n=== Fix completed ===");
        return 0;
    }
}
