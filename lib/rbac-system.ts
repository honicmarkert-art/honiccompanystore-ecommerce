import { logger } from './logger'

/**
 * Role-Based Access Control (RBAC) System
 * Implements comprehensive permission management
 */

export type Role = 'admin' | 'moderator' | 'user' | 'guest'
export type Permission = 
  | 'read_products'
  | 'write_products'
  | 'delete_products'
  | 'read_orders'
  | 'write_orders'
  | 'delete_orders'
  | 'read_users'
  | 'write_users'
  | 'delete_users'
  | 'read_cart'
  | 'write_cart'
  | 'delete_cart'
  | 'admin_access'
  | 'moderate_content'
  | 'view_analytics'
  | 'manage_inventory'
  | 'process_payments'

export interface UserRole {
  role: Role
  permissions: Permission[]
  resourceAccess?: {
    products?: 'all' | 'own' | 'none'
    orders?: 'all' | 'own' | 'none'
    users?: 'all' | 'own' | 'none'
  }
}

export interface RbacConfig {
  enableResourceLevelPermissions: boolean
  enableAuditLogging: boolean
  enablePermissionCaching: boolean
  cacheTimeout: number
}

const defaultConfig: RbacConfig = {
  enableResourceLevelPermissions: true,
  enableAuditLogging: true,
  enablePermissionCaching: true,
  cacheTimeout: 300000 // 5 minutes
}

// Permission cache
const permissionCache = new Map<string, { permissions: Permission[], expires: number }>()

/**
 * Role definitions with their permissions
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'read_products', 'write_products', 'delete_products',
    'read_orders', 'write_orders', 'delete_orders',
    'read_users', 'write_users', 'delete_users',
    'read_cart', 'write_cart', 'delete_cart',
    'admin_access', 'moderate_content', 'view_analytics',
    'manage_inventory', 'process_payments'
  ],
  moderator: [
    'read_products', 'write_products',
    'read_orders', 'write_orders',
    'read_users',
    'read_cart',
    'moderate_content', 'view_analytics',
    'manage_inventory'
  ],
  user: [
    'read_products',
    'read_orders', 'write_orders',
    'read_cart', 'write_cart', 'delete_cart'
  ],
  guest: [
    'read_products',
    'read_cart', 'write_cart'
  ]
}

/**
 * Resource-level access definitions
 */
const RESOURCE_ACCESS: Record<Role, UserRole['resourceAccess']> = {
  admin: {
    products: 'all',
    orders: 'all',
    users: 'all'
  },
  moderator: {
    products: 'all',
    orders: 'all',
    users: 'own'
  },
  user: {
    products: 'all',
    orders: 'own',
    users: 'own'
  },
  guest: {
    products: 'all',
    orders: 'none',
    users: 'none'
  }
}

/**
 * Get user permissions for a role
 */
export function getUserPermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || []
}

/**
 * Get resource access level for a role
 */
export function getResourceAccess(role: Role): UserRole['resourceAccess'] {
  return RESOURCE_ACCESS[role] || {
    products: 'none',
    orders: 'none',
    users: 'none'
  }
}

/**
 * Check if user has specific permission
 */
export function hasPermission(
  userRole: Role,
  permission: Permission,
  config: RbacConfig = defaultConfig
): boolean {
  const permissions = getUserPermissions(userRole)
  return permissions.includes(permission)
}

/**
 * Check if user can access resource
 */
export function canAccessResource(
  userRole: Role,
  resourceType: 'products' | 'orders' | 'users',
  resourceOwnerId?: string,
  currentUserId?: string,
  config: RbacConfig = defaultConfig
): boolean {
  const resourceAccess = getResourceAccess(userRole)
  const accessLevel = resourceAccess[resourceType]
  
  if (!accessLevel || accessLevel === 'none') {
    return false
  }
  
  if (accessLevel === 'all') {
    return true
  }
  
  if (accessLevel === 'own') {
    return resourceOwnerId === currentUserId
  }
  
  return false
}

/**
 * Comprehensive permission check
 */
export function checkPermission(
  userRole: Role,
  permission: Permission,
  resourceType?: 'products' | 'orders' | 'users',
  resourceOwnerId?: string,
  currentUserId?: string,
  config: RbacConfig = defaultConfig
): { allowed: boolean; reason?: string } {
  // Check basic permission
  if (!hasPermission(userRole, permission, config)) {
    return {
      allowed: false,
      reason: `Role '${userRole}' does not have permission '${permission}'`
    }
  }
  
  // Check resource-level access if specified
  if (resourceType && resourceOwnerId && currentUserId) {
    if (!canAccessResource(userRole, resourceType, resourceOwnerId, currentUserId, config)) {
      return {
        allowed: false,
        reason: `Role '${userRole}' cannot access ${resourceType} owned by another user`
      }
    }
  }
  
  return { allowed: true }
}

/**
 * Get user role from database or session
 */
export async function getUserRole(
  userId: string,
  supabase: any,
  config: RbacConfig = defaultConfig
): Promise<{ role: Role; permissions: Permission[] }> {
  try {
    // Check cache first
    if (config.enablePermissionCaching) {
      const cached = permissionCache.get(userId)
      if (cached && cached.expires > Date.now()) {
        return {
          role: cached.permissions.includes('admin_access') ? 'admin' : 'user',
          permissions: cached.permissions
        }
      }
    }
    
    // Fetch from database
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin, is_moderator, role')
      .eq('id', userId)
      .single()
    
    let role: Role = 'user'
    if (profile?.is_admin) {
      role = 'admin'
    } else if (profile?.is_moderator) {
      role = 'moderator'
    } else if (profile?.role) {
      role = profile.role as Role
    }
    
    const permissions = getUserPermissions(role)
    
    // Cache the result
    if (config.enablePermissionCaching) {
      permissionCache.set(userId, {
        permissions,
        expires: Date.now() + config.cacheTimeout
      })
    }
    
    return { role, permissions }
    
  } catch (error) {
    logger.error('Failed to get user role:', error)
    return { role: 'guest', permissions: getUserPermissions('guest') }
  }
}

/**
 * Middleware for RBAC protection
 */
export async function requirePermission(
  userId: string,
  permission: Permission,
  supabase: any,
  resourceType?: 'products' | 'orders' | 'users',
  resourceOwnerId?: string,
  config: RbacConfig = defaultConfig
): Promise<{ allowed: boolean; error?: string; statusCode?: number }> {
  try {
    const { role, permissions } = await getUserRole(userId, supabase, config)
    
    const permissionCheck = checkPermission(
      role,
      permission,
      resourceType,
      resourceOwnerId,
      userId,
      config
    )
    
    if (!permissionCheck.allowed) {
      if (config.enableAuditLogging) {
        logger.security('Permission denied', userId, {
          permission,
          role,
          resourceType,
          resourceOwnerId,
          reason: permissionCheck.reason
        })
      }
      
      return {
        allowed: false,
        error: 'Insufficient permissions',
        statusCode: 403
      }
    }
    
    if (config.enableAuditLogging) {
      logger.security('Permission granted', userId, {
        permission,
        role,
        resourceType,
        resourceOwnerId
      })
    }
    
    return { allowed: true }
    
  } catch (error) {
    logger.error('RBAC permission check failed:', error)
    return {
      allowed: false,
      error: 'Permission validation failed',
      statusCode: 500
    }
  }
}

/**
 * Check if user is admin
 */
export function isAdmin(userRole: Role): boolean {
  return userRole === 'admin'
}

/**
 * Check if user is moderator or admin
 */
export function isModeratorOrAdmin(userRole: Role): boolean {
  return userRole === 'admin' || userRole === 'moderator'
}

/**
 * Get all permissions for a role (useful for UI)
 */
export function getAllPermissionsForRole(role: Role): Permission[] {
  return getUserPermissions(role)
}

/**
 * Validate role assignment
 */
export function validateRoleAssignment(
  currentUserRole: Role,
  targetRole: Role,
  targetUserId: string,
  currentUserId: string
): { allowed: boolean; reason?: string } {
  // Only admins can assign roles
  if (currentUserRole !== 'admin') {
    return {
      allowed: false,
      reason: 'Only admins can assign roles'
    }
  }
  
  // Cannot change own role
  if (targetUserId === currentUserId) {
    return {
      allowed: false,
      reason: 'Cannot change your own role'
    }
  }
  
  // Cannot assign admin role to others (only system can)
  if (targetRole === 'admin') {
    return {
      allowed: false,
      reason: 'Cannot assign admin role'
    }
  }
  
  return { allowed: true }
}

/**
 * Clear permission cache for user
 */
export function clearUserPermissionCache(userId: string): void {
  permissionCache.delete(userId)
}

/**
 * Clear all permission cache
 */
export function clearAllPermissionCache(): void {
  permissionCache.clear()
}

/**
 * Get role hierarchy level
 */
export function getRoleLevel(role: Role): number {
  const levels = {
    guest: 0,
    user: 1,
    moderator: 2,
    admin: 3
  }
  return levels[role] || 0
}

/**
 * Check if role can manage another role
 */
export function canManageRole(managerRole: Role, targetRole: Role): boolean {
  const managerLevel = getRoleLevel(managerRole)
  const targetLevel = getRoleLevel(targetRole)
  return managerLevel > targetLevel
}
