<?php

namespace Tests\Unit\Services;

use App\Services\NormalizationService;
use App\Services\StrictDateValidationService;
use Tests\TestCase;

class TeacherImportCommitDateServiceP1Test extends TestCase
{
    private NormalizationService $normalization;
    private StrictDateValidationService $validator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->normalization = new NormalizationService();
        $this->validator = new StrictDateValidationService($this->normalization);
    }

    public function test_validate_iso_date_accepts_valid_calendar_iso_and_rejects_invalid(): void
    {
        $valid = $this->validator->validateIsoDate('1992-08-03');
        $this->assertTrue($valid['valid']);
        $this->assertSame('1992-08-03', $valid['normalized']);

        $leapValid = $this->validator->validateIsoDate('2024-02-29');
        $this->assertTrue($leapValid['valid']);
        $this->assertSame('2024-02-29', $leapValid['normalized']);

        foreach (['2023-02-29', '2023-04-31', '2023-13-01', '11/12/2022', '11-12-2022', '03 Agustus 1992'] as $bad) {
            $res = $this->validator->validateIsoDate($bad);
            $this->assertFalse($res['valid'], "Expected validateIsoDate('{$bad}') to fail");
        }
    }

    public function test_sign_and_verify_normalized_dates_detects_any_tampering_or_user_mismatch(): void
    {
        $payload = [
            'nama'          => 'GURU CONTOH',
            'tanggal_lahir' => '1992-08-03',
            'tmt'           => '2013-07-15',
        ];

        $sig = $this->validator->signNormalizedDates($payload, 10, 5);
        $this->assertNotEmpty($sig);

        // Exact match passes
        $this->assertTrue($this->validator->verifyNormalizedDates($payload, $sig, 10, 5));

        // Non-date field change does NOT invalidate date attestation
        $nonDateEdited = array_merge($payload, ['unit_kerja' => 'MI Ma\'arif 01']);
        $this->assertTrue($this->validator->verifyNormalizedDates($nonDateEdited, $sig, 10, 5));

        // Tampering date value invalidates signature
        $tamperedVal = array_merge($payload, ['tanggal_lahir' => '1992-08-04']);
        $this->assertFalse($this->validator->verifyNormalizedDates($tamperedVal, $sig, 10, 5));

        // Adding an extra date field invalidates signature
        $addedDate = array_merge($payload, ['tanggal_sk' => '2024-01-01']);
        $this->assertFalse($this->validator->verifyNormalizedDates($addedDate, $sig, 10, 5));

        // Different user or school cannot replay signature
        $this->assertFalse($this->validator->verifyNormalizedDates($payload, $sig, 99, 5));
        $this->assertFalse($this->validator->verifyNormalizedDates($payload, $sig, 10, 99));

        // Missing or corrupted signature fails
        $this->assertFalse($this->validator->verifyNormalizedDates($payload, null, 10, 5));
        $this->assertFalse($this->validator->verifyNormalizedDates($payload, 'forged-sig', 10, 5));
    }

    public function test_normalization_service_rejects_impossible_calendar_iso_dates(): void
    {
        $this->assertSame('2024-02-29', $this->normalization->parseIndonesianDate('2024-02-29'));
        $this->assertNull($this->normalization->parseIndonesianDate('2023-02-29'));
        $this->assertNull($this->normalization->parseIndonesianDate('2023-04-31'));
        $this->assertNull($this->normalization->parseIndonesianDate('2023-13-01'));
    }
}
