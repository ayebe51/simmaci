<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sk_documents', function (Blueprint $table) {
            $table->string('alasan_pemberhentian')->nullable()
                ->after('ijazah_url')
                ->comment('Kategori alasan: pengunduran_diri, pensiun, meninggal_dunia, pelanggaran_disiplin, habis_kontrak, lainnya');
            $table->text('keterangan_pemberhentian')->nullable()
                ->after('alasan_pemberhentian')
                ->comment('Keterangan bebas jika alasan_pemberhentian = lainnya');
            $table->date('tanggal_efektif_pemberhentian')->nullable()
                ->after('keterangan_pemberhentian')
                ->comment('Tanggal mulai berlakunya keputusan pemberhentian');
        });
    }

    public function down(): void
    {
        Schema::table('sk_documents', function (Blueprint $table) {
            $table->dropColumn([
                'alasan_pemberhentian',
                'keterangan_pemberhentian',
                'tanggal_efektif_pemberhentian',
            ]);
        });
    }
};
