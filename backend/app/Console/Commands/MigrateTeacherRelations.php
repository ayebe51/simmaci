<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class MigrateTeacherRelations extends Command
{
    protected $signature = 'teachers:migrate-relations';
    protected $description = 'Migrate relations (SK, dll) dari guru yang ter-soft-delete (karena duplikat) ke guru aktif yang namanya sama.';

    public function handle()
    {
        $this->info("Scanning for relations pointing to soft-deleted teachers...");

        $tables = [
            'sk_documents' => 'teacher_id',
            'headmaster_tenures' => 'teacher_id',
            'nuptk_submissions' => 'teacher_id',
            'teacher_mutations' => 'teacher_id',
            'teacher_attendances' => 'teacher_id',
        ];

        $migrated = 0;

        foreach ($tables as $table => $fk) {
            $records = DB::table($table)
                ->join('teachers', "teachers.id", '=', "$table.$fk")
                ->whereNotNull('teachers.deleted_at')
                ->select("$table.id as record_id", 'teachers.id as old_teacher_id', 'teachers.nama', 'teachers.nuptk', 'teachers.school_id')
                ->get();

            foreach ($records as $record) {
                // Find an active teacher with the same name and (school OR nuptk)
                $bareName = strtoupper(trim(explode(',', $record->nama)[0]));
                
                $activeTeacher = DB::table('teachers')
                    ->whereNull('deleted_at')
                    ->whereRaw("UPPER(TRIM(SPLIT_PART(nama, ',', 1))) = ?", [$bareName])
                    ->where(function ($q) use ($record) {
                        $q->where('school_id', $record->school_id);
                        if (!empty($record->nuptk)) {
                            $q->orWhere('nuptk', $record->nuptk);
                        }
                    })
                    ->first();

                if ($activeTeacher) {
                    DB::table($table)
                        ->where('id', $record->record_id)
                        ->update([$fk => $activeTeacher->id]);
                    $this->info("Migrated $table ID {$record->record_id} to Active Teacher {$activeTeacher->id}");
                    $migrated++;
                } else {
                    $this->warn("Could not find active teacher for $table ID {$record->record_id} (Old Teacher: {$record->nama})");
                }
            }
        }

        $this->info("Successfully migrated {$migrated} relations.");
        return self::SUCCESS;
    }
}
