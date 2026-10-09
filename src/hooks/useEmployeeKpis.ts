import { useCallback, useEffect, useState } from "react";
import { getDashboardKpis, updateEmployeeKpiProgress, reviewEmployeeKpi } from "../services/employee-kpi.service";
import type { EmployeeKpi } from "../types/employee-kpi.types";

export function useEmployeeKpis(userId: string | undefined, role: string | undefined, department?: string) {
  const [kpis, setKpis] = useState<EmployeeKpi[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId || !role) return;
    try { setLoading(true); setError(null); setKpis(await getDashboardKpis(userId, role, department)); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load KPI data"); }
    finally { setLoading(false); }
  }, [department, role, userId]);

  const updateProgress = useCallback(async (kpiId: string, achievedValue: number) => { await updateEmployeeKpiProgress(kpiId, achievedValue); await refresh(); }, [refresh]);
  const review = useCallback(async (kpiId: string, decision: "Approved" | "Rejected", comment?: string) => { await reviewEmployeeKpi(kpiId, decision, comment); await refresh(); }, [refresh]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { kpis, loading, error, refresh, updateProgress, review };
}
