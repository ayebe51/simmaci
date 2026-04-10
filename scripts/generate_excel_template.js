import * as XLSX from 'xlsx';
import * as fs from 'fs';

const headers = [
    'nama_sekolah',
    'nsm',
    'npsn',
    'kepala_madrasah',
    'akreditasi',
    'npsm_nu',
    'status',
    'kecamatan',
    'alamat',
    'email',
    'no_telepon'
];

const data = [
    headers,
    [
        'Contoh MI Maarif',
        '12345678',
        '60708090',
        'Drs. Ahmad Jaka',
        'A',
        'NU.001.07',
        'Jamaah',
        'Cilacap Tengah',
        'Jl. Raya No. 1, Kota',
        'mi@maarif.nu',
        '08123456789'
    ],
    [
        'Madrasah Aliyah',
        '87654321',
        '90807060',
        'Hj. Siti Aminah',
        'B',
        'NU.002.07',
        'Jamiyyah',
        'Jeruklegi',
        'Jl. Pendidikan No. 10',
        'ma@maarif.nu',
        '08987654321'
    ]
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(data);

// Auto-size columns (rough estimate)
const wscols = headers.map(h => ({ wch: Math.max(h.length, 20) }));
ws['!cols'] = wscols;

XLSX.utils.book_append_sheet(wb, ws, "SchoolsTemplate");
XLSX.writeFile(wb, "schools_import_template.xlsx");
console.log("Template generated successfully: schools_import_template.xlsx");
