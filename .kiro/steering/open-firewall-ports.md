# Buka Port 9000 dan 9001 di Firewall

## Pertanyaan Pertama
**Anda pakai hosting provider apa?**
- AWS (EC2)
- DigitalOcean
- Linode
- Vultr
- Azure
- Google Cloud
- VPS lokal (Contabo, Hetzner, dll)
- Atau lainnya?

---

## Opsi 1: AWS (EC2)

### Langkah-langkah:

1. **Login ke AWS Console**
   - Buka https://console.aws.amazon.com

2. **Cari EC2 Dashboard**
   - Services → EC2 → Instances

3. **Pilih instance Anda**
   - Cari instance dengan IP `76.13.193.161`

4. **Cari Security Group**
   - Di bagian bawah, lihat "Security groups"
   - Klik security group yang digunakan

5. **Edit Inbound Rules**
   - Klik tab "Inbound rules"
   - Klik "Edit inbound rules"

6. **Tambah Rule untuk Port 9000**
   ```
   Type: Custom TCP
   Protocol: TCP
   Port Range: 9000
   Source: 0.0.0.0/0 (atau IP spesifik)
   ```

7. **Tambah Rule untuk Port 9001**
   ```
   Type: Custom TCP
   Protocol: TCP
   Port Range: 9001
   Source: 0.0.0.0/0 (atau IP spesifik)
   ```

8. **Klik "Save rules"**

---

## Opsi 2: DigitalOcean

### Langkah-langkah:

1. **Login ke DigitalOcean**
   - Buka https://cloud.digitalocean.com

2. **Cari Firewall**
   - Networking → Firewalls

3. **Buat atau Edit Firewall**
   - Klik firewall yang digunakan droplet Anda

4. **Tambah Inbound Rules**
   - Klik "Edit" atau "Add Rules"

5. **Tambah Rule untuk Port 9000**
   ```
   Type: TCP
   Port: 9000
   Sources: All IPv4 (0.0.0.0/0)
   ```

6. **Tambah Rule untuk Port 9001**
   ```
   Type: TCP
   Port: 9001
   Sources: All IPv4 (0.0.0.0/0)
   ```

7. **Klik "Save"**

---

## Opsi 3: Linode

### Langkah-langkah:

1. **Login ke Linode**
   - Buka https://cloud.linode.com

2. **Cari Firewall**
   - Firewalls (di sidebar)

3. **Buat atau Edit Firewall**
   - Klik firewall yang digunakan Linode Anda

4. **Tambah Inbound Rules**
   - Scroll ke "Inbound Rules"
   - Klik "Add an Inbound Rule"

5. **Tambah Rule untuk Port 9000**
   ```
   Protocol: TCP
   Ports: 9000
   Sources: 0.0.0.0/0 (All IPv4)
   ```

6. **Tambah Rule untuk Port 9001**
   ```
   Protocol: TCP
   Ports: 9001
   Sources: 0.0.0.0/0 (All IPv4)
   ```

7. **Klik "Save"**

---

## Opsi 4: VPS Lokal (UFW - Ubuntu/Debian)

Jika Anda bisa akses server via SSH/terminal:

### Langkah-langkah:

1. **SSH ke server**
   ```bash
   ssh root@76.13.193.161
   ```

2. **Buka port 9000**
   ```bash
   sudo ufw allow 9000/tcp
   ```

3. **Buka port 9001**
   ```bash
   sudo ufw allow 9001/tcp
   ```

4. **Verifikasi**
   ```bash
   sudo ufw status
   ```

   Hasil seharusnya:
   ```
   Status: active
   
   To                         Action      From
   --                         ------      ----
   9000/tcp                   ALLOW       Anywhere
   9001/tcp                   ALLOW       Anywhere
   ```

---

## Opsi 5: VPS Lokal (iptables - CentOS/RHEL)

Jika menggunakan iptables:

1. **SSH ke server**
   ```bash
   ssh root@76.13.193.161
   ```

2. **Buka port 9000**
   ```bash
   sudo iptables -A INPUT -p tcp --dport 9000 -j ACCEPT
   ```

3. **Buka port 9001**
   ```bash
   sudo iptables -A INPUT -p tcp --dport 9001 -j ACCEPT
   ```

4. **Save rules**
   ```bash
   sudo service iptables save
   ```

---

## Verifikasi Port Sudah Terbuka

Setelah buka port, verifikasi dengan command:

```bash
telnet 76.13.193.161 9000
```

Atau gunakan online tool:
- https://www.yougetsignal.com/tools/open-ports/
- https://www.canyouseeme.org/

---

## Troubleshooting

### Port masih tidak terbuka
- Pastikan rule sudah tersimpan
- Tunggu 1-2 menit untuk propagation
- Cek apakah ada firewall lain (OS-level)

### Masih error setelah buka port
- Cek apakah MinIO service running
- Cek Coolify logs
- Verifikasi docker-compose.coolify.yml

---

## Checklist

- [ ] Identifikasi hosting provider
- [ ] Login ke dashboard hosting
- [ ] Tambah inbound rule untuk port 9000
- [ ] Tambah inbound rule untuk port 9001
- [ ] Save/apply rules
- [ ] Tunggu 1-2 menit
- [ ] Verifikasi port terbuka
- [ ] Coba akses `http://76.13.193.161:9000`

