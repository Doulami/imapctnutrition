import { defineMiddlewares } from "@medusajs/medusa";
import { tenantContextMiddleware } from "./middlewares/tenant-context";
import { auditMiddleware } from "./middlewares/audit-middleware";

/**
 * Middleware Configuration
 * 
 * Applied in order:
 * 1. Tenant Context - Detect and inject tenant
 * 2. Audit Logging - Log all mutations (POST/PUT/PATCH/DELETE)
 * 
 * Note: Authentication middleware is applied by Medusa automatically
 */
export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/*",
      middlewares: [tenantContextMiddleware, auditMiddleware],
    },
    {
      matcher: "/admin/*",
      middlewares: [tenantContextMiddleware, auditMiddleware],
    },
  ],
});
