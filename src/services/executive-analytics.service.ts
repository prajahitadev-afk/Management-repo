import { supabase } from "../lib/supabase";
import { inDashboardScope, resolveDashboardScope } from "./dashboard-scope.service";
import { getSubordinates } from "./hierarchy.service";

export type ExecutiveAnalyticsRole = "Chief Manager" | "General Manager" | "MD" | "President" | "Vice President" | "Vice Chairman";
export type ExecutiveDepartment = "Manufacturing" | "Marketing" | "Transportation" | "Research";

export interface ExecutiveDepartmentMetric {
  department: ExecutiveDepartment;
  employees: number;
  activeEmployees: number;
  targetAchievement: number;
  productivity: number;
  efficiency: number;
  growth: number;
  completionRate: number;
  riskScore: number;
}

export interface ExecutiveAnalytics {
  role: ExecutiveAnalyticsRole;
  scope: ExecutiveDepartment[];
  departments: ExecutiveDepartmentMetric[];
  trend: Array<{ period: string; performance: number; achievement: number; productivity: number; efficiency: number }>;
}

interface Row { [key: string]: unknown; }
interface QueryResult { data: Row[] | null; error: Error | null; }

const DEPARTMENTS: ExecutiveDepartment[] = ["Manufacturing", "Marketing", "Transportation", "Research"];
const DEPARTMENT_ALIASES: Record<ExecutiveDepartment, string[]> = {
  Manufacturing: ["manufacturing"], Marketing: ["marketing"], Transportation: ["transport", "transportation"], Research: ["research", "research & development", "r&d", "rd"],
};

function asError(error: unknown): Error { return error instanceof Error ? error : new Error(String(error ?? "Executive analytics request failed")); }
function numberValue(value: unknown): number { const result = Number(value ?? 0); return Number.isFinite(result) ? result : 0; }
function textValue(row: Row, ...keys: string[]): string { return String(keys.map((key) => row[key]).find((value) => value !== null && value !== undefined) ?? ""); }
function status(row: Row): string { return textValue(row, "status").toLowerCase(); }
function dateValue(row: Row): string { return textValue(row, "created_at", "production_date", "conversion_date", "trip_date", "attendance_date", "recorded_at", "start_date", "period_start"); }
function isDone(row: Row): boolean {
  if (Object.prototype.hasOwnProperty.call(row, "quantity_produced")) return numberValue(row.quantity_produced) > 0;
  return ["completed", "complete", "closed", "delivered", "successful", "resolved"].includes(status(row));
}
function percent(value: number, total: number): number { return total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0; }
function departmentMatches(value: unknown, department: ExecutiveDepartment): boolean { const normalized = String(value ?? "").trim().toLowerCase(); return Boolean(normalized) && DEPARTMENT_ALIASES[department].includes(normalized); }
function monthKey(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function attendanceHours(row: Row): number {
  const checkIn = Date.parse(String(row.check_in ?? ""));
  const checkOut = Date.parse(String(row.check_out ?? ""));
  return Number.isFinite(checkIn) && Number.isFinite(checkOut) && checkOut > checkIn ? (checkOut - checkIn) / 3600000 : 0;
}

async function read(table: string, columns: string): Promise<QueryResult> {
  try {
    const { data, error } = await supabase.from(table).select(columns);
    return error ? { data: null, error: asError(error) } : { data: (data ?? []) as unknown as Row[], error: null };
  } catch (error) { return { data: null, error: asError(error) }; }
}

function currentAndPrevious(rows: Row[], valueKey: string): { current: number; previous: number } {
  const now = new Date();
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return rows.reduce<{ current: number; previous: number }>((result, row) => {
    const period = dateValue(row).slice(0, 7);
    const value = numberValue(row[valueKey]);
    if (period === monthKey(now)) result.current += value;
    if (period === monthKey(previous)) result.previous += value;
    return result;
  }, { current: 0, previous: 0 });
}

function growth(current: number, previous: number): number { return previous ? ((current - previous) / previous) * 100 : current ? 100 : 0; }

function completedByPeriod(rows: Row[]): { current: number; previous: number } {
  const now = new Date();
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return rows.reduce((result, row) => {
    if (!isDone(row)) return result;
    const period = dateValue(row).slice(0, 7);
    if (period === monthKey(now)) result.current += 1;
    if (period === monthKey(previous)) result.previous += 1;
    return result;
  }, { current: 0, previous: 0 });
}

async function getGMAccess(userId: string, ownDepartment: string | null | undefined, profiles: QueryResult): Promise<{ departments: Set<ExecutiveDepartment>; employeeIds: Set<string> }> {
  const subordinates = await getSubordinates(userId);
  const subordinateIds = new Set<string>([userId, ...subordinates]);
  const departments = new Set<ExecutiveDepartment>();
  (profiles.data ?? []).forEach((row) => {
    if (subordinateIds.has(String(row.id))) DEPARTMENTS.forEach((item) => { if (departmentMatches(row.department, item)) departments.add(item); });
  });
  if (!departments.size) DEPARTMENTS.forEach((item) => { if (departmentMatches(ownDepartment, item)) departments.add(item); });
  return { departments, employeeIds: subordinateIds };
}

export async function getExecutiveAnalytics(role: ExecutiveAnalyticsRole, department?: string | null, userId?: string): Promise<{ data: ExecutiveAnalytics | null; error: Error | null }> {
  const scope = userId ? await resolveDashboardScope(userId, role === "MD" ? "Managing Director" : role, department) : null;
  const profiles = await read("profiles", "id,department,status");
  if (profiles.error) return { data: null, error: profiles.error };
  const scopeDepartments = role === "Chief Manager" || role === "General Manager"
    ? DEPARTMENTS.filter((item) => departmentMatches(department, item))
    : DEPARTMENTS;
  if ((role === "Chief Manager" || role === "General Manager") && !scopeDepartments.length) return { data: { role, scope: [], departments: [], trend: [] }, error: null };
  const [manufacturingOutputs, attendance, manufacturingTargets, leads, conversions, campaigns, marketingTargets, trips, delays, transportTargets, projects, experiments, samples, milestones, researchTargets] = await Promise.all([
    read("manufacturing_outputs", "quantity_produced,production_date,worker_id,remarks"), read("attendance", "employee_id,attendance_date,check_in,check_out,status"), read("manufacturing_targets", "target_quantity,manager_id"),
    read("marketing_leads", "status,created_at,assigned_to"), read("marketing_conversions", "conversion_value,conversion_date,converted_by,campaign_id"), read("marketing_campaigns", "status,manager_id,id"), read("marketing_targets", "target_quantity,actual_quantity,manager_id,start_date,end_date,target_period"), read("transport_trips", "status,trip_date,driver_id"), read("transport_delay_logs", "trip_id,delay_minutes,reason,recorded_at"), read("transport_targets", "target_deliveries,manager_id"),
    read("research_projects", "status,created_at,manager_id"), read("research_experiments", "status,created_at,owner_id"), read("research_samples", "created_at,collected_by"), read("research_milestones", "status,created_at,project_id"), read("research_targets", "target_quantity,manager_id"),
  ]);
  const results = [profiles, attendance, manufacturingOutputs, manufacturingTargets, leads, conversions, campaigns, marketingTargets, trips, delays, transportTargets, projects, experiments, samples, milestones, researchTargets];
  const failure = results.find((result) => result.error);
  if (failure?.error) return { data: null, error: failure.error };

  const all = (result: QueryResult) => result.data ?? [];
  const scoped = (result: QueryResult, keys: string[]) => scope ? all(result).filter((row) => keys.some((key) => inDashboardScope(scope, String(row[key] ?? "")))) : all(result);
  const metrics = scopeDepartments.map((item): ExecutiveDepartmentMetric => {
    const employees = (scope ? all(profiles).filter((row) => inDashboardScope(scope, String(row.id))) : all(profiles)).filter((row) => departmentMatches(row.department, item));
    const activeEmployees = employees.filter((row) => !["inactive", "suspended", "disabled"].includes(status(row))).length;
    let target = 0; let actual = 0; let productivity = 0; let efficiency = 0; let completed = 0; let total = 0; let current = 0; let previous = 0; let riskScore = 0;
    if (item === "Manufacturing") {
      const outputs = scoped(manufacturingOutputs, ["worker_id"]); const hours = scoped(attendance, ["employee_id"]); const targets = scoped(manufacturingTargets, ["manager_id"]);
      const hoursWorked = hours.reduce((sum, row) => sum + attendanceHours(row), 0);
      target = targets.reduce((sum, row) => sum + numberValue(row.target_quantity), 0); actual = outputs.reduce((sum, row) => sum + numberValue(row.quantity_produced), 0);
      productivity = percent(actual, hoursWorked); efficiency = actual > 0 ? 100 : 0; total = outputs.length; completed = outputs.filter(isDone).length;
      ({ current, previous } = currentAndPrevious(outputs, "quantity_produced")); riskScore = 100 - efficiency;
    } else if (item === "Marketing") {
      const marketingLeads = scoped(leads, ["assigned_to"]); const marketingConversions = scoped(conversions, ["converted_by"]); const targets = scoped(marketingTargets, ["manager_id"]);
      target = targets.reduce((sum, row) => sum + numberValue(row.target_quantity), 0); actual = targets.reduce((sum, row) => sum + numberValue(row.actual_quantity), 0); productivity = percent(marketingConversions.length, marketingLeads.length); efficiency = productivity; total = marketingLeads.length; completed = marketingLeads.filter((row) => ["converted", "closed"].includes(status(row))).length;
      ({ current, previous } = currentAndPrevious(marketingConversions, "conversion_value")); riskScore = 100 - efficiency;
    } else if (item === "Transportation") {
      const transportTrips = scoped(trips, ["driver_id"]); const tripDrivers = new Map(transportTrips.map((row) => [String(row.id), String(row.driver_id)])); const transportDelays = delays.data?.map((row) => ({ ...row, driver_id: tripDrivers.get(String(row.trip_id)) })) ?? []; const scopedDelays = scoped({ data: transportDelays, error: null }, ["driver_id"]); const targets = scoped(transportTargets, ["manager_id"]); const completedTrips = transportTrips.filter(isDone);
      target = targets.reduce((sum, row) => sum + numberValue(row.target_deliveries), 0); actual = completedTrips.length; productivity = percent(completedTrips.length, transportTrips.length); efficiency = percent(Math.max(0, transportTrips.length - scopedDelays.length), transportTrips.length); total = transportTrips.length; completed = completedTrips.length;
      ({ current, previous } = completedByPeriod(transportTrips)); riskScore = 100 - efficiency;
    } else {
      const researchProjects = scoped(projects, ["manager_id"]); const researchExperiments = scoped(experiments, ["owner_id"]); const projectIds = new Set(researchProjects.map((row) => String(row.id))); const researchMilestones = all(milestones).filter((row) => projectIds.has(String(row.project_id))); const targets = scoped(researchTargets, ["manager_id"]);
      target = targets.reduce((sum, row) => sum + numberValue(row.target_quantity), 0); actual = researchProjects.filter(isDone).length; productivity = percent(researchExperiments.filter(isDone).length, researchExperiments.length); efficiency = percent(researchMilestones.filter(isDone).length, researchMilestones.length); total = researchProjects.length; completed = researchProjects.filter(isDone).length;
      ({ current, previous } = completedByPeriod(researchProjects)); riskScore = 100 - efficiency;
    }
    return { department: item, employees: employees.length, activeEmployees, targetAchievement: percent(actual, target), productivity, efficiency, growth: growth(current, previous), completionRate: percent(completed, total), riskScore: Math.max(0, Math.min(100, riskScore)) };
  });
  const trendConversions = scoped(conversions, ["converted_by"]); const trendOutputs = scoped(manufacturingOutputs, ["worker_id"]); const trendTrips = scoped(trips, ["driver_id"]); const trendProjects = scoped(projects, ["manager_id"]);
  const periods = [...new Set(trendConversions.concat(trendOutputs, trendTrips, trendProjects).map((row) => dateValue(row).slice(0, 7)).filter(Boolean))].sort().slice(-12);
  const trend = periods.map((period) => {
    const periodOutputs = trendOutputs.filter((row) => dateValue(row).slice(0, 7) === period);
    const periodHours = scoped(attendance, ["employee_id"]).filter((row) => dateValue(row).slice(0, 7) === period);
    const periodLeads = scoped(leads, ["assigned_to"]).filter((row) => dateValue(row).slice(0, 7) === period);
    const periodConversions = trendConversions.filter((row) => dateValue(row).slice(0, 7) === period);
    const periodTrips = trendTrips.filter((row) => dateValue(row).slice(0, 7) === period);
    const periodProjects = trendProjects.filter((row) => dateValue(row).slice(0, 7) === period);
    const periodMilestones = all(milestones).filter((row) => new Set(trendProjects.map((project) => String(project.id))).has(String(row.project_id))).filter((row) => dateValue(row).slice(0, 7) === period);
    const manufacturingPerformance = percent(periodOutputs.reduce((sum, row) => sum + numberValue(row.quantity_produced), 0), periodOutputs.reduce((sum, row) => sum + numberValue(row.quantity_produced), 0));
    const marketingPerformance = percent(periodConversions.length, periodLeads.length);
    const transportPerformance = percent(periodTrips.filter(isDone).length, periodTrips.length);
    const researchPerformance = percent(periodProjects.filter(isDone).length, periodProjects.length);
    const periodPerformance = [manufacturingPerformance, marketingPerformance, transportPerformance, researchPerformance];
    const periodAchievement = [percent(periodOutputs.reduce((sum, row) => sum + numberValue(row.quantity_produced), 0), scoped(manufacturingTargets, ["manager_id"]).reduce((sum, row) => sum + numberValue(row.target_quantity), 0)), percent(scoped(marketingTargets, ["manager_id"]).reduce((sum, row) => sum + numberValue(row.actual_quantity), 0), scoped(marketingTargets, ["manager_id"]).reduce((sum, row) => sum + numberValue(row.target_quantity), 0)), percent(periodTrips.filter(isDone).length, scoped(transportTargets, ["manager_id"]).reduce((sum, row) => sum + numberValue(row.target_deliveries), 0)), percent(periodProjects.filter(isDone).length, scoped(researchTargets, ["manager_id"]).reduce((sum, row) => sum + numberValue(row.target_quantity), 0))];
    const periodProductivity = [percent(periodOutputs.reduce((sum, row) => sum + numberValue(row.quantity_produced), 0), periodHours.reduce((sum, row) => sum + attendanceHours(row), 0)), marketingPerformance, transportPerformance, percent(periodProjects.filter(isDone).length, periodProjects.length)];
    const periodEfficiency = [manufacturingPerformance, marketingPerformance, percent(Math.max(0, periodTrips.length - all(delays).filter((row) => dateValue(row).slice(0, 7) === period).length), periodTrips.length), percent(periodMilestones.filter(isDone).length, periodMilestones.length)];
    const averageOf = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    return { period, performance: averageOf(periodPerformance), achievement: averageOf(periodAchievement), productivity: averageOf(periodProductivity), efficiency: averageOf(periodEfficiency) };
  });
  return { data: { role, scope: scopeDepartments, departments: metrics, trend }, error: null };
}
