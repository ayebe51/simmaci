<?php

namespace App\Http\Requests\Meeting;

use Illuminate\Foundation\Http\FormRequest;

/**
 * UploadPhotosRequest
 *
 * Form request for uploading meeting photos.
 * Validates photo files for format, size, and count.
 *
 * **Validates: Requirements 34**
 */
class UploadPhotosRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Only super_admin and admin_yayasan can upload photos
        return $this->user() && in_array($this->user()->role, ['super_admin', 'admin_yayasan']);
    }

    public function rules(): array
    {
        return [
            'photos' => 'required|array|min:1|max:10', // Allow up to 10 photos per upload
            'photos.*' => 'required|image|mimes:jpeg,png,webp,gif|max:10240', // 10MB per file
        ];
    }

    public function messages(): array
    {
        return [
            'photos.required' => 'Minimal satu foto harus dipilih',
            'photos.array' => 'Foto harus berupa array',
            'photos.min' => 'Minimal satu foto harus dipilih',
            'photos.max' => 'Maksimal 10 foto per upload',
            'photos.*.required' => 'Foto wajib dipilih',
            'photos.*.image' => 'File harus berupa gambar',
            'photos.*.mimes' => 'Format foto harus JPEG, PNG, WebP, atau GIF',
            'photos.*.max' => 'Ukuran foto maksimal 10 MB',
        ];
    }
}
