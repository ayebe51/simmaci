<?php

namespace App\Http\Requests\Teacher;

use Illuminate\Foundation\Http\FormRequest;

class UpdateNimRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            // Accept digits-only OR formatted with dots/dashes (e.g. "113.403.283")
            // Normalization (strip non-digits) happens in the controller before saving.
            'nim' => ['required', 'string', 'regex:/^[\d.\-\s]+$/'],
        ];
    }

    public function messages(): array
    {
        return [
            'nim.required' => 'NIM wajib diisi.',
            'nim.string'   => 'NIM harus berupa string.',
            'nim.regex'    => 'NIM hanya boleh berisi angka (boleh menggunakan titik atau tanda hubung sebagai pemisah).',
        ];
    }
}
