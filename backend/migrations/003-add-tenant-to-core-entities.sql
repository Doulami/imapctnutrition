-- Add tenant_id to Medusa Core Entities
-- Date: 2025-11-03
-- Purpose: Enable tenant isolation across Product, Order, Customer, Cart

-- 1. Add tenant_id to product table
ALTER TABLE product 
ADD COLUMN IF NOT EXISTS tenant_id TEXT;

-- Add foreign key constraint
ALTER TABLE product 
ADD CONSTRAINT fk_product_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_product_tenant_id ON product(tenant_id);

-- Set default tenant for existing products (HQ owns all existing products)
UPDATE product SET tenant_id = 'hq' WHERE tenant_id IS NULL;

-- Make tenant_id required for future inserts
ALTER TABLE product 
ALTER COLUMN tenant_id SET NOT NULL;

COMMENT ON COLUMN product.tenant_id IS 'Owner tenant of this product (master catalog)';

-- 2. Add tenant_id to order table
ALTER TABLE "order" 
ADD COLUMN IF NOT EXISTS tenant_id TEXT;

ALTER TABLE "order" 
ADD CONSTRAINT fk_order_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_order_tenant_id ON "order"(tenant_id);

-- Existing orders belong to HQ
UPDATE "order" SET tenant_id = 'hq' WHERE tenant_id IS NULL;

ALTER TABLE "order" 
ALTER COLUMN tenant_id SET NOT NULL;

COMMENT ON COLUMN "order".tenant_id IS 'Tenant that owns this order';

-- 3. Add tenant_id to customer table
ALTER TABLE customer 
ADD COLUMN IF NOT EXISTS tenant_id TEXT;

ALTER TABLE customer 
ADD CONSTRAINT fk_customer_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_customer_tenant_id ON customer(tenant_id);

-- Existing customers belong to HQ
UPDATE customer SET tenant_id = 'hq' WHERE tenant_id IS NULL;

ALTER TABLE customer 
ALTER COLUMN tenant_id SET NOT NULL;

COMMENT ON COLUMN customer.tenant_id IS 'Tenant this customer is registered with';

-- 4. Add tenant_id to cart table
ALTER TABLE cart 
ADD COLUMN IF NOT EXISTS tenant_id TEXT;

ALTER TABLE cart 
ADD CONSTRAINT fk_cart_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_cart_tenant_id ON cart(tenant_id);

-- Existing carts belong to HQ
UPDATE cart SET tenant_id = 'hq' WHERE tenant_id IS NULL;

ALTER TABLE cart 
ALTER COLUMN tenant_id SET NOT NULL;

COMMENT ON COLUMN cart.tenant_id IS 'Tenant context for this shopping cart';

-- 5. Add tenant_id to payment table (optional but useful)
ALTER TABLE payment 
ADD COLUMN IF NOT EXISTS tenant_id TEXT;

ALTER TABLE payment 
ADD CONSTRAINT fk_payment_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_payment_tenant_id ON payment(tenant_id);

UPDATE payment SET tenant_id = 'hq' WHERE tenant_id IS NULL;

ALTER TABLE payment 
ALTER COLUMN tenant_id SET NOT NULL;

COMMENT ON COLUMN payment.tenant_id IS 'Tenant for payment processing';

-- 6. Add tenant_id to fulfillment table
ALTER TABLE fulfillment 
ADD COLUMN IF NOT EXISTS tenant_id TEXT;

ALTER TABLE fulfillment 
ADD CONSTRAINT fk_fulfillment_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_fulfillment_tenant_id ON fulfillment(tenant_id);

UPDATE fulfillment SET tenant_id = 'hq' WHERE tenant_id IS NULL;

ALTER TABLE fulfillment 
ALTER COLUMN tenant_id SET NOT NULL;

COMMENT ON COLUMN fulfillment.tenant_id IS 'Tenant responsible for fulfillment';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Tenant isolation migration complete!';
  RAISE NOTICE 'Added tenant_id to: product, order, customer, cart, payment, fulfillment';
  RAISE NOTICE 'All existing records assigned to HQ tenant';
END $$;
