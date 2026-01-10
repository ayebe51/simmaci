import { Injectable } from '@nestjs/common';

@Injectable()
export class PermissionsService {
  // Define default permissions for each role
  private readonly rolePermissions: Record<string, string[]> = {
    super_admin: [
      'view_teachers', 'edit_teachers', 'delete_teachers',
      'view_schools', 'edit_schools', 'delete_schools',
      'view_sk', 'create_sk', 'approve_sk', 'delete_sk',
      'view_users', 'create_users', 'edit_users', 'delete_users',
      'view_events', 'manage_events',
      'view_dashboard', 'export_data'
    ],
    admin_pusat: [
      'view_teachers', 'edit_teachers',
      'view_schools', 'edit_schools',
      'view_sk', 'create_sk', 'approve_sk',
      'view_users', 'create_users', 'edit_users',
      'view_events', 'manage_events',
      'view_dashboard', 'export_data'
    ],
    operator_madrasah: [
      'view_teachers', 'edit_teachers',
      'view_schools',
      'view_sk', 'create_sk',
      'view_events',
      'view_dashboard', 'export_data'
    ],
    kepala_madrasah: [
      'view_teachers',
      'view_schools',
      'view_sk',
      'view_events',
      'view_dashboard'
    ]
  };

  /**
   * Get default permissions for a role
   */
  getRolePermissions(role: string): string[] {
    return this.rolePermissions[role] || this.rolePermissions['operator_madrasah'];
  }

  /**
   * Check if user has a specific permission
   */
  hasPermission(userPermissions: string[], requiredPermission: string): boolean {
    if (!userPermissions) return false;
    return userPermissions.includes(requiredPermission);
  }

  /**
   * Check if user has any of the required permissions
   */
  hasAnyPermission(userPermissions: string[], requiredPermissions: string[]): boolean {
    if (!userPermissions) return false;
    return requiredPermissions.some(perm => userPermissions.includes(perm));
  }

  /**
   * Check if user has all required permissions
   */
  hasAllPermissions(userPermissions: string[], requiredPermissions: string[]): boolean {
    if (!userPermissions) return false;
    return requiredPermissions.every(perm => userPermissions.includes(perm));
  }

  /**
   * Assign default permissions to a user based on their role
   */
  assignDefaultPermissions(role: string): string[] {
    return this.getRolePermissions(role);
  }
}
