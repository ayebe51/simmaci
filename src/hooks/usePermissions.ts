import { useState, useEffect } from 'react';

export interface User {
  id: string;
  username: string;
  name: string;
  role: 'super_admin' | 'admin_pusat' | 'operator_madrasah' | 'kepala_madrasah';
  unitKerja?: string;
  kecamatan?: string;
  permissions: string[];
}

/**
 * Get current user from localStorage
 */
export const useUser = (): User | null => {
  const [user, setUser] = useState<User | null>(() => {
    const userStr = localStorage.getItem('user');
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      console.error('Failed to parse user from localStorage', e);
      return null;
    }
  });

  // No effect needed for initial load anymore

  return user;
};

/**
 * Check if user has a specific permission
 */
export const usePermission = (permission: string): boolean => {
  const user = useUser();
  
  if (!user) return false;
  
  // Super admin always has all permissions
  if (user.role === 'super_admin') return true;
  
  // Check permissions array
  return user.permissions?.includes(permission) || false;
};

/**
 * Check if user has ANY of the specified permissions
 */
export const useAnyPermission = (permissions: string[]): boolean => {
  const user = useUser();
  
  if (!user) return false;
  
  // Super admin always has all permissions
  if (user.role === 'super_admin') return true;
  
  // Check if user has any of the required permissions
  return permissions.some(perm => user.permissions?.includes(perm));
};

/**
 * Check if user has ALL of the specified permissions
 */
export const useAllPermissions = (permissions: string[]): boolean => {
  const user = useUser();
  
  if (!user) return false;
  
  // Super admin always has all permissions
  if (user.role === 'super_admin') return true;
  
  // Check if user has all required permissions
  return permissions.every(perm => user.permissions?.includes(perm));
};

/**
 * Check if user has a specific role
 */
export const useRole = (roles: string | string[]): boolean => {
  const user = useUser();
  
  if (!user) return false;
  
  const roleArray = Array.isArray(roles) ? roles : [roles];
  return roleArray.includes(user.role);
};
