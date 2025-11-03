import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import TenantService from "../../../modules/tenant/service";

/**
 * GET /admin/tenants
 * List all tenants
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    const tenantService: TenantService = req.scope.resolve("tenantService");
    const tenants = await tenantService.listTenants();
    
    res.json({ tenants });
  } catch (error) {
    res.status(500).json({ 
      error: "Failed to fetch tenants", 
      message: error.message 
    });
  }
}

/**
 * POST /admin/tenants
 * Create a new tenant
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    const tenantService: TenantService = req.scope.resolve("tenantService");
    const tenant = await tenantService.createTenant(req.body);
    
    res.status(201).json({ tenant });
  } catch (error) {
    res.status(500).json({ 
      error: "Failed to create tenant", 
      message: error.message 
    });
  }
}
