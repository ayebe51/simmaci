<?php

namespace Database\Factories;

use App\Models\Meeting;
use App\Models\MeetingMinutes;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\MeetingMinutes>
 */
class MeetingMinutesFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'meeting_id' => Meeting::factory(),
            'title' => $this->faker->sentence(),
            'content' => '<p>' . $this->faker->paragraph() . '</p>',
            'created_by' => User::factory(),
            'updated_by' => null,
        ];
    }
}
