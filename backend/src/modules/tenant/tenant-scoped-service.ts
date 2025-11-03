/**
 * Tenant-Scoped Service Helper
 * 
 * Provides utility functions to automatically scope Medusa service queries
 * to the current tenant context.
 * 
 * Usage in routes:
 * ```typescript
 * import { withTenantScope } from "../../modules/tenant/tenant-scoped-service";
 * 
 * const products = await withTenantScope(req, async (tenantId) => {
 *   return await productService.list({ tenant_id: tenantId });
 * });
 * ```
 */

import { MedusaRequest } from "@medusajs/framework/http";
import { getTenantIdFromRequest } from "../../api/middlewares/tenant-context";

/**
 * Execute a function with tenant scope automatically applied
 */
export async function withTenantScope<T>(
  req: MedusaRequest,
  callback: (tenantId: string) => Promise<T>
): Promise<T> {
  const tenantId = getTenantIdFromRequest(req);
  
  if (!tenantId) {
    throw new Error("No tenant context found in request. Ensure tenant context middleware is applied.");
  }
  
  return await callback(tenantId);
}

/**
 * Add tenant_id filter to query parameters
 * 
 * Example:
 * ```typescript
 * const filters = scopeQueryToTenant(req, { status: 'published' });
 * // Returns: { status: 'published', tenant_id: 'paris' }
 * ```
 */
export function scopeQueryToTenant(
  req: MedusaRequest,
  filters: Record<string, any> = {}
): Record<string, any> {
  const tenantId = getTenantIdFromRequest(req);
  
  if (!tenantId) {
    throw new Error("No tenant context found in request");
  }
  
  return {
    ...filters,
    tenant_id: tenantId,
  };
}

/**
 * Add tenant_id to data being created
 * 
 * Example:
 * ```typescript
 * const productData = addTenantToData(req, { title: 'Whey Protein', price: 45.99 });
 * // Returns: { title: 'Whey Protein', price: 45.99, tenant_id: 'paris' }
 * ```
 */
export function addTenantToData(
  req: MedusaRequest,
  data: Record<string, any>
): Record<string, any> {
  const tenantId = getTenantIdFromRequest(req);
  
  if (!tenantId) {
    throw new Error("No tenant context found in request");
  }
  
  return {
    ...data,
    tenant_id: tenantId,
  };
}

/**
 * Verify entity belongs to current tenant
 * Throws error if mismatch
 */
export function verifyTenantOwnership(
  req: MedusaRequest,
  entity: any,
  entityType: string = "resource"
): void {
  const currentTenantId = getTenantIdFromRequest(req);
  const entityTenantId = entity?.tenant_id;
  
  if (!currentTenantId) {
    throw new Error("No tenant context found");
  }
  
  if (!entityTenantId) {
    throw new Error(`${entityType} does not have tenant_id`);
  }
  
  if (entityTenantId !== currentTenantId) {
    throw new Error(
      `Access denied: ${entityType} belongs to tenant '${entityTenantId}' but current tenant is '${currentTenantId}'`
    );
  }
}

/**
 * Filter array of entities to only include those from current tenant
 */
export function filterByTenant<T extends { tenant_id?: string }>(
  req: MedusaRequest,
  entities: T[]
): T[] {
  const tenantId = getTenantIdFromRequest(req);
  
  if (!tenantId) {
    return entities;
  }
  
  return entities.filter(entity => entity.tenant_id === tenantId);
}

/**
 * SQL WHERE clause for tenant filtering
 * 
 * Example:
 * ```typescript
 * const whereClause = getTenantWhereClause(req, 'p'); // 'p' is table alias
 * // Returns: "p.tenant_id = 'paris'"
 * ```
 */
export function getTenantWhereClause(
  req: MedusaRequest,
  tableAlias?: string
): string {
  const tenantId = getTenantIdFromRequest(req);
  
  if (!tenantId) {
    throw new Error("No tenant context found");
  }
  
  const column = tableAlias ? `${tableAlias}.tenant_id` : 'tenant_id';
  return `${column} = '${tenantId}'`;
}

/**
 * Get products available for current tenant (with opt-in check)
 * 
 * This checks both:
 * 1. Product exists in master catalog
 * 2. Tenant has opted-in to the product
 */
export async function getTenantAvailableProducts(
  req: MedusaRequest,
  pool: any
): Promise<any[]> {
  const tenantId = getTenantIdFromRequest(req);
  
  if (!tenantId) {
    throw new Error("No tenant context found");
  }
  
  const query = `
    SELECT p.*, tp.custom_title, tp.custom_description, tp.custom_metadata
    FROM product p
    INNER JOIN tenant_product tp ON p.id = tp.product_id
    WHERE tp.tenant_id = $1 AND tp.enabled = true
    ORDER BY p.created_at DESC
  `;
  
  const result = await pool.query(query, [tenantId]);
  return result.rows;
}

/**
 * Tenant-aware service wrapper class
 * Wraps Medusa services to automatically apply tenant filtering
 */
export class TenantScopedService {
  constructor(
    private req: MedusaRequest,
    private service: any
  ) {}

  /**
   * List with automatic tenant filtering
   */
  async list(filters: Record<string, any> = {}, config: any = {}): Promise<any> {
    const scopedFilters = scopeQueryToTenant(this.req, filters);
    return await this.service.list(scopedFilters, config);
  }

  /**
   * Retrieve by ID with tenant verification
   */
  async retrieve(id: string, config: any = {}): Promise<any> {
    const entity = await this.service.retrieve(id, config);
    verifyTenantOwnership(this.req, entity, this.service.constructor.name);
    return entity;
  }

  /**
   * Create with automatic tenant_id injection
   */
  async create(data: Record<string, any>): Promise<any> {
    const dataWithTenant = addTenantToData(this.req, data);
    return await this.service.create(dataWithTenant);
  }

  /**
   * Update with tenant verification
   */
  async update(id: string, data: Record<string, any>): Promise<any> {
    // First verify ownership
    await this.retrieve(id);
    // Then update
    return await this.service.update(id, data);
  }

  /**
   * Delete with tenant verification
   */
  async delete(id: string): Promise<void> {
    // Verify ownership before deleting
    await this.retrieve(id);
    return await this.service.delete(id);
  }
}

/**
 * Create a tenant-scoped wrapper for a Medusa service
 * 
 * Example:
 * ```typescript
 * const productService = req.scope.resolve("productService");
 * const tenantProductService = createTenantScopedService(req, productService);
 * 
 * // All operations automatically scoped to tenant
 * const products = await tenantProductService.list();
 * ```
 */
export function createTenantScopedService(
  req: MedusaRequest,
  service: any
): TenantScopedService {
  return new TenantScopedService(req, service);
}
