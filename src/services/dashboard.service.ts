import { supabase } from "../lib/supabase";
import { normalizeDepartmentName } from "../constants/departments";
import { resolveDashboardScope } from "./dashboard-scope.service";

export interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  suspendedEmployees: number;
  totalRoles: number;
  ordersReceived: number;
  pendingApprovals: number;
  pendingBills: number;
  approvedBills: number;
  rejectedBills: number;
  monthlyRevenue: number;
  weeklyAttendance: Array<{ day: string; present: number; absent: number }>;
  communityImpact: Array<{ month: string; beneficiaries: number; volunteers: number }>;
  revenueTrend: Array<{ month: string; orders: number; delivered: number; revenue: number }>;
  managerCount: number;
  supervisorCount: number;
  teamResponsibilities: Array<{ id: string; name: string; role: string; department: string; status: string }>;
  leaveBalance: number;
  leaveTaken: number;
  todayAttendanceStatus: string;
  attendanceHistory: Array<{ id: string; date: string; status: string; checkIn: string; checkOut: string }>;
  supervisorWorkersCount: number;
  supervisorPresentCount: number;
  supervisorAbsentCount: number;
  supervisorHalfDayCount: number;
  supervisorLateCount: number;
  supervisorAttendanceRows: Array<{ id: string; employeeId: string; employeeName: string; status: string; checkIn: string }>;
}

export interface DashboardUser {
  id?: string;
  role?: string;
  department?: string;
}

export interface MonthData {
  month: string;
  orders: number;
  delivered: number;
  revenue: number;
}

export interface CommunityData {
  month: string;
  beneficiaries: number;
  volunteers: number;
  communities: number;
}

export interface AttendanceDay {
  day: string;
  present: number;
  absent: number;
}

export interface AttendanceBreakdown {
  name: string;
  value: number;
  color: string;
}

const PENDING_STATUSES = ["Pending Approval"];
const APPROVED_STATUSES = ["Approved"];
const REJECTED_STATUSES = ["Rejected", "Returned for Correction"];

function buildWeekDays() {
  const today = new Date();
  const result: Array<{ label: string; date: string }> = [];
  for (let offset = 4; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
    result.push({ label: weekday, date: date.toISOString().split("T")[0] });
  }
  return result;
}

function readNumericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function getLeaveSummary(userId?: string) {
  if (!userId) return { leaveBalance: 0, leaveTaken: 0 };

  const { data: balance, error: balanceError } = await supabase.from("leave_balances").select("*").eq("employee_id", userId).maybeSingle();
  if (balanceError) throw balanceError;
  const { data: requests, error: requestsError } = await supabase.from("leave_requests").select("*").eq("employee_id", userId);
  if (requestsError) throw requestsError;
  const balanceRow = balance as Record<string, unknown> | null;
  const balanceValue = ["casual_leave", "sick_leave", "earned_leave", "unpaid_leave"]
    .map((field) => readNumericValue(balanceRow?.[field]))
    .filter((value): value is number => value !== null)
    .reduce((sum, value) => sum + value, 0);
  const takenValue = (requests ?? [])
    .filter((request) => request.status === "Approved")
    .reduce((sum, request) => sum + Number(request.total_days ?? 0), 0);

  return {
    leaveBalance: balanceValue,
    leaveTaken: takenValue,
  };
}

async function getSubordinateProfiles(userId?: string) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, role, department, status, reports_to")
    .eq("reports_to", userId)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data || []) as Array<Record<string, unknown>>;
}

async function getEmployeeAttendance(userId?: string) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("employee_id", userId)
    .order("attendance_date", { ascending: false })
    .limit(7);


  if (error) throw error;
  return (data || []) as Array<Record<string, unknown>>;
}

export async function getDashboardStats(user?: DashboardUser): Promise<DashboardStats> {
  const scope = user?.id && user.role ? await resolveDashboardScope(user.id, user.role, user.department) : null;

  const profileQuery = supabase.from("profiles").select("id, department, role").not("role", "is", null).neq("role", "Customer");
  const attendanceQuery = supabase.from("attendance").select("employee_id, status, attendance_date, check_in");
  const billsQuery = supabase.from("bills").select("amount, gst, status, created_at, department, submitted_by");

  const [profilesRes, attendanceRes, billsRes, subordinateProfilesRes, leaveSummaryRes, employeeAttendanceRes] = await Promise.all([
    profileQuery,
    attendanceQuery,
    billsQuery,
    getSubordinateProfiles(user?.id),
    getLeaveSummary(user?.id),
    getEmployeeAttendance(user?.id),
  ]);

  if (profilesRes.error) throw profilesRes.error;
  if (attendanceRes.error) throw attendanceRes.error;
  if (billsRes.error) throw billsRes.error;

  const profiles = profilesRes.data || [];
  const attendanceRows = attendanceRes.data || [];
  const bills = (billsRes.data || []) as Array<any>;

  const scopedProfiles = scope?.employeeIds === null || !scope ? profiles : profiles.filter((profile: any) => scope.employeeIds?.has(profile.id));

  const scopedEmployeeIds = new Set(scopedProfiles.map((profile: any) => profile.id));

  const scopedAttendance = scope?.employeeIds === null || !scope
    ? attendanceRows
    : attendanceRows.filter((attendance: any) => scopedEmployeeIds.has(attendance.employee_id));

  const scopedBills = scope?.employeeIds === null || !scope
    ? bills
    : bills.filter((bill) => {
      const departmentMatch = scope.department && normalizeDepartmentName(bill.department) === normalizeDepartmentName(scope.department);
      const ownerMatch = scope.employeeIds?.has(String(bill.submitted_by));
      return Boolean(departmentMatch || ownerMatch);
    });

  const todayDate = new Date().toISOString().split("T")[0];
  const activeEmployees = scopedAttendance.filter((row: any) => row.attendance_date === todayDate && row.status === "Present").length;
  const totalEmployees = scopedProfiles.length;
  const totalRoles = new Set(scopedProfiles.map((profile: any) => profile.role)).size;

  const pendingBills = scopedBills.filter((bill) => PENDING_STATUSES.includes(bill.status)).length;
  const approvedBills = scopedBills.filter((bill) => APPROVED_STATUSES.includes(bill.status)).length;
  const rejectedBills = scopedBills.filter((bill) => REJECTED_STATUSES.includes(bill.status)).length;
  const monthlyRevenue = scopedBills.reduce((sum, bill) => sum + Number(bill.amount || 0) + Number(bill.gst || 0), 0);

  const weekDates = buildWeekDays();
  const weeklyAttendance = weekDates.map((day) => ({
    day: day.label,
    present: scopedAttendance.filter((row: any) => row.attendance_date === day.date && row.status === "Present").length,
    absent: scopedAttendance.filter((row: any) => row.attendance_date === day.date && row.status === "Absent").length,
  }));

  const subordinateProfiles = scopedProfiles.filter((profile: any) => profile.id !== user?.id) as Array<any>;
  const managerCount = subordinateProfiles.filter((profile: any) => profile.role === "Manager").length;
  const supervisorCount = subordinateProfiles.filter((profile: any) => profile.role === "Supervisor").length;
  const teamResponsibilities = subordinateProfiles.map((profile: any) => ({
    id: profile.id,
    name: profile.name || "Unnamed",
    role: profile.role || "Employee",
    department: profile.department || "—",
    status: profile.status || "Active",
  }));

  const leaveSummary = leaveSummaryRes;
  const employeeAttendance = employeeAttendanceRes as Array<any>;
  const todayAttendance = employeeAttendance.find((row: any) => row.attendance_date === todayDate);
  const attendanceHistory = employeeAttendance.slice(0, 7).map((row: any) => ({
    id: `${row.attendance_date}-${row.status}`,
    date: row.attendance_date ? new Date(`${row.attendance_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—",
    status: row.status || "Not Marked",
    checkIn: row.check_in ? new Date(row.check_in).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "—",
    checkOut: row.check_out ? new Date(row.check_out).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "—",
  }));

  const supervisorTodayAttendance = subordinateProfiles
    .map((profile: any) => {
      const attendanceRecord = scopedAttendance.find((row: any) => row.employee_id === profile.id && row.attendance_date === todayDate);
      if (!attendanceRecord) return null;

      return {
        id: `${profile.id}-${todayDate}`,
        employeeId: profile.employee_id || profile.id,
        employeeName: profile.name || "Unnamed",
        status: attendanceRecord.status || "Absent",
        checkIn: attendanceRecord.check_in ?? "—",
      };
    })
    .filter(Boolean) as Array<{ id: string; employeeId: string; employeeName: string; status: string; checkIn: string }>;

  const supervisorPresentCount = supervisorTodayAttendance.filter((row) => row.status === "Present").length;
  const supervisorAbsentCount = supervisorTodayAttendance.filter((row) => row.status === "Absent").length;
  const supervisorHalfDayCount = supervisorTodayAttendance.filter((row) => row.status === "Half Day").length;
  const supervisorLateCount = supervisorTodayAttendance.filter((row) => {
    const value = row.checkIn;
    if (!value || value === "—") return false;
    const match = value.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return false;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    return hour > 9 || (hour === 9 && minute > 0);
  }).length;

  const revenueTrend = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"].map((month, index) => {
    const monthBills = scopedBills.filter((bill: any) => {
      const createdAt = bill.created_at ? new Date(bill.created_at) : null;
      return createdAt && createdAt.getMonth() === index;
    });

    return {
      month,
      orders: monthBills.length,
      delivered: monthBills.filter((bill: any) => APPROVED_STATUSES.includes(bill.status)).length,
      revenue: monthBills.reduce((sum: number, bill: any) => sum + Number(bill.amount || 0), 0),
    };
  });

  const { data: orderRows, error: orderError } = await supabase.from("orders").select("status");
  if (orderError) throw orderError;
  const pendingApprovals = (orderRows ?? []).filter((row) => row.status === "Pending").length;

  const { data: impactData, error: impactError } = await supabase
    .from("program_impact")
    .select("recorded_at, beneficiaries, volunteers, communities_reached")
    .order("recorded_at", { ascending: true });

  if (impactError) throw impactError;

  const communityImpact = (impactData || []).map((row: any) => ({
    month: row.recorded_at ? new Date(row.recorded_at).toLocaleString("en-US", { month: "short" }) : "N/A",
    beneficiaries: Number(row.beneficiaries || 0),
    volunteers: Number(row.volunteers || 0),
    communities: Number(row.communities_reached || 0),
  }));

  return {
    totalEmployees,
    activeEmployees,
    suspendedEmployees: 0,
    totalRoles,
    ordersReceived: scopedBills.length,
    pendingApprovals,
    pendingBills,
    approvedBills,
    rejectedBills,
    monthlyRevenue,
    weeklyAttendance,
    communityImpact,
    revenueTrend,
    managerCount,
    supervisorCount,
    teamResponsibilities,
    leaveBalance: leaveSummary.leaveBalance,
    leaveTaken: leaveSummary.leaveTaken,
    todayAttendanceStatus: todayAttendance?.status || "Not Marked",
    attendanceHistory,
    supervisorWorkersCount: user?.role === "Supervisor" ? subordinateProfiles.length : 0,
    supervisorPresentCount: user?.role === "Supervisor" ? supervisorPresentCount : 0,
    supervisorAbsentCount: user?.role === "Supervisor" ? supervisorAbsentCount : 0,
    supervisorHalfDayCount: user?.role === "Supervisor" ? supervisorHalfDayCount : 0,
    supervisorLateCount: user?.role === "Supervisor" ? supervisorLateCount : 0,
    supervisorAttendanceRows: user?.role === "Supervisor" ? supervisorTodayAttendance : [],
  };
}

/**
 * Get monthly revenue trend data (last 7 months)
 */
export async function getMonthlyRevenueData(): Promise<MonthData[]> {
  try {
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("created_at, total_amount")
      .gte("created_at", new Date(Date.now() - 7 * 30 * 24 * 60 * 60 * 1000).toISOString());

    if (ordersError) throw ordersError;

    const { data: deliveries, error: delError } = await supabase
      .from("deliveries")
      .select("created_at")
      .eq("status", "Delivered")
      .gte("created_at", new Date(Date.now() - 7 * 30 * 24 * 60 * 60 * 1000).toISOString());

    if (delError) throw delError;

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
    const monthMap = new Map<string, { orders: number; delivered: number; revenue: number }>();

    // Initialize months
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = months[date.getMonth()];
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { orders: 0, delivered: 0, revenue: 0 });
      }
    }

    // Count orders
    if (orders) {
      orders.forEach((order: any) => {
        const date = new Date(order.created_at);
        const monthKey = months[date.getMonth()];
        const current = monthMap.get(monthKey) || { orders: 0, delivered: 0, revenue: 0 };
        current.orders += 1;
        current.revenue += Number(order.total_amount || 0);
        monthMap.set(monthKey, current);
      });
    }

    // Count delivered
    if (deliveries) {
      deliveries.forEach((delivery: any) => {
        const date = new Date(delivery.created_at);
        const monthKey = months[date.getMonth()];
        const current = monthMap.get(monthKey) || { orders: 0, delivered: 0, revenue: 0 };
        current.delivered += 1;
        monthMap.set(monthKey, current);
      });
    }

    const result: MonthData[] = [];
    monthMap.forEach((value, month) => {
      result.push({ month, ...value });
    });

    return result.length > 0 ? result : months.map(m => ({ month: m, orders: 0, delivered: 0, revenue: 0 }));
  } catch (err) {
    console.error("Failed to fetch monthly revenue data:", err);
    return [];
  }
}

/**
 * Get community impact data (last 7 months)
 */
export async function getCommunityImpactData(): Promise<CommunityData[]> {
  try {
    const { data, error } = await supabase
      .from("program_impact")
      .select("id, recorded_at, beneficiaries, volunteers, communities_reached")
      .order("recorded_at", { ascending: true });

    if (error) throw error;

    return data?.map((row: any) => ({
      month: row.recorded_at ? new Date(row.recorded_at).toLocaleString("en-US", { month: "short" }) : "N/A",
      beneficiaries: Number(row.beneficiaries || 0),
      volunteers: Number(row.volunteers || 0),
      communities: Number(row.communities_reached || 0),
    })) || [];
  } catch (err) {
    console.error("Failed to fetch community impact data:", err);
    return [];
  }
}

/**
 * Get weekly attendance data
 */
export async function getWeeklyAttendanceData(): Promise<AttendanceDay[]> {
  try {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const today = new Date();
    const profileRes = await supabase.from("profiles").select("id").not("role", "is", null).neq("role", "Customer");
    if (profileRes.error) throw profileRes.error;
    const employeeIds = (profileRes.data || []).map((profile: any) => profile.id);
    const result: AttendanceDay[] = [];

    for (let i = 0; i < 5; i++) {
      const dayDate = new Date(today.getTime() + (i - (today.getDay() - 1)) * 24 * 60 * 60 * 1000);
      const dateStr = dayDate.toISOString().split("T")[0];

      const query = supabase.from("attendance").select("status, attendance_date").eq("attendance_date", dateStr);
      const filteredQuery = employeeIds.length > 0 ? query.in("employee_id", employeeIds) : query.eq("employee_id", "__none__");
      const { data, error } = await filteredQuery;

      if (error) throw error;

      const present = data?.filter((a: any) => a.status === "Present").length || 0;
      const absent = data?.filter((a: any) => a.status === "Absent").length || 0;

      result.push({ day: days[i], present, absent });
    }

    return result;
  } catch (err) {
    console.error("Failed to fetch weekly attendance data:", err);
    return [];
  }
}

/**
 * Get attendance breakdown for today
 */
export async function getAttendanceBreakdownData(green: string, red: string, gold: string, blue: string): Promise<AttendanceBreakdown[]> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const profileRes = await supabase.from("profiles").select("id").not("role", "is", null).neq("role", "Customer");
    if (profileRes.error) throw profileRes.error;
    const employeeIds = (profileRes.data || []).map((profile: any) => profile.id);

    const query = supabase.from("attendance").select("status, attendance_date").eq("attendance_date", today);
    const filteredQuery = employeeIds.length > 0 ? query.in("employee_id", employeeIds) : query.eq("employee_id", "__none__");
    const { data, error } = await filteredQuery;

    if (error) throw error;

    if (!data || data.length === 0) {
      return [
        { name: "Present", value: 0, color: green },
        { name: "Absent", value: 0, color: red },
        { name: "Half Day", value: 0, color: gold },
        { name: "Leave", value: 0, color: blue },
      ];
    }

    const counts = {
      Present: data.filter((a: any) => a.status === "Present").length,
      Absent: data.filter((a: any) => a.status === "Absent").length,
      "Half Day": data.filter((a: any) => a.status === "Half Day").length,
      Leave: data.filter((a: any) => a.status === "Leave").length,
    };

    return [
      { name: "Present", value: counts.Present, color: green },
      { name: "Absent", value: counts.Absent, color: red },
      { name: "Half Day", value: counts["Half Day"], color: gold },
      { name: "Leave", value: counts.Leave, color: blue },
    ];
  } catch (err) {
    console.error("Failed to fetch attendance breakdown data:", err);
    return [];
  }
}
