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
        // 1. Meeting Attendances: optimize live projector feed, check-in verification & attendance reporting
        try {
            Schema::table('meeting_attendances', function (Blueprint $table) {
                $table->index(['meeting_id', 'checked_in_at'], 'meeting_att_meeting_checked_in_idx');
            });
        } catch (\Throwable $e) {}

        try {
            Schema::table('meeting_attendances', function (Blueprint $table) {
                $table->index(['meeting_id', 'attendance_type', 'checked_in_at'], 'meeting_att_type_checked_idx');
            });
        } catch (\Throwable $e) {}

        try {
            Schema::table('meeting_attendances', function (Blueprint $table) {
                $table->index(['meeting_id', 'participant_id'], 'meeting_att_meeting_participant_idx');
            });
        } catch (\Throwable $e) {}

        try {
            Schema::table('meeting_attendances', function (Blueprint $table) {
                $table->index(['meeting_id', 'deleted_at', 'checked_in_at'], 'meeting_att_meeting_del_checked_idx');
            });
        } catch (\Throwable $e) {}

        // 2. Meeting Participants: optimize present vs absent filtering and participant breakdown
        try {
            Schema::table('meeting_participants', function (Blueprint $table) {
                $table->index(['meeting_id', 'is_token_used'], 'meeting_part_meeting_token_used_idx');
            });
        } catch (\Throwable $e) {}

        try {
            Schema::table('meeting_participants', function (Blueprint $table) {
                $table->index(['meeting_id', 'participant_type'], 'meeting_part_meeting_type_idx');
            });
        } catch (\Throwable $e) {}

        // 3. SK Documents: optimize early warning query, teacher lifecycle, and category sorting
        try {
            Schema::table('sk_documents', function (Blueprint $table) {
                $table->index(['status', 'tanggal_penetapan'], 'sk_docs_status_tgl_penetapan_idx');
            });
        } catch (\Throwable $e) {}

        try {
            Schema::table('sk_documents', function (Blueprint $table) {
                $table->index(['teacher_id', 'status', 'created_at'], 'sk_docs_teacher_status_created_idx');
            });
        } catch (\Throwable $e) {}

        try {
            Schema::table('sk_documents', function (Blueprint $table) {
                $table->index(['school_id', 'jenis_sk', 'created_at'], 'sk_docs_school_jenis_created_idx');
            });
        } catch (\Throwable $e) {}

        // 4. Activity Logs: optimize event filtering, audit trails, and model-specific history
        try {
            Schema::table('activity_logs', function (Blueprint $table) {
                $table->index(['school_id', 'event', 'created_at'], 'activity_logs_school_event_created_idx');
            });
        } catch (\Throwable $e) {}

        try {
            Schema::table('activity_logs', function (Blueprint $table) {
                $table->index(['event', 'created_at'], 'activity_logs_event_created_idx');
            });
        } catch (\Throwable $e) {}

        try {
            Schema::table('activity_logs', function (Blueprint $table) {
                $table->index(['subject_type', 'subject_id', 'created_at'], 'activity_logs_subject_type_id_created_idx');
            });
        } catch (\Throwable $e) {}

        // 5. Headmaster Tenures: optimize active tenure lookups and early expiration warning
        try {
            Schema::table('headmaster_tenures', function (Blueprint $table) {
                $table->index(['school_id', 'status'], 'headmaster_tenures_school_status_idx');
            });
        } catch (\Throwable $e) {}

        try {
            Schema::table('headmaster_tenures', function (Blueprint $table) {
                $table->index(['status', 'end_date'], 'headmaster_tenures_status_end_date_idx');
            });
        } catch (\Throwable $e) {}
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('meeting_attendances', function (Blueprint $table) {
            try { $table->dropIndex('meeting_att_meeting_checked_in_idx'); } catch (\Throwable $e) {}
            try { $table->dropIndex('meeting_att_type_checked_idx'); } catch (\Throwable $e) {}
            try { $table->dropIndex('meeting_att_meeting_participant_idx'); } catch (\Throwable $e) {}
            try { $table->dropIndex('meeting_att_meeting_del_checked_idx'); } catch (\Throwable $e) {}
        });

        Schema::table('meeting_participants', function (Blueprint $table) {
            try { $table->dropIndex('meeting_part_meeting_token_used_idx'); } catch (\Throwable $e) {}
            try { $table->dropIndex('meeting_part_meeting_type_idx'); } catch (\Throwable $e) {}
        });

        Schema::table('sk_documents', function (Blueprint $table) {
            try { $table->dropIndex('sk_docs_status_tgl_penetapan_idx'); } catch (\Throwable $e) {}
            try { $table->dropIndex('sk_docs_teacher_status_created_idx'); } catch (\Throwable $e) {}
            try { $table->dropIndex('sk_docs_school_jenis_created_idx'); } catch (\Throwable $e) {}
        });

        Schema::table('activity_logs', function (Blueprint $table) {
            try { $table->dropIndex('activity_logs_school_event_created_idx'); } catch (\Throwable $e) {}
            try { $table->dropIndex('activity_logs_event_created_idx'); } catch (\Throwable $e) {}
            try { $table->dropIndex('activity_logs_subject_type_id_created_idx'); } catch (\Throwable $e) {}
        });

        Schema::table('headmaster_tenures', function (Blueprint $table) {
            try { $table->dropIndex('headmaster_tenures_school_status_idx'); } catch (\Throwable $e) {}
            try { $table->dropIndex('headmaster_tenures_status_end_date_idx'); } catch (\Throwable $e) {}
        });
    }
};
