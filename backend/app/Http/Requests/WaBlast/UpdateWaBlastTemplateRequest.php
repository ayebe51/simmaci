<?php

namespace App\Http\Requests\WaBlast;

use Illuminate\Foundation\Http\FormRequest;

class UpdateWaBlastTemplateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'body' => 'required|string',
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Nama template tidak boleh kosong.',
            'name.max'      => 'Nama template maksimal 255 karakter.',
            'body.required' => 'Isi template tidak boleh kosong.',
        ];
    }
}
