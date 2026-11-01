import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_EMAIL = "admin@company.com";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Server Supabase environment is incomplete" }, 500);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerData.user || callerData.user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return json({ error: "Only admin@company.com may run this cleanup" }, 403);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: adminProfile, error: adminProfileError } = await admin
    .from("profiles").select("id, role").eq("id", callerData.user.id).single();
  if (adminProfileError || adminProfile?.role !== "Vice Chairman") {
    return json({ error: "Administrator profile verification failed" }, 403);
  }

  try {
    const { data: authUsers, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;
    const keepUser = authUsers.users.find((user) => user.email?.toLowerCase() === ADMIN_EMAIL);
    if (!keepUser || keepUser.id !== callerData.user.id) throw new Error("The protected administrator account could not be verified");

    const requestBody = await req.json().catch(() => ({}));
    const requestedEmployeeId = typeof requestBody.employeeId === "string" ? requestBody.employeeId.trim() : "";
    if (!requestedEmployeeId) return json({ error: "employeeId is required" }, 400);
    if (requestedEmployeeId === keepUser.id) return json({ error: "The administrator account is protected" }, 403);
    const targetUser = authUsers.users.find((user) => user.id === requestedEmployeeId);
    if (!targetUser) return json({ error: "Employee Auth account not found" }, 404);
    const employeeIds = [requestedEmployeeId];

    const must = async (label: string, result: { error: { message: string } | null }) => {
      if (result.error) throw new Error(label + ": " + result.error.message);
    };
    const del = async (table: string, column: string) => {
      const result = await admin.from(table).delete().in(column, employeeIds);
      await must(table + "." + column, result);
    };
    const clear = async (table: string, column: string) => {
      const result = await admin.from(table).update({ [column]: null }).in(column, employeeIds);
      await must(table + "." + column, result);
    };

    // Remove rows that are employee-owned or cannot exist without the employee.
    await del("attendance", "employee_id");
    await del("audit_logs", "user_id");
    await clear("bill_history", "performed_by");

    // Preserve bills, but remove references to accounts that are being removed.
    for (const column of ["employee_id", "submitted_by", "approved_by", "created_by"]) {
      await clear("bills", column);
    }

    // Clear non-FK user attribution columns too, while retaining the business records.
    await clear("customers", "auth_user_id");
    await clear("collaboration_applications", "submitted_by_id");
    await clear("orders", "created_by");

    await clear("deliveries", "assigned_by");
    await clear("delivery_tracking", "updated_by");
    await del("employee_department_history", "employee_id");
    await del("employee_department_history", "changed_by");
    await del("employee_hierarchy", "employee_id");
    await del("employee_hierarchy", "supervisor_id");
    await del("employee_kpis", "employee_id");
    await del("leave_balance_transactions", "employee_id");
    await del("leave_balance_transactions", "performed_by");
    await del("leave_balances", "employee_id");

    const { data: leaveRequests, error: leaveLookupError } = await admin
      .from("leave_requests").select("id").in("employee_id", employeeIds);
    if (leaveLookupError) throw leaveLookupError;
    const leaveRequestIds = (leaveRequests ?? []).map((row) => row.id);
    if (leaveRequestIds.length) {
      await must("leave_approval_history", await admin.from("leave_approval_history").delete().in("leave_request_id", leaveRequestIds));
      await must("leave_balance_transactions.leave_request_id", await admin.from("leave_balance_transactions").delete().in("leave_request_id", leaveRequestIds));
      await must("leave_requests", await admin.from("leave_requests").delete().in("id", leaveRequestIds));
    }

    await clear("manufacturing_batches", "assigned_supervisor");
    await del("manufacturing_batches", "created_by");
    await del("manufacturing_defects", "worker_id");
    await del("manufacturing_defects", "reviewed_by");
    await del("manufacturing_outputs", "worker_id");
    await del("manufacturing_working_hours", "worker_id");
    await del("manufacturing_targets", "manager_id");

    await del("marketing_activity_logs", "employee_id");
    await del("marketing_campaigns", "manager_id");
    await del("marketing_conversions", "converted_by");
    await del("marketing_leads", "assigned_to");
    await del("marketing_targets", "manager_id");

    const { data: employeeNotifications, error: notificationLookupError } = await admin
      .from("notifications").select("id").in("user_id", employeeIds);
    if (notificationLookupError) throw notificationLookupError;
    const notificationIds = (employeeNotifications ?? []).map((row) => row.id);
    if (notificationIds.length) {
      await must("notifications.parent_notification_id", await admin.from("notifications").update({ parent_notification_id: null }).in("parent_notification_id", notificationIds));
    }
    await must("notifications.user_id", await admin.from("notifications").delete().in("user_id", employeeIds));
    await clear("notifications", "forwarded_from");
    await clear("notifications", "forwarded_to");
    await del("payment_status_history", "performed_by");
    await del("programs", "created_by");
    await del("reports", "created_by");
    await del("research_experiments", "owner_id");
    await del("research_logs", "employee_id");
    await del("research_projects", "manager_id");
    await del("research_samples", "collected_by");
    await del("research_targets", "manager_id");
    await del("tasks", "assigned_by");
    await del("tasks", "assigned_to");
    await del("transport_targets", "manager_id");
    await del("transport_trips", "driver_id");

    // Break the self-referencing reporting links before auth.admin.deleteUser()
    // cascades each employee's profiles row.
    await must("profiles.reports_to", await admin.from("profiles").update({ reports_to: null }).in("reports_to", employeeIds));
    await must("profiles.manager_id", await admin.from("profiles").update({ manager_id: null }).in("manager_id", employeeIds));

    // Storage's system schema is not exposed through this project's PostgREST API.
    // Leave Storage objects untouched rather than querying storage.objects via REST.
    // Auth deletion below is still performed through the supported Auth Admin API.
    await del("leave_approval_history", "approver_id");

    let deletedAccounts = 0;
    for (const userId of employeeIds) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new Error("Auth account deletion failed for " + userId + ": " + error.message);
      deletedAccounts += 1;
    }

    const { data: remainingUsers, error: verifyError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (verifyError) throw verifyError;
    const adminStillExists = remainingUsers.users.some((user) => user.id === keepUser.id && user.email?.toLowerCase() === ADMIN_EMAIL);
    const targetStillExists = remainingUsers.users.some((user) => user.id === requestedEmployeeId);
    if (!adminStillExists || targetStillExists) {
      throw new Error("Post-deletion verification failed: administrator protection or target deletion check failed");
    }

    return json({
      success: true,
      preservedAccount: ADMIN_EMAIL,
      deletedAccounts,
      deletedEmployeeId: requestedEmployeeId,
      message: "The selected employee Auth account and linked employee data were removed. The administrator account was preserved.",
    });
  } catch (error) {
    console.error("Employee account cleanup failed", error);
    return json({ error: error instanceof Error ? error.message : "Cleanup failed" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
