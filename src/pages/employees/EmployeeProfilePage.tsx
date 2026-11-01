import { useEffect, useMemo, useState } from "react";
import { AlertCircle, BadgeCheck, Building2, CalendarDays, Mail, Pencil, Phone, Save, ShieldCheck } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useEmployeeProfile } from "../../hooks/useEmployeeProfile";
import { updateEmployee } from "../../services/employee.service";
import { getEmployeeDepartmentHistory } from "../../services/department.service";
import type { EmployeeDepartmentHistory } from "../../types/department.types";

interface EmployeeProfilePageProps {
  employeeId: string;
  editable?: boolean;
  currentUserId?: string;
  currentUserRole?: string;
}

export function EmployeeProfilePage({ employeeId, editable = false, currentUserId, currentUserRole }: EmployeeProfilePageProps) {
  const { refreshProfile } = useAuth();
  const { profile, loading, error, refresh } = useEmployeeProfile(employeeId);
  const [form, setForm] = useState({ name: "", employeeCode: "", designation: "", hierarchyLevel: "1", email: "", phone: "", address: "", department: "", status: "Active", reportsTo: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [departmentHistory, setDepartmentHistory] = useState<EmployeeDepartmentHistory[]>([]);

  const canEditProfile = editable && Boolean(currentUserId) && employeeId === currentUserId;
  const canEditReportsTo = editable && Boolean(currentUserId) && employeeId !== currentUserId && Boolean(currentUserRole) && ["Vice Chairman", "Vice President", "Managing Director", "General Manager", "Chief Manager", "Manager"].includes(currentUserRole ?? "");

  const summaryCards = useMemo(() => {
    if (!profile) return [];
    return [
      { label: "Attendance %", value: `${profile.attendancePercentage}%`, detail: "From attendance records" },
      { label: "Bills Submitted", value: String(profile.billsCount), detail: "Bills linked to employee" },
      { label: "Orders Managed", value: String(profile.ordersCount), detail: "Orders linked to employee" },
      { label: "Performance Summary", value: profile.performanceSummary, detail: "Live database summary" },
    ];
  }, [profile]);

  const handleSave = async () => {
    if (!profile || !employeeId || !currentUserId) return;
    try {
      setSaving(true);
      setMessage(null);

      const nextPhone = form.phone.trim();
      const nextEmail = form.email.trim();
      const nextAddress = form.address.trim();

      if (nextPhone === (profile.phone ?? "") && nextEmail === (profile.email ?? "") && nextAddress === (profile.address ?? "")) {
        setMessage("No changes to save.");
        return;
      }

      await updateEmployee(currentUserId, employeeId, {
        phone: nextPhone,
        email: nextEmail,
        address: nextAddress,
      });

      await Promise.all([refresh(), refreshProfile()]);
      setIsEditing(false);
      setMessage("Profile updated successfully.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to save profile changes.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name ?? "",
        employeeCode: profile.employeeCode ?? "",
        designation: profile.designation ?? "",
        hierarchyLevel: profile.hierarchyLevel ? String(profile.hierarchyLevel) : "1",
        email: profile.email ?? "",
        phone: profile.phone ?? "",
        address: profile.address ?? "",
        department: profile.department === "Transport" ? "Transportation" : profile.department ?? "",
        status: profile.status ?? "Active",
        reportsTo: profile.reportsTo ?? "",
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!employeeId) return;
    void getEmployeeDepartmentHistory(employeeId).then(setDepartmentHistory).catch(() => setDepartmentHistory([]));
  }, [employeeId, profile?.department]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Loading profile...</div>;
  }

  if (error || !profile) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            {error ?? "Employee profile not found."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-feature-page p-6 space-y-5">
      <div className="rounded-2xl border border-white/50 bg-white/40 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-700 text-xl font-semibold text-white">
              {profile.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-800">{profile.name}</h1>
              <p className="text-sm text-slate-600">{profile.roleName ?? profile.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editable && canEditProfile && (
              <button onClick={() => setIsEditing((value) => !value)} className="inline-flex items-center gap-2 rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700">
                <Pencil size={14} /> {isEditing ? "Cancel" : "Edit Profile"}
              </button>
            )}
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${profile.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
              {profile.status}
            </span>
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-white/50 bg-white/40 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Profile Details</h2>
            {isEditing && canEditProfile && (
              <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">
                <Save size={14} /> {saving ? "Saving..." : "Save"}
              </button>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="rounded-xl border border-white/60 bg-white/70 p-4 text-sm text-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</div>
              <div className="mt-2 font-medium text-slate-800">{profile.name}</div>
            </label>
            <label className="rounded-xl border border-white/60 bg-white/70 p-4 text-sm text-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Employee ID</div>
              <div className="mt-2 font-medium text-slate-800">{profile.employeeId}</div>
            </label>
            <label className="rounded-xl border border-white/60 bg-white/70 p-4 text-sm text-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Employee Code</div>
              <div className="mt-2 font-medium text-slate-800">{profile.employeeCode || "—"}</div>
            </label>
            <label className="rounded-xl border border-white/60 bg-white/70 p-4 text-sm text-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Designation</div>
              <div className="mt-2 font-medium text-slate-800">{profile.designation || "—"}</div>
            </label>
            <label className="rounded-xl border border-white/60 bg-white/70 p-4 text-sm text-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hierarchy Level</div>
              <div className="mt-2 font-medium text-slate-800">{profile.hierarchyLevel ?? "—"}</div>
            </label>
            <label className="rounded-xl border border-white/60 bg-white/70 p-4 text-sm text-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</div>
              <div className="mt-2 font-medium text-slate-800">{profile.roleName ?? profile.role}</div>
            </label>
            <label className="rounded-xl border border-white/60 bg-white/70 p-4 text-sm text-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Department</div>
              <div className="mt-2 font-medium text-slate-800">{profile.departmentName ?? profile.department}</div>
            </label>
            <label className="rounded-xl border border-white/60 bg-white/70 p-4 text-sm text-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</div>
              {isEditing && canEditProfile ? (
                <input value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none" />
              ) : (
                <div className="mt-2 flex items-center gap-2 font-medium text-slate-800">
                  <Mail size={14} /> {profile.email}
                </div>
              )}
            </label>
            <label className="rounded-xl border border-white/60 bg-white/70 p-4 text-sm text-slate-700 md:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address</div>
              {isEditing && canEditProfile ? (
                <textarea value={form.address} onChange={(event) => setForm((value) => ({ ...value, address: event.target.value }))} className="mt-2 min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none" />
              ) : (
                <div className="mt-2 font-medium text-slate-800">{profile.address || "—"}</div>
              )}
            </label>
            <label className="rounded-xl border border-white/60 bg-white/70 p-4 text-sm text-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</div>
              {isEditing && canEditProfile ? (
                <input value={form.phone} onChange={(event) => setForm((value) => ({ ...value, phone: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none" />
              ) : (
                <div className="mt-2 flex items-center gap-2 font-medium text-slate-800">
                  <Phone size={14} /> {profile.phone}
                </div>
              )}
            </label>
            <label className="rounded-xl border border-white/60 bg-white/70 p-4 text-sm text-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Joining Date</div>
              <div className="mt-2 flex items-center gap-2 font-medium text-slate-800">
                <CalendarDays size={14} /> {profile.joiningDate ?? "—"}
              </div>
            </label>
            <label className="rounded-xl border border-white/60 bg-white/70 p-4 text-sm text-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</div>
              <div className="mt-2 flex items-center gap-2 font-medium text-slate-800">
                <BadgeCheck size={14} /> {profile.status}
              </div>
            </label>
            <label className="md:col-span-2 rounded-xl border border-white/60 bg-white/70 p-4 text-sm text-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reports To</div>
              {isEditing && canEditReportsTo ? (
                <input value={form.reportsTo} onChange={(event) => setForm((value) => ({ ...value, reportsTo: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none" placeholder="Manager ID" />
              ) : (
                <div className="mt-2 flex items-center gap-2 font-medium text-slate-800">
                  <Building2 size={14} /> {profile.managerName ?? "—"}
                </div>
              )}
            </label>
          </div>
          <div className="mt-5 rounded-xl border border-white/60 bg-white/70 p-4 text-sm text-slate-700">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Department History</div>
            {departmentHistory.length > 0 ? departmentHistory.map((change) => (
              <div key={change.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 py-2 first:border-t-0 first:pt-0">
                <span>{change.previousDepartment ?? "Unassigned"} to {change.newDepartment}</span>
                <span className="text-xs text-slate-500">{new Date(change.createdAt).toLocaleString()}</span>
              </div>
            )) : <div className="text-slate-500">No department changes recorded.</div>}
          </div>
        </div>

        <div className="rounded-2xl border border-white/50 bg-white/40 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Company Information</h2>
          <div className="space-y-3 text-sm text-slate-700">
            <div className="flex items-center justify-between rounded-xl border border-white/60 bg-white/70 px-4 py-3">
              <span className="font-medium">Employee ID</span>
              <span>{profile.employeeId}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/60 bg-white/70 px-4 py-3">
              <span className="font-medium">Department</span>
              <span>{profile.departmentName ?? profile.department}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/60 bg-white/70 px-4 py-3">
              <span className="font-medium">Role</span>
              <span>{profile.roleName ?? profile.role}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/60 bg-white/70 px-4 py-3">
              <span className="font-medium">Reports To</span>
              <span>{profile.managerName ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/60 bg-white/70 px-4 py-3">
              <span className="font-medium">Created Date</span>
              <span>{profile.createdAt ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/60 bg-white/70 px-4 py-3">
              <span className="font-medium">Status</span>
              <span>{profile.status}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/60 bg-white/70 px-4 py-3">
              <span className="font-medium">Permission</span>
              <span className="flex items-center gap-2 text-emerald-700">
                <ShieldCheck size={14} /> {canEditReportsTo ? "Can update reports_to" : "Read only reports_to"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-white/50 bg-white/40 p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</div>
            <div className="mt-2 text-lg font-semibold text-slate-800">{card.value}</div>
            <div className="mt-1 text-sm text-slate-600">{card.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
