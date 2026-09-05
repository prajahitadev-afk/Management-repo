import { supabase } from "../lib/supabase";
import { isValidUUID } from "../utils/uuid";

export interface HierarchyProfile {
  id: string;
  name?: string | null;
  department?: string | null;
  role?: string | null;
  reports_to?: string | null;
  manager_id?: string | null;
  hierarchy_level?: number | null;
  [key: string]: unknown;
}
export type Profile = HierarchyProfile;

export function isHigherInHierarchy(currentUser: Profile, targetUser: Profile): boolean {
  return Number(currentUser.hierarchy_level ?? 0) > Number(targetUser.hierarchy_level ?? 0);
}

export async function getHierarchyProfiles(): Promise<HierarchyProfile[]> {
  const { data, error } = await supabase.from("profiles").select("*");
  if (error) throw error;
  return (data ?? []) as HierarchyProfile[];
}

export async function getCurrentProfile(employeeId: string): Promise<HierarchyProfile> {
  if (!isValidUUID(employeeId)) throw new Error("A valid employee ID is required");
  const { data, error } = await supabase.from("profiles").select("*").eq("id", employeeId).single();
  if (error) throw error;
  return data as HierarchyProfile;
}

export async function getSubordinateProfiles(employeeId: string, profiles?: HierarchyProfile[]): Promise<HierarchyProfile[]> {
  const rows = profiles ?? await getHierarchyProfiles();
  const result: HierarchyProfile[] = [];
  const visited = new Set<string>([employeeId]);
  let frontier = [employeeId];

  while (frontier.length > 0) {
    const next = rows.filter((profile) => profile.reports_to && frontier.includes(String(profile.reports_to)) && !visited.has(profile.id));
    next.forEach((profile) => {
      visited.add(profile.id);
      result.push(profile);
    });
    frontier = next.map((profile) => profile.id);
  }

  return result;
}

export async function getSubordinates(employeeId: string): Promise<string[]> {
  const profiles = await getSubordinateProfiles(employeeId);
  return profiles.map((profile) => profile.id);
}

export function canAccessDepartmentModule(userDepartment: string | null | undefined, requiredDepartment: string): boolean {
  return String(userDepartment ?? "").trim().toLowerCase() === requiredDepartment.trim().toLowerCase();
}

export async function getDirectSuperior(employeeId: string): Promise<HierarchyProfile | null> {
  const current = await getCurrentProfile(employeeId);
  if (!current.reports_to) return null;
  const profiles = await getHierarchyProfiles();
  return profiles.find((profile) => profile.id === current.reports_to) ?? null;
}

export async function canApproveSubordinate(approverId: string, creatorId: string): Promise<boolean> {
  if (approverId === creatorId) return false;
  const profiles = await getHierarchyProfiles();
  const approver = profiles.find((profile) => profile.id === approverId);
  const creator = profiles.find((profile) => profile.id === creatorId);
  if (!approver || !creator) return false;
  if (!isHigherInHierarchy(approver, creator)) return false;
  return creator.reports_to === approverId;
}

export async function getVisibleProfilesForUser(employeeId: string, role: string, department?: string | null): Promise<HierarchyProfile[]> {
  const current = await getCurrentProfile(employeeId);
  const profiles = await getHierarchyProfiles();
  const normalizedDepartment = String(department ?? current.department ?? "").trim().toLowerCase();
  const subordinates = await getSubordinateProfiles(employeeId, profiles);
  const sameDepartment = (profile: HierarchyProfile) => String(profile.department ?? "").trim().toLowerCase() === normalizedDepartment;
  const roleName = role || current.role || "Worker";

  if (roleName === "Worker") {
    const supervisorId = current.reports_to;
    return profiles.filter((profile) => profile.id === employeeId || (supervisorId && profile.reports_to === supervisorId && profile.role === "Worker"));
  }

  if (["Managing Director", "President", "Vice Chairman"].includes(roleName)) {
    return profiles;
  }

  if (roleName === "Supervisor") {
    return [current, ...subordinates.filter((profile) => profile.reports_to === employeeId && sameDepartment(profile))];
  }

  if (roleName === "General Manager") {
    return profiles.filter(sameDepartment);
  }

  return [current, ...subordinates.filter(sameDepartment)];
}
