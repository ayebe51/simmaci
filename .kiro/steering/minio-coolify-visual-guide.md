# Setup MinIO di Coolify - Panduan Visual Step-by-Step

## Langkah 2: Cari Section Environment Variables

### Di Coolify Dashboard SIMMACI Project:

**Anda akan melihat menu di sebelah kiri atau atas. Cari salah satu dari ini:**

```
┌─────────────────────────────────────┐
│ SIMMACI Project                     │
├─────────────────────────────────────┤
│ • Dashboard                         │
│ • Services                          │
│ • Environment (← KLIK INI)          │
│ • Settings                          │
│ • Deployments                       │
│ • Logs                              │
└─────────────────────────────────────┘
```

**Atau cari tab di bagian atas:**
```
[Dashboard] [Services] [Environment] [Settings] [Logs]
                          ↑ KLIK INI
```

---

## Langkah 3: Tambah Environment Variables untuk MinIO

### Setelah masuk ke Environment section:

**Anda akan melihat form seperti ini:**

```
┌─────────────────────────────────────────────────────┐
│ Environment Variables                               │
├─────────────────────────────────────────────────────┤
│                                                     │
│ [+ Add Variable] ← KLIK TOMBOL INI                 │
│                                                     │
│ Existing Variables:                                 │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Variable Name    │ Value                        │ │
│ ├─────────────────────────────────────────────────┤ │
│ │ DB_HOST          │ db                           │ │
│ │ DB_PASSWORD      │ secret                       │ │
│ │ ...              │ ...                          │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Klik [+ Add Variable] dan isi form:

**Form 1 - MinIO User:**
```
Variable Name: MINIO_ROOT_USER
Value:         minioadmin
[Save]
```

**Form 2 - MinIO Password:**
```
Variable Name: MINIO_ROOT_PASSWORD
Value:         SecurePassword123!
[Save]
```

**Form 3 - MinIO Public URL:**
```
Variable Name: MINIO_PUBLIC_URL
Value:         http://76.13.193.161:9000
[Save]
```

**Hasil akhir akan terlihat seperti:**
```
┌─────────────────────────────────────────────────────┐
│ MINIO_ROOT_USER      │ minioadmin                   │
│ MINIO_ROOT_PASSWORD  │ SecurePassword123!           │
│ MINIO_PUBLIC_URL     │ http://76.13.193.161:9000    │
└─────────────────────────────────────────────────────┘
```

---

## Langkah 4: Tambah Environment Variables untuk Backend

**Lanjutkan klik [+ Add Variable] dan isi:**

**Form 1 - AWS Access Key:**
```
Variable Name: AWS_ACCESS_KEY_ID
Value:         minioadmin
[Save]
```

**Form 2 - AWS Secret Key:**
```
Variable Name: AWS_SECRET_ACCESS_KEY
Value:         SecurePassword123!
[Save]
```

**Form 3 - AWS Endpoint:**
```
Variable Name: AWS_ENDPOINT
Value:         http://76.13.193.161:9000
[Save]
```

**Form 4 - AWS Bucket:**
```
Variable Name: AWS_BUCKET
Value:         simmaci-storage
[Save]
```

**Form 5 - Path Style Endpoint:**
```
Variable Name: AWS_USE_PATH_STYLE_ENDPOINT
Value:         true
[Save]
```

**Form 6 - Filesystem Disk:**
```
Variable Name: FILESYSTEM_DISK
Value:         s3
[Save]
```

**Hasil akhir akan terlihat seperti:**
```
┌─────────────────────────────────────────────────────┐
│ AWS_ACCESS_KEY_ID           │ minioadmin             │
│ AWS_SECRET_ACCESS_KEY       │ SecurePassword123!     │
│ AWS_ENDPOINT                │ http://76.13.193.161:9000 │
│ AWS_BUCKET                  │ simmaci-storage        │
│ AWS_USE_PATH_STYLE_ENDPOINT │ true                   │
│ FILESYSTEM_DISK             │ s3                     │
└─────────────────────────────────────────────────────┘
```

---

## Langkah 5: Tambah Environment Variables untuk Frontend

**Lanjutkan klik [+ Add Variable] dan isi:**

**Form 1 - Storage URL:**
```
Variable Name: VITE_STORAGE_URL
Value:         http://76.13.193.161:9000/simmaci-storage
[Save]
```

**Hasil akhir akan terlihat seperti:**
```
┌─────────────────────────────────────────────────────┐
│ VITE_STORAGE_URL │ http://76.13.193.161:9000/simmaci-storage │
└─────────────────────────────────────────────────────┘
```

---

## Ringkasan Semua Variables yang Perlu Ditambah

**Total: 10 variables**

| No | Variable Name | Value |
|----|---------------|-------|
| 1 | MINIO_ROOT_USER | minioadmin |
| 2 | MINIO_ROOT_PASSWORD | SecurePassword123! |
| 3 | MINIO_PUBLIC_URL | http://76.13.193.161:9000 |
| 4 | AWS_ACCESS_KEY_ID | minioadmin |
| 5 | AWS_SECRET_ACCESS_KEY | SecurePassword123! |
| 6 | AWS_ENDPOINT | http://76.13.193.161:9000 |
| 7 | AWS_BUCKET | simmaci-storage |
| 8 | AWS_USE_PATH_STYLE_ENDPOINT | true |
| 9 | FILESYSTEM_DISK | s3 |
| 10 | VITE_STORAGE_URL | http://76.13.193.161:9000/simmaci-storage |

---

## Tips Penting

- **Jangan lupa [Save]** setelah isi setiap variable
- **Ganti password** `SecurePassword123!` dengan password yang lebih kuat
- **Pastikan tidak ada typo** di Variable Name (case-sensitive)
- **Jangan ada spasi** di awal atau akhir Value

---

## Setelah Semua Variables Ditambah

Anda akan melihat semua 10 variables di list. Kemudian lanjut ke **Langkah 6: Deploy/Redeploy**.
