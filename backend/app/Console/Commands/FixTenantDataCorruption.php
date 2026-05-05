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

        // Step 1: Find all schools with their NSM
        $this->info("\n=== Step 1: Finding schools ===");
        $alMadinah = School::where('nama', 'ilike', '%Al Madinah%')
            ->where('nama', 'ilike', '%Kroya%')
            ->first();

        if (!$alMadinah) {
            $this->error('MA Al Madinah Kroya not found!');
            return 1;
        }

        $this->info("Found: MA Al Madinah Kroya (ID: {$alMadinah->id}, NSM: {$alMadinah->nsm})");

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

        // Fix MA Al Madinah Kroya user (NSM stored in email column)
        $alMadinahUser = User::where('email', '131233010035@simmaci.com')->first();
        if ($alMadinahUser) {
            $oldSchoolId = $alMadinahUser->school_id;
            $alMadinahUser->update(['school_id' => $alMadinah->id]);
            $this->info("✓ Updated user 'MA Al Madinah Kroya': school_id {$oldSchoolId} → {$alMadinah->id}");
        } else {
            $this->warn("User with NSM 131233010035 not found");
        }

        // Verify MI Nurul Huda Serang user (NSM stored in email column)
        $miNurulHudaUser = User::where('email', '111233010130@simmaci.com')->first();
        if ($miNurulHudaUser) {
            if ($miNurulHudaUser->school_id === $miNurulHuda->id) {
                $this->info("✓ User 'MI Nurul Huda Serang' already correct (school_id: {$miNurulHuda->id})");
            } else {
                $oldSchoolId = $miNurulHudaUser->school_id;
                $miNurulHudaUser->update(['school_id' => $miNurulHuda->id]);
                $this->info("✓ Updated user 'MI Nurul Huda Serang': school_id {$oldSchoolId} → {$miNurulHuda->id}");
            }
        } else {
            $this->warn("User with NSM 111233010130 not found");
        }

        // Step 3: Find and report corrupt teacher records
        $this->info("\n=== Step 3: Checking for corrupt teacher records ===");

        $corruptTeachers = \App\Models\Teacher::withoutTenantScope()
            ->where(function ($query) use ($alMadinah, $miNurulHuda) {
                // Teachers in Al Madinah school but with unit_kerja from other schools
                $query->where('school_id', $alMadinah->id)
                    ->where('unit_kerja', 'not ilike', '%Al Madinah%')
                    ->whereNotNull('unit_kerja');
            })
            ->orWhere(function ($query) use ($alMadinah, $miNurulHuda) {
                // Teachers in Nurul Huda school but with unit_kerja from other schools
                $query->where('school_id', $miNurulHuda->id)
                    ->where('unit_kerja', 'not ilike', '%Nurul Huda%')
                    ->whereNotNull('unit_kerja');
            })
            ->select('id', 'nama', 'unit_kerja', 'school_id')
            ->get();

        if ($corruptTeachers->count() > 0) {
            $this->warn("Found {$corruptTeachers->count()} corrupt teacher records:");
            foreach ($corruptTeachers as $teacher) {
                $school = School::find($teacher->school_id);
                $this->line("  - ID: {$teacher->id} | Nama: {$teacher->nama} | Unit Kerja: {$teacher->unit_kerja} | School: {$school->nama}");
            }
            $this->warn("\nThese teachers need manual review and correction.");
        } else {
            $this->info("✓ No corrupt teacher records found");
        }

        $this->info("\n=== Fix completed ===");
        return 0;
    }
}
