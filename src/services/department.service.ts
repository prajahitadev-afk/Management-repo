import { supabase } from "../lib/supabase";
import { ASSIGNABLE_DEPARTMENTS, type AssignableDepartment, type EmployeeDepartmentHistory } from "../types/department.types";

export type DepartmentKey = "manufacturing" | "marketing" | "transportation" | "research" | "administration";

export interface DepartmentMetadata {
  key: DepartmentKey;
  name: string;
  description: string;
}

export function normalizeDepartment(value: string | null | undefined): DepartmentKey {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
  if (normalized === "manufacturing") return "manufacturing";
  if (normalized === "marketing") return "marketing";
  if (normalized === "transport" || normalized === "transportation") return "transportation";
  if (normalized === "research and development" || normalized === "research development" || normalized === "rnd") return "research";
  return "administration";
}

export function getDepartmentMetadata(department: string | null | undefined): DepartmentMetadata {
  const key = normalizeDepartment(department);
  const metadata: Record<DepartmentKey, DepartmentMetadata> = {
    manufacturing: { key, name: "Manufacturing", description: "Production, quality, and factory operations" },
    marketing: { key, name: "Marketing", description: "Leads, conversions, and growth performance" },
    transportation: { key, name: "Transportation", description: "Deliveries, routes, and fleet operations" },
    research: { key, name: "Research & Development", description: "Experiments, samples, and product progress" },
    administration: { key, name: "Administration", description: "Department workspace and shared operations" },
  };
  return metadata[key];
}

function normalizeAssignableDepartment(value: string): AssignableDepartment {
  const normalized = value.trim().toLowerCase();
  if (normalized === "transport") return "Transportation";
  const department = ASSIGNABLE_DEPARTMENTS.find((option) => option.toLowerCase() === normalized);
  if (!department) throw new Error("Select a valid department");
  return department;
}

export function validateDepartmentAssignment(employeeId: string, department: string): AssignableDepartment {
  if (!employeeId.trim()) throw new Error("Employee is required");
  if (!department.trim()) throw new Error("Department is required");
  return normalizeAssignableDepartment(department);
}

export async function assignEmployeeDepartment(employeeId: string, department: string, changedBy: string): Promise<AssignableDepartment> {
  const normalizedDepartment = validateDepartmentAssignment(employeeId, department);
  if (!changedBy.trim()) throw new Error("Authenticated user is required");

  const { data, error } = await supabase.rpc("assign_employee_department", {
    p_employee_id: employeeId,
    p_department: normalizedDepartment,
    p_changed_by: changedBy,
  });
  if (error) throw error;
  return (data as string) as AssignableDepartment;
}

export async function getEmployeeDepartmentHistory(employeeId: string): Promise<EmployeeDepartmentHistory[]> {
  if (!employeeId.trim()) throw new Error("Employee is required");
  const { data, error } = await supabase
    .from("employee_department_history")
    .select("id, employee_id, previous_department, new_department, changed_by, created_at")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    employeeId: String(row.employee_id),
    previousDepartment: row.previous_department ? String(row.previous_department) : null,
    newDepartment: normalizeAssignableDepartment(String(row.new_department)),
    changedBy: String(row.changed_by),
    createdAt: String(row.created_at),
  }));
}
