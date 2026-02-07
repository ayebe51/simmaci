# SIM Maarif NU Cilacap - Sistem Informasi Manajemen Pendidikan

> Sistem Informasi Manajemen Pendidikan & Generator SK Digital

**SIM Maarif NU Cilacap** adalah platform berbasis web yang dikembangkan untuk mendigitalkan proses administrasi dan manajemen data di lingkungan LP Ma'arif NU Cilacap. Aplikasi ini mengintegrasikan pengelolaan Data Induk (Sekolah, Guru, Siswa) dengan sistem otomatisasi Surat Keputusan (SK) Digital.

## 🌟 Fitur Unggulan

### 1. 📊 Dashboard Eksekutif

Monitoring real-time statistik pendidikan di seluruh cabang.

- Total Lembaga/Sekolah
- Total Guru & Tenaga Kependidikan (GTK)
- Total Siswa
- Status Pengajuan Dokumen

### 2. 📁 Manajemen Master Data Terpusat

Pengelolaan data referensi yang lengkap dengan filter canggih.

- **Data Lembaga:** Profil sekolah, alamat, dan kepala sekolah.
- **Data Guru:** Status kepegawaian (PNS/GTY/GTT), sertifikasi, dan unit kerja.
- **Data Siswa:** NISN, data kelas, dan demografi.

### 3. 📜 Generator SK Digital (Smart SK)

Sistem cerdas untuk pembuatan Surat Keputusan secara massal/satuan.

- **Template Dinamis:** Mendukung berbagai jenis SK (Mutasi, Pengangkatan, Pemberhentian).
- **QR Code Verification:** Validasi keaslian dokumen via scan QR Code.
- **Digital Signature:** Tanda tangan digital otomatis untuk pejabat berwenang.
- **Export PDF:** Hasil cetak dokumen dalam format PDF siap print.

### 4. 🔐 Keamanan & Akses (RBAC)

Sistem pembagian hak akses yang ketat.

- **Super Admin:** Akses penuh ke seluruh fitur dan pengaturan sistem.
- **Operator Sekolah:** Akses terbatas hanya pada unit kerja masing-masing.

---

## 🛠️ Teknologi yang Digunakan

Aplikasi ini dibangun menggunakan **Modern Full-Stack Architecture** untuk menjamin performa, skalabilitas, dan kemudahan maintain.

### Frontend

- **Framework:** [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Language:** TypeScript
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **UI Component:** [Shadcn/UI](https://ui.shadcn.com/) + Radix UI
- **State Management:** React Hooks
- **Data Fetching:** Axios

### Backend

- **Framework:** [NestJS](https://nestjs.com/) (Node.js framework)
- **Database:** PostgreSQL (Production) / SQLite (Dev)
- **ORM:** TypeORM
- **Authentication:** JWT (JSON Web Tokens)
- **File Handling:** Multer (Uploads)
- **PDF Generation:** PDFKit / Puppeteer

---

## 🚀 Cara Instalasi & Menjalankan

Ikuti langkah-langkah berikut untuk menjalankan aplikasi di komputer lokal Anda.

### Prasyarat

- Node.js (v18+)
- npm / yarn
- PostgreSQL (Opsional jika menggunakan SQLite)

### 1. Clone Repository

```bash
git clone https://github.com/username/sim-maarif-cilacap.git
cd sim-maarif-cilacap
```

### 2. Setup Backend

```bash
cd backend
npm install

# Setup Environment Variables (Buat file .env)
cp .env.example .env

# Jalankan Server (Development)
npm run start:dev
```

*Backend akan berjalan di `http://localhost:3000`*

### 3. Setup Frontend

Buka terminal baru.

```bash
# Kembali ke root folder jika dari backend
cd .. 

npm install

# Jalankan Frontend
npm run dev
```

*Frontend akan berjalan di `http://localhost:5173`*

---

## 📸 Screenshots

*(Tempatkan screenshot aplikasi di folder `/screenshots` dan link di sini)*

| Dashboard Admin | Generator SK |
| :---: | :---: |
| ![Dashboard Mockup](https://placehold.co/600x400/e2e8f0/475569?text=Dashboard+View) | ![SK Generator Mockup](https://placehold.co/600x400/e2e8f0/475569?text=SK+Generator) |

---

## 📄 Lisensi

Hak Cipta © 2025 **Ahmad Ayub Nu'man** untuk LP Ma'arif NU Cilacap.  
Aplikasi ini dilindungi oleh hak cipta. Dilarang keras menggandakan, mendistribusikan ulang, atau mengklaim kepemilikan tanpa izin tertulis dari pengembang.
