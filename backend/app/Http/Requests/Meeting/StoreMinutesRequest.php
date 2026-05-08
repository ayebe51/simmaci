<?php

namespace App\Http\Requests\Meeting;

use Illuminate\Foundation\Http\FormRequest;

/**
 * StoreMinutesRequest
 *
 * Form request for creating meeting minutes.
 * Validates the title and HTML content from rich text editor.
 *
 * **Validates: Requirements 33**
 */
class StoreMinutesRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Only super_admin and admin_yayasan can create minutes
        return $this->user() && in_array($this->user()->role, ['super_admin', 'admin_yayasan']);
    }

    public function rules(): array
    {
        return [
            'title' => 'nullable|string|max:255',
            'content' => 'required|string|max:50000', // Allow up to 50KB of HTML content
        ];
    }

    public function messages(): array
    {
        return [
            'content.required' => 'Konten notulensi wajib diisi',
            'content.max' => 'Konten notulensi terlalu panjang (maksimal 50000 karakter)',
            'title.max' => 'Judul notulensi terlalu panjang (maksimal 255 karakter)',
        ];
    }
}
