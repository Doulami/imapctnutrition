import { defineMiddlewares } from "@medusajs/medusa";
import { tenantContextMiddleware } from "./middlewares/tenant-context";

/**
 * Middleware Configuration
 * 
 * Tenant context middleware is applied to all store routes to:
 * - Auto-detect tenant from domain/subdomain/header
 * - Inject tenant into request context
 * - Enable tenant-scoped queries
 */
export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/*",
      middlewares: [tenantContextMiddleware],
    },
    {
      matcher: "/admin/*",
      middlewares: [tenantContextMiddleware],
    },
  ],
});
