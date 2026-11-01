import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarDays, Filter, Save } from "lucide-react";
import { getAttendanceSummary, getAttendanceViewEmployees, getEmployeeAttendanceHistory, saveAttendanceEntries } from "../../services/employee.service";
import type { AttendanceStatus } from "../../types/employee.types";

const statusOptions: AttendanceStatus[] = ["Present", "Absent", "Half Day", "Leave"];

interface AttendancePageProps {
  currentUser?: {
    id: string;
    role: string;
    department?: string;
  };
}

export function AttendancePage({ currentUser }: AttendancePageProps) {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [selectedEmployee, setSelectedEmployee] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getAttendanceSummary>> | null>(null);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; department: string; role: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [attendanceSelections, setAttendanceSelections] = useState<Record<string, AttendanceStatus>>({});
  const [employeeHistory, setEmployeeHistory] = useState<Awaited<ReturnType<typeof getEmployeeAttendanceHistory>>>([]);
  const isWorker = currentUser?.role === "Worker";

  const departmentOptions = useMemo(() => Array.from(new Set(employees.map((employee) => employee.department))).sort(), [employees]);

  useEffect(() => {
    let active = true;

    async function loadAttendanceData() {
      if (!currentUser?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setMessage(null);

        const visibleEmployees = isWorker
          ? await getAttendanceViewEmployees(currentUser.id)
          : await getAttendanceViewEmployees(currentUser.id);
        if (!active) return;

        if (isWorker) {
          setEmployeeHistory(await getEmployeeAttendanceHistory(currentUser.id));
        }

        const visibleEmployeeIds = visibleEmployees.map((employee) => employee.id);
        setEmployees(visibleEmployees.map((employee) => ({ id: employee.id, name: employee.name, department: employee.department, role: employee.role })));

        const nextSummary = isWorker
            ? await getAttendanceSummary({ date: selectedDate, employeeId: currentUser.id })
            : await getAttendanceSummary({ date: selectedDate, employeeIds: visibleEmployeeIds });

        if (!active) return;
        setSummary(nextSummary);
        setAttendanceSelections(
          Object.fromEntries(
            nextSummary.records.map((record) => [record.employeeId, record.status as AttendanceStatus]),
          ) as Record<string, AttendanceStatus>,
        );
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load attendance data");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadAttendanceData();
    return () => {
      active = false;
    };
  }, [currentUser?.id, currentUser?.role, selectedDate, isWorker]);

  async function handleApply() {
    if (!currentUser?.id) return;
    try {
      setLoading(true);
      setError(null);
      const visibleEmployees = isWorker
        ? await getAttendanceViewEmployees(currentUser.id)
        : await getAttendanceViewEmployees(currentUser.id);
      const visibleEmployeeIds = visibleEmployees.map((employee) => employee.id);
      const nextSummary = isWorker
        ? await getAttendanceSummary({ date: selectedDate, employeeId: currentUser.id })
        : await getAttendanceSummary({ date: selectedDate, employeeIds: visibleEmployeeIds });
      setSummary(nextSummary);
      setEmployees(visibleEmployees.map((employee) => ({ id: employee.id, name: employee.name, department: employee.department, role: employee.role })));
      setAttendanceSelections(
        Object.fromEntries(
          nextSummary.records.map((record) => [record.employeeId, record.status as AttendanceStatus]),
        ) as Record<string, AttendanceStatus>,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh attendance data");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!currentUser?.id) return;
    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const payload = visibleEmployees.map((employee) => ({
        employeeId: employee.id,
        status: attendanceSelections[employee.id] ?? "Absent",
        date: selectedDate,
      }));

      await saveAttendanceEntries(payload);
      setMessage("Attendance saved successfully.");
      await handleApply();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  }

  const visibleEmployees = useMemo(() => {
    const departmentFilter = selectedDepartment === "All" ? undefined : selectedDepartment;
    const employeeFilter = selectedEmployee === "All" ? undefined : selectedEmployee;
    const recordMap = new Map(summary?.records.map((record) => [record.employeeId, record.status]) ?? []);
    return employees.filter((employee) => {
      if (departmentFilter && employee.department !== departmentFilter) return false;
      if (employeeFilter && employee.id !== employeeFilter) return false;
      if (selectedStatus !== "All") {
        const status = attendanceSelections[employee.id] ?? recordMap.get(employee.id) ?? "Absent";
        if (status !== selectedStatus) return false;
      }
      return true;
    });
  }, [attendanceSelections, employees, selectedDepartment, selectedEmployee, selectedStatus, summary]);

  const summaryRows = useMemo(() => {
    if (!summary) return [];
    const recordMap = new Map(summary.records.map((record) => [record.employeeId, record.status]));
    return visibleEmployees.map((employee) => ({
      employeeId: employee.id,
      employeeName: employee.name,
      status: (attendanceSelections[employee.id] ?? recordMap.get(employee.id) ?? "Absent") as AttendanceStatus,
    }));
  }, [attendanceSelections, summary, visibleEmployees]);

  if (isWorker) {
    return (
      <div className="portal-feature-page p-6 space-y-5">
        <div className="rounded-2xl border border-white/50 bg-white/40 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-800">My Attendance</h1>
              <p className="text-sm text-slate-600">Your attendance metrics and personal history from the database.</p>
            </div>
            <button onClick={() => void handleApply()} className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white">Refresh</button>
          </div>
        </div>
        {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        {loading ? (
          <div className="rounded-2xl border border-white/50 bg-white/40 p-10 text-center text-sm text-slate-600">Loading your attendance...</div>
        ) : summary ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-white/50 bg-white/40 p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attendance %</div>
                <div className="mt-2 text-2xl font-semibold text-slate-800">{summary.attendancePercentage}%</div>
              </div>
              <div className="rounded-2xl border border-white/50 bg-white/40 p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Present</div>
                <div className="mt-2 text-2xl font-semibold text-slate-800">{summary.present}</div>
              </div>
              <div className="rounded-2xl border border-white/50 bg-white/40 p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Absent</div>
                <div className="mt-2 text-2xl font-semibold text-slate-800">{summary.absent}</div>
              </div>
              <div className="rounded-2xl border border-white/50 bg-white/40 p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Leave</div>
                <div className="mt-2 text-2xl font-semibold text-slate-800">{summary.leave}</div>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/50 bg-white/40 shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/60 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Check In</th>
                      <th className="px-4 py-3">Check Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeHistory.map((record) => (
                      <tr key={record.id} className="border-t border-white/40 bg-white/20">
                        <td className="px-4 py-3 text-slate-700">{record.attendance_date}</td>
                        <td className="px-4 py-3 text-slate-700">{record.status ?? ""}</td>
                        <td className="px-4 py-3 text-slate-700">{record.check_in ?? ""}</td>
                        <td className="px-4 py-3 text-slate-700">{record.check_out ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-white/50 bg-white/40 p-10 text-center text-sm text-slate-600">No attendance records found</div>
        )}
      </div>
    );
  }

  return (
    <div className="portal-feature-page p-6 space-y-5">
      <div className="rounded-2xl border border-white/50 bg-white/40 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Attendance</h1>
            <p className="text-sm text-slate-600">Mark attendance and review summaries for your team from the database.</p>
          </div>
          <button onClick={() => void handleSave()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            <Save size={15} /> {saving ? "Saving..." : "Save Attendance"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/50 bg-white/40 p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <label className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-700">
            <span className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><CalendarDays size={14} /> Date</span>
            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="w-full bg-transparent outline-none" />
          </label>
          <label className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-700">
            <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Department</span>
            <select value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)} className="w-full bg-transparent outline-none">
              <option value="All">All</option>
              {departmentOptions.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </label>
          <label className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-700">
            <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Employee</span>
            <select value={selectedEmployee} onChange={(event) => setSelectedEmployee(event.target.value)} className="w-full bg-transparent outline-none">
              <option value="All">All</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.name}</option>
              ))}
            </select>
          </label>
          <label className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-700">
            <span className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Filter size={14} /> Status</span>
            <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)} className="w-full bg-transparent outline-none">
              <option value="All">All</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <button onClick={() => void handleApply()} className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white">Apply</button>
        </div>
      </div>

      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <div className="rounded-2xl border border-white/50 bg-white/40 p-10 text-center text-sm text-slate-600">Loading attendance...</div>
      ) : summary ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-white/50 bg-white/40 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Present</div>
              <div className="mt-2 text-2xl font-semibold text-slate-800">{summary.present}</div>
            </div>
            <div className="rounded-2xl border border-white/50 bg-white/40 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Absent</div>
              <div className="mt-2 text-2xl font-semibold text-slate-800">{summary.absent}</div>
            </div>
            <div className="rounded-2xl border border-white/50 bg-white/40 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Half Day</div>
              <div className="mt-2 text-2xl font-semibold text-slate-800">{summary.halfDay}</div>
            </div>
            <div className="rounded-2xl border border-white/50 bg-white/40 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Leave</div>
              <div className="mt-2 text-2xl font-semibold text-slate-800">{summary.leave}</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/50 bg-white/40 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((row) => (
                    <tr key={row.employeeId} className="border-t border-white/40 bg-white/20">
                      <td className="px-4 py-3 text-slate-700">{row.employeeName}</td>
                      <td className="px-4 py-3">
                        <select value={row.status} onChange={(event) => setAttendanceSelections((current) => ({ ...current, [row.employeeId]: event.target.value as AttendanceStatus }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                          {statusOptions.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-white/50 bg-white/40 p-10 text-center text-sm text-slate-600">No attendance records found</div>
      )}
    </div>
  );
}
