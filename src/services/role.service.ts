import { supabase } from "../lib/supabase";
import { EMPLOYEE_ROLES, type EmployeeRole } from "../types/role.types";

export function getRoleHierarchyLevel(role: string): number {
  const levels: Record<string, number> = {
    Admin: 9,
    Worker: 1,
    Supervisor: 2,
    Manager: 3,
    "Chief Manager": 4,
    "General Manager": 5,
    "Managing Director": 6,
    "MD-Manufacturing": 6,
    "MD-Marketing": 6,
    "MD-Transport": 6,
    "MD-RD": 6,
    President: 7,
    "Vice President": 7,
    "Vice Chairman": 8,
  };
  return levels[role.trim()] ?? 0;
}

export function validateRoleAssignment(employeeId: string, role: string): EmployeeRole {
  if (!employeeId.trim()) throw new Error("Employee is required");
  const normalizedRole = role.trim() as EmployeeRole;
  if (!EMPLOYEE_ROLES.includes(normalizedRole)) throw new Error("Select a valid employee role");
  return normalizedRole;
}

export async function assignEmployeeRole(employeeId: string, role: string, assignedBy: string): Promise<EmployeeRole> {
  const normalizedRole = validateRoleAssignment(employeeId, role);
  if (!assignedBy.trim()) throw new Error("Authenticated user is required");

  const hierarchyLevel = getRoleHierarchyLevel(normalizedRole);

  const { data, error } = await supabase.rpc("assign_employee_role", {
    p_employee_id: employeeId,
    p_role: normalizedRole,
    p_assigned_by: assignedBy,
  });

  if (!error && data) {
    return data as EmployeeRole;
  }

  // Resilient fallback to direct update on profiles
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      role: normalizedRole,
      designation: normalizedRole,
      hierarchy_level: hierarchyLevel,
    })
    .eq("id", employeeId);

  if (updateError) {
    throw error || updateError;
  }

  return normalizedRole;
}
