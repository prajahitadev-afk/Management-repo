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
  batch_id: string | null;
  work_date: string;
  hours_worked: number;
  overtime_hours: number;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ManufacturingTarget {
  id: string;
  manager_id: string;
  target_quantity: number;
  period_start: string;
  period_end: string;
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
  batch_id?: string | null;
  work_date: string;
  hours_worked: number;
  overtime_hours?: number;
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

export async function getBatches(): Promise<ManufacturingResult<ManufacturingBatch[]>> {
  return readTable<ManufacturingBatch>("manufacturing_batches");
}

export async function getBatchById(batchId: string): Promise<ManufacturingResult<ManufacturingBatch>> {
  const error = requireId(batchId, "Batch ID");
  return error ? invalid(error.message) : readOne<ManufacturingBatch>("manufacturing_batches", batchId);
}

export async function createBatch(batchData: CreateBatchInput): Promise<ManufacturingResult<ManufacturingBatch>> {
  if (!batchData.batch_number.trim()) return invalid("Batch number is required");
  if (!batchData.manager_id.trim()) return invalid("Manager ID is required");
  if (!Number.isFinite(batchData.target_quantity) || batchData.target_quantity <= 0) return invalid("Target quantity must be greater than zero");
  return insertOne<ManufacturingBatch>("manufacturing_batches", { ...batchData, status: batchData.status ?? "Planned", product_id: batchData.product_id ?? null, product_name: batchData.product_name ?? null, start_date: batchData.start_date ?? null, end_date: batchData.end_date ?? null, supervisor_id: batchData.supervisor_id ?? null });
}

export async function updateBatch(batchId: string, updates: Partial<ManufacturingBatch>): Promise<ManufacturingResult<ManufacturingBatch>> {
  const error = requireId(batchId, "Batch ID");
  if (error) return invalid(error.message);
  const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...safeUpdates } = updates;
  return updateOne<ManufacturingBatch>("manufacturing_batches", batchId, safeUpdates);
}

export async function getActiveBatches(): Promise<ManufacturingResult<ManufacturingBatch[]>> {
  try {
    const { data, error } = await supabase.from("manufacturing_batches").select("*").not("status", "in", "(Completed,Cancelled)");
    if (error) return { data: null, error: asError(error) };
    return { data: (data ?? []) as ManufacturingBatch[], error: null };
  } catch (error) { return { data: null, error: asError(error) }; }
}

export async function getCompletedBatches(): Promise<ManufacturingResult<ManufacturingBatch[]>> {
  try {
    const { data, error } = await supabase.from("manufacturing_batches").select("*").eq("status", "Completed");
    if (error) return { data: null, error: asError(error) };
    return { data: (data ?? []) as ManufacturingBatch[], error: null };
  } catch (error) { return { data: null, error: asError(error) }; }
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
  if (!data.worker_id.trim()) return invalid("Worker ID is required");
  if (!data.production_date || !Number.isFinite(data.quantity_produced) || data.quantity_produced <= 0) return invalid("Production date and positive quantity are required");
  return insertOne<ManufacturingOutput>("manufacturing_outputs", { ...data, remarks: data.remarks ?? null });
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

function attendanceToHours(row: Record<string, unknown>): ManufacturingWorkingHours {
  const checkIn = Date.parse(String(row.check_in ?? ""));
  const checkOut = Date.parse(String(row.check_out ?? ""));
  const hoursWorked = Number.isFinite(checkIn) && Number.isFinite(checkOut) && checkOut > checkIn ? (checkOut - checkIn) / 3600000 : 0;
  return { id: String(row.id ?? `${row.employee_id}-${row.attendance_date}`), worker_id: String(row.employee_id ?? ""), batch_id: null, work_date: String(row.attendance_date ?? ""), hours_worked: hoursWorked, overtime_hours: 0, created_at: String(row.attendance_date ?? ""), updated_at: String(row.attendance_date ?? "") };
}

async function getAttendanceHours(workerId?: string): Promise<ManufacturingResult<ManufacturingWorkingHours[]>> {
  const query = supabase.from("attendance").select("id, employee_id, attendance_date, check_in, check_out");
  const scopedQuery = workerId ? query.eq("employee_id", workerId) : query;
  const { data, error } = await scopedQuery;
  if (error) return { data: null, error: asError(error) };
  return { data: (data ?? []).map((row) => attendanceToHours(row as Record<string, unknown>)), error: null };
}

export async function getWorkingHours(): Promise<ManufacturingResult<ManufacturingWorkingHours[]>> { return getAttendanceHours(); }

export async function getHoursByWorker(workerId: string): Promise<ManufacturingResult<ManufacturingWorkingHours[]>> {
  const error = requireId(workerId, "Worker ID");
  if (error) return invalid(error.message);
  return getAttendanceHours(workerId);
}

export async function recordWorkingHours(data: CreateWorkingHoursInput): Promise<ManufacturingResult<ManufacturingWorkingHours>> {
  if (!data.worker_id.trim() || !data.work_date) return invalid("Worker ID and work date are required");
  if (!Number.isFinite(data.hours_worked) || data.hours_worked < 0 || !Number.isFinite(data.overtime_hours ?? 0) || (data.overtime_hours ?? 0) < 0) return invalid("Working hours must be zero or greater");
  return invalid("Working hours are derived from attendance records");
}

export async function getWorkerHoursSummary(workerId: string): Promise<ManufacturingResult<{ total_hours: number; overtime_hours: number; average_daily_hours: number }>> {
  const hours = await getHoursByWorker(workerId);
  if (hours.error || !hours.data) return { data: null, error: hours.error };
  const rows = hours.data as ManufacturingWorkingHours[];
  const days = new Set(rows.map((row) => dateValue(row))).size;
  const total = rows.reduce((sum, row) => sum + numberValue(row.hours_worked), 0);
  return { data: { total_hours: total, overtime_hours: rows.reduce((sum, row) => sum + numberValue(row.overtime_hours), 0), average_daily_hours: days ? total / days : 0 }, error: null };
}

export async function getTargets(): Promise<ManufacturingResult<ManufacturingTarget[]>> { return readTable<ManufacturingTarget>("manufacturing_targets"); }

export async function getTargetByManager(managerId: string): Promise<ManufacturingResult<ManufacturingTarget[]>> {
  const error = requireId(managerId, "Manager ID");
  if (error) return invalid(error.message);
  try { const { data, error: queryError } = await supabase.from("manufacturing_targets").select("*").eq("manager_id", managerId); return queryError ? { data: null, error: asError(queryError) } : { data: (data ?? []) as ManufacturingTarget[], error: null }; } catch (queryError) { return { data: null, error: asError(queryError) }; }
}

export async function createTarget(data: CreateTargetInput): Promise<ManufacturingResult<ManufacturingTarget>> {
  if (!data.manager_id.trim() || !data.period_start || !data.period_end) return invalid("Manager ID and target period are required");
  if (!Number.isFinite(data.target_quantity) || data.target_quantity <= 0) return invalid("Target quantity must be greater than zero");
  return insertOne<ManufacturingTarget>("manufacturing_targets", data as unknown as Record<string, unknown>);
}

export async function updateTarget(targetId: string, updates: Partial<ManufacturingTarget>): Promise<ManufacturingResult<ManufacturingTarget>> {
  const error = requireId(targetId, "Target ID");
  if (error) return invalid(error.message);
  const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...safeUpdates } = updates;
  return updateOne<ManufacturingTarget>("manufacturing_targets", targetId, safeUpdates);
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
