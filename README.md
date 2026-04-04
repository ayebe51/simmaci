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

- **Framework:** [Laravel 12](https://laravel.com/) (PHP)
- **Database:** PostgreSQL
- **ORM:** Eloquent ORM
- **Authentication:** [Laravel Sanctum](https://laravel.com/docs/sanctum) (Token-based API auth)
- **Admin Panel:** [Filament v3](https://filamentphp.com/)
- **File Handling:** Laravel Storage (Local / S3)
- **Document Generation:** PHPWord (`.docx` templates)
- **Audit Trail:** Activity Logging (custom + Spatie)

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
composer install

# Setup Environment Variables (Buat file .env)
cp .env.example .env
php artisan key:generate

# Jalankan Migrasi Database
php artisan migrate --seed

# Jalankan Server (Development)
php artisan serve
```

*Backend akan berjalan di `http://localhost:8000`*

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

## 🐳 Running with Docker

SIMMACI is fully dockerized for easy deployment. Ensure Docker and Docker Compose are installed.

1. **Clone & Configure** (Standard steps)
2. **Environment Setup**:

```bash
cp .env.example .env
cd backend && cp .env.example .env
```

3. **Launch the stack**:

```bash
docker compose up -d --build
```

4. **Database Migration**:

```bash
docker exec -it simmaci-backend php artisan migrate --seed
```

The app will be accessible at `http://localhost`.

---

## ⚙️ CI/CD Pipeline

Uses **GitHub Actions** for automated quality assurance:

- **Backend-CI**: PHP 8.2 Unit Tests via `Tests\Feature\SkDocumentApiTest`.
- **Frontend-CI**: Node 20 ESLint + Vite Production Build verification.

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
