<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ppdb_registrations', function (Blueprint $table) {
            $table->id();
            $table->string('registration_number', 50)->unique();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignId('period_id')->constrained('ppdb_periods')->cascadeOnDelete();
            $table->string('track', 50)->default('reguler'); // reguler, prestasi, afirmasi, tahfidz

            // Student Biodata
            $table->string('nisn', 20)->nullable();
            $table->string('nik', 20)->nullable();
            $table->string('nama_lengkap', 255);
            $table->string('jenis_kelamin', 20); // L / P
            $table->string('tempat_lahir', 100);
            $table->date('tanggal_lahir');
            $table->string('asal_sekolah', 255);
            $table->string('no_whatsapp', 30);
            $table->string('email', 100)->nullable();

            // Address
            $table->text('alamat');
            $table->string('provinsi', 100)->default('Jawa Tengah');
            $table->string('kabupaten', 100)->default('Cilacap');
            $table->string('kecamatan', 100);
            $table->string('kelurahan', 100);
            $table->string('rt_rw', 20)->nullable();
            $table->string('kode_pos', 10)->nullable();

            // Parent / Guardian Data
            $table->string('nama_ayah', 255)->nullable();
            $table->string('pekerjaan_ayah', 100)->nullable();
            $table->string('nama_ibu', 255)->nullable();
            $table->string('pekerjaan_ibu', 100)->nullable();
            $table->string('nama_wali', 255)->nullable();
            $table->string('no_whatsapp_wali', 30)->nullable();

            // Documents (URL path)
            $table->string('foto_url', 500)->nullable();
            $table->string('kk_url', 500)->nullable();
            $table->string('akta_url', 500)->nullable();
            $table->string('ijazah_url', 500)->nullable();
            $table->string('prestasi_url', 500)->nullable();
            $table->jsonb('additional_documents')->nullable();

            // Status & Verification
            $table->string('status', 50)->default('submitted'); 
            // draft, submitted, verified, revision_needed, rejected, accepted, reserved, reregistered, cancelled
            $table->text('verification_notes')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();

            // Selection Scores & Ranking
            $table->decimal('test_score', 5, 2)->nullable();
            $table->decimal('interview_score', 5, 2)->nullable();
            $table->decimal('achievement_score', 5, 2)->nullable();
            $table->decimal('final_score', 5, 2)->nullable();
            $table->integer('rank')->nullable();
            $table->text('selection_notes')->nullable();

            // Re-registration & Sync to Students Table
            $table->boolean('is_reregistered')->default(false);
            $table->timestamp('reregistered_at')->nullable();
            $table->foreignId('student_id')->nullable()->constrained('students')->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();

            // Indexes
            $table->index('registration_number');
            $table->index('school_id');
            $table->index('period_id');
            $table->index('status');
            $table->index('nisn');
            $table->index('nik');
            $table->index(['school_id', 'status']);
            $table->index(['period_id', 'status']);
            if (DB::getDriverName() === 'pgsql') {
                $table->fullText('nama_lengkap');
            }
        });

        // RLS Policy for ppdb_registrations
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE ppdb_registrations ENABLE ROW LEVEL SECURITY');
            DB::statement("
                CREATE POLICY tenant_isolation_ppdb_registrations ON ppdb_registrations
                USING (
                    current_setting('app.current_school_id', true) IS NULL
                    OR current_setting('app.current_school_id', true) = ''
                    OR school_id = current_setting('app.current_school_id', true)::bigint
                )
            ");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP POLICY IF EXISTS tenant_isolation_ppdb_registrations ON ppdb_registrations');
        }
        Schema::dropIfExists('ppdb_registrations');
    }
};
