import React from 'react';
import { usePermission } from '@/hooks/usePermissions';

interface CanProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Conditional rendering component based on user permissions
 * Usage: <Can permission="edit_teachers">Edit Button</Can>
 */
export const Can: React.FC<CanProps> = ({ permission, children, fallback = null }) => {
  const hasPermission = usePermission(permission);
  
  return hasPermission ? <>{children}</> : <>{fallback}</>;
};
