import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Button, Badge } from "@medusajs/ui";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowUturnLeft, PencilSquare } from "@medusajs/icons";

type Tenant = {
  id: string;
  name: string;
  domain: string;
  status: string;
  currency_code: string;
  default_locale: string;
  capabilities: {
    allow_product_opt_in: boolean;
    allow_pricing_override: boolean;
    allow_inventory_management: boolean;
  };
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
};

const TenantDetailPage = () => {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const response = await fetch(`/admin/tenants/${id}`, {
          credentials: "include",
        });
        const data = await response.json();
        setTenant(data.tenant);
      } catch (error) {
        console.error("Failed to fetch tenant:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchTenant();
    }
  }, [id]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge color="green">Active</Badge>;
      case "inactive":
        return <Badge color="gray">Inactive</Badge>;
      case "suspended":
        return <Badge color="red">Suspended</Badge>;
      default:
        return <Badge color="gray">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Container>
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Loading tenant...</p>
        </div>
      </Container>
    );
  }

  if (!tenant) {
    return (
      <Container>
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-gray-500 mb-4">Tenant not found</p>
          <Button variant="secondary" onClick={() => navigate("/tenants")}>
            Back to Tenants
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <Heading level="h1">{tenant.name}</Heading>
            {getStatusBadge(tenant.status)}
          </div>
          <p className="text-gray-600 mt-1 font-mono text-sm">{tenant.id}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate("/tenants")}>
            <ArrowUturnLeft className="mr-2" />
            Back to List
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate(`/tenants/edit?id=${id}`)}
          >
            <PencilSquare className="mr-2" />
            Edit Tenant
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white p-6 rounded-lg border">
          <Heading level="h2" className="mb-4">
            Basic Information
          </Heading>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Domain</p>
              <p className="font-medium">
                <a
                  href={tenant.domain}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {tenant.domain}
                </a>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="font-medium capitalize">{tenant.status}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Currency</p>
              <p className="font-medium">{tenant.currency_code}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Default Locale</p>
              <p className="font-medium">{tenant.default_locale}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Created</p>
              <p className="font-medium">
                {new Date(tenant.created_at).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Last Updated</p>
              <p className="font-medium">
                {new Date(tenant.updated_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Capabilities */}
        <div className="bg-white p-6 rounded-lg border">
          <Heading level="h2" className="mb-4">
            Capabilities
          </Heading>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Product Opt-in</p>
                <p className="text-xs text-gray-500">
                  Can opt-in to HQ master catalog
                </p>
              </div>
              <Badge
                color={
                  tenant.capabilities.allow_product_opt_in ? "green" : "gray"
                }
              >
                {tenant.capabilities.allow_product_opt_in
                  ? "Enabled"
                  : "Disabled"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Pricing Override</p>
                <p className="text-xs text-gray-500">
                  Can set custom prices for products
                </p>
              </div>
              <Badge
                color={
                  tenant.capabilities.allow_pricing_override ? "green" : "gray"
                }
              >
                {tenant.capabilities.allow_pricing_override
                  ? "Enabled"
                  : "Disabled"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Inventory Management</p>
                <p className="text-xs text-gray-500">
                  Can manage product inventory
                </p>
              </div>
              <Badge
                color={
                  tenant.capabilities.allow_inventory_management
                    ? "green"
                    : "gray"
                }
              >
                {tenant.capabilities.allow_inventory_management
                  ? "Enabled"
                  : "Disabled"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Metadata */}
        {Object.keys(tenant.metadata || {}).length > 0 && (
          <div className="bg-white p-6 rounded-lg border">
            <Heading level="h2" className="mb-4">
              Metadata
            </Heading>
            <pre className="bg-gray-50 p-4 rounded text-sm font-mono overflow-x-auto">
              {JSON.stringify(tenant.metadata, null, 2)}
            </pre>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white p-6 rounded-lg border">
          <Heading level="h2" className="mb-4">
            Quick Actions
          </Heading>
          <div className="grid grid-cols-3 gap-4">
            <Button
              variant="secondary"
              onClick={() => navigate(`/products?tenant=${tenant.id}`)}
            >
              View Products
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate(`/orders?tenant=${tenant.id}`)}
            >
              View Orders
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate(`/customers?tenant=${tenant.id}`)}
            >
              View Customers
            </Button>
          </div>
        </div>
      </div>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Tenant Details",
});

export default TenantDetailPage;
