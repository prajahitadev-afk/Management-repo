import { useMemo, useState } from "react";
import { AlertCircle, Building2, ChevronDown, ChevronRight, Contact, Search, Users } from "lucide-react";
import { useOrganizationChart } from "../../hooks/useOrganizationChart";
import { assignSupervisor } from "../../services/employee-hierarchy.service";
import type { EmployeeHierarchyNode } from "../../types/employee-hierarchy.types";

interface OrganizationChartPageProps {
  currentUser?: {
    id: string;
    role: string;
  };
  onSelectEmployee?: (employeeId: string) => void;
}

function flattenNodes(nodes: EmployeeHierarchyNode[]): EmployeeHierarchyNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);
}

function filterNodes(nodes: EmployeeHierarchyNode[], query: string, department: string): EmployeeHierarchyNode[] {
  return nodes.flatMap((node) => {
    const children = filterNodes(node.children, query, department);
    const matches = (!query || [node.name, node.employeeCode, node.role, node.department].join(" ").toLowerCase().includes(query))
      && (department === "All" || node.department === department);
    return matches || children.length > 0 ? [{ ...node, children }] : [];
  });
}

function OrganizationCard({ node, onSelectEmployee }: { node: EmployeeHierarchyNode; onSelectEmployee?: (employeeId: string) => void }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => setOpen((current) => !current)} className="flex min-w-0 items-center gap-2 text-left">
          {node.children.length > 0 ? (open ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : <span className="w-4" />}
          <div>
          <div className="font-semibold text-slate-800">{node.name}</div>
          <div className="text-sm text-slate-600">{node.role}</div>
          </div>
        </button>
        <div className="text-right text-xs text-slate-500"><div>{node.department}</div><div>{node.status}</div></div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-700">
        <button onClick={() => onSelectEmployee?.(node.id)} className="font-medium text-emerald-700 hover:underline">{node.employeeCode}</button>
        <span className="flex items-center gap-2"><Building2 size={14} /> {node.department}</span>
        <span className="flex items-center gap-2"><Contact size={14} /> Reports to: {node.supervisorId}</span>
        <span className="flex items-center gap-2"><Users size={14} /> {node.children.length} direct reports</span>
        <span>Joined: {node.joiningDate ?? "—"}</span>
      </div>
      {node.children.length > 0 && (
        <div className={`${open ? "mt-3" : "hidden"} space-y-3 border-l border-white/60 pl-3`}>
          {node.children.map((child) => <OrganizationCard key={child.id} node={child} onSelectEmployee={onSelectEmployee} />)}
        </div>
      )}
    </div>
  );
}

export function OrganizationChartPage({ currentUser, onSelectEmployee }: OrganizationChartPageProps) {
  const { nodes, employees, loading, error, refresh } = useOrganizationChart({ userId: currentUser?.id });
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedSupervisorId, setSelectedSupervisorId] = useState("");
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);
  const departments = useMemo(() => Array.from(new Set(flattenNodes(nodes).map((node) => node.department))).sort(), [nodes]);
  const filteredNodes = useMemo(() => filterNodes(nodes, search.trim().toLowerCase(), department), [nodes, search, department]);
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

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Loading organization chart...</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          <div className="flex items-center gap-2"><AlertCircle size={16} /> {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="rounded-2xl border border-white/50 bg-white/40 p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-800">Organizational Hierarchy</h1>
        <p className="text-sm text-slate-600">Employee reporting relationships from the hierarchy database.</p>
      </div>
      <div className="rounded-2xl border border-white/50 bg-white/40 p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-800">Assign Supervisor</h2>
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
      <div className="rounded-2xl border border-white/50 bg-white/40 p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-700"><span className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Search size={14} /> Search employees</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, code, role..." className="w-full bg-transparent outline-none" /></label>
          <label className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-700"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Department</span><select value={department} onChange={(event) => setDepartment(event.target.value)} className="w-full bg-transparent outline-none"><option value="All">All</option>{departments.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
        </div>
      </div>
      <div className="space-y-3">
        {filteredNodes.length > 0 ? filteredNodes.map((node) => <OrganizationCard key={node.id} node={node} onSelectEmployee={onSelectEmployee} />) : <div className="rounded-2xl border border-dashed border-white/50 bg-white/40 p-10 text-center text-sm text-slate-600">No employees found.</div>}
      </div>
    </div>
  );
}
