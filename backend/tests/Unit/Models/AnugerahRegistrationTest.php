<?php

namespace Tests\Unit\Models;

use App\Models\AnugerahRegistration;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests for AnugerahRegistration::calculateScore()
 * Tests the Juknis scoring matrix without a database connection.
 */
class AnugerahRegistrationTest extends TestCase
{
    private function make(array $prestasiList): AnugerahRegistration
    {
        $reg = new AnugerahRegistration();
        $reg->prestasi_list = $prestasiList;
        return $reg;
    }

    public function test_empty_prestasi_list_returns_zero(): void
    {
        $this->assertSame(0, $this->make([])->calculateScore());
    }

    public function test_internasional_juara1_scores_100(): void
    {
        $reg = $this->make([['tingkat' => 'internasional', 'juara' => 1, 'is_lp_maarif' => false]]);
        $this->assertSame(100, $reg->calculateScore());
    }

    public function test_internasional_juara2_scores_85(): void
    {
        $reg = $this->make([['tingkat' => 'internasional', 'juara' => 2, 'is_lp_maarif' => false]]);
        $this->assertSame(85, $reg->calculateScore());
    }

    public function test_internasional_juara3_scores_70(): void
    {
        $reg = $this->make([['tingkat' => 'internasional', 'juara' => 3, 'is_lp_maarif' => false]]);
        $this->assertSame(70, $reg->calculateScore());
    }

    public function test_internasional_harapan_scores_50(): void
    {
        $reg = $this->make([['tingkat' => 'internasional', 'juara' => 4, 'is_lp_maarif' => false]]);
        $this->assertSame(50, $reg->calculateScore());
    }

    public function test_nasional_juara1_scores_80(): void
    {
        $reg = $this->make([['tingkat' => 'nasional', 'juara' => 1, 'is_lp_maarif' => false]]);
        $this->assertSame(80, $reg->calculateScore());
    }

    public function test_provinsi_juara1_scores_60(): void
    {
        $reg = $this->make([['tingkat' => 'provinsi', 'juara' => 1, 'is_lp_maarif' => false]]);
        $this->assertSame(60, $reg->calculateScore());
    }

    public function test_kabupaten_juara1_scores_40(): void
    {
        $reg = $this->make([['tingkat' => 'kabupaten', 'juara' => 1, 'is_lp_maarif' => false]]);
        $this->assertSame(40, $reg->calculateScore());
    }

    public function test_kecamatan_juara1_scores_20(): void
    {
        $reg = $this->make([['tingkat' => 'kecamatan', 'juara' => 1, 'is_lp_maarif' => false]]);
        $this->assertSame(20, $reg->calculateScore());
    }

    public function test_kecamatan_harapan_scores_5(): void
    {
        $reg = $this->make([['tingkat' => 'kecamatan', 'juara' => 4, 'is_lp_maarif' => false]]);
        $this->assertSame(5, $reg->calculateScore());
    }

    public function test_lp_maarif_bonus_adds_5_points(): void
    {
        $reg = $this->make([['tingkat' => 'kabupaten', 'juara' => 1, 'is_lp_maarif' => true]]);
        $this->assertSame(45, $reg->calculateScore()); // 40 + 5 bonus
    }

    public function test_lp_maarif_bonus_on_kecamatan_harapan(): void
    {
        $reg = $this->make([['tingkat' => 'kecamatan', 'juara' => 4, 'is_lp_maarif' => true]]);
        $this->assertSame(10, $reg->calculateScore()); // 5 + 5 bonus
    }

    public function test_multiple_prestasi_accumulate_correctly(): void
    {
        $reg = $this->make([
            ['tingkat' => 'nasional',   'juara' => 1, 'is_lp_maarif' => false], // 80
            ['tingkat' => 'kabupaten',  'juara' => 2, 'is_lp_maarif' => true],  // 30 + 5 = 35
            ['tingkat' => 'kecamatan',  'juara' => 3, 'is_lp_maarif' => false], // 10
        ]);
        $this->assertSame(125, $reg->calculateScore()); // 80 + 35 + 10
    }

    public function test_unknown_tingkat_scores_zero(): void
    {
        $reg = $this->make([['tingkat' => 'wilayah', 'juara' => 1, 'is_lp_maarif' => false]]);
        $this->assertSame(0, $reg->calculateScore());
    }

    public function test_juara_beyond_4_clamped_to_harapan(): void
    {
        // juara 5 or higher → index 3 → harapan score
        $reg = $this->make([['tingkat' => 'nasional', 'juara' => 99, 'is_lp_maarif' => false]]);
        $this->assertSame(35, $reg->calculateScore()); // harapan nasional = 35
    }

    public function test_juara_0_clamped_to_juara1(): void
    {
        // juara 0 → index 0 → juara 1 score
        $reg = $this->make([['tingkat' => 'nasional', 'juara' => 0, 'is_lp_maarif' => false]]);
        $this->assertSame(80, $reg->calculateScore()); // juara 1 nasional = 80
    }

    public function test_is_lp_maarif_false_no_bonus(): void
    {
        $reg = $this->make([['tingkat' => 'nasional', 'juara' => 1, 'is_lp_maarif' => false]]);
        $this->assertSame(80, $reg->calculateScore());
    }

    public function test_is_lp_maarif_missing_defaults_to_no_bonus(): void
    {
        // is_lp_maarif key missing entirely
        $reg = $this->make([['tingkat' => 'nasional', 'juara' => 1]]);
        $this->assertSame(80, $reg->calculateScore());
    }

    public function test_full_juknis_matrix_all_levels_juara1(): void
    {
        $expected = [
            'internasional' => 100,
            'nasional'      => 80,
            'provinsi'      => 60,
            'kabupaten'     => 40,
            'kecamatan'     => 20,
        ];

        foreach ($expected as $tingkat => $score) {
            $reg = $this->make([['tingkat' => $tingkat, 'juara' => 1, 'is_lp_maarif' => false]]);
            $this->assertSame(
                $score,
                $reg->calculateScore(),
                "Score mismatch for tingkat={$tingkat} juara=1"
            );
        }
    }

    public function test_full_juknis_matrix_harapan_all_levels(): void
    {
        $expected = [
            'internasional' => 50,
            'nasional'      => 35,
            'provinsi'      => 20,
            'kabupaten'     => 10,
            'kecamatan'     => 5,
        ];

        foreach ($expected as $tingkat => $score) {
            $reg = $this->make([['tingkat' => $tingkat, 'juara' => 4, 'is_lp_maarif' => false]]);
            $this->assertSame(
                $score,
                $reg->calculateScore(),
                "Score mismatch for tingkat={$tingkat} harapan"
            );
        }
    }

    public function test_score_is_idempotent_called_twice(): void
    {
        $reg = $this->make([
            ['tingkat' => 'nasional', 'juara' => 1, 'is_lp_maarif' => true],
        ]);
        $first  = $reg->calculateScore();
        $second = $reg->calculateScore();
        $this->assertSame($first, $second);
    }
}
