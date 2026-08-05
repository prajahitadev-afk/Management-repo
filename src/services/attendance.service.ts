import { supabase } from "../lib/supabase";

export interface AttendanceRow {
  id: string;
  employee_id: string;
  name: string;
  department: string;
  role: string;
  status: "Present" | "Absent" | "Half Day" | "Leave" | "Not Marked" | "";
  check_in_time?: string;
  shift?: string;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  halfDay: number;
  onLeave: number;
}

export interface AttendanceScope {
  role?: string;
  department?: string;
}

function isOrgWide(role?: string) {
  return role === "Vice Chairman" || role === "Vice President";
}

export function getAttendanceSummary(rows: AttendanceRow[]): AttendanceSummary {
  return {
    present: rows.filter((row) => row.status === "Present").length,
    absent: rows.filter((row) => row.status === "Absent").length,
    halfDay: rows.filter((row) => row.status === "Half Day").length,
    onLeave: rows.filter((row) => row.status === "Leave").length,
  };
}

async function getProfiles(scope?: AttendanceScope) {
  let query = supabase.from("profiles").select("id, name, department, role").not("role", "is", null);

  if (scope && !isOrgWide(scope.role) && !scope.role?.startsWith("MD-") && scope.department) {
    query = query.eq("department", scope.department);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function getAttendanceByDate(date: string, scope?: AttendanceScope): Promise<AttendanceRow[]> {
  const [employees, attendanceRows] = await Promise.all([
    getProfiles(scope),
    supabase
      .from("attendance")
      .select("employee_id, status, check_in")
      .eq("attendance_date", date)
      .then(({ data, error }) => {
        if (error) throw error;
        return data || [];
      }),
  ]);

  const employeeIds = new Set(employees.map((employee: any) => employee.id));
  const scopedAttendanceRows = attendanceRows.filter((row: any) => employeeIds.has(row.employee_id));
  const attendanceByEmployee = new Map(
    scopedAttendanceRows.map((row: any) => [row.employee_id, row])
  );

  return employees.map((employee: any) => {
    const record = attendanceByEmployee.get(employee.id);
    const status = record?.status && ["Present", "Absent", "Half Day", "Leave"].includes(record.status)
      ? record.status
      : "Not Marked";

    return {
      id: employee.id,
      employee_id: employee.id,
      name: employee.name ?? "Unknown",
      department: employee.department ?? "Unknown",
      role: employee.role ?? "Worker",
      status,
      check_in_time: record?.check_in ?? "-",
      shift: "General",
    };
  });
}

export async function getAttendance(scope?: AttendanceScope): Promise<AttendanceRow[]> {
  const today = new Date().toISOString().split("T")[0];
  return getAttendanceByDate(today, scope);
}

export async function getAttendanceForWeek(date?: string, scope?: AttendanceScope) {
  const rows = await getAttendanceByDate(date ?? new Date().toISOString().split("T")[0], scope);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  return days.map((day) => ({
    day,
    present: rows.filter((row) => row.status === "Present").length,
    absent: rows.filter((row) => row.status === "Absent").length,
  }));
}

export function exportAttendanceToCSV(rows: AttendanceRow[]): void {
  if (rows.length === 0) {
    alert("No attendance records to export");
    return;
  }

  const csvData = rows.map((row) => ({
    "Employee ID": row.employee_id,
    "Name": row.name,
    "Department": row.department,
    "Role": row.role,
    "Status": row.status || "Not Marked",
    "Check In": row.check_in_time || "—",
    "Shift": row.shift || "General",
  }));

  const csvContent = [
    [
      "Employee ID",
      "Name",
      "Department",
      "Role",
      "Status",
      "Check In",
      "Shift",
    ]
      .map((h) => `"${h}"`)
      .join(","),
    ...csvData.map((row) =>
      Object.values(row)
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

  const link = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 10);
  link.href = URL.createObjectURL(blob);
  link.download = `attendance_${timestamp}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}