<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ppdb_periods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->nullable()->constrained('schools')->nullOnDelete();
            $table->string('academic_year', 20); // e.g. '2026/2027'
            $table->string('wave_name', 100);    // e.g. 'Gelombang 1 - Reguler'
            $table->text('description')->nullable();
            $table->date('start_date');
            $table->date('end_date');
            $table->date('announcement_date')->nullable();
            $table->date('reregistration_end_date')->nullable();
            $table->integer('quota')->default(0);
            $table->boolean('is_active')->default(true);
            $table->jsonb('available_tracks')->nullable(); // ['reguler', 'prestasi', 'afirmasi', 'tahfidz']
            $table->jsonb('required_documents')->nullable(); // ['foto', 'kk', 'akta', 'ijazah', 'prestasi']
            $table->timestamps();
            $table->softDeletes();

            $table->index('academic_year');
            $table->index('is_active');
            $table->index(['school_id', 'is_active']);
        });

        // RLS Policy for ppdb_periods
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE ppdb_periods ENABLE ROW LEVEL SECURITY');
            DB::statement("
                CREATE POLICY tenant_isolation_ppdb_periods ON ppdb_periods
                USING (
                    current_setting('app.current_school_id', true) IS NULL
                    OR current_setting('app.current_school_id', true) = ''
                    OR school_id IS NULL
                    OR school_id = current_setting('app.current_school_id', true)::bigint
                )
            ");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP POLICY IF EXISTS tenant_isolation_ppdb_periods ON ppdb_periods');
        }
        Schema::dropIfExists('ppdb_periods');
    }
};
