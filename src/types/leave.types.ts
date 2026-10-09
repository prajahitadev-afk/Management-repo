export const LEAVE_TYPES = ["Casual", "Sick", "Earned", "Unpaid"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUSES = ["Pending", "Approved", "Rejected", "Cancelled"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: LeaveStatus;
  current_approver_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveApprovalHistory {
  id: string;
  leave_request_id: string;
  approver_id: string;
  action: "Approved" | "Rejected" | "Cancelled";
  remarks: string | null;
  created_at: string;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  casual_leave: number;
  sick_leave: number;
  earned_leave: number;
  unpaid_leave: number;
  updated_at: string;
}

export interface LeaveRequestInput {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

export function validateLeaveRequestInput(input: LeaveRequestInput): void {
  if (!LEAVE_TYPES.includes(input.leaveType)) throw new Error("A valid leave type is required");
  if (!input.startDate || !input.endDate) throw new Error("Start and end dates are required");
  const start = new Date(`${input.startDate}T00:00:00`);
  const end = new Date(`${input.endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) throw new Error("End date must be on or after start date");
  if (!input.reason.trim()) throw new Error("Leave reason is required");
  if (input.reason.trim().length > 2000) throw new Error("Leave reason must be 2,000 characters or fewer");
}

export function getLeaveTotalDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.floor((end - start) / 86400000) + 1;
}