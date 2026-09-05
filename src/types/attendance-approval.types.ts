import type { AttendanceStatus } from "./employee.types";

export type AttendanceApprovalStatus = "Pending" | "Approved" | "Rejected";

export interface AttendanceApproval {
  id: string;
  employeeId: string;
  attendanceDate: string;
  attendanceStatus: AttendanceStatus;
  markedBy: string;
  approverId: string | null;
  approvalStatus: AttendanceApprovalStatus;
  reviewedBy: string | null;
  reviewComment: string | null;
  createdAt: string;
  reviewedAt: string | null;
}
