# Setup DNS untuk minio.simmaci.com

## Status Sekarang
- ❌ DNS `minio.simmaci.com` belum pointing ke IP `76.13.193.161`
- ✅ Domain `simmaci.com` sudah ada

---

## Langkah 1: Akses DNS Provider Anda

Anda perlu login ke tempat Anda membeli domain `simmaci.com`. Biasanya:
- Namecheap
- GoDaddy
- Cloudflare
- IDwebhost
- Niagahoster
- Atau provider lain

---

## Langkah 2: Tambah DNS Record

Di DNS provider, cari section **DNS Records** atau **DNS Management**.

### Tambahkan A Record baru:

```
Type:  A
Name:  minio
Value: 76.13.193.161
TTL:   3600 (atau default)
```

**Atau jika provider meminta full domain:**
```
Type:  A
Name:  minio.simmaci.com
Value: 76.13.193.161
TTL:   3600
```

### Hasil akhir akan terlihat seperti:

```
┌──────────────────────────────────────────────────┐
│ DNS Records for simmaci.com                      │
├──────────────────────────────────────────────────┤
│ Type │ Name  │ Value          │ TTL              │
├──────────────────────────────────────────────────┤
│ A    │ @     │ 76.13.193.161  │ 3600             │
│ A    │ minio │ 76.13.193.161  │ 3600             │
│ ...  │ ...   │ ...            │ ...              │
└──────────────────────────────────────────────────┘
```

---

## Langkah 3: Tunggu DNS Propagation

DNS record baru biasanya butuh waktu untuk propagate:
- **Cepat**: 5-15 menit
- **Normal**: 30 menit - 2 jam
- **Lambat**: Sampai 24 jam

---

## Langkah 4: Verifikasi DNS

Setelah menunggu, cek apakah DNS sudah pointing:

**Cara 1: Gunakan nslookup (Command Line)**
```bash
nslookup minio.simmaci.com
```

**Hasil yang benar:**
```
Server:  UnKnown
Address:  2001:4489:40a:101::2

Name:    minio.simmaci.com
Address:  76.13.193.161
```

**Cara 2: Gunakan Online Tool**
- https://www.nslookup.io/
- https://mxtoolbox.com/
- https://dnschecker.org/

Masukkan: `minio.simmaci.com`

---

## Langkah 5: Setelah DNS Pointing

Setelah DNS sudah pointing, lanjut ke setup Coolify dengan environment variables:

```
MINIO_PUBLIC_URL=https://minio.simmaci.com
AWS_ENDPOINT=https://minio.simmaci.com
VITE_STORAGE_URL=https://minio.simmaci.com/simmaci-storage
```

---

## Troubleshooting

### DNS masih belum pointing setelah 1 jam
- Cek apakah record sudah tersimpan di DNS provider
- Coba clear DNS cache: `ipconfig /flushdns` (Windows) atau `sudo dscacheutil -flushcache` (Mac)
- Coba gunakan DNS lain: `nslookup minio.simmaci.com 8.8.8.8`

### Masih error setelah DNS pointing
- Pastikan Coolify sudah configure Traefik untuk routing
- Cek firewall allow port 443 (HTTPS)
- Cek Coolify logs

---

## Checklist

- [ ] Login ke DNS provider
- [ ] Tambah A record: `minio` → `76.13.193.161`
- [ ] Tunggu DNS propagation (5-30 menit)
- [ ] Verifikasi dengan `nslookup minio.simmaci.com`
- [ ] Hasil menunjukkan IP `76.13.193.161`
- [ ] Lanjut ke setup Coolify environment variables
