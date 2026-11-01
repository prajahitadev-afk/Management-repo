import { useMemo, useState } from "react";
import { AlertCircle, Building2, Search, Users, UserRound } from "lucide-react";
import { useOrganizationChart } from "../../hooks/useOrganizationChart";
import { assignSupervisor } from "../../services/employee-hierarchy.service";
import type { HierarchyEmployee } from "../../types/employee-hierarchy.types";

interface OrganizationChartPageProps {
  currentUser?: {
    id: string;
    role: string;
  };
  onSelectEmployee?: (employeeId: string) => void;
}

const MANAGEMENT_DIRECTOR_ROLES = [
  { role: "MD-Manufacturing", label: "MD – Manufacturing" },
  { role: "MD-Marketing", label: "MD – Marketing" },
  { role: "MD-Transport", label: "MD – Transport" },
  { role: "MD-RD", label: "MD – Research & Development" },
] as const;

const HIERARCHY_LEVELS = [
  { title: "Vice Chairman", roles: ["Vice Chairman"] },
  { title: "Trustee", roles: ["Trustee"] },
  { title: "Managing Directors", roles: ["Managing Director", ...MANAGEMENT_DIRECTOR_ROLES.map((item) => item.role)] },
  { title: "General Managers (GM)", roles: ["General Manager"] },
  { title: "Chief Managers (CM)", roles: ["Chief Manager"] },
  { title: "Managers", roles: ["Manager"] },
  { title: "Supervisors", roles: ["Supervisor"] },
  { title: "Workers", roles: ["Worker"] },
] as const;

function EmployeePill({ employee }: { employee: HierarchyEmployee }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><UserRound size={17} /></div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-800">{employee.name}</div>
        <div className="truncate text-xs text-slate-500">{employee.department || "No department"} · {employee.employeeCode}</div>
      </div>
      <span className={`ml-auto shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${employee.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{employee.status}</span>
    </div>
  );
}

function HierarchyTier({ title, employees, branches = false }: { title: string; employees: HierarchyEmployee[]; branches?: boolean }) {
  if (branches) {
    return (
      <section className="w-full">
        <h3 className="mb-3 text-center text-sm font-bold uppercase tracking-wide text-slate-700">{title}</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {MANAGEMENT_DIRECTOR_ROLES.map((branch) => {
            const people = employees.filter((employee) => employee.role === branch.role);
            return (
              <div key={branch.role} className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3">
                <div className="mb-3 text-center text-xs font-bold text-emerald-800">{branch.label}</div>
                <div className="space-y-2">
                  {people.length ? people.map((employee) => <EmployeePill key={employee.id} employee={employee} />) : <p className="rounded-lg border border-dashed border-emerald-200 px-3 py-4 text-center text-xs text-slate-400">Position vacant</p>}
                </div>
              </div>
            );
          })}
        </div>
        {employees.filter((employee) => employee.role === "Managing Director").map((employee) => <div className="mx-auto mt-3 max-w-md" key={employee.id}><EmployeePill employee={employee} /></div>)}
      </section>
    );
  }
  return (
    <section className="mx-auto w-full max-w-2xl">
      <h3 className="mb-3 text-center text-sm font-bold uppercase tracking-wide text-slate-700">{title}</h3>
      <div className="space-y-2">
        {employees.length ? employees.map((employee) => <EmployeePill key={employee.id} employee={employee} />) : <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3 text-center text-xs text-slate-400">No {title.toLowerCase()} assigned</div>}
      </div>
    </section>
  );
}

export function OrganizationChartPage({ currentUser }: OrganizationChartPageProps) {
  const { employees, loading, error, refresh } = useOrganizationChart({ userId: currentUser?.id });
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedSupervisorId, setSelectedSupervisorId] = useState("");
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);
  const normalizedSearch = search.trim().toLowerCase();
  const visibleEmployees = useMemo(() => employees.filter((employee) => {
    const matchesSearch = !normalizedSearch || [employee.name, employee.employeeCode, employee.role, employee.department].join(" ").toLowerCase().includes(normalizedSearch);
    return matchesSearch && (department === "All" || employee.department === department);
  }), [employees, normalizedSearch, department]);
  const departments = useMemo(() => Array.from(new Set(employees.map((employee) => employee.department).filter(Boolean))).sort(), [employees]);
  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId);
  const supervisorOptions = employees.filter((employee) => employee.id !== selectedEmployeeId && employee.hierarchyLevel > (selectedEmployee?.hierarchyLevel ?? 0));

  async function handleAssignSupervisor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedEmployeeId || !selectedSupervisorId) {
      setAssignmentMessage("Select an employee and supervisor.");
      return;
    }
    try {
      setSavingAssignment(true);
      setAssignmentMessage(null);
      await assignSupervisor(selectedEmployeeId, selectedSupervisorId);
      await refresh();
      setAssignmentMessage("Reporting relationship saved.");
    } catch (err) {
      setAssignmentMessage(err instanceof Error ? err.message : "Failed to save reporting relationship");
    } finally {
      setSavingAssignment(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-slate-600">Loading organization chart...</div>;
  if (error) return <div className="p-6"><div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700"><div className="flex items-center gap-2"><AlertCircle size={16} /> {error}</div></div></div>;

  const employeesForRole = (roles: readonly string[]) => visibleEmployees.filter((employee) => roles.includes(employee.role));
  const viceChairman = employeesForRole(["Vice Chairman"]);

  return (
    <div className="space-y-5 p-6">
      <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-800">Organizational Structure</h1>
        <p className="mt-1 text-sm text-slate-600">The organization follows a strict reporting hierarchy. System administration is separate from this employee structure.</p>
      </div>
      <div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><span className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Search size={14} /> Search employees</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, employee code, role..." className="w-full bg-transparent outline-none" /></label>
          <label className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Department</span><select value={department} onChange={(event) => setDepartment(event.target.value)} className="w-full bg-transparent outline-none"><option value="All">All departments</option>{departments.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
        </div>
      </div>
      <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm">
        <div className="mx-auto max-w-2xl">
          <HierarchyTier title="Vice Chairman" employees={viceChairman} />
          <div className="mx-auto h-7 w-px bg-slate-300" />
          <HierarchyTier title="Trustee" employees={employeesForRole(["Trustee"])} />
          <div className="mx-auto h-7 w-px bg-slate-300" />
          <HierarchyTier title="Managing Directors (MD)" employees={employeesForRole(["Managing Director", ...MANAGEMENT_DIRECTOR_ROLES.map((item) => item.role)])} branches />
          {HIERARCHY_LEVELS.slice(3).map((level) => (
            <div key={level.title}>
              <div className="mx-auto h-7 w-px bg-slate-300" />
              <HierarchyTier title={level.title} employees={employeesForRole(level.roles)} />
            </div>
          ))}
        </div>
        {visibleEmployees.length === 0 && <p className="mt-4 text-center text-sm text-slate-500">No employees match these filters.</p>}
      </div>
      {currentUser?.role === "Vice Chairman" && (
        <div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-slate-800">Assign Reporting Manager</h2>
          <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={handleAssignSupervisor}>
            <select required value={selectedEmployeeId} onChange={(event) => { setSelectedEmployeeId(event.target.value); setSelectedSupervisorId(""); setAssignmentMessage(null); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <option value="">Select employee</option>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} — {employee.role}</option>)}
            </select>
            <select required value={selectedSupervisorId} onChange={(event) => setSelectedSupervisorId(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700" disabled={!selectedEmployeeId}>
              <option value="">Select supervisor</option>
              {supervisorOptions.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} — {employee.role}</option>)}
            </select>
            <button type="submit" disabled={savingAssignment || !selectedEmployeeId || !selectedSupervisorId} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{savingAssignment ? "Saving..." : "Save"}</button>
          </form>
          {assignmentMessage && <p className="mt-3 text-sm text-slate-600">{assignmentMessage}</p>}
        </div>
      )}
    </div>
  );
}
