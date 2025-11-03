import { Pool } from "pg";

/**
 * Audit Service
 * 
 * Logs all mutations (create, update, delete) to the audit_log table
 * for compliance, security, and debugging purposes.
 */

export type AuditAction = 'create' | 'update' | 'delete' | 'read' | 'login' | 'logout' | 'export';
export type AuditResource = 'tenant' | 'product' | 'order' | 'customer' | 'user' | 'cart' | 'payment';

interface AuditLogEntry {
  tenantId: string;
  userId?: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
}

export class AuditService {
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
   * Log an action to the audit trail
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const id = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const query = `
        INSERT INTO audit_log (
          id, tenant_id, user_id, action, resource, resource_id,
          ip_address, user_agent, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;

      await this.pool.query(query, [
        id,
        entry.tenantId,
        entry.userId || null,
        entry.action,
        entry.resource,
        entry.resourceId || null,
        entry.ipAddress || null,
        entry.userAgent || null,
        entry.metadata ? JSON.stringify(entry.metadata) : null
      ]);

      console.log(`[Audit] ${entry.action} ${entry.resource} by user ${entry.userId || 'system'} in tenant ${entry.tenantId}`);
    } catch (error) {
      // Don't fail the main operation if audit logging fails
      console.error('[Audit] Failed to log action:', error);
    }
  }

  /**
   * Log from Medusa request context
   */
  async logFromRequest(
    req: any,
    action: AuditAction,
    resource: AuditResource,
    resourceId?: string,
    metadata?: any
  ): Promise<void> {
    // @ts-ignore
    const tenantId = req.tenantId || req.tenant?.id || 'hq';
    // @ts-ignore
    const userId = req.user?.id || req.auth?.actor_id;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await this.log({
      tenantId,
      userId,
      action,
      resource,
      resourceId,
      ipAddress,
      userAgent,
      metadata
    });
  }

  /**
   * Get audit logs for a tenant
   */
  async getTenantAuditLogs(
    tenantId: string,
    options: {
      limit?: number;
      offset?: number;
      userId?: string;
      resource?: AuditResource;
      action?: AuditAction;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<any[]> {
    const {
      limit = 100,
      offset = 0,
      userId,
      resource,
      action,
      startDate,
      endDate
    } = options;

    let query = `SELECT * FROM audit_log WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (userId) {
      query += ` AND user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    if (resource) {
      query += ` AND resource = $${paramIndex}`;
      params.push(resource);
      paramIndex++;
    }

    if (action) {
      query += ` AND action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Get audit logs for a specific resource
   */
  async getResourceAuditLogs(
    resource: AuditResource,
    resourceId: string,
    limit: number = 50
  ): Promise<any[]> {
    const query = `
      SELECT * FROM audit_log 
      WHERE resource = $1 AND resource_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `;

    const result = await this.pool.query(query, [resource, resourceId, limit]);
    return result.rows;
  }

  /**
   * Get user activity
   */
  async getUserActivity(
    userId: string,
    limit: number = 100
  ): Promise<any[]> {
    const query = `
      SELECT * FROM audit_log 
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [userId, limit]);
    return result.rows;
  }
}

// Singleton instance
let auditServiceInstance: AuditService | null = null;

export function getAuditService(): AuditService {
  if (!auditServiceInstance) {
    auditServiceInstance = new AuditService();
  }
  return auditServiceInstance;
}
