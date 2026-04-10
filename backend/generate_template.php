<?php
require __DIR__.'/vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

// 1. GURU (Teacher) Template
$spreadsheetGuru = new Spreadsheet();
$sheetGuru = $spreadsheetGuru->getActiveSheet();

$columnsGuru = [
    'Nama', 
    'NUPTK', 
    'N.I.M', 
    'Pendidikan', 
    'Provinsi', 
    'Kab/Kota', 
    'Kecamatan', 
    'Kelurahan/Desa', 
    'Status', 
    'Satminkal', 
    'No HP', 
    'Sertifikasi', 
    'PDPKPNU', 
    'Tempat Lahir', 
    'Tgl Lahir', 
    'TMT'
];

$colLetter = 'A';
foreach ($columnsGuru as $column) {
    $sheetGuru->setCellValue($colLetter . '1', $column);
    $colLetter++;
}

$writerGuru = new Xlsx($spreadsheetGuru);
$writerGuru->save('public/TEMPLATE_IMPORT_DATA_GURU_V4.xlsx');
echo "Guru File generated successfully!\n";

// 2. SISWA (Student) Template
$spreadsheetSiswa = new Spreadsheet();
$sheetSiswa = $spreadsheetSiswa->getActiveSheet();

$columnsSiswa = [
    'NISN',
    'NIK',
    'Nama Lengkap',
    'Jenis Kelamin',
    'Tempat Lahir',
    'Tanggal Lahir',
    'Agama',
    'Kewarganegaraan',
    'Alamat Lengkap',
    'Kecamatan',
    'Kelurahan/Desa',
    'Nama Sekolah',
    'NPSN',
    'Kelas',
    'Status',
    'Nama Ayah',
    'Nama Ibu',
    'Nama Wali',
    'Nomor Telepon'
];

$colLetter = 'A';
foreach ($columnsSiswa as $column) {
    $sheetSiswa->setCellValue($colLetter . '1', $column);
    $colLetter++;
}

$writerSiswa = new Xlsx($spreadsheetSiswa);
$writerSiswa->save('public/TEMPLATE_IMPORT_DATA_SISWA_V3.xlsx');
echo "Siswa File generated successfully!\n";
