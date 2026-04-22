# Configure Traefik di Coolify untuk MinIO

## Masalah
- MinIO running tapi hanya accessible via internal IP (10.x.x.x)
- Tidak bisa diakses via public IP (76.13.193.161) atau domain (minio.simmaci.com)
- Perlu configure Traefik routing di Coolify

---

## Solusi: Update docker-compose.coolify.yml

Tambahkan Traefik labels ke MinIO service agar bisa diakses dari public.

### Edit `docker-compose.coolify.yml`:

Cari section MinIO dan tambahkan labels:

```yaml
minio:
  image: minio/minio
  container_name: simmaci-minio
  restart: unless-stopped
  environment:
    MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
    MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    MINIO_PUBLIC_URL: ${MINIO_PUBLIC_URL}
  volumes:
    - minio-data:/data
  command: server /data --console-address ":9001"
  networks:
    - simmaci-network
  labels:
    # ← TAMBAHKAN LABELS INI
    - "traefik.enable=true"
    
    # MinIO API (port 9000)
    - "traefik.http.routers.minio-api.rule=Host(`minio.simmaci.com`)"
    - "traefik.http.routers.minio-api.entrypoints=websecure"
    - "traefik.http.routers.minio-api.tls.certresolver=letsencrypt"
    - "traefik.http.services.minio-api.loadbalancer.server.port=9000"
    
    # MinIO Console (port 9001) - optional
    - "traefik.http.routers.minio-console.rule=Host(`minio-console.simmaci.com`)"
    - "traefik.http.routers.minio-console.entrypoints=websecure"
    - "traefik.http.routers.minio-console.tls.certresolver=letsencrypt"
    - "traefik.http.services.minio-console.loadbalancer.server.port=9001"
```

---

## Langkah-Langkah

### 1. Edit docker-compose.coolify.yml

Buka file `docker-compose.coolify.yml` di editor Anda.

### 2. Cari section MinIO

Cari bagian:
```yaml
minio:
  image: minio/minio
```

### 3. Tambahkan labels

Setelah `networks:` section, tambahkan `labels:` dengan content di atas.

### 4. Save file

### 5. Push ke repository (jika pakai Git)

```bash
git add docker-compose.coolify.yml
git commit -m "Add Traefik labels for MinIO"
git push
```

### 6. Redeploy di Coolify

Di Coolify dashboard:
1. Klik project SIMMACI
2. Klik **Redeploy**
3. Tunggu sampai selesai

---

## Verifikasi

Setelah redeploy:

1. **Cek MinIO API**
   - URL: `https://minio.simmaci.com`
   - Seharusnya bisa diakses

2. **Cek MinIO Console** (optional)
   - URL: `https://minio-console.simmaci.com:9001`
   - Atau: `https://minio-console.simmaci.com`
   - Login dengan credentials

3. **Test upload file**
   - Di aplikasi SIMMACI, coba upload
   - Cek apakah file tersimpan di MinIO

---

## Troubleshooting

### Masih tidak bisa diakses
- Pastikan DNS sudah pointing: `nslookup minio.simmaci.com`
- Cek Coolify logs untuk error
- Pastikan firewall allow port 443 (HTTPS)

### SSL Certificate error
- Tunggu 5-10 menit untuk Let's Encrypt generate certificate
- Cek Coolify logs

### Port conflict
- Pastikan port 9000 dan 9001 tidak digunakan service lain
- Cek Coolify network configuration

---

## Catatan

- Traefik labels memberi tahu Coolify bagaimana route traffic ke MinIO
- `websecure` = HTTPS (port 443)
- `letsencrypt` = auto SSL certificate via Let's Encrypt
- Setelah setup, MinIO bisa diakses via domain dengan SSL

