# Tenant API Testing Guide

## Prerequisites

Before testing the Tenant APIs, you need to:

1. **Start the backend services**
   ```bash
   cd dev-services
   sudo docker compose --env-file .env.db up -d
   ```

2. **Start Medusa backend**
   ```bash
   cd backend
   npm run dev
   ```

3. **Create an admin user** (first time only)
   
   Open Medusa Admin UI: http://localhost:9000/app
   
   - Create your admin account through the UI
   - Or use Medusa CLI:
     ```bash
     npx medusa user -e admin@impactnutrition.com -p supersecret
     ```

---

## Authentication

All `/admin/*` routes require authentication. You have two options:

### Option 1: Using Medusa Admin UI

1. Open http://localhost:9000/app
2. Login with your admin credentials
3. Open browser DevTools → Network tab
4. Make any request and copy the session cookie
5. Use that cookie in your API requests

### Option 2: API Authentication Flow

**Step 1: Login**
```bash
curl -X POST http://localhost:9000/admin/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@impactnutrition.com",
    "password": "supersecret"
  }'
```

**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "Bearer"
}
```

**Step 2: Use the token in requests**
```bash
curl http://localhost:9000/admin/tenants \
  -H "Authorization: Bearer <access_token>"
```

---

## Testing Tenant CRUD Operations

### 1. List All Tenants

```bash
curl http://localhost:9000/admin/tenants \
  -H "Authorization: Bearer <token>"
```

**Expected Response:**
```json
{
  "tenants": [
    {
      "id": "hq",
      "name": "Impact Nutrition HQ",
      "status": "active",
      "currency_code": "TND",
      "domain": "impactnutrition.com.tn"
    }
  ]
}
```

### 2. Get HQ Tenant

```bash
curl http://localhost:9000/admin/tenants/hq \
  -H "Authorization: Bearer <token>"
```

### 3. Create Paris Franchise

```bash
curl -X POST http://localhost:9000/admin/tenants \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "paris",
    "name": "Impact Paris",
    "currency_code": "EUR",
    "default_locale": "fr",
    "supported_locales": ["fr"],
    "domain": "paris.impactnutrition.com",
    "subdomain": "paris",
    "tax_rate": 0.20,
    "allowed_payment_methods": ["stripe"],
    "shipping_regions": ["FR"],
    "capabilities": {
      "subscriptions_enabled": true,
      "loyalty_points_enabled": true
    }
  }'
```

### 4. Update Paris Tenant

```bash
curl -X PATCH http://localhost:9000/admin/tenants/paris \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Impact Nutrition Paris",
    "capabilities": {
      "subscriptions_enabled": true,
      "loyalty_points_enabled": true,
      "influencer_program_enabled": true
    }
  }'
```

### 5. Deactivate Paris Tenant

```bash
curl -X DELETE http://localhost:9000/admin/tenants/paris \
  -H "Authorization: Bearer <token>"
```

---

## Testing Tenant Products

### 1. Opt-in Product for Paris

```bash
curl -X POST http://localhost:9000/admin/tenants/paris/products \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "prod_whey_1kg",
    "price": 45.99,
    "is_active": true
  }'
```

### 2. Get Paris Products

```bash
curl http://localhost:9000/admin/tenants/paris/products \
  -H "Authorization: Bearer <token>"
```

---

## Using Postman/Insomnia

1. **Create a collection** for Medusa Admin API
2. **Set base URL:** `http://localhost:9000`
3. **Add authentication:**
   - Method: Bearer Token
   - Token: `<access_token from login>`
4. **Import requests** from the curl examples above

---

## Troubleshooting

### "Unauthorized" error
- Verify you're logged in and have a valid token
- Check token hasn't expired (default: 24h)
- Re-login to get a new token

### "Tenant not found" error
- Verify tenant ID is correct
- Check tenant exists: `SELECT * FROM tenant;` in PostgreSQL

### Service resolution error
- Restart Medusa: `npm run dev`
- Check tenant module is registered in `medusa-config.ts`

---

## Direct Database Queries (Development Only)

If needed, you can verify data directly:

```bash
# Connect to PostgreSQL
sudo docker exec -i impact-postgres psql -U medusa -d medusa_dev

# Check tenants
SELECT id, name, status, domain FROM tenant;

# Check tenant products
SELECT * FROM tenant_product WHERE tenant_id = 'paris';

# Check RBAC policies
SELECT role, resource, actions FROM rbac_policy;
```

---

## Next Steps

After verifying basic CRUD operations:

1. Test tenant isolation (ensure queries are scoped correctly)
2. Implement tenant context middleware
3. Add RBAC policy enforcement
4. Write integration tests
