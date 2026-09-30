import { useEffect, useState } from "react";
import { CheckCircle, Target, XCircle } from "lucide-react";
import { useEmployeeKpis } from "../hooks/useEmployeeKpis";
import { getKpiProgress } from "../services/employee-kpi.service";
import { assignEmployeeKpi } from "../services/employee-kpi.service";
import { getHierarchyEmployees } from "../services/employee-hierarchy.service";
import type { HierarchyEmployee } from "../types/employee-hierarchy.types";
import type { EmployeeKpi } from "../types/employee-kpi.types";

interface EmployeeKpiWidgetProps {
  userId: string;
  role: string;
  department?: string;
}

function canReview(role: string) {
  return ["Supervisor", "Manager", "Chief Manager", "General Manager", "Managing Director", "President", "Vice President", "Vice Chairman", "MD-Manufacturing", "MD-Marketing", "MD-Transport", "MD-RD"].includes(role);
}

export function EmployeeKpiWidget({ userId, role, department }: EmployeeKpiWidgetProps) {
  const { kpis, loading, error, refresh, updateProgress, review } = useEmployeeKpis(userId, role, department);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [employees, setEmployees] = useState<HierarchyEmployee[]>([]);
  const [assignment, setAssignment] = useState({ employeeId: "", metricName: "", targetValue: "", reviewMonth: String(new Date().getMonth() + 1), reviewYear: String(new Date().getFullYear()) });
  const canAssign = ["Manager", "Chief Manager", "General Manager", "Managing Director", "President", "Vice President", "Vice Chairman"].includes(role) || role.startsWith("MD-");

  useEffect(() => { if (canAssign) void getHierarchyEmployees().then(setEmployees).catch(() => setEmployees([])); }, [canAssign]);

  async function handleAssign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await assignEmployeeKpi({ employeeId: assignment.employeeId, metricName: assignment.metricName, targetValue: Number(assignment.targetValue), reviewMonth: Number(assignment.reviewMonth), reviewYear: Number(assignment.reviewYear) });
      await refresh();
      setAssignment((current) => ({ ...current, metricName: "", targetValue: "" }));
      setMessage("KPI assigned.");
    } catch (err) { setMessage(err instanceof Error ? err.message : "Failed to assign KPI"); }
  }

  async function saveProgress(kpi: EmployeeKpi) {
    try {
      await updateProgress(kpi.id, Number(progress[kpi.id] ?? kpi.achievedValue));
      setMessage("KPI progress updated.");
    } catch (err) { setMessage(err instanceof Error ? err.message : "Failed to update KPI progress"); }
  }

  async function handleReview(kpi: EmployeeKpi, decision: "Approved" | "Rejected") {
    try { await review(kpi.id, decision); setMessage(`KPI ${decision.toLowerCase()}.`); }
    catch (err) { setMessage(err instanceof Error ? err.message : "Failed to review KPI"); }
  }

  return (
    <div className="rounded-2xl border border-white/50 bg-white/40 p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3"><Target size={18} className="text-emerald-700" /><div><h2 className="font-semibold text-base text-slate-800">KPI Progress</h2><p className="text-xs text-slate-500">Role-scoped employee KPI data</p></div></div>
      {loading && <p className="text-sm text-slate-600">Loading KPI data...</p>}
      {error && <p className="text-sm text-rose-700">{error}</p>}
      {!loading && !error && kpis.length === 0 && <p className="text-sm text-slate-600">No KPI records found.</p>}
      {canAssign && <form onSubmit={handleAssign} className="mb-4 grid gap-2 md:grid-cols-5">
        <select required value={assignment.employeeId} onChange={(event) => setAssignment((current) => ({ ...current, employeeId: event.target.value }))} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"><option value="">Assign employee</option>{employees.filter((employee) => employee.id !== userId).map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select>
        <input required value={assignment.metricName} onChange={(event) => setAssignment((current) => ({ ...current, metricName: event.target.value }))} placeholder="Metric name" className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm" />
        <input required min="0" type="number" value={assignment.targetValue} onChange={(event) => setAssignment((current) => ({ ...current, targetValue: event.target.value }))} placeholder="Target" className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm" />
        <input required min="1" max="12" type="number" value={assignment.reviewMonth} onChange={(event) => setAssignment((current) => ({ ...current, reviewMonth: event.target.value }))} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Assign KPI</button>
      </form>}
      <div className="space-y-3">{kpis.map((kpi) => { const percentage = getKpiProgress(kpi); return <div key={kpi.id} className="rounded-xl border border-white/60 bg-white/70 p-4">
        <div className="flex items-start justify-between gap-3"><div><div className="font-medium text-slate-800">{kpi.metricName}</div><div className="text-xs text-slate-500">{kpi.reviewMonth}/{kpi.reviewYear} · {kpi.status}</div></div><span className="text-sm font-semibold text-emerald-700">{percentage}%</span></div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-700" style={{ width: `${percentage}%` }} /></div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600"><span>Target: {kpi.targetValue}</span><span>Achieved: {kpi.achievedValue}</span>
          {kpi.employeeId === userId && <><input type="number" min="0" value={progress[kpi.id] ?? kpi.achievedValue} onChange={(event) => setProgress((current) => ({ ...current, [kpi.id]: event.target.value }))} className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1" /><button onClick={() => void saveProgress(kpi)} className="rounded-lg bg-emerald-700 px-2.5 py-1.5 font-semibold text-white">Update</button></>}
          {canReview(role) && kpi.status === "In Progress" && <><button onClick={() => void handleReview(kpi, "Approved")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 font-semibold text-white"><CheckCircle size={12} /> Approve</button><button onClick={() => void handleReview(kpi, "Rejected")} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 font-semibold text-white"><XCircle size={12} /> Reject</button></>}
        </div>
      </div>; })}</div>
      {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
    </div>
  );
}
