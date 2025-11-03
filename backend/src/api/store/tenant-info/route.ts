import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getTenantFromRequest, getTenantIdFromRequest } from "../../middlewares/tenant-context";

export const AUTHENTICATE = false;

/**
 * GET /store/tenant-info
 * 
 * Public endpoint to verify tenant context middleware
 * Returns detected tenant information
 * 
 * Test with:
 * - curl http://localhost:9000/store/tenant-info
 * - curl -H "X-Tenant-ID: paris" http://localhost:9000/store/tenant-info
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
      message: "Tenant context middleware did not detect a tenant"
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
    capabilities: tenant.capabilities,
    full_tenant: tenant
  });
}
