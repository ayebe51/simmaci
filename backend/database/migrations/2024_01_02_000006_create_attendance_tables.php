<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Subjects (Mata Pelajaran)
        Schema::create('subjects', function (Blueprint $table) {
            $table->id();
            $table->string('nama');
            $table->string('kode')->nullable();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('school_id');
            $table->index(['school_id', 'is_active']);
        });

        // Classes (Kelas / Rombongan Belajar)
        Schema::create('classes', function (Blueprint $table) {
            $table->id();
            $table->string('nama');
            $table->string('tingkat');
            $table->string('tahun_ajaran');
            $table->foreignId('wali_kelas_id')->nullable()->constrained('teachers')->nullOnDelete();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('school_id');
            $table->index(['school_id', 'is_active']);
        });

        // Lesson Schedule (Jadwal Jam Pelajaran)
        Schema::create('lesson_schedules', function (Blueprint $table) {
            $table->id();
            $table->integer('jam_ke');
            $table->string('jam_mulai');
            $table->string('jam_selesai');
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->timestamps();

            $table->index('school_id');
        });

        // Teacher Attendance (Absensi Guru)
        Schema::create('teacher_attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('teachers')->cascadeOnDelete();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->date('tanggal');
            $table->string('jam_masuk')->nullable();
            $table->string('jam_pulang')->nullable();
            $table->string('status'); // Hadir, Sakit, Izin, Alpha
            $table->text('keterangan')->nullable();
            $table->string('scanned_by')->nullable();
            $table->timestamps();

            $table->index(['school_id', 'tanggal']);
            $table->index(['teacher_id', 'tanggal']);
            $table->index('teacher_id');
        });

        // Student Attendance (Absensi Siswa)
        Schema::create('student_attendances', function (Blueprint $table) {
            $table->id();
            $table->string('student_id');
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->date('tanggal');
            $table->integer('jam_ke')->nullable();
            $table->string('status'); // Hadir, Sakit, Izin, Alpha
            $table->text('keterangan')->nullable();
            $table->foreignId('recorded_by_teacher_id')->nullable()->constrained('teachers')->nullOnDelete();
            $table->string('scanned_by')->nullable();
            $table->timestamps();

            $table->index(['school_id', 'tanggal']);
            $table->index(['school_id', 'status', 'tanggal'], 'std_att_school_status_date_idx');
            $table->index(['class_id', 'tanggal']);
            $table->index(['student_id', 'tanggal']);
            $table->index(['class_id', 'subject_id', 'tanggal']);
        });

        // Student Attendance Logs (Aggregate — saves rows)
        Schema::create('student_attendance_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->date('tanggal');
            $table->integer('jam_ke')->nullable();
            $table->json('logs'); // Map: student_id -> {status, jam, scannedBy, ...}
            $table->timestamps();

            $table->index(['school_id', 'tanggal']);
            $table->index(['class_id', 'subject_id', 'tanggal']);
        });

        // Attendance Settings (Per Sekolah)
        Schema::create('attendance_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->unique()->constrained('schools')->cascadeOnDelete();
            $table->boolean('absensi_guru_aktif')->default(false);
            $table->boolean('absensi_siswa_aktif')->default(false);
            $table->string('scanner_pin')->nullable();
            $table->boolean('qr_scan_aktif')->default(false);
            $table->string('gowa_url')->nullable();
            $table->string('gowa_device_id')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_settings');
        Schema::dropIfExists('student_attendance_logs');
        Schema::dropIfExists('student_attendances');
        Schema::dropIfExists('teacher_attendances');
        Schema::dropIfExists('lesson_schedules');
        Schema::dropIfExists('classes');
        Schema::dropIfExists('subjects');
    }
};
