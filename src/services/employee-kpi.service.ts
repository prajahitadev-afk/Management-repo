import { supabase } from "../lib/supabase";
import type { EmployeeKpi, EmployeeKpiAssignment } from "../types/employee-kpi.types";
import { getVisibleProfilesForUser } from "./hierarchy.service";

function toKpi(row: Record<string, unknown>): EmployeeKpi {
  return {
    id: String(row.id), employeeId: String(row.employee_id),
    metricName: String(row.metric_name), targetValue: Number(row.target_value), achievedValue: Number(row.achieved_value),
    reviewMonth: Number(row.review_month), reviewYear: Number(row.review_year),
    status: Number(row.target_value) > 0 && Number(row.achieved_value) >= Number(row.target_value) ? "Completed" : "In Progress",
    createdAt: String(row.created_at),
  };
}

export function validateKpiAssignment(input: EmployeeKpiAssignment): void {
  if (!input.employeeId.trim()) throw new Error("Employee is required");
  if (!input.metricName.trim()) throw new Error("Metric name is required");
  if (!Number.isFinite(input.targetValue) || input.targetValue < 0) throw new Error("Target value must be zero or greater");
  if (!Number.isInteger(input.reviewMonth) || input.reviewMonth < 1 || input.reviewMonth > 12) throw new Error("Review month is invalid");
  if (!Number.isInteger(input.reviewYear) || input.reviewYear < 2000) throw new Error("Review year is invalid");
}

export async function getEmployeeKpis(employeeId?: string): Promise<EmployeeKpi[]> {
  let query = supabase.from("employee_kpis").select("*").order("review_year", { ascending: false }).order("review_month", { ascending: false });
  if (employeeId) query = query.eq("employee_id", employeeId);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(toKpi);
}

export async function getDashboardKpis(userId: string, role: string, department?: string): Promise<EmployeeKpi[]> {
  const all = await getEmployeeKpis();
  if (role === "Worker") return all.filter((kpi) => kpi.employeeId === userId);
  if (role === "Supervisor" || role === "Manager" || role === "Chief Manager") {
    const profiles = await getVisibleProfilesForUser(userId, role, department);
    const ids = new Set(profiles.map((profile) => profile.id));
    return all.filter((kpi) => ids.has(kpi.employeeId));
  }
  if (role === "General Manager") return department ? filterKpisByDepartment(all, department) : all;
  return all;
}

async function filterKpisByDepartment(kpis: EmployeeKpi[], department: string): Promise<EmployeeKpi[]> {
  const { data, error } = await supabase.from("profiles").select("id").eq("department", department);
  if (error) throw error;
  const ids = new Set((data ?? []).map((row) => row.id as string));
  return kpis.filter((kpi) => ids.has(kpi.employeeId));
}

export async function assignEmployeeKpi(input: EmployeeKpiAssignment): Promise<string> {
  validateKpiAssignment(input);
  const { data, error } = await supabase.rpc("assign_employee_kpi", {
    p_employee_id: input.employeeId, p_metric_name: input.metricName.trim(), p_target_value: input.targetValue,
    p_review_month: input.reviewMonth, p_review_year: input.reviewYear,
  });
  if (error) throw error;
  return String(data);
}

export async function updateEmployeeKpiProgress(kpiId: string, achievedValue: number): Promise<string> {
  if (!kpiId.trim() || !Number.isFinite(achievedValue) || achievedValue < 0) throw new Error("Invalid KPI progress");
  const { data, error } = await supabase.rpc("update_employee_kpi_progress", { p_kpi_id: kpiId, p_achieved_value: achievedValue });
  if (error) throw error;
  return String(data);
}

export async function reviewEmployeeKpi(kpiId: string, decision: "Approved" | "Rejected", comment?: string): Promise<string> {
  const { data, error } = await supabase.rpc("review_employee_kpi", { p_kpi_id: kpiId, p_decision: decision, p_comment: comment ?? null });
  if (error) throw error;
  return String(data);
}

export function getKpiProgress(kpi: EmployeeKpi): number {
  if (kpi.targetValue <= 0) return 0;
  return Math.min(100, Math.round((kpi.achievedValue / kpi.targetValue) * 100));
}

export interface EmployeeKpiReport {
  total: number;
  averageProgress: number;
  approved: number;
  pending: number;
  rejected: number;
}

export function buildEmployeeKpiReport(kpis: EmployeeKpi[]): EmployeeKpiReport {
  return {
    total: kpis.length,
    averageProgress: kpis.length ? Math.round(kpis.reduce((sum, kpi) => sum + getKpiProgress(kpi), 0) / kpis.length) : 0,
    approved: kpis.filter((kpi) => kpi.status === "Completed").length,
    pending: kpis.filter((kpi) => kpi.status === "In Progress").length,
    rejected: 0,
  };
}
