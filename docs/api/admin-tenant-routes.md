# Admin Tenant API Routes

**Base URL:** `http://localhost:9000/admin`

All routes require admin authentication (to be implemented).

---

## Tenant Management

### List All Tenants
```http
GET /admin/tenants
```

**Response (200):**
```json
{
  "tenants": [
    {
      "id": "hq",
      "name": "Impact Nutrition HQ",
      "status": "active",
      "currency_code": "TND",
      "domain": "impactnutrition.com.tn",
      "capabilities": {
        "subscriptions_enabled": false,
        "loyalty_points_enabled": false
      }
    }
  ]
}
```

---

### Get Tenant by ID
```http
GET /admin/tenants/:id
```

**Parameters:**
- `id` (path) — Tenant ID

**Response (200):**
```json
{
  "tenant": {
    "id": "hq",
    "name": "Impact Nutrition HQ",
    "currency_code": "TND",
    "default_locale": "fr",
    "supported_locales": ["fr", "ar", "en"],
    "tax_rate": null,
    "tax_inclusive_pricing": false,
    "allowed_payment_methods": ["stripe", "cash_on_delivery"],
    "shipping_regions": ["TN"],
    "domain": "impactnutrition.com.tn",
    "status": "active",
    "capabilities": {
      "subscriptions_enabled": false,
      "loyalty_points_enabled": false,
      "influencer_program_enabled": false,
      "coach_portal_enabled": false,
      "b2b_pricing_enabled": false,
      "gift_cards_enabled": false
    },
    "brand_colors": {
      "primary": "#000000",
      "secondary": "#FFFFFF",
      "accent": "#FF0000"
    },
    "created_at": "2025-11-03T12:00:00Z",
    "updated_at": "2025-11-03T12:00:00Z"
  }
}
```

**Response (404):**
```json
{
  "error": "Tenant not found",
  "tenant_id": "invalid-id"
}
```

---

### Create Tenant
```http
POST /admin/tenants
```

**Request Body:**
```json
{
  "id": "paris",
  "name": "Impact Paris",
  "currency_code": "EUR",
  "default_locale": "fr",
  "supported_locales": ["fr"],
  "domain": "paris.impactnutrition.com",
  "subdomain": "paris",
  "capabilities": {
    "subscriptions_enabled": true,
    "loyalty_points_enabled": true
  }
}
```

**Response (201):**
```json
{
  "tenant": {
    "id": "paris",
    "name": "Impact Paris",
    "status": "active",
    ...
  }
}
```

---

### Update Tenant
```http
PATCH /admin/tenants/:id
```

**Parameters:**
- `id` (path) — Tenant ID

**Request Body:**
```json
{
  "name": "Impact Nutrition Paris - Updated",
  "capabilities": {
    "subscriptions_enabled": true,
    "loyalty_points_enabled": true,
    "influencer_program_enabled": true
  },
  "tax_rate": 0.20
}
```

**Response (200):**
```json
{
  "tenant": {
    "id": "paris",
    "name": "Impact Nutrition Paris - Updated",
    "tax_rate": 0.20,
    ...
  }
}
```

---

### Deactivate Tenant
```http
DELETE /admin/tenants/:id
```

**Parameters:**
- `id` (path) — Tenant ID

**Response (204):** No content

---

## Tenant Products

### Get Tenant Products
```http
GET /admin/tenants/:id/products
```

**Parameters:**
- `id` (path) — Tenant ID

**Response (200):**
```json
{
  "products": [
    {
      "id": "tp_123",
      "tenant_id": "paris",
      "product_id": "prod_whey_1kg",
      "price": 45.99,
      "is_active": true,
      "created_at": "2025-11-03T12:00:00Z"
    }
  ]
}
```

---

### Opt-in Product for Tenant
```http
POST /admin/tenants/:id/products
```

**Parameters:**
- `id` (path) — Tenant ID

**Request Body:**
```json
{
  "product_id": "prod_whey_1kg",
  "price": 45.99,
  "is_active": true
}
```

**Response (201):**
```json
{
  "product": {
    "id": "tp_124",
    "tenant_id": "paris",
    "product_id": "prod_whey_1kg",
    "price": 45.99,
    "is_active": true,
    "created_at": "2025-11-03T13:00:00Z"
  }
}
```

---

## Testing

### Using curl

**List tenants:**
```bash
curl http://localhost:9000/admin/tenants
```

**Get HQ tenant:**
```bash
curl http://localhost:9000/admin/tenants/hq
```

**Create tenant:**
```bash
curl -X POST http://localhost:9000/admin/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "id": "paris",
    "name": "Impact Paris",
    "currency_code": "EUR",
    "default_locale": "fr",
    "domain": "paris.impactnutrition.com"
  }'
```

**Update tenant:**
```bash
curl -X PATCH http://localhost:9000/admin/tenants/paris \
  -H "Content-Type: application/json" \
  -d '{
    "tax_rate": 0.20
  }'
```

**Opt-in product:**
```bash
curl -X POST http://localhost:9000/admin/tenants/paris/products \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "prod_whey_1kg",
    "price": 45.99,
    "is_active": true
  }'
```

---

## Error Handling

All routes return standard error format:

```json
{
  "error": "Error description",
  "message": "Detailed error message"
}
```

**HTTP Status Codes:**
- `200` — Success
- `201` — Created
- `204` — No Content (delete success)
- `400` — Bad Request (missing required fields)
- `404` — Not Found
- `500` — Internal Server Error
