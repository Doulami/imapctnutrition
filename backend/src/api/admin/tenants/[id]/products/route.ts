import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import TenantService from "../../../../../modules/tenant/service";

/**
 * GET /admin/tenants/:id/products
 * Get products for a tenant
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    const tenantService: TenantService = req.scope.resolve("tenantService");
    const { id } = req.params;
    
    const products = await tenantService.getTenantProducts(id);
    
    res.json({ products });
  } catch (error) {
    res.status(500).json({ 
      error: "Failed to fetch tenant products", 
      message: error.message 
    });
  }
}

/**
 * POST /admin/tenants/:id/products
 * Opt-in or update product for tenant
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    const tenantService: TenantService = req.scope.resolve("tenantService");
    const { id: tenantId } = req.params;
    const { product_id, price, is_active } = req.body;
    
    if (!product_id) {
      return res.status(400).json({ 
        error: "product_id is required" 
      });
    }
    
    const product = await tenantService.optInProduct(
      tenantId, 
      product_id, 
      price, 
      is_active ?? true
    );
    
    res.status(201).json({ product });
  } catch (error) {
    res.status(500).json({ 
      error: "Failed to opt-in product", 
      message: error.message 
    });
  }
}
