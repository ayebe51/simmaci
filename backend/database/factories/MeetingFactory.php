<?php

namespace Database\Factories;

use App\Models\Meeting;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Meeting>
 */
class MeetingFactory extends Factory
{
    protected $model = Meeting::class;

    public function definition(): array
    {
        $startedAt = fake()->dateTimeBetween('+1 day', '+30 days');
        $endedAt = (clone $startedAt)->modify('+4 hours');

        return [
            'title' => fake()->sentence(3),
            'agenda' => fake()->paragraph(),
            'location' => fake('id_ID')->city(),
            'started_at' => $startedAt,
            'ended_at' => $endedAt,
            'geolocation_enabled' => false,
            'latitude' => null,
            'longitude' => null,
            'geolocation_radius_meters' => null,
            'qr_umum_token' => fake()->unique()->sha256(),
            'invitation_blast_id' => null,
            'reminder_blast_id' => null,
            'reminder_scheduled_at' => null,
            'created_by' => User::factory(),
        ];
    }

    public function withGeolocation(float $latitude = -7.7325, float $longitude = 109.0025, int $radiusMeters = 500): static
    {
        return $this->state(fn() => [
            'geolocation_enabled' => true,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'geolocation_radius_meters' => $radiusMeters,
        ]);
    }

    public function upcoming(): static
    {
        return $this->state(fn() => [
            'started_at' => fake()->dateTimeBetween('+1 day', '+30 days'),
            'ended_at' => fake()->dateTimeBetween('+2 days', '+31 days'),
        ]);
    }

    public function ongoing(): static
    {
        return $this->state(fn() => [
            'started_at' => fake()->dateTimeBetween('-4 hours', '-1 hour'),
            'ended_at' => fake()->dateTimeBetween('+1 hour', '+4 hours'),
        ]);
    }

    public function completed(): static
    {
        return $this->state(fn() => [
            'started_at' => fake()->dateTimeBetween('-10 days', '-5 days'),
            'ended_at' => fake()->dateTimeBetween('-4 days', '-1 day'),
        ]);
    }
}
