import { Pool } from "pg";

/**
 * RBAC Service
 * 
 * Handles role-based access control checks against the rbac_policy table.
 * 
 * Roles:
 * - GlobalAdmin: Full access to all tenants and resources
 * - TenantAdmin: Full access within assigned tenant
 * - CatalogMgr: Product management only
 * - OrderOps: Order fulfillment and management
 */

export type Role = 'GlobalAdmin' | 'TenantAdmin' | 'CatalogMgr' | 'OrderOps' | 'ReadOnly';
export type Action = 'create' | 'read' | 'update' | 'delete' | 'cancel' | 'fulfill' | 'refund' | '*';
export type Resource = 'product' | 'order' | 'customer' | 'tenant' | 'user' | '*';

interface RbacPolicy {
  id: string;
  role: Role;
  resource: Resource;
  actions: Action[];
  conditions: any;
  version: number;
  effective_from: Date;
  effective_until: Date | null;
}

export class RbacService {
  private pool: Pool;
  private policyCache: Map<Role, RbacPolicy[]> = new Map();
  private cacheExpiry: number = 0;
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'medusa_dev',
      user: process.env.DB_USER || 'medusa',
      password: process.env.DB_PASSWORD || 'medusa',
    });
  }

  /**
   * Load all RBAC policies from database
   */
  private async loadPolicies(): Promise<void> {
    const now = Date.now();
    
    // Use cache if still valid
    if (this.policyCache.size > 0 && now < this.cacheExpiry) {
      return;
    }

    const query = `
      SELECT * FROM rbac_policy 
      WHERE effective_from <= NOW() 
        AND (effective_until IS NULL OR effective_until > NOW())
      ORDER BY role, resource
    `;
    
    const result = await this.pool.query(query);
    
    // Group policies by role
    this.policyCache.clear();
    for (const policy of result.rows) {
      const role = policy.role as Role;
      if (!this.policyCache.has(role)) {
        this.policyCache.set(role, []);
      }
      this.policyCache.get(role)!.push(policy);
    }
    
    this.cacheExpiry = now + this.CACHE_TTL;
  }

  /**
   * Check if a role has permission to perform an action on a resource
   */
  async hasPermission(
    role: Role,
    resource: Resource,
    action: Action,
    context?: any
  ): Promise<boolean> {
    await this.loadPolicies();

    // GlobalAdmin has all permissions
    if (role === 'GlobalAdmin') {
      return true;
    }

    const policies = this.policyCache.get(role) || [];

    for (const policy of policies) {
      // Check if policy applies to this resource
      if (policy.resource !== '*' && policy.resource !== resource) {
        continue;
      }

      // Check if policy allows this action
      const actions = policy.actions as Action[];
      if (actions.includes('*') || actions.includes(action)) {
        // Check conditions if any
        if (policy.conditions) {
          if (!this.evaluateConditions(policy.conditions, context)) {
            continue;
          }
        }
        
        return true;
      }
    }

    return false;
  }

  /**
   * Evaluate policy conditions
   */
  private evaluateConditions(conditions: any, context: any): boolean {
    if (!conditions || !context) {
      return true;
    }

    // Simple condition evaluation
    // Can be extended for complex rules
    for (const [key, value] of Object.entries(conditions)) {
      if (context[key] !== value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get all permissions for a role
   */
  async getRolePermissions(role: Role): Promise<RbacPolicy[]> {
    await this.loadPolicies();
    return this.policyCache.get(role) || [];
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(userRoles: Role[], allowedRoles: Role[]): boolean {
    return userRoles.some(role => allowedRoles.includes(role));
  }

  /**
   * Get user roles from admin_user table
   */
  async getUserRoles(userId: string): Promise<{ role: Role; tenantId: string | null }[]> {
    const query = `
      SELECT role, tenant_id 
      FROM admin_user 
      WHERE user_id = $1 AND is_active = true
    `;
    
    const result = await this.pool.query(query, [userId]);
    return result.rows.map(row => ({
      role: row.role as Role,
      tenantId: row.tenant_id
    }));
  }

  /**
   * Check if user can access tenant
   */
  async canAccessTenant(userId: string, tenantId: string): Promise<boolean> {
    const userRoles = await this.getUserRoles(userId);
    
    // GlobalAdmin can access all tenants
    if (userRoles.some(r => r.role === 'GlobalAdmin')) {
      return true;
    }

    // Check if user has role for this specific tenant
    return userRoles.some(r => r.tenantId === tenantId);
  }

  /**
   * Get allowed tenants for user
   */
  async getAllowedTenants(userId: string): Promise<string[]> {
    const query = `
      SELECT DISTINCT tenant_id 
      FROM admin_user 
      WHERE user_id = $1 AND is_active = true AND tenant_id IS NOT NULL
    `;
    
    const result = await this.pool.query(query, [userId]);
    return result.rows.map(row => row.tenant_id);
  }

  /**
   * Verify user can perform action on resource in tenant context
   */
  async verifyAccess(
    userId: string,
    tenantId: string,
    resource: Resource,
    action: Action
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Get user roles
    const userRoles = await this.getUserRoles(userId);
    
    if (userRoles.length === 0) {
      return { allowed: false, reason: 'No roles assigned to user' };
    }

    // Check tenant access
    const canAccess = await this.canAccessTenant(userId, tenantId);
    if (!canAccess) {
      return { allowed: false, reason: `No access to tenant '${tenantId}'` };
    }

    // Check permissions for each role
    for (const { role } of userRoles) {
      const hasPermission = await this.hasPermission(role, resource, action);
      if (hasPermission) {
        return { allowed: true };
      }
    }

    return { 
      allowed: false, 
      reason: `No permission to '${action}' on '${resource}'` 
    };
  }

  /**
   * Clear policy cache (useful after policy updates)
   */
  clearCache(): void {
    this.policyCache.clear();
    this.cacheExpiry = 0;
  }
}

// Singleton instance
let rbacServiceInstance: RbacService | null = null;

export function getRbacService(): RbacService {
  if (!rbacServiceInstance) {
    rbacServiceInstance = new RbacService();
  }
  return rbacServiceInstance;
}
