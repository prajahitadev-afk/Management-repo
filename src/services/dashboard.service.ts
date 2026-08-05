import { supabase } from "../lib/supabase";

export interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  suspendedEmployees: number;
  totalRoles: number;
  ordersReceived: number;
  pendingBills: number;
  approvedBills: number;
  rejectedBills: number;
  monthlyRevenue: number;
  weeklyAttendance: Array<{ day: string; present: number; absent: number }>;
  communityImpact: Array<{ month: string; beneficiaries: number; volunteers: number }>;
  revenueTrend: Array<{ month: string; orders: number; delivered: number; revenue: number }>;
}

export interface DashboardUser {
  id?: string;
  role?: string;
  dept?: string;
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

function isExec(role?: string) {
  return role === "Vice Chairman" || role === "Vice President";
}

function shouldFilterByDepartment(user?: DashboardUser) {
  return !!user?.role && !isExec(user.role);
}

function getDepartmentScope(user?: DashboardUser) {
  if (!user?.dept) return undefined;
  return user.dept;
}

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

export async function getDashboardStats(user?: DashboardUser): Promise<DashboardStats> {
  const scopedDept = getDepartmentScope(user);
  const filterByDept = shouldFilterByDepartment(user);

  const profileQuery = supabase.from("profiles").select("id, department, role").not("role", "is", null);
  const attendanceQuery = supabase.from("attendance").select("employee_id, status, attendance_date");
  const billsQuery = supabase.from("bills").select("amount, gst, status, created_at, department, submitted_by");

  const [profilesRes, attendanceRes, billsRes] = await Promise.all([profileQuery, attendanceQuery, billsQuery]);

  if (profilesRes.error) throw profilesRes.error;
  if (attendanceRes.error) throw attendanceRes.error;
  if (billsRes.error) throw billsRes.error;

  const profiles = profilesRes.data || [];
  const attendanceRows = attendanceRes.data || [];
  const bills = (billsRes.data || []) as Array<any>;

  const scopedProfiles = filterByDept
    ? profiles.filter((profile: any) => profile.department === scopedDept)
    : profiles;

  const scopedEmployeeIds = new Set(scopedProfiles.map((profile: any) => profile.id));

  const scopedAttendance = filterByDept
    ? attendanceRows.filter((attendance: any) => scopedEmployeeIds.has(attendance.employee_id))
    : attendanceRows;

  const scopedBills = filterByDept
    ? bills.filter((bill) => bill.department === scopedDept || bill.submitted_by === user?.id)
    : bills;

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
    pendingBills,
    approvedBills,
    rejectedBills,
    monthlyRevenue,
    weeklyAttendance,
    communityImpact,
    revenueTrend,
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
    const weekStart = new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000);
    const result: AttendanceDay[] = [];

    for (let i = 0; i < 5; i++) {
      const dayDate = new Date(weekStart.getTime() + (i + 1) * 24 * 60 * 60 * 1000);
      const dateStr = dayDate.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("attendance")
        .select("status, attendance_date")
        .eq("attendance_date", dateStr);

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

    const { data, error } = await supabase
      .from("attendance")
      .select("status, attendance_date")
      .eq("attendance_date", today);

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
