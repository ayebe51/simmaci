<?php

namespace App\Http\Requests\Student;

use App\Rules\UniqueForTenant;
use Illuminate\Foundation\Http\FormRequest;

class StoreStudentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'nama'               => 'required|string|max:255',
            'nisn'               => ['nullable', 'string', new UniqueForTenant('students', 'nisn')],
            'nomor_induk_maarif' => ['nullable', 'string', new UniqueForTenant('students', 'nomor_induk_maarif')],
            'nik'                => 'nullable|string|max:20',
            'jenis_kelamin'      => 'nullable|in:L,P',
            'tempat_lahir'       => 'nullable|string|max:100',
            'tanggal_lahir'      => 'nullable|date',
            'nama_ayah'          => 'nullable|string|max:255',
            'nama_ibu'           => 'nullable|string|max:255',
            'alamat'             => 'nullable|string',
            'nama_sekolah'       => 'nullable|string',
            'npsn'               => 'nullable|string',
            'kelas'              => 'nullable|string',
            'status'             => 'nullable|string',
            'nomor_telepon'      => 'nullable|string|max:20',
            'nama_wali'          => 'nullable|string|max:255',
            'provinsi'           => 'nullable|string',
            'kabupaten'          => 'nullable|string',
            'kecamatan'          => 'nullable|string',
            'kelurahan'          => 'nullable|string',
        ];
    }
}
