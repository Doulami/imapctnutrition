# RBAC (Role-Based Access Control) Guide

This guide explains how Role-Based Access Control (RBAC) is implemented in the Impact multi-tenant platform and how to use it in your API routes and services.

## Overview

RBAC enforces permission-based access control across all API routes, ensuring that users can only perform actions they are authorized for based on their assigned roles.

### Architecture Components

1. **RBAC Service** (`src/modules/rbac/rbac-service.ts`)
   - Core business logic for permission checks
   - In-memory caching with Redis fallback
   - Role and permission management

2. **RBAC Middleware** (`src/middlewares/rbac.ts`)
   - Route-level permission enforcement
   - Role requirement checks
   - Tenant access verification

3. **Database Tables**
   - `rbac_policy`: Role definitions with allowed resources and actions
   - `admin_user`: User-role assignments per tenant

## Roles and Permissions

### Default Roles

| Role | Scope | Permissions |
|------|-------|-------------|
| **GlobalAdmin** | All tenants | Full system access (wildcard `*`) |
| **TenantAdmin** | Single tenant | Manage all resources within tenant |
| **CatalogMgr** | Single tenant | Manage products, categories, collections |
| **OrderOps** | Single tenant | Manage orders, fulfillment, returns |
| **CustomerSupport** | Single tenant | Read-only access to orders and customers |

### Permission Format

Permissions follow the pattern: `resource:action`

**Resources:**
- `product`, `category`, `collection`
- `order`, `fulfillment`, `return`
- `customer`, `cart`, `payment`
- `tenant` (admin only)
- `*` (wildcard - all resources)

**Actions:**
- `read`, `create`, `update`, `delete`
- `*` (wildcard - all actions)

**Examples:**
- `product:read` - Can view products
- `product:*` - Can perform all actions on products
- `*:*` - Full access (GlobalAdmin only)

## Using RBAC Middleware

### Require Specific Permissions

Protect routes by requiring one or more permissions:

```typescript path=/home/dmiku/dev/impactnutrition/backend/src/api/admin/products/route.ts start=null
import { requirePermissions } from '../../../middlewares/rbac';

// User must have product:read permission
export const GET = [
  requirePermissions(['product:read']),
  async (req, res) => {
    // Route handler
  }
];

// User must have product:create permission
export const POST = [
  requirePermissions(['product:create']),
  async (req, res) => {
    // Route handler
  }
];
```

### Require Specific Roles

Restrict routes to specific roles:

```typescript path=/home/dmiku/dev/impactnutrition/backend/src/api/admin/tenants/route.ts start=null
import { requireRoles } from '../../../middlewares/rbac';

// Only GlobalAdmin can manage tenants
export const POST = [
  requireRoles(['GlobalAdmin']),
  async (req, res) => {
    // Route handler
  }
];
```

### Require Tenant Access

Ensure user has access to the tenant in the request context:

```typescript path=/home/dmiku/dev/impactnutrition/backend/src/api/admin/orders/route.ts start=null
import { requireTenantAccess } from '../../../middlewares/rbac';

// User must have access to the tenant in context
export const GET = [
  requireTenantAccess(),
  async (req, res) => {
    // Route handler - tenant_id available in req.scope
  }
];
```

### Combining Middlewares

Apply multiple RBAC checks in sequence:

```typescript path=null start=null
import { requireTenantAccess, requirePermissions } from '../../../middlewares/rbac';

export const PUT = [
  requireTenantAccess(),              // Check tenant access first
  requirePermissions(['order:update']), // Then check permission
  async (req, res) => {
    // Route handler
  }
];
```

## Using RBAC Service Directly

For programmatic permission checks in services or complex logic:

```typescript path=null start=null
import { RBACService } from '../modules/rbac/rbac-service';

class MyService {
  constructor(private rbacService: RBACService) {}

  async performAction(userId: string, tenantId: string) {
    // Check if user has permission
    const canUpdate = await this.rbacService.hasPermission(
      userId,
      tenantId,
      'product:update'
    );

    if (!canUpdate) {
      throw new Error('Insufficient permissions');
    }

    // Check if user has role
    const hasRole = await this.rbacService.hasRole(
      userId,
      tenantId,
      'CatalogMgr'
    );

    // Get all user roles
    const roles = await this.rbacService.getUserRoles(userId, tenantId);

    // Verify tenant access
    const hasAccess = await this.rbacService.verifyTenantAccess(
      userId,
      tenantId
    );

    // Proceed with action
  }
}
```

## Managing Users and Roles

### Assign Role to User

```typescript path=null start=null
import { AdminUserService } from '../modules/admin-user/admin-user-service';

const adminUserService = new AdminUserService(container);

await adminUserService.assignRole({
  userId: 'user_123',
  tenantId: 'paris',
  role: 'CatalogMgr'
});
```

### Remove Role from User

```typescript path=null start=null
await adminUserService.removeRole({
  userId: 'user_123',
  tenantId: 'paris',
  role: 'CatalogMgr'
});
```

### Get User's Roles

```typescript path=null start=null
const assignments = await adminUserService.getUserRoleAssignments('user_123');

// Filter by tenant
const parisRoles = assignments.filter(a => a.tenant_id === 'paris');
```

## Error Handling

RBAC middleware returns HTTP 403 when permission checks fail:

```json
{
  "message": "Forbidden: Insufficient permissions",
  "type": "forbidden"
}
```

Handle in your application:

```typescript path=null start=null
try {
  await fetch('/admin/products', {
    headers: { 'Authorization': 'Bearer token' }
  });
} catch (err) {
  if (err.status === 403) {
    // User lacks required permissions
    console.error('Access denied');
  }
}
```

## Performance Considerations

### Caching

RBAC service implements two-tier caching:

1. **In-memory cache** (10-minute TTL)
   - Fastest lookup
   - Process-local
   
2. **Redis cache** (1-hour TTL)
   - Shared across instances
   - Fallback for cache misses

### Cache Invalidation

Caches are automatically cleared when:
- User roles are assigned or removed
- RBAC policies are modified

Manual invalidation:

```typescript path=null start=null
await rbacService.clearCache(userId, tenantId);
```

### Best Practices

1. **Apply middleware early**: Place RBAC middleware before expensive operations
2. **Cache role checks**: Don't repeatedly check the same permission in a loop
3. **Use role-based checks for coarse control**: Prefer `requireRoles` when checking high-level access
4. **Use permission checks for granular control**: Prefer `requirePermissions` for specific actions

## Database Schema

### rbac_policy Table

```sql
CREATE TABLE rbac_policy (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  resource TEXT NOT NULL,
  actions JSONB NOT NULL DEFAULT '[]',
  conditions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rbac_policy_role ON rbac_policy(role);
```

### admin_user Table

```sql
CREATE TABLE admin_user (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenant(id),
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id, role)
);

CREATE INDEX idx_admin_user_user_id ON admin_user(user_id);
CREATE INDEX idx_admin_user_tenant_id ON admin_user(tenant_id);
```

## Security Notes

1. **Always use middleware**: Don't rely solely on client-side checks
2. **GlobalAdmin caution**: GlobalAdmin has unrestricted access - assign sparingly
3. **Tenant isolation**: RBAC enforces tenant boundaries - users cannot access other tenants' data
4. **Audit logging**: All RBAC checks are logged via audit middleware

## Testing RBAC

See integration tests at `backend/tests/integration/tenant-isolation.test.ts` for examples of:
- Permission enforcement
- Role verification
- Tenant access control
- Cross-tenant isolation

Run tests:

```bash
cd backend
npm run test:integration:tenant
```

## Next Steps

- [Audit Logging Guide](./audit-logging-guide.md)
- [Multi-Tenant Design](./multi-tenant-design.md)
- [Admin API Reference](./api-reference.md)
