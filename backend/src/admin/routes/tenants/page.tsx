import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Button, Table } from "@medusajs/ui";
import { useEffect, useState } from "react";
import { PencilSquare, Trash, Plus } from "@medusajs/icons";
import { useNavigate } from "react-router-dom";

type Tenant = {
  id: string;
  name: string;
  domain: string;
  status: string;
  currency_code: string;
  default_locale: string;
  created_at: string;
};

const TenantsPage = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchTenants = async () => {
    try {
      const response = await fetch("/admin/tenants", {
        credentials: "include",
      });
      const data = await response.json();
      setTenants(data.tenants || []);
    } catch (error) {
      console.error("Failed to fetch tenants:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(`Are you sure you want to delete tenant ${id}?`)) {
      return;
    }

    try {
      const response = await fetch(`/admin/tenants/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        await fetchTenants();
      } else {
        alert("Failed to delete tenant");
      }
    } catch (error) {
      console.error("Failed to delete tenant:", error);
      alert("Failed to delete tenant");
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "inactive":
        return "bg-gray-100 text-gray-800";
      case "suspended":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <Container>
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Loading tenants...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Heading level="h1">Tenants</Heading>
          <p className="text-gray-600 mt-1">
            Manage multi-tenant configurations and settings
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => navigate("/a/tenants/create")}
        >
          <Plus className="mr-2" />
          Create Tenant
        </Button>
      </div>

      {tenants.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-lg p-12 text-center">
          <p className="text-gray-500 mb-4">No tenants found</p>
          <Button variant="secondary" onClick={() => navigate("/a/tenants/create")}>
            Create your first tenant
          </Button>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>ID</Table.HeaderCell>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Domain</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Currency</Table.HeaderCell>
              <Table.HeaderCell>Locale</Table.HeaderCell>
              <Table.HeaderCell>Created</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {tenants.map((tenant) => (
              <Table.Row
                key={tenant.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => navigate(`/a/tenants/${tenant.id}`)}
              >
                <Table.Cell className="font-mono text-sm">
                  {tenant.id}
                </Table.Cell>
                <Table.Cell className="font-medium">{tenant.name}</Table.Cell>
                <Table.Cell className="text-sm text-gray-600">
                  {tenant.domain}
                </Table.Cell>
                <Table.Cell>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(
                      tenant.status
                    )}`}
                  >
                    {tenant.status}
                  </span>
                </Table.Cell>
                <Table.Cell className="text-sm">{tenant.currency_code}</Table.Cell>
                <Table.Cell className="text-sm">{tenant.default_locale}</Table.Cell>
                <Table.Cell className="text-sm text-gray-600">
                  {new Date(tenant.created_at).toLocaleDateString()}
                </Table.Cell>
                <Table.Cell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="transparent"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/a/tenants/${tenant.id}/edit`);
                      }}
                    >
                      <PencilSquare />
                    </Button>
                    <Button
                      variant="transparent"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(tenant.id);
                      }}
                    >
                      <Trash className="text-red-600" />
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Tenants",
  icon: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-5 h-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z"
      />
    </svg>
  ),
});

export default TenantsPage;
