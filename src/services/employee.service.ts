import { supabase, EMPLOYEE_PORTAL_URL, EMPLOYEE_RESET_URL } from "../lib/supabase";
import type {
  AttendanceStatus,
  AttendanceSummary,
  Employee,
  EmployeeFilters,
  EmployeeProfile,
  OrganizationNode,
} from "../types/employee.types";

export type AttendanceReportPeriod = "daily" | "weekly" | "monthly";

export type EmployeeAction = "create" | "update" | "suspend" | "activate" | "delete";

const ROLE_LEVEL: Record<string, number> = {
  "Vice Chairman": 8,
  "Vice President": 7,
  "Managing Director": 6,
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

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readDate(value: unknown): string | null {
  const text = readString(value);
  return text ?? null;
}

function toEmployee(record: Record<string, unknown>): Employee {
  const id = readString(record.id) ?? "";
  const employeeId = readString(record.employee_id) ?? readString(record.employeeId) ?? id;
  const name = readString(record.name) ?? "Unnamed Employee";
  const email = readString(record.email) ?? "";
  const phone = readString(record.phone) ?? "";
  const department = readString(record.department) ?? readString(record.department_name) ?? "Unassigned";
  const role = readString(record.role) ?? readString(record.role_name) ?? "Worker";
  const reportsTo = readString(record.reports_to) ?? readString(record.manager_id) ?? null;
  const status = readString(record.status) ?? "Active";
  const joiningDate = readDate(record.joining_date) ?? readDate(record.created_at);
  const createdAt = readDate(record.created_at);
  const photoUrl = readString(record.photo_url) ?? readString(record.avatar_url) ?? null;

  return {
    id,
    employeeId,
    name,
    email,
    phone,
    department,
    role,
    reportsTo,
    status,
    joiningDate,
    createdAt,
    photoUrl,
  };
}

function buildTemporaryPassword(seed: string): string {
  const normalizedSeed = seed.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "TempUser";
  return `${normalizedSeed}${Date.now().toString().slice(-4)}!Aa1`;
}

async function cleanupCreatedAuthUser(authUserId: string | null): Promise<void> {
  if (!authUserId) return;

  const adminClient = (supabase.auth as typeof supabase.auth & { admin?: { deleteUser?: (userId: string) => Promise<{ error: { message: string } | null }> } }).admin;
  const deleteUser = adminClient?.deleteUser;
  if (!deleteUser) {
    console.warn("Auth user cleanup skipped because admin deleteUser is unavailable.", { authUserId });
    return;
  }

  const { error } = await deleteUser(authUserId);
  if (error) {
    console.error("Failed to remove newly created auth user during rollback.", error);
  }
}

function buildEmployeeProfilePayload(input: {
  authUserId: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  reportsTo: string | null;
  joiningDate: string | null;
}) {
  return {
    id: input.authUserId,
    employee_id: input.employeeId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    role: input.role,
    department: input.department,
    reports_to: input.reportsTo,
    joining_date: input.joiningDate,
    status: "Active",
  };
}

function employeeProfilesQuery(select = "*") {
  return supabase.from("profiles").select(select).not("role", "is", null) as any;
}

function buildEmployeeQuery(filters: EmployeeFilters = {}) {
  const { search, department, role, status } = filters;
  let query = employeeProfilesQuery("*");

  if (search && search.trim()) {
    const term = search.trim();
    const pattern = `%${term}%`;
    query = query.or(
      `employee_id.ilike.${pattern},name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},department.ilike.${pattern},role.ilike.${pattern}`,
    );
  }

  if (department) {
    query = query.eq("department", department);
  }

  if (role) {
    query = query.eq("role", role);
  }

  if (status) {
    query = query.eq("status", status);
  }

  return query.order("created_at", { ascending: false });
}

export async function getEmployees(filters: EmployeeFilters = {}): Promise<Employee[]> {
  let query = employeeProfilesQuery("*");

  const { search, department, role, status } = filters;
  const term = search?.trim();
  if (term) {
    const pattern = `%${term}%`;
    query = query.or(
      `employee_id.ilike.${pattern},name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},department.ilike.${pattern},role.ilike.${pattern}`,
    );
  }

  if (department) {
    query = query.eq("department", department);
  }

  if (role) {
    query = query.eq("role", role);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    const fallback = await buildEmployeeQuery(filters);
    const { data: fallbackData, error: fallbackError } = await fallback;
    if (fallbackError) throw fallbackError;
    return ((fallbackData ?? []) as unknown as Array<Record<string, unknown>>).map(toEmployee);
  }

  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(toEmployee);
}

export async function getEmployeesForUser(userId: string, filters: EmployeeFilters = {}): Promise<Employee[]> {
  const visibleIds = await getVisibleEmployeeIdsForUser(userId);
  if (visibleIds.length === 0) return [];

  const employees = await getEmployees(filters);
  const visible = new Set(visibleIds);
  return employees.filter((employee) => visible.has(employee.id));
}

export async function searchEmployees(searchTerm: string, filters: EmployeeFilters = {}): Promise<Employee[]> {
  return getEmployees({ ...filters, search: searchTerm });
}

export async function getEmployeeById(employeeId: string): Promise<EmployeeProfile> {
  let { data, error } = await employeeProfilesQuery("*").eq("id", employeeId).maybeSingle();

  if (error) throw error;
  if (!data) {
    const fallback = await employeeProfilesQuery("*").eq("employee_id", employeeId).maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;
  if (!data) {
    throw new Error("Employee not found");
  }

  const employee = toEmployee(data as unknown as Record<string, unknown>);
  const { data: attendanceRows, error: attendanceError } = await supabase
    .from("attendance")
    .select("status")
    .eq("employee_id", employee.id);

  if (attendanceError) throw attendanceError;

  const totalAttendance = attendanceRows?.length ?? 0;
  const presentCount = (attendanceRows ?? []).filter((row) => row.status === "Present").length;
  const attendancePercentage = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

  const { data: billRows, error: billsError } = await supabase
    .from("bills")
    .select("id")
    .or(`employee_id.eq.${employee.id},submitted_by.eq.${employee.id},created_by.eq.${employee.id}`);
  if (billsError) throw billsError;

  const { data: orderRows, error: ordersError } = await supabase
    .from("orders")
    .select("id")
    .eq("created_by", employee.id);
  if (ordersError) {
    console.error("Supabase query failed", ordersError.message, ordersError.details, ordersError.hint);
    throw ordersError;
  }

  const managerName = employee.reportsTo ? await resolveManagerName(employee.reportsTo) : null;

  return {
    ...employee,
    dob: readDate(data.dob),
    gender: readString(data.gender),
    address: readString(data.address),
    departmentName: readString(data.department_name) ?? employee.department,
    roleName: readString(data.role_name) ?? employee.role,
    managerName,
    attendancePercentage,
    billsCount: billRows?.length ?? 0,
    ordersCount: orderRows?.length ?? 0,
    performanceSummary: `${attendancePercentage}% attendance · ${billRows?.length ?? 0} bills · ${orderRows?.length ?? 0} orders`,
    createdAt: readDate(data.created_at),
  };
}

export async function createEmployee(actorId: string, input: {
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  reportsTo: string | null;
  joiningDate: string | null;
}): Promise<Employee> {
  await authorizeEmployeeAction(actorId, null, "create", input.role, input.reportsTo, input.department);

  const normalizedEmail = input.email.trim().toLowerCase();
  const employeeId = `EMP-${Date.now()}`;
  const tempPassword = buildTemporaryPassword(normalizedEmail);

  console.log("Creating Auth User", { email: normalizedEmail });
  console.log("Password Recovery Redirect", "https://ems.prajahita.com/reset-password");
  const { data: authData, error: authError } = await (supabase.auth as any).signUp({
    email: normalizedEmail,
    password: tempPassword,
  }, {
    redirectTo: "https://ems.prajahita.com/reset-password",
  });
  console.log("Auth Result", authData);

  if (authError || !authData?.user?.id) {
    throw new Error(authError?.message ?? "Failed to create auth user for employee");
  }

  const authUserId = authData.user.id;
  console.log("Auth User ID", authUserId);

  const payload = buildEmployeeProfilePayload({
    authUserId,
    employeeId,
    name: input.name.trim(),
    email: normalizedEmail,
    phone: input.phone.trim(),
    role: input.role,
    department: input.department,
    reportsTo: input.reportsTo,
    joiningDate: input.joiningDate,
  });

  console.log("Creating Profile", JSON.stringify(payload, null, 2));
  const { data, error } = await supabase.from("profiles").insert([payload]).select("*").single();
  console.log("Profile Result", data);

  if (error) {
    console.error("Profile creation failed", error);
    await cleanupCreatedAuthUser(authUserId);
    throw error;
  }

  return toEmployee(data as Record<string, unknown>);
}

export async function updateEmployee(actorId: string, employeeId: string, updates: Partial<Employee>): Promise<Employee> {
  await authorizeEmployeeAction(actorId, employeeId, "update", updates.role, updates.reportsTo, updates.department);
  const payload = {
    name: updates.name,
    email: updates.email,
    phone: updates.phone,
    role: updates.role,
    department: updates.department,
    reports_to: updates.reportsTo,
    status: updates.status,
    joining_date: updates.joiningDate,
  };

  const { data, error } = await supabase.from("profiles").update(payload).eq("id", employeeId).select("*").single();

  if (error) throw error;
  return toEmployee(data as Record<string, unknown>);
}

export async function suspendEmployee(actorId: string, employeeId: string): Promise<void> {
  await authorizeEmployeeAction(actorId, employeeId, "suspend");

  const { error } = await supabase.from("profiles").update({ status: "Suspended" }).eq("id", employeeId);
  if (error) throw error;
}

export async function reactivateEmployee(actorId: string, employeeId: string): Promise<void> {
  await authorizeEmployeeAction(actorId, employeeId, "activate");

  const { error } = await supabase.from("profiles").update({ status: "Active" }).eq("id", employeeId);
  if (error) throw error;
}

export async function activateEmployee(actorId: string, employeeId: string): Promise<void> {
  await reactivateEmployee(actorId, employeeId);
}

export async function deleteEmployee(actorId: string, employeeId: string): Promise<void> {
  await authorizeEmployeeAction(actorId, employeeId, "delete");

  const { error: softDeleteError } = await supabase.from("profiles").update({ deleted_at: new Date().toISOString() }).eq("id", employeeId);

  if (!softDeleteError) return;

  const { error } = await supabase.from("profiles").delete().eq("id", employeeId);
  if (error) throw error;
}

async function authorizeEmployeeAction(
  actorId: string,
  targetId: string | null,
  action: EmployeeAction,
  targetRole?: string,
  targetReportsTo?: string | null,
  targetDepartment?: string,
): Promise<void> {
  const { data: actor, error: actorError } = await supabase
    .from("profiles")
    .select("id, role, department")
    .eq("id", actorId)
    .maybeSingle();
  if (actorError) throw actorError;
  if (!actor) throw new Error("Actor profile not found");

  const actorRole = normalizeRoleName(readString(actor.role) ?? "Worker");
  if (actorRole === "Worker") throw new Error("Operation not permitted for this role");

  if (action === "create") {
    const role = normalizeRoleName(targetRole ?? "Worker");
    if (role === "Vice Chairman" || role === "Vice President") {
      if (actorRole !== "Vice Chairman") throw new Error("Operation not permitted for this role");
    } else if (actorRole !== "Vice Chairman" && actorRole !== "Vice President") {
      if (!targetReportsTo) throw new Error("Employee must be assigned within your reporting hierarchy");
      await assertCanManageRole(actorId, actorRole, readString(actor.department) ?? "", role, targetReportsTo, targetDepartment ?? "");
    }
    return;
  }

  if (!targetId) throw new Error("Target employee is required");
  if (targetId === actorId && (action === "suspend" || action === "delete")) {
    throw new Error("You cannot suspend or delete your own account");
  }

  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, role, department")
    .eq("id", targetId)
    .maybeSingle();
  if (targetError) throw targetError;
  if (!target) throw new Error("Target employee not found");

  const targetRoleName = normalizeRoleName(readString(target.role) ?? "Worker");
  if (targetRoleName === "Vice Chairman") throw new Error("Operation not permitted on protected account");
  if (actorRole === "Vice President" && targetRoleName === "Vice President") {
    throw new Error("Vice Presidents cannot modify peer Vice Presidents");
  }
  if (actorRole !== "Vice Chairman" && actorRole !== "Vice President") {
    await assertCanManageRole(actorId, actorRole, readString(actor.department) ?? "", targetRoleName, targetId, readString(target.department) ?? "");
  }
}

async function assertCanManageRole(
  actorId: string,
  actorRole: string,
  actorDepartment: string,
  targetRole: string,
  targetId: string | null,
  targetDepartment: string,
): Promise<void> {
  const actorLevel = ROLE_LEVEL[actorRole] ?? 1;
  const targetLevel = ROLE_LEVEL[targetRole] ?? 1;
  if (targetLevel >= actorLevel || targetRole === "Vice Chairman" || targetRole === "Vice President") {
    throw new Error("You cannot manage peers or higher-level employees");
  }
  if (actorRole.startsWith("MD-") && actorDepartment && targetDepartment && actorDepartment !== targetDepartment) {
    throw new Error("Managing Directors can only manage employees in their department");
  }

  const visibleIds = await getVisibleEmployeeIdsForUser(actorId);
  if (targetId && !visibleIds.includes(targetId)) {
    const { data: profiles, error } = await supabase.from("profiles").select("id, reports_to");
    if (error) throw error;
    const directOrLower = new Set<string>();
    const collect = (parentId: string) => {
      for (const profile of profiles ?? []) {
        const id = readString(profile.id);
        if (id && readString(profile.reports_to) === parentId && !directOrLower.has(id)) {
          directOrLower.add(id);
          collect(id);
        }
      }
    };
    collect(actorId);
    if (!directOrLower.has(targetId)) throw new Error("You can only manage employees in your hierarchy");
  }
}

export async function getAttendanceSummary(options: {
  date?: string;
  department?: string;
  employeeId?: string;
  status?: AttendanceStatus;
  period?: AttendanceReportPeriod;
  employeeIds?: string[];
} = {}): Promise<AttendanceSummary> {
  const date = options.date ?? new Date().toISOString().slice(0, 10);
  const period = options.period ?? "daily";
  const dateRange = resolveAttendanceDateRange(date, period);

  let query = supabase
    .from("attendance")
    .select("employee_id, status, attendance_date")
    .gte("attendance_date", dateRange.start)
    .lte("attendance_date", dateRange.end);

  if (options.employeeId) {
    query = query.eq("employee_id", options.employeeId);
  }

  if (options.employeeIds && options.employeeIds.length > 0) {
    query = query.in("employee_id", options.employeeIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const records = [] as Array<{ employeeId: string; employeeName: string; status: string; date: string }>;

  const filteredRows = rows.filter((row) => {
    if (options.status && readString(row.status) !== options.status) return false;
    return true;
  });

  for (const row of filteredRows) {
    const employeeId = readString(row.employee_id) ?? "";
    const status = readString(row.status) ?? "Absent";
    const parsedDate = readString(row.attendance_date) ?? date;
    if (!employeeId) continue;

    const { data: employeeRow, error: employeeError } = await supabase.from("profiles").select("name").eq("id", employeeId).maybeSingle();
    if (employeeError) throw employeeError;

    const name = readString(employeeRow?.name) ?? "Employee";
    records.push({ employeeId, employeeName: name, status, date: parsedDate });
  }

  const present = records.filter((row) => row.status === "Present").length;
  const absent = records.filter((row) => row.status === "Absent").length;
  const halfDay = records.filter((row) => row.status === "Half Day").length;
  const leave = records.filter((row) => row.status === "Leave").length;

  return {
    date,
    totalEmployees: records.length,
    present,
    absent,
    halfDay,
    leave,
    attendancePercentage: records.length > 0 ? Math.round((present / records.length) * 100) : 0,
    records,
  };
}

function resolveAttendanceDateRange(date: string, period: AttendanceReportPeriod) {
  const startDate = new Date(`${date}T00:00:00`);
  if (period === "weekly") {
    const day = startDate.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    startDate.setDate(startDate.getDate() + mondayOffset);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    return { start: startDate.toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10) };
  }

  if (period === "monthly") {
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    return { start: new Date(startDate.getFullYear(), startDate.getMonth(), 1).toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10) };
  }

  return { start: date, end: date };
}

export async function saveAttendanceEntries(entries: Array<{ employeeId: string; status: AttendanceStatus; date: string }>): Promise<void> {
  const payload = entries.map((entry) => ({
    employee_id: entry.employeeId,
    attendance_date: entry.date,
    status: entry.status,
  }));

  const { error } = await supabase.from("attendance").upsert(payload, {
    onConflict: "employee_id,attendance_date",
    ignoreDuplicates: false,
  });

  if (error) throw error;
}

export async function getSubordinateEmployeeIds(userId: string): Promise<string[]> {
  const { data: currentProfile, error: currentProfileError } = await employeeProfilesQuery("id, role, reports_to")
    .eq("id", userId)
    .maybeSingle();

  if (currentProfileError || !currentProfile) {
    return [userId];
  }

  const { data: allProfiles, error } = await employeeProfilesQuery("id, role, reports_to");
  if (error) throw error;

  const profiles = ((allProfiles ?? []) as Array<Record<string, unknown>>).filter((record) => readString(record.id));
  const currentRole = normalizeRoleName(readString(currentProfile.role) ?? "Worker");
  const visibleIds = new Set<string>();

  if (currentRole === "Vice Chairman") {
    profiles.forEach((profile) => visibleIds.add(readString(profile.id) as string));
    return Array.from(visibleIds);
  }
  if (currentRole === "Vice President") {
    profiles.forEach((profile) => visibleIds.add(readString(profile.id) as string));
    return Array.from(visibleIds);
  }

  if (currentRole === "Worker") {
    return [userId];
  }

  const collectDescendants = (parentId: string) => {
    profiles.forEach((profile) => {
      const profileId = readString(profile.id);
      const reportsTo = readString(profile.reports_to);
      if (!profileId || !reportsTo) return;
      if (reportsTo === parentId) {
        visibleIds.add(profileId);
        collectDescendants(profileId);
      }
    });
  };

  collectDescendants(userId);

  if (currentRole === "Supervisor") {
    return Array.from(visibleIds).filter((id) => {
      const profile = profiles.find((candidate) => readString(candidate.id) === id);
      return normalizeRoleName(readString(profile?.role) ?? "Worker") === "Worker";
    });
  }

  return Array.from(visibleIds);
}

export async function getVisibleEmployeeIdsForUser(userId: string): Promise<string[]> {
  const { data: currentProfile, error: currentProfileError } = await supabase
    .from("profiles")
    .select("id, role, department, reports_to")
    .eq("id", userId)
    .maybeSingle();

  if (currentProfileError || !currentProfile) {
    return [userId];
  }

  const currentRole = normalizeRoleName(readString(currentProfile.role) ?? "Worker");
  const currentDepartment = readString(currentProfile.department) ?? "";
  const { data: allProfiles, error } = await employeeProfilesQuery("id, role, department, reports_to");
  if (error) throw error;

    const profiles = ((allProfiles ?? []) as unknown as Array<Record<string, unknown>>).filter((record) => readString(record.id));

  if (currentRole === "Worker") {
    return [userId];
  }

  const visibleIds = new Set<string>([userId]);

  if (currentRole === "Vice Chairman") {
    return profiles.map((record) => readString(record.id) as string).filter(Boolean) as string[];
  }

  if (currentRole === "Vice President") {
    return profiles.map((record) => readString(record.id) as string).filter(Boolean) as string[];
  }

  const collectDescendants = (parentId: string) => {
    profiles.forEach((profile) => {
      const profileId = readString(profile.id);
      const reportsTo = readString(profile.reports_to);
      if (!profileId || !reportsTo) return;
      if (reportsTo === parentId) {
        visibleIds.add(profileId);
        collectDescendants(profileId);
      }
    });
  };

  collectDescendants(userId);

  const filtered = Array.from(visibleIds).filter((id) => {
    const profile = profiles.find((candidate) => readString(candidate.id) === id);
    if (!profile) return false;
    const profileDepartment = readString(profile.department) ?? "";
    if (currentDepartment && profileDepartment && profileDepartment !== currentDepartment) {
      return false;
    }
    if (currentRole === "Supervisor") {
      return normalizeRoleName(readString(profile.role) ?? "Worker") === "Worker";
    }
    return true;
  });

  return filtered;
}

export async function getAttendanceViewEmployees(userId: string): Promise<Employee[]> {
  const visibleIds = await getVisibleEmployeeIdsForUser(userId);
  if (visibleIds.length === 0) {
    return [];
  }

  const { data, error } = await employeeProfilesQuery("*").in("id", visibleIds);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(toEmployee);
}

export async function getOrganizationChart(): Promise<OrganizationNode[]> {
  const { data, error } = await employeeProfilesQuery("*");

  if (error) throw error;

  const employees = ((data ?? []) as Array<Record<string, unknown>>).map(toEmployee);
  const nodes = new Map<string, OrganizationNode>();

  employees.forEach((employee) => {
    nodes.set(employee.id, { ...employee, children: [], managerName: null });
  });

  const roots: OrganizationNode[] = [];

  employees.forEach((employee) => {
    const node = nodes.get(employee.id);

    if (!node) return;

    if (employee.reportsTo && nodes.has(employee.reportsTo)) {
      const manager = nodes.get(employee.reportsTo);
      if (manager) {
        manager.children.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  const sortByRole = (left: OrganizationNode, right: OrganizationNode): number => roleRank(right.role) - roleRank(left.role);
  roots.sort(sortByRole);
  roots.forEach((root) => root.children.sort(sortByRole));

  return roots;
}

async function resolveManagerName(managerId: string): Promise<string | null> {
  const { data, error } = await supabase.from("profiles").select("name").eq("id", managerId).maybeSingle();
  if (error || !data) return null;
  return readString(data.name) ?? null;
}

function normalizeRoleName(value: string): string {
  const roleName = value?.trim();
  if (!roleName) return "Worker";
  if (roleName === "Managing Director") return "Managing Director";
  if (roleName.startsWith("MD-")) return roleName;
  return roleName;
}

function roleRank(value: string): number {
  const roleName = normalizeRoleName(value);
  const rankMap: Record<string, number> = {
    "Vice Chairman": 8,
    "Vice President": 7,
    "Managing Director": 6,
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

  return rankMap[roleName] ?? 1;
}
