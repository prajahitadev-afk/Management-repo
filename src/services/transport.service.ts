import { supabase } from "../lib/supabase";
import { sendDeliveryOTP, sendNotification, getSupervisors, type NotificationEventType } from "./notification.service";

export type DeliveryStatus = "Created" | "Loaded" | "Dispatched" | "In Transit" | "Delivered" | "Failed" | "Cancelled";
type MutableStatus = Exclude<DeliveryStatus, "Delivered" | "Failed" | "Cancelled">;

export interface TransportShipment { id: string; deliveryId: string; order: string; vehicle: string; driver: string; driverId?: string; dispatch: string; delivery: string; status: string; dest: string; confirmed: boolean; delayed: boolean; }
export interface TransportMetrics { totalDeliveries: number; created: number; loaded: number; dispatched: number; inTransit: number; awaitingConfirmation: number; delivered: number; failed: number; cancelled: number; delayed: number; pending: number; completed: number; }
export interface FleetVehicle { vehicleNumber: string; driverName: string; destination: string; status: string; vehicleStatus: string; }
export interface DeliveryReport { totalDeliveries: number; delivered: number; pending: number; delayed: number; inTransit: number; averageDeliveryTime: number; }
export interface DeliveryTrackingEntry { delivery_id?: string; status: string; location: string | null; remarks: string | null; updated_by?: string | null; updated_at: string; }
export interface DeliveryOption { id: string; label: string; }
export interface DeliveryDetails { id: string; orderNumber: string; customerCity: string; vehicleNumber: string; driverName: string; vehicleId: string | null; driverId: string | null; status: string; dispatchDate: string | null; expectedDeliveryDate: string | null; deliveryDate: string | null; delayed: boolean; tracking: DeliveryTrackingEntry[]; }

interface DeliveryRow { id: string; dispatch_date: string | null; expected_delivery_date: string | null; delivery_date: string | null; status: string | null; driver_confirmed: boolean | null; customer_confirmed: boolean | null; orders: Array<{ order_number: string | null; customers: Array<{ city: string | null }> | null; created_by?: string | null }> | null; vehicles: Array<{ vehicle_number: string | null }> | null; drivers: Array<{ id?: string | null; name: string | null }> | null; }
interface ProfileRow { id: string; role: string | null; department: string | null; }
interface AssignmentRow { vehicles: Array<{ vehicle_number: string | null; status: string | null }> | null; drivers: Array<{ name: string | null }> | null; deliveries: Array<{ status: string | null; orders: Array<{ customers: Array<{ city: string | null }> | null }> | null }> | null; }

const TRANSITIONS: Record<MutableStatus, DeliveryStatus | null> = { Created: "Loaded", Loaded: "Dispatched", Dispatched: "In Transit", "In Transit": "Delivered" };
const normalizeStatus = (value: string | null | undefined): DeliveryStatus => { const statuses: DeliveryStatus[] = ["Created", "Loaded", "Dispatched", "In Transit", "Delivered", "Failed", "Cancelled"]; return statuses.includes(value as DeliveryStatus) ? value as DeliveryStatus : "Created"; };
const formatDate = (value: string | null | undefined): string => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "N/A";
function unwrapFirst<T>(value: T | T[] | null | undefined): T | null { if (Array.isArray(value)) return value[0] ?? null; return value ?? null; }

async function currentUser(): Promise<{ id: string; role: string; department: string }> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error("Authentication required");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("id, role, department").eq("id", data.user.id).single();
  if (profileError) throw profileError;
  const row = profile as ProfileRow;
  return { id: data.user.id, role: row.role ?? "", department: row.department ?? "" };
}

function canManageStatus(role: string, department: string): boolean { return ["Vice Chairman", "Vice President", "General Manager"].includes(role) || (role === "MD-Transport" && department === "Transport"); }

async function authorizeTransition(deliveryId: string, requested: DeliveryStatus): Promise<string> {
  const user = await currentUser();
  const { data, error } = await supabase.from("deliveries").select("driver_id, status").eq("id", deliveryId).single();
  if (error) throw error;
  const isAssignedDriver = data.driver_id === user.id;
  const driverAllowed = isAssignedDriver && (requested === "In Transit" || requested === "Delivered");
  if (!canManageStatus(user.role, user.department) && !driverAllowed) throw new Error("You are not authorized to change this delivery status.");
  const current = normalizeStatus(data.status);
  if (requested !== "Failed" && requested !== "Cancelled" && TRANSITIONS[current as MutableStatus] !== requested) throw new Error(`Invalid transition from ${current} to ${requested}`);
  return user.id;
}

async function insertTracking(deliveryId: string, status: DeliveryStatus, updatedBy: string, remarks?: string): Promise<void> {
  const { error } = await supabase.from("delivery_tracking").insert({ delivery_id: deliveryId, status, location: null, remarks: remarks ?? null, updated_by: updatedBy, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function notifyDelivery(deliveryId: string, title: string, message: string, type: string, roles: string[], departments: string[] = [], includeDriver = true, includeOrderCreator = true): Promise<void> {
  const { data: delivery, error: deliveryError } = await supabase.from("deliveries").select("driver_id, order_id, orders(created_by)").eq("id", deliveryId).single();
  if (deliveryError) throw deliveryError;
  const { data: roleRows, error: roleError } = roles.length ? await supabase.from("profiles").select("id").in("role", roles) : { data: [], error: null };
  const { data: departmentRows, error: departmentError } = departments.length ? await supabase.from("profiles").select("id").in("department", departments) : { data: [], error: null };
  if (roleError) throw roleError;
  if (departmentError) throw departmentError;
  const recipientsSet = new Set<string>();
  const orderRow = unwrapFirst((delivery as { orders?: Array<{ created_by?: string | null }> | { created_by?: string | null } | null }).orders);
  if (includeDriver && delivery?.driver_id) recipientsSet.add(String(delivery.driver_id));
  if (includeOrderCreator) recipientsSet.add(String(orderRow?.created_by ?? ""));
  (roleRows ?? []).forEach((row) => recipientsSet.add(String(row.id)));
  (departmentRows ?? []).forEach((row) => recipientsSet.add(String(row.id)));

  // For transport events where driver exists, escalate to supervisor + manager
  if (includeDriver && delivery?.driver_id) {
    try {
      const superiors = await getSupervisors(String(delivery.driver_id), 2);
      superiors.forEach((s) => recipientsSet.add(s));
    } catch (err) {
      console.error("notifyDelivery: failed to fetch superiors", err);
    }
  }

  const ids = Array.from(recipientsSet).filter(Boolean);
  if (!ids.length) return;

  await sendNotification({
    recipients: ids,
    type: type as NotificationEventType,
    title,
    message,
    relatedEntityType: "delivery",
    relatedEntityId: deliveryId,
    actionUrl: "/transport",
  });
}

async function getOrderIdForDelivery(deliveryId: string): Promise<string | null> {
  const { data, error } = await supabase.from("deliveries").select("order_id").eq("id", deliveryId).maybeSingle();
  if (error) throw error;
  return data?.order_id ?? null;
}

const DELIVERY_TO_ORDER_STATUS: Record<DeliveryStatus, string | null> = {
  Created: null,
  Loaded: "Dispatched",
  Dispatched: "In Transit",
  "In Transit": "In Transit",
  Delivered: "Delivered",
  Failed: "Failed",
  Cancelled: "Cancelled",
};

async function syncOrderStatusWithDelivery(deliveryId: string, deliveryStatus: DeliveryStatus): Promise<void> {
  const orderStatus = DELIVERY_TO_ORDER_STATUS[deliveryStatus];
  if (!orderStatus) return;

  const orderId = await getOrderIdForDelivery(deliveryId);
  if (!orderId) return;

  const { error } = await supabase.from("orders").update({ status: orderStatus }).eq("id", orderId);
  if (error) throw error;
}

export async function getDashboardMetrics(): Promise<TransportMetrics> {
  const { data, error } = await supabase.from("deliveries").select("status, expected_delivery_date");
  if (error) throw error;
  const rows = data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const count = (status: DeliveryStatus) => rows.filter((row) => normalizeStatus(row.status) === status).length;
  const delayed = rows.filter((row) => {
    const expectedDate = row.expected_delivery_date as string | null;
    return Boolean(expectedDate && expectedDate < today && normalizeStatus(row.status) !== "Delivered");
  }).length;
  return { totalDeliveries: rows.length, created: count("Created"), loaded: count("Loaded"), dispatched: count("Dispatched"), inTransit: count("In Transit"), awaitingConfirmation: 0, delivered: count("Delivered"), failed: count("Failed"), cancelled: count("Cancelled"), delayed, pending: count("Created") + count("Loaded"), completed: count("Delivered") };
}

export async function getShipments(): Promise<TransportShipment[]> {
  const { data, error } = await supabase.from("deliveries").select("id, dispatch_date, expected_delivery_date, delivery_date, status, driver_confirmed, customer_confirmed, orders(order_number, customers(city)), vehicles(vehicle_number), drivers:profiles(id, name)").order("created_at", { ascending: false });
  if (error) throw error;
  const today = new Date().toISOString().slice(0, 10);
  return ((data ?? []) as unknown as DeliveryRow[]).map((row) => {
    const order = unwrapFirst(row.orders);
    const vehicle = unwrapFirst(row.vehicles);
    const driver = unwrapFirst(row.drivers);
    const customerLocation = unwrapFirst(order?.customers);
    const status = normalizeStatus(row.status);
    const delayed = Boolean(row.expected_delivery_date && row.expected_delivery_date < today && status !== "Delivered");
    return { id: row.id, deliveryId: row.id, order: order?.order_number ?? "N/A", vehicle: vehicle?.vehicle_number ?? "N/A", driver: driver?.name ?? "Unassigned", driverId: driver?.id ?? undefined, dispatch: formatDate(row.dispatch_date), delivery: formatDate(row.delivery_date ?? row.expected_delivery_date), status, dest: customerLocation?.city ?? "N/A", confirmed: row.customer_confirmed === true, delayed };
  });
}

export async function getFleetStatus(): Promise<FleetVehicle[]> {
  const { data, error } = await supabase.from("delivery_assignments").select("vehicles(vehicle_number, status), drivers(name), deliveries(status, orders(customers(city)))").order("assigned_at", { ascending: false }).limit(4);
  if (error) throw error;
  return ((data ?? []) as unknown as AssignmentRow[]).map((row) => {
    const vehicle = unwrapFirst(row.vehicles);
    const driver = unwrapFirst(row.drivers);
    const delivery = unwrapFirst(row.deliveries);
    const order = unwrapFirst(delivery?.orders);
    const customer = unwrapFirst(order?.customers);
    return { vehicleNumber: vehicle?.vehicle_number ?? "N/A", driverName: driver?.name ?? "Unassigned", destination: customer?.city ?? "N/A", status: normalizeStatus(delivery?.status), vehicleStatus: vehicle?.status ?? "Inactive" };
  });
}

export async function getDeliveryReports(): Promise<DeliveryReport> {
  const { data, error } = await supabase.from("deliveries").select("status, dispatch_date, delivery_date");
  if (error) throw error;
  const rows = data ?? [];
  const completed = rows.filter((row) => normalizeStatus(row.status) === "Delivered" && row.delivery_date && row.dispatch_date);
  const averageDeliveryTime = completed.length ? Math.round(completed.reduce((sum, row) => sum + (new Date(row.delivery_date as string).getTime() - new Date(row.dispatch_date as string).getTime()), 0) / completed.length / 86400000) : 0;
  const metrics = await getDashboardMetrics();
  return { totalDeliveries: metrics.totalDeliveries, delivered: metrics.delivered, pending: metrics.pending, delayed: metrics.delayed, inTransit: metrics.inTransit, averageDeliveryTime };
}

export async function getTrackingHistory(deliveryId: string): Promise<DeliveryTrackingEntry[]> {
  const { data, error } = await supabase.from("delivery_tracking").select("delivery_id, status, location, remarks, updated_by, updated_at").eq("delivery_id", deliveryId).order("updated_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DeliveryTrackingEntry[];
}

export async function getDeliveryDetails(deliveryId: string): Promise<DeliveryDetails> {
  const { data, error } = await supabase
    .from("deliveries")
    .select(`
      id,
      vehicle_id,
      driver_id,
      dispatch_date,
      expected_delivery_date,
      delivery_date,
      status,
      orders(order_number, customers(city)),
      vehicles(vehicle_number),
      drivers:profiles(id, name)
    `)
    .eq("id", deliveryId)
    .maybeSingle();

  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  const order = unwrapFirst((row.orders as Array<Record<string, unknown>> | undefined));
  const vehicle = unwrapFirst((row.vehicles as Array<Record<string, unknown>> | undefined));
  const driver = unwrapFirst((row.drivers as Array<Record<string, unknown>> | undefined));
  const customer = unwrapFirst(((order?.customers as Array<Record<string, unknown>> | undefined)));
  const tracking = await getTrackingHistory(deliveryId);
  const status = normalizeStatus((row.status as string | null) ?? null);
  const expectedDate = (row.expected_delivery_date as string | null) ?? null;
  const today = new Date().toISOString().slice(0, 10);

  return {
    id: String(row.id ?? deliveryId),
    orderNumber: String(order?.order_number ?? "N/A"),
    customerCity: String(customer?.city ?? "N/A"),
    vehicleNumber: String(vehicle?.vehicle_number ?? "N/A"),
    driverName: String(driver?.name ?? "Unassigned"),
    vehicleId: (row.vehicle_id as string | null) ?? null,
    driverId: (row.driver_id as string | null) ?? null,
    status,
    dispatchDate: (row.dispatch_date as string | null) ?? null,
    expectedDeliveryDate: expectedDate,
    deliveryDate: (row.delivery_date as string | null) ?? null,
    delayed: Boolean(expectedDate && expectedDate < today && status !== "Delivered"),
    tracking,
  };
}

export async function getDeliveryEditableOptions(): Promise<{ vehicles: DeliveryOption[]; drivers: DeliveryOption[] }> {
  const [vehiclesRes, driversRes] = await Promise.all([
    supabase.from("vehicles").select("id, vehicle_number").order("vehicle_number", { ascending: true }),
    supabase.from("drivers").select("id, name").order("name", { ascending: true }),
  ]);

  if (vehiclesRes.error) throw vehiclesRes.error;
  if (driversRes.error) throw driversRes.error;

  return {
    vehicles: (vehiclesRes.data ?? []).map((row) => ({ id: String(row.id), label: String(row.vehicle_number ?? "N/A") })),
    drivers: (driversRes.data ?? []).map((row) => ({ id: String(row.id), label: String(row.name ?? "N/A") })),
  };
}

export async function updateDeliveryDetails(deliveryId: string, changes: { vehicleId?: string | null; driverId?: string | null; expectedDeliveryDate?: string | null }): Promise<DeliveryDetails> {
  const { data: existingRow, error: fetchError } = await supabase
    .from("deliveries")
    .select("status, vehicle_id, driver_id, expected_delivery_date")
    .eq("id", deliveryId)
    .single();

  if (fetchError) throw fetchError;
  const currentStatus = normalizeStatus((existingRow as { status?: string | null } | null)?.status ?? null);

  const update: Record<string, string | null> = {};
  if (currentStatus === "Created") {
    update.vehicle_id = changes.vehicleId ?? (existingRow as { vehicle_id?: string | null } | null)?.vehicle_id ?? null;
    update.driver_id = changes.driverId ?? (existingRow as { driver_id?: string | null } | null)?.driver_id ?? null;
    update.expected_delivery_date = changes.expectedDeliveryDate ?? (existingRow as { expected_delivery_date?: string | null } | null)?.expected_delivery_date ?? null;
  } else if (currentStatus === "Loaded") {
    update.vehicle_id = changes.vehicleId ?? (existingRow as { vehicle_id?: string | null } | null)?.vehicle_id ?? null;
    update.driver_id = changes.driverId ?? (existingRow as { driver_id?: string | null } | null)?.driver_id ?? null;
  } else {
    throw new Error("Delivery editing is disabled for the current status.");
  }

  const { error } = await supabase.from("deliveries").update(update).eq("id", deliveryId);
  if (error) throw error;

  return getDeliveryDetails(deliveryId);
}

export function getNextDeliveryStatus(status: string): DeliveryStatus | null { return TRANSITIONS[normalizeStatus(status) as MutableStatus] ?? null; }

export async function updateDeliveryStatus(deliveryId: string, newStatus: DeliveryStatus, failureReason?: string): Promise<DeliveryStatus> {
  const userId = await authorizeTransition(deliveryId, newStatus);
  const timestamp = new Date().toISOString();
  const update: Record<string, string | boolean | null> = { status: newStatus };
  if (newStatus === "Loaded") update.loaded_at = timestamp;
  if (newStatus === "Dispatched") update.dispatched_at = timestamp;
  if (newStatus === "In Transit") {
    update.in_transit_at = timestamp;
    update.driver_confirmed = true;
    const otp = generateDeliveryOTP();
    update.delivery_otp = otp;
    update.otp_sent_at = timestamp;
    update.otp_expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  }
  if (newStatus === "Delivered") {
    update.delivered_at = timestamp;
    update.delivery_date = timestamp;
    update.customer_confirmed = true;
  }
  if (newStatus === "Failed") update.failure_reason = failureReason ?? "Delivery failed";
  const { error } = await supabase.from("deliveries").update(update).eq("id", deliveryId);
  if (error) throw error;
  await insertTracking(deliveryId, newStatus, userId, failureReason);
  await syncOrderStatusWithDelivery(deliveryId, newStatus);
  const title: Record<DeliveryStatus, string> = { Created: "Shipment Created", Loaded: "Shipment Loaded", Dispatched: "Shipment Dispatched", "In Transit": "Shipment In Transit", Delivered: "Delivery Completed", Failed: "Delivery Failed", Cancelled: "Delivery Cancelled" };
  const roles = newStatus === "Delivered" ? ["Vice Chairman", "Vice President", "MD-Transport", "MD-Marketing"] : newStatus === "Failed" ? ["Vice Chairman", "Vice President", "MD-Transport"] : newStatus === "Loaded" ? [] : ["MD-Transport"];
  const departments: string[] = [];
  await notifyDelivery(deliveryId, title[newStatus], newStatus === "Failed" ? `Delivery failed: ${failureReason ?? "Delivery failed"}` : `Shipment status is now ${newStatus}.`, `delivery_${newStatus.toLowerCase().replace(/ /g, "_")}`, roles, departments, true, newStatus === "Delivered" || newStatus === "Failed");
  return newStatus;
}

export function generateDeliveryOTP(): string { return String(Math.floor(100000 + Math.random() * 900000)); }

export async function verifyDeliveryOTP(deliveryId: string, otp: string, providedUserId?: string): Promise<boolean> {
  let resolvedUser: { id: string; role: string; department: string };
  if (providedUserId) {
    const { data: profileData, error: profileError } = await supabase.from("profiles").select("id, role, department").eq("id", providedUserId).single();
    if (profileError) throw profileError;
    const p = profileData as ProfileRow | null;
    resolvedUser = { id: String(p?.id ?? ""), role: p?.role ?? "", department: p?.department ?? "" };
  } else {
    resolvedUser = await currentUser();
  }

  const { data, error } = await supabase.from("deliveries").select("delivery_otp, status, otp_expires_at, driver_id").eq("id", deliveryId).single();
  if (error) throw error;
  const deliveryRow = (data ?? {}) as { delivery_otp?: string | null; status?: string | null; otp_expires_at?: string | null; driver_id?: string | null };
  if (normalizeStatus(deliveryRow.status) !== "In Transit") throw new Error("Delivery is not in transit for verification");
  const expires = deliveryRow.otp_expires_at ? new Date(deliveryRow.otp_expires_at) : null;
  if (!expires || Date.now() > expires.getTime()) throw new Error("Delivery OTP has expired");
  if (String(deliveryRow.delivery_otp ?? "").trim() !== otp.trim()) throw new Error("Invalid delivery OTP");

  const allowedRoles = ["MD-Transport", "GM-Transport", "General Manager", "Vice President", "Vice Chairman"];
  const isAssignedDriver = String(deliveryRow.driver_id ?? "") === resolvedUser.id;
  const role = resolvedUser.role ?? "";
  if (!isAssignedDriver && !allowedRoles.includes(role)) throw new Error("You are not authorized to verify this OTP");

  const timestamp = new Date().toISOString();
  const { error: updateError } = await supabase.from("deliveries").update({ customer_confirmed: true, customer_confirmed_at: timestamp, delivered_at: timestamp, delivery_date: timestamp, status: "Delivered" }).eq("id", deliveryId);
  if (updateError) throw updateError;
  await insertTracking(deliveryId, "Delivered", resolvedUser.id, "Delivery completed");
  await syncOrderStatusWithDelivery(deliveryId, "Delivered");
  await notifyDelivery(deliveryId, "Delivery Completed", "Delivery was completed successfully.", "delivery_confirmed", ["Vice Chairman", "Vice President", "MD-Transport", "MD-Marketing"], [], false, true);
  return true;
}

export async function resendDeliveryOTP(deliveryId: string): Promise<void> {
  const otp = generateDeliveryOTP();
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { error } = await supabase.from("deliveries").update({ delivery_otp: otp, otp_sent_at: now, otp_expires_at: expires }).eq("id", deliveryId);
  if (error) throw error;
  await insertTracking(deliveryId, "In Transit", "system", "OTP Resent");
  try {
    await sendDeliveryOTP(deliveryId, otp);
  } catch (err) {
    console.error("resendDeliveryOTP: failed to send OTP", err);
  }
  await notifyDelivery(deliveryId, "Delivery OTP Resent", "A new delivery OTP was sent.", "delivery_otp_resent", ["MD-Transport"], ["Transport"], true, false);
}

export async function getDeliverySLAReport(): Promise<{ averageDeliveryTimeHours: number; fastestHours: number; slowestHours: number; delayedCount: number; onTimePercentage: number; totalDelivered: number }> {
  const { data, error } = await supabase.from("deliveries").select("dispatch_date, delivered_at, expected_delivery_date, status").eq("status", "Delivered");
  if (error) throw error;
  const rows = (data ?? []) as Array<{ dispatch_date?: string | null; delivered_at?: string | null; expected_delivery_date?: string | null }>;
  const times: number[] = rows.filter(r => r.dispatch_date && r.delivered_at).map(r => (new Date(r.delivered_at as string).getTime() - new Date(r.dispatch_date as string).getTime()) / (1000 * 60 * 60));
  const average = times.length ? Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 100) / 100 : 0;
  const fastest = times.length ? Math.round(Math.min(...times) * 100) / 100 : 0;
  const slowest = times.length ? Math.round(Math.max(...times) * 100) / 100 : 0;
  const delayedCount = rows.filter(r => r.expected_delivery_date && r.delivered_at && new Date(r.delivered_at as string) > new Date(r.expected_delivery_date as string)).length;
  const onTime = rows.filter(r => r.expected_delivery_date && r.delivered_at && new Date(r.delivered_at as string) <= new Date(r.expected_delivery_date as string)).length;
  const onTimePercentage = rows.length ? Math.round((onTime / rows.length) * 10000) / 100 : 0;
  return { averageDeliveryTimeHours: average, fastestHours: fastest, slowestHours: slowest, delayedCount, onTimePercentage, totalDelivered: rows.length };
}

export async function confirmDelivery(deliveryId: string): Promise<boolean> { await updateDeliveryStatus(deliveryId, "Delivered"); return true; }

export function exportShipmentsToCSV(shipments: TransportShipment[]): void {
  const headers = ["Order Number", "Vehicle Number", "Driver Name", "Destination", "Status", "Dispatch Date", "Delivery Date"];
  const rows = shipments.map((row) => [row.order, row.vehicle, row.driver, row.dest, row.status, row.dispatch, row.delivery]);
  const csv = [headers.join(","), ...rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })); const link = document.createElement("a"); link.href = url; link.download = `transport-${Date.now()}.csv`; link.click(); URL.revokeObjectURL(url);
}

export async function exportTransportToExcel(): Promise<void> {
  const XLSX = await import("xlsx"); const report = await getTransportReportData(); const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.summary), "Delivery Summary"); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.driverPerformance), "Driver Performance"); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.vehicleUtilization), "Vehicle Utilization"); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.tracking), "Delivery Tracking History"); XLSX.writeFile(workbook, `transport-${Date.now()}.xlsx`);
}

export async function exportTransportToPDF(): Promise<void> {
  const report = await getTransportReportData();
  const lines = ["Transport Delivery Report", ...report.summary.map((row) => `${row.label}: ${row.value}`), "Driver Performance", ...report.driverPerformance.map((row) => JSON.stringify(row)), "Vehicle Utilization", ...report.vehicleUtilization.map((row) => JSON.stringify(row)), "Delivery Tracking History", ...report.tracking.map((row) => JSON.stringify(row))];
  const safe = (line: string) => line.replace(/[^\x20-\x7E]/g, "?").replace(/[()\\]/g, "");
  const stream = lines.map((line, index) => `BT /F1 10 Tf 40 ${760 - index * 14} Td (${safe(line)}) Tj ET`).join("\n");
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>", `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let pdf = "%PDF-1.4\n"; const offsets: number[] = [];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length; pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" })); const link = document.createElement("a"); link.href = url; link.download = `transport-${Date.now()}.pdf`; link.click(); URL.revokeObjectURL(url);
}

interface TransportReportData { summary: Array<{ label: string; value: number }>; driverPerformance: Array<Record<string, string | number>>; vehicleUtilization: Array<Record<string, string | number>>; tracking: DeliveryTrackingEntry[]; }
export async function getTransportReportData(): Promise<TransportReportData> {
  const metrics = await getDashboardMetrics(); const { data: deliveries, error } = await supabase.from("deliveries").select("id, driver_id, vehicle_id, status"); if (error) throw error;
  const { data: tracking, error: trackingError } = await supabase.from("delivery_tracking").select("delivery_id, status, location, remarks, updated_by, updated_at").order("updated_at", { ascending: true }); if (trackingError) throw trackingError;
  const rows = deliveries ?? [];
  const grouped = (key: "driver_id" | "vehicle_id"): Array<Record<string, string | number>> => Array.from(new Set(rows.map((row) => row[key]).filter((value): value is string => Boolean(value)))).map((id) => { const assigned = rows.filter((row) => row[key] === id); const completed = assigned.filter((row) => normalizeStatus(row.status) === "Delivered").length; const failed = assigned.filter((row) => normalizeStatus(row.status) === "Failed").length; return key === "driver_id" ? { driver_id: id, assigned_deliveries: assigned.length, completed_deliveries: completed, failed_deliveries: failed, success_rate: assigned.length ? Math.round(completed / assigned.length * 100) : 0 } as Record<string, string | number> : { vehicle_id: id, total_trips: assigned.length, completed_deliveries: completed, failed_deliveries: failed } as Record<string, string | number>; });
  return { summary: [{ label: "Total Deliveries", value: metrics.totalDeliveries }, { label: "Loaded", value: metrics.loaded }, { label: "Dispatched", value: metrics.dispatched }, { label: "In Transit", value: metrics.inTransit }, { label: "Awaiting Confirmation", value: metrics.awaitingConfirmation }, { label: "Delivered", value: metrics.delivered }, { label: "Failed", value: metrics.failed }, { label: "Cancelled", value: metrics.cancelled }, { label: "Delayed", value: metrics.delayed }], driverPerformance: grouped("driver_id"), vehicleUtilization: grouped("vehicle_id"), tracking: (tracking ?? []) as DeliveryTrackingEntry[] };
}
