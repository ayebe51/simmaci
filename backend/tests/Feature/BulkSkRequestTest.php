<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\SkDocument;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BulkSkRequestTest extends TestCase
{
    use RefreshDatabase;

    private User $operator;
    private School $school;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $this->school = School::factory()->create([
            'nama' => 'MI Ma\'arif NU 03 Karangsembung',
            'nsm'  => '111233010003',
        ]);

        $this->operator = User::factory()->create([
            'role'      => 'operator',
            'email'     => 'operator@test.com',
            'school_id' => $this->school->id,
            'is_active' => true,
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────

    private function payload(array $documents, array $overrides = []): array
    {
        return array_merge([
            'documents'            => $documents,
            'surat_permohonan_url' => 'https://example.com/surat.pdf',
        ], $overrides);
    }

    private function gtyDoc(string $nama = 'Ahmad Fauzi'): array
    {
        return [
            'nama'              => $nama,
            'unit_kerja'        => 'MI Ma\'arif NU 03 Karangsembung',
            'status'            => 'GTY',
            'nip'               => '123456',
            'nomor_induk_maarif'=> 'NIM-001',
            'tanggal_lahir'     => '1990-01-01',
            'tempat_lahir'      => 'Cilacap',
        ];
    }

    private function pnsDoc(string $nama = 'Budi Santoso'): array
    {
        return [
            'nama'              => $nama,
            'unit_kerja'        => 'MI Ma\'arif NU 03 Karangsembung',
            'status'            => 'PNS',
            'nip'               => '123456',
            'nomor_induk_maarif'=> 'NIM-002',
            'tanggal_lahir'     => '1985-05-10',
            'tempat_lahir'      => 'Cilacap',
        ];
    }

    private function pnsDocByNip(string $nama = 'Citra Dewi'): array
    {
        return [
            'nama'              => $nama,
            'unit_kerja'        => 'MI Ma\'arif NU 03 Karangsembung',
            'status'            => 'GTY', // status bukan PNS, tapi NIP 18 digit
            'nip'               => '199001012015041001', // 18 digit = PNS NIP format
            'nomor_induk_maarif'=> 'NIM-003',
            'tanggal_lahir'     => '1990-01-01',
            'tempat_lahir'      => 'Cilacap',
        ];
    }

    // ── Response structure ────────────────────────────────────

    #[\PHPUnit\Framework\Attributes\Test]
    public function bulk_request_returns_count_skipped_and_rejected_fields(): void
    {
        $response = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/bulk-request', $this->payload([
                $this->gtyDoc(),
            ]));

        $response->assertOk()
            ->assertJsonStructure(['success', 'count', 'skipped', 'rejected']);
    }

    // ── All GTY (non-PNS) ─────────────────────────────────────

    #[\PHPUnit\Framework\Attributes\Test]
    public function all_gty_documents_are_created_with_zero_skipped(): void
    {
        $response = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/bulk-request', $this->payload([
                $this->gtyDoc('Guru Satu'),
                $this->gtyDoc('Guru Dua'),
            ]));

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'count'   => 2,
                'skipped' => 0,
                'rejected'=> [],
            ]);

        $this->assertDatabaseCount('sk_documents', 2);
    }

    // ── PNS via status field ──────────────────────────────────

    #[\PHPUnit\Framework\Attributes\Test]
    public function pns_document_is_auto_rejected_and_counted_as_skipped(): void
    {
        $response = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/bulk-request', $this->payload([
                $this->gtyDoc('Guru GTY'),
                $this->pnsDoc('Guru PNS'),
            ]));

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'count'   => 1,
                'skipped' => 1,
            ]);

        // rejected array harus berisi nama guru PNS
        $rejected = $response->json('rejected');
        $this->assertCount(1, $rejected);
        $this->assertEquals('Guru PNS', $rejected[0]['nama']);
        $this->assertStringContainsString('PNS', $rejected[0]['alasan']);
    }

    #[\PHPUnit\Framework\Attributes\Test]
    public function pns_document_is_saved_to_db_with_rejected_status(): void
    {
        $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/bulk-request', $this->payload([
                $this->pnsDoc('Guru PNS'),
            ]));

        $this->assertDatabaseHas('sk_documents', [
            'nama'   => 'Guru PNS',
            'status' => 'rejected',
        ]);

        $sk = SkDocument::where('nama', 'Guru PNS')->first();
        $this->assertStringContainsString('PNS', $sk->rejection_reason);
    }

    // ── PNS via 18-digit NIP ──────────────────────────────────

    #[\PHPUnit\Framework\Attributes\Test]
    public function document_with_18_digit_nip_is_auto_rejected(): void
    {
        $response = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/bulk-request', $this->payload([
                $this->pnsDocByNip('Guru NIP 18'),
            ]));

        $response->assertOk()
            ->assertJson(['count' => 0, 'skipped' => 1]);

        $rejected = $response->json('rejected');
        $this->assertCount(1, $rejected);
        $this->assertEquals('Guru NIP 18', $rejected[0]['nama']);
    }

    // ── ASN status ────────────────────────────────────────────

    #[\PHPUnit\Framework\Attributes\Test]
    public function asn_status_is_also_auto_rejected(): void
    {
        $doc = $this->gtyDoc('Guru ASN');
        $doc['status'] = 'ASN';

        $response = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/bulk-request', $this->payload([$doc]));

        $response->assertOk()
            ->assertJson(['count' => 0, 'skipped' => 1]);
    }

    // ── Mixed batch ───────────────────────────────────────────

    #[\PHPUnit\Framework\Attributes\Test]
    public function mixed_batch_correctly_separates_created_and_rejected(): void
    {
        // Gunakan 3 dokumen agar masuk sync path (≤3)
        $response = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/bulk-request', $this->payload([
                $this->gtyDoc('GTY Satu'),
                $this->pnsDoc('PNS Satu'),
                $this->pnsDocByNip('PNS NIP Dua'),
            ]));

        $response->assertOk()
            ->assertJson([
                'count'   => 1,
                'skipped' => 2,
            ]);

        $rejected = $response->json('rejected');
        $this->assertCount(2, $rejected);

        $rejectedNames = array_column($rejected, 'nama');
        $this->assertContains('PNS Satu', $rejectedNames);
        $this->assertContains('PNS NIP Dua', $rejectedNames);
    }

    // ── Activity log ──────────────────────────────────────────

    #[\PHPUnit\Framework\Attributes\Test]
    public function bulk_request_writes_activity_log_with_rejected_details(): void
    {
        $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/bulk-request', $this->payload([
                $this->gtyDoc('GTY Satu'),
                $this->pnsDoc('PNS Satu'),
            ]));

        $this->assertDatabaseHas('activity_logs', [
            'event'    => 'bulk_sk_request',
            'log_name' => 'sk',
        ]);

        $log = \App\Models\ActivityLog::where('event', 'bulk_sk_request')->first();
        $this->assertStringContainsString('1 permohonan dibuat', $log->description);
        $this->assertStringContainsString('1 dilewati', $log->description);
        $this->assertNotEmpty($log->properties['rejected']);
        $this->assertEquals('PNS Satu', $log->properties['rejected'][0]['nama']);
    }

    // ── Auth ──────────────────────────────────────────────────

    #[\PHPUnit\Framework\Attributes\Test]
    public function unauthenticated_user_cannot_submit_bulk_request(): void
    {
        $this->postJson('/api/sk-documents/bulk-request', $this->payload([
            $this->gtyDoc(),
        ]))->assertStatus(401);
    }

    #[\PHPUnit\Framework\Attributes\Test]
    public function bulk_request_requires_documents_and_surat_permohonan(): void
    {
        $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/bulk-request', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['documents', 'surat_permohonan_url']);
    }
}
