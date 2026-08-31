import type { Metadata } from "next";
import { requirePermission } from "@/server/session";
import { permissionsForRole } from "@pv/backend/services/roles";
import { RoleEditor } from "./role-editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Roles & Permissions" };

export default async function RolesAdminPage() {
  await requirePermission("role.manage");
  const [managerPermissions, employeePermissions] = await Promise.all([
    permissionsForRole("MANAGER"),
    permissionsForRole("EMPLOYEE"),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Roles &amp; Permissions</h1>
        <p className="mt-1 text-sm text-(--pv-muted)">
          The CEO role is protected and cannot be edited. Changes here take effect for a signed-in
          Manager or Employee immediately, without a deploy.
        </p>
      </div>
      <RoleEditor role="MANAGER" granted={managerPermissions} />
      <RoleEditor role="EMPLOYEE" granted={employeePermissions} />
    </div>
  );
}
