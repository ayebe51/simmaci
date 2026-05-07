<?php

namespace Database\Factories;

use App\Models\Meeting;
use App\Models\MeetingAttendance;
use App\Models\MeetingParticipant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MeetingAttendance>
 */
class MeetingAttendanceFactory extends Factory
{
    protected $model = MeetingAttendance::class;

    public function definition(): array
    {
        return [
            'meeting_id' => Meeting::factory(),
            'participant_id' => MeetingParticipant::factory(),
            'attendance_type' => fake()->randomElement(['qr_personal', 'qr_umum', 'manual']),
            'is_delegation' => false,
            'delegated_for_participant_id' => null,
            'delegation_letter_path' => null,
            'walk_in_name' => null,
            'walk_in_jabatan' => null,
            'walk_in_instansi' => null,
            'walk_in_phone' => null,
            'checked_in_at' => now(),
            'checked_in_by_admin_id' => null,
            'device_info' => [
                'user_agent' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
                'browser' => 'Safari',
                'browser_version' => '17.0',
                'os' => 'iOS',
                'os_version' => '17.0',
                'device_type' => 'mobile',
            ],
            'ip_address' => fake()->ipv4(),
        ];
    }

    public function qrPersonal(): static
    {
        return $this->state(fn() => [
            'attendance_type' => 'qr_personal',
            'walk_in_name' => null,
            'walk_in_jabatan' => null,
            'walk_in_instansi' => null,
            'walk_in_phone' => null,
        ]);
    }

    public function qrUmum(): static
    {
        return $this->state(fn() => [
            'attendance_type' => 'qr_umum',
            'participant_id' => null,
            'walk_in_name' => fake('id_ID')->name(),
            'walk_in_jabatan' => fake()->randomElement(['Kepala Sekolah', 'Guru', 'Koordinator']),
            'walk_in_instansi' => fake('id_ID')->company(),
            'walk_in_phone' => '62' . fake()->numerify('8##########'),
        ]);
    }

    public function manual(): static
    {
        return $this->state(fn() => [
            'attendance_type' => 'manual',
            'checked_in_by_admin_id' => User::factory(),
        ]);
    }

    public function withDelegation(MeetingParticipant $delegatedFor): static
    {
        return $this->state(fn() => [
            'is_delegation' => true,
            'delegated_for_participant_id' => $delegatedFor->id,
            'delegation_letter_path' => 'meetings/' . $delegatedFor->meeting_id . '/delegation_letters/sample.pdf',
        ]);
    }

    public function forMeeting(Meeting $meeting): static
    {
        return $this->state(fn() => [
            'meeting_id' => $meeting->id,
            'participant_id' => MeetingParticipant::factory()->forMeeting($meeting),
        ]);
    }
}
