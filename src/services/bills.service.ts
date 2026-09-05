import { supabase } from "../lib/supabase";
import { canApproveSubordinate } from "./hierarchy.service";

export type BillStatus =
  | "Draft"
  | "Pending Approval"
  | "Approved"
  | "Reviewed"
  | "Rejected"
  | "Returned for Correction";

export interface BillRecord {
  id: string;
  ref: string;
  title: string;
  vendor: string;
  department: string;
  amount: number;
  gst: number;
  date: string;
  due_date: string | null;
  status: BillStatus;
  submitter: string;
  submitter_role: string;
  time: string;
  description: string;
  attachment_url: string | null;
  submitted_by: string | null;
  approved_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  return_reason: string | null;
  returned_by: string | null;
  returned_at: string | null;
  rejection_reason: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  approval_cancelled_by: string | null;
  approval_cancelled_at: string | null;
  approval_cancel_reason: string | null;
  last_action_by: string | null;
  last_action_at: string | null;
  bill_number: string;
  created_at: string | null;
}

export interface BillHistory {
  id: string;
  bill_id: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  comments: string | null;
  performed_by: string | null;
  performed_role: string | null;
  created_at: string | null;
}

export interface BillAttachment {
  file_name: string;
  attachment_url?: string | null;
  storage_path?: string | null;
}

interface BillRow {
  id?: string;
  bill_number?: string | null;
  title?: string | null;
  vendor_name?: string | null;
  amount?: number | string | null;
  status?: string | null;
  submitted_by?: string | null;
  submitted_role?: string | null;
  approved_by?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  return_reason?: string | null;
  returned_by?: string | null;
  returned_at?: string | null;
  rejection_reason?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  approval_cancelled_by?: string | null;
  approval_cancelled_at?: string | null;
  approval_cancel_reason?: string | null;
  last_action_by?: string | null;
  last_action_at?: string | null;
  created_at?: string | null;
  department?: string | null;
  gst?: number | string | null;
  bill_date?: string | null;
  due_date?: string | null;
  description?: string | null;
  attachment_url?: string | null;
}

function isExec(role: string) {
  return ["Vice Chairman", "Vice President"].includes(role);
}

async function getCurrentAuthenticatedUserId(): Promise<string | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Unable to resolve authenticated user for bill workflow", error);
    return null;
  }
  return user?.id ?? null;
}

function isMD(role: string) {
  return role.startsWith("MD-");
}

function normalizeDepartmentKey(department: string) {
  return String(department || "").replace(/\s+/g, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function isMDOfDepartment(role: string, department: string) {
  if (!isMD(role)) return false;
  const roleDept = role.replace("MD-", "").toUpperCase();
  const departmentKeys: Record<string, string[]> = {
    MANUFACTURING: ["MANUFACTURING"],
    MARKETING: ["MARKETING"],
    TRANSPORT: ["TRANSPORT", "TRANSPORTATION"],
    RD: ["RD", "RND", "RESEARCHANDDEVELOPMENT", "RESEARCHDEVELOPMENT"],
  };
  return departmentKeys[roleDept]?.includes(normalizeDepartmentKey(department)) ?? false;
}

function canApprovePendingBill(role: string, department: string) {
  return ["Vice Chairman", "Vice President", "General Manager"].includes(role) || isMDOfDepartment(role, department);
}

function normalizeBillStatus(status: string | null | undefined): BillStatus {
  const maybe = String(status || "");
  const validStatuses: BillStatus[] = [
    "Draft",
    "Pending Approval",
    "Approved",
    "Reviewed",
    "Rejected",
    "Returned for Correction",
  ];
  const legacyMap: Record<string, BillStatus> = {
    Submitted: "Pending Approval",
    "Pending Verification": "Pending Approval",
    Passed: "Reviewed",
    "Payment Completed": "Approved",
  };
  return validStatuses.includes(maybe as BillStatus) ? (maybe as BillStatus) : legacyMap[maybe] ?? "Pending Approval";
}

function getNextStatusForApproval(currentStatus: BillStatus, actorRole: string): BillStatus | null {
  if (currentStatus === "Draft") {
    return "Pending Approval";
  }

  if (currentStatus === "Pending Approval") {
    return ["Vice Chairman", "Vice President", "General Manager"].includes(actorRole) || isMD(actorRole) ? "Approved" : null;
  }

  if (currentStatus === "Approved") {
    return actorRole === "Vice Chairman" ? "Reviewed" : null;
  }

  return null;
}

function formatTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function mapBillRecord(entry: BillRow): BillRecord {
  const amount = Number(entry.amount ?? 0);
  const gst = Number(entry.gst ?? 0);
  const billDate = entry.bill_date ?? entry.created_at ?? "";

  return {
    id: entry.id ?? "",
    ref: entry.bill_number ?? entry.id ?? "",
    title: entry.title ?? entry.bill_number ?? "",
    vendor: entry.vendor_name ?? "Unknown Vendor",
    department: entry.department ?? "",
    amount,
    gst,
    date: billDate,
    due_date: entry.due_date ?? "",
    status: normalizeBillStatus(entry.status),
    submitter: entry.submitted_by ?? "",
    submitter_role: entry.submitted_role ?? "",
    time: formatTime(entry.created_at ?? null),
    description: entry.description ?? "",
    attachment_url: entry.attachment_url ?? null,
    submitted_by: entry.submitted_by ?? null,
    approved_by: entry.approved_by ?? null,
    reviewed_by: entry.reviewed_by ?? null,
    reviewed_at: entry.reviewed_at ?? null,
    return_reason: entry.return_reason ?? null,
    returned_by: entry.returned_by ?? null,
    returned_at: entry.returned_at ?? null,
    rejection_reason: entry.rejection_reason ?? null,
    rejected_by: entry.rejected_by ?? null,
    rejected_at: entry.rejected_at ?? null,
    approval_cancelled_by: entry.approval_cancelled_by ?? null,
    approval_cancelled_at: entry.approval_cancelled_at ?? null,
    approval_cancel_reason: entry.approval_cancel_reason ?? null,
    last_action_by: entry.last_action_by ?? null,
    last_action_at: entry.last_action_at ?? null,
    bill_number: entry.bill_number ?? entry.id ?? "",
    created_at: entry.created_at ?? null,
  };
}

export async function getBills(): Promise<BillRecord[]> {
  const { data, error } = await supabase.from("bills").select("*").order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((entry: BillRow) => mapBillRecord(entry));
}

export async function getPendingBills(): Promise<BillRecord[]> {
  const bills = await getBills();
  return bills.filter((bill) => [
    "Draft",
    "Pending Approval",
    "Approved",
    "Reviewed",
  ].includes(bill.status));
}

async function updateBillStatus(
  id: string,
  nextStatus: BillStatus,
  actorId?: string | null,
  actorRole?: string,
  note?: string,
  currentStatus?: BillStatus,
): Promise<BillRecord> {
  const resolvedActorId = actorId ?? (await getCurrentAuthenticatedUserId());
  const updatePayload: {
    status: BillStatus;
    approved_by?: string | null;
    reviewed_by?: string | null;
    reviewed_at?: string | null;
    return_reason?: string | null;
    returned_by?: string | null;
    returned_at?: string | null;
    rejection_reason?: string | null;
    rejected_by?: string | null;
    rejected_at?: string | null;
    last_action_by?: string | null;
    last_action_at?: string | null;
  } = {
    status: nextStatus,
    last_action_by: resolvedActorId ?? null,
    last_action_at: new Date().toISOString(),
  };

  if (nextStatus === "Approved") {
    updatePayload.approved_by = resolvedActorId ?? null;
  }

  if (nextStatus === "Reviewed") {
    updatePayload.reviewed_by = resolvedActorId ?? null;
    updatePayload.reviewed_at = new Date().toISOString();
    updatePayload.approved_by = resolvedActorId ?? null;
  }

  if (nextStatus === "Returned for Correction") {
    updatePayload.return_reason = note ?? "Bill returned for correction";
    updatePayload.returned_by = resolvedActorId ?? null;
    updatePayload.returned_at = new Date().toISOString();
  }

  if (nextStatus === "Rejected") {
    updatePayload.rejection_reason = note ?? "Bill rejected";
    updatePayload.rejected_by = resolvedActorId ?? null;
    updatePayload.rejected_at = new Date().toISOString();
  }

  const { data, error } = await supabase.from("bills").update(updatePayload).eq("id", id).select().single();

  if (error) {
    throw error;
  }

  await insertBillHistory({
    bill_id: id,
    action: nextStatus.toLowerCase().replace(/ /g, "_"),
    old_status: currentStatus ?? null,
    new_status: nextStatus,
    performed_by: resolvedActorId ?? actorId ?? null,
    role: actorRole ?? "Unknown",
    note: note ?? `Bill status changed to ${nextStatus}`,
  });

  return mapBillRecord(data as BillRow);
}

export async function updateBill(id: string, payload: Partial<BillRecord> & {
  submitted_by?: string | null;
  submitted_role?: string | null;
  bill_number?: string;
  title?: string;
  vendor?: string;
  department?: string;
  amount?: number | string;
  gst?: number | string;
  bill_date?: string | null;
  due_date?: string | null;
  description?: string;
  attachment_url?: string | null;
}) {
  const nextStatus: BillStatus = payload.status === "Draft" ? "Draft" : "Pending Approval";
  const resolvedActorId = payload.submitted_by ?? (await getCurrentAuthenticatedUserId());
  const dbPayload = {
    bill_number: payload.bill_number ?? payload.ref ?? `BILL-${Date.now()}`,
    title: payload.title ?? payload.ref ?? `Bill ${new Date().toLocaleDateString("en-IN")}`,
    vendor_name: payload.vendor ?? "",
    amount: Number(payload.amount ?? 0),
    status: nextStatus,
    submitted_by: resolvedActorId ?? null,
    approved_by: null,
    department: payload.department ?? "",
    gst: Number(payload.gst ?? 0),
    bill_date: payload.bill_date ?? payload.date ?? new Date().toISOString().slice(0, 10),
    due_date: payload.due_date ?? null,
    description: payload.description ?? "",
    attachment_url: payload.attachment_url ?? null,
  };

  const { data, error } = await supabase.from("bills").update(dbPayload).eq("id", id).select().single();
  if (error) throw error;

  await insertBillHistory({
    bill_id: id,
    action: nextStatus === "Draft" ? "updated_draft" : "resubmitted",
    performed_by: resolvedActorId ?? null,
    role: payload.submitted_role ?? "Manager",
    note: nextStatus === "Draft" ? "Bill updated as draft" : "Bill resubmitted for approval",
  });
  return data;
}

export async function createBill(payload: Partial<BillRecord> & {
  submitted_by?: string | null;
  submitted_role?: string | null;
  bill_number?: string;
  title?: string;
  vendor?: string;
  department?: string;
  amount?: number | string;
  gst?: number | string;
  bill_date?: string | null;
  due_date?: string | null;
  description?: string;
  attachment_url?: string | null;
}) {
  const initialStatus: BillStatus = payload.status === "Draft" ? "Draft" : "Pending Approval";
  const resolvedActorId = payload.submitted_by ?? (await getCurrentAuthenticatedUserId());
  const dbPayload = {
    bill_number: payload.bill_number ?? payload.ref ?? `BILL-${Date.now()}`,
    title: payload.title ?? payload.ref ?? `Bill ${new Date().toLocaleDateString("en-IN")}`,
    vendor_name: payload.vendor ?? "",
    amount: Number(payload.amount ?? 0),
    status: initialStatus,
    submitted_by: resolvedActorId ?? null,
    approved_by: null,
    created_at: new Date().toISOString(),
    department: payload.department ?? "",
    gst: Number(payload.gst ?? 0),
    bill_date: payload.bill_date ?? payload.date ?? new Date().toISOString().slice(0, 10),
    due_date: payload.due_date ?? null,
    description: payload.description ?? "",
    attachment_url: payload.attachment_url ?? null,
  };

  const { data, error } = await supabase.from("bills").insert([dbPayload]).select().single();

  if (error) {
    throw error;
  }

  await insertBillHistory({
    bill_id: data.id,
    action: initialStatus === "Draft" ? "saved_draft" : "submitted",
    performed_by: resolvedActorId ?? null,
    role: payload.submitted_role ?? "Manager",
    note: initialStatus === "Draft" ? "Bill saved as draft" : "Bill submitted for approval",
  });
  return data;
}

const BILL_ATTACHMENT_BUCKET = "bill-attachments";
const BILL_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
]);
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

export async function uploadBillAttachments(files: File[]): Promise<BillAttachment[]> {
  const attachments: BillAttachment[] = [];

  for (const file of files) {
    const extension = file.name.toLowerCase().split(".").pop() ?? "";
    const isAllowedType = BILL_ATTACHMENT_TYPES.has(file.type) || ["pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png"].includes(extension);
    if (!isAllowedType) {
      throw new Error(`Unsupported attachment type: ${file.name}`);
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      throw new Error(`Attachment exceeds 10MB: ${file.name}`);
    }

    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "-");
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(BILL_ATTACHMENT_BUCKET)
      .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });

    if (uploadError) throw uploadError;

    attachments.push({ file_name: file.name, storage_path: path });
  }

  return attachments;
}

export async function viewBillAttachment(attachment: BillAttachment): Promise<string> {
  if (attachment.attachment_url && /^https?:\/\//i.test(attachment.attachment_url)) {
    return attachment.attachment_url;
  }

  const storagePath = attachment.storage_path || attachment.attachment_url;
  if (!storagePath) {
    throw new Error("Attachment is missing a storage path.");
  }

  const { data, error } = await supabase.storage.from(BILL_ATTACHMENT_BUCKET).createSignedUrl(storagePath, 60 * 60 * 24);
  if (error || !data?.signedUrl) {
    throw error ?? new Error("Unable to create attachment view URL.");
  }

  return data.signedUrl;
}

export async function downloadBillAttachment(attachment: BillAttachment): Promise<string> {
  return viewBillAttachment(attachment);
}

async function insertBillHistory({
  bill_id,
  action,
  old_status,
  new_status,
  performed_by,
  note,
  role,
}: {
  bill_id: string;
  action: string;
  old_status?: string | null;
  new_status?: string | null;
  performed_by?: string | null;
  note?: string;
  role?: string;
}) {
  const resolvedPerformerId = performed_by ?? (await getCurrentAuthenticatedUserId());
  const { error } = await supabase
    .from("bill_history")
    .insert([
      {
        bill_id,
        action,
        old_status: old_status ?? null,
        new_status: new_status ?? null,
        comments: note ?? "",
        performed_by: resolvedPerformerId ?? null,
        performed_role: role ?? "",
        created_at: new Date().toISOString(),
      },
    ]);

  if (error) {
    console.error("Bill History Error:", error);
    throw error;
  }
}

export async function getBillHistory(billId: string): Promise<BillHistory[]> {
  const { data, error } = await supabase
    .from("bill_history")
    .select("*")
    .eq("bill_id", billId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as BillHistory[];
}

export async function approveBill(id: string, actorId?: string | null, actorRole?: string, note?: string): Promise<BillRecord> {
  const bill = await getBillById(id);
  const role = actorRole ?? "";
  const resolvedActorId = actorId ?? await getCurrentAuthenticatedUserId();

  if (bill.status !== "Pending Approval" || !canApprovePendingBill(role, bill.department)) {
    throw new Error("Only the Vice Chairman, Vice President, General Manager, or the department MD can approve this bill.");
  }
  if (!resolvedActorId || !bill.submitted_by || !(await canApproveSubordinate(resolvedActorId, bill.submitted_by))) {
    throw new Error("Only a higher-level approver in the bill creator's hierarchy can approve this bill.");
  }

  const nextStatus = getNextStatusForApproval(bill.status, role);
  if (!nextStatus) {
    throw new Error(`Cannot advance bill from ${bill.status} using role ${role}`);
  }

  return updateBillStatus(id, nextStatus, actorId, actorRole, note ?? `Bill moved to ${nextStatus}`, bill.status);
}

export async function reviewBill(id: string, actorId?: string | null, actorRole?: string, note?: string): Promise<BillRecord> {
  const bill = await getBillById(id);
  const role = actorRole ?? "";
  if (role !== "Vice Chairman" || bill.status !== "Approved") {
    throw new Error("Only the Vice Chairman can review an approved bill.");
  }

  return updateBillStatus(id, "Reviewed", actorId, actorRole, note ?? "Bill reviewed", bill.status);
}

export async function rejectBill(id: string, actorId?: string | null, actorRole?: string, note?: string): Promise<BillRecord> {
  const bill = await getBillById(id);
  const role = actorRole ?? "";
  const resolvedActorId = actorId ?? await getCurrentAuthenticatedUserId();
  if (!resolvedActorId || !bill.submitted_by || !(await canApproveSubordinate(resolvedActorId, bill.submitted_by))) {
    throw new Error("Only a higher-level approver in the bill creator's hierarchy can reject this bill.");
  }
  const canReject =
    (bill.status === "Approved" && (isMDOfDepartment(role, bill.department) || role === "Vice Chairman")) ||
    (bill.status === "Reviewed" && role === "Vice Chairman") ||
    (bill.status === "Pending Approval" && canApprovePendingBill(role, bill.department));
  if (!canReject) {
    throw new Error(`Cannot reject bill from ${bill.status} using role ${role}`);
  }

  const nextStatus: BillStatus = "Rejected";
  return updateBillStatus(id, nextStatus, actorId, actorRole, note ?? "Bill rejected", bill.status);
}

export async function returnBill(id: string, actorId?: string | null, actorRole?: string, note?: string): Promise<BillRecord> {
  const bill = await getBillById(id);
  const role = actorRole ?? "";
  const resolvedActorId = actorId ?? await getCurrentAuthenticatedUserId();
  if (!resolvedActorId || !bill.submitted_by || !(await canApproveSubordinate(resolvedActorId, bill.submitted_by))) {
    throw new Error("Only a higher-level approver in the bill creator's hierarchy can return this bill.");
  }
  const canReturn =
    (bill.status === "Approved" && (isMDOfDepartment(role, bill.department) || role === "Vice Chairman")) ||
    (bill.status === "Reviewed" && role === "Vice Chairman") ||
    (bill.status === "Pending Approval" && canApprovePendingBill(role, bill.department));
  if (!canReturn) {
    throw new Error(`Cannot return bill from ${bill.status} using role ${role}`);
  }

  const nextStatus: BillStatus = "Returned for Correction";
  return updateBillStatus(id, nextStatus, actorId, actorRole, note ?? "Bill returned for correction", bill.status);
}

export async function cancelApprovalBill(id: string, actorId?: string | null, actorRole?: string, reason?: string) {
  const bill = await getBillById(id);
  if (actorRole !== "Vice Chairman") {
    throw new Error("Only the Vice Chairman can cancel approval.");
  }

  const resolvedActorId = actorId ?? (await getCurrentAuthenticatedUserId());
  const { data, error } = await supabase
    .from("bills")
    .update({
      status: "Pending Approval",
      approved_by: null,
      approval_cancelled_by: resolvedActorId ?? null,
      approval_cancelled_at: new Date().toISOString(),
      approval_cancel_reason: reason ?? "Approval cancelled by Vice Chairman",
      last_action_by: resolvedActorId ?? null,
      last_action_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  await insertBillHistory({
    bill_id: id,
    action: "cancel_approval",
    old_status: bill.status,
    new_status: "Pending Approval",
    performed_by: resolvedActorId ?? null,
    role: actorRole ?? "Vice Chairman",
    note: reason ?? "Approval cancelled by Vice Chairman",
  });

  return mapBillRecord(data as BillRow);
}

export async function getBillById(id: string) {
  const { data, error } = await supabase.from("bills").select("*").eq("id", id).single();

  if (error) {
    throw error;
  }

  return mapBillRecord(data as BillRow);
}

export async function exportBillToPDF(bill: BillRecord): Promise<void> {
  const attachments = getBillAttachments(bill.attachment_url);
  const history = await getBillHistory(bill.id);
  const approvalComments = history.filter((entry) => /approved|reviewed|passed|payment_completed|rejected|returned/.test(entry.action)).map((entry) => `${entry.action.replace(/_/g, " ")} — ${entry.comments ?? "No comment"}`).join("\\n");
  const content = [
    `Bill: ${bill.ref}`,
    `Vendor: ${bill.vendor}`,
    `Department: ${bill.department}`,
    `Amount: ₹${bill.amount.toLocaleString()}`,
    `GST: ₹${bill.gst.toLocaleString()}`,
    `Status: ${bill.status}`,
    "",
    "History:",
    ...history.map((entry) => `- ${entry.action.replace(/_/g, " ")} (${entry.created_at ?? ""}) :: ${entry.comments ?? ""}`),
    "",
    "Attachments:",
    ...attachments.map((attachment) => `- ${attachment.file_name}: ${attachment.attachment_url}`),
    "",
    "Approvals / Notes:",
    approvalComments || "No approvals recorded",
  ].join("\n");

  const blob = new Blob([content], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bill-${bill.ref || bill.id}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportBillsToXLSX(bills: BillRecord[]): Promise<void> {
  if (bills.length === 0) {
    alert("No bills to export");
    return;
  }

  const XLSX = await import("xlsx");
  const { data: historyRows, error: historyError } = await supabase
    .from("bill_history")
    .select("id, bill_id, action, comments, performed_by, performed_role, created_at")
    .in("bill_id", bills.map((bill) => bill.id))
    .order("created_at", { ascending: true });
  if (historyError) throw historyError;
  const rows = bills.map((bill) => ({
    invoice_number: bill.bill_number,
    title: bill.title,
    vendor_name: bill.vendor,
    department: bill.department,
    amount: bill.amount,
    gst: bill.gst,
    bill_date: bill.date,
    due_date: bill.due_date,
    status: bill.status,
    created_by: bill.submitted_by,
    description: bill.description,
    attachment_url: bill.attachment_url,
    created_at: bill.created_at,
  }));
  const sheet = XLSX.utils.json_to_sheet(rows, { header: [
    "invoice_number", "title", "vendor_name", "department", "amount", "gst", "bill_date", "due_date",
    "status", "created_by", "description", "attachment_url", "created_at",
  ] });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Bills");
  const history = (historyRows ?? []).map((entry) => ({
    bill_id: entry.bill_id,
    action: entry.action,
    performed_by: entry.performed_by,
    role: entry.performed_role,
    comments: entry.comments,
    timestamp: entry.created_at,
  }));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(history), "Bill History");
  const attachments = bills.flatMap((bill) => {
    const raw = getBillAttachments(bill.attachment_url);
    return raw.map((attachment) => ({ bill_id: bill.id, ...attachment }));
  });
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(attachments), "Attachments");
  XLSX.writeFile(workbook, `bills_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function getBillAttachments(value: string | null): BillAttachment[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.flatMap((item): BillAttachment[] => {
        if (typeof item === "string") {
          const normalizedValue = item.trim();
          return [{
            file_name: normalizedValue.split("/").pop() ?? normalizedValue,
            attachment_url: /^https?:\/\//i.test(normalizedValue) ? normalizedValue : null,
            storage_path: /^https?:\/\//i.test(normalizedValue) ? null : normalizedValue,
          }];
        }
        if (typeof item === "object" && item !== null) {
          const record = item as { file_name?: unknown; attachment_url?: unknown; storage_path?: unknown };
          if (typeof record.file_name === "string") {
            const attachmentUrl = typeof record.attachment_url === "string" ? record.attachment_url : null;
            const storagePath = typeof record.storage_path === "string" ? record.storage_path : null;
            return [{
              file_name: record.file_name,
              attachment_url: attachmentUrl,
              storage_path: storagePath,
            }];
          }
        }
        return [];
      });
    }
  } catch {
    const normalizedValue = value.trim();
    return [{
      file_name: normalizedValue.split("/").pop() ?? normalizedValue,
      attachment_url: /^https?:\/\//i.test(normalizedValue) ? normalizedValue : null,
      storage_path: /^https?:\/\//i.test(normalizedValue) ? null : normalizedValue,
    }];
  }
  return [{
    file_name: value.split("/").pop() ?? value,
    attachment_url: null,
    storage_path: value,
  }];
}

