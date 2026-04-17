<?php

namespace App\Http\Requests\SkTemplate;

use Illuminate\Foundation\Http\FormRequest;

class StoreSkTemplateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'file'    => 'required|file|mimes:docx|max:10240',
            'sk_type' => 'required|string|in:gty,gtt,kamad,tendik',
        ];
    }

    public function messages(): array
    {
        return [
            'file.required' => 'File template wajib diunggah.',
            'file.file'     => 'Upload harus berupa file.',
            'file.mimes'    => 'File template harus berformat .docx.',
            'file.max'      => 'Ukuran file template maksimal 10 MB.',

            'sk_type.required' => 'Jenis SK wajib dipilih.',
            'sk_type.string'   => 'Jenis SK harus berupa teks.',
            'sk_type.in'       => 'Jenis SK tidak valid. Pilihan yang tersedia: gty, gtt, kamad, tendik.',
        ];
    }
}
