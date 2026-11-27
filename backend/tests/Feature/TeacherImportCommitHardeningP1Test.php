<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\Teacher;
use App\Models\User;
use App\Services\StrictDateValidationService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TeacherImportCommitHardeningP1Test extends TestCase
{
    use RefreshDatabase;

    private School $schoolA;
    private School $schoolB;
    private User $operatorA;
    private User $operatorB;

    public function setUp(): void
    {
        parent::setUp();

        $this->schoolA = School::factory()->create(['nama' => 'MI Ma\'arif Hardening A']);
        $this->schoolB = School::factory()->create(['nama' => 'MI Ma\'arif Hardening B']);

        $this->operatorA = User::factory()->create([
            'role'      => 'operator',
            'email'     => 'op-a-hardening@example.com',
            'school_id' => $this->schoolA->id,
            'is_active' => true,
        ]);

        $this->operatorB = User::factory()->create([
            'role'      => 'operator',
            'email'     => 'op-b-hardening@example.com',
            'school_id' => $this->schoolB->id,
            'is_active' => true,
        ]);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE A — F-01: Teacher Identity Matching Integrity
    // ═════════════════════════════════════════════════════════════════════════

    public function test_f01_same_name_different_nim_inserts_distinct_teacher_without_hijacking_existing_nim(): void
    {
        $existing = Teacher::factory()->create([
            'school_id'          => $this->schoolA->id,
            'nama'               => 'AHMAD FAUZI',
            'nomor_induk_maarif' => '113400001',
            'tanggal_lahir'      => null,
            'unit_kerja'         => $this->schoolA->nama,
        ]);

        $previewResp = $this->actingAs($this->operatorA)
            ->postJson('/api/teachers/import/preview', [
                'teachers' => [
                    [
                        'nama'               => 'Ahmad Fauzi',
                        'nomor_induk_maarif' => '113400002',
                        'pendidikan_terakhir'=> 'S2',
                    ],
                ],
            ]);
        $previewResp->assertOk();

        $commitResp = $this->actingAs($this->operatorA)
            ->postJson('/api/teachers/import/commit', [
                'teachers' => $previewResp->json('previews'),
            ]);
        $commitResp->assertOk()->assertJson(['success' => true]);

        // Harus ada 2 guru berbeda; NIM guru lama TIDAK boleh berubah!
        $this->assertEquals(2, Teacher::withoutTenantScope()->where('school_id', $this->schoolA->id)->count());
        $existing->refresh();
        $this->assertSame('113400001', $existing->nomor_induk_maarif);
        $this->assertDatabaseHas('teachers', [
            'school_id'          => $this->schoolA->id,
            'nomor_induk_maarif' => '113400002',
            'pendidikan_terakhir'=> 'S2',
        ]);
    }

    public function test_f01_same_name_different_dob_without_nim_inserts_distinct_teacher(): void
    {
        $existing = Teacher::factory()->create([
            'school_id'          => $this->schoolA->id,
            'nama'               => 'SITI AMINAH',
            'nomor_induk_maarif' => null,
            'tanggal_lahir'      => '1985-01-10',
            'unit_kerja'         => $this->schoolA->nama,
        ]);

        $previewResp = $this->actingAs($this->operatorA)
            ->postJson('/api/teachers/import/preview', [
                'teachers' => [
                    [
                        'nama'          => 'Siti Aminah',
                        'tanggal_lahir' => '03 Agustus 1995',
                    ],
                ],
            ]);
        $previewResp->assertOk();

        $commitResp = $this->actingAs($this->operatorA)
            ->postJson('/api/teachers/import/commit', [
                'teachers' => $previewResp->json('previews'),
            ]);
        $commitResp->assertOk();

        $this->assertEquals(2, Teacher::withoutTenantScope()->where('school_id', $this->schoolA->id)->count());
        $existing->refresh();
        $this->assertSame('1985-01-10', $existing->tanggal_lahir);
        $this->assertDatabaseHas('teachers', [
            'school_id'     => $this->schoolA->id,
            'tanggal_lahir' => '1995-08-03',
        ]);
    }

    public function test_f01_same_name_missing_dob_and_no_nim_returns_conflict_422_and_rolls_back(): void
    {
        $existing = Teacher::factory()->create([
            'school_id'           => $this->schoolA->id,
            'nama'                => 'BUDI SANTOSO',
            'nomor_induk_maarif'  => '113400055',
            'tanggal_lahir'       => '1985-01-10',
            'pendidikan_terakhir' => 'S1',
            'unit_kerja'          => $this->schoolA->nama,
        ]);

        // Batch campuran: baris 1 valid baru, baris 2 ambigu (nama sama tanpa NIM/DOB)
        $resp = $this->actingAs($this->operatorA)
            ->postJson('/api/teachers/import/commit', [
                'teachers' => [
                    [
                        'action'  => 'INSERT',
                        'payload' => [
                            'nama'               => 'GURU VALID ROLLBACK TEST',
                            'nomor_induk_maarif' => '113400099',
                        ],
                    ],
                    [
                        'action'  => 'INSERT',
                        'payload' => [
                            'nama'                => 'BUDI SANTOSO',
                            'pendidikan_terakhir' => 'S2',
                        ],
                    ],
                ],
            ]);

        $resp->assertStatus(422)
            ->assertJson(['success' => false]);
        $this->assertStringContainsString('ambigu', strtolower((string) $resp->json('message')));

        // Rollback total: guru baris 1 TIDAK tersimpan & guru eksisting TIDAK tertimpa
        $this->assertDatabaseMissing('teachers', ['nomor_induk_maarif' => '113400099']);
        $existing->refresh();
        $this->assertSame('S1', $existing->pendidikan_terakhir);
        $this->assertSame('113400055', $existing->nomor_induk_maarif);
    }

    public function test_f01_same_nim_on_different_school_is_rejected_without_touching_other_tenant(): void
    {
        $teacherB = Teacher::factory()->create([
            'school_id'          => $this->schoolB->id,
            'nama'               => 'GURU SEKOLAH B',
            'nomor_induk_maarif' => '113488888',
            'unit_kerja'         => $this->schoolB->nama,
        ]);

        $resp = $this->actingAs($this->operatorA)
            ->postJson('/api/teachers/import/commit', [
                'teachers' => [
                    [
                        'action'  => 'INSERT',
                        'payload' => [
                            'nama'               => 'GURU SEKOLAH A NIM BENTROK',
                            'nomor_induk_maarif' => '113488888',
                        ],
                    ],
                ],
            ]);

        $resp->assertStatus(422)
            ->assertJson(['success' => false]);

        $teacherB->refresh();
        $this->assertSame('GURU SEKOLAH B', $teacherB->nama);
        $this->assertSame($this->schoolB->id, $teacherB->school_id);
        $this->assertEquals(0, Teacher::withoutTenantScope()->where('school_id', $this->schoolA->id)->count());
    }

    public function test_f01_same_nim_same_school_updates_valid_attributes_idempotently(): void
    {
        $existing = Teacher::factory()->create([
            'school_id'           => $this->schoolA->id,
            'nama'                => 'DEWI LESTARI',
            'nomor_induk_maarif'  => '113477777',
            'pendidikan_terakhir' => 'S1',
            'tanggal_lahir'       => '1991-05-10',
            'unit_kerja'          => $this->schoolA->nama,
        ]);

        $previewResp = $this->actingAs($this->operatorA)
            ->postJson('/api/teachers/import/preview', [
                'teachers' => [
                    [
                        'nama'                => 'Dewi Lestari',
                        'nomor_induk_maarif'  => '113477777',
                        'pendidikan_terakhir' => 'S2 PAI',
                        'tanggal_lahir'       => '10 Mei 1991',
                    ],
                ],
            ]);
        $previewResp->assertOk();

        $previews = $previewResp->json('previews');
        // Simulasikan action INSERT (retry) terhadap guru dengan NIM identik di sekolah yang sama
        $previews[0]['action'] = 'INSERT';
        $previews[0]['target_id'] = null;

        $commitResp = $this->actingAs($this->operatorA)
            ->postJson('/api/teachers/import/commit', ['teachers' => $previews]);
        $commitResp->assertOk()->assertJson(['success' => true]);

        $this->assertEquals(1, Teacher::withoutTenantScope()->where('school_id', $this->schoolA->id)->count());
        $existing->refresh();
        $this->assertSame('S2 PAI', $existing->pendidikan_terakhir);
        $this->assertSame('113477777', $existing->nomor_induk_maarif);
    }

    public function test_f01_ambiguous_multiple_same_name_and_dob_candidates_returns_conflict_422(): void
    {
        Teacher::factory()->create([
            'school_id'     => $this->schoolA->id,
            'nama'          => 'MUHAMMAD ALI',
            'tanggal_lahir' => '1990-01-01',
            'unit_kerja'    => $this->schoolA->nama,
        ]);
        Teacher::factory()->create([
            'school_id'     => $this->schoolA->id,
            'nama'          => 'MUHAMMAD ALI',
            'tanggal_lahir' => '1990-01-01',
            'unit_kerja'    => $this->schoolA->nama,
        ]);

        $resp = $this->actingAs($this->operatorA)
            ->postJson('/api/teachers/import/commit', [
                'teachers' => [
                    [
                        'action'  => 'INSERT',
                        'payload' => [
                            'nama'          => 'MUHAMMAD ALI',
                            'tanggal_lahir' => '01 Januari 1990',
                        ],
                    ],
                ],
            ]);

        $resp->assertStatus(422)->assertJson(['success' => false]);
        $this->assertStringContainsString('ambigu', strtolower((string) $resp->json('message')));
        $this->assertEquals(2, Teacher::withoutTenantScope()->where('school_id', $this->schoolA->id)->count());
    }

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE C & D — F-03 & F-04: HMAC Secret Hardening, Row Binding & Expiry
    // ═════════════════════════════════════════════════════════════════════════

    public function test_f03_missing_or_empty_signing_key_fails_closed(): void
    {
        $svc = app(StrictDateValidationService::class);
        $origAppKey = config('app.key');
        $origDedicated = config('app.import_date_signing_key');

        try {
            // Missing key (null)
            config(['app.key' => null, 'app.import_date_signing_key' => null]);
            $this->assertFalse($svc->verifyNormalizedDates(['nama' => 'A', 'tanggal_lahir' => '1992-08-03'], 'v2.9999999999.' . str_repeat('a', 64), 1, 1));

            $threwOnNull = false;
            try {
                $svc->signNormalizedDates(['nama' => 'A', 'tanggal_lahir' => '1992-08-03'], 1, 1);
            } catch (\RuntimeException) {
                $threwOnNull = true;
            }
            $this->assertTrue($threwOnNull, 'signNormalizedDates must throw RuntimeException when signing key is null');

            // Empty / whitespace key
            config(['app.key' => '   ', 'app.import_date_signing_key' => '']);
            $this->assertFalse($svc->verifyNormalizedDates(['nama' => 'A', 'tanggal_lahir' => '1992-08-03'], 'v2.9999999999.' . str_repeat('a', 64), 1, 1));

            $threwOnEmpty = false;
            try {
                $svc->signNormalizedDates(['nama' => 'A', 'tanggal_lahir' => '1992-08-03'], 1, 1);
            } catch (\RuntimeException) {
                $threwOnEmpty = true;
            }
            $this->assertTrue($threwOnEmpty, 'signNormalizedDates must throw RuntimeException when signing key is empty');

            // Endpoint importPreview must fail-closed with 500 (not silently return empty previews)
            $prevResp = $this->actingAs($this->operatorA)
                ->postJson('/api/teachers/import/preview', [
                    'teachers' => [
                        ['nama' => 'Guru Key Missing', 'tanggal_lahir' => '03 Agustus 1992'],
                    ],
                ]);
            $prevResp->assertStatus(500)->assertJson(['success' => false]);
        } finally {
            config(['app.key' => $origAppKey, 'app.import_date_signing_key' => $origDedicated]);
        }
    }

    public function test_f03_dedicated_signing_key_and_key_rotation_require_fresh_preview(): void
    {
        $origDedicated = config('app.import_date_signing_key');
        try {
            config(['app.import_date_signing_key' => 'base64:first-dedicated-test-key-rotation-1']);
            $prevResp = $this->actingAs($this->operatorA)
                ->postJson('/api/teachers/import/preview', [
                    'teachers' => [
                        ['nama' => 'Guru Rotasi', 'nomor_induk_maarif' => '113460001', 'tanggal_lahir' => '03 Agustus 1992'],
                    ],
                ]);
            $prevResp->assertOk();
            $previews = $prevResp->json('previews');

            // Rotate key -> old signature MUST fail verification & force strict re-validation (422)
            config(['app.import_date_signing_key' => 'base64:second-rotated-test-key-rotation-2']);
            $commitResp = $this->actingAs($this->operatorA)
                ->postJson('/api/teachers/import/commit', ['teachers' => $previews]);
            $commitResp->assertStatus(422);
            $this->assertNotEmpty($commitResp->json('date_errors'));
            $this->assertDatabaseCount('teachers', 0);
        } finally {
            config(['app.import_date_signing_key' => $origDedicated]);
        }
    }

    public function test_f04_cross_row_transplant_identity_tampering_and_expiry_are_rejected(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 11, 26, 10, 0, 0, 'UTC'));
        try {
            $prevResp = $this->actingAs($this->operatorA)
                ->postJson('/api/teachers/import/preview', [
                    'teachers' => [
                        [
                            'nama'               => 'Guru Sumber Asli',
                            'nomor_induk_maarif' => '113461001',
                            'tanggal_lahir'      => '03 Agustus 1992',
                            'tmt'                => '15 Juli 2013',
                        ],
                    ],
                ]);
            $prevResp->assertOk();
            $row = $prevResp->json('previews')[0];
            $sig = $row['preview_date_signature'];
            $this->assertMatchesRegularExpression('/^v2\.\d+\.[a-f0-9]{64}$/', $sig);

            // 1. Cross-row transplant (different nama + different NIM, same user/school/dates) -> 422
            $transplanted = $row;
            $transplanted['payload']['nama'] = 'GURU LAIN TRANSPLANT';
            $transplanted['payload']['nomor_induk_maarif'] = '113461002';
            $respTransplant = $this->actingAs($this->operatorA)
                ->postJson('/api/teachers/import/commit', ['teachers' => [$transplanted]]);
            $respTransplant->assertStatus(422);
            $this->assertNotEmpty($respTransplant->json('date_errors'));

            // 2. Modified row identity (only NIM changed) -> 422
            $nimEdited = $row;
            $nimEdited['payload']['nomor_induk_maarif'] = '113461999';
            $respNimEdit = $this->actingAs($this->operatorA)
                ->postJson('/api/teachers/import/commit', ['teachers' => [$nimEdited]]);
            $respNimEdit->assertStatus(422);

            // 3. Cross-user & cross-school transplant -> 422
            $respCrossUser = $this->actingAs($this->operatorB)
                ->postJson('/api/teachers/import/commit', ['teachers' => [$row]]);
            $respCrossUser->assertStatus(422);

            // 4. Tampered future expiry timestamp in signature string -> 422
            $parts = explode('.', $sig);
            $forgedExpSig = 'v2.' . ((int) $parts[1] + 999999) . '.' . $parts[2];
            $forgedRow = $row;
            $forgedRow['preview_date_signature'] = $forgedExpSig;
            $respForgedExp = $this->actingAs($this->operatorA)
                ->postJson('/api/teachers/import/commit', ['teachers' => [$forgedRow]]);
            $respForgedExp->assertStatus(422);

            // 5. Expired signature (advance clock past 3600s TTL) -> 422
            Carbon::setTestNow(Carbon::create(2026, 11, 26, 12, 0, 1, 'UTC'));
            $respExpired = $this->actingAs($this->operatorA)
                ->postJson('/api/teachers/import/commit', ['teachers' => [$row]]);
            $respExpired->assertStatus(422);
            $this->assertNotEmpty($respExpired->json('date_errors'));

            $this->assertDatabaseCount('teachers', 0);
        } finally {
            Carbon::setTestNow();
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE E — F-05: Throwable Handling & Non-Leaking Safe Error Response
    // ═════════════════════════════════════════════════════════════════════════

    public function test_f05_commit_rollback_on_db_failure_does_not_leak_sql_internals(): void
    {
        $prevResp = $this->actingAs($this->operatorA)
            ->postJson('/api/teachers/import/preview', [
                'teachers' => [
                    [
                        'nama'               => 'Guru Valid Sebelum Error',
                        'nomor_induk_maarif' => '113462001',
                        'tanggal_lahir'      => '03 Agustus 1992',
                    ],
                ],
            ]);
        $validRow = $prevResp->json('previews')[0];

        // Row 2 triggers DB NOT NULL constraint on `nama`
        $resp = $this->actingAs($this->operatorA)
            ->postJson('/api/teachers/import/commit', [
                'teachers' => [
                    $validRow,
                    [
                        'action'  => 'INSERT',
                        'payload' => ['nama' => null, 'nomor_induk_maarif' => '113462002'],
                    ],
                ],
            ]);

        $resp->assertStatus(500)->assertJson(['success' => false]);
        $msg = (string) $resp->json('message');
        $this->assertStringNotContainsString('SQLSTATE', $msg);
        $this->assertStringNotContainsString('insert into', strtolower($msg));
        $this->assertStringContainsString('dibatalkan', strtolower($msg));

        // Zero partial persistence
        $this->assertDatabaseCount('teachers', 0);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE F — F-06: Date Normalization Completeness (tanggal_surat_permohonan)
    // ═════════════════════════════════════════════════════════════════════════

    public function test_f06_unsigned_valid_tanggal_surat_permohonan_is_normalized_and_ambiguous_rejected(): void
    {
        $okResp = $this->actingAs($this->operatorA)
            ->postJson('/api/teachers/import/commit', [
                'teachers' => [
                    [
                        'action'  => 'INSERT',
                        'payload' => [
                            'nama'                     => 'GURU F06 NORMALIZED',
                            'nomor_induk_maarif'       => '113463001',
                            'tanggal_lahir'            => '03 Aug 1992',
                            'tmt'                      => '21 Agst 2020',
                            'tanggal_surat_permohonan' => '11-Mei-2022',
                        ],
                    ],
                ],
            ]);

        $okResp->assertOk()->assertJson(['success' => true]);
        $this->assertDatabaseHas('teachers', [
            'nomor_induk_maarif'       => '113463001',
            'tanggal_lahir'            => '1992-08-03',
            'tmt'                      => '2020-08-21',
            'tanggal_surat_permohonan' => '2022-05-11',
        ]);

        // Ambiguous numeric tanggal_surat_permohonan must still be rejected 422
        $badResp = $this->actingAs($this->operatorA)
            ->postJson('/api/teachers/import/commit', [
                'teachers' => [
                    [
                        'action'  => 'INSERT',
                        'payload' => [
                            'nama'                     => 'GURU F06 AMBIGU',
                            'nomor_induk_maarif'       => '113463002',
                            'tanggal_surat_permohonan' => '11/12/2022',
                        ],
                    ],
                ],
            ]);

        $badResp->assertStatus(422);
        $this->assertNotEmpty($badResp->json('date_errors'));
        $this->assertDatabaseMissing('teachers', ['nomor_induk_maarif' => '113463002']);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE B — F-02: Lock Key Determinism & Release Verification
    // ═════════════════════════════════════════════════════════════════════════

    public function test_f02_commit_lock_is_released_after_error_allowing_subsequent_commit(): void
    {
        // Trigger a 422 conflict rollback first, then immediately commit a valid row for the same school
        Teacher::factory()->create([
            'school_id'  => $this->schoolA->id,
            'nama'       => 'GURU LOCK TEST',
            'unit_kerja' => $this->schoolA->nama,
        ]);

        $failResp = $this->actingAs($this->operatorA)
            ->postJson('/api/teachers/import/commit', [
                'teachers' => [
                    ['action' => 'INSERT', 'payload' => ['nama' => 'GURU LOCK TEST']],
                ],
            ]);
        $failResp->assertStatus(422);

        // Lock MUST be released so next commit succeeds immediately without timeout
        $okResp = $this->actingAs($this->operatorA)
            ->postJson('/api/teachers/import/commit', [
                'teachers' => [
                    [
                        'action'  => 'INSERT',
                        'payload' => [
                            'nama'               => 'GURU SETELAH LOCK RELEASE',
                            'nomor_induk_maarif' => '113464001',
                            'tanggal_lahir'      => '03 Agustus 1992',
                        ],
                    ],
                ],
            ]);
        $okResp->assertOk()->assertJson(['success' => true]);
        $this->assertDatabaseHas('teachers', ['nomor_induk_maarif' => '113464001']);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // VA-01 / VA-02 / VA-03 REMEDIATION VERIFICATION TESTS
    // ═════════════════════════════════════════════════════════════════════════

    public function test_va03_lock_timeout_returns_409_with_lock_timeout_code_instead_of_500(): void
    {
        $origBlock = config('app.import_commit_lock_block_seconds');
        $lock = \Illuminate\Support\Facades\Cache::store(config('cache.default'))
            ->lock("teacher_import_commit:school:{$this->schoolA->id}", 90);
        $this->assertTrue($lock->get());

        try {
            config(['app.import_commit_lock_block_seconds' => 1]);

            $resp = $this->actingAs($this->operatorA)
                ->postJson('/api/teachers/import/commit', [
                    'teachers' => [
                        [
                            'action'  => 'INSERT',
                            'payload' => [
                                'nama'               => 'GURU LOCK TIMEOUT TEST',
                                'nomor_induk_maarif' => '113465001',
                                'tanggal_lahir'      => '03 Agustus 1992',
                            ],
                        ],
                    ],
                ]);

            $resp->assertStatus(409)
                ->assertJson([
                    'success' => false,
                    'code'    => 'LOCK_TIMEOUT',
                ]);
            $this->assertStringContainsString('madrasah terkait', strtolower((string) $resp->json('message')));
            $this->assertDatabaseMissing('teachers', ['nomor_induk_maarif' => '113465001']);
        } finally {
            $lock->release();
            config(['app.import_commit_lock_block_seconds' => $origBlock]);
        }
    }

    public function test_va02_super_admin_update_resolves_target_teacher_school_id_and_global_identity_locks(): void
    {
        $teacherB = Teacher::factory()->create([
            'school_id'          => $this->schoolB->id,
            'nama'               => 'GURU TARGET LOCK',
            'nomor_induk_maarif' => null,
            'unit_kerja'         => $this->schoolB->nama,
        ]);

        $controller = app(\App\Http\Controllers\Api\TeacherController::class);
        $method = new \ReflectionMethod($controller, 'resolveCommitLockTargets');
        $method->setAccessible(true);

        $targets = $method->invoke($controller, [
            [
                'action'    => 'UPDATE',
                'target_id' => $teacherB->id,
                'payload'   => [
                    'nomor_induk_maarif' => '113499002',
                    'nuptk'              => '8877665544332212',
                ],
            ],
            [
                'action'    => 'INSERT',
                'target_id' => null,
                'payload'   => [
                    'school_id'          => $this->schoolA->id,
                    'nomor_induk_maarif' => '113499001',
                    'nuptk'              => '8877665544332211',
                ],
            ],
        ], false, 0);

        $expectedSchools = [$this->schoolA->id, $this->schoolB->id];
        sort($expectedSchools, SORT_NUMERIC);

        $this->assertSame($expectedSchools, $targets['school_ids']);
        $this->assertSame(['113499001', '113499002'], $targets['nims']);
        $this->assertSame(['8877665544332211', '8877665544332212'], $targets['nuptks']);
    }

    public function test_va01_update_claiming_nim_or_nuptk_of_another_school_returns_422_conflict(): void
    {
        Teacher::factory()->create([
            'school_id'          => $this->schoolB->id,
            'nama'               => 'GURU SEKOLAH B EXISTING',
            'nomor_induk_maarif' => '113466001',
            'nuptk'              => '7766554433221100',
            'unit_kerja'         => $this->schoolB->nama,
        ]);

        $teacherA = Teacher::factory()->create([
            'school_id'          => $this->schoolA->id,
            'nama'               => 'GURU SEKOLAH A TANPA NIM',
            'nomor_induk_maarif' => null,
            'nuptk'              => null,
            'unit_kerja'         => $this->schoolA->nama,
        ]);

        $respNim = $this->actingAs($this->operatorA)
            ->postJson('/api/teachers/import/commit', [
                'teachers' => [
                    [
                        'action'    => 'UPDATE',
                        'target_id' => $teacherA->id,
                        'payload'   => [
                            'nomor_induk_maarif' => '113466001',
                        ],
                    ],
                ],
            ]);
        $respNim->assertStatus(422)->assertJson(['success' => false]);

        $respNuptk = $this->actingAs($this->operatorA)
            ->postJson('/api/teachers/import/commit', [
                'teachers' => [
                    [
                        'action'    => 'UPDATE',
                        'target_id' => $teacherA->id,
                        'payload'   => [
                            'nuptk' => '7766554433221100',
                        ],
                    ],
                ],
            ]);
        $respNuptk->assertStatus(422)->assertJson(['success' => false]);

        $teacherA->refresh();
        $this->assertNull($teacherA->nomor_induk_maarif);
        $this->assertNull($teacherA->nuptk);
    }

    public function test_va01_and_va03_exception_classification_helpers_detect_23505_and_55p03(): void
    {
        $controller = app(\App\Http\Controllers\Api\TeacherController::class);

        $isUnique = new \ReflectionMethod($controller, 'isUniqueConstraintViolation');
        $isUnique->setAccessible(true);

        $isLockTimeout = new \ReflectionMethod($controller, 'isLockTimeoutException');
        $isLockTimeout->setAccessible(true);

        $pdo23505 = new \PDOException('duplicate key value violates unique constraint');
        $pdo23505->errorInfo = ['23505', 7, 'duplicate key'];
        $q23505 = new \Illuminate\Database\QueryException('pgsql', 'insert into teachers ...', [], $pdo23505);
        $u23505 = new \Illuminate\Database\UniqueConstraintViolationException('pgsql', 'insert into teachers ...', [], $pdo23505);

        $this->assertTrue($isUnique->invoke($controller, $u23505));
        $this->assertTrue($isUnique->invoke($controller, $q23505));
        $this->assertTrue($isUnique->invoke($controller, $pdo23505));
        $this->assertFalse($isUnique->invoke($controller, new \RuntimeException('other')));

        $pdo55p03 = new \PDOException('canceling statement due to lock timeout');
        $pdo55p03->errorInfo = ['55P03', 7, 'lock timeout'];
        $q55p03 = new \Illuminate\Database\QueryException('pgsql', 'SELECT pg_advisory_xact_lock($1)', [], $pdo55p03);

        $this->assertTrue($isLockTimeout->invoke($controller, new \Illuminate\Contracts\Cache\LockTimeoutException()));
        $this->assertTrue($isLockTimeout->invoke($controller, $q55p03));
        $this->assertTrue($isLockTimeout->invoke($controller, $pdo55p03));
        $this->assertFalse($isLockTimeout->invoke($controller, $u23505));
    }
}

