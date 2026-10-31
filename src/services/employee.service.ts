import { supabase } from "../lib/supabase";
import { getVisibleProfilesForUser } from "./hierarchy.service";
import { isValidUUID } from "../utils/uuid";
import { normalizeDepartmentName } from "../constants/departments";
import { assignEmployeeDepartment } from "./department.service";
import { assignEmployeeRole } from "./role.service";
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
  Admin: 9,
  "Vice Chairman": 8,
  President: 7,
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

const ROLE_ORDER = [
  "Worker",
  "Supervisor",
  "Manager",
  "Chief Manager",
  "General Manager",
  "Managing Director",
  "MD-Manufacturing",
  "MD-Marketing",
  "MD-Transport",
  "MD-RD",
  "Vice President",
  "President",
  "Vice Chairman",
] as const;

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
  const employeeCode = readString(record.employee_code) ?? "";
  const name = readString(record.name) ?? "Unnamed Employee";
  const email = readString(record.email) ?? "";
  const phone = readString(record.phone) ?? "";
  const department = normalizeDepartmentName(readString(record.department) ?? readString(record.department_name));
  const role = readString(record.role) ?? readString(record.role_name) ?? "Worker";
  const designation = readString(record.designation) ?? "";
  const hierarchyLevel = typeof record.hierarchy_level === "number" && Number.isInteger(record.hierarchy_level)
    ? record.hierarchy_level
    : null;
  const reportsTo = readString(record.reports_to) ?? readString(record.manager_id) ?? null;
  const status = readString(record.status) ?? "Active";
  const joiningDate = readDate(record.joining_date) ?? readDate(record.created_at);
  const createdAt = readDate(record.created_at);
  const photoUrl = readString(record.photo_url) ?? readString(record.avatar_url) ?? null;

  return {
    id,
    employeeId,
    employeeCode,
    name,
    email,
    phone,
    department,
    role,
    designation,
    hierarchyLevel,
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
  employeeCode: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  designation: string;
  hierarchyLevel: number;
  department: string;
  reportsTo: string | null;
  joiningDate: string | null;
}) {
  return {
    id: input.authUserId,
    employee_id: input.employeeId,
    employee_code: input.employeeCode,
    name: input.name,
    email: input.email,
    phone: input.phone,
    role: input.role,
    designation: input.designation,
    hierarchy_level: input.hierarchyLevel,
    department: normalizeDepartmentName(input.department),
    reports_to: input.reportsTo,
    joining_date: input.joiningDate,
    status: "Active",
  };
}

export interface EmployeeInput {
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  reportsTo: string | null;
  joiningDate: string | null;
  employeeCode: string;
  designation: string;
  hierarchyLevel: number;
}

export function validateEmployeeInput(input: Pick<EmployeeInput, "employeeCode" | "designation" | "hierarchyLevel">): void {
  if (!input.employeeCode.trim()) throw new Error("Employee code is required");
  if (input.employeeCode.trim().length > 50) throw new Error("Employee code must be 50 characters or fewer");
  if (!input.designation.trim()) throw new Error("Designation is required");
  if (input.designation.trim().length > 100) throw new Error("Designation must be 100 characters or fewer");
  if (!Number.isInteger(input.hierarchyLevel) || input.hierarchyLevel < 1) {
    throw new Error("Hierarchy level must be a positive whole number");
  }
}

function employeeProfilesQuery(select = "*") {
  return supabase.from("profiles").select(select).not("role", "is", null).neq("role", "Customer") as any;
}

function userVisibleProfilesQuery(select = "*") {
  return employeeProfilesQuery(select);
}

async function getAllEmployeeProfiles(select = "*"): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await employeeProfilesQuery(select);
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).filter((record) => readString(record.id));
}

async function getVisibleEmployeeProfileIds(userId: string): Promise<string[]> {
  if (!isValidUUID(userId)) throw new Error("A valid employee ID is required");
  const { data: currentProfile, error } = await employeeProfilesQuery("*").eq("id", userId).single();
  if (error) throw error;
  const visibleProfiles = await getVisibleProfilesForUser(userId, normalizeRoleName(readString(currentProfile.role) ?? "Worker"), readString(currentProfile.department));
  return visibleProfiles.map((profile) => profile.id);
}

async function getVisibleEmployeeProfilesForUser(userId: string): Promise<Array<Record<string, unknown>>> {
  const visibleIds = await getVisibleEmployeeProfileIds(userId);
  const profiles = await getAllEmployeeProfiles("*");
  return profiles.filter((profile) => {
    const profileId = readString(profile.id);
    return profileId ? visibleIds.includes(profileId) : false;
  });
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
  const visibleProfiles = await getVisibleEmployeeProfilesForUser(userId);
  const { search, department, role, status } = filters;
  const term = search?.trim()?.toLowerCase();

  const filteredProfiles = visibleProfiles.filter((profile) => {
    const employee = toEmployee(profile as Record<string, unknown>);

    if (term) {
      const haystack = [employee.employeeId, employee.name, employee.email, employee.phone, employee.department, employee.role]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }

    if (department && employee.department !== department) return false;
    if (role && employee.role !== role) return false;
    if (status && employee.status !== status) return false;

    return true;
  });

  return filteredProfiles
    .sort((left, right) => {
      const leftCreatedAt = readString((left as Record<string, unknown>).created_at) ?? "";
      const rightCreatedAt = readString((right as Record<string, unknown>).created_at) ?? "";
      return rightCreatedAt.localeCompare(leftCreatedAt);
    })
    .map((profile) => toEmployee(profile as Record<string, unknown>));
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

export async function getReportingChain(employeeId: string): Promise<Employee[]> {
  const chain: Employee[] = [];
  const visited = new Set<string>();
  let currentId: string | null = employeeId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const { data, error } = await employeeProfilesQuery("*").eq("id", currentId).maybeSingle();
    if (error) throw error;
    if (!data) break;

    const employee = toEmployee(data as Record<string, unknown>);
    chain.push(employee);
    currentId = employee.reportsTo;
  }

  return chain;
}

export async function createEmployee(actorId: string, input: EmployeeInput): Promise<Employee> {
  validateEmployeeInput(input);
  await authorizeEmployeeAction(actorId, null, "create", input.role, input.reportsTo, input.department);

  const normalizedEmail = input.email.trim().toLowerCase();
  const employeeId = `EMP-${Date.now()}`;
  const tempPassword = buildTemporaryPassword(normalizedEmail);

  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/reset-password` : "/reset-password";
  const { data: authData, error: authError } = await (supabase.auth as any).signUp({
    email: normalizedEmail,
    password: tempPassword,
  }, {
    redirectTo,
  });

  if (authError || !authData?.user?.id) {
    throw new Error(authError?.message ?? "Failed to create auth user for employee");
  }

  const authUserId = authData.user.id;
  console.log("Auth User ID", authUserId);

  const payload = buildEmployeeProfilePayload({
    authUserId,
    employeeId,
    employeeCode: input.employeeCode.trim(),
    name: input.name.trim(),
    email: normalizedEmail,
    phone: input.phone.trim(),
    role: input.role,
    designation: input.designation.trim(),
    hierarchyLevel: input.hierarchyLevel,
    department: input.department,
    reportsTo: input.reportsTo,
    joiningDate: input.joiningDate,
  });

  console.log("Creating Profile", JSON.stringify(payload, null, 2));
  const insertResult = await supabase.from("profiles").insert([payload]).select("*").single();
  let profileData = insertResult.data;
  let profileError = insertResult.error;

  if (profileError) {
    console.error("Profile creation failed, attempting upsert", profileError);
    const upsertResult = await supabase.from("profiles").upsert([payload], { onConflict: "id" }).select("*").single();
    profileData = upsertResult.data;
    profileError = upsertResult.error;
  }

  if (profileError || !profileData) {
    console.error("Profile creation failed", profileError);
    await cleanupCreatedAuthUser(authUserId);
    throw profileError ?? new Error("Failed to create employee profile");
  }

  return toEmployee(profileData as Record<string, unknown>);
}

type EmployeeUpdate = Partial<Employee> & Partial<Pick<EmployeeInput, "employeeCode" | "designation" | "hierarchyLevel">> & { address?: string | null };

export async function updateEmployee(actorId: string, employeeId: string, updates: EmployeeUpdate): Promise<Employee> {
  if (!isValidUUID(actorId) || !isValidUUID(employeeId)) throw new Error("Valid employee IDs are required");
  if (updates.employeeCode !== undefined || updates.designation !== undefined || updates.hierarchyLevel !== undefined) {
    validateEmployeeInput({
      employeeCode: updates.employeeCode ?? "existing",
      designation: updates.designation ?? "existing",
      hierarchyLevel: updates.hierarchyLevel ?? 1,
    });
  }
  await authorizeEmployeeAction(actorId, employeeId, "update", updates.role, updates.reportsTo, updates.department, updates);
  if (updates.role !== undefined) {
    await assignEmployeeRole(employeeId, updates.role, actorId);
  }
  if (updates.department !== undefined) {
    await assignEmployeeDepartment(employeeId, updates.department, actorId);
  }
  const payload = {
    name: updates.name,
    email: updates.email,
    phone: updates.phone,
    address: updates.address,
    role: updates.role,
    employee_code: updates.employeeCode,
    designation: updates.designation,
    hierarchy_level: updates.hierarchyLevel,
    department: updates.department,
    reports_to: updates.reportsTo,
    status: updates.status,
    joining_date: updates.joiningDate,
  };

  const { data, error } = await supabase.from("profiles").update(payload).eq("id", employeeId).select("*").single();

  if (error) throw error;
  const auditValues = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
  if (Object.keys(auditValues).length > 0) {
    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_id: actorId,
      action: "employee_updated",
      entity_type: "profile",
      entity_id: employeeId,
      new_values: auditValues,
    });
    if (auditError) throw auditError;
  }
  return toEmployee(data as Record<string, unknown>);
}

export async function suspendEmployee(actorId: string, employeeId: string): Promise<void> {
  if (!isValidUUID(actorId) || !isValidUUID(employeeId)) throw new Error("Valid employee IDs are required");
  await authorizeEmployeeAction(actorId, employeeId, "suspend");

  const { error } = await supabase.from("profiles").update({ status: "Suspended" }).eq("id", employeeId);
  if (error) throw error;
}

export async function reactivateEmployee(actorId: string, employeeId: string): Promise<void> {
  if (!isValidUUID(actorId) || !isValidUUID(employeeId)) throw new Error("Valid employee IDs are required");
  await authorizeEmployeeAction(actorId, employeeId, "activate");

  const { error } = await supabase.from("profiles").update({ status: "Active" }).eq("id", employeeId);
  if (error) throw error;
}

export async function activateEmployee(actorId: string, employeeId: string): Promise<void> {
  await reactivateEmployee(actorId, employeeId);
}

export async function deleteEmployee(actorId: string, employeeId: string): Promise<void> {
  if (!isValidUUID(actorId) || !isValidUUID(employeeId)) throw new Error("Valid employee IDs are required");
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
  updates?: EmployeeUpdate,
): Promise<void> {
  const { data: actor, error: actorError } = await supabase
    .from("profiles")
    .select("id, role, department")
    .eq("id", actorId)
    .maybeSingle();
  if (actorError) throw actorError;
  if (!actor) throw new Error("Actor profile not found");

  const actorRole = normalizeRoleName(readString(actor.role) ?? "Worker");
  if (action === "update" && targetId === actorId) {
    const disallowedFields = Object.entries(updates ?? {})
      .filter(([, value]) => value !== undefined)
      .map(([field]) => field)
      .filter((field) => !["phone", "email", "address"].includes(field));
    if (disallowedFields.length > 0) {
      throw new Error("Employees may update only their phone, email, and address");
    }
    return;
  }
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
    throw new Error("You can only manage employees in your hierarchy");
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

  let profileQuery = supabase.from("profiles").select("id, name, employee_id, department, role").not("role", "is", null).neq("role", "Customer");
  if (options.employeeId) profileQuery = profileQuery.eq("id", options.employeeId);
  if (options.employeeIds && options.employeeIds.length > 0) profileQuery = profileQuery.in("id", options.employeeIds);
  const { data: employeeProfiles, error: profileError } = await profileQuery;
  if (profileError) throw profileError;

  let attendanceQuery = supabase
    .from("attendance")
    .select("id, employee_id, status, attendance_date")
    .gte("attendance_date", dateRange.start)
    .lte("attendance_date", dateRange.end);
  if (options.employeeId) attendanceQuery = attendanceQuery.eq("employee_id", options.employeeId);
  if (options.employeeIds && options.employeeIds.length > 0) attendanceQuery = attendanceQuery.in("employee_id", options.employeeIds);
  const { data, error } = await attendanceQuery;
  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const records = [] as Array<{ employeeId: string; employeeName: string; status: string; date: string }>;
  const attendanceByEmployee = new Map(rows.map((row) => [readString(row.employee_id), row]));
  for (const profile of employeeProfiles ?? []) {
    const employeeId = readString(profile.id);
    if (!employeeId) continue;
    const row = attendanceByEmployee.get(employeeId);
    const status = readString(row?.status) ?? "Not Marked";
    if (options.status && status !== options.status) continue;
    records.push({ employeeId, employeeName: readString(profile.name) ?? "Unnamed Employee", status, date: readString(row?.attendance_date) ?? date });
  }

  const present = records.filter((row) => row.status === "Present").length;
  const absent = records.filter((row) => row.status === "Absent").length;
  const halfDay = records.filter((row) => row.status === "Half Day").length;
  const leave = records.filter((row) => row.status === "Leave").length;

  return {
    date,
    totalEmployees: employeeProfiles?.length ?? 0,
    present,
    absent,
    halfDay,
    leave,
    attendancePercentage: records.length > 0 ? Math.round((present / records.length) * 100) : 0,
    records,
  };
}

export interface EmployeeAttendanceHistoryRow {
  id: string;
  attendance_date: string;
  check_in: string | null;
  check_out: string | null;
  status: string | null;
}

export async function getEmployeeAttendanceHistory(employeeId: string): Promise<EmployeeAttendanceHistoryRow[]> {
  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("employee_id", employeeId)
    .order("attendance_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EmployeeAttendanceHistoryRow[];
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
  for (const entry of entries) {
    const { data: existing, error: lookupError } = await supabase
      .from("attendance")
      .select("id")
      .eq("employee_id", entry.employeeId)
      .eq("attendance_date", entry.date)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (existing?.id) {
      const { error } = await supabase.from("attendance").update({ status: entry.status }).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("attendance").insert({ employee_id: entry.employeeId, attendance_date: entry.date, status: entry.status, check_in: null, check_out: null });
      if (error) throw error;
    }
  }
}

export async function getSubordinateEmployeeIds(userId: string): Promise<string[]> {
  const visibleIds = await getVisibleEmployeeProfileIds(userId);
  return visibleIds.filter((id) => id !== userId);
}

export async function getVisibleEmployeeIdsForUser(userId: string): Promise<string[]> {
  return getVisibleEmployeeProfileIds(userId);
}

export async function getAttendanceViewEmployees(userId: string): Promise<Employee[]> {
  const visibleProfiles = await getVisibleEmployeeProfilesForUser(userId);
  return visibleProfiles.map((profile) => toEmployee(profile as Record<string, unknown>));
}

export async function getOrganizationChart(userId?: string): Promise<OrganizationNode[]> {
  const profiles = userId ? await getVisibleEmployeeProfilesForUser(userId) : await getAllEmployeeProfiles("*");
  const employees = profiles.map((profile) => toEmployee(profile as Record<string, unknown>));
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
  if (!isValidUUID(managerId)) return null;
  const { data, error } = await supabase.from("profiles").select("name").eq("id", managerId).maybeSingle();
  if (error || !data) return null;
  return readString(data.name) ?? null;
}

export function getAllowedEmployeeRoles(actorRole?: string | null): string[] {
  const normalizedActorRole = normalizeRoleName(actorRole ?? "Worker");
  if (normalizedActorRole === "Vice Chairman") {
    return [...ROLE_ORDER];
  }

  if (normalizedActorRole === "Vice President") {
    return ROLE_ORDER.filter((role) => role !== "Vice Chairman" && role !== "Vice President");
  }

  const actorLevel = ROLE_LEVEL[normalizedActorRole] ?? 1;
  return ROLE_ORDER.filter((role) => {
    const targetLevel = ROLE_LEVEL[role] ?? 1;
    return targetLevel < actorLevel && role !== "Vice Chairman" && role !== "Vice President";
  });
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
