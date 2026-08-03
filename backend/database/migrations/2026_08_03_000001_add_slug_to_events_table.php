<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            if (! Schema::hasColumn('events', 'slug')) {
                $table->string('slug')->nullable()->unique()->after('name');
            }
        });

        // Backfill slug for existing events
        \DB::table('events')->whereNull('slug')->orWhere('slug', '')->get()->each(function ($event) {
            $base = Str::slug($event->name);
            $slug = $base;
            $i    = 1;
            while (\DB::table('events')->where('slug', $slug)->where('id', '!=', $event->id)->exists()) {
                $slug = $base . '-' . $i++;
            }
            \DB::table('events')->where('id', $event->id)->update(['slug' => $slug]);
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            if (Schema::hasColumn('events', 'slug')) {
                $table->dropColumn('slug');
            }
        });
    }
};
