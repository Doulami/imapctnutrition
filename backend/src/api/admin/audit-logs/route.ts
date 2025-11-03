import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getAuditService } from "../../../modules/tenant/audit-service";
import { getTenantIdFromRequest } from "../../middlewares/tenant-context";

/**
 * GET /admin/audit-logs
 * 
 * Get audit logs for the current tenant
 * Query params:
 * - limit: number (default: 100)
 * - offset: number (default: 0)
 * - userId: string (optional)
 * - resource: string (optional)
 * - action: string (optional)
 * - startDate: ISO date string (optional)
 * - endDate: ISO date string (optional)
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    
    if (!tenantId) {
      return res.status(400).json({
        error: "Tenant required",
        message: "No tenant context found"
      });
    }

    const auditService = getAuditService();
    
    // Parse query params
    const {
      limit = '100',
      offset = '0',
      userId,
      resource,
      action,
      startDate,
      endDate
    } = req.query as Record<string, string>;

    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset),
      userId,
      resource: resource as any,
      action: action as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    };

    const logs = await auditService.getTenantAuditLogs(tenantId, options);
    
    res.json({
      audit_logs: logs,
      count: logs.length,
      limit: options.limit,
      offset: options.offset
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch audit logs",
      message: error.message
    });
  }
}
