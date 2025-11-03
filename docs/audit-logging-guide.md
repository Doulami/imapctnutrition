# Audit Logging Guide

This guide explains how audit logging works in the Impact multi-tenant platform and how to query and manage audit logs.

## Overview

Audit logging automatically captures all mutations (CREATE, UPDATE, DELETE operations) across the platform, providing a complete audit trail for compliance, security, and debugging.

### Key Features

- **Automatic logging**: All POST, PUT, PATCH, DELETE requests are logged
- **Tenant-scoped**: Logs are isolated per tenant
- **Context-aware**: Captures user, IP, tenant, and request metadata
- **Sensitive data protection**: Automatically redacts passwords, tokens, and credit card data
- **Event-driven**: Built on Medusa's event system for reliability

## Architecture

### Components

1. **Audit Service** (`src/modules/audit/audit-service.ts`)
   - Core logging logic
   - Database persistence
   - Data sanitization

2. **Audit Middleware** (`src/middlewares/audit.ts`)
   - HTTP request interception
   - Response capture
   - Automatic log creation

3. **Admin API** (`src/api/admin/audit-logs/route.ts`)
   - Query interface
   - Filtering and pagination

### Database Schema

```sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenant(id),
  user_id TEXT,
  action TEXT NOT NULL,          -- 'create', 'update', 'delete'
  resource TEXT NOT NULL,         -- e.g., 'product', 'order'
  resource_id TEXT,
  changes JSONB,                  -- Before/after snapshot
  metadata JSONB,                 -- Request context
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_tenant_id ON audit_log(tenant_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_resource ON audit_log(resource);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
```

## What Gets Logged

### Logged Operations

All mutations on the following routes:
- `/admin/*` - Admin API operations
- `/store/*` - Storefront operations (orders, carts, customers)

**HTTP Methods:**
- `POST` → action: `create`
- `PUT`, `PATCH` → action: `update`
- `DELETE` → action: `delete`

**Excluded:**
- `GET` requests (read-only operations)
- Health checks and internal endpoints
- Authentication endpoints (to avoid logging credentials)

### Captured Information

Each audit log entry includes:

```typescript
{
  id: string;              // Unique log ID
  tenant_id: string;       // Tenant context
  user_id: string;         // Authenticated user (if available)
  action: string;          // 'create' | 'update' | 'delete'
  resource: string;        // e.g., 'product', 'order', 'customer'
  resource_id: string;     // ID of the affected resource
  changes: object;         // Before/after data
  metadata: {
    method: string;        // HTTP method
    path: string;          // Request path
    status: number;        // Response status
  };
  ip_address: string;      // Client IP
  user_agent: string;      // Client user agent
  created_at: Date;        // Timestamp
}
```

### Sensitive Data Redaction

The following fields are automatically redacted:
- `password`, `password_hash`
- `api_key`, `secret_key`, `access_token`, `refresh_token`
- `credit_card`, `card_number`, `cvv`, `ssn`

Redacted values are replaced with `[REDACTED]`.

## Querying Audit Logs

### Admin API Endpoint

```
GET /admin/audit-logs
```

### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `user_id` | string | Filter by user | `?user_id=user_123` |
| `resource` | string | Filter by resource type | `?resource=product` |
| `action` | string | Filter by action | `?action=create` |
| `start_date` | ISO 8601 | Filter from date | `?start_date=2024-01-01T00:00:00Z` |
| `end_date` | ISO 8601 | Filter to date | `?end_date=2024-12-31T23:59:59Z` |
| `limit` | number | Page size (default: 50) | `?limit=100` |
| `offset` | number | Pagination offset | `?offset=50` |

### Example Requests

**Get all product changes:**
```bash
curl http://localhost:9000/admin/audit-logs?resource=product \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-tenant-id: paris"
```

**Get user activity:**
```bash
curl http://localhost:9000/admin/audit-logs?user_id=user_123 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-tenant-id: paris"
```

**Get recent order deletions:**
```bash
curl "http://localhost:9000/admin/audit-logs?resource=order&action=delete&start_date=2024-12-01T00:00:00Z" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-tenant-id: paris"
```

### Response Format

```json
{
  "logs": [
    {
      "id": "log_abc123",
      "tenant_id": "paris",
      "user_id": "user_123",
      "action": "update",
      "resource": "product",
      "resource_id": "prod_xyz",
      "changes": {
        "before": { "price": 1000 },
        "after": { "price": 1200 }
      },
      "metadata": {
        "method": "PUT",
        "path": "/admin/products/prod_xyz",
        "status": 200
      },
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2024-12-15T10:30:00Z"
    }
  ],
  "count": 1,
  "limit": 50,
  "offset": 0
}
```

## Using Audit Service Directly

For custom logging or integration with other services:

```typescript path=null start=null
import { AuditService } from '../modules/audit/audit-service';

class MyService {
  constructor(private auditService: AuditService) {}

  async performCustomAction(userId: string, tenantId: string) {
    // Your business logic
    const result = await this.doSomething();

    // Manual audit log
    await this.auditService.log({
      tenantId,
      userId,
      action: 'custom_action',
      resource: 'my_resource',
      resourceId: result.id,
      changes: {
        before: null,
        after: result
      },
      metadata: {
        custom_field: 'value'
      },
      ipAddress: '127.0.0.1',
      userAgent: 'Internal Service'
    });
  }
}
```

## Common Use Cases

### 1. Compliance Audits

Track all changes to sensitive resources:

```bash
# Get all customer data modifications
curl "http://localhost:9000/admin/audit-logs?resource=customer&action=update" \
  -H "Authorization: Bearer TOKEN"
```

### 2. Security Investigation

Identify unauthorized access attempts:

```bash
# Check failed operations by user
curl "http://localhost:9000/admin/audit-logs?user_id=suspect_user" \
  -H "Authorization: Bearer TOKEN"
```

### 3. Data Recovery

Find deleted records for potential restoration:

```bash
# Get deleted orders with details
curl "http://localhost:9000/admin/audit-logs?resource=order&action=delete" \
  -H "Authorization: Bearer TOKEN"
```

The `changes.before` field contains the state before deletion.

### 4. User Activity Monitoring

Track admin activity:

```bash
# Get all actions by admin in the last 7 days
curl "http://localhost:9000/admin/audit-logs?user_id=admin_123&start_date=2024-12-08T00:00:00Z" \
  -H "Authorization: Bearer TOKEN"
```

## Best Practices

### 1. Regular Review

Schedule periodic audit log reviews:
- Weekly: Review high-privilege user actions
- Monthly: Compliance reporting
- On-demand: Incident investigation

### 2. Retention Policy

Audit logs should be retained according to compliance requirements:
- GDPR: Minimum 6-12 months
- PCI-DSS: Minimum 1 year
- SOX: 7 years

Implement log archival:

```sql
-- Archive logs older than 1 year
INSERT INTO audit_log_archive 
SELECT * FROM audit_log 
WHERE created_at < NOW() - INTERVAL '1 year';

DELETE FROM audit_log 
WHERE created_at < NOW() - INTERVAL '1 year';
```

### 3. Monitoring and Alerts

Set up alerts for suspicious activity:
- Multiple failed access attempts
- Bulk deletions
- Access outside business hours
- Privilege escalation attempts

### 4. Integration with SIEM

Export audit logs to Security Information and Event Management (SIEM) systems:

```typescript path=null start=null
// Example: Stream to external SIEM
import { AuditService } from '../modules/audit/audit-service';

class SIEMIntegration {
  async exportLogs(startDate: Date, endDate: Date) {
    const logs = await auditService.query({
      filters: {
        start_date: startDate,
        end_date: endDate
      }
    });

    // Send to SIEM (Splunk, ELK, etc.)
    await this.sendToSIEM(logs);
  }
}
```

## Performance Considerations

### Index Usage

Audit log queries are optimized with indexes on:
- `tenant_id` - Fast tenant isolation
- `user_id` - Quick user activity lookup
- `resource` - Efficient resource filtering
- `created_at` - Time-range queries

### Query Optimization

**Good:**
```bash
# Uses indexes efficiently
curl "http://localhost:9000/admin/audit-logs?resource=product&start_date=2024-12-01T00:00:00Z&limit=100"
```

**Avoid:**
```bash
# Scans entire table (no filters)
curl "http://localhost:9000/admin/audit-logs?limit=10000"
```

### Async Logging

Audit logging is non-blocking:
1. Request completes immediately
2. Log is written asynchronously
3. Failures don't affect user experience

## Security Notes

1. **Access Control**: Only users with `audit:read` permission can query logs
2. **Tenant Isolation**: Users can only see logs for their assigned tenant(s)
3. **Immutable**: Audit logs cannot be modified or deleted via API
4. **Encrypted at Rest**: Use database-level encryption for audit tables

## Troubleshooting

### Logs Not Appearing

**Check middleware is applied:**
```typescript path=null start=null
// In medusa-config.ts or middleware setup
import { auditMiddleware } from './middlewares/audit';

// Should be registered on /admin/* and /store/*
```

**Verify database connection:**
```bash
cd backend
npm run dev
# Check logs for database errors
```

### Missing Context (user_id, tenant_id)

Ensure authentication and tenant context middleware run **before** audit middleware:

```typescript path=null start=null
// Correct order
[
  authMiddleware,           // 1. Set user
  tenantContextMiddleware,  // 2. Set tenant
  auditMiddleware          // 3. Log with context
]
```

### High Database Load

If audit logging causes performance issues:

1. **Batch writes**: Buffer logs and write in batches
2. **Separate database**: Use dedicated audit database
3. **Archive old logs**: Move to cold storage
4. **Disable verbose logging**: Filter out low-value operations

## Testing

Run audit logging tests:

```bash
cd backend
npm run test:integration:tenant
```

Test coverage includes:
- Automatic logging on mutations
- Sensitive data redaction
- Tenant scoping
- Query filtering

## Next Steps

- [RBAC Guide](./rbac-guide.md) - Access control integration
- [Multi-Tenant Design](./multi-tenant-design.md) - Tenant architecture
- [Performance Tuning](./performance-tuning-guide.md) - Optimization tips
