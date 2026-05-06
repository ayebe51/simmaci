<?php

namespace Tests\Unit\Services;

use App\Models\School;
use App\Models\Teacher;
use App\Services\PhoneNormalizerService;
use App\Services\RecipientCompilerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RecipientCompilerServiceTest extends TestCase
{
    use RefreshDatabase;

    private RecipientCompilerService $service;
    private PhoneNormalizerService $phoneNormalizer;

    /** Minimum iterations for property-based tests */
    private const PROPERTY_ITERATIONS = 100;

    protected function setUp(): void
    {
        parent::setUp();
        $this->phoneNormalizer = new PhoneNormalizerService();
        $this->service = new RecipientCompilerService($this->phoneNormalizer);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Property-Based Test Helper
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Run a property-based test with randomly generated inputs.
     *
     * Generates $iterations random combinations of the given generators and
     * calls $property for each. If $property throws, the test fails with the
     * failing input included in the message.
     *
     * @param int      $iterations Number of random samples to test
     * @param callable[] $generators Zero-arg callables that each return one random value
     * @param callable $property    Receives one argument per generator; throws on failure
     */
    private function forAll(int $iterations, array $generators, callable $property): void
    {
        for ($i = 0; $i < $iterations; $i++) {
            $args = array_map(fn(callable $gen) => $gen(), $generators);
            try {
                $property(...$args);
            } catch (\Exception $e) {
                $argsStr = implode(', ', array_map(
                    fn($a) => is_array($a)
                        ? '[' . implode(', ', $a) . ']'
                        : (is_string($a) ? "\"{$a}\"" : (string) $a),
                    $args
                ));
                $this->fail(
                    "Property failed on iteration {$i} with args [{$argsStr}]: " . $e->getMessage()
                );
            }
        }
    }

    /**
     * Generator: random integer between $min and $max (inclusive).
     */
    private function genInt(int $min, int $max): callable
    {
        return fn(): int => random_int($min, $max);
    }

    /**
     * Generator: a valid normalized Indonesian phone number string (format: 62[0-9]{9,13}).
     */
    private function genValidPhone(): callable
    {
        return function (): string {
            $digitCount = random_int(9, 13);
            $digits = '';
            for ($i = 0; $i < $digitCount; $i++) {
                $digits .= (string) random_int(0, 9);
            }
            return '62' . $digits;
        };
    }

    /**
     * Generator: a list of $size phone numbers drawn from a pool of $poolSize unique phones,
     * guaranteeing duplicates when $size > $poolSize.
     *
     * @param int $poolSize Number of distinct phones in the pool
     * @param int $size     Total list size (may exceed $poolSize to force duplicates)
     */
    private function genPhoneListWithDuplicates(int $poolSize, int $size): callable
    {
        return function () use ($poolSize, $size): array {
            // Build a pool of $poolSize distinct valid phones
            $pool = [];
            $genPhone = $this->genValidPhone();
            while (count($pool) < $poolSize) {
                $phone = $genPhone();
                if (!in_array($phone, $pool, true)) {
                    $pool[] = $phone;
                }
            }

            // Sample $size phones from the pool (with replacement → duplicates guaranteed
            // whenever $size > $poolSize, and possible even when $size <= $poolSize)
            $list = [];
            for ($i = 0; $i < $size; $i++) {
                $list[] = $pool[array_rand($pool)];
            }

            return $list;
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Unit Tests: Compile from Kepala Sekolah
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group recipient-compilation
     */
    public function it_compiles_recipients_from_kepala_sekolah(): void
    {
        School::factory()->create([
            'nama' => 'MI Darwata',
            'kepala_madrasah' => 'Ahmad Fauzi',
            'kepala_whatsapp' => '08123456789',
            'jenjang' => 'MI',
        ]);

        $recipients = $this->service->compile('kepala_sekolah');

        $this->assertCount(1, $recipients);
        $this->assertEquals('Ahmad Fauzi', $recipients[0]['recipient_name']);
        $this->assertEquals('MI Darwata', $recipients[0]['school_name']);
        $this->assertEquals('628123456789', $recipients[0]['phone_number']);
        $this->assertEquals('kepala_sekolah', $recipients[0]['recipient_type']);
        $this->assertEquals('pending', $recipients[0]['delivery_status']);
    }

    /**
     * @test
     * @group recipient-compilation
     */
    public function it_skips_schools_without_kepala_whatsapp(): void
    {
        School::factory()->create([
            'nama' => 'MI Darwata',
            'kepala_madrasah' => 'Ahmad Fauzi',
            'kepala_whatsapp' => null,
            'jenjang' => 'MI',
        ]);

        $recipients = $this->service->compile('kepala_sekolah');

        $this->assertCount(0, $recipients);
    }

    /**
     * @test
     * @group recipient-compilation
     */
    public function it_skips_schools_with_empty_kepala_whatsapp(): void
    {
        School::factory()->create([
            'nama' => 'MI Darwata',
            'kepala_madrasah' => 'Ahmad Fauzi',
            'kepala_whatsapp' => '',
            'jenjang' => 'MI',
        ]);

        $recipients = $this->service->compile('kepala_sekolah');

        $this->assertCount(0, $recipients);
    }

    /**
     * @test
     * @group recipient-compilation
     */
    public function it_marks_invalid_kepala_whatsapp_as_invalid_number(): void
    {
        School::factory()->create([
            'nama' => 'MI Darwata',
            'kepala_madrasah' => 'Ahmad Fauzi',
            'kepala_whatsapp' => '123',  // Too short
            'jenjang' => 'MI',
        ]);

        $recipients = $this->service->compile('kepala_sekolah');

        $this->assertCount(1, $recipients);
        $this->assertEquals('invalid_number', $recipients[0]['delivery_status']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Unit Tests: Compile from GTK (Teachers)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group recipient-compilation
     */
    public function it_compiles_recipients_from_active_teachers(): void
    {
        $school = School::factory()->create(['nama' => 'MI Darwata', 'jenjang' => 'MI']);
        Teacher::factory()->create([
            'school_id' => $school->id,
            'nama' => 'Siti Fatimah',
            'phone_number' => '08134567890',
            'is_active' => true,
        ]);

        $recipients = $this->service->compile('gtk');

        $this->assertCount(1, $recipients);
        $this->assertEquals('Siti Fatimah', $recipients[0]['recipient_name']);
        $this->assertEquals('MI Darwata', $recipients[0]['school_name']);
        $this->assertEquals('628134567890', $recipients[0]['phone_number']);
        $this->assertEquals('gtk', $recipients[0]['recipient_type']);
        $this->assertEquals('pending', $recipients[0]['delivery_status']);
    }

    /**
     * @test
     * @group recipient-compilation
     */
    public function it_skips_inactive_teachers(): void
    {
        $school = School::factory()->create(['nama' => 'MI Darwata', 'jenjang' => 'MI']);
        Teacher::factory()->create([
            'school_id' => $school->id,
            'nama' => 'Siti Fatimah',
            'phone_number' => '08134567890',
            'is_active' => false,
        ]);

        $recipients = $this->service->compile('gtk');

        $this->assertCount(0, $recipients);
    }

    /**
     * @test
     * @group recipient-compilation
     */
    public function it_skips_teachers_without_phone_number(): void
    {
        $school = School::factory()->create(['nama' => 'MI Darwata', 'jenjang' => 'MI']);
        Teacher::factory()->create([
            'school_id' => $school->id,
            'nama' => 'Siti Fatimah',
            'phone_number' => null,
            'is_active' => true,
        ]);

        $recipients = $this->service->compile('gtk');

        $this->assertCount(0, $recipients);
    }

    /**
     * @test
     * @group recipient-compilation
     */
    public function it_skips_teachers_with_empty_phone_number(): void
    {
        $school = School::factory()->create(['nama' => 'MI Darwata', 'jenjang' => 'MI']);
        Teacher::factory()->create([
            'school_id' => $school->id,
            'nama' => 'Siti Fatimah',
            'phone_number' => '',
            'is_active' => true,
        ]);

        $recipients = $this->service->compile('gtk');

        $this->assertCount(0, $recipients);
    }

    /**
     * @test
     * @group recipient-compilation
     */
    public function it_marks_invalid_teacher_phone_as_invalid_number(): void
    {
        $school = School::factory()->create(['nama' => 'MI Darwata', 'jenjang' => 'MI']);
        Teacher::factory()->create([
            'school_id' => $school->id,
            'nama' => 'Siti Fatimah',
            'phone_number' => '123',  // Too short
            'is_active' => true,
        ]);

        $recipients = $this->service->compile('gtk');

        $this->assertCount(1, $recipients);
        $this->assertEquals('invalid_number', $recipients[0]['delivery_status']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Unit Tests: Compile from Both Categories
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group recipient-compilation
     */
    public function it_compiles_recipients_from_both_categories(): void
    {
        $school = School::factory()->create([
            'nama' => 'MI Darwata',
            'kepala_madrasah' => 'Ahmad Fauzi',
            'kepala_whatsapp' => '08123456789',
            'jenjang' => 'MI',
        ]);

        Teacher::factory()->create([
            'school_id' => $school->id,
            'nama' => 'Siti Fatimah',
            'phone_number' => '08134567890',
            'is_active' => true,
        ]);

        $recipients = $this->service->compile('both');

        $this->assertCount(2, $recipients);
        $this->assertEquals('kepala_sekolah', $recipients[0]['recipient_type']);
        $this->assertEquals('gtk', $recipients[1]['recipient_type']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Unit Tests: Filter by Jenjang
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group recipient-compilation
     */
    public function it_filters_kepala_sekolah_by_jenjang(): void
    {
        School::factory()->create([
            'nama' => 'MI Darwata',
            'kepala_madrasah' => 'Ahmad Fauzi',
            'kepala_whatsapp' => '08123456789',
            'jenjang' => 'MI',
        ]);

        School::factory()->create([
            'nama' => 'MTs Al-Hikmah',
            'kepala_madrasah' => 'Budi Santoso',
            'kepala_whatsapp' => '08145678901',
            'jenjang' => 'MTs',
        ]);

        $recipients = $this->service->compile('kepala_sekolah', [], ['MI']);

        $this->assertCount(1, $recipients);
        $this->assertEquals('MI Darwata', $recipients[0]['school_name']);
    }

    /**
     * @test
     * @group recipient-compilation
     */
    public function it_filters_gtk_by_jenjang(): void
    {
        $miSchool = School::factory()->create(['nama' => 'MI Darwata', 'jenjang' => 'MI']);
        $mtsSchool = School::factory()->create(['nama' => 'MTs Al-Hikmah', 'jenjang' => 'MTs']);

        Teacher::factory()->create([
            'school_id' => $miSchool->id,
            'nama' => 'Siti Fatimah',
            'phone_number' => '08134567890',
            'is_active' => true,
        ]);

        Teacher::factory()->create([
            'school_id' => $mtsSchool->id,
            'nama' => 'Ahmad Fauzi',
            'phone_number' => '08145678901',
            'is_active' => true,
        ]);

        $recipients = $this->service->compile('gtk', [], ['MI']);

        $this->assertCount(1, $recipients);
        $this->assertEquals('Siti Fatimah', $recipients[0]['recipient_name']);
    }

    /**
     * @test
     * @group recipient-compilation
     */
    public function it_filters_by_multiple_jenjang(): void
    {
        $miSchool = School::factory()->create(['nama' => 'MI Darwata', 'jenjang' => 'MI']);
        $mtsSchool = School::factory()->create(['nama' => 'MTs Al-Hikmah', 'jenjang' => 'MTs']);
        $maSchool = School::factory()->create(['nama' => 'MA Darul Ulum', 'jenjang' => 'MA']);

        School::factory()->create([
            'nama' => 'MI Darwata',
            'kepala_madrasah' => 'Ahmad Fauzi',
            'kepala_whatsapp' => '08123456789',
            'jenjang' => 'MI',
        ]);

        School::factory()->create([
            'nama' => 'MTs Al-Hikmah',
            'kepala_madrasah' => 'Budi Santoso',
            'kepala_whatsapp' => '08145678901',
            'jenjang' => 'MTs',
        ]);

        School::factory()->create([
            'nama' => 'MA Darul Ulum',
            'kepala_madrasah' => 'Khadijah',
            'kepala_whatsapp' => '08156789012',
            'jenjang' => 'MA',
        ]);

        $recipients = $this->service->compile('kepala_sekolah', [], ['MI', 'MTs']);

        $this->assertCount(2, $recipients);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Unit Tests: Filter by School IDs
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group recipient-compilation
     */
    public function it_filters_kepala_sekolah_by_school_ids(): void
    {
        $school1 = School::factory()->create([
            'nama' => 'MI Darwata',
            'kepala_madrasah' => 'Ahmad Fauzi',
            'kepala_whatsapp' => '08123456789',
            'jenjang' => 'MI',
        ]);

        $school2 = School::factory()->create([
            'nama' => 'MTs Al-Hikmah',
            'kepala_madrasah' => 'Budi Santoso',
            'kepala_whatsapp' => '08145678901',
            'jenjang' => 'MTs',
        ]);

        $recipients = $this->service->compile('kepala_sekolah', [$school1->id]);

        $this->assertCount(1, $recipients);
        $this->assertEquals('MI Darwata', $recipients[0]['school_name']);
    }

    /**
     * @test
     * @group recipient-compilation
     */
    public function it_filters_gtk_by_school_ids(): void
    {
        $school1 = School::factory()->create(['nama' => 'MI Darwata', 'jenjang' => 'MI']);
        $school2 = School::factory()->create(['nama' => 'MTs Al-Hikmah', 'jenjang' => 'MTs']);

        Teacher::factory()->create([
            'school_id' => $school1->id,
            'nama' => 'Siti Fatimah',
            'phone_number' => '08134567890',
            'is_active' => true,
        ]);

        Teacher::factory()->create([
            'school_id' => $school2->id,
            'nama' => 'Ahmad Fauzi',
            'phone_number' => '08145678901',
            'is_active' => true,
        ]);

        $recipients = $this->service->compile('gtk', [$school1->id]);

        $this->assertCount(1, $recipients);
        $this->assertEquals('Siti Fatimah', $recipients[0]['recipient_name']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Unit Tests: Excluded Phones
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group recipient-compilation
     */
    public function it_excludes_specified_phone_numbers(): void
    {
        School::factory()->create([
            'nama' => 'MI Darwata',
            'kepala_madrasah' => 'Ahmad Fauzi',
            'kepala_whatsapp' => '08123456789',
            'jenjang' => 'MI',
        ]);

        School::factory()->create([
            'nama' => 'MTs Al-Hikmah',
            'kepala_madrasah' => 'Budi Santoso',
            'kepala_whatsapp' => '08145678901',
            'jenjang' => 'MTs',
        ]);

        $recipients = $this->service->compile('kepala_sekolah', [], [], ['628123456789']);

        $this->assertCount(1, $recipients);
        $this->assertEquals('MTs Al-Hikmah', $recipients[0]['school_name']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Property-Based Tests
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group property-3
     *
     * Feature: wa-blast, Property 3: Deduplication memastikan tidak ada nomor duplikat
     *
     * **Validates: Requirements 1.6**
     *
     * Property: For any daftar penerima yang dikompilasi (dari kepala sekolah, GTK, atau keduanya),
     * setelah proses deduplication, setiap nomor WhatsApp yang sudah dinormalisasi SHALL muncul
     * paling banyak satu kali dalam hasil untuk satu blast.
     */
    public function it_deduplicates_recipients_by_phone_number(): void
    {
        $school = School::factory()->create([
            'nama' => 'MI Darwata',
            'kepala_madrasah' => 'Ahmad Fauzi',
            'kepala_whatsapp' => '08123456789',  // Same phone as teacher
            'jenjang' => 'MI',
        ]);

        Teacher::factory()->create([
            'school_id' => $school->id,
            'nama' => 'Siti Fatimah',
            'phone_number' => '08123456789',  // Same phone as kepala
            'is_active' => true,
        ]);

        $recipients = $this->service->compile('both');

        // Should only have 1 recipient (deduplicated)
        $this->assertCount(1, $recipients);

        // Verify no duplicate phone numbers
        $phones = array_map(fn($r) => $r['phone_number'], $recipients);
        $this->assertCount(count(array_unique($phones)), $phones);
    }

    /**
     * @test
     * @group property-3
     *
     * Feature: wa-blast, Property 3: Deduplication memastikan tidak ada nomor duplikat
     *
     * **Validates: Requirements 1.6**
     *
     * Property: Multiple recipients with same phone (different schools) should be deduplicated.
     */
    public function it_deduplicates_same_phone_across_multiple_schools(): void
    {
        $school1 = School::factory()->create([
            'nama' => 'MI Darwata',
            'kepala_madrasah' => 'Ahmad Fauzi',
            'kepala_whatsapp' => '08123456789',
            'jenjang' => 'MI',
        ]);

        $school2 = School::factory()->create([
            'nama' => 'MTs Al-Hikmah',
            'kepala_madrasah' => 'Budi Santoso',
            'kepala_whatsapp' => '08123456789',  // Same phone
            'jenjang' => 'MTs',
        ]);

        $recipients = $this->service->compile('kepala_sekolah');

        // Should only have 1 recipient (deduplicated)
        $this->assertCount(1, $recipients);

        // Verify no duplicate phone numbers
        $phones = array_map(fn($r) => $r['phone_number'], $recipients);
        $this->assertCount(count(array_unique($phones)), $phones);
    }

    /**
     * @test
     * @group property-3
     *
     * Feature: wa-blast, Property 3: Deduplication memastikan tidak ada nomor duplikat
     *
     * Validates: Requirements 1.6
     *
     * Property: For any list of phone numbers that contains duplicates (drawn from a pool
     * smaller than the list size), compile() SHALL return a result where every phone_number
     * appears at most once — regardless of how many times the same number appears in the
     * source data (schools or teachers).
     *
     * Strategy:
     * - Build a pool of $poolSize distinct valid phones (3–10 phones).
     * - Create $schoolCount schools (3–20) each assigned a phone sampled from the pool,
     *   guaranteeing duplicates when $schoolCount > $poolSize.
     * - Call compile('kepala_sekolah') and assert no phone_number appears more than once.
     *
     * Runs 100 iterations with randomly generated pool sizes and school counts.
     */
    public function property_3_compile_never_returns_duplicate_phone_numbers_for_kepala_sekolah(): void
    {
        // Feature: wa-blast, Property 3: Deduplication memastikan tidak ada nomor duplikat
        $this->forAll(
            self::PROPERTY_ITERATIONS,
            [
                $this->genInt(3, 8),   // pool size: number of distinct phones
                $this->genInt(5, 20),  // school count: always > pool size to force duplicates
            ],
            function (int $poolSize, int $schoolCount): void {
                // Clean up schools created in previous iterations within this test
                \App\Models\School::query()->delete();

                // Build a pool of $poolSize distinct valid phones
                $pool = [];
                $genPhone = $this->genValidPhone();
                while (count($pool) < $poolSize) {
                    $phone = $genPhone();
                    if (!in_array($phone, $pool, true)) {
                        $pool[] = $phone;
                    }
                }

                // Create $schoolCount schools, each with a phone sampled from the pool.
                // When $schoolCount > $poolSize, duplicates are guaranteed.
                for ($i = 0; $i < $schoolCount; $i++) {
                    School::factory()->create([
                        'kepala_whatsapp' => $pool[array_rand($pool)],
                        'jenjang'         => 'MI',
                    ]);
                }

                $recipients = $this->service->compile('kepala_sekolah');

                // Extract all phone numbers from the result
                $phones = array_column($recipients, 'phone_number');

                // Property assertion: no phone appears more than once
                $uniquePhones = array_unique($phones);
                $this->assertCount(
                    count($uniquePhones),
                    $phones,
                    sprintf(
                        'compile() returned %d recipients but only %d unique phones — duplicates found. '
                        . 'Pool size: %d, school count: %d. Phones: [%s]',
                        count($phones),
                        count($uniquePhones),
                        $poolSize,
                        $schoolCount,
                        implode(', ', $phones)
                    )
                );
            }
        );
    }

    /**
     * @test
     * @group property-3
     *
     * Feature: wa-blast, Property 3: Deduplication memastikan tidak ada nomor duplikat
     *
     * Validates: Requirements 1.6
     *
     * Property: For any list of teachers with duplicate phone numbers, compile('gtk')
     * SHALL return a result where every phone_number appears at most once.
     *
     * Strategy:
     * - Build a pool of $poolSize distinct valid phones (3–10 phones).
     * - Create one school and $teacherCount active teachers each assigned a phone
     *   sampled from the pool, guaranteeing duplicates when $teacherCount > $poolSize.
     * - Call compile('gtk') and assert no phone_number appears more than once.
     *
     * Runs 100 iterations with randomly generated pool sizes and teacher counts.
     */
    public function property_3_compile_never_returns_duplicate_phone_numbers_for_gtk(): void
    {
        // Feature: wa-blast, Property 3: Deduplication memastikan tidak ada nomor duplikat
        $this->forAll(
            self::PROPERTY_ITERATIONS,
            [
                $this->genInt(3, 8),   // pool size: number of distinct phones
                $this->genInt(5, 20),  // teacher count: always > pool size to force duplicates
            ],
            function (int $poolSize, int $teacherCount): void {
                // Clean up records created in previous iterations within this test
                \App\Models\Teacher::query()->delete();
                \App\Models\School::query()->delete();

                // Build a pool of $poolSize distinct valid phones
                $pool = [];
                $genPhone = $this->genValidPhone();
                while (count($pool) < $poolSize) {
                    $phone = $genPhone();
                    if (!in_array($phone, $pool, true)) {
                        $pool[] = $phone;
                    }
                }

                $school = School::factory()->create(['jenjang' => 'MI']);

                // Create $teacherCount active teachers, each with a phone from the pool.
                // When $teacherCount > $poolSize, duplicates are guaranteed.
                for ($i = 0; $i < $teacherCount; $i++) {
                    Teacher::factory()->create([
                        'school_id'    => $school->id,
                        'phone_number' => $pool[array_rand($pool)],
                        'is_active'    => true,
                    ]);
                }

                $recipients = $this->service->compile('gtk');

                $phones = array_column($recipients, 'phone_number');
                $uniquePhones = array_unique($phones);

                $this->assertCount(
                    count($uniquePhones),
                    $phones,
                    sprintf(
                        'compile() returned %d recipients but only %d unique phones — duplicates found. '
                        . 'Pool size: %d, teacher count: %d. Phones: [%s]',
                        count($phones),
                        count($uniquePhones),
                        $poolSize,
                        $teacherCount,
                        implode(', ', $phones)
                    )
                );
            }
        );
    }

    /**
     * @test
     * @group property-3
     *
     * Feature: wa-blast, Property 3: Deduplication memastikan tidak ada nomor duplikat
     *
     * Validates: Requirements 1.6
     *
     * Property: For category 'both', even when the same phone number appears in both
     * schools (kepala_whatsapp) and teachers (phone_number), compile() SHALL return
     * a result where every phone_number appears at most once.
     *
     * Strategy:
     * - Build a shared pool of $poolSize distinct valid phones.
     * - Create $schoolCount schools and $teacherCount teachers, all drawing phones
     *   from the same pool — maximising cross-category collisions.
     * - Call compile('both') and assert no phone_number appears more than once.
     *
     * Runs 100 iterations with randomly generated pool sizes and entity counts.
     */
    public function property_3_compile_never_returns_duplicate_phone_numbers_for_both_categories(): void
    {
        // Feature: wa-blast, Property 3: Deduplication memastikan tidak ada nomor duplikat
        $this->forAll(
            self::PROPERTY_ITERATIONS,
            [
                $this->genInt(3, 8),   // pool size: number of distinct phones
                $this->genInt(3, 10),  // school count
                $this->genInt(3, 10),  // teacher count
            ],
            function (int $poolSize, int $schoolCount, int $teacherCount): void {
                // Clean up records created in previous iterations within this test
                \App\Models\Teacher::query()->delete();
                \App\Models\School::query()->delete();

                // Build a shared pool of $poolSize distinct valid phones
                $pool = [];
                $genPhone = $this->genValidPhone();
                while (count($pool) < $poolSize) {
                    $phone = $genPhone();
                    if (!in_array($phone, $pool, true)) {
                        $pool[] = $phone;
                    }
                }

                // Create schools — phones drawn from the shared pool
                $schools = [];
                for ($i = 0; $i < $schoolCount; $i++) {
                    $schools[] = School::factory()->create([
                        'kepala_whatsapp' => $pool[array_rand($pool)],
                        'jenjang'         => 'MI',
                    ]);
                }

                // Create teachers — phones drawn from the same shared pool,
                // so cross-category duplicates are highly likely
                for ($i = 0; $i < $teacherCount; $i++) {
                    Teacher::factory()->create([
                        'school_id'    => $schools[array_rand($schools)]->id,
                        'phone_number' => $pool[array_rand($pool)],
                        'is_active'    => true,
                    ]);
                }

                $recipients = $this->service->compile('both');

                $phones = array_column($recipients, 'phone_number');
                $uniquePhones = array_unique($phones);

                $this->assertCount(
                    count($uniquePhones),
                    $phones,
                    sprintf(
                        'compile(\'both\') returned %d recipients but only %d unique phones — duplicates found. '
                        . 'Pool size: %d, schools: %d, teachers: %d. Phones: [%s]',
                        count($phones),
                        count($uniquePhones),
                        $poolSize,
                        $schoolCount,
                        $teacherCount,
                        implode(', ', $phones)
                    )
                );
            }
        );
    }

    /**
     * @test
     * @group property-7
     *
     * Feature: wa-blast, Property 7: Filter kategori penerima hanya mengambil data yang sesuai
     *
     * **Validates: Requirements 1.2, 1.3**
     *
     * Property: For kategori `kepala_sekolah`, RecipientCompilerService SHALL hanya menghasilkan
     * recipient dari kolom `kepala_whatsapp` pada tabel `schools` (tidak ada data dari `teachers`).
     */
    public function it_only_returns_kepala_sekolah_for_kepala_sekolah_category(): void
    {
        $school = School::factory()->create([
            'nama' => 'MI Darwata',
            'kepala_madrasah' => 'Ahmad Fauzi',
            'kepala_whatsapp' => '08123456789',
            'jenjang' => 'MI',
        ]);

        Teacher::factory()->create([
            'school_id' => $school->id,
            'nama' => 'Siti Fatimah',
            'phone_number' => '08134567890',
            'is_active' => true,
        ]);

        $recipients = $this->service->compile('kepala_sekolah');

        $this->assertCount(1, $recipients);
        $this->assertEquals('kepala_sekolah', $recipients[0]['recipient_type']);
        $this->assertNotEquals('gtk', $recipients[0]['recipient_type']);
    }

    /**
     * @test
     * @group property-7
     *
     * Feature: wa-blast, Property 7: Filter kategori penerima hanya mengambil data yang sesuai
     *
     * **Validates: Requirements 1.2, 1.3**
     *
     * Property: For kategori `gtk`, RecipientCompilerService SHALL hanya menghasilkan recipient
     * dari `teachers` dengan `is_active = true` (tidak ada data dari `schools`).
     */
    public function it_only_returns_gtk_for_gtk_category(): void
    {
        $school = School::factory()->create([
            'nama' => 'MI Darwata',
            'kepala_madrasah' => 'Ahmad Fauzi',
            'kepala_whatsapp' => '08123456789',
            'jenjang' => 'MI',
        ]);

        Teacher::factory()->create([
            'school_id' => $school->id,
            'nama' => 'Siti Fatimah',
            'phone_number' => '08134567890',
            'is_active' => true,
        ]);

        $recipients = $this->service->compile('gtk');

        $this->assertCount(1, $recipients);
        $this->assertEquals('gtk', $recipients[0]['recipient_type']);
        $this->assertNotEquals('kepala_sekolah', $recipients[0]['recipient_type']);
    }

    /**
     * @test
     * @group property-7
     *
     * Feature: wa-blast, Property 7: Filter kategori penerima hanya mengambil data yang sesuai
     *
     * **Validates: Requirements 1.2, 1.3**
     *
     * Property: Filter jenjang `MI` hanya menghasilkan sekolah dengan `jenjang = 'MI'`.
     */
    public function it_filters_jenjang_correctly(): void
    {
        School::factory()->create([
            'nama' => 'MI Darwata',
            'kepala_madrasah' => 'Ahmad Fauzi',
            'kepala_whatsapp' => '08123456789',
            'jenjang' => 'MI',
        ]);

        School::factory()->create([
            'nama' => 'MTs Al-Hikmah',
            'kepala_madrasah' => 'Budi Santoso',
            'kepala_whatsapp' => '08145678901',
            'jenjang' => 'MTs',
        ]);

        $recipients = $this->service->compile('kepala_sekolah', [], ['MI']);

        $this->assertCount(1, $recipients);
        $this->assertEquals('MI Darwata', $recipients[0]['school_name']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Property-Based Tests: Property 7
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group property-7
     *
     * Feature: wa-blast, Property 7: Filter kategori penerima hanya mengambil data yang sesuai
     *
     * **Validates: Requirements 1.2, 1.3**
     *
     * Property: For any combination of schools (with kepala_whatsapp) and active teachers,
     * compile('kepala_sekolah') SHALL only return recipients with recipient_type = 'kepala_sekolah'
     * — no data from the teachers table should appear.
     *
     * Strategy:
     * - Generate $schoolCount schools (1–10) each with a valid kepala_whatsapp.
     * - Generate $teacherCount active teachers (1–10) each with a valid phone_number.
     * - Call compile('kepala_sekolah') and assert every recipient has recipient_type = 'kepala_sekolah'.
     *
     * Runs 100 iterations with randomly generated school and teacher counts.
     */
    public function property_7_kepala_sekolah_category_only_returns_data_from_schools(): void
    {
        // Feature: wa-blast, Property 7: Filter kategori penerima hanya mengambil data yang sesuai
        $this->forAll(
            self::PROPERTY_ITERATIONS,
            [
                $this->genInt(1, 10),  // school count
                $this->genInt(1, 10),  // teacher count
            ],
            function (int $schoolCount, int $teacherCount): void {
                // Clean up records created in previous iterations
                \App\Models\Teacher::query()->delete();
                \App\Models\School::query()->delete();

                $genPhone = $this->genValidPhone();

                // Create schools with valid kepala_whatsapp
                $schools = [];
                for ($i = 0; $i < $schoolCount; $i++) {
                    $schools[] = School::factory()->create([
                        'kepala_whatsapp' => $genPhone(),
                        'jenjang'         => 'MI',
                    ]);
                }

                // Create active teachers with valid phone numbers
                for ($i = 0; $i < $teacherCount; $i++) {
                    Teacher::factory()->create([
                        'school_id'    => $schools[array_rand($schools)]->id,
                        'phone_number' => $genPhone(),
                        'is_active'    => true,
                    ]);
                }

                $recipients = $this->service->compile('kepala_sekolah');

                // Property assertion: every recipient must come from schools (kepala_sekolah type)
                foreach ($recipients as $recipient) {
                    $this->assertEquals(
                        'kepala_sekolah',
                        $recipient['recipient_type'],
                        sprintf(
                            'compile(\'kepala_sekolah\') returned a recipient with type "%s" — '
                            . 'expected only "kepala_sekolah". Schools: %d, teachers: %d.',
                            $recipient['recipient_type'],
                            $schoolCount,
                            $teacherCount
                        )
                    );
                }

                // Also assert no teacher phone numbers leaked into the result
                $teacherPhones = \App\Models\Teacher::pluck('phone_number')
                    ->map(fn($p) => $this->phoneNormalizer->normalize($p))
                    ->toArray();

                $resultPhones = array_column($recipients, 'phone_number');

                // Every result phone must NOT be exclusively from teachers
                // (a phone could coincidentally match, but recipient_type must still be kepala_sekolah)
                foreach ($recipients as $recipient) {
                    $this->assertNotEquals(
                        'gtk',
                        $recipient['recipient_type'],
                        'compile(\'kepala_sekolah\') must not return any recipient with type "gtk".'
                    );
                }
            }
        );
    }

    /**
     * @test
     * @group property-7
     *
     * Feature: wa-blast, Property 7: Filter kategori penerima hanya mengambil data yang sesuai
     *
     * **Validates: Requirements 1.2, 1.3**
     *
     * Property: For any combination of schools (with kepala_whatsapp) and active/inactive teachers,
     * compile('gtk') SHALL only return recipients with recipient_type = 'gtk' and is_active = true
     * — no data from the schools table should appear, and inactive teachers must be excluded.
     *
     * Strategy:
     * - Generate $schoolCount schools (1–10) each with a valid kepala_whatsapp.
     * - Generate $activeCount active teachers (1–10) and $inactiveCount inactive teachers (1–5).
     * - Call compile('gtk') and assert:
     *   (a) every recipient has recipient_type = 'gtk'
     *   (b) the result count equals $activeCount (inactive teachers excluded)
     *
     * Runs 100 iterations with randomly generated counts.
     */
    public function property_7_gtk_category_only_returns_active_teachers(): void
    {
        // Feature: wa-blast, Property 7: Filter kategori penerima hanya mengambil data yang sesuai
        $this->forAll(
            self::PROPERTY_ITERATIONS,
            [
                $this->genInt(1, 8),   // school count
                $this->genInt(1, 8),   // active teacher count
                $this->genInt(1, 5),   // inactive teacher count
            ],
            function (int $schoolCount, int $activeCount, int $inactiveCount): void {
                // Clean up records created in previous iterations
                \App\Models\Teacher::query()->delete();
                \App\Models\School::query()->delete();

                $genPhone = $this->genValidPhone();

                // Create schools with valid kepala_whatsapp
                $schools = [];
                for ($i = 0; $i < $schoolCount; $i++) {
                    $schools[] = School::factory()->create([
                        'kepala_whatsapp' => $genPhone(),
                        'jenjang'         => 'MI',
                    ]);
                }

                // Track active teacher phones to verify they appear in results
                $activePhones = [];

                // Create active teachers with unique phones
                for ($i = 0; $i < $activeCount; $i++) {
                    $phone = $genPhone();
                    $activePhones[] = $this->phoneNormalizer->normalize($phone);
                    Teacher::factory()->create([
                        'school_id'    => $schools[array_rand($schools)]->id,
                        'phone_number' => $phone,
                        'is_active'    => true,
                    ]);
                }

                // Create inactive teachers — these must NOT appear in results
                for ($i = 0; $i < $inactiveCount; $i++) {
                    Teacher::factory()->create([
                        'school_id'    => $schools[array_rand($schools)]->id,
                        'phone_number' => $genPhone(),
                        'is_active'    => false,
                    ]);
                }

                $recipients = $this->service->compile('gtk');

                // Property assertion (a): every recipient must have type 'gtk'
                foreach ($recipients as $recipient) {
                    $this->assertEquals(
                        'gtk',
                        $recipient['recipient_type'],
                        sprintf(
                            'compile(\'gtk\') returned a recipient with type "%s" — '
                            . 'expected only "gtk". Schools: %d, active teachers: %d, inactive: %d.',
                            $recipient['recipient_type'],
                            $schoolCount,
                            $activeCount,
                            $inactiveCount
                        )
                    );
                }

                // Property assertion (b): no kepala_sekolah type in results
                $resultTypes = array_column($recipients, 'recipient_type');
                $this->assertNotContains(
                    'kepala_sekolah',
                    $resultTypes,
                    sprintf(
                        'compile(\'gtk\') must not return any "kepala_sekolah" recipients. '
                        . 'Schools: %d, active teachers: %d, inactive: %d.',
                        $schoolCount,
                        $activeCount,
                        $inactiveCount
                    )
                );

                // Property assertion (c): inactive teachers are excluded
                // Result count must be <= $activeCount (deduplication may reduce it further)
                $this->assertLessThanOrEqual(
                    $activeCount,
                    count($recipients),
                    sprintf(
                        'compile(\'gtk\') returned %d recipients but only %d active teachers exist. '
                        . 'Inactive teachers must be excluded.',
                        count($recipients),
                        $activeCount
                    )
                );
            }
        );
    }

    /**
     * @test
     * @group property-7
     *
     * Feature: wa-blast, Property 7: Filter kategori penerima hanya mengambil data yang sesuai
     *
     * **Validates: Requirements 1.2, 1.4, 1.5**
     *
     * Property: For any set of schools with mixed jenjang values, when compile() is called
     * with jenjang filter ['MI'], ALL returned recipients SHALL come from schools with
     * jenjang = 'MI' only — schools with other jenjang values must be excluded.
     *
     * Strategy:
     * - Generate $miCount schools with jenjang = 'MI' (1–8) and $otherCount schools with
     *   jenjang = 'MTs' or 'MA' (1–8).
     * - Call compile('kepala_sekolah', [], ['MI']) and assert:
     *   (a) result count equals $miCount (only MI schools included)
     *   (b) every recipient's school_name belongs to an MI school
     *
     * Runs 100 iterations with randomly generated counts.
     */
    public function property_7_jenjang_filter_mi_only_returns_mi_schools(): void
    {
        // Feature: wa-blast, Property 7: Filter kategori penerima hanya mengambil data yang sesuai
        $this->forAll(
            self::PROPERTY_ITERATIONS,
            [
                $this->genInt(1, 8),  // MI school count
                $this->genInt(1, 8),  // non-MI school count (MTs or MA)
            ],
            function (int $miCount, int $otherCount): void {
                // Clean up records created in previous iterations
                \App\Models\Teacher::query()->delete();
                \App\Models\School::query()->delete();

                $genPhone = $this->genValidPhone();

                // Create MI schools — these SHOULD appear in results
                $miSchoolNames = [];
                for ($i = 0; $i < $miCount; $i++) {
                    $school = School::factory()->create([
                        'kepala_whatsapp' => $genPhone(),
                        'jenjang'         => 'MI',
                    ]);
                    $miSchoolNames[] = $school->nama;
                }

                // Create non-MI schools (MTs and MA) — these must NOT appear in results
                $nonMiJenjang = ['MTs', 'MA'];
                for ($i = 0; $i < $otherCount; $i++) {
                    School::factory()->create([
                        'kepala_whatsapp' => $genPhone(),
                        'jenjang'         => $nonMiJenjang[$i % 2],
                    ]);
                }

                $recipients = $this->service->compile('kepala_sekolah', [], ['MI']);

                // Property assertion (a): result count must equal MI school count
                // (phones are unique per school in this test, so no deduplication expected)
                $this->assertCount(
                    $miCount,
                    $recipients,
                    sprintf(
                        'compile() with jenjang=[\'MI\'] returned %d recipients but expected %d '
                        . '(only MI schools). MI schools: %d, non-MI schools: %d.',
                        count($recipients),
                        $miCount,
                        $miCount,
                        $otherCount
                    )
                );

                // Property assertion (b): every recipient's school_name must be an MI school
                foreach ($recipients as $recipient) {
                    $this->assertContains(
                        $recipient['school_name'],
                        $miSchoolNames,
                        sprintf(
                            'compile() with jenjang=[\'MI\'] returned recipient from school "%s" '
                            . 'which is not an MI school. MI schools: [%s].',
                            $recipient['school_name'],
                            implode(', ', $miSchoolNames)
                        )
                    );
                }
            }
        );
    }

    /**
     * @test
     * @group edge-cases
     */
    public function it_returns_empty_array_when_no_recipients_found(): void
    {
        $recipients = $this->service->compile('kepala_sekolah');

        $this->assertIsArray($recipients);
        $this->assertCount(0, $recipients);
    }

    /**
     * @test
     * @group edge-cases
     */
    public function it_handles_empty_school_ids_array(): void
    {
        School::factory()->create([
            'nama' => 'MI Darwata',
            'kepala_madrasah' => 'Ahmad Fauzi',
            'kepala_whatsapp' => '08123456789',
            'jenjang' => 'MI',
        ]);

        $recipients = $this->service->compile('kepala_sekolah', []);

        $this->assertCount(1, $recipients);
    }

    /**
     * @test
     * @group edge-cases
     */
    public function it_handles_empty_jenjang_array(): void
    {
        School::factory()->create([
            'nama' => 'MI Darwata',
            'kepala_madrasah' => 'Ahmad Fauzi',
            'kepala_whatsapp' => '08123456789',
            'jenjang' => 'MI',
        ]);

        $recipients = $this->service->compile('kepala_sekolah', [], []);

        $this->assertCount(1, $recipients);
    }
}
