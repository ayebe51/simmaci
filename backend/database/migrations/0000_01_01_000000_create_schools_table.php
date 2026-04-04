<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('schools', function (Blueprint $table) {
            $table->id();
            $table->string('nsm')->nullable()->unique();
            $table->string('npsn')->nullable()->unique();
            $table->string('nama');
            $table->text('alamat')->nullable();
            $table->string('provinsi')->nullable();
            $table->string('kabupaten')->nullable();
            $table->string('kecamatan')->nullable();
            $table->string('kelurahan')->nullable();
            $table->string('telepon')->nullable();
            $table->string('email')->nullable();
            $table->string('kepala_madrasah')->nullable();
            $table->string('akreditasi')->nullable();
            $table->string('status')->nullable()->comment('Jamaah / Jamiyyah (Afiliasi)');
            $table->string('status_jamiyyah')->nullable();
            $table->string('npsm_nu')->nullable()->unique()->comment('Nomor Pokok Satuan Maarif NU');
            $table->timestamps();
            $table->softDeletes();

            $table->index('kecamatan');
            if (DB::getDriverName() === 'pgsql') {
                $table->fullText('nama');
            }
        });

        // RLS Policy
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE schools ENABLE ROW LEVEL SECURITY');
            DB::statement("
                CREATE POLICY tenant_isolation_schools ON schools
                USING (
                    current_setting('app.current_school_id', true) IS NULL
                    OR current_setting('app.current_school_id', true) = ''
                    OR id = current_setting('app.current_school_id', true)::bigint
                )
            ");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP POLICY IF EXISTS tenant_isolation_schools ON schools');
        }
        Schema::dropIfExists('schools');
    }
};
