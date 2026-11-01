import { supabase } from "../lib/supabase";
import { getCurrentProfile, getHierarchyProfiles, getVisibleProfilesForUser } from "./hierarchy.service";
import {
  type LeaveApprovalHistory,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveRequestInput,
  getLeaveTotalDays,
  validateLeaveRequestInput,
} from "../types/leave.types";

export interface LeaveReviewInput {
  decision: "Approved" | "Rejected";
  remarks?: string;
}

async function resolveAuthenticatedEmployeeId(employeeId: string, operation: string): Promise<string> {
  if (!employeeId?.trim()) throw new Error(`Leave ${operation} requires an employee ID`);

  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const authenticatedId = data.user?.id;
  if (!authenticatedId) throw new Error(`Leave ${operation} requires an authenticated employee`);
  if (authenticatedId !== employeeId) {
    throw new Error(`Leave ${operation} employee ID does not match the authenticated profile`);
  }

  console.info(`[Leave] ${operation} employeeId`, authenticatedId);
  return authenticatedId;
}

export async function createLeaveRequest(input: LeaveRequestInput): Promise<string> {
  validateLeaveRequestInput(input);
  const { data, error } = await supabase.rpc("submit_leave_request", {
    p_leave_type: input.leaveType,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_reason: input.reason.trim(),
  });
  if (error) throw error;
  if (typeof data !== "string" || !data) throw new Error("Leave request was not created");
  return data;
}

export async function getLeaveRequests(employeeId?: string): Promise<LeaveRequest[]> {
  let query = supabase.from("leave_requests").select("*").order("created_at", { ascending: false });
  if (employeeId) {
    const authenticatedId = await resolveAuthenticatedEmployeeId(employeeId, "request lookup");
    query = query.eq("employee_id", authenticatedId);
  }
  const { data, error } = await query;
  if (error) throw error;
  const requests = (data ?? []) as LeaveRequest[];
  console.info("[Leave] request lookup rows", requests.length);
  return requests;
}

export async function getLeaveRequestsForUser(employeeId: string, role: string): Promise<LeaveRequest[]> {
  const visibleProfiles = await getVisibleProfilesForUser(employeeId, role);
  const visibleIds = visibleProfiles.map((profile) => profile.id);
  let query = supabase.from("leave_requests").select("*");
  query = role === "Worker" ? query.eq("employee_id", employeeId) : query.in("employee_id", visibleIds);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LeaveRequest[];
}

export async function getDirectLeaveRequestsForUser(employeeId: string, role: string): Promise<LeaveRequest[]> {
  const current = await getCurrentProfile(employeeId);
  const profiles = await getHierarchyProfiles();
  const directIds = profiles.filter((profile) => profile.reports_to === employeeId && String(profile.department ?? "").trim().toLowerCase() === String(current.department ?? "").trim().toLowerCase()).map((profile) => profile.id);
  const { data, error } = await supabase.from("leave_requests").select("*").in("employee_id", directIds).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LeaveRequest[];
}

export async function getLeaveRequest(leaveId: string): Promise<LeaveRequest | null> {
  const { data, error } = await supabase.from("leave_requests").select("*").eq("id", leaveId).maybeSingle();
  if (error) throw error;
  return (data as LeaveRequest | null) ?? null;
}

export async function updateLeaveRequest(leaveId: string, input: LeaveRequestInput): Promise<string> {
  validateLeaveRequestInput(input);
  const { data, error } = await supabase.rpc("update_leave_request", {
    p_leave_id: leaveId,
    p_leave_type: input.leaveType,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_reason: input.reason.trim(),
  });
  if (error) throw error;
  if (typeof data !== "string") throw new Error("Leave request was not updated");
  return data;
}

export async function approveLeaveRequest(leaveId: string, remarks?: string): Promise<LeaveRequest> {
  return reviewLeaveRequest(leaveId, { decision: "Approved", remarks });
}

export async function rejectLeaveRequest(leaveId: string, remarks: string): Promise<LeaveRequest> {
  if (!remarks?.trim()) throw new Error("A rejection reason is required");
  return reviewLeaveRequest(leaveId, { decision: "Rejected", remarks });
}

export async function reviewLeaveRequest(leaveId: string, input: LeaveReviewInput): Promise<LeaveRequest> {
  if (input.decision === "Rejected" && !input.remarks?.trim()) throw new Error("A rejection reason is required");
  const authenticated = await supabase.auth.getUser();
  if (authenticated.error || !authenticated.data.user) throw authenticated.error ?? new Error("Authentication required");
  const { data, error } = await supabase.rpc("review_leave_request", {
    p_leave_id: leaveId,
    p_decision: input.decision,
    p_remarks: input.remarks?.trim() || null,
  });
  if (error) throw error;
  return data as LeaveRequest;
}

export async function cancelLeaveRequest(leaveId: string): Promise<LeaveRequest> {
  const { data, error } = await supabase.rpc("cancel_leave_request", { p_leave_id: leaveId });
  if (error) throw error;
  return data as LeaveRequest;
}

export async function getLeaveBalance(employeeId: string): Promise<LeaveBalance | null> {
  const authenticatedId = await resolveAuthenticatedEmployeeId(employeeId, "balance lookup");
  const { data, error } = await supabase.from("leave_balances").select("*").eq("employee_id", authenticatedId).maybeSingle();
  if (error) throw error;
  return (data as LeaveBalance | null) ?? null;
}

export async function getLeaveApprovalHistory(leaveId: string): Promise<LeaveApprovalHistory[]> {
  const { data, error } = await supabase.from("leave_approval_history").select("*").eq("leave_request_id", leaveId).order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LeaveApprovalHistory[];
}

// REST-equivalent operations for the frontend and future HTTP adapters.
export const leaveApi = {
  post: createLeaveRequest,
  get: getLeaveRequests,
  getById: getLeaveRequest,
  put: updateLeaveRequest,
  approve: approveLeaveRequest,
  reject: rejectLeaveRequest,
  balance: getLeaveBalance,
};