<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->nullable()->constrained('schools')->cascadeOnDelete();
            $table->string('log_name')->nullable();
            $table->text('description');
            $table->nullableMorphs('subject', 'subject');
            $table->nullableMorphs('causer', 'causer');
            $table->json('properties')->nullable();
            $table->string('event')->nullable();
            $table->timestamps();

            $table->index('school_id');
            $table->index(['subject_id', 'subject_type']);
            $table->index(['causer_id', 'causer_type']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY');
            DB::statement("
                CREATE POLICY tenant_isolation_activity_logs ON activity_logs
                USING (
                    current_setting('app.current_school_id', true) IS NULL
                    OR current_setting('app.current_school_id', true) = ''
                    OR school_id = current_setting('app.current_school_id', true)::bigint
                )
            ");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP POLICY IF EXISTS tenant_isolation_activity_logs ON activity_logs');
        }
        Schema::dropIfExists('activity_logs');
    }
};
