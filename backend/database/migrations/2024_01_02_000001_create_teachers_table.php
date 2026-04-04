<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teachers', function (Blueprint $table) {
            $table->id();
            $table->string('nuptk')->nullable();
            $table->string('nomor_induk_maarif')->nullable();
            $table->string('nama');
            $table->string('nip')->nullable();
            $table->string('jenis_kelamin')->nullable();
            $table->string('tempat_lahir')->nullable();
            $table->string('tanggal_lahir')->nullable();
            $table->string('pendidikan_terakhir')->nullable();
            $table->string('mapel')->nullable();
            $table->string('unit_kerja')->nullable();
            $table->foreignId('school_id')->nullable()->constrained('schools')->nullOnDelete();
            $table->string('provinsi')->nullable();
            $table->string('kabupaten')->nullable();
            $table->string('kecamatan')->nullable();
            $table->string('kelurahan')->nullable();
            $table->string('status')->nullable(); // PNS, GTY, GTT, Tendik
            $table->string('tmt')->nullable();
            $table->boolean('is_certified')->default(false);
            $table->string('phone_number')->nullable();
            $table->string('email')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_verified')->default(false);
            $table->boolean('is_sk_generated')->default(false);
            $table->string('pdpkpnu')->nullable();
            $table->string('photo_id')->nullable();
            $table->string('surat_permohonan_url')->nullable();
            $table->string('nomor_surat_permohonan')->nullable();
            $table->string('tanggal_surat_permohonan')->nullable();
            $table->string('kta_number')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('nuptk');
            $table->index('nomor_induk_maarif');
            $table->index('unit_kerja');
            $table->index('kecamatan');
            $table->index('is_active');
            $table->index(['school_id', 'is_active']);
            if (DB::getDriverName() === 'pgsql') {
                $table->fullText('nama');
            }
        });

        // RLS Policy
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE teachers ENABLE ROW LEVEL SECURITY');
            DB::statement("
                CREATE POLICY tenant_isolation_teachers ON teachers
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
            DB::statement('DROP POLICY IF EXISTS tenant_isolation_teachers ON teachers');
        }
        Schema::dropIfExists('teachers');
    }
};
