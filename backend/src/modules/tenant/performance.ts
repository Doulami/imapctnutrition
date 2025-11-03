/**
 * Performance Optimization Utilities
 * 
 * - In-memory caching for tenant config (5 min TTL)
 * - Connection pooling settings
 * - Query optimization helpers
 */

// In-memory cache for tenant configs
const tenantCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get tenant from cache or fetch function
 */
export async function getCachedTenant(
  tenantId: string,
  fetchFn: () => Promise<any>
): Promise<any> {
  const cached = tenantCache.get(tenantId);
  const now = Date.now();

  if (cached && cached.expiry > now) {
    return cached.data;
  }

  // Fetch fresh data
  const data = await fetchFn();
  
  if (data) {
    tenantCache.set(tenantId, {
      data,
      expiry: now + CACHE_TTL
    });
  }

  return data;
}

/**
 * Invalidate tenant cache
 */
export function invalidateTenantCache(tenantId: string): void {
  tenantCache.delete(tenantId);
}

/**
 * Clear all cache
 */
export function clearAllCache(): void {
  tenantCache.clear();
}

/**
 * Get cache stats
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: tenantCache.size,
    keys: Array.from(tenantCache.keys())
  };
}

/**
 * PostgreSQL connection pool settings
 * Use these when creating Pool instances for optimal performance
 */
export const POOL_CONFIG = {
  // Connection pool size
  max: 20, // Maximum connections
  min: 2,  // Minimum idle connections
  
  // Connection timeouts
  connectionTimeoutMillis: 2000,
  idleTimeoutMillis: 30000,
  
  // Query timeouts
  statement_timeout: 10000, // 10 seconds
  query_timeout: 10000,
  
  // Keep-alive
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
};

/**
 * Batch query helper
 * Executes multiple queries in a single transaction
 */
export async function batchQuery(
  pool: any,
  queries: Array<{ query: string; params: any[] }>
): Promise<any[]> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const results = [];
    for (const { query, params } of queries) {
      const result = await client.query(query, params);
      results.push(result.rows);
    }
    
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Prepared statement helper
 * Use for frequently executed queries
 */
export class PreparedQuery {
  private name: string;
  private query: string;
  private pool: any;

  constructor(pool: any, name: string, query: string) {
    this.pool = pool;
    this.name = name;
    this.query = query;
  }

  async execute(params: any[]): Promise<any[]> {
    const result = await this.pool.query({
      name: this.name,
      text: this.query,
      values: params
    });
    return result.rows;
  }
}

/**
 * Query result cache for expensive queries
 */
const queryCache = new Map<string, { data: any; expiry: number }>();

export async function getCachedQuery<T>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  ttl: number = 60000 // 1 minute default
): Promise<T> {
  const cached = queryCache.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expiry > now) {
    return cached.data as T;
  }

  const data = await queryFn();
  
  queryCache.set(cacheKey, {
    data,
    expiry: now + ttl
  });

  return data;
}

/**
 * Performance monitoring
 */
export class PerformanceMonitor {
  private metrics = new Map<string, number[]>();

  recordQuery(name: string, duration: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);
    
    // Keep only last 100 measurements
    const arr = this.metrics.get(name)!;
    if (arr.length > 100) {
      arr.shift();
    }
  }

  getStats(name: string): { avg: number; min: number; max: number; count: number } | null {
    const measurements = this.metrics.get(name);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    return {
      avg: measurements.reduce((a, b) => a + b, 0) / measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      count: measurements.length
    };
  }

  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [name, _] of this.metrics) {
      stats[name] = this.getStats(name);
    }
    return stats;
  }
}

// Global performance monitor instance
export const perfMonitor = new PerformanceMonitor();

/**
 * Measure query execution time
 */
export async function measureQuery<T>(
  name: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await queryFn();
    perfMonitor.recordQuery(name, Date.now() - start);
    return result;
  } catch (error) {
    perfMonitor.recordQuery(`${name}_error`, Date.now() - start);
    throw error;
  }
}
