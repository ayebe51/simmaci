# Coolify Environment Variables Update Checklist

## Status: READY TO UPDATE

All code changes have been implemented and pushed to GitHub. Only **environment variables in Coolify** need to be updated.

---

## What Changed

### Backend Implementation
- ✅ Created new MinIO proxy controller: `backend/app/Http/Controllers/Api/MinioProxyController.php`
- ✅ Added MinIO proxy route: `GET /api/minio/{path?}` in `backend/routes/api.php`
- ✅ Updated nginx config to proxy `/api/minio` to backend
- ✅ All code pushed to GitHub

### Database Password
- ✅ Changed from `#Aswajacilacap1` to `Aswajacilacap1` (removed `#` character)
- ✅ All existing data preserved (lembaga, guru, siswa, SK documents)

---

## Environment Variables to Update in Coolify

### ONLY 1 Variable Needs Change:

| Variable Name | Old Value | New Value | Status |
|---|---|---|---|
| `MINIO_PUBLIC_URL` | `https://simmaci.com/minio` | `https://simmaci.com/api/minio` | ⚠️ NEEDS UPDATE |

### All Other Variables (NO CHANGE NEEDED):

| Variable Name | Current Value | Status |
|---|---|---|
| `MINIO_ROOT_USER` | `minioadmin` | ✅ OK |
| `MINIO_ROOT_PASSWORD` | `Aswajacilacap1` | ✅ OK (no `#` or `$`) |
| `AWS_ACCESS_KEY_ID` | `minioadmin` | ✅ OK |
| `AWS_SECRET_ACCESS_KEY` | `Aswajacilacap1` | ✅ OK (no `$`) |
| `AWS_ENDPOINT` | `http://minio:9000` | ✅ OK (internal URL) |
| `AWS_BUCKET` | `simmaci-storage` | ✅ OK |
| `AWS_USE_PATH_STYLE_ENDPOINT` | `true` | ✅ OK |
| `FILESYSTEM_DISK` | `s3` | ✅ OK |
| `AWS_URL` | `https://simmaci.com/api/minio` | ✅ OK |
| `VITE_STORAGE_URL` | `https://simmaci.com/api/minio` | ✅ OK |
| `DB_PASSWORD` | `Aswajacilacap1` | ✅ OK (no `#`) |

---

## How MinIO Access Works Now

### Before (Failed)
```
Frontend → https://minio.simmaci.com → Traefik → MinIO
                                        ❌ 404 (routing failed)
```

### After (Working)
```
Frontend → https://simmaci.com/api/minio → Nginx → Backend API → MinIO
                                                    ✅ Proxy controller
```

---

## Steps to Update in Coolify

### 1. Login to Coolify Dashboard
- URL: `http://76.13.193.161:8000`
- Or: `https://coolify.simmaci.com` (if domain setup complete)

### 2. Navigate to SIMMACI Project
- Click **SIMMACI** project
- Click **Settings** or **Environment** tab

### 3. Find and Update Variable
- Search for: `MINIO_PUBLIC_URL`
- Change value from: `https://simmaci.com/minio`
- Change value to: `https://simmaci.com/api/minio`
- Click **Save**

### 4. Redeploy
- Click **Redeploy** button
- Wait 5-10 minutes for backend rebuild
- Check logs for any errors

---

## Verification After Update

### Test 1: MinIO Proxy Health Check
```bash
curl https://simmaci.com/api/minio
# Expected response: {"status":"ok"}
```

### Test 2: File Access
```bash
curl https://simmaci.com/api/minio/simmaci-storage/[filename]
# Expected: File content or 404 if file doesn't exist
```

### Test 3: SK Generation
1. Open SIMMACI application: `https://simmaci.com`
2. Try generating SK document
3. Should complete without "Failed to fetch" errors
4. File should appear in MinIO bucket

### Test 4: Backend API
```bash
curl https://api.simmaci.com/api/dashboard/stats
# Expected: Dashboard statistics JSON
```

---

## Important Notes

### Password Security
- ❌ DO NOT use: `#`, `$`, `"`, `'` in passwords
- ✅ DO use: alphanumeric + underscore/dash only
- Example: `Aswajacilacap1` ✅ or `Aswajacilacap_1` ✅

### Data Safety
- All existing data is preserved
- No data loss occurred
- Database backups recommended before redeploy

### DNS Status
- ✅ `simmaci.com` → `76.13.193.161`
- ✅ `api.simmaci.com` → `76.13.193.161`
- ✅ `minio.simmaci.com` → `76.13.193.161` (not used anymore)

---

## Troubleshooting

### If MinIO still returns 404
1. Verify `MINIO_PUBLIC_URL` was updated correctly
2. Check backend logs: `docker logs simmaci-backend`
3. Verify MinIO is running: `docker logs simmaci-minio`
4. Check nginx config: `docker logs simmaci-frontend`

### If SK generation still fails
1. Verify backend can reach MinIO: `docker exec simmaci-backend curl http://minio:9000`
2. Check MinIO bucket exists: `docker exec simmaci-minio mc ls local/simmaci-storage`
3. Check file permissions in MinIO console

### If database connection fails
1. Verify `DB_PASSWORD` is `Aswajacilacap1` (no `#`)
2. Check database is running: `docker logs simmaci-db`
3. Verify database user exists: `docker exec simmaci-db psql -U sim_user -d sim_maarif -c "SELECT 1"`

---

## Checklist

- [ ] Login to Coolify dashboard
- [ ] Navigate to SIMMACI project settings
- [ ] Find `MINIO_PUBLIC_URL` variable
- [ ] Update value to `https://simmaci.com/api/minio`
- [ ] Click Save
- [ ] Click Redeploy
- [ ] Wait 5-10 minutes
- [ ] Test MinIO proxy: `curl https://simmaci.com/api/minio`
- [ ] Test SK generation in application
- [ ] Verify no errors in logs

---

## Summary

✅ **Code**: All changes implemented and pushed
✅ **Database**: Password fixed, data preserved
⏳ **Coolify**: Only 1 environment variable needs update
⏳ **Deployment**: Ready to redeploy after variable update

**Next Action**: Update `MINIO_PUBLIC_URL` in Coolify and redeploy.
