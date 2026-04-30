import * as XLSX from 'xlsx';

/**
 * School Import Template Generator
 * Generates an Excel template file for bulk school data import
 */

// Column headers for school import
const HEADERS = [
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
  'no_telepon',
];

// Sample data rows for template
const SAMPLE_DATA = [
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
    '08123456789',
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
    '08987654321',
  ],
];

// Configuration
const CONFIG = {
  sheetName: 'SchoolsTemplate',
  outputFileName: 'schools_import_template.xlsx',
  minColumnWidth: 20,
};

/**
 * Generate Excel template file
 */
function generateTemplate() {
  try {
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheetData = [HEADERS, ...SAMPLE_DATA];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Auto-size columns based on header length
    const columnWidths = HEADERS.map((header) => ({
      wch: Math.max(header.length, CONFIG.minColumnWidth),
    }));
    worksheet['!cols'] = columnWidths;

    // Append worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, CONFIG.sheetName);

    // Write file to disk
    XLSX.writeFile(workbook, CONFIG.outputFileName);

    console.log(`✓ Template generated successfully: ${CONFIG.outputFileName}`);
    console.log(`  - Sheet name: ${CONFIG.sheetName}`);
    console.log(`  - Columns: ${HEADERS.length}`);
    console.log(`  - Sample rows: ${SAMPLE_DATA.length}`);
  } catch (error) {
    console.error('✗ Error generating template:', error.message);
    process.exit(1);
  }
}

// Execute template generation
generateTemplate();
