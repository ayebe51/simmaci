<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sk_documents', function (Blueprint $table) {
            $table->id();
            $table->string('nomor_sk')->unique();
            $table->string('jenis_sk'); // Pengangkatan, Mutasi, dll
            $table->foreignId('teacher_id')->nullable()->constrained('teachers')->nullOnDelete();
            $table->string('nama');
            $table->string('jabatan')->nullable();
            $table->string('unit_kerja')->nullable();
            $table->foreignId('school_id')->nullable()->constrained('schools')->nullOnDelete();
            $table->string('tanggal_penetapan');
            $table->string('status')->default('draft'); // draft, pending, approved, rejected, active, archived
            $table->string('file_url')->nullable();
            $table->string('surat_permohonan_url')->nullable();
            $table->text('qr_code')->nullable();

            // Revision fields
            $table->string('revision_status')->nullable(); // pending, rejected
            $table->text('revision_reason')->nullable();
            $table->json('revision_data')->nullable();

            $table->string('created_by')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->string('archived_by')->nullable();
            $table->text('archive_reason')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('teacher_id');
            $table->index('status');
            $table->index('jenis_sk');
            $table->index('archived_at');
            $table->index('school_id');
            $table->index(['school_id', 'status'], 'sk_docs_school_status_idx');
            $table->index(['school_id', 'jenis_sk'], 'sk_docs_school_jenis_idx');
            if (DB::getDriverName() === 'pgsql') {
                $table->fullText('nama');
            }
        });

        // RLS Policy
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE sk_documents ENABLE ROW LEVEL SECURITY');
            DB::statement("
                CREATE POLICY tenant_isolation_sk ON sk_documents
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
            DB::statement('DROP POLICY IF EXISTS tenant_isolation_sk ON sk_documents');
        }
        Schema::dropIfExists('sk_documents');
    }
};
