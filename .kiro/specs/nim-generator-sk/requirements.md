# Requirements Document: Generate/Input NIM di SK Generator

## Introduction

Fitur ini memungkinkan pengguna untuk menambahkan NIM (Nomor Induk Mengajar) guru secara otomatis atau manual langsung dari halaman SK Generator, tanpa perlu keluar dari workflow. Ketika guru tidak memiliki NIM di sistem, dialog akan muncul dengan dua opsi: generate NIM unik secara otomatis atau input NIM manual dari data master. Setelah NIM tersimpan ke teacher record, SK dapat diproses dan dicetak dengan NIM yang lengkap.

## Glossary

- **NIM**: Nomor Induk Mengajar - identitas unik untuk setiap guru
- **SK**: Surat Keputusan - dokumen resmi keputusan (pengangkatan, mutasi, pemberhentian)
- **SK Generator**: Halaman aplikasi untuk membuat dan memproses SK
- **Teacher Record**: Data guru yang tersimpan di database
- **Dialog**: Popup/modal yang muncul di layar untuk interaksi user
- **Duplikasi NIM**: Kondisi ketika dua atau lebih guru memiliki NIM yang sama
- **Data Master**: Data referensi guru yang sudah terupload ke sistem
- **Tenant**: Sekolah/lembaga yang menggunakan sistem (multi-tenant)

## Requirements

### Requirement 1: Deteksi Guru Tanpa NIM

**User Story:** Sebagai operator SK Generator, saya ingin sistem mendeteksi ketika guru tidak memiliki NIM, sehingga saya dapat menambahkannya sebelum SK diproses.

#### Acceptance Criteria

1. WHEN guru dipilih di SK Generator dan guru tersebut tidak memiliki NIM, THEN sistem SHALL menampilkan dialog "Tambah NIM Guru"
2. WHEN guru sudah memiliki NIM, THEN sistem SHALL NOT menampilkan dialog dan SK dapat diproses langsung
3. WHEN user membatalkan dialog (klik tombol Cancel/Close), THEN sistem SHALL kembali ke halaman SK Generator tanpa menyimpan perubahan
4. THE Dialog SHALL menampilkan nama guru dan informasi sekolah untuk konfirmasi identitas yang benar

### Requirement 2: Generate NIM Otomatis

**User Story:** Sebagai operator, saya ingin generate NIM otomatis untuk guru yang belum memiliki NIM, sehingga proses lebih cepat dan tidak perlu mencari data manual.

#### Acceptance Criteria

1. WHEN user klik tombol "Generate NIM" di dialog, THEN sistem SHALL generate NIM unik yang belum ada di database
2. THE Generated_NIM SHALL berupa angka sequential — mengambil NIM terbesar di database dan menambahkan 1
3. WHEN NIM berhasil di-generate, THEN sistem SHALL menampilkan NIM yang di-generate untuk review user sebelum disimpan
4. WHEN user klik tombol "Simpan" setelah review, THEN sistem SHALL menyimpan NIM ke teacher record dan menutup dialog
5. IF sistem gagal generate NIM (error database), THEN sistem SHALL menampilkan pesan error yang jelas dan user dapat retry

### Requirement 3: Input NIM Manual

**User Story:** Sebagai operator, saya ingin input NIM manual untuk guru yang sudah memiliki NIM di data master, sehingga data tetap konsisten dengan master data.

#### Acceptance Criteria

1. WHEN user klik tombol "Input Manual" di dialog, THEN sistem SHALL menampilkan input field untuk memasukkan NIM
2. THE Input_Field SHALL menerima format NIM sesuai dengan format yang didefinisikan di sistem
3. WHEN user memasukkan NIM dan klik "Simpan", THEN sistem SHALL validasi NIM tidak duplikat di tenant yang sama
4. IF NIM sudah ada di teacher lain dalam tenant yang sama, THEN sistem SHALL menampilkan error "NIM sudah digunakan oleh guru lain"
5. IF NIM valid dan unik, THEN sistem SHALL menyimpan NIM ke teacher record dan menutup dialog
6. WHEN user klik tombol "Batal", THEN sistem SHALL menutup input field dan kembali ke pilihan awal (Generate/Input Manual)

### Requirement 4: Validasi Duplikasi NIM

**User Story:** Sebagai administrator, saya ingin sistem mencegah duplikasi NIM dalam satu tenant, sehingga integritas data terjaga.

#### Acceptance Criteria

1. WHEN user mencoba menyimpan NIM (baik generate maupun manual), THEN sistem SHALL check apakah NIM sudah ada di teacher lain dalam tenant yang sama
2. IF NIM sudah ada, THEN sistem SHALL reject penyimpanan dan tampilkan pesan error dengan nama guru yang sudah memiliki NIM tersebut
3. IF NIM unik dalam tenant, THEN sistem SHALL allow penyimpanan
4. THE Validation SHALL dilakukan di backend (server-side) untuk keamanan
5. WHEN validasi gagal, THEN user dapat retry dengan NIM yang berbeda

### Requirement 5: Penyimpanan NIM ke Teacher Record

**User Story:** Sebagai sistem, saya ingin menyimpan NIM ke teacher record dengan aman dan mencatat aktivitas perubahan, sehingga audit trail terjaga.

#### Acceptance Criteria

1. WHEN NIM berhasil divalidasi, THEN sistem SHALL menyimpan NIM ke kolom `nim` di teacher record
2. WHEN NIM disimpan, THEN sistem SHALL mencatat activity log dengan informasi: guru yang diubah, NIM lama (jika ada), NIM baru, user yang melakukan perubahan, timestamp
3. IF penyimpanan gagal (error database), THEN sistem SHALL rollback dan tampilkan pesan error kepada user
4. AFTER NIM berhasil disimpan, THEN sistem SHALL menutup dialog dan kembali ke SK Generator dengan NIM yang sudah terupdate
5. THE Teacher_Record SHALL immediately reflect perubahan NIM tanpa perlu refresh halaman

### Requirement 6: User Experience - Dialog Tidak Mengganggu Workflow

**User Story:** Sebagai operator, saya ingin dialog NIM muncul hanya ketika diperlukan dan tidak mengganggu workflow SK Generator, sehingga proses tetap lancar.

#### Acceptance Criteria

1. WHEN dialog muncul, THEN dialog SHALL modal (user harus handle dialog sebelum lanjut)
2. THE Dialog SHALL menampilkan dengan jelas dua opsi: "Generate NIM" dan "Input Manual"
3. WHEN user memilih salah satu opsi, THEN interface SHALL update untuk menampilkan form yang sesuai
4. THE Dialog SHALL memiliki tombol "Batal" yang selalu visible untuk cancel operasi
5. WHEN user menyimpan NIM, THEN dialog SHALL menutup otomatis dan user kembali ke SK Generator
6. WHEN user cancel, THEN sistem SHALL NOT menyimpan apapun dan kembali ke SK Generator

### Requirement 7: Format dan Validasi NIM

**User Story:** Sebagai administrator, saya ingin NIM mengikuti format yang konsisten dan valid, sehingga data terstruktur dengan baik.

#### Acceptance Criteria

1. THE NIM_Format SHALL be: angka numerik sequential murni (contoh: `113400139`)
2. WHEN user input NIM manual, THEN sistem SHALL validasi bahwa NIM hanya berisi angka (tidak boleh huruf atau karakter khusus)
3. IF format NIM tidak valid (mengandung non-angka), THEN sistem SHALL tampilkan error "NIM harus berupa angka"
4. WHEN generate NIM otomatis, THEN sistem SHALL mengambil NIM terbesar yang ada di database (global, bukan per tenant) dan menambahkan 1 (increment)
5. IF belum ada NIM di database, THEN sistem SHALL generate NIM dimulai dari `1`
6. THE Generated_NIM SHALL berupa angka bulat positif tanpa leading zeros

### Requirement 8: Integrasi dengan SK Generator

**User Story:** Sebagai operator, saya ingin NIM yang sudah ditambahkan langsung tersedia di SK Generator, sehingga SK dapat diproses tanpa delay.

#### Acceptance Criteria

1. WHEN NIM berhasil disimpan, THEN sistem SHALL update teacher data di SK Generator form tanpa perlu reload halaman
2. WHEN user kembali ke SK Generator setelah menyimpan NIM, THEN NIM SHALL sudah terisi di form SK
3. WHEN user generate SK document, THEN NIM yang sudah disimpan SHALL included di SK document
4. WHEN SK document dicetak/didownload, THEN NIM SHALL visible di dokumen dengan format yang benar

### Requirement 9: Error Handling dan Recovery

**User Story:** Sebagai operator, saya ingin sistem menampilkan pesan error yang jelas dan memberikan opsi untuk retry, sehingga saya dapat mengatasi masalah dengan mudah.

#### Acceptance Criteria

1. IF terjadi error saat generate NIM, THEN sistem SHALL tampilkan pesan error yang deskriptif (bukan error code teknis)
2. IF terjadi error saat validasi duplikasi, THEN sistem SHALL tampilkan pesan error dengan detail: "NIM sudah digunakan oleh [nama guru]"
3. IF terjadi error saat penyimpanan, THEN sistem SHALL tampilkan pesan error dan user dapat retry
4. WHEN user klik "Retry", THEN sistem SHALL attempt operasi yang gagal kembali
5. IF error persisten, THEN sistem SHALL tampilkan opsi "Hubungi Administrator" dengan informasi error untuk debugging

### Requirement 10: Audit Logging

**User Story:** Sebagai administrator, saya ingin semua perubahan NIM tercatat di activity log, sehingga saya dapat melacak siapa yang mengubah NIM dan kapan.

#### Acceptance Criteria

1. WHEN NIM berhasil disimpan, THEN sistem SHALL create activity log entry dengan action "NIM Added" atau "NIM Updated"
2. THE Activity_Log SHALL include: teacher_id, old_nim (jika ada), new_nim, user_id, timestamp, school_id (tenant)
3. WHEN user view activity log, THEN perubahan NIM SHALL visible dengan detail lengkap
4. THE Activity_Log SHALL immutable (tidak bisa diedit atau dihapus)
5. WHEN admin view teacher detail, THEN history perubahan NIM SHALL visible di section "NIM History"

### Requirement 11: Multi-Tenant Isolation

**User Story:** Sebagai administrator, saya ingin NIM validation dan data hanya berlaku dalam tenant yang sama, sehingga data antar sekolah tidak tercampur.

#### Acceptance Criteria

1. WHEN sistem validasi duplikasi NIM, THEN sistem SHALL only check NIM di seluruh teacher (global, lintas tenant) karena NIM bersifat unik secara nasional
2. WHEN user dari sekolah A input NIM, THEN sistem SHALL check NIM di semua sekolah untuk mencegah duplikasi
3. WHEN generate NIM, THEN sistem SHALL mengambil NIM terbesar secara global dari semua teacher di database
4. THE Activity_Log SHALL include school_id untuk memastikan audit trail per tenant
5. IF user dari sekolah A coba akses data guru sekolah B, THEN sistem SHALL reject dengan error "Unauthorized"

### Requirement 12: Backward Compatibility

**User Story:** Sebagai developer, saya ingin fitur ini tidak merusak workflow SK Generator yang sudah ada, sehingga guru dengan NIM tidak terpengaruh.

#### Acceptance Criteria

1. WHEN guru sudah memiliki NIM, THEN sistem SHALL NOT menampilkan dialog dan workflow tetap normal
2. WHEN SK Generator load, THEN sistem SHALL check NIM status tanpa delay (< 100ms)
3. WHEN user generate SK dengan guru yang sudah punya NIM, THEN proses tetap sama seperti sebelumnya
4. THE Existing_SK_Documents SHALL tetap valid dan tidak perlu diupdate
5. IF user upgrade sistem, THEN existing teacher data dengan NIM SHALL tetap intact

---

## Acceptance Criteria Testing Strategy

### Property-Based Testing Candidates

1. **NIM Uniqueness Property**: FOR ALL teachers in same tenant, NIM values SHALL be unique
   - Test: Generate multiple NIMs, verify no duplicates within tenant
   - Metamorphic: Adding new teacher with same NIM should fail

2. **NIM Format Consistency**: FOR ALL generated NIMs, format SHALL be pure numeric sequential integers
   - Test: Generate 100 NIMs, verify all are numeric and each is exactly 1 more than the previous max
   - Invariant: Generated NIM is always max(existing NIMs) + 1

3. **Idempotence of NIM Saving**: Saving same NIM twice SHALL result in same state
   - Test: Save NIM, save again, verify no duplicate entries
   - Mathematically: save(save(nim)) = save(nim)

4. **Round-Trip Property**: NIM saved to database and retrieved SHALL equal original NIM
   - Test: Save NIM → Retrieve → Compare
   - Serialization: encode(decode(nim)) = nim

### Integration Testing Candidates

1. **Dialog Appearance**: Verify dialog appears only when teacher has no NIM
   - Example: Teacher with NIM → no dialog, Teacher without NIM → dialog appears

2. **Error Messages**: Verify error messages are user-friendly and actionable
   - Example: Duplicate NIM → "NIM sudah digunakan oleh [nama guru]"

3. **Activity Logging**: Verify activity log records NIM changes correctly
   - Example: Change NIM → Activity log shows old_nim, new_nim, user, timestamp

4. **Multi-Tenant Isolation**: Verify NIM validation only checks within same tenant
   - Example: School A and School B can have same NIM for different teachers

---

## Notes

- Fitur ini critical untuk workflow SK Generator karena SK tidak boleh ada tanpa NIM
- User experience harus smooth - dialog harus intuitif dan tidak mengganggu
- Validasi duplikasi HARUS di backend untuk security
- Activity logging penting untuk audit trail dan compliance
- Format NIM bisa disesuaikan dengan kebijakan sekolah di masa depan
