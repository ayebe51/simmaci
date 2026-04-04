<?php

namespace App\Http\Requests\Teacher;

use App\Rules\UniqueForTenant;
use Illuminate\Foundation\Http\FormRequest;

class StoreTeacherRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'nama'                 => 'required|string|max:255',
            'nuptk'                => ['nullable', 'string', new UniqueForTenant('teachers', 'nuptk')],
            'nomor_induk_maarif'   => ['nullable', 'string', new UniqueForTenant('teachers', 'nomor_induk_maarif')],
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
            'pdpkpnu'              => 'nullable|string',
            'kecamatan'            => 'nullable|string',
        ];
    }
}
