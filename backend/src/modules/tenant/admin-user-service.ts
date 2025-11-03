import { Pool } from "pg";
import { Role } from "./rbac-service";

/**
 * Admin User Service
 * 
 * Manages the mapping between Medusa users and tenant assignments/roles.
 * Links Medusa's authentication with our multi-tenant RBAC system.
 */

export class AdminUserService {
  private pool: Pool;

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
   * Assign user to tenant with role
   */
  async assignUserToTenant(
    userId: string,
    tenantId: string,
    role: Role,
    email: string
  ): Promise<any> {
    const id = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const query = `
      INSERT INTO admin_user (id, user_id, tenant_id, role, email, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (user_id, tenant_id) 
      DO UPDATE SET role = $4, is_active = true, updated_at = NOW()
      RETURNING *
    `;

    const result = await this.pool.query(query, [id, userId, tenantId, role, email]);
    return result.rows[0];
  }

  /**
   * Remove user from tenant
   */
  async removeUserFromTenant(userId: string, tenantId: string): Promise<void> {
    const query = `
      UPDATE admin_user 
      SET is_active = false, updated_at = NOW()
      WHERE user_id = $1 AND tenant_id = $2
    `;
    
    await this.pool.query(query, [userId, tenantId]);
  }

  /**
   * Update user role in tenant
   */
  async updateUserRole(userId: string, tenantId: string, role: Role): Promise<any> {
    const query = `
      UPDATE admin_user 
      SET role = $1, updated_at = NOW()
      WHERE user_id = $2 AND tenant_id = $3
      RETURNING *
    `;

    const result = await this.pool.query(query, [role, userId, tenantId]);
    return result.rows[0];
  }

  /**
   * Get user's tenant assignments
   */
  async getUserTenants(userId: string): Promise<any[]> {
    const query = `
      SELECT au.*, t.name as tenant_name, t.status as tenant_status
      FROM admin_user au
      JOIN tenant t ON au.tenant_id = t.id
      WHERE au.user_id = $1 AND au.is_active = true
      ORDER BY au.created_at DESC
    `;

    const result = await this.pool.query(query, [userId]);
    return result.rows;
  }

  /**
   * Get all users for a tenant
   */
  async getTenantUsers(tenantId: string): Promise<any[]> {
    const query = `
      SELECT * FROM admin_user
      WHERE tenant_id = $1 AND is_active = true
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [tenantId]);
    return result.rows;
  }

  /**
   * Check if user exists in admin_user table
   */
  async userExists(userId: string): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count FROM admin_user
      WHERE user_id = $1 AND is_active = true
    `;

    const result = await this.pool.query(query, [userId]);
    return parseInt(result.rows[0].count) > 0;
  }

  /**
   * Ensure first user is GlobalAdmin
   * Called when a new user registers
   */
  async ensureFirstUserIsGlobalAdmin(userId: string, email: string): Promise<void> {
    const userCount = await this.pool.query('SELECT COUNT(*) as count FROM admin_user WHERE is_active = true');
    const count = parseInt(userCount.rows[0].count);

    if (count === 0) {
      // First user - make them GlobalAdmin with access to HQ
      await this.assignUserToTenant(userId, 'hq', 'GlobalAdmin', email);
      console.log(`[AdminUser] First user ${email} assigned as GlobalAdmin`);
    }
  }
}

// Singleton
let adminUserServiceInstance: AdminUserService | null = null;

export function getAdminUserService(): AdminUserService {
  if (!adminUserServiceInstance) {
    adminUserServiceInstance = new AdminUserService();
  }
  return adminUserServiceInstance;
}
