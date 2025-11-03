import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http";
import { getAuditService, AuditAction, AuditResource } from "../../modules/tenant/audit-service";

/**
 * Audit Logging Middleware
 * 
 * Automatically logs all mutation operations (POST, PUT, PATCH, DELETE)
 * to the audit_log table.
 * 
 * Apply after authentication and tenant context middlewares.
 */

// Map HTTP methods to audit actions
const methodToAction: Record<string, AuditAction> = {
  'POST': 'create',
  'PUT': 'update',
  'PATCH': 'update',
  'DELETE': 'delete',
  'GET': 'read'
};

// Extract resource name from URL path
function extractResource(path: string): AuditResource | null {
  // Match /admin/{resource} or /store/{resource}
  const match = path.match(/\/(admin|store)\/([^\/]+)/);
  if (!match) return null;

  const resource = match[2];
  
  // Map to our audit resource types
  const resourceMap: Record<string, AuditResource> = {
    'tenants': 'tenant',
    'products': 'product',
    'orders': 'order',
    'customers': 'customer',
    'users': 'user',
    'carts': 'cart',
    'payments': 'payment'
  };

  return resourceMap[resource] || null;
}

// Extract resource ID from URL path
function extractResourceId(path: string): string | null {
  // Match /resource/{id} pattern
  const match = path.match(/\/([^\/]+)\/([a-zA-Z0-9_-]+)$/);
  return match ? match[2] : null;
}

/**
 * Audit logging middleware
 * Logs mutations automatically
 */
export async function auditMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const method = req.method;
  
  // Only log mutations and sensitive reads
  const shouldAudit = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  
  if (!shouldAudit) {
    return next();
  }

  // Extract audit information
  const action = methodToAction[method];
  const resource = extractResource(req.path);
  
  if (!resource) {
    // Not a resource we're tracking, skip audit
    return next();
  }

  const resourceId = extractResourceId(req.path);

  // Intercept response to log after successful operation
  const originalSend = res.send;
  const originalJson = res.json;

  // @ts-ignore
  res.send = function(body) {
    logAudit(req, res, action, resource, resourceId, body);
    return originalSend.call(this, body);
  };

  // @ts-ignore
  res.json = function(body) {
    logAudit(req, res, action, resource, resourceId, body);
    return originalJson.call(this, body);
  };

  next();
}

/**
 * Log audit entry
 */
async function logAudit(
  req: MedusaRequest,
  res: MedusaResponse,
  action: AuditAction,
  resource: AuditResource,
  resourceId: string | null,
  responseBody: any
) {
  // Only log successful operations (2xx status codes)
  if (res.statusCode < 200 || res.statusCode >= 300) {
    return;
  }

  try {
    const auditService = getAuditService();
    
    // Extract resource ID from response if not in URL
    const finalResourceId = resourceId || 
                            responseBody?.id || 
                            responseBody?.data?.id ||
                            responseBody?.tenant?.id ||
                            responseBody?.product?.id;

    // Build metadata
    const metadata: any = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode
    };

    // Add RBAC check result if available
    // @ts-ignore
    if (req.rbacCheck) {
      // @ts-ignore
      metadata.rbacCheck = req.rbacCheck;
    }

    // Add request body for creates/updates (excluding sensitive fields)
    if (action === 'create' || action === 'update') {
      const sanitizedBody = sanitizeBody(req.body);
      if (Object.keys(sanitizedBody).length > 0) {
        metadata.changes = sanitizedBody;
      }
    }

    await auditService.logFromRequest(
      req,
      action,
      resource,
      finalResourceId,
      metadata
    );
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('[Audit Middleware] Failed to log:', error);
  }
}

/**
 * Remove sensitive fields from audit log
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return {};
  }

  const sanitized = { ...body };
  
  // Remove sensitive fields
  const sensitiveFields = [
    'password',
    'password_hash',
    'secret',
    'token',
    'api_key',
    'credit_card',
    'cvv',
    'ssn'
  ];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Manual audit logging helper for custom scenarios
 * 
 * Usage:
 * ```typescript
 * await logAuditAction(req, 'delete', 'product', productId, { reason: 'discontinued' });
 * ```
 */
export async function logAuditAction(
  req: MedusaRequest,
  action: AuditAction,
  resource: AuditResource,
  resourceId?: string,
  metadata?: any
): Promise<void> {
  const auditService = getAuditService();
  await auditService.logFromRequest(req, action, resource, resourceId, metadata);
}
