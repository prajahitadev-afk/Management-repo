import { supabase } from "../lib/supabase";
import { inDashboardScope, resolveDashboardScope } from "./dashboard-scope.service";
import { getSubordinates } from "./hierarchy.service";

export interface TransportTrip {
  id: string;
  trip_code: string;
  driver_id: string;
  origin: string;
  destination: string;
  vehicle_id: string | null;
  route_id: string | null;
  route_name: string;
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
  origin: string;
  destination: string;
  trip_date: string;
}

export interface CreateDistanceInput {
  trip_id: string;
  distance: number;
  log_date: string;
}

export interface CreateFuelInput {
  trip_id: string;
  fuel_consumed: number;
  fuel_cost: number;
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

function mapTrip(row: Record<string, unknown>): TransportTrip {
  const origin = String(row.origin ?? "");
  const destination = String(row.destination ?? "");
  const createdAt = String(row.created_at ?? "");
  return {
    ...row,
    id: String(row.id ?? ""),
    trip_code: String(row.trip_code ?? ""),
    driver_id: String(row.driver_id ?? ""),
    origin,
    destination,
    vehicle_id: null,
    route_id: null,
    route_name: [origin, destination].filter(Boolean).join(" → "),
    trip_date: String(row.trip_date ?? ""),
    status: String(row.status ?? "Planned"),
    manager_id: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function mapDistance(row: Record<string, unknown>, trip?: TransportTrip): TransportDistanceLog {
  const recordedAt = String(row.recorded_at ?? "");
  return {
    ...row,
    id: String(row.id ?? ""),
    driver_id: trip?.driver_id ?? "",
    trip_id: String(row.trip_id ?? ""),
    distance: numberValue(row.distance_km),
    distance_unit: "km",
    log_date: recordedAt.slice(0, 10),
    created_at: recordedAt,
    updated_at: recordedAt,
  };
}

function mapFuel(row: Record<string, unknown>, trip?: TransportTrip): TransportFuelLog {
  const recordedAt = String(row.recorded_at ?? "");
  return {
    ...row,
    id: String(row.id ?? ""),
    driver_id: trip?.driver_id ?? "",
    trip_id: String(row.trip_id ?? ""),
    fuel_consumed: numberValue(row.fuel_litres),
    fuel_cost: numberValue(row.fuel_cost),
    fuel_unit: "litre",
    log_date: recordedAt.slice(0, 10),
    created_at: recordedAt,
    updated_at: recordedAt,
  };
}

function mapTransportTarget(row: Record<string, unknown>): TransportTarget {
  return {
    ...row,
    id: String(row.id ?? ""),
    manager_id: String(row.manager_id ?? ""),
    target_deliveries: numberValue(row.target_deliveries),
    period_start: String(row.start_date ?? ""),
    period_end: String(row.end_date ?? ""),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.created_at ?? ""),
  };
}

export async function getTrips(): Promise<TransportationResult<TransportTrip[]>> {
  try {
    const { data, error } = await supabase.rpc("list_transport_trips");
    return error ? { data: null, error: transportationError(error) } : { data: (data ?? []).map((row: unknown) => mapTrip(row as Record<string, unknown>)), error: null };
  } catch (error) { return { data: null, error: transportationError(error) }; }
}

export async function getTripById(id: string): Promise<TransportationResult<TransportTrip>> {
  const error = requiredId(id, "Trip ID");
  if (error) return invalid(error.message);
  const trips = await getTrips();
  if (trips.error || !trips.data) return { data: null, error: trips.error };
  return { data: trips.data.find((trip) => trip.id === id) ?? null, error: null };
}

export async function getTripsByDriver(driverId: string): Promise<TransportationResult<TransportTrip[]>> {
  const error = requiredId(driverId, "Driver ID");
  if (error) return invalid(error.message);
  const trips = await getTrips();
  return trips.error || !trips.data ? trips : { data: trips.data.filter((trip) => trip.driver_id === driverId), error: null };
}

export async function createTrip(data: CreateTripInput): Promise<TransportationResult<TransportTrip>> {
  if (!data.driver_id.trim() || !data.origin.trim() || !data.destination.trim() || !data.trip_date) {
    return invalid("Driver, origin, destination, and trip date are required");
  }
  try {
    const { data: row, error } = await supabase.rpc("create_transport_trip", {
      p_driver_id: data.driver_id,
      p_origin: data.origin.trim(),
      p_destination: data.destination.trim(),
      p_trip_date: data.trip_date,
    });
    return error ? { data: null, error: transportationError(error) } : { data: row ? mapTrip(row as Record<string, unknown>) : null, error: row ? null : new Error("Trip was not created") };
  } catch (error) { return { data: null, error: transportationError(error) }; }
}

export async function updateTrip(id: string, data: Partial<TransportTrip>): Promise<TransportationResult<TransportTrip>> {
  const error = requiredId(id, "Trip ID");
  if (error) return invalid(error.message);
  if (!data.status) return invalid("A new trip status is required");
  try {
    const { data: row, error: queryError } = await supabase.rpc("update_transport_trip", { p_trip_id: id, p_status: data.status });
    return queryError ? { data: null, error: transportationError(queryError) } : { data: row ? mapTrip(row as Record<string, unknown>) : null, error: row ? null : new Error("Trip was not updated") };
  } catch (queryError) { return { data: null, error: transportationError(queryError) }; }
}

export async function getActiveTrips(): Promise<TransportationResult<TransportTrip[]>> {
  const trips = await getTrips();
  return trips.error || !trips.data ? trips : { data: trips.data.filter((trip) => !["Completed", "Cancelled"].includes(trip.status)), error: null };
}

async function readTripLogs<T>(
  table: "transport_distance_logs" | "transport_fuel_logs",
  mapper: (row: Record<string, unknown>, trip?: TransportTrip) => T,
  driverId?: string,
): Promise<TransportationResult<T[]>> {
  try {
    const tripsResult = await getTrips();
    if (tripsResult.error || !tripsResult.data) return { data: null, error: tripsResult.error };
    const scopedTrips = driverId ? tripsResult.data.filter((trip) => trip.driver_id === driverId) : tripsResult.data;
    const tripIds = scopedTrips.map((trip) => trip.id);
    if (!tripIds.length) return { data: [], error: null };
    const { data, error } = await supabase.from(table).select("*").in("trip_id", tripIds).order("recorded_at", { ascending: false });
    if (error) return { data: null, error: transportationError(error) };
    const tripMap = new Map(scopedTrips.map((trip) => [trip.id, trip]));
    return { data: (data ?? []).map((row) => mapper(row as Record<string, unknown>, tripMap.get(String(row.trip_id)))), error: null };
  } catch (error) { return { data: null, error: transportationError(error) }; }
}

export async function getDistanceLogs(): Promise<TransportationResult<TransportDistanceLog[]>> {
  return readTripLogs("transport_distance_logs", mapDistance);
}

export async function getDistanceLogsByDriver(driverId: string): Promise<TransportationResult<TransportDistanceLog[]>> {
  const error = requiredId(driverId, "Driver ID");
  return error ? invalid(error.message) : readTripLogs("transport_distance_logs", mapDistance, driverId);
}

export async function recordDistance(data: CreateDistanceInput): Promise<TransportationResult<TransportDistanceLog>> {
  if (!data.trip_id?.trim() || !data.log_date) return invalid("Trip and log date are required");
  if (!Number.isFinite(data.distance) || data.distance <= 0) return invalid("Distance must be greater than zero");
  try {
    const { data: row, error } = await supabase.rpc("record_transport_distance", {
      p_trip_id: data.trip_id,
      p_distance_km: data.distance,
      p_recorded_at: data.log_date,
    });
    if (error) return { data: null, error: transportationError(error) };
    const trip = await getTripById(data.trip_id);
    if (trip.error) return { data: null, error: trip.error };
    return { data: row ? mapDistance(row as Record<string, unknown>, trip.data ?? undefined) : null, error: row ? null : new Error("Distance was not recorded") };
  } catch (error) { return { data: null, error: transportationError(error) }; }
}

export async function getFuelLogs(): Promise<TransportationResult<TransportFuelLog[]>> {
  return readTripLogs("transport_fuel_logs", mapFuel);
}

export async function getFuelLogsByDriver(driverId: string): Promise<TransportationResult<TransportFuelLog[]>> {
  const error = requiredId(driverId, "Driver ID");
  return error ? invalid(error.message) : readTripLogs("transport_fuel_logs", mapFuel, driverId);
}

export async function recordFuelUsage(data: CreateFuelInput): Promise<TransportationResult<TransportFuelLog>> {
  if (!data.trip_id?.trim() || !data.log_date) return invalid("Trip and log date are required");
  if (!Number.isFinite(data.fuel_consumed) || data.fuel_consumed <= 0 || !Number.isFinite(data.fuel_cost) || data.fuel_cost < 0) return invalid("Fuel quantity must be positive and cost cannot be negative");
  try {
    const { data: row, error } = await supabase.rpc("record_transport_fuel", {
      p_trip_id: data.trip_id,
      p_fuel_litres: data.fuel_consumed,
      p_fuel_cost: data.fuel_cost,
      p_recorded_at: data.log_date,
    });
    if (error) return { data: null, error: transportationError(error) };
    const trip = await getTripById(data.trip_id);
    if (trip.error) return { data: null, error: trip.error };
    return { data: row ? mapFuel(row as Record<string, unknown>, trip.data ?? undefined) : null, error: row ? null : new Error("Fuel was not recorded") };
  } catch (error) { return { data: null, error: transportationError(error) }; }
}

export async function getDelayLogs(): Promise<TransportationResult<TransportDelayLog[]>> {
  return readTable<TransportDelayLog>("transport_delay_logs");
}

export async function getDelayLogsByDriver(driverId: string): Promise<TransportationResult<TransportDelayLog[]>> {
  const trips = await getTripsByDriver(driverId);
  if (trips.error || !trips.data) return { data: null, error: trips.error };
  const tripIds = trips.data.map((trip) => trip.id);
  if (!tripIds.length) return { data: [], error: null };
  try {
    const { data, error } = await supabase.from("transport_delay_logs").select("*").in("trip_id", tripIds).order("recorded_at", { ascending: false });
    return error ? { data: null, error: transportationError(error) } : { data: (data ?? []) as TransportDelayLog[], error: null };
  } catch (error) { return { data: null, error: transportationError(error) }; }
}

export async function recordDelay(data: CreateDelayInput): Promise<TransportationResult<TransportDelayLog>> {
  if (!data.trip_id.trim() || !data.recorded_at || !data.reason.trim()) return invalid("Trip ID, recorded date, and delay reason are required");
  if (!Number.isInteger(data.delay_minutes) || data.delay_minutes <= 0) return invalid("Delay minutes must be a positive whole number");
  try {
    const { data: row, error } = await supabase.rpc("record_transport_delay", {
      p_trip_id: data.trip_id,
      p_delay_minutes: data.delay_minutes,
      p_reason: data.reason.trim(),
      p_recorded_at: data.recorded_at,
    });
    return error ? { data: null, error: transportationError(error) } : { data: row as TransportDelayLog, error: row ? null : new Error("Delay was not recorded") };
  } catch (error) { return { data: null, error: transportationError(error) }; }
}

export async function getTargets(): Promise<TransportationResult<TransportTarget[]>> {
  try {
    const { data, error } = await supabase.from("transport_targets").select("*").order("created_at", { ascending: false });
    return error ? { data: null, error: transportationError(error) } : { data: (data ?? []).map((row) => mapTransportTarget(row as Record<string, unknown>)), error: null };
  } catch (error) { return { data: null, error: transportationError(error) }; }
}

export async function getTargetByManager(managerId: string): Promise<TransportationResult<TransportTarget[]>> {
  const error = requiredId(managerId, "Manager ID");
  if (error) return invalid(error.message);
  const targets = await getTargets();
  return targets.error || !targets.data ? targets : { data: targets.data.filter((target) => target.manager_id === managerId), error: null };
}

export async function createTarget(data: CreateTransportTargetInput): Promise<TransportationResult<TransportTarget>> {
  if (!data.manager_id.trim() || !data.period_start || !data.period_end) return invalid("Manager ID and target period are required");
  if (!Number.isInteger(data.target_deliveries) || data.target_deliveries <= 0) return invalid("Target deliveries must be a positive whole number");
  try {
    const { data: row, error } = await supabase.rpc("create_transport_target", {
      p_target_deliveries: data.target_deliveries,
      p_period_start: data.period_start,
      p_period_end: data.period_end,
    });
    return error ? { data: null, error: transportationError(error) } : { data: row ? mapTransportTarget(row as Record<string, unknown>) : null, error: row ? null : new Error("Transportation target was not created") };
  } catch (error) { return { data: null, error: transportationError(error) }; }
}

export async function updateTarget(id: string, data: Partial<TransportTarget>): Promise<TransportationResult<TransportTarget>> {
  const error = requiredId(id, "Target ID");
  if (error) return invalid(error.message);
  try {
    const { data: row, error: queryError } = await supabase.rpc("update_transport_target", {
      p_target_id: id,
      p_target_deliveries: data.target_deliveries ?? null,
      p_status: data.status ?? null,
      p_period_start: data.period_start ?? null,
      p_period_end: data.period_end ?? null,
    });
    return queryError ? { data: null, error: transportationError(queryError) } : { data: row ? mapTransportTarget(row as Record<string, unknown>) : null, error: row ? null : new Error("Transportation target was not updated") };
  } catch (queryError) { return { data: null, error: transportationError(queryError) }; }
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
