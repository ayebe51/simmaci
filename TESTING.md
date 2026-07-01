# Panduan Pengujian (Testing Guide) SIMMACI

Dokumen ini berisi panduan dan standar prosedur pengujian (testing) untuk aplikasi SIMMACI. Tujuannya adalah untuk memastikan kualitas kode dan fitur sebelum dirilis ke server produksi.

## 1. Pengujian Otomatis (Automated Testing)

SIMMACI menggunakan **PHPUnit** untuk pengujian di sisi backend (Laravel). Seluruh test case terintegrasi dengan GitHub Actions (CI/CD) yang akan berjalan otomatis setiap kali ada perubahan kode (Push/Pull Request).

### Menjalankan Test Secara Lokal
Jika Anda mengembangkan fitur baru secara lokal, pastikan semua test lulus sebelum melakukan commit.

1. **Jalankan semua test:**
   ```bash
   php artisan test
   ```
2. **Jalankan test untuk satu class spesifik:**
   ```bash
   php artisan test --filter SkDocumentNotificationTest
   ```
3. **Jalankan test untuk satu metode spesifik:**
   ```bash
   php artisan test --filter "SkDocumentNotificationTest::test_admin_receives_notification"
   ```

### Standar Penulisan Test Baru
- Setiap pembuatan API endpoint baru atau perubahan *business logic* wajib disertai dengan *Unit Test* atau *Feature Test*.
- Letakkan file test di direktori `tests/Unit` atau `tests/Feature`.
- Gunakan data tiruan (Mock/Factory) untuk memastikan test dapat berjalan mandiri (independen) tanpa bergantung pada data *real* di database.

---

## 2. Pengujian Manual (Manual Testing)

Beberapa fitur yang kompleks (terutama yang berinteraksi erat dengan UI/UX) wajib melewati proses pengujian manual (QA). 

### Modul Prioritas Pengujian Manual
1. **Modul Pengajuan SK (SK Management)**
   - **Scenario 1:** Uji coba *generate* dan *print* SK untuk Guru Baru (TMT < 11 bulan). Pastikan teks pada surat berbunyi `"diangkat sebagai"`.
   - **Scenario 2:** Uji coba *generate* dan *print* SK untuk Guru Lama (TMT > 11 bulan). Pastikan teks pada surat berbunyi `"diangkat kembali sebagai"`.
   - **Scenario 3:** Pengajuan SK dari madrasah jenjang MI, MTs, MA, dll. Pastikan sistem memblokir pengajuan dan menampilkan error 422 ("Pengajuan SK saat ini hanya dibuka untuk jenjang RA").
   - **Scenario 4:** Pengajuan SK dari madrasah jenjang RA. Pastikan berhasil.

2. **Modul Kehadiran & WhatsApp Blast**
   - **Scenario 1:** Uji coba *scan* QR presensi masuk dan pulang.
   - **Scenario 2:** Uji coba sinkronisasi template *WhatsApp Blast*.

---

## 3. Pelaporan Bug (Bug Reporting)

Apabila ditemukan *error* atau anomali saat pengujian (baik di lokal, *staging*, atau *production*), harap laporkan ke dalam **GitHub Issues**.

### Cara Melaporkan Bug
1. Buka tab **Issues** di repositori GitHub SIMMACI.
2. Klik **New Issue** dan pilih template **Bug Report**.
3. Isi informasi selengkapnya sesuai panduan:
   - **Deskripsi Bug:** Penjelasan singkat mengenai error yang terjadi.
   - **Langkah Mereproduksi (Steps to Reproduce):** Langkah demi langkah agar *developer* bisa mereproduksi error tersebut.
   - **Ekspektasi (Expected Behavior):** Apa yang seharusnya terjadi.
   - **Realita (Actual Behavior):** Apa yang saat ini terjadi (lampirkan log, error code, atau *screenshot* jika ada).

---

## 4. Checklist Rilis (Pull Request)

Untuk setiap penambahan fitur, pastikan Anda mencentang daftar periksa (checklist) yang terdapat di *Pull Request Template*. Ini memastikan bahwa kode yang digabungkan (merge) ke *branch main* sudah melalui proses verifikasi yang cukup.

**Kriteria Lulus (Acceptance Criteria):**
- [ ] Lulus dari pengujian CI/CD (GitHub Actions warna hijau).
- [ ] Telah diuji secara manual.
- [ ] Tidak ada regresi (fitur lama yang tiba-tiba rusak).
