import * as XLSX from "xlsx";

// Define the template structure
const TEMPLATE_HEADERS = [
  "NISN",
  "Nama Lengkap",
  "NIK",
  "Tempat Lahir",
  "Tanggal Lahir (YYYY-MM-DD)",
  "Kelas",
  "L/P",
  "Nama Ayah",
  "Nama Ibu",
  "Asal Sekolah",
  "NPSN",
  // Additional useful fields
  "Alamat",
  "Kecamatan",
  "Nomor Telepon",
  "Nama Wali",
  "Nomor Induk Maarif"
];

const TEMPLATE_SAMPLE_DATA = [
  [
    "1234567890", // NISN
    "Siswa Contoh", // Nama
    "3301xxxxxxxx", // NIK
    "Cilacap", // Tempat Lahir
    "2010-01-01", // Tanggal Lahir
    "7A", // Kelas
    "L", // L/P
    "Nama Ayah", // Nama Ayah
    "Nama Ibu", // Nama Ibu
    "MI Ma'arif 01", // Asal Sekolah
    "12345678", // NPSN
    "Jl. Contoh No. 1", // Alamat
    "Cilacap Tengah", // Kecamatan
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
    { wch: 20 }, // NIK
    { wch: 15 }, // Tempat Lahir
    { wch: 15 }, // Tanggal Lahir
    { wch: 8 },  // Kelas
    { wch: 5 },  // L/P
    { wch: 20 }, // Nama Ayah
    { wch: 20 }, // Nama Ibu
    { wch: 20 }, // Sekolah
    { wch: 15 }, // NPSN
    { wch: 30 }, // Alamat
    { wch: 15 }, // Kecamatan
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
        const mappedData = rawData.map((row: any) => {
             const jkValue = String(row["L/P"] || row["jk"] || "L").trim().toUpperCase();
             const jenisKelamin = jkValue === "L" ? "Laki-laki" : jkValue === "P" ? "Perempuan" : jkValue;

             return {
                nisn: String(row["NISN"] || row["nisn"] || "").trim(),
                nama: String(row["Nama Lengkap"] || row["nama"] || "").trim(),
                nik: String(row["NIK"] || row["nik"] || "").trim(),
                tempatLahir: row["Tempat Lahir"] || row["tempat_lahir"],
                tanggalLahir: row["Tanggal Lahir (YYYY-MM-DD)"] || row["tanggal_lahir"],
                kelas: String(row["Kelas"] || row["kelas"] || "").trim(),
                jenisKelamin: jenisKelamin,
                namaAyah: row["Nama Ayah"] || row["nama_ayah"],
                namaIbu: row["Nama Ibu"] || row["nama_ibu"],
                namaSekolah: row["Asal Sekolah"] || row["sekolah"],
                npsn: String(row["NPSN"] || row["npsn"] || "").trim(),
                
                // Extras
                alamat: row["Alamat"] || row["alamat"],
                kecamatan: row["Kecamatan"] || row["kecamatan"],
                nomorTelepon: String(row["Nomor Telepon"] || row["telepon"] || "").trim(),
                namaWali: row["Nama Wali"] || row["wali"],
                nomorIndukMaarif: String(row["Nomor Induk Maarif"] || row["id_maarif"] || "").trim(),
             };
        }).filter(s => s.nisn && s.nama); // Filter empty rows (Must have NISN & Nama)

        resolve(mappedData);
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};
