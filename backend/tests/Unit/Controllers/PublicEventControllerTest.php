<?php

namespace Tests\Unit\Controllers;

use App\Http\Controllers\Api\PublicEventController;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

/**
 * Unit tests for PublicEventController — testing private methods
 * that contain domain logic, without needing a database.
 */
class PublicEventControllerTest extends TestCase
{
    private PublicEventController $controller;

    protected function setUp(): void
    {
        parent::setUp();
        $this->controller = new PublicEventController();
    }

    private function getCriteria(string $lombaType): array
    {
        $ref = new ReflectionMethod($this->controller, 'getCriteria');
        $ref->setAccessible(true);
        return $ref->invoke($this->controller, $lombaType);
    }

    // ── getCriteria tests ─────────────────────────────────────────────────────

    public function test_mars_maarif_criteria_has_correct_weights(): void
    {
        $criteria = $this->getCriteria('mars_maarif');

        $this->assertCount(3, $criteria);
        $this->assertWeightSum($criteria, 100);

        $this->assertCriterion($criteria[0], 'Teknik Vokal', 35);
        $this->assertCriterion($criteria[1], 'Harmonisasi & Keselarasan', 35);
        $this->assertCriterion($criteria[2], 'Penjiwaan & Ekspresi', 30);
    }

    public function test_mtq_pa_criteria_has_correct_weights(): void
    {
        $criteria = $this->getCriteria('mtq_pa');

        $this->assertCount(3, $criteria);
        $this->assertWeightSum($criteria, 100);

        $this->assertCriterion($criteria[0], 'Tajwid', 45);
        $this->assertCriterion($criteria[1], 'Lagu & Irama', 35);
        $this->assertCriterion($criteria[2], 'Adab & Penampilan', 20);
    }

    public function test_mtq_pi_criteria_matches_mtq_pa(): void
    {
        $this->assertSame(
            $this->getCriteria('mtq_pa'),
            $this->getCriteria('mtq_pi')
        );
    }

    public function test_puji_pujian_criteria_has_correct_weights(): void
    {
        $criteria = $this->getCriteria('puji_pujian');

        $this->assertCount(4, $criteria);
        $this->assertWeightSum($criteria, 100);

        $this->assertCriterion($criteria[0], 'Makhraj & Artikulasi', 35);
        $this->assertCriterion($criteria[1], 'Penjiwaan & Penghayatan', 30);
        $this->assertCriterion($criteria[2], 'Harmonisasi', 25);
        $this->assertCriterion($criteria[3], 'Adab & Penampilan', 10);
    }

    public function test_film_dokumenter_criteria_has_correct_weights(): void
    {
        $criteria = $this->getCriteria('film_dokumenter');

        $this->assertCount(4, $criteria);
        $this->assertWeightSum($criteria, 100);

        $this->assertCriterion($criteria[0], 'Kesesuaian Tema & Konten', 35);
        $this->assertCriterion($criteria[1], 'Alur Cerita & Narasi', 25);
        $this->assertCriterion($criteria[2], 'Sinematografi & Editing', 25);
        $this->assertCriterion($criteria[3], 'Kreativitas & Estetika', 15);
    }

    public function test_unknown_lomba_type_returns_empty_array(): void
    {
        $this->assertSame([], $this->getCriteria('lomba_tidak_ada'));
        $this->assertSame([], $this->getCriteria(''));
        $this->assertSame([], $this->getCriteria('guru_berprestasi')); // anugerah, no video criteria
    }

    public function test_all_festival_types_have_weights_summing_to_100(): void
    {
        $types = ['mars_maarif', 'mtq_pa', 'mtq_pi', 'puji_pujian', 'film_dokumenter'];

        foreach ($types as $type) {
            $criteria = $this->getCriteria($type);
            $this->assertNotEmpty($criteria, "Criteria should not be empty for {$type}");
            $this->assertWeightSum($criteria, 100, "Weights should sum to 100 for {$type}");
        }
    }

    public function test_each_criterion_has_component_and_weight_keys(): void
    {
        $types = ['mars_maarif', 'mtq_pa', 'puji_pujian', 'film_dokumenter'];

        foreach ($types as $type) {
            foreach ($this->getCriteria($type) as $criterion) {
                $this->assertArrayHasKey('component', $criterion, "Missing 'component' key in {$type}");
                $this->assertArrayHasKey('weight', $criterion, "Missing 'weight' key in {$type}");
                $this->assertIsString($criterion['component'], "'component' should be a string in {$type}");
                $this->assertIsInt($criterion['weight'], "'weight' should be an int in {$type}");
                $this->assertGreaterThan(0, $criterion['weight'], "'weight' should be > 0 in {$type}");
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function assertCriterion(array $criterion, string $component, int $weight): void
    {
        $this->assertSame($component, $criterion['component']);
        $this->assertSame($weight,    $criterion['weight']);
    }

    private function assertWeightSum(array $criteria, int $expected, string $message = ''): void
    {
        $sum = array_sum(array_column($criteria, 'weight'));
        $this->assertSame($expected, $sum, $message ?: "Weights should sum to {$expected}");
    }
}
