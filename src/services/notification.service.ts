import { supabase } from "../lib/supabase";
import { isValidUUID } from "../utils/uuid";

export type NotificationEventType =
  | "bill_submitted"
  | "bill_approved"
  | "bill_rejected"
  | "order_created"
  | "large_order"
  | "dispatch_created"
  | "delivery_status_changed"
  | "delivery_delayed"
  | "delivery_confirmed"
  | "employee_recruited"
  | "employee_suspended"
  | "employee_activated"
  | "password_reset"
  | "attendance_absent_three_days"
  | "task_assigned"
  | "task_overdue"
  | "task_completed"
  | "leave_submitted"
  | "leave_approved"
  | "leave_rejected"
  | "report_generated"
  | "inventory_shortage"
  | "order_approved"
  | "order_rejected"
  | "custom";

export interface NotificationRecord {
  id: string;
  user_id: string;
  type: NotificationEventType;
  title: string;
  message: string;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  read: boolean;
  created_at: string | null;
  action_url?: string | null;
  forwarded_from?: string | null;
  forwarded_to?: string | null;
  forwarded_at?: string | null;
}

interface NotificationRow extends Record<string, unknown> {
  id?: string;
  user_id?: string | null;
  type?: string | null;
  title?: string | null;
  message?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  is_read?: boolean | null;
  created_at?: string | null;
  action_url?: string | null;
  forwarded_from?: string | null;
  forwarded_to?: string | null;
  forwarded_at?: string | null;
}

interface CreateNotificationPayload {
  userId: string;
  forwardedFrom?: string | null;
  forwardedTo?: string | null;
  forwardedAt?: string | null;
  type: NotificationEventType;
  title: string;
  message: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  actionUrl?: string | null;
}

function normalizeNotificationRecord(record: Record<string, unknown>): NotificationRecord {
  const type = String(record.type ?? "custom") as NotificationEventType;
  return {
    id: String(record.id ?? ""),
    user_id: String(record.user_id ?? ""),
    type,
    title: String(record.title ?? ""),
    message: String(record.message ?? ""),
    related_entity_type: record.related_entity_type ? String(record.related_entity_type) : null,
    related_entity_id: record.related_entity_id ? String(record.related_entity_id) : null,
    read: Boolean(record.is_read),
    created_at: record.created_at ? String(record.created_at) : null,
    action_url: record.action_url ? String(record.action_url) : null,
    forwarded_from: record.forwarded_from ? String(record.forwarded_from) : null,
    forwarded_to: record.forwarded_to ? String(record.forwarded_to) : null,
    forwarded_at: record.forwarded_at ? String(record.forwarded_at) : null,
  };
}

async function getProfilesByRoles(roles: string[]): Promise<Array<{ id: string; role: string; department: string }>> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, department")
    .in("role", roles);

  if (error) {
    console.error("Supabase query failed", error.message, error.details, error.hint);
    throw error;
  }
  return (data ?? []) as Array<{ id: string; role: string; department: string }>;
}

async function getProfilesByDepartmentAndRoles(department: string, roles: string[]): Promise<string[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .in("role", roles)
    .eq("department", department);

  if (error) {
    console.error("Supabase query failed", error.message, error.details, error.hint);
    throw error;
  }

  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => String(row.id || ""))
    .filter(Boolean);
}

async function getDirectManagerId(userId: string): Promise<string | null> {
  if (!isValidUUID(userId)) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("reports_to")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data?.reports_to as string | null) ?? null;
}

async function getNotificationRecipientsByManagerChain(userId: string): Promise<string[]> {
  const recipients = new Set<string>();
  let currentId = await getDirectManagerId(userId);

  while (currentId) {
    recipients.add(currentId);
    const nextManager = await getDirectManagerId(currentId);
    currentId = nextManager;
  }

  return Array.from(recipients);
}

export async function getSuperior(profileId: string): Promise<string | null> {
  if (!isValidUUID(profileId)) return null;
  const { data, error } = await supabase.from("profiles").select("reports_to").eq("id", profileId).maybeSingle();
  if (error) throw error;
  return (data?.reports_to as string | null) ?? null;
}

export async function getSupervisors(profileId: string, levels = 2): Promise<string[]> {
  if (!isValidUUID(profileId)) return [];
  const collected: string[] = [];
  let current = await getSuperior(profileId);
  let depth = 0;
  while (current && depth < levels) {
    if (!isValidUUID(current)) break;
    collected.push(current);
    // get next
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await supabase.from("profiles").select("reports_to").eq("id", current).maybeSingle();
    if (error) throw error;
    current = (data?.reports_to as string | null) ?? null;
    depth += 1;
  }
  return collected;
}

interface SendNotificationInput {
  recipients: string[];
  type: NotificationEventType;
  title: string;
  message: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  actionUrl?: string | null;
  forwardedFrom?: string | null;
  forwardedTo?: string | null;
  forwardedAt?: string | null;
}

export async function sendNotification(input: SendNotificationInput): Promise<NotificationRecord[]> {
  const dedup = Array.from(new Set(input.recipients.filter(Boolean)));
  if (dedup.length === 0) return [];
  const now = new Date().toISOString();
  const rows = dedup.map((r) => ({
    user_id: r,
    type: input.type,
    title: input.title,
    message: input.message,
    related_entity_type: input.relatedEntityType ?? null,
    related_entity_id: input.relatedEntityId ?? null,
    action_url: input.actionUrl ?? null,
    forwarded_from: input.forwardedFrom ?? null,
    forwarded_to: input.forwardedTo ?? null,
    forwarded_at: input.forwardedAt ?? null,
    is_read: false,
    created_at: now,
  }));

  const { data, error } = await supabase.from("notifications").insert(rows).select("*");
  if (error) {
    console.error("Supabase query failed", error.message, error.details, error.hint);
    throw error;
  }
  return ((data ?? []) as NotificationRow[]).map(normalizeNotificationRecord);
}

export async function notifyInventoryShortage(productName: string, productId: string | null, remainingStock: number, threshold = 5): Promise<NotificationRecord[]> {
  const recipientIds = await getRoleRecipients(["General Manager", "MD-Marketing"]);
  if (!recipientIds.length) return [];

  return sendNotification({
    recipients: recipientIds,
    type: "inventory_shortage",
    title: remainingStock < 0 ? `Urgent inventory shortage: ${productName}` : `Low stock alert: ${productName}`,
    message: remainingStock < 0
      ? `${productName} is now below zero stock (${remainingStock} units). Immediate action is required.`
      : `${productName} has only ${remainingStock} units left. Reorder before stock is depleted.`,
    relatedEntityType: "product",
    relatedEntityId: productId,
    actionUrl: "/marketing",
  });
}

export async function notifyOrderPendingApproval(orderId: string, orderNumber: string, customerName: string): Promise<NotificationRecord[]> {
  const recipientIds = await getRoleRecipients(["Vice Chairman", "MD-Marketing", "General Manager"]);
  if (!recipientIds.length) return [];

  return sendNotification({
    recipients: recipientIds,
    type: "order_created",
    title: `Order ${orderNumber} requires approval`,
    message: `New order ${orderNumber} from ${customerName} is pending approval.`,
    relatedEntityType: "order",
    relatedEntityId: orderId,
    actionUrl: "/marketing",
  });
}

export async function notifyOrderApproved(orderId: string, orderNumber: string): Promise<NotificationRecord[]> {
  const { data, error } = await supabase.from("orders").select("created_by").eq("id", orderId).maybeSingle();
  if (error) throw error;
  const creatorId = data?.created_by ? String((data as { created_by?: string }).created_by) : null;
  if (!creatorId) return [];

  return sendNotification({
    recipients: [creatorId],
    type: "order_approved",
    title: `Order ${orderNumber} has been approved`,
    message: `Order ${orderNumber} is now approved and ready for dispatch.`,
    relatedEntityType: "order",
    relatedEntityId: orderId,
    actionUrl: "/transport",
  });
}

export async function notifyOrderRejected(orderId: string, orderNumber: string, reason?: string): Promise<NotificationRecord[]> {
  const { data, error } = await supabase.from("orders").select("created_by").eq("id", orderId).maybeSingle();
  if (error) throw error;
  const creatorId = data?.created_by ? String((data as { created_by?: string }).created_by) : null;
  if (!creatorId) return [];

  return sendNotification({
    recipients: [creatorId],
    type: "order_rejected",
    title: `Order ${orderNumber} was rejected`,
    message: `Order ${orderNumber} has been rejected.${reason ? ` Reason: ${reason}` : ""}`,
    relatedEntityType: "order",
    relatedEntityId: orderId,
    actionUrl: "/marketing",
  });
}

export async function forwardNotification(originalNotificationId: string, forwardingUserId: string, targetUserId?: string, direction: "up" | "down" = "up"): Promise<NotificationRecord> {
  // Verify user received the notification
  const { data: originalData, error: origErr } = await supabase.from("notifications").select("*").eq("id", originalNotificationId).maybeSingle();
  if (origErr) {
    console.error("Supabase query failed", origErr.message, origErr.details, origErr.hint);
    throw origErr;
  }
  const original = (originalData ?? null) as NotificationRow | null;
  if (!original) throw new Error("Original notification not found");
  if (String(original.user_id ?? "") !== forwardingUserId) throw new Error("You may only forward notifications you received");

  const recipient = targetUserId ? targetUserId : await getHierarchyRecipient(forwardingUserId, direction);
  if (!recipient) throw new Error("No recipient available for forwarding");
  if (recipient === forwardingUserId) throw new Error("Cannot forward a notification to yourself");

  const now = new Date().toISOString();
  const row = {
    user_id: recipient,
    type: original.type ?? "custom",
    title: String(original.title ?? "Forwarded Notification"),
    message: String(original.message ?? ""),
    related_entity_type: original.related_entity_type ?? null,
    related_entity_id: original.related_entity_id ?? null,
    action_url: original.action_url ?? null,
    forwarded_from: forwardingUserId,
    forwarded_to: recipient,
    forwarded_at: now,
    is_read: false,
    created_at: now,
  } as NotificationRow;

  const { data, error } = await supabase.from("notifications").insert([row]).select("*");
  if (error) {
    console.error("Supabase query failed", error.message, error.details, error.hint);
    throw error;
  }
  const [created] = (data ?? []) as NotificationRow[];
  return normalizeNotificationRecord(created);
}

async function getHierarchyRecipient(userId: string, direction: "up" | "down"): Promise<string | null> {
  if (direction === "down") {
    const { data, error } = await supabase.from("profiles").select("id").eq("reports_to", userId).order("created_at", { ascending: true }).limit(1);
    if (error) throw error;
    return (data?.[0]?.id as string | null) ?? null;
  }

  const { data, error } = await supabase.from("profiles").select("reports_to").eq("id", userId).maybeSingle();
  if (error) throw error;
  return (data?.reports_to as string | null) ?? null;
}

export async function getNotificationHistory(notificationId: string): Promise<NotificationRecord[]> {
  const { data, error } = await supabase.from("notifications").select("*").eq("id", notificationId).maybeSingle();
  if (error) throw error;
  if (!data) return [];
  return [normalizeNotificationRecord(data as NotificationRow)];
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  // only owner may mark
  const { data, error } = await supabase.from("notifications").select("user_id").eq("id", notificationId).maybeSingle();
  if (error) {
    console.error("Supabase query failed", error.message, error.details, error.hint);
    throw error;
  }
  if (!data) throw new Error("Notification not found");
  if (String((data as NotificationRow).user_id ?? "") !== userId) throw new Error("Not authorized");
  const { error: uErr } = await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
  if (uErr) {
    console.error("Supabase query failed", uErr.message, uErr.details, uErr.hint);
    throw uErr;
  }
}

export async function markNotificationUnread(notificationId: string, userId: string): Promise<void> {
  const { data, error } = await supabase.from("notifications").select("user_id").eq("id", notificationId).maybeSingle();
  if (error) {
    console.error("Supabase query failed", error.message, error.details, error.hint);
    throw error;
  }
  if (!data) throw new Error("Notification not found");
  if (String((data as NotificationRow).user_id ?? "") !== userId) throw new Error("Not authorized");
  const { error: uErr } = await supabase.from("notifications").update({ is_read: false }).eq("id", notificationId);
  if (uErr) {
    console.error("Supabase query failed", uErr.message, uErr.details, uErr.hint);
    throw uErr;
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_read", false);
  if (error) {
    console.error("Supabase query failed", error.message, error.details, error.hint);
    throw error;
  }
  return count ?? 0;
}

export async function getNotifications(userId: string): Promise<NotificationRecord[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase query failed", error.message, error.details, error.hint);
    throw error;
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map(normalizeNotificationRecord);
}

export async function createNotifications(payloads: CreateNotificationPayload[]): Promise<NotificationRecord[]> {
  if (payloads.length === 0) {
    return [];
  }

  const rows = payloads.map((entry) => ({
    user_id: entry.userId,
    type: entry.type,
    title: entry.title,
    message: entry.message,
    related_entity_type: entry.relatedEntityType ?? null,
    related_entity_id: entry.relatedEntityId ?? null,
    action_url: entry.actionUrl ?? null,
    forwarded_from: entry.forwardedFrom ?? null,
    forwarded_to: entry.forwardedTo ?? null,
    forwarded_at: entry.forwardedAt ?? null,
    is_read: false,
    created_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from("notifications")
    .insert(rows)
    .select("*");

  if (error) {
    console.error("Supabase query failed", error.message, error.details, error.hint);
    throw error;
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map(normalizeNotificationRecord);
}

// Abstraction for sending delivery OTPs. Provider integration is intentionally left
// as a TODO so different providers (MSG91, Twilio, Fast2SMS, TextLocal) may be
// integrated on the backend or here via a pluggable adapter. This function will
// still create in-app notifications so the workflow works even without an SMS
// provider configured.
export async function sendDeliveryOTP(deliveryId: string, otp: string): Promise<void> {
  // Fetch delivery + customer phone
  const { data, error } = await supabase.from("deliveries").select("id, order_id, driver_id").eq("id", deliveryId).maybeSingle();

  if (error) {
    console.error("sendDeliveryOTP: failed to fetch delivery", error);
    return;
  }

  const delivery = data as { id?: string; order_id?: string | null; driver_id?: string } | null;
  let phone: string | null = null;
  let company = "Prajahita Trust";
  if (delivery?.order_id) {
    const { data: order } = await supabase.from("orders").select("customer_id").eq("id", delivery.order_id).maybeSingle();
    if (order?.customer_id) {
      const { data: customer } = await supabase.from("customers").select("phone, name").eq("id", order.customer_id).maybeSingle();
      phone = customer?.phone ?? null;
      company = customer?.name || company;
    }
  }

  // TODO: Implement provider-specific sending here (server-side recommended).
  // Example: call a serverless function that forwards to Twilio/MSG91 etc.

  // Create in-app notifications for driver and MD Transport so the OTP is visible
  // in the application even if SMS isn't delivered.
  const recipients: string[] = [];
  if (delivery?.driver_id) recipients.push(String(delivery.driver_id));
  try {
    await createNotifications(recipients.map((r) => ({
      userId: r,
      type: "delivery_confirmed",
      title: "Delivery OTP Sent",
      message: `${company}\nYour delivery verification OTP is: ${otp}\nShare this OTP only after receiving the shipment.`,
      relatedEntityType: "delivery",
      relatedEntityId: deliveryId,
      actionUrl: "/transport",
    })));
  } catch (err) {
    console.error("sendDeliveryOTP: failed to create in-app notifications", err);
  }

  // If phone is present, leave a TODO to integrate an SMS provider.
  if (!phone) {
    // No phone configured; application still records the OTP in DB.
    return;
  }

  // TODO: Send SMS via configured provider. Example provider call should be
  // implemented server-side and invoked from here with a secure key.
}

export async function createNotification(payload: CreateNotificationPayload): Promise<NotificationRecord> {
  const [created] = await createNotifications([payload]);
  return created;
}

export async function markAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);

  if (error) throw error;
}

export async function markAllAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    console.error("Supabase query failed", error.message, error.details, error.hint);
    throw error;
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId);

  if (error) throw error;
}

export async function getDepartmentRoleRecipients(department: string, roles: string[]): Promise<string[]> {
  return getProfilesByDepartmentAndRoles(department, roles);
}

export async function getRoleRecipients(roles: string[]): Promise<string[]> {
  const profiles = await getProfilesByRoles(roles);
  return profiles.map((profile) => profile.id);
}

export async function getManagerRecipients(userId: string): Promise<string[]> {
  return getNotificationRecipientsByManagerChain(userId);
}

export async function getDirectManagerRecipient(userId: string): Promise<string | null> {
  return getDirectManagerId(userId);
}
