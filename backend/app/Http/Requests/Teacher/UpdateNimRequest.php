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
            'nim' => ['required', 'string', 'regex:/^\d+$/'],
        ];
    }

    public function messages(): array
    {
        return [
            'nim.required' => 'NIM wajib diisi.',
            'nim.string'   => 'NIM harus berupa string.',
            'nim.regex'    => 'NIM harus berupa angka.',
        ];
    }
}
