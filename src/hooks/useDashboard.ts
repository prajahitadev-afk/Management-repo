import { useEffect, useState } from "react";
import { getDashboardStats, type DashboardStats, type DashboardUser } from "../services/dashboard.service";

export function useDashboard(user?: DashboardUser) {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    activeEmployees: 0,
    suspendedEmployees: 0,
    totalRoles: 0,
    ordersReceived: 0,
    pendingApprovals: 0,
    pendingBills: 0,
    approvedBills: 0,
    rejectedBills: 0,
    monthlyRevenue: 0,
    weeklyAttendance: [],
    communityImpact: [],
    revenueTrend: [],
    managerCount: 0,
    supervisorCount: 0,
    teamResponsibilities: [],
    leaveBalance: 0,
    leaveTaken: 0,
    todayAttendanceStatus: "Not Marked",
    attendanceHistory: [],
    supervisorWorkersCount: 0,
    supervisorPresentCount: 0,
    supervisorAbsentCount: 0,
    supervisorHalfDayCount: 0,
    supervisorLateCount: 0,
    supervisorAttendanceRows: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        const nextStats = await getDashboardStats(user);
        setStats(nextStats);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard stats");
      } finally {
        setLoading(false);
      }
    }

    void loadStats();
    const handleWorkflowChange = () => void loadStats();
    window.addEventListener("order-workflow-changed", handleWorkflowChange);
    return () => window.removeEventListener("order-workflow-changed", handleWorkflowChange);
  }, [user]);

  return { stats, loading, error };
}
