<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ─── Add missing columns to events table ──────────────────────────────
        Schema::table('events', function (Blueprint $table) {
            // school_id was missing from migration (model has HasTenantScope)
            if (! Schema::hasColumn('events', 'school_id')) {
                $table->unsignedBigInteger('school_id')->nullable()->after('id')->index();
            }
            if (! Schema::hasColumn('events', 'status')) {
                $table->string('status')->default('OPEN')->after('description');
            }
            if (! Schema::hasColumn('events', 'deleted_at')) {
                $table->softDeletes();
            }
            // Juknis specific: pendaftaran period & deadline video
            if (! Schema::hasColumn('events', 'registration_start')) {
                $table->date('registration_start')->nullable()->after('date');
            }
            if (! Schema::hasColumn('events', 'registration_end')) {
                $table->date('registration_end')->nullable()->after('registration_start');
            }
            if (! Schema::hasColumn('events', 'video_deadline')) {
                $table->dateTime('video_deadline')->nullable()->after('registration_end');
            }
            if (! Schema::hasColumn('events', 'announcement_date')) {
                $table->date('announcement_date')->nullable()->after('video_deadline');
            }
            if (! Schema::hasColumn('events', 'announcement_place')) {
                $table->string('announcement_place')->nullable()->after('announcement_date');
            }
            if (! Schema::hasColumn('events', 'contact_name')) {
                $table->string('contact_name')->nullable()->after('announcement_place');
            }
            if (! Schema::hasColumn('events', 'contact_phone')) {
                $table->string('contact_phone')->nullable()->after('contact_name');
            }
        });

        // ─── Competitions (Cabang Lomba) ───────────────────────────────────────
        Schema::create('competitions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('category');         // Keagamaan, Akademik, Seni, Olahraga
            $table->string('type')->default('Individual'); // Individual | Beregu

            // Juknis: jenjang peserta (MI/SD, MTs/SMP, MA/SMA/SMK, or combined)
            $table->string('jenjang')->nullable(); // e.g. "MTs/SMP,MA/SMA/SMK"

            // Juknis: sub-type for Festival Aswaja
            // mars_maarif | mtq_pa | mtq_pi | puji_pujian | film_dokumenter | guru_berprestasi | madrasah_berprestasi | oskanu
            $table->string('lomba_type')->nullable();

            $table->date('date')->nullable();
            $table->string('location')->nullable();
            $table->string('status')->default('OPEN'); // OPEN | CLOSED | FINISHED

            // Registration deadline for this specific competition
            $table->dateTime('deadline')->nullable();

            // Scoring weights from Juknis (stored as JSON)
            $table->json('scoring_criteria')->nullable();

            // Max participants per school
            $table->unsignedInteger('max_per_school')->nullable();

            $table->timestamps();
            $table->softDeletes();
        });

        // ─── Competition Participants ──────────────────────────────────────────
        Schema::create('competition_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('competition_id')->constrained()->cascadeOnDelete();

            // Either a registered teacher/school or a free-text entry
            $table->string('name');
            $table->string('institution'); // Asal sekolah/madrasah (free text)
            $table->unsignedBigInteger('school_id')->nullable()->index(); // FK to schools if known
            $table->unsignedBigInteger('teacher_id')->nullable()->index(); // if participant is a teacher

            // For Festival Aswaja: group name, member count
            $table->string('group_name')->nullable();
            $table->unsignedInteger('member_count')->nullable();

            // Category within competition (pa/pi for MTQ, etc.)
            $table->string('gender_category')->nullable(); // pa | pi | campuran

            // Contact for coordination
            $table->string('contact_person')->nullable();
            $table->string('contact_phone')->nullable();

            // Video submission link (Google Drive) — Festival Aswaja
            $table->string('video_url')->nullable();
            $table->string('video_filename')->nullable(); // Standardized filename per Juknis
            $table->string('video_status')->default('pending'); // pending | submitted | reviewed

            // For Guru Berprestasi: berkas upload paths
            $table->string('surat_keterangan_aktif_url')->nullable();
            $table->string('sertifikat_pkpnu_url')->nullable();
            $table->string('surat_rekomendasi_url')->nullable();
            $table->string('surat_keterangan_integritas_url')->nullable();
            $table->string('bukti_prestasi_url')->nullable();
            $table->string('esai_reflektif_url')->nullable();
            $table->string('karya_ilmiah_url')->nullable();

            // For Madrasah Berprestasi: dokumen mutu
            $table->string('dokumen_pdca_url')->nullable();
            $table->string('portofolio_branding_url')->nullable();
            $table->string('rekap_prestasi_url')->nullable();
            $table->string('dokumen_admin_url')->nullable();

            // For Film Dokumenter: synopsis PDF
            $table->string('sinopsis_url')->nullable();

            // Status pendaftaran
            $table->string('registration_status')->default('pending'); // pending | verified | rejected

            $table->timestamps();
            $table->softDeletes();
        });

        // ─── Competition Results ───────────────────────────────────────────────
        Schema::create('competition_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('competition_id')->constrained()->cascadeOnDelete();
            $table->foreignId('participant_id')
                ->references('id')->on('competition_participants')->cascadeOnDelete();

            $table->unsignedInteger('rank')->nullable();   // Juara 1, 2, 3
            $table->decimal('score', 8, 2)->nullable();
            $table->text('notes')->nullable();

            // Juknis scoring components (JSON) for detailed breakdown
            $table->json('score_breakdown')->nullable();

            // Certificate
            $table->string('certificate_url')->nullable();
            $table->boolean('certificate_generated')->default(false);

            $table->timestamps();

            $table->unique(['competition_id', 'participant_id']);
        });

        // ─── Anugerah Registrations (Guru & Madrasah Berprestasi) ─────────────
        // Separate table for the structured award registration flow
        Schema::create('anugerah_registrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->cascadeOnDelete();
            $table->foreignId('competition_id')->constrained()->cascadeOnDelete();

            // Category: guru | madrasah
            $table->string('category');

            // Jenjang: MI/SD | MTs/SMP | MA/SMA/SMK
            $table->string('jenjang');

            // Applicant info
            $table->string('applicant_name');
            $table->string('applicant_nuptk')->nullable();
            $table->unsignedBigInteger('school_id')->nullable()->index();
            $table->string('school_name');
            $table->string('kecamatan')->nullable();

            // Masa bakti (Guru)
            $table->unsignedInteger('masa_bakti_tahun')->nullable();
            $table->date('mulai_bertugas')->nullable();

            // Documents (URL paths)
            $table->string('surat_keterangan_aktif_url')->nullable();
            $table->string('sertifikat_pkpnu_url')->nullable();
            $table->string('surat_rekomendasi_url')->nullable();
            $table->string('surat_keterangan_integritas_url')->nullable();
            $table->string('bukti_prestasi_url')->nullable();
            $table->string('esai_reflektif_url')->nullable();
            $table->string('karya_ilmiah_url')->nullable();

            // Madrasah docs
            $table->string('dokumen_pdca_url')->nullable();
            $table->string('portofolio_branding_url')->nullable();
            $table->string('rekap_prestasi_url')->nullable();
            $table->string('dokumen_admin_url')->nullable();

            // Achievements JSON: [{ nama, tingkat, juara, tahun_ajaran }]
            $table->json('prestasi_list')->nullable();

            // Review
            $table->string('status')->default('draft'); // draft | submitted | under_review | finalis | winner | rejected
            $table->string('rejection_reason')->nullable();
            $table->unsignedInteger('total_score')->nullable();
            $table->unsignedInteger('rank')->nullable();

            // Reviewer notes
            $table->text('reviewer_notes')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('anugerah_registrations');
        Schema::dropIfExists('competition_results');
        Schema::dropIfExists('competition_participants');
        Schema::dropIfExists('competitions');

        Schema::table('events', function (Blueprint $table) {
            $columns = [
                'school_id', 'status', 'deleted_at', 'registration_start', 'registration_end',
                'video_deadline', 'announcement_date', 'announcement_place',
                'contact_name', 'contact_phone',
            ];
            foreach ($columns as $col) {
                if (Schema::hasColumn('events', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
