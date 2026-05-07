<?php

namespace App\Http\Requests\Meeting;

use Illuminate\Foundation\Http\FormRequest;

class WalkInCheckInRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Public endpoint - no authorization needed (protected by signed URL)
        return true;
    }

    public function rules(): array
    {
        return [
            'walk_in_name' => 'required|string|max:255',
            'walk_in_jabatan' => 'required|string|max:255',
            'walk_in_instansi' => 'required|string|max:255',
            'walk_in_phone' => 'required|string|max:20',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
        ];
    }

    public function messages(): array
    {
        return [
            'walk_in_name.required' => 'Nama wajib diisi',
            'walk_in_jabatan.required' => 'Jabatan wajib diisi',
            'walk_in_instansi.required' => 'Asal sekolah/instansi wajib diisi',
            'walk_in_phone.required' => 'Nomor WhatsApp wajib diisi',
        ];
    }

    protected function prepareForValidation(): void
    {
        // Normalize phone number
        if ($this->has('walk_in_phone')) {
            $normalizer = app(\App\Services\PhoneNormalizerService::class);
            $this->merge([
                'walk_in_phone' => $normalizer->normalize($this->walk_in_phone),
            ]);
        }
    }
}
