<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class SkBelumMengajukanExport implements FromCollection, WithHeadings, WithEvents, WithStyles
{
    private ?string $jenjang;
    private ?string $kecamatan;
    private ?string $search;
    private ?string $startDate;
    private ?string $endDate;

    public function __construct(
        ?string $jenjang = null,
        ?string $kecamatan = null,
        ?string $search = null,
        ?string $startDate = null,
        ?string $endDate = null
    ) {
        $this->jenjang = $jenjang;
        $this->kecamatan = $kecamatan;
        $this->search = $search;
        $this->startDate = $startDate;
        $this->endDate = $endDate;
    }

    public function collection(): Collection
    {
        $query = DB::table('schools as s')
            ->leftJoin('sk_documents as sk', function ($join) {
                $join->on('sk.school_id', '=', 's.id')
                    ->whereNull('sk.deleted_at')
                    ->whereNotIn('sk.status', ['rejected', 'Rejected']);

                if ($this->startDate) {
                    $join->where('sk.created_at', '>=', $this->startDate);
                }
                if ($this->endDate) {
                    $join->where('sk.created_at', '<=', $this->endDate . ' 23:59:59');
                }
            })
            ->whereNull('sk.id')
            ->whereRaw("LOWER(s.status_jamiyyah) LIKE '%jam%iyyah%'")
            ->whereNull('s.deleted_at');

        if ($this->jenjang) {
            $query->where('s.jenjang', $this->jenjang);
        }

        if ($this->kecamatan) {
            $query->where('s.kecamatan', $this->kecamatan);
        }

        if ($this->search) {
            $search = strtolower($this->search);
            $query->where(function ($q) use ($search) {
                $q->whereRaw("LOWER(s.nama) LIKE ?", ["%{$search}%"])
                  ->orWhereRaw("LOWER(s.npsn) LIKE ?", ["%{$search}%"]);
            });
        }

        $data = $query->select([
            's.nama',
            's.npsn',
            's.jenjang',
            's.kecamatan',
            's.kepala_madrasah',
            's.telepon',
        ])
            ->orderBy('s.nama', 'asc')
            ->get();

        // Map to numbered rows
        return $data->map(function ($item, $index) {
            return [
                'no' => $index + 1,
                'nama' => $item->nama ?? '-',
                'npsn' => $item->npsn ?? '-',
                'jenjang' => $item->jenjang ?? '-',
                'kecamatan' => $item->kecamatan ?? '-',
                'kepala_madrasah' => $item->kepala_madrasah ?? '-',
                'telepon' => $item->telepon ?? '-',
            ];
        });
    }

    public function headings(): array
    {
        return [
            'No',
            'Nama Madrasah',
            'NPSN',
            'Jenjang',
            'Kecamatan',
            'Kepala Madrasah',
            'Nomor Telepon',
        ];
    }

    public function styles(Worksheet $sheet): array
    {
        // Row 4 is the heading row (after 3 header rows prepended via events)
        return [
            4 => ['font' => ['bold' => true]],
            1 => ['font' => ['bold' => true, 'size' => 14]],
            2 => ['font' => ['bold' => true, 'size' => 12]],
            3 => ['font' => ['italic' => true, 'size' => 10]],
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();

                // Build filter description
                $filters = [];
                if ($this->jenjang) {
                    $filters[] = "Jenjang: {$this->jenjang}";
                }
                if ($this->kecamatan) {
                    $filters[] = "Kecamatan: {$this->kecamatan}";
                }
                if ($this->search) {
                    $filters[] = "Pencarian: {$this->search}";
                }
                if ($this->startDate || $this->endDate) {
                    $period = 'Periode: ';
                    $period .= $this->startDate ? $this->startDate : '...';
                    $period .= ' s/d ';
                    $period .= $this->endDate ? $this->endDate : '...';
                    $filters[] = $period;
                }

                $filterText = count($filters) > 0
                    ? 'Filter: ' . implode(', ', $filters)
                    : 'Filter: Semua data';

                $dateText = 'Tanggal Cetak: ' . now()->format('d-m-Y');
                $row3Text = $dateText . ' | ' . $filterText;

                // Insert 3 header rows before data
                $sheet->insertNewRowBefore(1, 3);

                // Row 1: Title
                $sheet->setCellValue('A1', 'Laporan Madrasah Belum Mengajukan SK');
                $sheet->mergeCells('A1:G1');

                // Row 2: Organization
                $sheet->setCellValue('A2', "LP Ma'arif NU Cilacap");
                $sheet->mergeCells('A2:G2');

                // Row 3: Date + Filters
                $sheet->setCellValue('A3', $row3Text);
                $sheet->mergeCells('A3:G3');

                // Auto-width columns
                foreach (range('A', 'G') as $column) {
                    $sheet->getColumnDimension($column)->setAutoSize(true);
                }

                // Center align header rows
                $sheet->getStyle('A1:G1')->getAlignment()->setHorizontal('center');
                $sheet->getStyle('A2:G2')->getAlignment()->setHorizontal('center');
            },
        ];
    }
}
