<?php

namespace Tests\Feature;

use App\Models\Meeting;
use App\Models\MeetingAttendance;
use App\Models\MeetingParticipant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * MeetingReportControllerTest
 *
 * Integration tests for report generation and download.
 * Requirements: Req 10, 11
 */
class MeetingReportControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private User $adminYayasan;
    private User $operator;
    private Meeting $meeting;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = User::factory()->create(['role' => 'super_admin']);
        $this->adminYayasan = User::factory()->create(['role' => 'admin_yayasan']);
        $this->operator = User::factory()->create(['role' => 'operator']);

        $this->meeting = Meeting::factory()->create(['created_by' => $this->superAdmin->id]);

        // Create participants
        for ($i = 0; $i < 5; $i++) {
            MeetingParticipant::factory()->create(['meeting_id' => $this->meeting->id]);
        }

        // Create some attendance records
        $participants = $this->meeting->participants()->take(3)->get();
        foreach ($participants as $participant) {
            MeetingAttendance::factory()->create([
                'meeting_id' => $this->meeting->id,
                'participant_id' => $participant->id,
                'attendance_type' => 'qr_personal',
            ]);
        }
    }

    // ── PDF Report Tests ──────────────────────────────────────────────────────

    /**
     * Test super_admin can download PDF report
     */
    public function test_super_admin_can_download_pdf_report(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->getJson("/api/meetings/{$this->meeting->id}/report/pdf");

        $response->assertOk();
        $response->assertHeader('content-type', 'application/pdf');
        $response->assertHeader('content-disposition');
    }

    /**
     * Test admin_yayasan can download PDF report
     */
    public function test_admin_yayasan_can_download_pdf_report(): void
    {
        $response = $this->actingAs($this->adminYayasan)
            ->getJson("/api/meetings/{$this->meeting->id}/report/pdf");

        $response->assertOk();
        $response->assertHeader('content-type', 'application/pdf');
    }

    /**
     * Test operator cannot download PDF report
     */
    public function test_operator_cannot_download_pdf_report(): void
    {
        $response = $this->actingAs($this->operator)
            ->getJson("/api/meetings/{$this->meeting->id}/report/pdf");

        $response->assertForbidden();
    }

    /**
     * Test PDF report download requires authentication
     */
    public function test_pdf_report_download_requires_authentication(): void
    {
        $response = $this->getJson("/api/meetings/{$this->meeting->id}/report/pdf");

        $response->assertUnauthorized();
    }

    // ── Excel Report Tests ────────────────────────────────────────────────────

    /**
     * Test super_admin can download Excel report
     */
    public function test_super_admin_can_download_excel_report(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->getJson("/api/meetings/{$this->meeting->id}/report/excel");

        $response->assertOk();
        $response->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $response->assertHeader('content-disposition');
    }

    /**
     * Test admin_yayasan can download Excel report
     */
    public function test_admin_yayasan_can_download_excel_report(): void
    {
        $response = $this->actingAs($this->adminYayasan)
            ->getJson("/api/meetings/{$this->meeting->id}/report/excel");

        $response->assertOk();
        $response->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }

    /**
     * Test operator cannot download Excel report
     */
    public function test_operator_cannot_download_excel_report(): void
    {
        $response = $this->actingAs($this->operator)
            ->getJson("/api/meetings/{$this->meeting->id}/report/excel");

        $response->assertForbidden();
    }

    /**
     * Test Excel report download requires authentication
     */
    public function test_excel_report_download_requires_authentication(): void
    {
        $response = $this->getJson("/api/meetings/{$this->meeting->id}/report/excel");

        $response->assertUnauthorized();
    }

    // ── Report Content Tests ──────────────────────────────────────────────────

    /**
     * Test PDF report includes meeting information
     */
    public function test_pdf_report_includes_meeting_information(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->getJson("/api/meetings/{$this->meeting->id}/report/pdf");

        $response->assertOk();

        // PDF content should be binary, just verify it's not empty
        $content = $response->getContent();
        $this->assertNotEmpty($content);
        $this->assertStringContainsString('%PDF', $content);
    }

    /**
     * Test Excel report includes meeting information
     */
    public function test_excel_report_includes_meeting_information(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->getJson("/api/meetings/{$this->meeting->id}/report/excel");

        $response->assertOk();

        // Excel content should be binary, just verify it's not empty
        $content = $response->getContent();
        $this->assertNotEmpty($content);
    }

    // ── Non-existent Meeting Tests ────────────────────────────────────────────

    /**
     * Test PDF report for non-existent meeting returns 404
     */
    public function test_pdf_report_for_non_existent_meeting_returns_404(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/meetings/99999/report/pdf');

        $response->assertNotFound();
    }

    /**
     * Test Excel report for non-existent meeting returns 404
     */
    public function test_excel_report_for_non_existent_meeting_returns_404(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/meetings/99999/report/excel');

        $response->assertNotFound();
    }
}
