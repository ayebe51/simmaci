# Gmail App Password Setup untuk Email Notifications

## Langkah-langkah Setup:

### 1. Aktifkan 2-Step Verification
- Buka https://myaccount.google.com/security
- Cari "2-Step Verification"
- Ikuti langkah-langkah untuk mengaktifkan

### 2. Buat App Password
- Setelah 2FA aktif, buka https://myaccount.google.com/apppasswords
- Pilih "Select app" → "Mail"
- Pilih "Select device" → "Other (Custom name)"
- Ketik "SIM Maarif Backend"
- Klik "Generate"
- Copy 16-digit password yang muncul (contoh: `abcd efgh ijkl mnop`)

### 3. Update .env
Tambahkan ke file `.env` Anda (JANGAN commit file .env ke Git!):

```
EMAIL_USER=pclpmaarifcilacap@gmail.com
EMAIL_PASSWORD=abcd efgh ijkl mnop
FRONTEND_URL=http://localhost:5173
```

### 4. Test Email
Setelah konfigurasi, restart backend server dan test dengan approve SK.

## Troubleshooting:

**"Invalid login"**
- Pastikan menggunakan App Password, bukan password Gmail biasa
- Pastikan 2FA sudah aktif
- Hapus spasi dari App Password

**"Authentication failed"**
- Check EMAIL_USER sudah benar
- Regenerate App Password dan coba lagi

**Email tidak terkirim**
- Check console log backend untuk error detail
- Pastikan internet connection stabil
- Verifikasi Gmail account tidak di-block
