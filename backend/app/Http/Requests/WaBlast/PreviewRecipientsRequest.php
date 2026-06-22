<?php

namespace App\Http\Requests\WaBlast;

use Illuminate\Foundation\Http\FormRequest;

class PreviewRecipientsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'recipient_category' => 'required|string|in:kepala_sekolah,gtk,both',
            'jenjang'            => 'nullable|array',
            'jenjang.*'          => 'string|in:TK/RA,RA,MI,MTs,MA,SMA,SMK',
            'school_ids'         => 'nullable|array',
            'school_ids.*'       => 'integer',
        ];
    }

    public function messages(): array
    {
        return [
            'recipient_category.required' => 'Kategori penerima wajib dipilih.',
            'recipient_category.in'       => 'Kategori penerima tidak valid. Pilih: kepala_sekolah, gtk, atau both.',
            'jenjang.*.in'                => 'Jenjang tidak valid. Pilih: TK/RA, RA, MI, MTs, MA, SMA, atau SMK.',
            'school_ids.*.integer'        => 'ID sekolah harus berupa angka.',
        ];
    }
}
