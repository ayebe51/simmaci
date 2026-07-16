<?php

namespace App\Http\Requests\Teacher;

use App\Rules\UniqueForTenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTeacherRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        $teacherId = $this->route('teacher')?->id;

        return [
            'nama'                 => 'sometimes|string|max:255',
            'nuptk'                => ['nullable', 'string', 'unique:teachers,nuptk,' . $teacherId],
            // Ignore soft-deleted records — the DB partial unique index also excludes deleted_at IS NOT NULL,
            // so the validation rule must be consistent with it to avoid false "already taken" errors.
            'nomor_induk_maarif'   => [
                'nullable',
                'string',
                Rule::unique('teachers', 'nomor_induk_maarif')
                    ->ignore($teacherId)
                    ->whereNull('deleted_at'),
            ],
            'nip'                  => 'nullable|string',
            'jenis_kelamin'        => 'nullable|in:L,P',
            'tempat_lahir'         => 'nullable|string|max:100',
            'tanggal_lahir'        => 'nullable|date',
            'pendidikan_terakhir'  => 'nullable|string',
            'mapel'                => 'nullable|string',
            'unit_kerja'           => 'nullable|string',
            'status'               => 'nullable|string',
            'phone_number'         => 'nullable|string|max:20',
            'email'                => 'nullable|email',
            'tmt'                  => 'nullable|date',
            'is_certified'         => 'nullable|boolean',
            'is_active'            => 'nullable|boolean',
            'pdpkpnu'              => 'nullable|string',
            'kecamatan'            => 'nullable|string',
            'kelurahan'            => 'nullable|string',
            'photo_id'             => 'nullable|string',
        ];
    }
}
