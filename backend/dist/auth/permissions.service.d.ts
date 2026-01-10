export declare class PermissionsService {
    private readonly rolePermissions;
    getRolePermissions(role: string): string[];
    hasPermission(userPermissions: string[], requiredPermission: string): boolean;
    hasAnyPermission(userPermissions: string[], requiredPermissions: string[]): boolean;
    hasAllPermissions(userPermissions: string[], requiredPermissions: string[]): boolean;
    assignDefaultPermissions(role: string): string[];
}
