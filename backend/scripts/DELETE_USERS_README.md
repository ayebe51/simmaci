# Cara Menghapus User Testing

Ada 3 cara untuk menghapus user testing (MI Wahidiyah dan MI Testing):

## Opsi 1: Via UI Admin Panel (Recommended) ✅

1. Login sebagai `super_admin`
2. Buka menu **Users**
3. Cari user "MI Wahidiyah" atau "MI Testing"
4. Klik tombol **🗑️ Hapus Permanent** (merah tua) di sebelah kanan
5. Konfirmasi penghapusan

**Catatan:**
- Tombol **👤❌ Nonaktifkan** (merah muda) = hanya menonaktifkan user (soft delete)
- Tombol **🗑️ Hapus Permanent** (merah tua) = menghapus permanent dari database

## Opsi 2: Menggunakan Artisan Command

Jika Docker sudah running:

```bash
# Jalankan command di dalam container
docker exec -it simmaci-backend php artisan users:delete-test-users
```

Atau jika menggunakan Laravel lokal:

```bash
cd backend
php artisan users:delete-test-users
```

## Opsi 3: Menggunakan Script SQL

Jika ingin menjalankan manual via psql atau database client:

```bash
# Via Docker
docker exec -i simmaci-db psql -U sim_user -d sim_maarif < scripts/delete_test_users.sql

# Via psql lokal
psql -h localhost -U sim_user -d sim_maarif -f scripts/delete_test_users.sql
```

Atau copy-paste isi file `scripts/delete_test_users.sql` ke database client Anda (DBeaver, pgAdmin, dll).

## User yang Akan Dihapus

- **MI Wahidiyah**
  - Email: `112334456712@simmaci.com`
  - Role: OPERATOR
  - Status: NON-AKTIF

- **MI Testing**
  - Email: `112233445566@simmaci.com`
  - Role: OPERATOR
  - Status: NON-AKTIF

## Perubahan yang Dilakukan

### Backend
- ✅ Menambahkan endpoint `DELETE /api/users/{user}/force` untuk force delete
- ✅ Method `forceDestroy()` di `UserController` yang menghapus:
  - Notifications terkait user
  - Personal access tokens (Sanctum)
  - User record dari database
- ✅ Proteksi: tidak bisa menghapus `super_admin`

### Frontend
- ✅ Menambahkan `userApi.forceDelete()` di `src/lib/api.ts`
- ✅ Menambahkan tombol "Hapus Permanent" di User List
- ✅ Dialog konfirmasi dengan peringatan jelas
- ✅ Membedakan UI antara "Nonaktifkan" vs "Hapus Permanent"

## Catatan Keamanan

- User model tidak menggunakan SoftDeletes, jadi penghapusan langsung permanent
- Script akan menghapus data terkait: notifications dan personal_access_tokens
- Pastikan backup database sebelum menghapus jika diperlukan
- Hanya `super_admin` yang bisa mengakses fitur force delete
