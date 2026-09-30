<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class HealthAndWarmupTest extends TestCase
{
    public function test_simple_health_endpoint_returns_ok(): void
    {
        $response = $this->getJson('/api/health');

        $response->assertStatus(200)
                 ->assertJson(['status' => 'ok']);
    }

    public function test_version_endpoint_returns_safe_metadata(): void
    {
        $response = $this->getJson('/api/version');

        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'version',
                     'build',
                     'environment',
                     'timestamp',
                 ]);
    }

    public function test_deep_health_endpoint_structure(): void
    {
        $response = $this->getJson('/api/health/deep');

        // Status could be 200 (if DB/cache available) or 503 (degraded if local sqlite/pgsql unconfigured)
        $this->assertContains($response->getStatusCode(), [200, 503]);
        $response->assertJsonStructure([
            'status',
            'database',
            'cache',
            'timestamp',
        ]);
    }

    public function test_warmup_endpoint_returns_expected_structure(): void
    {
        $response = $this->getJson('/api/warmup');

        $this->assertContains($response->getStatusCode(), [200, 500]);
        $response->assertJsonStructure(['status']);
    }
}
