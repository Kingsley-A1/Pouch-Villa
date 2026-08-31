import type { Metadata } from "next";
import { requirePermission } from "@/server/session";
import { permissionsForRole } from "@pv/backend/services/roles";
import { listStaff, listRoleCodes } from "@pv/backend/services/staff-access";
import { MintCodeForm } from "./mint-code-form";
import { CodeList } from "./code-list";
import { StaffList } from "./staff-list";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staff" };

export default async function StaffAdminPage() {
  const principal = await requirePermission("staff.view");
  const granted = new Set(await permissionsForRole(principal.role));
  const canManage = granted.has("staff.manage");

  const [members, codes] = await Promise.all([
    listStaff(),
    canManage ? listRoleCodes() : Promise.resolve([]),
  ]);

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-bold">Staff</h1>
        <p className="mt-1 text-sm text-(--pv-muted)">
          Every account here was created by redeeming a role code. Nothing is seeded.
        </p>
      </div>

      {canManage ? (
        <>
          <MintCodeForm />
          <div>
            <h2 className="mb-3 text-lg font-bold">Live codes</h2>
            <CodeList codes={codes} />
          </div>
        </>
      ) : null}

      <div>
        <h2 className="mb-3 text-lg font-bold">Team ({members.length})</h2>
        <StaffList members={members} canManage={canManage} />
      </div>
    </div>
  );
}
