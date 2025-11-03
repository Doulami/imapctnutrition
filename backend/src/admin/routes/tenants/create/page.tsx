import { defineRouteConfig } from "@medusajs/admin-sdk";
import {
  Container,
  Heading,
  Button,
  Input,
  Label,
  Select,
  Textarea,
  Switch,
} from "@medusajs/ui";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUturnLeft } from "@medusajs/icons";

const CreateTenantPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    domain: "",
    status: "active",
    currency_code: "TND",
    default_locale: "fr",
    metadata: "{}",
    capabilities: {
      allow_product_opt_in: true,
      allow_pricing_override: true,
      allow_inventory_management: true,
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Parse metadata JSON
      let parsedMetadata = {};
      try {
        parsedMetadata = JSON.parse(formData.metadata);
      } catch {
        alert("Invalid JSON in metadata field");
        setLoading(false);
        return;
      }

      const response = await fetch("/admin/tenants", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          metadata: parsedMetadata,
        }),
      });

      if (response.ok) {
        navigate("/tenants");
      } else {
        const error = await response.json();
        alert(`Failed to create tenant: ${error.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Failed to create tenant:", error);
      alert("Failed to create tenant");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Heading level="h1">Create Tenant</Heading>
          <p className="text-gray-600 mt-1">
            Configure a new tenant for your multi-tenant platform
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate("/tenants")}>
          <ArrowUturnLeft className="mr-2" />
          Back to List
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white p-6 rounded-lg border">
          <Heading level="h2" className="mb-4">
            Basic Information
          </Heading>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="id">Tenant ID *</Label>
              <Input
                id="id"
                value={formData.id}
                onChange={(e) =>
                  setFormData({ ...formData, id: e.target.value })
                }
                placeholder="e.g., paris, lyon, hq"
                required
                pattern="[a-z0-9-]+"
                title="Lowercase letters, numbers, and hyphens only"
              />
              <p className="text-xs text-gray-500 mt-1">
                Unique identifier (lowercase, no spaces)
              </p>
            </div>

            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Paris Store"
                required
              />
            </div>

            <div>
              <Label htmlFor="domain">Domain *</Label>
              <Input
                id="domain"
                type="url"
                value={formData.domain}
                onChange={(e) =>
                  setFormData({ ...formData, domain: e.target.value })
                }
                placeholder="https://paris.impactnutrition.com.tn"
                required
              />
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <Select.Trigger id="status">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="active">Active</Select.Item>
                  <Select.Item value="inactive">Inactive</Select.Item>
                  <Select.Item value="suspended">Suspended</Select.Item>
                </Select.Content>
              </Select>
            </div>
          </div>
        </div>

        {/* Localization */}
        <div className="bg-white p-6 rounded-lg border">
          <Heading level="h2" className="mb-4">
            Localization
          </Heading>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="currency_code">Currency Code *</Label>
              <Select
                value={formData.currency_code}
                onValueChange={(value) =>
                  setFormData({ ...formData, currency_code: value })
                }
              >
                <Select.Trigger id="currency_code">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="TND">TND (Tunisian Dinar)</Select.Item>
                  <Select.Item value="EUR">EUR (Euro)</Select.Item>
                  <Select.Item value="USD">USD (US Dollar)</Select.Item>
                  <Select.Item value="GBP">GBP (British Pound)</Select.Item>
                </Select.Content>
              </Select>
            </div>

            <div>
              <Label htmlFor="default_locale">Default Locale *</Label>
              <Select
                value={formData.default_locale}
                onValueChange={(value) =>
                  setFormData({ ...formData, default_locale: value })
                }
              >
                <Select.Trigger id="default_locale">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="fr">French (fr)</Select.Item>
                  <Select.Item value="en">English (en)</Select.Item>
                  <Select.Item value="ar">Arabic (ar)</Select.Item>
                </Select.Content>
              </Select>
            </div>
          </div>
        </div>

        {/* Capabilities */}
        <div className="bg-white p-6 rounded-lg border">
          <Heading level="h2" className="mb-4">
            Capabilities
          </Heading>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Allow Product Opt-in</Label>
                <p className="text-xs text-gray-500">
                  Tenant can opt-in to HQ master catalog products
                </p>
              </div>
              <Switch
                checked={formData.capabilities.allow_product_opt_in}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    capabilities: {
                      ...formData.capabilities,
                      allow_product_opt_in: checked,
                    },
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Allow Pricing Override</Label>
                <p className="text-xs text-gray-500">
                  Tenant can set custom prices for opted-in products
                </p>
              </div>
              <Switch
                checked={formData.capabilities.allow_pricing_override}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    capabilities: {
                      ...formData.capabilities,
                      allow_pricing_override: checked,
                    },
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Allow Inventory Management</Label>
                <p className="text-xs text-gray-500">
                  Tenant can manage inventory for their products
                </p>
              </div>
              <Switch
                checked={formData.capabilities.allow_inventory_management}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    capabilities: {
                      ...formData.capabilities,
                      allow_inventory_management: checked,
                    },
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="bg-white p-6 rounded-lg border">
          <Heading level="h2" className="mb-4">
            Metadata (JSON)
          </Heading>
          <Textarea
            value={formData.metadata}
            onChange={(e) =>
              setFormData({ ...formData, metadata: e.target.value })
            }
            placeholder='{"key": "value"}'
            rows={5}
            className="font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-2">
            Additional configuration in JSON format
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate("/tenants")}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? "Creating..." : "Create Tenant"}
          </Button>
        </div>
      </form>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Create Tenant",
});

export default CreateTenantPage;
