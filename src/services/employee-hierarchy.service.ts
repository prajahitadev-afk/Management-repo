import { supabase } from "../lib/supabase";
import type {
  EmployeeHierarchyNode,
  EmployeeHierarchyInput,
  EmployeeHierarchyRecord,
  HierarchyEmployee,
} from "../types/employee-hierarchy.types";
import { normalizeDepartmentName } from "../constants/departments";
import { isValidUUID } from "../utils/uuid";

interface EmployeeHierarchyRow {
  id: string;
  employee_id: string;
  supervisor_id: string;
  hierarchy_level: number;
  department_id: string;
  created_at: string;
}

function toEmployeeHierarchy(row: EmployeeHierarchyRow): EmployeeHierarchyRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    supervisorId: row.supervisor_id,
    hierarchyLevel: row.hierarchy_level,
    departmentId: row.department_id,
    createdAt: row.created_at,
  };
}

export function validateEmployeeHierarchyInput(input: EmployeeHierarchyInput): void {
  if (!input.employeeId) throw new Error("Employee is required");
  if (!input.supervisorId) throw new Error("Supervisor is required");
  if (input.employeeId === input.supervisorId) {
    throw new Error("An employee cannot report to themselves");
  }
  if (!Number.isInteger(input.hierarchyLevel) || input.hierarchyLevel < 1) {
    throw new Error("Hierarchy level must be a positive whole number");
  }
  if (!input.departmentId.trim()) throw new Error("Department is required");
}

export async function getEmployeeHierarchy(): Promise<EmployeeHierarchyRecord[]> {
  const { data, error } = await supabase.from("profiles").select("*").not("reports_to", "is", null).order("hierarchy_level", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((profile) => ({
    id: String(profile.id),
    employeeId: String(profile.id),
    supervisorId: String(profile.reports_to),
    hierarchyLevel: Number(profile.hierarchy_level ?? 1),
    departmentId: String(profile.department ?? ""),
    createdAt: String(profile.created_at ?? ""),
  }));
}

export async function getEmployeeHierarchyTree(): Promise<EmployeeHierarchyNode[]> {
  const [hierarchy, profilesResult] = await Promise.all([
    getEmployeeHierarchy(),
    supabase.from("profiles").select("id, employee_code, employee_id, name, role, designation, department, joining_date, status"),
  ]);
  if (profilesResult.error) throw profilesResult.error;

  const profiles = new Map<string, Record<string, unknown>>(
    ((profilesResult.data ?? []) as Array<Record<string, unknown>>).map((profile) => [String(profile.id), profile]),
  );
  const nodes = new Map<string, EmployeeHierarchyNode>();

  hierarchy.forEach((record) => {
    const profile = profiles.get(record.employeeId);
    if (!profile) return;
    nodes.set(record.employeeId, {
      id: record.employeeId,
      employeeCode: String(profile.employee_code ?? profile.employee_id ?? record.employeeId),
      name: String(profile.name ?? "Unnamed Employee"),
      role: String(profile.role ?? profile.designation ?? "Worker"),
      department: normalizeDepartmentName(String(profile.department ?? "")),
      supervisorId: record.supervisorId,
      joiningDate: profile.joining_date ? String(profile.joining_date) : null,
      status: String(profile.status ?? "Active"),
      children: [],
    });
  });

  const roots: EmployeeHierarchyNode[] = [];
  nodes.forEach((node) => {
    const supervisor = nodes.get(node.supervisorId);
    if (supervisor) supervisor.children.push(node);
    else roots.push(node);
  });
  return roots;
}

export async function getHierarchyEmployees(): Promise<HierarchyEmployee[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, employee_code, employee_id, name, role, department, hierarchy_level, status")
    .not("role", "is", null)
    .neq("role", "Customer")
    .order("hierarchy_level", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>).map((profile) => ({
    id: String(profile.id),
    employeeCode: String(profile.employee_code ?? profile.employee_id ?? profile.id),
    name: String(profile.name ?? "Unnamed Employee"),
    role: String(profile.role ?? "Worker"),
    department: normalizeDepartmentName(String(profile.department ?? "")),
    hierarchyLevel: Number(profile.hierarchy_level ?? 1),
    status: String(profile.status ?? "Active"),
  }));
}

export async function getEmployeeHierarchyForEmployee(employeeId: string): Promise<EmployeeHierarchyRecord | null> {
  if (!isValidUUID(employeeId)) throw new Error("A valid employee ID is required");
  const { data, error } = await supabase.from("profiles").select("*").eq("id", employeeId)
    .maybeSingle();

  if (error) throw error;
  if (!data || !data.reports_to) return null;
  return { id: String(data.id), employeeId: String(data.id), supervisorId: String(data.reports_to), hierarchyLevel: Number(data.hierarchy_level ?? 1), departmentId: String(data.department ?? ""), createdAt: String(data.created_at ?? "") };
}

export async function upsertEmployeeHierarchy(input: EmployeeHierarchyInput): Promise<EmployeeHierarchyRecord> {
  validateEmployeeHierarchyInput(input);
  if (!isValidUUID(input.employeeId) || !isValidUUID(input.supervisorId)) throw new Error("Valid employee IDs are required");

  const { data, error } = await supabase.from("profiles").update({
    reports_to: input.supervisorId,
    hierarchy_level: input.hierarchyLevel,
    department: input.departmentId.trim(),
  }).eq("id", input.employeeId).select("*").single();

  if (error) throw error;
  return { id: String(data.id), employeeId: String(data.id), supervisorId: String(data.reports_to), hierarchyLevel: Number(data.hierarchy_level ?? 1), departmentId: String(data.department ?? ""), createdAt: String(data.created_at ?? "") };
}

export async function assignSupervisor(employeeId: string, supervisorId: string): Promise<EmployeeHierarchyRecord> {
  if (!isValidUUID(employeeId) || !isValidUUID(supervisorId)) throw new Error("Valid employee and supervisor IDs are required");
  if (employeeId === supervisorId) throw new Error("An employee cannot report to themselves");

  const { error } = await supabase.from("profiles").update({ reports_to: supervisorId }).eq("id", employeeId);
  if (error) throw error;

  const saved = await getEmployeeHierarchyForEmployee(employeeId);
  if (!saved) throw new Error("Reporting relationship was not returned");
  return saved;
}

export async function deleteEmployeeHierarchy(employeeId: string): Promise<void> {
  if (!isValidUUID(employeeId)) throw new Error("A valid employee ID is required");
  const { error } = await supabase.from("profiles").update({ reports_to: null }).eq("id", employeeId);

  if (error) throw error;
}
