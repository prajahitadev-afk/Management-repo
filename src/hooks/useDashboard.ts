import { useEffect, useState } from "react";
import { getDashboardStats, type DashboardStats, type DashboardUser } from "../services/dashboard.service";

export function useDashboard(user?: DashboardUser) {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    activeEmployees: 0,
    suspendedEmployees: 0,
    totalRoles: 0,
    ordersReceived: 0,
    pendingBills: 0,
    approvedBills: 0,
    rejectedBills: 0,
    monthlyRevenue: 0,
    weeklyAttendance: [],
    communityImpact: [],
    revenueTrend: [],
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

    loadStats();
  }, [user]);

  return { stats, loading, error };
}
