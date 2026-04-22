# Setup Domain untuk Coolify Dashboard

## Info Anda
- **Domain**: `simmaci.com` (sudah ada)
- **Coolify URL sekarang**: `http://76.13.193.161:8000`
- **Tujuan**: Akses Coolify via `https://coolify.simmaci.com`

---

## Langkah 1: Setup DNS Record untuk Coolify

Di DNS provider Anda (tempat Anda setup `minio.simmaci.com`):

### Tambahkan A Record baru:

```
Type:  A
Name:  coolify
Value: 76.13.193.161
TTL:   3600
```

**Hasil akhir akan terlihat seperti:**
```
┌──────────────────────────────────────────────────┐
│ DNS Records for simmaci.com                      │
├──────────────────────────────────────────────────┤
│ Type │ Name    │ Value          │ TTL              │
├──────────────────────────────────────────────────┤
│ A    │ @       │ 76.13.193.161  │ 3600             │
│ A    │ minio   │ 76.13.193.161  │ 3600             │
│ A    │ coolify │ 76.13.193.161  │ 3600             │
│ ...  │ ...     │ ...            │ ...              │
└──────────────────────────────────────────────────┘
```

---

## Langkah 2: Tunggu DNS Propagation

Tunggu 5-30 menit untuk DNS propagation.

Verifikasi dengan:
```bash
nslookup coolify.simmaci.com
```

**Hasil yang benar:**
```
Name:    coolify.simmaci.com
Address:  76.13.193.161
```

---

## Langkah 3: Setup Coolify untuk Domain

Setelah DNS pointing, login ke Coolify:

1. Buka `http://76.13.193.161:8000`
2. Cari menu **Settings** atau **Configuration**
3. Cari section **Domain** atau **Hostname**
4. Isi dengan: `coolify.simmaci.com`
5. Save

---

## Langkah 4: Setup SSL Certificate

Coolify biasanya auto-generate SSL via Let's Encrypt:

1. Di Coolify Settings, cari **SSL** atau **Certificate**
2. Pastikan **Auto SSL** atau **Let's Encrypt** enabled
3. Coolify akan auto-generate certificate untuk `coolify.simmaci.com`

---

## Langkah 5: Akses Coolify via Domain

Setelah setup selesai:

1. Buka browser → `https://coolify.simmaci.com`
2. Anda akan akses Coolify dashboard via domain (bukan IP)

---

## Troubleshooting

### Coolify tidak bisa diakses via domain
- Pastikan DNS sudah pointing: `nslookup coolify.simmaci.com`
- Pastikan Coolify sudah configure domain di settings
- Cek firewall allow port 443 (HTTPS)
- Cek Coolify logs

### SSL Certificate error
- Pastikan domain sudah pointing ke IP
- Tunggu 5-10 menit untuk Let's Encrypt generate certificate
- Cek Coolify logs untuk error details

---

## Checklist

- [ ] Login ke DNS provider
- [ ] Tambah A record: `coolify` → `76.13.193.161`
- [ ] Tunggu DNS propagation (5-30 menit)
- [ ] Verifikasi dengan `nslookup coolify.simmaci.com`
- [ ] Login ke Coolify dashboard
- [ ] Setup domain di Coolify settings
- [ ] Setup SSL certificate
- [ ] Akses `https://coolify.simmaci.com`

---

## Catatan

- Setelah setup domain Coolify, Anda bisa akses via `https://coolify.simmaci.com` (lebih mudah daripada IP)
- Semua service (SIMMACI, MinIO, etc) tetap berjalan normal
- Hanya akses Coolify dashboard yang berubah dari IP ke domain
