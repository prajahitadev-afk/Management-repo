import { useEffect, useState } from "react";
import {
  getDashboardMetrics,
  getMarketingOrders,
  getMarketingCustomers,
  getMonthlyRevenue,
  getDepartmentPerformance,
  MarketingOrder,
  MarketingCustomer,
  RevenuePoint,
  DepartmentPerformance,
  DashboardMetrics,
} from "../services/marketing.service";

export function useMarketing() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    dispatchedOrders: 0,
    monthlySales: 0,
    totalRevenue: 0,
  });

  const [orders, setOrders] = useState<MarketingOrder[]>([]);
  const [customers, setCustomers] = useState<MarketingCustomer[]>([]);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [performance, setPerformance] = useState<DepartmentPerformance[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshData() {
    try {
      setLoading(true);
      setError(null);

      const [metricsData, ordersData, customersData, revenueData, performanceData] = await Promise.all([
        getDashboardMetrics(),
        getMarketingOrders(),
        getMarketingCustomers(),
        getMonthlyRevenue(),
        getDepartmentPerformance(),
      ]);

      setMetrics(metricsData);
      setOrders(ordersData);
      setCustomers(customersData);
      setRevenue(revenueData);
      setPerformance(performanceData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load marketing data"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshData();
    const handleWorkflowChange = () => void refreshData();
    window.addEventListener("order-workflow-changed", handleWorkflowChange);
    return () => window.removeEventListener("order-workflow-changed", handleWorkflowChange);
  }, []);

  return {
    metrics,
    orders,
    customers,
    revenue,
    performance,
    loading,
    error,
    refreshData,
  };
}
