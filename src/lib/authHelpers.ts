// Auth Helper Functions for Role-Based Access Control

export interface User {
  id: string;
  email: string;
  name: string;
  role: "super_admin" | "operator" | "user";
  unitKerja?: string; // School ID for operators
}

/**
 * Get current logged-in user from localStorage
 */
export function getCurrentUser(): User | null {
  const userStr = localStorage.getItem("user");
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr) as User;
  } catch {
    return null;
  }
}

/**
 * Get user's role
 */
export function getUserRole(): string | null {
  const user = getCurrentUser();
  return user?.role || null;
}

/**
 * Get user's school ID (unitKerja)
 */
export function getUserSchoolId(): string | null {
  const user = getCurrentUser();
  return user?.unitKerja || null;
}

/**
 * Check if current user is super admin
 */
export function isSuperAdmin(): boolean {
  return getUserRole() === "super_admin";
}

/**
 * Check if current user is operator
 */
export function isOperator(): boolean {
  return getUserRole() === "operator";
}

/**
 * Check if user can edit a specific school
 * Super admin can edit all, operator can only edit their own school
 */
export function canEditSchool(schoolId: string): boolean {
  if (isSuperAdmin()) return true;
  
  const userSchoolId = getUserSchoolId();
  if (!userSchoolId) return false;
  
  return userSchoolId === schoolId;
}

/**
 * Check if user can access master data (teachers/students)
 * Only super admin can access master data pages
 */
export function canAccessMasterData(): boolean {
  return isSuperAdmin();
}

/**
 * Check if user can access SK template settings
 * Only super admin can access template settings
 */
export function canAccessTemplateSettings(): boolean {
  return isSuperAdmin();
}
