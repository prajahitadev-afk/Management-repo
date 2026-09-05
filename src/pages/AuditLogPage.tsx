import { useMemo, useState } from "react";
import { AlertCircle, Search } from "lucide-react";
import { useAuditLogs } from "../hooks/useAuditLogs";

const ACTIONS = ["All", "attendance_submitted", "attendance_approved", "attendance_rejected", "employee_role_changed", "employee_department_changed", "employee_supervisor_assigned", "employee_supervisor_updated", "employee_kpi_assigned", "employee_kpi_progress_updated", "employee_kpi_approved", "employee_kpi_rejected", "employee_updated"];

export default function AuditLogPage() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("All");
  const [actorId, setActorId] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { logs, actors, loading, error } = useAuditLogs({ search, action, actorId, from, to });
  const actionLabel = useMemo(() => (value: string) => value.replaceAll("_", " "), []);

  return <div className="p-6 space-y-5">
    <div className="rounded-2xl border border-white/50 bg-white/40 p-4 shadow-sm"><h1 className="text-xl font-semibold text-slate-800">Audit Log</h1><p className="text-sm text-slate-600">Track employee, attendance, department, role, supervisor, and KPI changes.</p></div>
    <div className="rounded-2xl border border-white/50 bg-white/40 p-4 shadow-sm"><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
      <label className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm"><span className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Search size={14} /> Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Action, user, entity..." className="w-full bg-transparent outline-none" /></label>
      <select value={action} onChange={(event) => setAction(event.target.value)} className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-700"><option value="All">All actions</option>{ACTIONS.slice(1).map((item) => <option key={item} value={item}>{actionLabel(item)}</option>)}</select>
      <select value={actorId} onChange={(event) => setActorId(event.target.value)} className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-700"><option value="All">All users</option>{actors.map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}</select>
      <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-700" />
      <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-700" />
    </div></div>
    {loading && <div className="rounded-2xl border border-white/50 bg-white/40 p-6 text-sm text-slate-600">Loading audit logs...</div>}
    {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700"><AlertCircle size={16} className="mr-2 inline" />{error}</div>}
    {!loading && !error && <div className="overflow-hidden rounded-2xl border border-white/50 bg-white/40 shadow-sm"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-white/60 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">User</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">Changes</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id} className="border-t border-white/40 bg-white/20"><td className="px-4 py-3 text-slate-600">{new Date(log.createdAt).toLocaleString()}</td><td className="px-4 py-3 font-medium text-slate-800">{log.actorName}</td><td className="px-4 py-3 capitalize text-slate-700">{actionLabel(log.action)}</td><td className="px-4 py-3 text-slate-600">{log.entityType} · {log.entityId}</td><td className="max-w-sm px-4 py-3 text-xs text-slate-600">{log.newValues ? JSON.stringify(log.newValues) : "—"}</td></tr>)}{logs.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-600">No audit records found.</td></tr>}</tbody></table></div></div>}
  </div>;
}
