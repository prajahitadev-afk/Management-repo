import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface AdministrationDashboardProps { profile: { id: string; role: string }; }
interface AdministrationEmployee { id: string; employeeId: string; name: string; role: string; }

export function AdministrationDashboard({ profile }: AdministrationDashboardProps) {
  const [employees, setEmployees] = useState<AdministrationEmployee[]>([]);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [presentToday, setPresentToday] = useState(0);
  const [pendingLeave, setPendingLeave] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const { data: employeeRows, error: employeeError } = await supabase
          .from("profiles")
          .select("id, employee_id, name, role")
          .eq("department", "Administration")
          .order("created_at", { ascending: false });
        if (employeeError) throw employeeError;
        const rows = (employeeRows ?? []) as Array<{ id: string; employee_id: string | null; name: string | null; role: string | null }>;
        const employeeIds = rows.map((row) => row.id);
        const today = new Date().toISOString().slice(0, 10);
        const [attendanceResult, leaveResult] = await Promise.all([
          employeeIds.length
            ? supabase.from("attendance").select("employee_id").in("employee_id", employeeIds).eq("attendance_date", today).eq("status", "Present")
            : Promise.resolve({ data: [], error: null }),
          employeeIds.length
            ? supabase.from("leave_requests").select("employee_id").in("employee_id", employeeIds).eq("status", "Pending")
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (attendanceResult.error) throw attendanceResult.error;
        if (leaveResult.error) throw leaveResult.error;
        if (!active) return;
        setEmployeeCount(rows.length);
        setEmployees(rows.slice(0, 5).map((row) => ({ id: row.id, employeeId: row.employee_id ?? row.id, name: row.name ?? "Unnamed Employee", role: row.role ?? "Worker" })));
        setPresentToday(attendanceResult.data?.length ?? 0);
        setPendingLeave(leaveResult.data?.length ?? 0);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load Administration dashboard");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [profile.id]);

  return <main className="min-h-full p-6"><div className="mx-auto max-w-7xl space-y-5"><div><h1 className="text-2xl font-bold text-slate-800">Administration</h1><p className="mt-1 text-sm text-slate-600">Employee and attendance overview</p></div>{error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}{loading ? <div className="rounded-2xl border border-white/50 bg-white/40 p-8 text-sm text-slate-600">Loading Administration dashboard...</div> : <><div className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-white/50 bg-white/40 p-5 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Employees</div><div className="mt-2 text-3xl font-semibold text-slate-800">{employeeCount}</div></div><div className="rounded-2xl border border-white/50 bg-white/40 p-5 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Present Today</div><div className="mt-2 text-3xl font-semibold text-slate-800">{presentToday}</div></div><div className="rounded-2xl border border-white/50 bg-white/40 p-5 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending Leave Requests</div><div className="mt-2 text-3xl font-semibold text-slate-800">{pendingLeave}</div></div></div><section className="overflow-hidden rounded-2xl border border-white/50 bg-white/40 shadow-sm"><div className="border-b border-white/50 px-5 py-4"><h2 className="font-semibold text-slate-800">Recent Employees</h2></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-white/60 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Employee ID</th><th className="px-5 py-3">Name</th><th className="px-5 py-3">Role</th></tr></thead><tbody>{employees.map((employee) => <tr key={employee.id} className="border-t border-white/40"><td className="px-5 py-3 text-slate-700">{employee.employeeId}</td><td className="px-5 py-3 text-slate-700">{employee.name}</td><td className="px-5 py-3 text-slate-700">{employee.role}</td></tr>)}</tbody></table></div></section></>}</div></main>;
}
