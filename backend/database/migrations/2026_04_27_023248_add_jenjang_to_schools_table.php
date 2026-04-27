<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('schools', function (Blueprint $table) {
            // Add jenjang column after status_jamiyyah
            $table->string('jenjang')->nullable()->after('status_jamiyyah');
            
            // Add index on jenjang column for query performance
            $table->index('jenjang');
            
            // Add index on status_jamiyyah column if not exists
            $table->index('status_jamiyyah');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('schools', function (Blueprint $table) {
            // Drop indexes first
            $table->dropIndex(['jenjang']);
            $table->dropIndex(['status_jamiyyah']);
            
            // Drop jenjang column
            $table->dropColumn('jenjang');
        });
    }
};
