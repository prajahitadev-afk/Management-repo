import { supabase } from "../lib/supabase";
import { inDashboardScope, resolveDashboardScope } from "./dashboard-scope.service";
import { getSubordinates } from "./hierarchy.service";

export interface ManufacturingBatch {
  id: string;
  batch_number: string;
  product_id: string | null;
  product_name: string | null;
  target_quantity: number;
  status: string;
  start_date: string | null;
  end_date: string | null;
  manager_id: string;
  supervisor_id: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ManufacturingOutput {
  id: string;
  batch_id: string;
  worker_id: string;
  production_date: string;
  quantity_produced: number;
  remarks: string | null;
  [key: string]: unknown;
}

export interface ManufacturingDefect {
  id: string;
  batch_id: string;
  worker_id: string;
  defect_type: string;
  quantity: number;
  severity: "Low" | "Medium" | "High" | "Critical";
  description: string | null;
  status: "Open" | "Reviewed" | "Resolved";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  [key: string]: unknown;
}

export interface ManufacturingWorkingHours {
  id: string;
  worker_id: string;
  batch_id: string;
  work_date: string;
  hours_worked: number;
  overtime_hours: number;
  remarks: string | null;
  created_at: string;
  [key: string]: unknown;
}

export interface ManufacturingTarget {
  id: string;
  manager_id: string;
  target_name: string;
  target_period: string;
  target_quantity: number;
  actual_quantity: number;
  period_start: string;
  period_end: string;
  status: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ManufacturingResult<T> {
  data: T | null;
  error: Error | null;
}

export interface CreateBatchInput {
  batch_number: string;
  product_id?: string | null;
  product_name?: string | null;
  target_quantity: number;
  status?: string;
  start_date?: string | null;
  end_date?: string | null;
  manager_id: string;
  supervisor_id?: string | null;
}

export interface CreateOutputInput {
  batch_id: string;
  worker_id: string;
  production_date: string;
  quantity_produced: number;
  remarks?: string | null;
}

export interface CreateDefectInput {
  batch_id: string;
  worker_id: string;
  defect_type: string;
  quantity: number;
  severity?: "Low" | "Medium" | "High" | "Critical";
  description?: string | null;
}

export interface CreateWorkingHoursInput {
  worker_id: string;
  batch_id: string;
  work_date: string;
  hours_worked: number;
  overtime_hours?: number;
  remarks?: string | null;
}

export interface CreateTargetInput {
  manager_id: string;
  target_quantity: number;
  period_start: string;
  period_end: string;
}

export interface TargetVsActual {
  target_quantity: number;
  actual_quantity: number;
  variance: number;
  achievement_percentage: number;
}

export interface SupervisorDashboard {
  team_output: number;
  team_defects: number;
  quality_percentage: number;
  hours_logged: number;
  active_batches: number;
}

export interface ManagerDashboard {
  targets: number;
  actuals: number;
  variance: number;
  achievement_percentage: number;
}

export interface CMDashboard {
  manager_performance: number;
  department_output: number;
  quality_score: number;
  target_achievement: number;
}

export interface GMDashboard {
  department_output: number;
  total_hours: number;
  quality_score: number;
  defect_rate: number;
}

export interface MDManufacturingDashboard {
  annual_output: number;
  annual_targets: number;
  achievement_percentage: number;
  quality_trend: number;
  production_forecast: number;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error ?? "Manufacturing request failed"));
}

function invalid(message: string): ManufacturingResult<never> {
  return { data: null, error: new Error(message) };
}

function requireId(value: string | undefined, label: string): Error | null {
  return value?.trim() ? null : new Error(`${label} is required`);
}

function numberValue(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function dateValue(row: Record<string, unknown>): string {
  return String(row.production_date ?? row.attendance_date ?? row.work_date ?? row.created_at ?? "").slice(0, 10);
}

function isCurrentYear(value: string | null | undefined): boolean {
  return Boolean(value) && value!.slice(0, 4) === String(new Date().getFullYear());
}

async function readTable<T>(table: string): Promise<ManufacturingResult<T[]>> {
  try {
    const { data, error } = await supabase.from(table).select("*");
    if (error) return { data: null, error: asError(error) };
    return { data: (data ?? []) as T[], error: null };
  } catch (error) {
    return { data: null, error: asError(error) };
  }
}

async function readOne<T>(table: string, id: string): Promise<ManufacturingResult<T>> {
  try {
    const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
    if (error) return { data: null, error: asError(error) };
    return { data: (data as T | null) ?? null, error: null };
  } catch (error) {
    return { data: null, error: asError(error) };
  }
}

async function insertOne<T>(table: string, payload: Record<string, unknown>): Promise<ManufacturingResult<T>> {
  try {
    const { data, error } = await supabase.from(table).insert(payload).select("*").single();
    if (error) return { data: null, error: asError(error) };
    return { data: data as T, error: null };
  } catch (error) {
    return { data: null, error: asError(error) };
  }
}

async function updateOne<T>(table: string, id: string, updates: Record<string, unknown>): Promise<ManufacturingResult<T>> {
  try {
    const { data, error } = await supabase.from(table).update(updates).eq("id", id).select("*").single();
    if (error) return { data: null, error: asError(error) };
    return { data: data as T, error: null };
  } catch (error) {
    return { data: null, error: asError(error) };
  }
}

function mapBatch(row: Record<string, unknown>): ManufacturingBatch {
  return {
    ...row,
    id: String(row.id ?? ""),
    batch_number: String(row.batch_code ?? ""),
    product_id: null,
    product_name: String(row.product_name ?? ""),
    target_quantity: numberValue(row.planned_quantity),
    status: String(row.status ?? "Planned"),
    start_date: row.start_date == null ? null : String(row.start_date),
    end_date: row.end_date == null ? null : String(row.end_date),
    manager_id: String(row.created_by ?? ""),
    supervisor_id: row.assigned_supervisor == null ? null : String(row.assigned_supervisor),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function getBatches(): Promise<ManufacturingResult<ManufacturingBatch[]>> {
  try {
    const { data, error } = await supabase.rpc("list_manufacturing_batches");
    return error ? { data: null, error: asError(error) } : { data: (data ?? []).map((row) => mapBatch(row as Record<string, unknown>)), error: null };
  } catch (error) { return { data: null, error: asError(error) }; }
}

export async function getBatchById(batchId: string): Promise<ManufacturingResult<ManufacturingBatch>> {
  const error = requireId(batchId, "Batch ID");
  if (error) return invalid(error.message);
  try {
    const { data, error: queryError } = await supabase.from("manufacturing_batches").select("*").eq("id", batchId).maybeSingle();
    return queryError ? { data: null, error: asError(queryError) } : { data: data ? mapBatch(data as Record<string, unknown>) : null, error: null };
  } catch (queryError) { return { data: null, error: asError(queryError) }; }
}

export async function createBatch(batchData: CreateBatchInput): Promise<ManufacturingResult<ManufacturingBatch>> {
  if (!batchData.batch_number.trim() || !batchData.product_name?.trim()) return invalid("Batch number and product name are required");
  if (!batchData.manager_id.trim()) return invalid("Manager ID is required");
  if (!Number.isInteger(batchData.target_quantity) || batchData.target_quantity <= 0) return invalid("Target quantity must be a positive whole number");
  try {
    const { data, error } = await supabase.rpc("create_manufacturing_batch", {
      p_batch_code: batchData.batch_number.trim(),
      p_product_name: batchData.product_name.trim(),
      p_planned_quantity: batchData.target_quantity,
      p_start_date: batchData.start_date ?? null,
      p_end_date: batchData.end_date ?? null,
      p_assigned_supervisor: batchData.supervisor_id ?? null,
    });
    return error ? { data: null, error: asError(error) } : { data: data ? mapBatch(data as Record<string, unknown>) : null, error: data ? null : new Error("Batch was not created") };
  } catch (error) { return { data: null, error: asError(error) }; }
}

export async function updateBatch(batchId: string, updates: Partial<ManufacturingBatch>): Promise<ManufacturingResult<ManufacturingBatch>> {
  const error = requireId(batchId, "Batch ID");
  if (error) return invalid(error.message);
  try {
    const { data, error: queryError } = await supabase.rpc("update_manufacturing_batch", {
      p_batch_id: batchId,
      p_status: updates.status ?? null,
      p_start_date: updates.start_date ?? null,
      p_end_date: updates.end_date ?? null,
      p_assigned_supervisor: updates.supervisor_id ?? null,
    });
    return queryError ? { data: null, error: asError(queryError) } : { data: data ? mapBatch(data as Record<string, unknown>) : null, error: data ? null : new Error("Batch was not updated") };
  } catch (queryError) { return { data: null, error: asError(queryError) }; }
}

export async function getActiveBatches(): Promise<ManufacturingResult<ManufacturingBatch[]>> {
  const batches = await getBatches();
  return batches.error || !batches.data ? batches : { data: batches.data.filter((batch) => !["Completed", "Cancelled"].includes(batch.status)), error: null };
}

export async function getCompletedBatches(): Promise<ManufacturingResult<ManufacturingBatch[]>> {
  const batches = await getBatches();
  return batches.error || !batches.data ? batches : { data: batches.data.filter((batch) => batch.status === "Completed"), error: null };
}

export async function getOutputs(): Promise<ManufacturingResult<ManufacturingOutput[]>> { return readTable<ManufacturingOutput>("manufacturing_outputs"); }

export async function getOutputsByWorker(workerId: string): Promise<ManufacturingResult<ManufacturingOutput[]>> {
  const error = requireId(workerId, "Worker ID");
  if (error) return invalid(error.message);
  try { const { data, error: queryError } = await supabase.from("manufacturing_outputs").select("*").eq("worker_id", workerId); return queryError ? { data: null, error: asError(queryError) } : { data: (data ?? []) as ManufacturingOutput[], error: null }; } catch (queryError) { return { data: null, error: asError(queryError) }; }
}

export async function getOutputsByBatch(batchId: string): Promise<ManufacturingResult<ManufacturingOutput[]>> {
  const error = requireId(batchId, "Batch ID");
  if (error) return invalid(error.message);
  try { const { data, error: queryError } = await supabase.from("manufacturing_outputs").select("*").eq("batch_id", batchId); return queryError ? { data: null, error: asError(queryError) } : { data: (data ?? []) as ManufacturingOutput[], error: null }; } catch (queryError) { return { data: null, error: asError(queryError) }; }
}

export async function recordOutput(data: CreateOutputInput): Promise<ManufacturingResult<ManufacturingOutput>> {
  if (!data.batch_id?.trim() || !data.worker_id.trim()) return invalid("Batch ID and worker ID are required");
  if (!data.production_date || !Number.isInteger(data.quantity_produced) || data.quantity_produced <= 0) return invalid("Production date and a positive whole-number quantity are required");
  try {
    const { data: row, error } = await supabase.rpc("record_manufacturing_output", {
      p_batch_id: data.batch_id,
      p_worker_id: data.worker_id,
      p_quantity: data.quantity_produced,
      p_production_date: data.production_date,
      p_remarks: data.remarks?.trim() || null,
    });
    return error ? { data: null, error: asError(error) } : { data: row as ManufacturingOutput, error: row ? null : new Error("Production output was not recorded") };
  } catch (error) { return { data: null, error: asError(error) }; }
}

export async function getWorkerProductionSummary(workerId: string): Promise<ManufacturingResult<{ total_soaps_produced: number; average_daily_production: number; batches_worked: number }>> {
  const outputs = await getOutputsByWorker(workerId);
  if (outputs.error || !outputs.data) return { data: null, error: outputs.error };
  const rows = outputs.data as ManufacturingOutput[];
  const byDay = new Map<string, number>();
  rows.forEach((row) => byDay.set(dateValue(row), (byDay.get(dateValue(row)) ?? 0) + numberValue(row.quantity_produced)));
  const total = rows.reduce((sum, row) => sum + numberValue(row.quantity_produced), 0);
  return { data: { total_soaps_produced: total, average_daily_production: byDay.size ? total / byDay.size : 0, batches_worked: new Set(rows.map((row) => row.batch_id)).size }, error: null };
}

function mapDefect(row: Record<string, unknown>): ManufacturingDefect {
  return {
    ...row,
    id: String(row.id ?? ""),
    batch_id: String(row.batch_id ?? ""),
    worker_id: String(row.worker_id ?? ""),
    defect_type: String(row.defect_type ?? ""),
    quantity: numberValue(row.defect_quantity),
    severity: (row.severity ?? "Medium") as ManufacturingDefect["severity"],
    description: row.description == null ? null : String(row.description),
    status: (row.status ?? "Open") as ManufacturingDefect["status"],
    reviewed_by: row.reviewed_by == null ? null : String(row.reviewed_by),
    reviewed_at: row.reviewed_at == null ? null : String(row.reviewed_at),
    created_at: String(row.reported_at ?? ""),
  };
}

async function readDefects(filters: { workerId?: string; batchId?: string } = {}): Promise<ManufacturingResult<ManufacturingDefect[]>> {
  try {
    let query = supabase.from("manufacturing_defects").select("*").order("reported_at", { ascending: false });
    if (filters.workerId) query = query.eq("worker_id", filters.workerId);
    if (filters.batchId) query = query.eq("batch_id", filters.batchId);
    const { data, error } = await query;
    if (error) return { data: null, error: asError(error) };
    return { data: (data ?? []).map((row) => mapDefect(row as Record<string, unknown>)), error: null };
  } catch (error) {
    return { data: null, error: asError(error) };
  }
}

export async function getDefects(): Promise<ManufacturingResult<ManufacturingDefect[]>> {
  return readDefects();
}

export async function getDefectsByWorker(workerId: string): Promise<ManufacturingResult<ManufacturingDefect[]>> {
  const error = requireId(workerId, "Worker ID");
  return error ? invalid(error.message) : readDefects({ workerId });
}

export async function getDefectsByBatch(batchId: string): Promise<ManufacturingResult<ManufacturingDefect[]>> {
  const error = requireId(batchId, "Batch ID");
  return error ? invalid(error.message) : readDefects({ batchId });
}

export async function recordDefect(data: CreateDefectInput): Promise<ManufacturingResult<ManufacturingDefect>> {
  if (!data.batch_id.trim() || !data.worker_id.trim() || !data.defect_type.trim()) return invalid("Batch ID, worker ID, and defect type are required");
  if (!Number.isInteger(data.quantity) || data.quantity <= 0) return invalid("Defect quantity must be a positive whole number");
  try {
    const { data: row, error } = await supabase.rpc("record_manufacturing_defect", {
      p_batch_id: data.batch_id,
      p_worker_id: data.worker_id,
      p_defect_type: data.defect_type.trim(),
      p_quantity: data.quantity,
      p_severity: data.severity ?? "Medium",
      p_description: data.description?.trim() || null,
    });
    if (error) return { data: null, error: asError(error) };
    return { data: row ? mapDefect(row as Record<string, unknown>) : null, error: row ? null : new Error("Defect report was not created") };
  } catch (error) {
    return { data: null, error: asError(error) };
  }
}

export async function reviewDefect(defectId: string, reviewerId: string): Promise<ManufacturingResult<ManufacturingDefect>> {
  if (requireId(defectId, "Defect ID") || requireId(reviewerId, "Reviewer ID")) return invalid("Defect ID and reviewer ID are required");
  try {
    const { data: row, error } = await supabase.rpc("review_manufacturing_defect", { p_defect_id: defectId });
    if (error) return { data: null, error: asError(error) };
    return { data: row ? mapDefect(row as Record<string, unknown>) : null, error: row ? null : new Error("Defect was not reviewed") };
  } catch (error) {
    return { data: null, error: asError(error) };
  }
}

async function readWorkingHours(workerId?: string): Promise<ManufacturingResult<ManufacturingWorkingHours[]>> {
  try {
    let query = supabase.from("manufacturing_working_hours").select("*").order("work_date", { ascending: false });
    if (workerId) query = query.eq("worker_id", workerId);
    const { data, error } = await query;
    return error ? { data: null, error: asError(error) } : { data: (data ?? []) as ManufacturingWorkingHours[], error: null };
  } catch (error) { return { data: null, error: asError(error) }; }
}

export async function getWorkingHours(): Promise<ManufacturingResult<ManufacturingWorkingHours[]>> { return readWorkingHours(); }

export async function getHoursByWorker(workerId: string): Promise<ManufacturingResult<ManufacturingWorkingHours[]>> {
  const error = requireId(workerId, "Worker ID");
  return error ? invalid(error.message) : readWorkingHours(workerId);
}

export async function recordWorkingHours(data: CreateWorkingHoursInput): Promise<ManufacturingResult<ManufacturingWorkingHours>> {
  if (!data.worker_id.trim() || !data.batch_id?.trim() || !data.work_date) return invalid("Worker ID, batch, and work date are required");
  if (!Number.isFinite(data.hours_worked) || data.hours_worked <= 0 || !Number.isFinite(data.overtime_hours ?? 0) || (data.overtime_hours ?? 0) < 0 || (data.overtime_hours ?? 0) > data.hours_worked) return invalid("Hours must be positive and overtime cannot exceed total hours");
  try {
    const { data: row, error } = await supabase.rpc("record_manufacturing_working_hours", {
      p_batch_id: data.batch_id,
      p_worker_id: data.worker_id,
      p_work_date: data.work_date,
      p_hours_worked: data.hours_worked,
      p_overtime_hours: data.overtime_hours ?? 0,
      p_remarks: data.remarks?.trim() || null,
    });
    return error ? { data: null, error: asError(error) } : { data: row as ManufacturingWorkingHours, error: row ? null : new Error("Working hours were not recorded") };
  } catch (error) { return { data: null, error: asError(error) }; }
}

export async function getWorkerHoursSummary(workerId: string): Promise<ManufacturingResult<{ total_hours: number; overtime_hours: number; average_daily_hours: number }>> {
  const hours = await getHoursByWorker(workerId);
  if (hours.error || !hours.data) return { data: null, error: hours.error };
  const rows = hours.data as ManufacturingWorkingHours[];
  const days = new Set(rows.map((row) => dateValue(row))).size;
  const total = rows.reduce((sum, row) => sum + numberValue(row.hours_worked), 0);
  return { data: { total_hours: total, overtime_hours: rows.reduce((sum, row) => sum + numberValue(row.overtime_hours), 0), average_daily_hours: days ? total / days : 0 }, error: null };
}

function mapTarget(row: Record<string, unknown>): ManufacturingTarget {
  return {
    ...row,
    id: String(row.id ?? ""),
    manager_id: String(row.manager_id ?? ""),
    target_name: String(row.target_name ?? ""),
    target_period: String(row.target_period ?? ""),
    target_quantity: numberValue(row.target_quantity),
    actual_quantity: numberValue(row.actual_quantity),
    period_start: String(row.start_date ?? ""),
    period_end: String(row.end_date ?? ""),
    status: String(row.status ?? "Active"),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

async function readTargets(managerId?: string): Promise<ManufacturingResult<ManufacturingTarget[]>> {
  try {
    let query = supabase.from("manufacturing_targets").select("*").order("created_at", { ascending: false });
    if (managerId) query = query.eq("manager_id", managerId);
    const { data, error } = await query;
    return error ? { data: null, error: asError(error) } : { data: (data ?? []).map((row) => mapTarget(row as Record<string, unknown>)), error: null };
  } catch (error) { return { data: null, error: asError(error) }; }
}

export async function getTargets(): Promise<ManufacturingResult<ManufacturingTarget[]>> { return readTargets(); }

export async function getTargetByManager(managerId: string): Promise<ManufacturingResult<ManufacturingTarget[]>> {
  const error = requireId(managerId, "Manager ID");
  return error ? invalid(error.message) : readTargets(managerId);
}

export async function createTarget(data: CreateTargetInput): Promise<ManufacturingResult<ManufacturingTarget>> {
  if (!data.manager_id.trim() || !data.period_start || !data.period_end) return invalid("Manager ID and target period are required");
  if (!Number.isInteger(data.target_quantity) || data.target_quantity <= 0) return invalid("Target quantity must be a positive whole number");
  try {
    const { data: row, error } = await supabase.rpc("create_manufacturing_target", {
      p_target_quantity: data.target_quantity,
      p_period_start: data.period_start,
      p_period_end: data.period_end,
    });
    return error ? { data: null, error: asError(error) } : { data: row ? mapTarget(row as Record<string, unknown>) : null, error: row ? null : new Error("Manufacturing target was not created") };
  } catch (error) { return { data: null, error: asError(error) }; }
}

export async function updateTarget(targetId: string, updates: Partial<ManufacturingTarget>): Promise<ManufacturingResult<ManufacturingTarget>> {
  const error = requireId(targetId, "Target ID");
  if (error) return invalid(error.message);
  try {
    const { data, error: queryError } = await supabase.rpc("update_manufacturing_target", {
      p_target_id: targetId,
      p_target_quantity: updates.target_quantity ?? null,
      p_status: updates.status ?? null,
      p_period_start: updates.period_start ?? null,
      p_period_end: updates.period_end ?? null,
    });
    return queryError ? { data: null, error: asError(queryError) } : { data: data ? mapTarget(data as Record<string, unknown>) : null, error: data ? null : new Error("Manufacturing target was not updated") };
  } catch (queryError) { return { data: null, error: asError(queryError) }; }
}

export async function calculateTargetVsActual(managerId: string, department?: string | null): Promise<ManufacturingResult<TargetVsActual>> {
  const scope = await resolveDashboardScope(managerId, "Manager", department);
  const targets = await getTargetByManager(managerId);
  if (targets.error || !targets.data) return { data: null, error: targets.error };
  const outputs = await getOutputs();
  if (outputs.error || !outputs.data) return { data: null, error: outputs.error };
  const targetQuantity = targets.data.reduce((sum, row) => sum + numberValue(row.target_quantity), 0);
  const actualQuantity = outputs.data.filter((row) => inDashboardScope(scope, row.worker_id)).reduce((sum, row) => sum + numberValue(row.quantity_produced), 0);
  return { data: { target_quantity: targetQuantity, actual_quantity: actualQuantity, variance: actualQuantity - targetQuantity, achievement_percentage: targetQuantity ? (actualQuantity / targetQuantity) * 100 : 0 }, error: null };
}

async function getTeamIds(supervisorId: string): Promise<ManufacturingResult<string[]>> {
  try {
    const subordinates = await getSubordinates(supervisorId);
    return { data: [supervisorId, ...subordinates], error: null };
  } catch (error) { return { data: null, error: asError(error) }; }
}

export async function getSupervisorDashboard(supervisorId: string, department?: string | null): Promise<ManufacturingResult<SupervisorDashboard>> {
  const scope = await resolveDashboardScope(supervisorId, "Supervisor", department);
  const ids = await getTeamIds(supervisorId);
  if (ids.error || !ids.data) return { data: null, error: ids.error };
  const [outputs, defects, hours, batches] = await Promise.all([getOutputs(), getDefects(), getWorkingHours(), getActiveBatches()]);
  const failure = [outputs, defects, hours, batches].find((result) => result.error);
  if (failure?.error) return { data: null, error: failure.error };
  const teamOutput = outputs.data!.filter((row) => inDashboardScope(scope, row.worker_id)).reduce((sum, row) => sum + numberValue(row.quantity_produced), 0);
  const teamDefects = defects.data!.filter((row) => inDashboardScope(scope, row.worker_id)).reduce((sum, row) => sum + numberValue(row.quantity), 0);
  const teamHours = hours.data!.filter((row) => inDashboardScope(scope, row.worker_id)).reduce((sum, row) => sum + numberValue(row.hours_worked), 0);
  const teamBatches = batches.data!.filter((row) => inDashboardScope(scope, row.supervisor_id ?? row.manager_id));
  return { data: { team_output: teamOutput, team_defects: teamDefects, quality_percentage: teamOutput ? Math.max(0, ((teamOutput - teamDefects) / teamOutput) * 100) : 0, hours_logged: teamHours, active_batches: teamBatches.length }, error: null };
}

export async function getManagerDashboard(managerId: string, department?: string | null): Promise<ManufacturingResult<ManagerDashboard>> {
  const result = await calculateTargetVsActual(managerId, department);
  return result.error || !result.data ? { data: null, error: result.error } : { data: { targets: result.data.target_quantity, actuals: result.data.actual_quantity, variance: result.data.variance, achievement_percentage: result.data.achievement_percentage }, error: null };
}

export async function getCMDashboard(department?: string | null): Promise<ManufacturingResult<CMDashboard>> {
  const scope = await resolveDashboardScope("", "Chief Manager", department);
  const [outputs, defects, targets] = await Promise.all([getOutputs(), getDefects(), getTargets()]);
  const failure = [outputs, defects, targets].find((result) => result.error);
  if (failure?.error) return { data: null, error: failure.error };
  const output = outputs.data!.filter((row) => inDashboardScope(scope, row.worker_id)).reduce((sum, row) => sum + numberValue(row.quantity_produced), 0);
  const defect = defects.data!.filter((row) => inDashboardScope(scope, row.worker_id)).reduce((sum, row) => sum + numberValue(row.quantity), 0);
  const target = targets.data!.filter((row) => inDashboardScope(scope, row.manager_id)).reduce((sum, row) => sum + numberValue(row.target_quantity), 0);
  return { data: { manager_performance: target ? (output / target) * 100 : 0, department_output: output, quality_score: output ? Math.max(0, ((output - defect) / output) * 100) : 0, target_achievement: target ? (output / target) * 100 : 0 }, error: null };
}

export async function getGMDashboard(department?: string | null): Promise<ManufacturingResult<GMDashboard>> {
  const scope = await resolveDashboardScope("", "General Manager", department);
  const [outputs, defects, hours] = await Promise.all([getOutputs(), getDefects(), getWorkingHours()]);
  const failure = [outputs, defects, hours].find((result) => result.error);
  if (failure?.error) return { data: null, error: failure.error };
  const annualOutputs = outputs.data!.filter((row) => inDashboardScope(scope, row.worker_id) && isCurrentYear(row.production_date));
  const annualDefects = defects.data!.filter((row) => inDashboardScope(scope, row.worker_id) && isCurrentYear(row.created_at));
  const annualHours = hours.data!.filter((row) => inDashboardScope(scope, row.worker_id) && isCurrentYear(row.work_date));
  const output = annualOutputs.reduce((sum, row) => sum + numberValue(row.quantity_produced), 0);
  const defect = annualDefects.reduce((sum, row) => sum + numberValue(row.quantity), 0);
  return { data: { department_output: output, total_hours: annualHours.reduce((sum, row) => sum + numberValue(row.hours_worked), 0), quality_score: output ? Math.max(0, ((output - defect) / output) * 100) : 0, defect_rate: output ? (defect / output) * 100 : 0 }, error: null };
}

export async function getMDManufacturingDashboard(department?: string | null): Promise<ManufacturingResult<MDManufacturingDashboard>> {
  const scope = await resolveDashboardScope("", "Managing Director", department);
  const [outputs, targets, defects] = await Promise.all([getOutputs(), getTargets(), getDefects()]);
  const failure = [outputs, targets, defects].find((result) => result.error);
  if (failure?.error) return { data: null, error: failure.error };
  const annualOutputs = outputs.data!.filter((row) => isCurrentYear(row.production_date) && inDashboardScope(scope, row.worker_id));
  const annualTargets = targets.data!.filter((row) => (isCurrentYear(row.period_start) || isCurrentYear(row.period_end)) && inDashboardScope(scope, row.manager_id));
  const annualDefects = defects.data!.filter((row) => isCurrentYear(row.created_at) && inDashboardScope(scope, row.worker_id));
  const output = annualOutputs.reduce((sum, row) => sum + numberValue(row.quantity_produced), 0);
  const target = annualTargets.reduce((sum, row) => sum + numberValue(row.target_quantity), 0);
  const defect = annualDefects.reduce((sum, row) => sum + numberValue(row.quantity), 0);
  return { data: { annual_output: output, annual_targets: target, achievement_percentage: target ? (output / target) * 100 : 0, quality_trend: output ? Math.max(0, ((output - defect) / output) * 100) : 0, production_forecast: output }, error: null };
}
