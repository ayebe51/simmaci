<?php

namespace Database\Factories;

use App\Models\Meeting;
use App\Models\MeetingParticipant;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MeetingParticipant>
 */
class MeetingParticipantFactory extends Factory
{
    protected $model = MeetingParticipant::class;

    public function definition(): array
    {
        return [
            'meeting_id' => Meeting::factory(),
            'participant_type' => fake()->randomElement(['teacher', 'headmaster', 'external']),
            'participant_id' => null,
            'name' => fake('id_ID')->name(),
            'jabatan' => fake()->randomElement(['Kepala Sekolah', 'Guru', 'Wakil Kepala Sekolah', 'Koordinator']),
            'instansi' => fake('id_ID')->company(),
            'phone_number' => '62' . fake()->numerify('8##########'),
            'qr_token' => null,
            'is_token_used' => false,
            'token_used_at' => null,
            'token_revoked' => false,
        ];
    }

    public function forMeeting(Meeting $meeting): static
    {
        return $this->state(fn() => ['meeting_id' => $meeting->id]);
    }

    public function asTeacher(): static
    {
        return $this->state(fn() => ['participant_type' => 'teacher']);
    }

    public function asHeadmaster(): static
    {
        return $this->state(fn() => ['participant_type' => 'headmaster']);
    }

    public function asExternal(): static
    {
        return $this->state(fn() => ['participant_type' => 'external']);
    }

    public function withTokenUsed(): static
    {
        return $this->state(fn() => [
            'is_token_used' => true,
            'token_used_at' => now(),
        ]);
    }

    public function withTokenRevoked(): static
    {
        return $this->state(fn() => [
            'token_revoked' => true,
        ]);
    }
}
