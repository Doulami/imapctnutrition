import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http";
import TenantService from "../../modules/tenant/service";

/**
 * Tenant Context Middleware
 * 
 * Detects the current tenant from:
 * 1. X-Tenant-ID header (highest priority - for admin API)
 * 2. Subdomain (e.g., paris.impactnutrition.com)
 * 3. Full domain (e.g., impactnutrition.com.tn)
 * 
 * Injects tenant into request context for use by routes and services.
 */
export async function tenantContextMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const tenantService: TenantService = req.scope.resolve("tenantModuleService");
    
    let tenant = null;
    let detectionMethod = "none";

    // Method 1: Check X-Tenant-ID header (for admin/API usage)
    const tenantHeader = req.headers["x-tenant-id"] as string;
    if (tenantHeader) {
      tenant = await tenantService.getTenantById(tenantHeader);
      detectionMethod = "header";
    }

    // Method 2: Check subdomain
    if (!tenant) {
      const host = req.headers.host || "";
      const parts = host.split(".");
      
      // If subdomain exists (e.g., paris.impactnutrition.com)
      if (parts.length > 2) {
        const subdomain = parts[0];
        tenant = await tenantService.getTenantByDomain(subdomain);
        if (tenant) {
          detectionMethod = "subdomain";
        }
      }
    }

    // Method 3: Check full domain
    if (!tenant) {
      const host = req.headers.host || "";
      const domain = host.split(":")[0]; // Remove port if present
      tenant = await tenantService.getTenantByDomain(domain);
      if (tenant) {
        detectionMethod = "domain";
      }
    }

    // Default to HQ if no tenant found (fallback)
    if (!tenant) {
      tenant = await tenantService.getTenantById("hq");
      detectionMethod = "default";
    }

    // Inject tenant into request context
    if (tenant) {
      // @ts-ignore - Add tenant to request object
      req.tenant = tenant;
      // @ts-ignore - Add tenant ID for easy access
      req.tenantId = tenant.id;
      // @ts-ignore - Add detection method for debugging
      req.tenantDetectionMethod = detectionMethod;

      // Log for debugging (remove in production)
      console.log(`[Tenant Context] Detected tenant: ${tenant.id} (via ${detectionMethod})`);
    } else {
      console.warn("[Tenant Context] No tenant detected, request may fail");
    }

    next();
  } catch (error) {
    console.error("[Tenant Context] Error detecting tenant:", error);
    // Don't block request, just log error
    next();
  }
}

/**
 * Get tenant from request context
 * Helper function for routes and services
 */
export function getTenantFromRequest(req: MedusaRequest): any {
  // @ts-ignore
  return req.tenant || null;
}

/**
 * Get tenant ID from request context
 */
export function getTenantIdFromRequest(req: MedusaRequest): string | null {
  // @ts-ignore
  return req.tenantId || null;
}

/**
 * Require tenant middleware
 * Returns 400 if no tenant in context
 */
export function requireTenant(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  // @ts-ignore
  if (!req.tenant) {
    return res.status(400).json({
      error: "Tenant required",
      message: "No tenant could be determined for this request"
    });
  }
  next();
}
