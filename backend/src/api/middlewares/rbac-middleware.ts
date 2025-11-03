import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http";
import { getRbacService, Role, Resource, Action } from "../../modules/tenant/rbac-service";
import { getTenantIdFromRequest } from "./tenant-context";

/**
 * RBAC Enforcement Middleware
 * 
 * Checks if the authenticated user has permission to perform the requested action.
 * Should be applied after authentication middleware.
 */

/**
 * Require specific permission for a route
 * 
 * Usage:
 * ```typescript
 * {
 *   matcher: "/admin/products",
 *   middlewares: [
 *     authenticate(...),
 *     tenantContextMiddleware,
 *     requirePermission('product', 'create')
 *   ]
 * }
 * ```
 */
export function requirePermission(resource: Resource, action: Action) {
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    try {
      // @ts-ignore - Get user from auth context
      const userId = req.user?.id || req.auth?.actor_id;
      
      if (!userId) {
        return res.status(401).json({
          error: "Authentication required",
          message: "No user ID found in request"
        });
      }

      const tenantId = getTenantIdFromRequest(req);
      if (!tenantId) {
        return res.status(400).json({
          error: "Tenant required",
          message: "No tenant context found"
        });
      }

      const rbacService = getRbacService();
      const result = await rbacService.verifyAccess(userId, tenantId, resource, action);

      if (!result.allowed) {
        return res.status(403).json({
          error: "Permission denied",
          message: result.reason || `You don't have permission to ${action} ${resource}`,
          required_permission: { resource, action }
        });
      }

      // Store permission check result in request for audit logging
      // @ts-ignore
      req.rbacCheck = { resource, action, allowed: true };

      next();
    } catch (error) {
      console.error("[RBAC] Permission check error:", error);
      return res.status(500).json({
        error: "Permission check failed",
        message: error.message
      });
    }
  };
}

/**
 * Require user to have one of the specified roles
 * 
 * Usage:
 * ```typescript
 * requireRole(['GlobalAdmin', 'TenantAdmin'])
 * ```
 */
export function requireRole(allowedRoles: Role[]) {
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    try {
      // @ts-ignore
      const userId = req.user?.id || req.auth?.actor_id;
      
      if (!userId) {
        return res.status(401).json({
          error: "Authentication required"
        });
      }

      const rbacService = getRbacService();
      const userRoles = await rbacService.getUserRoles(userId);

      const hasRole = rbacService.hasAnyRole(
        userRoles.map(r => r.role),
        allowedRoles
      );

      if (!hasRole) {
        return res.status(403).json({
          error: "Insufficient permissions",
          message: `Requires one of: ${allowedRoles.join(', ')}`,
          required_roles: allowedRoles
        });
      }

      // @ts-ignore - Store user roles in request
      req.userRoles = userRoles;

      next();
    } catch (error) {
      console.error("[RBAC] Role check error:", error);
      return res.status(500).json({
        error: "Role check failed",
        message: error.message
      });
    }
  };
}

/**
 * Check if user can access the current tenant
 * 
 * Automatically denies access if user doesn't have permission for the tenant
 * (except for GlobalAdmin who can access all tenants)
 */
export async function requireTenantAccess(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    // @ts-ignore
    const userId = req.user?.id || req.auth?.actor_id;
    
    if (!userId) {
      return res.status(401).json({
        error: "Authentication required"
      });
    }

    const tenantId = getTenantIdFromRequest(req);
    if (!tenantId) {
      return res.status(400).json({
        error: "Tenant required"
      });
    }

    const rbacService = getRbacService();
    const canAccess = await rbacService.canAccessTenant(userId, tenantId);

    if (!canAccess) {
      return res.status(403).json({
        error: "Tenant access denied",
        message: `You don't have access to tenant '${tenantId}'`
      });
    }

    next();
  } catch (error) {
    console.error("[RBAC] Tenant access check error:", error);
    return res.status(500).json({
      error: "Tenant access check failed",
      message: error.message
    });
  }
}

/**
 * Helper: Get user roles from request (after RBAC middleware has run)
 */
export function getUserRoles(req: MedusaRequest): { role: Role; tenantId: string | null }[] {
  // @ts-ignore
  return req.userRoles || [];
}

/**
 * Helper: Check if user has a specific role
 */
export function hasRole(req: MedusaRequest, role: Role): boolean {
  const roles = getUserRoles(req);
  return roles.some(r => r.role === role);
}

/**
 * Helper: Check if user is GlobalAdmin
 */
export function isGlobalAdmin(req: MedusaRequest): boolean {
  return hasRole(req, 'GlobalAdmin');
}

/**
 * Helper: Check if user is admin for current tenant
 */
export function isTenantAdmin(req: MedusaRequest): boolean {
  const tenantId = getTenantIdFromRequest(req);
  const roles = getUserRoles(req);
  
  if (roles.some(r => r.role === 'GlobalAdmin')) {
    return true;
  }
  
  return roles.some(r => r.role === 'TenantAdmin' && r.tenantId === tenantId);
}
