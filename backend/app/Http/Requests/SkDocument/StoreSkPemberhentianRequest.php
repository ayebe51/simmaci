<?php

namespace App\Http\Requests\SkDocument;

use Illuminate\Foundation\Http\FormRequest;

class StoreSkPemberhentianRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Otorisasi ditangani middleware role
    }

    public function rules(): array
    {
        return [
            'alasan_pemberhentian' => [
                'required',
                'string',
                'in:pengunduran_diri,pensiun,meninggal_dunia,pelanggaran_disiplin,habis_kontrak,lainnya',
            ],
            'keterangan_pemberhentian' => [
                'nullable',
                'required_if:alasan_pemberhentian,lainnya',
                'string',
                'max:1000',
            ],
            'tanggal_efektif_pemberhentian' => [
                'required',
                'date',
                'after_or_equal:' . now()->subYear()->toDateString(),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'alasan_pemberhentian.required' => 'Alasan pemberhentian wajib diisi.',
            'alasan_pemberhentian.in'       => 'Alasan pemberhentian tidak valid.',
            'keterangan_pemberhentian.required_if'
                => 'Keterangan wajib diisi jika alasan pemberhentian adalah "Lainnya".',
            'tanggal_efektif_pemberhentian.required'
                => 'Tanggal efektif pemberhentian wajib diisi.',
            'tanggal_efektif_pemberhentian.date'
                => 'Tanggal efektif pemberhentian harus berupa tanggal yang valid.',
            'tanggal_efektif_pemberhentian.after_or_equal'
                => 'Tanggal efektif tidak boleh lebih dari 1 tahun ke belakang.',
        ];
    }
}
