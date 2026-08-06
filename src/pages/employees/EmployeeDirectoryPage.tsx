import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Plus, Search, UserCheck, UserX, Trash2, Eye, Pencil } from "lucide-react";
import { EMPLOYEE_DEPARTMENTS, normalizeDepartmentName } from "../../constants/departments";
import { useEmployees } from "../../hooks/useEmployees";
import {
  activateEmployee,
  createEmployee,
  deleteEmployee,
  getEmployeesForUser,
  suspendEmployee,
  updateEmployee,
} from "../../services/employee.service";
import type { Employee } from "../../types/employee.types";

const EMPLOYEE_ROLES = [
  "Worker",
  "Supervisor",
  "Manager",
  "Chief Manager",
  "General Manager",
  "MD-Manufacturing",
  "MD-Marketing",
  "MD-Transport",
  "MD-RD",
  "Vice President",
  "Vice Chairman",
];

const EMPLOYEE_DEPARTMENT_OPTIONS = [...EMPLOYEE_DEPARTMENTS];

interface CurrentUser {
  id: string;
  role: string;
  dept: string;
}

interface EmployeeDirectoryPageProps {
  currentUser: CurrentUser;
  onSelectEmployee?: (employeeId: string) => void;
  onOpenCreate?: () => void;
}

const PAGE_SIZE = 10;

const ROLE_LEVEL: Record<string, number> = {
  "Vice Chairman": 8,
  "Vice President": 7,
  "MD-Manufacturing": 6,
  "MD-Marketing": 6,
  "MD-Transport": 6,
  "MD-RD": 6,
  "General Manager": 5,
  "Chief Manager": 4,
  Manager: 3,
  Supervisor: 2,
  Worker: 1,
};

function canManageEmployee(currentUser: CurrentUser, employee: Employee): boolean {
  if (currentUser.role === "Worker" || employee.id === currentUser.id) return false;
  if (employee.role === "Vice Chairman") return false;
  if (currentUser.role === "Vice President" && employee.role === "Vice President") return false;
  if (currentUser.role === "Vice Chairman" || currentUser.role === "Vice President") return true;
  return (ROLE_LEVEL[employee.role] ?? 1) < (ROLE_LEVEL[currentUser.role] ?? 1);
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/50 bg-white/40 p-10 text-center text-sm text-slate-600">
      {message}
    </div>
  );
}

export function EmployeeDirectoryPage({ currentUser, onSelectEmployee, onOpenCreate }: EmployeeDirectoryPageProps) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [role, setRole] = useState("All");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedRole, setSelectedRole] = useState("Worker");
  const [selectedDepartment, setSelectedDepartment] = useState<(typeof EMPLOYEE_DEPARTMENT_OPTIONS)[number]>(EMPLOYEE_DEPARTMENT_OPTIONS[0]);
  const [supervisorId, setSupervisorId] = useState("");
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [joiningDate, setJoiningDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { employees, loading, error, refresh } = useEmployees({
    search,
    department: department === "All" ? undefined : department,
    role: role === "All" ? undefined : role,
    status: status === "All" ? undefined : status,
  }, currentUser.id);

  useEffect(() => {
    let active = true;
    void getEmployeesForUser(currentUser.id).then((employeesList) => {
      if (active) {
        setAllEmployees(employeesList);
      }
    }).catch((err) => {
      console.error("Failed to load supervisor options", err);
    });
    return () => {
      active = false;
    };
  }, [currentUser.id]);

  const filteredEmployees = useMemo(() => {
    return employees;
  }, [employees]);
  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const pagedEmployees = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredEmployees.slice(start, start + PAGE_SIZE);
  }, [filteredEmployees, page]);

  const departmentOptions = useMemo(
    () => Array.from(new Set([...employees.map((employee) => normalizeDepartmentName(employee.department)), ...EMPLOYEE_DEPARTMENT_OPTIONS])).sort(),
    [employees],
  );
  const roleOptions = useMemo(
    () => Array.from(new Set([...employees.map((employee) => employee.role), ...EMPLOYEE_ROLES])).sort(),
    [employees],
  );

  const supervisorOptions = useMemo(() => {
    const selectedLevel = ROLE_LEVEL[selectedRole] ?? 1;
    const higher = allEmployees.filter((employee) => (ROLE_LEVEL[employee.role] ?? 1) > selectedLevel);
    if (selectedLevel === 1) {
      return higher;
    }
    const nextLevel = higher.reduce((min, employee) => Math.min(min, ROLE_LEVEL[employee.role] ?? 99), 99);
    const minimalHigher = higher.filter((employee) => (ROLE_LEVEL[employee.role] ?? 1) === nextLevel);
    return minimalHigher.length > 0 ? minimalHigher : higher;
  }, [allEmployees, selectedRole]);

  async function handleCreateEmployee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name || !email || !phone || !selectedRole || !selectedDepartment) {
      setMessage("Please complete the required fields.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage(null);
      await createEmployee(currentUser.id, {
        name,
        email,
        phone,
        role: selectedRole,
        department: normalizeDepartmentName(selectedDepartment),
        reportsTo: supervisorId || null,
        joiningDate: joiningDate || null,
      });
      setFormOpen(false);
      setName("");
      setEmail("");
      setPhone("");
      setSelectedRole("Worker");
      setSelectedDepartment(EMPLOYEE_DEPARTMENT_OPTIONS[0]);
      setSupervisorId("");
      setJoiningDate("");
      setMessage("Employee added successfully.");
    } catch (err) {
      console.error("Create employee failed", err);
      setMessage(err instanceof Error ? err.message : "Failed to create employee");
    } finally {
      setSubmitting(false);
      await refresh();
    }
  }

  async function toggleStatus(employee: Employee, nextStatus: "Active" | "Suspended") {
    try {
      if (nextStatus === "Active") {
        await activateEmployee(currentUser.id, employee.id);
      } else {
        await suspendEmployee(currentUser.id, employee.id);
      }
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to update employee status");
    }
  }

  function openEditModal(employee: Employee) {
    setEditingEmployee(employee);
    setName(employee.name);
    setEmail(employee.email);
    setPhone(employee.phone);
    setSelectedRole(employee.role);
    setSelectedDepartment(normalizeDepartmentName(employee.department));
    setSupervisorId(employee.reportsTo ?? "");
    setJoiningDate(employee.joiningDate ?? "");
    setEditOpen(true);
  }

  async function handleUpdateEmployee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingEmployee) return;
    if (!name || !email || !phone || !selectedRole || !selectedDepartment) {
      setMessage("Please complete the required fields.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage(null);
      await updateEmployee(currentUser.id, editingEmployee.id, {
        name,
        email,
        phone,
        role: selectedRole,
        department: normalizeDepartmentName(selectedDepartment),
        reportsTo: supervisorId || null,
        joiningDate: joiningDate || null,
      });
      setEditOpen(false);
      setEditingEmployee(null);
      await refresh();
      setMessage("Employee updated successfully.");
    } catch (err) {
      console.error("Update employee failed", err);
      setMessage(err instanceof Error ? err.message : "Failed to update employee");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(employee: Employee) {
    try {
      await deleteEmployee(currentUser.id, employee.id);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to delete employee");
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="rounded-2xl border border-white/50 bg-white/40 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Employee Directory</h1>
            <p className="text-sm text-slate-600">Search, filter, and manage employees from the database.</p>
          </div>
          {currentUser.role !== "Worker" && (
            <button
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus size={16} /> Add Employee
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {message}
        </div>
      )}

      <div className="rounded-2xl border border-white/50 bg-white/40 p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-700">
            <span className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Search size={14} /> Search
            </span>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Employee ID, name, email..."
              className="w-full bg-transparent outline-none"
            />
          </label>
          <label className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-700">
            <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Department</span>
            <select
              value={department}
              onChange={(event) => {
                setDepartment(event.target.value);
                setPage(1);
              }}
              className="w-full bg-transparent outline-none"
            >
              <option value="All">All</option>
              {departmentOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-700">
            <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Role</span>
            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
              }}
              className="w-full bg-transparent outline-none"
            >
              <option value="All">All</option>
              {roleOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-700">
            <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="w-full bg-transparent outline-none"
            >
              <option value="All">All</option>
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <EmptyState message="Loading employees..." />
      ) : error ? (
        <EmptyState message={error} />
      ) : filteredEmployees.length === 0 ? (
        <EmptyState message="No employees found for the current criteria." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/50 bg-white/40 shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white/60 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Employee ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Designation</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Reports To</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Joining Date</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedEmployees.map((employee) => (
                  <tr key={employee.id} className="border-t border-white/40 bg-white/20">
                    <td className="px-4 py-3 font-semibold text-slate-700">{employee.employeeId}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{employee.name}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{employee.role}</td>
                    <td className="px-4 py-3 text-slate-600">{employee.department}</td>
                    <td className="px-4 py-3 text-slate-600">{employee.reportsTo ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${employee.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {employee.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{employee.phone}</td>
                    <td className="px-4 py-3 text-slate-600">{employee.email}</td>
                    <td className="px-4 py-3 text-slate-600">{employee.joiningDate ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => onSelectEmployee?.(employee.id)} className="rounded-lg p-2 text-slate-600 hover:bg-white/70" title="View Profile">
                          <Eye size={15} />
                        </button>
                        {canManageEmployee(currentUser, employee) && (
                          <>
                            <button onClick={() => openEditModal(employee)} className="rounded-lg p-2 text-slate-600 hover:bg-white/70" title="Edit Employee">
                              <Pencil size={15} />
                            </button>
                            {employee.status === "Active" ? (
                              <button onClick={() => void toggleStatus(employee, "Suspended")} className="rounded-lg p-2 text-amber-700 hover:bg-white/70" title="Suspend">
                                <UserX size={15} />
                              </button>
                            ) : (
                              <button onClick={() => void toggleStatus(employee, "Active")} className="rounded-lg p-2 text-emerald-700 hover:bg-white/70" title="Activate">
                                <UserCheck size={15} />
                              </button>
                            )}
                            <button onClick={() => void handleDelete(employee)} className="rounded-lg p-2 text-rose-700 hover:bg-white/70" title="Delete">
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-white/40 bg-white/40 px-4 py-3 text-sm text-slate-600">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg px-3 py-1 disabled:opacity-40">
                Previous
              </button>
              <button disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg px-3 py-1 disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-white/60 bg-white/90 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Add New Employee</h2>
                <p className="text-sm text-slate-600">Create a new employee record in the database.</p>
              </div>
              <button onClick={() => setFormOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                ✕
              </button>
            </div>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateEmployee}>
              <label className="md:col-span-2 text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
                <input required value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
                <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</span>
                <input required value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Role</span>
                <select required value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2">
                  {EMPLOYEE_ROLES.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Department</span>
                <select required value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value as (typeof EMPLOYEE_DEPARTMENT_OPTIONS)[number])} className="w-full rounded-xl border border-slate-200 px-3 py-2">
                  {EMPLOYEE_DEPARTMENT_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Reports To</span>
                <select value={supervisorId} onChange={(event) => setSupervisorId(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2">
                  <option value="">None</option>
                  {supervisorOptions.map((supervisor) => (
                    <option key={supervisor.id} value={supervisor.id}>
                      {supervisor.name} — {supervisor.role}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Joining Date</span>
                <input type="date" value={joiningDate} onChange={(event) => setJoiningDate(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <div className="md:col-span-2 flex justify-end gap-3">
                <button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                <button type="submit" disabled={submitting} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {submitting ? "Saving..." : "Create Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editOpen && editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-white/60 bg-white/90 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Edit Employee</h2>
                <p className="text-sm text-slate-600">Update employee profile details and reporting information.</p>
              </div>
              <button onClick={() => { setEditOpen(false); setEditingEmployee(null); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                ✕
              </button>
            </div>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleUpdateEmployee}>
              <label className="md:col-span-2 text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
                <input required value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
                <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</span>
                <input required value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Role</span>
                <select required value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2">
                  {roleOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Department</span>
                <select required value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value as (typeof EMPLOYEE_DEPARTMENT_OPTIONS)[number])} className="w-full rounded-xl border border-slate-200 px-3 py-2">
                  {departmentOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Reports To</span>
                <select value={supervisorId} onChange={(event) => setSupervisorId(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2">
                  <option value="">None</option>
                  {supervisorOptions.map((supervisor) => (
                    <option key={supervisor.id} value={supervisor.id}>
                      {supervisor.name} — {supervisor.role}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Joining Date</span>
                <input type="date" value={joiningDate} onChange={(event) => setJoiningDate(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <div className="md:col-span-2 flex justify-end gap-3">
                <button type="button" onClick={() => { setEditOpen(false); setEditingEmployee(null); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                <button type="submit" disabled={submitting} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
