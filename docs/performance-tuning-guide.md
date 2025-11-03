# Performance Tuning Guide

This guide covers performance optimization strategies for the Impact multi-tenant e-commerce platform, including database tuning, caching, query optimization, and monitoring.

## Overview

The platform includes several performance optimization layers:
1. **Database Connection Pooling** - Efficient PostgreSQL connection management
2. **Multi-Tier Caching** - In-memory and Redis caching
3. **Query Optimization** - Prepared statements and batch operations
4. **Performance Monitoring** - Query timing and slow query detection

## Database Optimization

### Connection Pooling

PostgreSQL connection pool is configured in `backend/src/utils/performance.ts`:

```typescript path=/home/dmiku/dev/impactnutrition/backend/src/utils/performance.ts start=null
export const poolConfig = {
  max: 20,                    // Maximum connections
  min: 5,                     // Minimum idle connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Fail fast on connection errors
};
```

**Tuning Guidelines:**

| Environment | max | min | Considerations |
|-------------|-----|-----|----------------|
| Development | 10 | 2 | Low concurrency |
| Staging | 20 | 5 | Medium load |
| Production | 50-100 | 10-20 | High concurrency, adjust based on server CPU cores |

**Formula:** `max_connections = (CPU_CORES * 2) + disk_spindles`

### Database Indexes

All tenant-scoped tables have optimized indexes:

```sql
-- Tenant isolation (critical for performance)
CREATE INDEX idx_product_tenant_id ON product(tenant_id);
CREATE INDEX idx_order_tenant_id ON "order"(tenant_id);
CREATE INDEX idx_customer_tenant_id ON customer(tenant_id);
CREATE INDEX idx_cart_tenant_id ON cart(tenant_id);

-- Audit logs (high write volume)
CREATE INDEX idx_audit_log_tenant_id ON audit_log(tenant_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- RBAC (frequent reads)
CREATE INDEX idx_rbac_policy_role ON rbac_policy(role);
CREATE INDEX idx_admin_user_user_id ON admin_user(user_id);
```

**Index Maintenance:**

```sql
-- Analyze tables for query planner
ANALYZE product;
ANALYZE "order";
ANALYZE customer;

-- Rebuild indexes (if fragmented)
REINDEX INDEX idx_product_tenant_id;

-- Check index usage
SELECT 
  schemaname, tablename, indexname, 
  idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Query Optimization

#### Use Prepared Queries

Prepared queries are cached and reused:

```typescript path=null start=null
import { prepareQuery } from '../utils/performance';

const getProductsByTenant = prepareQuery(
  'SELECT * FROM product WHERE tenant_id = $1 LIMIT $2',
  'get_products_by_tenant'
);

// Reuse prepared query
const products = await pool.query(getProductsByTenant, ['paris', 50]);
```

#### Batch Operations

Avoid N+1 queries by batching:

**Bad (N+1 queries):**
```typescript path=null start=null
for (const productId of productIds) {
  const product = await db.query('SELECT * FROM product WHERE id = $1', [productId]);
}
```

**Good (Single query):**
```typescript path=null start=null
import { batchQuery } from '../utils/performance';

const products = await batchQuery(
  'SELECT * FROM product WHERE id = ANY($1)',
  [productIds]
);
```

#### Query Result Caching

Cache expensive queries:

```typescript path=null start=null
import { cacheQuery } from '../utils/performance';

const expensiveQuery = async () => {
  return await db.query(`
    SELECT p.*, COUNT(o.id) as order_count
    FROM product p
    LEFT JOIN order_item oi ON oi.product_id = p.id
    LEFT JOIN "order" o ON o.id = oi.order_id
    WHERE p.tenant_id = $1
    GROUP BY p.id
    ORDER BY order_count DESC
  `, [tenantId]);
};

// Cache for 5 minutes
const result = await cacheQuery(
  `popular_products_${tenantId}`,
  expensiveQuery,
  300 // TTL in seconds
);
```

## Caching Strategy

### Two-Tier Cache

The platform uses a hybrid caching approach:

```typescript path=null start=null
// In-memory cache (fastest, process-local)
const memoryCache = new Map<string, { value: any; expiry: number }>();

// Redis cache (shared across instances)
const redisCache = redis.createClient();

// Check memory first, fall back to Redis
async function getFromCache(key: string) {
  // Tier 1: Memory (sub-millisecond)
  const memoryHit = memoryCache.get(key);
  if (memoryHit && memoryHit.expiry > Date.now()) {
    return memoryHit.value;
  }

  // Tier 2: Redis (1-5ms)
  const redisHit = await redisCache.get(key);
  if (redisHit) {
    // Backfill memory cache
    memoryCache.set(key, {
      value: JSON.parse(redisHit),
      expiry: Date.now() + 600000 // 10 min
    });
    return JSON.parse(redisHit);
  }

  return null;
}
```

### Cache Keys

Use consistent naming conventions:

```
{service}:{tenant_id}:{entity}:{id}:{operation}

Examples:
- rbac:paris:user:user_123:permissions
- tenant:paris:config
- product:hq:catalog:page:1
```

### Cache TTLs

Recommended TTLs by data volatility:

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| RBAC permissions | 10 min (memory), 1 hour (Redis) | Infrequent changes |
| Tenant config | 1 hour | Rarely changes |
| Product catalog | 5 minutes | Moderate changes |
| Cart data | 30 seconds | Frequently changes |
| Order status | No cache | Real-time required |

### Cache Invalidation

Invalidate caches proactively:

```typescript path=null start=null
import { RBACService } from '../modules/rbac/rbac-service';

// After role assignment
await adminUserService.assignRole({ userId, tenantId, role });
await rbacService.clearCache(userId, tenantId); // Invalidate RBAC cache

// After product update
await productService.update(productId, updates);
await cacheService.delete(`product:${tenantId}:${productId}:*`); // Wildcard
```

## Performance Monitoring

### Query Performance Monitor

Track slow queries automatically:

```typescript path=/home/dmiku/dev/impactnutrition/backend/src/utils/performance.ts start=null
import { PerformanceMonitor } from '../utils/performance';

const monitor = new PerformanceMonitor();

async function queryWithMonitoring() {
  const timer = monitor.startTimer('product_query');
  
  try {
    const result = await db.query('SELECT * FROM product WHERE tenant_id = $1', ['paris']);
    timer.end();
    return result;
  } catch (err) {
    timer.end();
    throw err;
  }
}

// View stats
console.log(monitor.getStats());
// {
//   product_query: {
//     count: 1500,
//     avgMs: 12.5,
//     minMs: 3.2,
//     maxMs: 450.8,
//     p95Ms: 28.3,
//     p99Ms: 95.6
//   }
// }
```

### Slow Query Logging

Enable PostgreSQL slow query log:

```ini
# In postgresql.conf
log_min_duration_statement = 100  # Log queries > 100ms
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_statement = 'none'
log_duration = off
```

### Application Metrics

Export metrics to monitoring systems:

```typescript path=null start=null
import { PerformanceMonitor } from '../utils/performance';

// Export to Prometheus, DataDog, etc.
app.get('/metrics', (req, res) => {
  const stats = monitor.getStats();
  res.json({
    queries: stats,
    cache_hit_rate: cacheService.getHitRate(),
    pool_stats: pool.totalCount // Active connections
  });
});
```

## Optimization Checklist

### Database

- [ ] Connection pool sized appropriately
- [ ] All foreign keys indexed
- [ ] `tenant_id` indexed on all scoped tables
- [ ] Composite indexes for common query patterns
- [ ] Regular `ANALYZE` runs scheduled
- [ ] Vacuum configured (auto-vacuum enabled)
- [ ] Query plans reviewed (`EXPLAIN ANALYZE`)

### Caching

- [ ] RBAC caching enabled
- [ ] Redis configured and connected
- [ ] Cache TTLs tuned per data type
- [ ] Cache invalidation on mutations
- [ ] Memory limits configured
- [ ] Cache hit rate monitored (target: >80%)

### Application

- [ ] Prepared queries for repeated operations
- [ ] Batch operations instead of loops
- [ ] N+1 queries eliminated
- [ ] Unnecessary joins removed
- [ ] Pagination on large result sets
- [ ] Eager loading for known associations

### API

- [ ] Response compression enabled (gzip)
- [ ] Rate limiting configured
- [ ] Query parameter validation
- [ ] Large payloads streamed
- [ ] CDN for static assets

## Common Performance Issues

### Issue 1: Slow Product Listing

**Symptom:** `/admin/products` takes 2+ seconds

**Diagnosis:**
```sql
EXPLAIN ANALYZE
SELECT * FROM product WHERE tenant_id = 'paris' LIMIT 50;
```

**Solutions:**
1. Add composite index: `CREATE INDEX idx_product_tenant_created ON product(tenant_id, created_at DESC);`
2. Cache first page: `cacheQuery('products:paris:page:1', query, 300)`
3. Use cursor pagination instead of OFFSET

### Issue 2: RBAC Check Overhead

**Symptom:** Every request adds 50-100ms for permission checks

**Solutions:**
1. Enable RBAC caching (default: enabled)
2. Increase cache TTL: `RBAC_CACHE_TTL=600` (10 minutes)
3. Batch permission checks: `hasPermissions(['product:read', 'product:write'])`

### Issue 3: High Database Connection Count

**Symptom:** PostgreSQL hits `max_connections` limit

**Diagnosis:**
```sql
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';
SELECT pid, usename, application_name, state, query 
FROM pg_stat_activity 
WHERE state != 'idle';
```

**Solutions:**
1. Reduce pool size: `max: 20` → `max: 10`
2. Enable connection timeout: `connectionTimeoutMillis: 2000`
3. Fix connection leaks (ensure `client.release()` called)

### Issue 4: Audit Log Write Bottleneck

**Symptom:** High write latency on mutations

**Solutions:**
1. Batch audit log writes (buffer 10-100 entries)
2. Use separate database for audit logs
3. Disable verbose logging in development
4. Archive old logs to cold storage

## Load Testing

### Test Scenarios

1. **Concurrent Product Listing:**
   ```bash
   ab -n 1000 -c 50 -H "x-tenant-id: paris" http://localhost:9000/admin/products
   ```

2. **Order Creation:**
   ```bash
   ab -n 500 -c 25 -p order.json -T application/json http://localhost:9000/store/orders
   ```

3. **RBAC Permission Checks:**
   ```bash
   ab -n 5000 -c 100 -H "Authorization: Bearer $TOKEN" http://localhost:9000/admin/products
   ```

### Performance Targets

| Metric | Development | Production |
|--------|-------------|------------|
| Product listing (p95) | < 200ms | < 100ms |
| Order creation (p95) | < 500ms | < 300ms |
| RBAC check overhead | < 50ms | < 20ms |
| Cache hit rate | > 70% | > 85% |
| Database connection usage | < 80% | < 70% |

## Production Recommendations

### Database

- **PostgreSQL 16+** with proper tuning
- **Dedicated read replicas** for reporting queries
- **Partitioning** for audit_log table (by date)
- **Backup strategy** with PITR (Point-In-Time Recovery)

### Redis

- **Redis Cluster** for high availability
- **Memory limit** with eviction policy (`allkeys-lru`)
- **Persistence** enabled (AOF or RDB)

### Application

- **Horizontal scaling** with multiple instances
- **Load balancer** with health checks
- **CDN** for static assets and product images
- **APM tool** (DataDog, New Relic, etc.)

### Monitoring

- **Query performance** dashboard
- **Cache hit rate** alerting (< 75%)
- **Connection pool** saturation alerts
- **Slow query** notifications (> 500ms)

## Next Steps

- [Multi-Tenant Design](./multi-tenant-design.md) - Tenant architecture
- [RBAC Guide](./rbac-guide.md) - Access control
- [Audit Logging Guide](./audit-logging-guide.md) - Compliance logging
