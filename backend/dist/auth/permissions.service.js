var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@nestjs/common';
let PermissionsService = class PermissionsService {
    rolePermissions = {
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
    getRolePermissions(role) {
        return this.rolePermissions[role] || this.rolePermissions['operator_madrasah'];
    }
    hasPermission(userPermissions, requiredPermission) {
        if (!userPermissions)
            return false;
        return userPermissions.includes(requiredPermission);
    }
    hasAnyPermission(userPermissions, requiredPermissions) {
        if (!userPermissions)
            return false;
        return requiredPermissions.some(perm => userPermissions.includes(perm));
    }
    hasAllPermissions(userPermissions, requiredPermissions) {
        if (!userPermissions)
            return false;
        return requiredPermissions.every(perm => userPermissions.includes(perm));
    }
    assignDefaultPermissions(role) {
        return this.getRolePermissions(role);
    }
};
PermissionsService = __decorate([
    Injectable()
], PermissionsService);
export { PermissionsService };
//# sourceMappingURL=permissions.service.js.map