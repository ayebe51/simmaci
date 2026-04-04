<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('students', function (Blueprint $table) {
            $table->id();
            $table->string('nisn')->nullable();
            $table->string('nik')->nullable();
            $table->string('nomor_induk_maarif')->nullable();
            $table->string('nama');
            $table->string('jenis_kelamin')->nullable();
            $table->string('tempat_lahir')->nullable();
            $table->string('tanggal_lahir')->nullable();
            $table->string('nama_ayah')->nullable();
            $table->string('nama_ibu')->nullable();
            $table->text('alamat')->nullable();
            $table->string('provinsi')->nullable();
            $table->string('kabupaten')->nullable();
            $table->string('kecamatan')->nullable();
            $table->string('kelurahan')->nullable();
            $table->string('nama_sekolah')->nullable();
            $table->string('npsn')->nullable();
            $table->foreignId('school_id')->nullable()->constrained('schools')->nullOnDelete();
            $table->string('kelas')->nullable();
            $table->string('nomor_telepon')->nullable();
            $table->string('nama_wali')->nullable();
            $table->string('photo_id')->nullable();
            $table->boolean('is_verified')->default(false);
            $table->string('qr_code')->nullable();
            $table->string('status')->default('Aktif'); // Aktif, Lulus, Keluar
            $table->timestamp('last_transition_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('nisn');
            $table->index('npsn');
            $table->index('nama_sekolah');
            $table->index('kecamatan');
            $table->index('status');
            $table->index(['school_id', 'status'], 'students_school_status_idx');
            $table->index(['school_id', 'kelas'], 'students_school_class_idx');
            $table->index(['nama_sekolah', 'status']);
            if (DB::getDriverName() === 'pgsql') {
                $table->fullText('nama');
            }
        });

        // RLS Policy
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE students ENABLE ROW LEVEL SECURITY');
            DB::statement("
                CREATE POLICY tenant_isolation_students ON students
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
            DB::statement('DROP POLICY IF EXISTS tenant_isolation_students ON students');
        }
        Schema::dropIfExists('students');
    }
};
