import { supabase } from "../lib/supabase";
import { getVisibleEmployeeIdsForUser } from "./employee.service";

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
  userId?: string;
}

export interface AttendanceDayTrend {
  day: string;
  present: number;
  absent: number;
}

export interface AttendanceMonthTrend {
  month: string;
  present: number;
  absent: number;
}

interface AttendanceCountRow {
  employee_id: string;
  attendance_date: string;
  status: string | null;
}

function isOrgWide(role?: string) {
  return role === "Vice Chairman" || role === "Vice President";
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(date?: string): Date {
  const value = new Date(`${date ?? formatDate(new Date())}T00:00:00`);
  if (!Number.isFinite(value.getTime())) throw new Error("Invalid attendance date.");
  return value;
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
  if (scope?.userId) {
    const visibleEmployeeIds = await getVisibleEmployeeIdsForUser(scope.userId);
    if (visibleEmployeeIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, department, role")
      .in("id", visibleEmployeeIds)
      .not("role", "is", null)
      .neq("role", "Customer");

    if (error) throw error;
    return data || [];
  }

  let query = supabase.from("profiles").select("id, name, department, role").not("role", "is", null).neq("role", "Customer");

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
      shift: "Administration",
    };
  });
}

async function getAttendanceRowsInRange(startDate: string, endDate: string, scope?: AttendanceScope): Promise<AttendanceCountRow[]> {
  const employees = await getProfiles(scope);
  const employeeIds = employees.map((employee: any) => employee.id as string);
  if (employeeIds.length === 0) return [];

  const pageSize = 1000;
  const rows: AttendanceCountRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("attendance")
      .select("employee_id, attendance_date, status")
      .in("employee_id", employeeIds)
      .gte("attendance_date", startDate)
      .lte("attendance_date", endDate)
      .order("attendance_date", { ascending: true })
      .order("employee_id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    const page = (data ?? []) as AttendanceCountRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

export async function getAttendance(scope?: AttendanceScope): Promise<AttendanceRow[]> {
  const today = formatDate(new Date());
  return getAttendanceByDate(today, scope);
}

export async function getAttendanceForWeek(date?: string, scope?: AttendanceScope): Promise<AttendanceDayTrend[]> {
  const monday = parseDate(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const days = Array.from({ length: 5 }, (_, index) => {
    const current = new Date(monday);
    current.setDate(monday.getDate() + index);
    return { label: current.toLocaleDateString("en-US", { weekday: "short" }), date: formatDate(current) };
  });
  const rows = await getAttendanceRowsInRange(days[0].date, days[days.length - 1].date, scope);
  const counts = new Map(days.map(({ date }) => [date, { present: 0, absent: 0 }]));

  rows.forEach((row) => {
    const day = counts.get(row.attendance_date);
    if (!day) return;
    if (row.status === "Present") day.present += 1;
    if (row.status === "Absent") day.absent += 1;
  });

  return days.map(({ label, date }) => ({ day: label, ...counts.get(date)! }));
}

export async function getAttendanceForMonths(date?: string, scope?: AttendanceScope): Promise<AttendanceMonthTrend[]> {
  const selected = parseDate(date);
  const firstMonth = new Date(selected.getFullYear(), selected.getMonth() - 6, 1);
  const lastMonth = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
  const startDate = formatDate(firstMonth);
  const endDate = formatDate(lastMonth);
  const rows = await getAttendanceRowsInRange(startDate, endDate, scope);
  const counts = new Map<string, { present: number; absent: number }>();
  const months = Array.from({ length: 7 }, (_, index) => {
    const monthDate = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + index, 1);
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    counts.set(key, { present: 0, absent: 0 });
    return { key, label: monthDate.toLocaleDateString("en-US", { month: "short", year: "2-digit" }) };
  });

  rows.forEach((row) => {
    const month = counts.get(row.attendance_date.slice(0, 7));
    if (!month) return;
    if (row.status === "Present") month.present += 1;
    if (row.status === "Absent") month.absent += 1;
  });

  return months.map(({ key, label }) => ({ month: label, ...counts.get(key)! }));
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
    "Shift": row.shift || "Administration",
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