# Force Delete User Feature

## 📋 Overview
Menambahkan fitur untuk menghapus user secara **permanent** dari database, berbeda dengan fitur delete yang sudah ada yang hanya menonaktifkan user (`is_active = false`).

## 🎯 Problem
- Tombol delete yang ada di UI hanya menonaktifkan user, tidak menghapus dari database
- Tidak ada cara untuk menghapus user testing atau user yang salah input secara permanent
- User yang sudah dinonaktifkan tetap ada di database dan menumpuk

## ✅ Solution
Menambahkan endpoint dan UI baru untuk **force delete** yang benar-benar menghapus user dari database.

---

## 🔧 Technical Implementation

### Backend Changes

#### 1. New Endpoint
```
DELETE /api/users/{user}/force
```

**Authorization:** `super_admin` only

**Response:**
```json
{
  "success": true,
  "message": "User berhasil dihapus permanent"
}
```

#### 2. Controller Method (`UserController::forceDestroy`)
```php
public function forceDestroy(User $user): JsonResponse
{
    // Prevent deleting super_admin
    if ($user->isSuperAdmin()) {
        return response()->json([
            'success' => false,
            'message' => 'Tidak dapat menghapus super admin'
        ], 403);
    }

    // Delete related data first
    $user->notifications()->delete();
    $user->tokens()->delete();

    // Permanently delete user
    $user->delete();

    return response()->json([
        'success' => true,
        'message' => 'User berhasil dihapus permanent'
    ]);
}
```

**Safety Features:**
- ✅ Prevents deletion of `super_admin` role
- ✅ Cascades deletion to related data (notifications, tokens)
- ✅ Returns clear error messages

#### 3. Route Registration
```php
Route::middleware('role:super_admin')->group(function () {
    Route::delete('users/{user}/force', [UserController::class, 'forceDestroy']);
    Route::apiResource('users', UserController::class);
});
```

---

### Frontend Changes

#### 1. API Client (`src/lib/api.ts`)
```typescript
export const userApi = {
  // ... existing methods
  forceDelete: (id: number) => apiClient.delete(`/users/${id}/force`).then((r) => r.data),
};
```

#### 2. UI Changes (`UserListPage.tsx`)

**Before:**
```
[Edit] [Delete]  ← Delete hanya menonaktifkan
```

**After:**
```
[Edit] [Nonaktifkan] [Hapus Permanent]
       ↑ UserX icon  ↑ Trash2 icon (darker red)
```

**Visual Difference:**
- **Nonaktifkan** (rose-600): Icon `UserX`, hover bg-rose-50
- **Hapus Permanent** (red-700): Icon `Trash2`, hover bg-red-100

#### 3. Confirmation Dialog

**Nonaktifkan Dialog:**
```
Title: "Hapus Akses User"
Description: "Yakin ingin menghapus akses untuk [name]? User tidak akan bisa login lagi."
Button: "Hapus"
```

**Force Delete Dialog:**
```
Title: "⚠️ Hapus Permanent User"
Description: 
  "PERINGATAN: Tindakan ini tidak dapat dibatalkan!
   
   User [name] ([email]) akan dihapus secara PERMANENT dari database 
   beserta semua data terkait (notifikasi, token, dll).
   
   Gunakan opsi 'Nonaktifkan' jika Anda hanya ingin menonaktifkan akses user."
   
Button: "Ya, Hapus Permanent"
```

---

## 🔒 Security & Safety

### Authorization
- ✅ Only `super_admin` can access force delete endpoint
- ✅ Cannot delete `super_admin` users (protected)
- ✅ Middleware validation on route level

### Data Integrity
- ✅ Cascading deletion of related records:
  - `notifications` table
  - `personal_access_tokens` table (Sanctum)
- ✅ No orphaned records left in database

### User Experience
- ✅ Clear visual distinction between "disable" and "permanent delete"
- ✅ Strong warning message with red color scheme
- ✅ Confirmation dialog prevents accidental deletion
- ✅ Toast notifications for success/error feedback

---

## 📝 Usage Examples

### Via UI (Recommended)
1. Login as `super_admin`
2. Navigate to Users page
3. Find the user to delete
4. Click the **red Trash2 icon** (rightmost button)
5. Read the warning carefully
6. Click "Ya, Hapus Permanent"

### Via Artisan Command
```bash
php artisan users:delete-test-users
```

### Via SQL Script
```bash
psql -U sim_user -d sim_maarif -f scripts/delete_test_users.sql
```

---

## 🧪 Testing Checklist

- [ ] Super admin can see both "Nonaktifkan" and "Hapus Permanent" buttons
- [ ] Operator/admin_yayasan cannot see force delete button
- [ ] Force delete removes user from database
- [ ] Related notifications are deleted
- [ ] Related tokens are deleted
- [ ] Cannot force delete super_admin users
- [ ] Confirmation dialog shows correct warning
- [ ] Toast shows success message after deletion
- [ ] User list refreshes after deletion
- [ ] Soft delete (nonaktifkan) still works as before

---

## 📦 Files Modified

### Backend
- `backend/app/Http/Controllers/Api/UserController.php` - Added `forceDestroy()` method
- `backend/routes/api.php` - Added force delete route
- `backend/app/Console/Commands/DeleteTestUsers.php` - Created artisan command
- `backend/scripts/delete_test_users.sql` - Created SQL script
- `backend/scripts/DELETE_USERS_README.md` - Documentation

### Frontend
- `src/lib/api.ts` - Added `forceDelete()` method
- `src/features/users/UserListPage.tsx` - Added force delete UI and handlers

---

## 🚀 Deployment Notes

1. No database migration needed (using existing tables)
2. No breaking changes to existing functionality
3. Backward compatible with existing delete behavior
4. Can be deployed without downtime

---

## 📚 Related Documentation

- [Laravel Eloquent Deleting](https://laravel.com/docs/eloquent#deleting-models)
- [Sanctum Token Management](https://laravel.com/docs/sanctum#revoking-tokens)
- User Management Best Practices
