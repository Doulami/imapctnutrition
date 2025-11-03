import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import TenantService from "../../../../modules/tenant/service";

/**
 * GET /admin/tenants/:id
 * Get tenant by ID
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    const tenantService: TenantService = req.scope.resolve("tenantService");
    const { id } = req.params;
    
    const tenant = await tenantService.getTenantById(id);
    
    if (!tenant) {
      return res.status(404).json({ 
        error: "Tenant not found", 
        tenant_id: id 
      });
    }
    
    res.json({ tenant });
  } catch (error) {
    res.status(500).json({ 
      error: "Failed to fetch tenant", 
      message: error.message 
    });
  }
}

/**
 * PATCH /admin/tenants/:id
 * Update tenant
 */
export async function PATCH(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    const tenantService: TenantService = req.scope.resolve("tenantService");
    const { id } = req.params;
    
    const tenant = await tenantService.updateTenant(id, req.body);
    
    if (!tenant) {
      return res.status(404).json({ 
        error: "Tenant not found", 
        tenant_id: id 
      });
    }
    
    res.json({ tenant });
  } catch (error) {
    res.status(500).json({ 
      error: "Failed to update tenant", 
      message: error.message 
    });
  }
}

/**
 * DELETE /admin/tenants/:id
 * Deactivate tenant (soft delete)
 */
export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    const tenantService: TenantService = req.scope.resolve("tenantService");
    const { id } = req.params;
    
    await tenantService.deactivateTenant(id);
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ 
      error: "Failed to deactivate tenant", 
      message: error.message 
    });
  }
}
