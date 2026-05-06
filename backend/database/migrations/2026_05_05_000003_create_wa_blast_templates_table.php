<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wa_blast_templates', function (Blueprint $table) {
            $table->id();

            // Nama unik template (case-insensitive uniqueness di level DB)
            $table->string('name', 255);

            $table->text('body');

            $table->foreignId('created_by')
                ->constrained('users')
                ->restrictOnDelete();

            $table->timestampsTz();
            $table->softDeletesTz();
        });

        // Unique index case-insensitive pada name, hanya untuk baris yang belum dihapus
        DB::statement(
            "CREATE UNIQUE INDEX idx_wa_blast_templates_name ON wa_blast_templates(LOWER(name)) WHERE deleted_at IS NULL"
        );

        DB::statement('CREATE INDEX idx_wa_blast_templates_created_at ON wa_blast_templates(created_at)');
    }

    public function down(): void
    {
        Schema::dropIfExists('wa_blast_templates');
    }
};
