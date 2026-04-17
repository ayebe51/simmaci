<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sk_templates', function (Blueprint $table) {
            $table->id();
            $table->string('sk_type', 20);
            $table->string('original_filename', 255);
            $table->string('file_path', 500);
            $table->string('disk', 20)->default('public');
            $table->boolean('is_active')->default(false);
            $table->string('uploaded_by', 255);
            $table->timestamps();
            $table->softDeletes();

            $table->index('sk_type', 'idx_sk_templates_sk_type');
            $table->index('is_active', 'idx_sk_templates_is_active');
            $table->index(['sk_type', 'is_active'], 'idx_sk_templates_sk_type_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sk_templates');
    }
};
