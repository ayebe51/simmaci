-- Script untuk menghapus permanent user testing
-- User yang akan dihapus:
-- 1. MI Wahidiyah (112334456712@simmaci.com)
-- 2. MI Testing (112233445566@simmaci.com)

-- Tampilkan user yang akan dihapus
SELECT id, name, email, role, school_id, is_active 
FROM users 
WHERE email IN ('112334456712@simmaci.com', '112233445566@simmaci.com');

-- Hapus notifikasi terkait user ini
DELETE FROM notifications 
WHERE user_id IN (
    SELECT id FROM users 
    WHERE email IN ('112334456712@simmaci.com', '112233445566@simmaci.com')
);

-- Hapus token Sanctum terkait user ini
DELETE FROM personal_access_tokens 
WHERE tokenable_id IN (
    SELECT id FROM users 
    WHERE email IN ('112334456712@simmaci.com', '112233445566@simmaci.com')
) AND tokenable_type = 'App\\Models\\User';

-- Hapus user secara permanent
DELETE FROM users 
WHERE email IN ('112334456712@simmaci.com', '112233445566@simmaci.com');

-- Verifikasi penghapusan
SELECT COUNT(*) as remaining_users 
FROM users 
WHERE email IN ('112334456712@simmaci.com', '112233445566@simmaci.com');
