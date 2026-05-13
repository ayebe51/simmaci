<?php

namespace App\Http\Requests\Meeting;

use Illuminate\Foundation\Http\FormRequest;

class UpdateMeetingRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Only super_admin and admin_yayasan can update meetings
        return $this->user() && in_array($this->user()->role, ['super_admin', 'admin_yayasan']);
    }

    public function rules(): array
    {
        $meeting = $this->route('meeting');

        return [
            'title' => 'sometimes|required|string|max:255',
            'agenda' => 'nullable|string|max:1000',
            'location' => 'sometimes|required|string|max:500',
            // Disable date/time changes if meeting is ongoing or completed
            'started_at' => $this->isDateTimeChangeAllowed()
                ? 'sometimes|required|date_format:Y-m-d\TH:i:sP'
                : 'prohibited',
            'ended_at' => $this->isDateTimeChangeAllowed()
                ? 'sometimes|required|date_format:Y-m-d\TH:i:sP|after:started_at'
                : 'prohibited',
            'school_ids' => 'sometimes|required|array|min:1',
            'school_ids.*' => 'integer|exists:schools,id',
            'geolocation_enabled' => 'sometimes|required|boolean',
            'latitude' => 'required_if:geolocation_enabled,true|nullable|numeric|between:-90,90',
            'longitude' => 'required_if:geolocation_enabled,true|nullable|numeric|between:-180,180',
            'geolocation_radius_meters' => 'required_if:geolocation_enabled,true|nullable|integer|min:10',
            'participants' => 'sometimes|required|array|min:1',
            'participants.*.participant_type' => 'required|in:teacher,headmaster,external',
            'participants.*.participant_id' => 'nullable|integer',
            'participants.*.name' => 'required|string|max:255',
            'participants.*.jabatan' => 'required|string|max:255',
            'participants.*.instansi' => 'required|string|max:255',
            'participants.*.phone_number' => 'required|string|max:20',
            'send_invitation_wa' => 'sometimes|required|boolean',
            'send_reminder_wa' => 'sometimes|required|boolean',
            'reminder_timing' => 'required_if:send_reminder_wa,true|nullable|in:H-1,2_hours,custom',
            'reminder_custom_at' => 'required_if:reminder_timing,custom|nullable|date_format:Y-m-d\TH:i:sP',
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'Judul rapat wajib diisi',
            'location.required' => 'Lokasi rapat wajib diisi',
            'started_at.prohibited' => 'Waktu mulai rapat tidak dapat diubah setelah rapat dimulai',
            'ended_at.prohibited' => 'Waktu selesai rapat tidak dapat diubah setelah rapat dimulai',
            'started_at.after' => 'Waktu mulai rapat harus di masa depan',
            'ended_at.after' => 'Waktu selesai rapat harus setelah waktu mulai',
            'school_ids.required' => 'Minimal satu sekolah harus dipilih',
            'school_ids.min' => 'Minimal satu sekolah harus dipilih',
            'latitude.required_if' => 'Latitude wajib diisi jika validasi lokasi diaktifkan',
            'longitude.required_if' => 'Longitude wajib diisi jika validasi lokasi diaktifkan',
            'geolocation_radius_meters.required_if' => 'Radius validasi lokasi wajib diisi',
            'geolocation_radius_meters.min' => 'Radius validasi lokasi minimal 10 meter',
            'participants.required' => 'Minimal satu peserta harus ditambahkan',
            'participants.min' => 'Minimal satu peserta harus ditambahkan',
            'reminder_timing.required_if' => 'Waktu reminder wajib dipilih',
            'reminder_custom_at.required_if' => 'Waktu reminder custom wajib diisi',
        ];
    }

    protected function prepareForValidation(): void
    {
        // Normalize phone numbers in participants
        if ($this->has('participants') && is_array($this->participants)) {
            $participants = $this->participants;
            foreach ($participants as &$participant) {
                if (isset($participant['phone_number'])) {
                    $normalizer = app(\App\Services\PhoneNormalizerService::class);
                    $participant['phone_number'] = $normalizer->normalize($participant['phone_number']);
                }
            }
            $this->merge(['participants' => $participants]);
        }
    }

    /**
     * Check if date/time changes are allowed.
     * Changes are not allowed if meeting is ongoing or completed.
     */
    private function isDateTimeChangeAllowed(): bool
    {
        $meeting = $this->route('meeting');
        if (!$meeting) {
            return true;
        }

        $now = now();
        // Allow changes only if meeting hasn't started yet
        return $now->lt($meeting->started_at);
    }
}
