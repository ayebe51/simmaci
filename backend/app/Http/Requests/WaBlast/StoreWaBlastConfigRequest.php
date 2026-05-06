<?php

namespace App\Http\Requests\WaBlast;

use Illuminate\Foundation\Http\FormRequest;

class StoreWaBlastConfigRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'api_url'                    => 'required|url|max:500',
            'api_token'                  => 'required|string',
            'sender_number'              => ['required', 'string', 'regex:/^62[0-9]{9,13}$/'],
            'max_recipients_per_session' => 'required|integer|min:1|max:1000',
            'max_daily_messages'         => 'required|integer|min:1|max:5000',
        ];
    }

    public function messages(): array
    {
        return [
            'api_url.required'                    => 'URL endpoint Go-WA wajib diisi.',
            'api_url.url'                         => 'Format URL tidak valid.',
            'api_url.max'                         => 'URL maksimal 500 karakter.',
            'api_token.required'                  => 'API Token wajib diisi.',
            'sender_number.required'              => 'Nomor pengirim wajib diisi.',
            'sender_number.regex'                 => 'Nomor pengirim harus dalam format internasional Indonesia (contoh: 6281234567890).',
            'max_recipients_per_session.required' => 'Batas penerima per sesi wajib diisi.',
            'max_recipients_per_session.integer'  => 'Batas penerima per sesi harus berupa angka.',
            'max_recipients_per_session.min'      => 'Batas penerima per sesi minimal 1.',
            'max_recipients_per_session.max'      => 'Batas penerima per sesi maksimal 1.000.',
            'max_daily_messages.required'         => 'Batas pesan harian wajib diisi.',
            'max_daily_messages.integer'          => 'Batas pesan harian harus berupa angka.',
            'max_daily_messages.min'              => 'Batas pesan harian minimal 1.',
            'max_daily_messages.max'              => 'Batas pesan harian maksimal 5.000.',
        ];
    }
}
