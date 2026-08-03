import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Building2, Mail, Phone, MapPin, CalendarDays, BadgeCheck, Pencil, Save, KeyRound, ShieldCheck } from "lucide-react";
import { useEmployeeProfile } from "../../hooks/useEmployeeProfile";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";

interface EmployeeProfilePageProps {
  employeeId: string;
  editable?: boolean;
  currentUserId?: string;
  currentUserRole?: string;
}

export function EmployeeProfilePage({ employeeId, editable = false, currentUserId, currentUserRole }: EmployeeProfilePageProps) {
  const { profile: authProfile } = useAuth();
  const { profile, loading, error, refresh } = useEmployeeProfile(employeeId);
  const [form, setForm] = useState({ email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const canEditEmail = editable && (currentUserRole === "Vice Chairman" || currentUserRole === "Vice President" || currentUserRole === "General Manager" || currentUserRole === "Chief Manager" || currentUserRole === "Manager" || currentUserRole === "Supervisor");

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
    if (!profile || !employeeId || !currentUserId || employeeId !== currentUserId) return;
    try {
      setSaving(true);
      setMessage(null);
      const updates: Record<string, string> = {};
      if (form.phone.trim()) updates.phone = form.phone.trim();
      if (canEditEmail && form.email.trim()) updates.email = form.email.trim();
      if (Object.keys(updates).length === 0) {
        setMessage("No changes to save.");
        return;
      }
      const { error } = await supabase.from("profiles").update(updates).eq("id", employeeId);
      if (error) throw error;
      await refresh();
      setIsEditing(false);
      setMessage("Profile updated successfully.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to save profile changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!authProfile?.email) return;
    try {
      setSaving(true);
      setMessage(null);
      const { error } = await supabase.auth.resetPasswordForEmail(authProfile.email, { redirectTo: window.location.origin + "/" });
      if (error) throw error;
      setMessage("Password reset link sent to your email.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to start password reset.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (profile) {
      setForm({
        email: profile.email ?? "",
        phone: profile.phone ?? "",
      });
    }
  }, [profile]);

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
    <div className="p-6 space-y-5">
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
            {editable && employeeId === currentUserId && (
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
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Personal Information</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/60 bg-white/70 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date of Birth</div>
              <div className="mt-1 text-sm text-slate-700">{profile.dob ?? "—"}</div>
            </div>
            <div className="rounded-xl border border-white/60 bg-white/70 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gender</div>
              <div className="mt-1 text-sm text-slate-700">{profile.gender ?? "—"}</div>
            </div>
            <div className="rounded-xl border border-white/60 bg-white/70 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</div>
              {isEditing && editable && employeeId === currentUserId ? (
                <input value={form.phone} onChange={(event) => setForm((value) => ({ ...value, phone: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/60 bg-white px-3 py-2 text-sm text-slate-700 outline-none" />
              ) : (
                <div className="mt-1 flex items-center gap-2 text-sm text-slate-700">
                  <Phone size={14} /> {profile.phone}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-white/60 bg-white/70 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</div>
              {isEditing && editable && employeeId === currentUserId && canEditEmail ? (
                <input value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/60 bg-white px-3 py-2 text-sm text-slate-700 outline-none" />
              ) : (
                <div className="mt-1 flex items-center gap-2 text-sm text-slate-700">
                  <Mail size={14} /> {profile.email}
                </div>
              )}
            </div>
            <div className="md:col-span-2 rounded-xl border border-white/60 bg-white/70 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address</div>
              <div className="mt-1 flex items-start gap-2 text-sm text-slate-700">
                <MapPin size={14} className="mt-0.5" /> {profile.address ?? "—"}
              </div>
            </div>
          </div>
          {editable && employeeId === currentUserId && isEditing && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">
                <Save size={14} /> {saving ? "Saving..." : "Save Changes"}
              </button>
              <button onClick={handleChangePassword} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700">
                <KeyRound size={14} /> Change Password
              </button>
            </div>
          )}
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
              <span className="font-medium">Joining Date</span>
              <span>{profile.joiningDate ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/60 bg-white/70 px-4 py-3">
              <span className="font-medium">Created At</span>
              <span>{profile.createdAt ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/60 bg-white/70 px-4 py-3">
              <span className="font-medium">Employment Status</span>
              <span>{profile.status}</span>
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
