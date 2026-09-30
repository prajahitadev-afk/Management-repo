export interface AuditLogRecord {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  createdAt: string;
}

export type AuditLogAction =
  | "attendance_submitted"
  | "attendance_approved"
  | "attendance_rejected"
  | "employee_role_changed"
  | "employee_department_changed"
  | "employee_supervisor_assigned"
  | "employee_supervisor_updated"
  | "employee_kpi_assigned"
  | "employee_kpi_progress_updated"
  | "employee_kpi_approved"
  | "employee_kpi_rejected"
  | "employee_updated";
