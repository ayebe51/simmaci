const XLSX = require('xlsx');

// Mock Data representing the User's Excel
// Row 0: Headers
// Row 1: Sub-headers (for Sertifikasi, etc)
// Row 2: Data
const data = [
    ["NAMA MADRASAH", "Nama Lengkap", "JK", "Tempat Lahir", "Tanggal Lahir", "Jabatan", "Ijasah Terakhir", "TMT", "SERTIFIKASI", null, "PKPNU", null, "No Hp"],
    [null, null, null, null, null, null, null, null, "Sudah", "Belum", "Sudah", "Belum", null],
    ["SMP MA'ARIF NU 1", "ILZAM HABIK, M.Pd", "L", "Cilacap", "8 Mei 1989", "Kepala Sekolah", "S2", "01/08/2012", null, "Ya", "Ya", null, "087736597101"]
];

// Create workbook
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(data);
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

// Test Parsing Logic
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log("Headers Row 0:", rows[0]);
console.log("Headers Row 1:", rows[1]);
console.log("Data Row 2:", rows[2]);

const header0 = rows[0];
const isUserFormat = header0[0] && String(header0[0]).includes('NAMA MADRASAH');

console.log("isUserFormat Detected:", isUserFormat);

if (isUserFormat) {
    const i = 2; // Simulating the loop
    const row = rows[i];
    const madrasah = row[0];
    const nama = row[1];
    
    console.log(`Row ${i} Extraction:`);
    console.log(`Madrasah (Index 0): '${madrasah}'`);
    console.log(`Nama (Index 1): '${nama}'`);

    const isSerdik = String(row[8] || '').toLowerCase() === 'ya'; // Index 8 is 'Sudah' column?
    // In extracted data:
    // Index 8 corresponds to "SERTIFIKASI" -> "Sudah". The value in row 2 is null?
    // Wait, in my mock data:
    // "SERTIFIKASI" is index 8. The "Sudah" column.
    // Row 2 value at index 8 is null.
    // Row 2 value at index 9 ("Belum") is "Ya".
    
    // Let's check logic for "Sudah" (Index 8)
    // In my mock: row[8] is null. row[9] is "Ya".
    // So isSerdik = false.
    // status = Honorer.
}
