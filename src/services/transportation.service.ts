import { supabase } from "../lib/supabase";
import { inDashboardScope, resolveDashboardScope } from "./dashboard-scope.service";
import { getSubordinates } from "./hierarchy.service";

export interface TransportTrip {
  id: string;
  driver_id: string;
  vehicle_id: string | null;
  route_id: string | null;
  route_name: string | null;
  trip_date: string;
  status: string;
  manager_id: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface TransportDistanceLog {
  id: string;
  driver_id: string;
  trip_id: string | null;
  distance: number;
  distance_unit: string | null;
  log_date: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface TransportFuelLog {
  id: string;
  driver_id: string;
  trip_id: string | null;
  fuel_consumed: number;
  fuel_cost: number;
  fuel_unit: string | null;
  log_date: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface TransportDelayLog {
  id: string;
  trip_id: string;
  delay_minutes: number;
  reason: string;
  recorded_at: string;
  [key: string]: unknown;
}

export interface TransportTarget {
  id: string;
  manager_id: string;
  target_deliveries: number;
  period_start: string;
  period_end: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface TransportationResult<T> {
  data: T | null;
  error: Error | null;
}

export interface CreateTripInput {
  driver_id: string;
  vehicle_id?: string | null;
  route_id?: string | null;
  route_name?: string | null;
  trip_date: string;
  status?: string;
  manager_id?: string | null;
}

export interface CreateDistanceInput {
  driver_id: string;
  trip_id?: string | null;
  distance: number;
  distance_unit?: string | null;
  log_date: string;
}

export interface CreateFuelInput {
  driver_id: string;
  trip_id?: string | null;
  fuel_consumed: number;
  fuel_cost?: number;
  fuel_unit?: string | null;
  log_date: string;
}

export interface CreateDelayInput {
  trip_id: string;
  delay_minutes: number;
  reason: string;
  recorded_at: string;
}

export interface CreateTransportTargetInput {
  manager_id: string;
  target_deliveries: number;
  period_start: string;
  period_end: string;
}

export interface TransportTargetVsActual {
  target_deliveries: number;
  actual_deliveries: number;
  variance: number;
  achievement_percentage: number;
}

export interface TransportWorkerDashboard {
  trips_completed: number;
  total_distance: number;
  fuel_consumed: number;
  delay_count: number;
}

export interface TransportSupervisorDashboard {
  team_trips: number;
  team_distance: number;
  team_delays: number;
  active_routes: number;
}

export interface TransportManagerDashboard {
  fleet_operations: number;
  target_deliveries: number;
  actual_deliveries: number;
  achievement_percentage: number;
}

export interface TransportCMDashboard {
  route_efficiency: number;
  cost_analysis: number;
  service_quality: number;
}

export interface TransportGMDashboard {
  logistics_analytics: number;
  fleet_utilization: number;
  department_comparison: number;
}

export interface TransportMDDashboard {
  strategic_fleet_metrics: number;
  annual_delivery_achievement: number;
  transportation_performance: number;
}

function transportationError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error ?? "Transportation request failed"));
}

function invalid<T = never>(message: string): TransportationResult<T> {
  return { data: null, error: new Error(message) };
}

function requiredId(value: string | undefined, label: string): Error | null {
  return value?.trim() ? null : new Error(`${label} is required`);
}

function numberValue(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

async function readTable<T>(table: string): Promise<TransportationResult<T[]>> {
  try {
    const { data, error } = await supabase.from(table).select("*");
    if (error) return { data: null, error: transportationError(error) };
    return { data: (data ?? []) as T[], error: null };
  } catch (error) {
    return { data: null, error: transportationError(error) };
  }
}

async function readById<T>(table: string, id: string): Promise<TransportationResult<T>> {
  try {
    const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
    if (error) return { data: null, error: transportationError(error) };
    return { data: (data as T | null) ?? null, error: null };
  } catch (error) {
    return { data: null, error: transportationError(error) };
  }
}

async function readByColumn<T>(table: string, column: string, value: string): Promise<TransportationResult<T[]>> {
  try {
    const { data, error } = await supabase.from(table).select("*").eq(column, value);
    if (error) return { data: null, error: transportationError(error) };
    return { data: (data ?? []) as T[], error: null };
  } catch (error) {
    return { data: null, error: transportationError(error) };
  }
}

async function insertRow<T>(table: string, payload: Record<string, unknown>): Promise<TransportationResult<T>> {
  try {
    const { data, error } = await supabase.from(table).insert(payload).select("*").single();
    if (error) return { data: null, error: transportationError(error) };
    return { data: data as T, error: null };
  } catch (error) {
    return { data: null, error: transportationError(error) };
  }
}

async function updateRow<T>(table: string, id: string, updates: Record<string, unknown>): Promise<TransportationResult<T>> {
  try {
    const { data, error } = await supabase.from(table).update(updates).eq("id", id).select("*").single();
    if (error) return { data: null, error: transportationError(error) };
    return { data: data as T, error: null };
  } catch (error) {
    return { data: null, error: transportationError(error) };
  }
}

export async function getTrips(): Promise<TransportationResult<TransportTrip[]>> { return readTable<TransportTrip>("transport_trips"); }

export async function getTripById(id: string): Promise<TransportationResult<TransportTrip>> {
  const error = requiredId(id, "Trip ID");
  return error ? invalid(error.message) : readById<TransportTrip>("transport_trips", id);
}

export async function getTripsByDriver(driverId: string): Promise<TransportationResult<TransportTrip[]>> {
  const error = requiredId(driverId, "Driver ID");
  return error ? invalid(error.message) : readByColumn<TransportTrip>("transport_trips", "driver_id", driverId);
}

export async function createTrip(data: CreateTripInput): Promise<TransportationResult<TransportTrip>> {
  if (!data.driver_id.trim() || !data.trip_date) return invalid("Driver ID and trip date are required");
  return insertRow<TransportTrip>("transport_trips", { ...data, vehicle_id: data.vehicle_id ?? null, route_id: data.route_id ?? null, route_name: data.route_name ?? null, status: data.status ?? "Planned", manager_id: data.manager_id ?? null });
}

export async function updateTrip(id: string, data: Partial<TransportTrip>): Promise<TransportationResult<TransportTrip>> {
  const error = requiredId(id, "Trip ID");
  if (error) return invalid(error.message);
  const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...updates } = data;
  return updateRow<TransportTrip>("transport_trips", id, updates);
}

export async function getActiveTrips(): Promise<TransportationResult<TransportTrip[]>> {
  try {
    const { data, error } = await supabase.from("transport_trips").select("*").not("status", "in", "(Completed,Cancelled)");
    if (error) return { data: null, error: transportationError(error) };
    return { data: (data ?? []) as TransportTrip[], error: null };
  } catch (error) { return { data: null, error: transportationError(error) }; }
}

export async function getDistanceLogs(): Promise<TransportationResult<TransportDistanceLog[]>> { return readTable<TransportDistanceLog>("transport_distance_logs"); }

export async function getDistanceLogsByDriver(driverId: string): Promise<TransportationResult<TransportDistanceLog[]>> {
  const error = requiredId(driverId, "Driver ID");
  return error ? invalid(error.message) : readByColumn<TransportDistanceLog>("transport_distance_logs", "driver_id", driverId);
}

export async function recordDistance(data: CreateDistanceInput): Promise<TransportationResult<TransportDistanceLog>> {
  if (!data.driver_id.trim() || !data.log_date) return invalid("Driver ID and log date are required");
  if (!Number.isFinite(data.distance) || data.distance < 0) return invalid("Distance must be zero or greater");
  return insertRow<TransportDistanceLog>("transport_distance_logs", { ...data, trip_id: data.trip_id ?? null, distance_unit: data.distance_unit ?? "km" });
}

export async function getFuelLogs(): Promise<TransportationResult<TransportFuelLog[]>> { return readTable<TransportFuelLog>("transport_fuel_logs"); }

export async function getFuelLogsByDriver(driverId: string): Promise<TransportationResult<TransportFuelLog[]>> {
  const error = requiredId(driverId, "Driver ID");
  return error ? invalid(error.message) : readByColumn<TransportFuelLog>("transport_fuel_logs", "driver_id", driverId);
}

export async function recordFuelUsage(data: CreateFuelInput): Promise<TransportationResult<TransportFuelLog>> {
  if (!data.driver_id.trim() || !data.log_date) return invalid("Driver ID and log date are required");
  if (!Number.isFinite(data.fuel_consumed) || data.fuel_consumed < 0 || !Number.isFinite(data.fuel_cost ?? 0) || (data.fuel_cost ?? 0) < 0) return invalid("Fuel values must be zero or greater");
  return insertRow<TransportFuelLog>("transport_fuel_logs", { ...data, trip_id: data.trip_id ?? null, fuel_cost: data.fuel_cost ?? 0, fuel_unit: data.fuel_unit ?? "litre" });
}

export async function getDelayLogs(): Promise<TransportationResult<TransportDelayLog[]>> { return readTable<TransportDelayLog>("transport_delay_logs"); }

export async function getDelayLogsByDriver(driverId: string): Promise<TransportationResult<TransportDelayLog[]>> {
  const { data: trips, error: tripsError } = await supabase.from("transport_trips").select("id").eq("driver_id", driverId);
  if (tripsError) return { data: null, error: asError(tripsError) };
  const tripIds = (trips ?? []).map((row) => String(row.id));
  if (!tripIds.length) return { data: [], error: null };
  const { data, error: delayError } = await supabase.from("transport_delay_logs").select("*").in("trip_id", tripIds);
  return delayError ? { data: null, error: asError(delayError) } : { data: (data ?? []) as TransportDelayLog[], error: null };
}

export async function recordDelay(data: CreateDelayInput): Promise<TransportationResult<TransportDelayLog>> {
  if (!data.trip_id.trim() || !data.recorded_at || !data.reason.trim()) return invalid("Trip ID, recorded date, and delay reason are required");
  if (!Number.isFinite(data.delay_minutes) || data.delay_minutes < 0) return invalid("Delay minutes must be zero or greater");
  return insertRow<TransportDelayLog>("transport_delay_logs", data as unknown as Record<string, unknown>);
}

export async function getTargets(): Promise<TransportationResult<TransportTarget[]>> { return readTable<TransportTarget>("transport_targets"); }

export async function getTargetByManager(managerId: string): Promise<TransportationResult<TransportTarget[]>> {
  const error = requiredId(managerId, "Manager ID");
  return error ? invalid(error.message) : readByColumn<TransportTarget>("transport_targets", "manager_id", managerId);
}

export async function createTarget(data: CreateTransportTargetInput): Promise<TransportationResult<TransportTarget>> {
  if (!data.manager_id.trim() || !data.period_start || !data.period_end) return invalid("Manager ID and target period are required");
  if (!Number.isFinite(data.target_deliveries) || data.target_deliveries < 0) return invalid("Target deliveries must be zero or greater");
  return insertRow<TransportTarget>("transport_targets", data as unknown as Record<string, unknown>);
}

export async function updateTarget(id: string, data: Partial<TransportTarget>): Promise<TransportationResult<TransportTarget>> {
  const error = requiredId(id, "Target ID");
  if (error) return invalid(error.message);
  const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...updates } = data;
  return updateRow<TransportTarget>("transport_targets", id, updates);
}

export async function calculateTargetVsActual(managerId: string): Promise<TransportationResult<TransportTargetVsActual>> {
  const scope = await resolveDashboardScope(managerId, "Manager");
  const [targets, trips] = await Promise.all([getTargetByManager(managerId), getTrips()]);
  if (targets.error || !targets.data) return { data: null, error: targets.error };
  if (trips.error || !trips.data) return { data: null, error: trips.error };
  const target = targets.data.reduce((sum, row) => sum + numberValue(row.target_deliveries), 0);
  const actual = trips.data.filter((trip) => inDashboardScope(scope, trip.driver_id) && ["Completed", "Delivered"].includes(trip.status)).length;
  return { data: { target_deliveries: target, actual_deliveries: actual, variance: actual - target, achievement_percentage: target ? (actual / target) * 100 : 0 }, error: null };
}

async function teamIds(supervisorId: string): Promise<TransportationResult<string[]>> {
  try {
    const subordinates = await getSubordinates(supervisorId);
    return { data: [supervisorId, ...subordinates], error: null };
  } catch (error) { return { data: null, error: transportationError(error) }; }
}

export async function getWorkerDashboard(employeeId: string): Promise<TransportationResult<TransportWorkerDashboard>> {
  const [trips, distance, fuel, delays] = await Promise.all([getTripsByDriver(employeeId), getDistanceLogsByDriver(employeeId), getFuelLogsByDriver(employeeId), getDelayLogsByDriver(employeeId)]);
  const failure = [trips, distance, fuel, delays].find((result) => result.error);
  if (failure?.error) return { data: null, error: failure.error };
  return { data: { trips_completed: trips.data!.filter((trip) => ["Completed", "Delivered"].includes(trip.status)).length, total_distance: distance.data!.reduce((sum, row) => sum + numberValue(row.distance), 0), fuel_consumed: fuel.data!.reduce((sum, row) => sum + numberValue(row.fuel_consumed), 0), delay_count: delays.data!.length }, error: null };
}

export async function getSupervisorDashboard(supervisorId: string): Promise<TransportationResult<TransportSupervisorDashboard>> {
  const scope = await resolveDashboardScope(supervisorId, "Supervisor");
  const ids = await teamIds(supervisorId);
  if (ids.error || !ids.data) return { data: null, error: ids.error };
  const [trips, distance, delays, active] = await Promise.all([getTrips(), getDistanceLogs(), getDelayLogs(), getActiveTrips()]);
  const failure = [trips, distance, delays, active].find((result) => result.error);
  if (failure?.error) return { data: null, error: failure.error };
  const teamTripIds = new Set(trips.data!.filter((trip) => inDashboardScope(scope, trip.driver_id)).map((trip) => trip.id));
  return { data: { team_trips: teamTripIds.size, team_distance: distance.data!.filter((row) => inDashboardScope(scope, row.driver_id)).reduce((sum, row) => sum + numberValue(row.distance), 0), team_delays: delays.data!.filter((row) => teamTripIds.has(row.trip_id)).length, active_routes: new Set(active.data!.filter((trip) => inDashboardScope(scope, trip.driver_id)).map((trip) => trip.route_id ?? trip.route_name ?? trip.id)).size }, error: null };
}

export async function getManagerDashboard(managerId: string): Promise<TransportationResult<TransportManagerDashboard>> {
  const scope = await resolveDashboardScope(managerId, "Manager");
  const [active, comparison] = await Promise.all([getActiveTrips(), calculateTargetVsActual(managerId)]);
  if (active.error || !active.data) return { data: null, error: active.error };
  if (comparison.error || !comparison.data) return { data: null, error: comparison.error };
  return { data: { fleet_operations: active.data.filter((trip) => inDashboardScope(scope, trip.driver_id)).length, target_deliveries: comparison.data.target_deliveries, actual_deliveries: comparison.data.actual_deliveries, achievement_percentage: comparison.data.achievement_percentage }, error: null };
}

export async function getCMDashboard(department?: string | null): Promise<TransportationResult<TransportCMDashboard>> {
  const scope = await resolveDashboardScope("", "Chief Manager", department);
  const [trips, distance, delays, fuel] = await Promise.all([getTrips(), getDistanceLogs(), getDelayLogs(), getFuelLogs()]);
  const failure = [trips, distance, delays, fuel].find((result) => result.error);
  if (failure?.error) return { data: null, error: failure.error };
  const scopedTrips = trips.data!.filter((trip) => inDashboardScope(scope, trip.driver_id));
  const tripIds = new Set(scopedTrips.map((trip) => trip.id));
  const tripCount = scopedTrips.length;
  return { data: { route_efficiency: tripCount ? (scopedTrips.filter((trip) => ["Completed", "Delivered"].includes(trip.status)).length / tripCount) * 100 : 0, cost_analysis: fuel.data!.filter((row) => inDashboardScope(scope, row.driver_id)).reduce((sum, row) => sum + numberValue(row.fuel_cost), 0), service_quality: tripCount ? Math.max(0, 100 - (delays.data!.filter((row) => tripIds.has(row.trip_id)).length / tripCount) * 100) : 0 }, error: null };
}

export async function getGMDashboard(department?: string | null): Promise<TransportationResult<TransportGMDashboard>> {
  const scope = await resolveDashboardScope("", "General Manager", department);
  const [trips, distance, active] = await Promise.all([getTrips(), getDistanceLogs(), getActiveTrips()]);
  const failure = [trips, distance, active].find((result) => result.error);
  if (failure?.error) return { data: null, error: failure.error };
  const scopedTrips = trips.data!.filter((trip) => inDashboardScope(scope, trip.driver_id));
  const tripCount = scopedTrips.length;
  const scopedActive = active.data!.filter((trip) => inDashboardScope(scope, trip.driver_id));
  return { data: { logistics_analytics: tripCount ? (scopedTrips.filter((trip) => ["Completed", "Delivered"].includes(trip.status)).length / tripCount) * 100 : 0, fleet_utilization: tripCount ? (scopedActive.length / tripCount) * 100 : 0, department_comparison: tripCount ? distance.data!.filter((row) => inDashboardScope(scope, row.driver_id)).reduce((sum, row) => sum + numberValue(row.distance), 0) / tripCount : 0 }, error: null };
}

export async function getMDTransportationDashboard(): Promise<TransportationResult<TransportMDDashboard>> {
  const [trips, targets, delays] = await Promise.all([getTrips(), getTargets(), getDelayLogs()]);
  const failure = [trips, targets, delays].find((result) => result.error);
  if (failure?.error) return { data: null, error: failure.error };
  const completed = trips.data!.filter((trip) => ["Completed", "Delivered"].includes(trip.status)).length;
  const annualTarget = targets.data!.reduce((sum, row) => sum + numberValue(row.target_deliveries), 0);
  const tripCount = trips.data!.length;
  return { data: { strategic_fleet_metrics: new Set(trips.data!.map((trip) => trip.vehicle_id).filter(Boolean)).size, annual_delivery_achievement: annualTarget ? (completed / annualTarget) * 100 : 0, transportation_performance: tripCount ? Math.max(0, 100 - (delays.data!.length / tripCount) * 100) : 0 }, error: null };
}
