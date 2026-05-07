<?php

namespace App\Http\Requests\Meeting;

use Illuminate\Foundation\Http\FormRequest;

class CheckInRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Public endpoint - no authorization needed (protected by signed URL)
        return true;
    }

    public function rules(): array
    {
        return [
            'is_delegation' => 'required|boolean',
            'delegated_for_participant_id' => 'required_if:is_delegation,true|nullable|integer',
            'delegation_letter' => 'required_if:is_delegation,true|nullable|file|mimes:jpeg,png,pdf|max:5120',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
        ];
    }

    public function messages(): array
    {
        return [
            'is_delegation.required' => 'Status delegasi wajib diisi',
            'delegated_for_participant_id.required_if' => 'Peserta yang diwakili wajib dipilih jika hadir sebagai delegasi',
            'delegation_letter.required_if' => 'Surat tugas wajib diunggah jika hadir sebagai delegasi',
            'delegation_letter.mimes' => 'Surat tugas harus berformat JPEG, PNG, atau PDF',
            'delegation_letter.max' => 'Ukuran surat tugas maksimal 5 MB',
        ];
    }
}
