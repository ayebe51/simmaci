<?php

namespace App\Http\Requests\WaBlast;

use Illuminate\Foundation\Http\FormRequest;

class StoreWaBlastRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'title'                    => 'required|string|max:255',
            'recipient_category'       => 'required|string|in:kepala_sekolah,gtk,both',
            'jenjang'                  => 'nullable|array',
            'jenjang.*'                => 'string|in:MI,MTs,MA',
            'school_ids'               => 'nullable|array',
            'school_ids.*'             => 'integer',
            'message_body'             => 'required|string|max:4096',
            'attachment'               => 'nullable|file|mimes:pdf|max:10240',
            'scheduled_at'             => 'nullable|date|after:now',
            'excluded_phone_numbers'   => 'nullable|array',
            'excluded_phone_numbers.*' => 'string',
        ];
    }

    public function messages(): array
    {
        return [
            'title.required'              => 'Judul blast wajib diisi.',
            'title.max'                   => 'Judul blast maksimal 255 karakter.',
            'recipient_category.required' => 'Kategori penerima wajib dipilih.',
            'recipient_category.in'       => 'Kategori penerima tidak valid. Pilih: kepala_sekolah, gtk, atau both.',
            'jenjang.*.in'                => 'Jenjang tidak valid. Pilih: MI, MTs, atau MA.',
            'school_ids.*.integer'        => 'ID sekolah harus berupa angka.',
            'message_body.required'       => 'Isi pesan tidak boleh kosong.',
            'message_body.max'            => 'Pesan terlalu panjang. Maksimal 4.096 karakter.',
            'attachment.mimes'            => 'File harus berformat PDF.',
            'attachment.max'              => 'Ukuran file maksimal 10 MB.',
            'scheduled_at.date'           => 'Format waktu pengiriman tidak valid.',
            'scheduled_at.after'          => 'Waktu pengiriman harus di masa mendatang.',
        ];
    }
}
