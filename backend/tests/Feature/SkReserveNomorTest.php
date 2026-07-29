<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\SkDocument;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Feature Tests — POST /api/sk-documents/reserve-nomor
 *
 * Memverifikasi bahwa endpoint reserve-nomor:
 * 1. Mengembalikan nomor urut yang benar (MAX + 1)
 * 2. Tidak terpengaruh oleh nomor format REQ/...
 * 3. Tidak terpengaruh oleh nomor soft-deleted
 * 4. Mengembalikan 1 jika belum ada SK sama sekali
 * 5. Bisa di-call berulang (idempotent sampai ada SK baru disimpan)
 */
class SkReserveNomorTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private School $school;

    public function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create(['nama' => 'RA Test Reserve']);

        $this->superAdmin = User::factory()->create([
            'role'      => 'super_admin',
            'school_id' => null,
            'email'     => 'admin@reserve.test',
            'is_active' => true,
        ]);
    }

    // ── Helper ──────────────────────────────────────────────────────────────

    private function makeSkWithNomor(string $nomor, ?string $deletedAt = null): void
    {
        $sk = SkDocument::factory()->create([
            'nomor_sk'   => $nomor,
            'school_id'  => $this->school->id,
            'status'     => 'approved',
            'nama'       => 'GURU TEST',
        ]);

        if ($deletedAt) {
            $sk->forceFill(['deleted_at' => $deletedAt])->save();
        }
    }

    private function reserveNomor(array $body = []): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-documents/reserve-nomor', $body);
    }

    // ── Tests ────────────────────────────────────────────────────────────────

    /** Jika belum ada SK resmi tahun ini, harus kembalikan 1 */
    public function test_returns_1_when_no_official_sk_exists(): void
    {
        $year = now()->year;

        // Hanya ada REQ/... — harus diabaikan
        $this->makeSkWithNomor("REQ/{$year}/0001");

        $response = $this->reserveNomor(['year' => $year]);

        $response->assertOk()
            ->assertJsonPath('next_nomor', 1)
            ->assertJsonPath('next_nomor_str', '0001')
            ->assertJsonPath('year', $year);
    }

    /** Harus kembalikan MAX + 1 dari nomor resmi yang ada */
    public function test_returns_max_plus_one(): void
    {
        $year = now()->year;

        $this->makeSkWithNomor("0100/PC.L/A.II/H-34.B/24.29/1/{$year}");
        $this->makeSkWithNomor("0150/PC.L/A.II/H-34.B/24.29/2/{$year}");
        $this->makeSkWithNomor("0099/PC.L/A.II/H-34.B/24.29/3/{$year}");

        $response = $this->reserveNomor(['year' => $year]);

        $response->assertOk()
            ->assertJsonPath('next_nomor', 151)
            ->assertJsonPath('next_nomor_str', '0151');
    }

    /** Nomor yang sudah soft-deleted TIDAK ikut dihitung */
    public function test_ignores_soft_deleted_records(): void
    {
        $year = now()->year;

        $this->makeSkWithNomor("0200/PC.L/A.II/H-34.B/24.29/1/{$year}");
        // Nomor 0500 soft-deleted — tidak boleh mempengaruhi MAX
        $this->makeSkWithNomor("0500/PC.L/A.II/H-34.B/24.29/1/{$year}", now()->toDateTimeString());

        $response = $this->reserveNomor(['year' => $year]);

        $response->assertOk()
            ->assertJsonPath('next_nomor', 201);
    }

    /** REQ/YYYY/NNNN tidak ikut dihitung sebagai nomor resmi */
    public function test_ignores_req_format_nomor(): void
    {
        $year = now()->year;

        // Hanya REQ format
        $this->makeSkWithNomor("REQ/{$year}/9999");

        $response = $this->reserveNomor(['year' => $year]);

        $response->assertOk()
            ->assertJsonPath('next_nomor', 1);
    }

    /** Harus filter berdasarkan tahun yang diminta */
    public function test_filters_by_year(): void
    {
        $currentYear = now()->year;
        $lastYear    = $currentYear - 1;

        // SK tahun lalu — nomor besar
        $this->makeSkWithNomor("1000/PC.L/A.II/H-34.B/24.29/1/{$lastYear}");
        // SK tahun ini — nomor kecil
        $this->makeSkWithNomor("0050/PC.L/A.II/H-34.B/24.29/1/{$currentYear}");

        $response = $this->reserveNomor(['year' => $currentYear]);

        // Harus kembalikan 51 (tahun ini), bukan 1001 (tahun lalu)
        $response->assertOk()
            ->assertJsonPath('next_nomor', 51);
    }

    /** Memanggil dua kali tanpa ada SK baru di antara dua call harus dapat nomor yang sama */
    public function test_idempotent_without_new_sk(): void
    {
        $year = now()->year;
        $this->makeSkWithNomor("0300/PC.L/A.II/H-34.B/24.29/1/{$year}");

        $r1 = $this->reserveNomor(['year' => $year]);
        $r2 = $this->reserveNomor(['year' => $year]);

        $r1->assertOk();
        $r2->assertOk();

        // Keduanya harus kembalikan 301 karena tidak ada SK baru yang disimpan
        $this->assertEquals($r1->json('next_nomor'), $r2->json('next_nomor'));
        $this->assertEquals(301, $r1->json('next_nomor'));
    }

    /** Response harus mengandung semua field yang dibutuhkan frontend */
    public function test_response_structure(): void
    {
        $year = now()->year;

        $response = $this->reserveNomor(['year' => $year]);

        $response->assertOk()
            ->assertJsonStructure([
                'next_nomor',
                'next_nomor_str',
                'year',
                'reserved_count',
            ]);
    }

    /** Default year adalah tahun ini jika tidak disertakan */
    public function test_defaults_to_current_year(): void
    {
        $year = now()->year;
        $this->makeSkWithNomor("0010/PC.L/A.II/H-34.B/24.29/1/{$year}");

        // Tanpa year parameter
        $response = $this->reserveNomor([]);

        $response->assertOk()
            ->assertJsonPath('year', $year)
            ->assertJsonPath('next_nomor', 11);
    }

    /** Harus memerlukan autentikasi */
    public function test_requires_authentication(): void
    {
        $this->postJson('/api/sk-documents/reserve-nomor', ['year' => now()->year])
            ->assertUnauthorized();
    }
}
