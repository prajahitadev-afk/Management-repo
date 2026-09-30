import { getVisibleProfilesForUser } from "./hierarchy.service";

export type DashboardScopeRole = "Worker" | "Supervisor" | "Manager" | "Chief Manager" | "General Manager" | "Managing Director" | "President" | "Vice Chairman";

export interface DashboardScope {
  role: DashboardScopeRole;
  userId: string;
  department: string | null;
  employeeIds: Set<string> | null;
}

export async function resolveDashboardScope(userId: string, role: string, department?: string | null): Promise<DashboardScope> {
  const resolvedRole = role as DashboardScopeRole;
  const visibleProfiles = await getVisibleProfilesForUser(userId, resolvedRole, department);
  const operationalProfiles = resolvedRole === "Managing Director"
    ? visibleProfiles.filter((profile) => String(profile.department ?? "").trim().toLowerCase() === String(department ?? "").trim().toLowerCase())
    : visibleProfiles;
  return { role: resolvedRole, userId, department: department ?? null, employeeIds: new Set(operationalProfiles.map((profile) => profile.id)) };
}

export function inDashboardScope(scope: DashboardScope, ownerId: string | null | undefined): boolean {
  return scope.employeeIds === null || Boolean(ownerId && scope.employeeIds.has(ownerId));
}
