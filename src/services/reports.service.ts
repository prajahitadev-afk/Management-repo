import { supabase } from "../lib/supabase";
import { normalizeDepartmentName } from "../constants/departments";

export type ReportType = "Attendance" | "Bills" | "Marketing" | "Transport" | "Community Impact";
export type ReportExportFormat = "csv" | "excel" | "pdf";

export interface ReportMetric {
  label: string;
  value: string;
  detail: string;
}

export interface ReportChartPoint {
  label: string;
  value: number;
  secondaryValue?: number;
}

export interface ReportTableRow {
  label: string;
  value: string;
  detail?: string;
}

export interface GeneratedReport {
  type: ReportType;
  title: string;
  subtitle: string;
  metrics: ReportMetric[];
  chartData: ReportChartPoint[];
  tableRows: ReportTableRow[];
  chartKind: "bar" | "line" | "pie";
}

interface ReportQueryOptions {
  fromDate?: string | null;
  toDate?: string | null;
  department?: string | null;
}

function resolveDateRange(fromDate?: string | null, toDate?: string | null) {
  const end = toDate && toDate.trim() ? new Date(`${toDate}T23:59:59`) : new Date();
  const start = fromDate && fromDate.trim() ? new Date(`${fromDate}T00:00:00`) : new Date(end);

  if (!fromDate || !fromDate.trim()) {
    start.setDate(end.getDate() - 30);
  }

  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

function toMonthLabel(dateValue: string) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-US", { month: "short" });
}

function formatCurrency(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function buildMetric(label: string, value: string, detail: string): ReportMetric {
  return { label, value, detail };
}

export async function generateReport(type: ReportType, options: ReportQueryOptions = {}): Promise<GeneratedReport> {
  const { from, to } = resolveDateRange(options.fromDate, options.toDate);
  const departmentFilter = options.department && options.department !== "All Departments" ? options.department : undefined;

  if (type === "Attendance") {
    const { data: attendanceRows, error: attendanceError } = await supabase
      .from("attendance")
      .select("employee_id, status, attendance_date")
      .gte("attendance_date", from)
      .lte("attendance_date", to);

    if (attendanceError) throw attendanceError;

    const employeeIds = Array.from(new Set((attendanceRows || []).map((row) => row.employee_id).filter(Boolean))) as string[];
    const { data: profiles, error: profilesError } = employeeIds.length > 0
      ? await supabase.from("profiles").select("id, department").in("id", employeeIds).not("role", "is", null).neq("role", "Customer")
      : { data: [], error: null };

    if (profilesError) throw profilesError;

    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile.department]));
    const filteredAttendance = (attendanceRows || []).filter((row) => {
      if (!departmentFilter) return true;
      return normalizeDepartmentName(profileMap.get(row.employee_id) as string | undefined) === normalizeDepartmentName(departmentFilter);
    });

    const present = filteredAttendance.filter((row) => row.status === "Present").length;
    const absent = filteredAttendance.filter((row) => row.status === "Absent").length;
    const leave = filteredAttendance.filter((row) => row.status === "Leave").length;
    const halfDay = filteredAttendance.filter((row) => row.status === "Half Day").length;

    const departmentCounts = new Map<string, { present: number; absent: number; total: number }>();
    filteredAttendance.forEach((row) => {
      const department = (profileMap.get(row.employee_id) as string | undefined) ?? "Unassigned";
      const bucket = departmentCounts.get(department) ?? { present: 0, absent: 0, total: 0 };
      if (row.status === "Present") bucket.present += 1;
      if (row.status === "Absent") bucket.absent += 1;
      bucket.total += 1;
      departmentCounts.set(department, bucket);
    });

    const trendMap = new Map<string, { present: number; absent: number }>();
    filteredAttendance.forEach((row) => {
      const dayKey = row.attendance_date ?? from;
      const bucket = trendMap.get(dayKey) ?? { present: 0, absent: 0 };
      if (row.status === "Present") bucket.present += 1;
      if (row.status === "Absent") bucket.absent += 1;
      trendMap.set(dayKey, bucket);
    });

    return {
      type,
      title: "Attendance Report",
      subtitle: `${from} → ${to}`,
      metrics: [
        buildMetric("Present Count", String(present), "Marked present"),
        buildMetric("Absent Count", String(absent), "Marked absent"),
        buildMetric("Leave Count", String(leave), "Leave entries"),
        buildMetric("Half Day Count", String(halfDay), "Half-day entries"),
      ],
      chartData: Array.from(departmentCounts.entries()).map(([label, values]) => ({ label, value: values.present, secondaryValue: values.absent })),
      tableRows: Array.from(trendMap.entries()).map(([label, values]) => ({ label, value: `${values.present} present`, detail: `${values.absent} absent` })),
      chartKind: "bar",
    };
  }

  if (type === "Bills") {
    const { data: billsRows, error: billsError } = await supabase
      .from("bills")
      .select("id, status, department, amount, gst, created_at")
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`);

    if (billsError) throw billsError;

    const { data: billHistoryRows, error: historyError } = await supabase
      .from("bill_history")
      .select("id, action, created_at")
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`);

    if (historyError) throw historyError;

    const filteredBills = (billsRows || []).filter((row) => !departmentFilter || normalizeDepartmentName(row.department) === normalizeDepartmentName(departmentFilter));
    const submitted = filteredBills.filter((row) => row.status === "Pending Approval").length;
    const approved = filteredBills.filter((row) => row.status === "Approved" || row.status === "Reviewed").length;
    const rejected = filteredBills.filter((row) => row.status === "Rejected" || row.status === "Returned for Correction").length;
    const paid = filteredBills.filter((row) => row.status === "Approved").length;

    const spendByDepartment = new Map<string, number>();
    filteredBills.forEach((row) => {
      const current = spendByDepartment.get(row.department ?? "Unassigned") ?? 0;
      spendByDepartment.set(row.department ?? "Unassigned", current + Number(row.amount ?? 0) + Number(row.gst ?? 0));
    });

    const monthlyTrend = new Map<string, number>();
    filteredBills.forEach((row) => {
      const monthLabel = toMonthLabel(row.created_at ?? from);
      const current = monthlyTrend.get(monthLabel) ?? 0;
      monthlyTrend.set(monthLabel, current + Number(row.amount ?? 0));
    });

    return {
      type,
      title: "Bills Report",
      subtitle: `${from} → ${to}`,
      metrics: [
        buildMetric("Submitted Bills", String(submitted), "Bills submitted within range"),
        buildMetric("Approved Bills", String(approved), "Bills approved or passed"),
        buildMetric("Rejected Bills", String(rejected), "Bills rejected or returned"),
        buildMetric("Paid Bills", String(paid), "Bills fully paid"),
      ],
      chartData: Array.from(spendByDepartment.entries()).map(([label, value]) => ({ label, value })),
      tableRows: [
        { label: "History Entries", value: String((billHistoryRows || []).length), detail: "Audit trail records" },
        ...Array.from(monthlyTrend.entries()).map(([label, value]) => ({ label, value: formatCurrency(value), detail: "Monthly bill spend" })),
      ],
      chartKind: "bar",
    };
  }

  if (type === "Marketing") {
    const { data: ordersRows, error: ordersError } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        order_date,
        total_amount,
        customer_id,
        created_at,
        customers (first_name, last_name),
        order_items (quantity, unit_price, products (name))
      `)
      .gte("order_date", from)
      .lte("order_date", to);

    if (ordersError) throw ordersError;

    const filteredOrders = (ordersRows || []).filter((row) => !departmentFilter || row.customer_id === departmentFilter);
    const totalOrders = filteredOrders.length;
    const revenue = filteredOrders.reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
    const uniqueCustomers = new Set(filteredOrders.map((row) => row.customer_id).filter(Boolean)).size;

    const productMap = new Map<string, number>();
    filteredOrders.forEach((row) => {
      const items = row.order_items ?? [];
      items.forEach((item) => {
        const productName = item.products?.[0]?.name ?? "Unknown";
        const current = productMap.get(productName) ?? 0;
        productMap.set(productName, current + Number(item.unit_price ?? 0) * Number(item.quantity ?? 0));
      });
    });

    const statusMap = new Map<string, number>();
    filteredOrders.forEach((row) => {
      const current = statusMap.get(row.status ?? "Pending") ?? 0;
      statusMap.set(row.status ?? "Pending", current + 1);
    });

    const revenueTrend = new Map<string, number>();
    filteredOrders.forEach((row) => {
      const monthLabel = toMonthLabel(row.order_date ?? row.created_at ?? from);
      const current = revenueTrend.get(monthLabel) ?? 0;
      revenueTrend.set(monthLabel, current + Number(row.total_amount ?? 0));
    });

    return {
      type,
      title: "Marketing Report",
      subtitle: `${from} → ${to}`,
      metrics: [
        buildMetric("Total Orders", String(totalOrders), "Orders placed in range"),
        buildMetric("Revenue", formatCurrency(revenue), "Sales revenue"),
        buildMetric("Customer Growth", String(uniqueCustomers), "Distinct customers"),
        buildMetric("Product Performance", String(productMap.size), "Product lines tracked"),
      ],
      chartData: Array.from(statusMap.entries()).map(([label, value]) => ({ label, value })),
      tableRows: [
        { label: "Order Status Breakdown", value: String(statusMap.size), detail: "Statuses captured" },
        ...Array.from(revenueTrend.entries()).map(([label, value]) => ({ label, value: formatCurrency(value), detail: "Monthly sales" })),
      ],
      chartKind: "bar",
    };
  }

  if (type === "Transport") {
    const { data: deliveriesRows, error: deliveriesError } = await supabase
      .from("deliveries")
      .select(`
        id,
        status,
        dispatch_date,
        delivery_date,
        vehicle_id,
        vehicles (vehicle_number),
        delivery_assignments (driver_id, drivers (name))
      `)
      .gte("dispatch_date", from)
      .lte("dispatch_date", to);

    if (deliveriesError) throw deliveriesError;

    const filteredDeliveries = (deliveriesRows || []) as Array<{
      id: string;
      status: string | null;
      dispatch_date: string | null;
      delivery_date: string | null;
      vehicle_id: string | null;
      vehicles: Array<{ vehicle_number: string | null }> | null;
      delivery_assignments: Array<{ driver_id: string | null; drivers: Array<{ name: string | null }> | null }> | null;
    }>;

    const delivered = filteredDeliveries.filter((row) => row.status === "Delivered").length;
    const delayed = filteredDeliveries.filter((row) => row.status === "Delayed").length;
    const inTransit = filteredDeliveries.filter((row) => row.status === "In Transit").length;

    const vehicleMap = new Map<string, number>();
    filteredDeliveries.forEach((row) => {
      const vehicleLabel = row.vehicles?.[0]?.vehicle_number ?? "Unassigned";
      const current = vehicleMap.get(vehicleLabel) ?? 0;
      vehicleMap.set(vehicleLabel, current + 1);
    });

    const driverMap = new Map<string, number>();
    filteredDeliveries.forEach((row) => {
      const assignment = row.delivery_assignments?.[0];
      const driverLabel = assignment?.drivers?.[0]?.name ?? "Unassigned";
      const current = driverMap.get(driverLabel) ?? 0;
      driverMap.set(driverLabel, current + 1);
    });

    return {
      type,
      title: "Transport Report",
      subtitle: `${from} → ${to}`,
      metrics: [
        buildMetric("Delivered Shipments", String(delivered), "Completed deliveries"),
        buildMetric("Delayed Shipments", String(delayed), "Late deliveries"),
        buildMetric("In Transit Shipments", String(inTransit), "Active shipments"),
        buildMetric("Vehicle Utilization", `${vehicleMap.size} vehicles`, "Unique vehicles assigned"),
      ],
      chartData: Array.from(driverMap.entries()).map(([label, value]) => ({ label, value })),
      tableRows: [
        { label: "Driver Workload", value: String(driverMap.size), detail: "Drivers assigned" },
        ...Array.from(vehicleMap.entries()).map(([label, value]) => ({ label, value: String(value), detail: "Assignments" })),
      ],
      chartKind: "bar",
    };
  }

  const { data: programsRows, error: programsError } = await supabase.from("programs").select("id, name").order("name", { ascending: true });
  if (programsError) throw programsError;

  const { data: impactRows, error: impactError } = await supabase
    .from("program_impact")
    .select("program_id, beneficiaries, volunteers, communities_reached, recorded_at")
    .gte("recorded_at", `${from}T00:00:00`)
    .lte("recorded_at", `${to}T23:59:59`);

  if (impactError) throw impactError;

  const totalPrograms = programsRows?.length ?? 0;
  const totalBeneficiaries = (impactRows || []).reduce((sum, row) => sum + Number(row.beneficiaries ?? 0), 0);
  const totalVolunteers = (impactRows || []).reduce((sum, row) => sum + Number(row.volunteers ?? 0), 0);
  const totalCommunities = (impactRows || []).reduce((sum, row) => sum + Number(row.communities_reached ?? 0), 0);
  const growth = (impactRows || []).length > 0 ? Math.round(totalBeneficiaries / Math.max((impactRows || []).length, 1)) : 0;

  const trendMap = new Map<string, number>();
  (impactRows || []).forEach((row) => {
    const monthLabel = toMonthLabel(row.recorded_at ?? from);
    const current = trendMap.get(monthLabel) ?? 0;
    trendMap.set(monthLabel, current + Number(row.beneficiaries ?? 0));
  });

  return {
    type: "Community Impact",
    title: "Community Impact Report",
    subtitle: `${from} → ${to}`,
    metrics: [
      buildMetric("Program Statistics", String(totalPrograms), "Programs available"),
      buildMetric("Beneficiary Counts", String(totalBeneficiaries), "People served"),
      buildMetric("Impact Growth", `${growth} avg`, "Beneficiaries per entry"),
      buildMetric("Program Effectiveness", `${totalVolunteers} volunteers`, "Volunteer participation"),
    ],
    chartData: Array.from(trendMap.entries()).map(([label, value]) => ({ label, value })),
    tableRows: [
      { label: "Communities Reached", value: String(totalCommunities), detail: "Impact footprint" },
      { label: "Programs Listed", value: String(totalPrograms), detail: "Recorded programs" },
    ],
    chartKind: "line",
  };
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportReportToCSV(report: GeneratedReport) {
  const csvRows = [
    ["Label", "Value", "Detail"],
    ...report.tableRows.map((row) => [row.label, row.value, row.detail ?? ""]),
  ];
  const csvContent = csvRows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
  downloadFile(`${report.type.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.csv`, csvContent, "text/csv;charset=utf-8;");
}

export async function exportReportToExcel(report: GeneratedReport) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const reportRows = report.tableRows.map((row) => ({ Label: row.label, Value: row.value, Detail: row.detail ?? "" }));
  const chartRows = report.chartData.map((item) => ({ Label: item.label, Value: item.value, Secondary: item.secondaryValue ?? "" }));
  const kpiRows = report.metrics.map((metric) => ({ KPI: metric.label, Value: metric.value, Detail: metric.detail }));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(reportRows), "Report Data");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
    { Field: "Report Type", Value: report.type },
    { Field: "Date Range", Value: report.subtitle },
    ...kpiRows.map((row) => ({ Field: row.KPI, Value: row.Value })),
  ]), "KPIs");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(chartRows), "Chart Data");
  XLSX.writeFile(workbook, `${report.type.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.xlsx`);
}

export function exportReportToPDF(report: GeneratedReport) {
  const safe = (value: string) => value.replace(/[^\x20-\x7E]/g, "?").replace(/[()\\]/g, "");
  const commands: string[] = [];
  const text = (value: string, x: number, y: number, size = 11) => {
    commands.push(`BT /F1 ${size} Tf ${x} ${y} Td (${safe(value)}) Tj ET`);
  };
  text(report.title, 40, 1160, 18);
  text(report.subtitle, 40, 1138, 10);
  let y = 1108;
  report.metrics.forEach((metric) => {
    text(`${metric.label}: ${metric.value} (${metric.detail})`, 40, y);
    y -= 18;
  });
  text("Charts", 40, y - 8, 13);
  y -= 35;
  const maxChartValue = Math.max(...report.chartData.map((item) => item.value), 1);
  report.chartData.slice(0, 18).forEach((item) => {
    const barWidth = Math.max(2, Math.round((item.value / maxChartValue) * 260));
    commands.push(`0.30 0.50 0.31 rg 40 ${y - 3} ${barWidth} 10 re f`);
    text(`${item.label}: ${item.value}${item.secondaryValue != null ? ` / ${item.secondaryValue}` : ""}`, 310, y);
    y -= 18;
  });
  text("Data Table", 40, y - 8, 13);
  y -= 30;
  report.tableRows.slice(0, 28).forEach((row) => {
    text(`${row.label}: ${row.value}${row.detail ? ` (${row.detail})` : ""}`, 40, y, 9);
    y -= 14;
  });

  const stream = `${commands.join("\n")}\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 1200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let content = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(content.length);
    content += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = content.length;
  content += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { content += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  content += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  downloadFile(`${report.type.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.pdf`, content, "application/pdf");
}

export async function getCommunityImpact() {
  const { data, error } = await supabase
    .from("program_impact")
    .select("id, program_id, beneficiaries, volunteers, communities_reached, recorded_at")
    .order("recorded_at", { ascending: true });

  if (error) throw error;

  return data;
}