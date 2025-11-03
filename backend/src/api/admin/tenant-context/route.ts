import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getTenantFromRequest, getTenantIdFromRequest } from "../../middlewares/tenant-context";

export const AUTHENTICATE = false;

/**
 * GET /admin/tenant-context
 * 
 * Test endpoint to verify tenant context middleware
 * Returns detected tenant information
 * 
 * Test with:
 * - curl http://localhost:9000/admin/tenant-context
 * - curl -H "X-Tenant-ID: paris" http://localhost:9000/admin/tenant-context
 * - curl -H "Host: paris.impactnutrition.com" http://localhost:9000/admin/tenant-context
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const tenant = getTenantFromRequest(req);
  const tenantId = getTenantIdFromRequest(req);
  
  // @ts-ignore
  const detectionMethod = req.tenantDetectionMethod || "unknown";

  if (!tenant) {
    return res.status(404).json({
      error: "No tenant detected",
      message: "Tenant context middleware did not detect a tenant",
      headers: {
        host: req.headers.host,
        "x-tenant-id": req.headers["x-tenant-id"]
      }
    });
  }

  res.json({
    success: true,
    tenant_id: tenantId,
    tenant_name: tenant.name,
    currency: tenant.currency_code,
    locale: tenant.default_locale,
    detection_method: detectionMethod,
    domain: tenant.domain,
    subdomain: tenant.subdomain,
    request_host: req.headers.host,
    request_tenant_header: req.headers["x-tenant-id"]
  });
}
