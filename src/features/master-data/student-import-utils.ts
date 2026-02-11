import * as XLSX from "xlsx";

// Define the template structure
const TEMPLATE_HEADERS = [
  "NISN",
  "Nama Lengkap",
  "L/P", // Jenis Kelamin
  "Tempat Lahir",
  "Tanggal Lahir (YYYY-MM-DD)",
  "Alamat",
  "Kecamatan",
  "Asal Sekolah",
  "Kelas",
  "Nomor Telepon",
  "Nama Wali",
  "Nomor Induk Maarif"
];

const TEMPLATE_SAMPLE_DATA = [
  [
    "1234567890", // NISN
    "Siswa Contoh", // Nama
    "L", // L/P
    "Cilacap", // Tempat Lahir
    "2010-01-01", // Tanggal Lahir
    "Jl. Contoh No. 1", // Alamat
    "Cilacap Tengah", // Kecamatan
    "MI Ma'arif 01", // Asal Sekolah
    "6A", // Kelas
    "08123456789", // Telepon
    "Wali Contoh", // Nama Wali
    "123.456.789" // Nomor Induk Maarif
  ]
];

export const downloadStudentTemplate = () => {
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_SAMPLE_DATA]);

  // Set column widths
  ws["!cols"] = [
    { wch: 15 }, // NISN
    { wch: 30 }, // Nama
    { wch: 5 },  // L/P
    { wch: 15 }, // Tempat Lahir
    { wch: 15 }, // Tanggal Lahir
    { wch: 30 }, // Alamat
    { wch: 15 }, // Kecamatan
    { wch: 20 }, // Sekolah
    { wch: 5 },  // Kelas
    { wch: 15 }, // Telepon
    { wch: 20 }, // Wali
    { wch: 20 }, // ID Maarif
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Template Siswa");
  XLSX.writeFile(wb, "TEMPLATE_IMPORT_DATA_SISWA.xlsx");
};

export const processStudentImport = async (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const rawData = XLSX.utils.sheet_to_json(worksheet);
        
        // Map to Schema
        const mappedData = rawData.map((row: any) => ({
             nisn: String(row["NISN"] || row["nisn"] || "").trim(),
             nama: String(row["Nama Lengkap"] || row["nama"] || "").trim(),
             jenisKelamin: String(row["L/P"] || row["jk"] || "L").trim(),
             tempatLahir: row["Tempat Lahir"] || row["tempat_lahir"],
             tanggalLahir: row["Tanggal Lahir (YYYY-MM-DD)"] || row["tanggal_lahir"],
             alamat: row["Alamat"] || row["alamat"],
             kecamatan: row["Kecamatan"] || row["kecamatan"],
             namaSekolah: row["Asal Sekolah"] || row["sekolah"],
             kelas: String(row["Kelas"] || row["kelas"] || "").trim(),
             nomorTelepon: String(row["Nomor Telepon"] || row["telepon"] || "").trim(),
             namaWali: row["Nama Wali"] || row["wali"],
             nomorIndukMaarif: String(row["Nomor Induk Maarif"] || row["id_maarif"] || "").trim(),
        })).filter(s => s.nisn && s.nama); // Filter empty rows (Must have NISN & Nama)

        resolve(mappedData);
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};
