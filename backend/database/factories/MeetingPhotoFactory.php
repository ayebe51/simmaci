<?php

namespace Database\Factories;

use App\Models\Meeting;
use App\Models\MeetingPhoto;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MeetingPhoto>
 */
class MeetingPhotoFactory extends Factory
{
    protected $model = MeetingPhoto::class;

    public function definition(): array
    {
        $filename = fake()->word() . '.jpg';

        return [
            'meeting_id' => Meeting::factory(),
            'original_filename' => $filename,
            'storage_path' => 'meetings/' . fake()->numberBetween(1, 100) . '/photos/' . $filename,
            'thumbnail_path' => 'meetings/' . fake()->numberBetween(1, 100) . '/photos/thumbnails/' . $filename,
            'file_size' => fake()->numberBetween(100000, 5000000), // 100KB to 5MB
            'width' => fake()->randomElement([800, 1024, 1280, 1600]),
            'height' => fake()->randomElement([600, 768, 960, 1200]),
            'mime_type' => 'image/jpeg',
            'uploaded_by' => User::factory(),
        ];
    }

    public function forMeeting(Meeting $meeting): static
    {
        return $this->state(fn() => [
            'meeting_id' => $meeting->id,
        ]);
    }

    public function withPng(): static
    {
        return $this->state(fn() => [
            'mime_type' => 'image/png',
            'original_filename' => fake()->word() . '.png',
        ]);
    }

    public function withWebp(): static
    {
        return $this->state(fn() => [
            'mime_type' => 'image/webp',
            'original_filename' => fake()->word() . '.webp',
        ]);
    }

    public function withGif(): static
    {
        return $this->state(fn() => [
            'mime_type' => 'image/gif',
            'original_filename' => fake()->word() . '.gif',
        ]);
    }

    public function uploadedBy(User $user): static
    {
        return $this->state(fn() => [
            'uploaded_by' => $user->id,
        ]);
    }
}
