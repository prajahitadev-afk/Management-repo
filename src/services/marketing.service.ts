import { supabase } from "../lib/supabase";
import { inDashboardScope, resolveDashboardScope } from "./dashboard-scope.service";
import { normalizeOrderStatus, ORDER_STATUS } from "./order-statuses";
import { getSubordinates } from "./hierarchy.service";

// ──── TYPES ────────────────────────────────────────────────────────────────

export interface MarketingOrder {
  id: string;
  ref: string;
  customer: string;
  location: string;
  soap: string;
  qty: number;
  value: number;
  date: string;
  delivery: string;
  status: string;
}

export interface MarketingCustomer {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  state: string;
  status: string;
  location: string;
  orders: number;
  value: string;
  since: string;
}

export interface RevenuePoint {
  month: string;
  revenue: number;
}

export interface DepartmentPerformance {
  name: string;
  pct: number;
  val: string;
  unitsSold: number;
  revenue: number;
  ordersCount: number;
  color?: string;
}

export interface DashboardMetrics {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  dispatchedOrders: number;
  monthlySales: number;
  totalRevenue: number;
}

interface DashboardOrderRow { status: string | null; total_amount: number | string | null; created_at: string | null; }
interface DeliveryRow { status: string | null; }
interface MarketingOrderRow {
  id: string;
  order_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  total_amount: number | string | null;
  order_date: string | null;
  expected_delivery: string | null;
  status: string | null;
  payment_status: string | null;
  payment_method: string | null;
  item_count: number | null;
  created_at: string | null;
}
interface CustomerRow { id: string; name: string | null; customer_code: string | null; email: string | null; phone: string | null; city: string | null; state: string | null; status: string | null; created_at: string | null; }
interface OrderTotalRow { customer_id: string | null; total_amount: number | string | null; }
interface RevenueOrderRow { order_date: string | null; total_amount: number | string | null; }
interface OrderItemRow { id: string; order_id: string; product_id: string | null; product_name: string | null; quantity: number | null; price: number | string | null; unit_price: number | string | null; total_price: number | string | null; created_at: string | null; }
type ProductOrderItemRow = OrderItemRow;

// ──── HELPERS ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(amount: number): string {
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }
  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(0)}K`;
  }
  return `₹${amount}`;
}

function getMonthName(monthIndex: number): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[monthIndex];
}

// ──── DASHBOARD METRICS ────────────────────────────────────────────────────

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  try {
    const { data: allOrders, error: ordersError } = await supabase
      .from("orders")
      .select("id, status, total_amount, created_at");

    if (ordersError) throw ordersError;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const orders = (allOrders || []) as DashboardOrderRow[];
    const totalOrders = orders.length;
    const pendingOrders = orders.filter((o) => normalizeOrderStatus(o.status) === ORDER_STATUS.Pending).length;
    const completedOrders = orders.filter((o) => normalizeOrderStatus(o.status) === ORDER_STATUS.Delivered).length;
    const cancelledOrders = orders.filter((o) => normalizeOrderStatus(o.status) === ORDER_STATUS.Rejected).length;
    const dispatchedOrders = orders.filter((o) => normalizeOrderStatus(o.status) === ORDER_STATUS.Dispatched).length;

    const monthlySales = orders
      .filter((o) => {
        if (!o.created_at) return false;
        const orderDate = new Date(o.created_at);
        return !Number.isNaN(orderDate.getTime()) && orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
      })
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

    return {
      totalOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      dispatchedOrders,
      monthlySales,
      totalRevenue,
    };
  } catch (error) {
    console.error("QUERY FAILED", error);
    throw error;
  }
}

// ──── ORDERS ────────────────────────────────────────────────────────────────

export async function getMarketingOrders(): Promise<MarketingOrder[]> {
  const { data: orders, error: ordersError } = await supabase.from("orders").select("*");
  console.log("ORDERS RAW", orders);
  console.log("ORDERS ERROR", ordersError);
  if (ordersError) {
    console.error("QUERY FAILED", ordersError);
    throw ordersError;
  }

  const { data: customers, error: customersError } = await supabase.from("customers").select("*");
  console.log("CUSTOMERS RAW", customers);
  console.log("CUSTOMERS ERROR", customersError);
  if (customersError) {
    console.error("QUERY FAILED", customersError);
    throw customersError;
  }

  const { data: orderItems, error: orderItemsError } = await supabase.from("order_items").select("*");
  console.log("ORDER_ITEMS RAW", orderItems);
  console.log("ORDER_ITEMS ERROR", orderItemsError);
  if (orderItemsError) {
    console.error("QUERY FAILED", orderItemsError);
    throw orderItemsError;
  }

  const typedOrders = (orders ?? []) as MarketingOrderRow[];
  const typedCustomers = (customers ?? []) as CustomerRow[];
  const typedOrderItems = (orderItems ?? []) as OrderItemRow[];
  const customerMap = new Map(typedCustomers.map((customer) => [String(customer.id), customer]));
  const itemsByOrder = new Map<string, OrderItemRow[]>();
  typedOrderItems.forEach((item) => itemsByOrder.set(String(item.order_id), [...(itemsByOrder.get(String(item.order_id)) ?? []), item]));

  return typedOrders.map((order) => {
      console.log("STATUS FROM DB", order.status);
      const customer = customerMap.get(String(order.customer_id ?? ""));
      const items = itemsByOrder.get(order.id) ?? [];
      const orderDto = {
        id: order.id,
        orderNumber: order.order_number,
        customer: customer?.name ?? order.customer_name ?? "Unknown",
        amount: order.total_amount,
        status: order.status,
        paymentStatus: order.payment_status,
      };
      return {
        ...orderDto,
        ref: orderDto.orderNumber || "N/A",
        customer: orderDto.customer,
        location: customer?.city || "N/A",
        soap: items[0]?.product_name || "Unknown Product",
        qty: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        value: Number(orderDto.amount || 0),
        date: formatDate(order.order_date),
        delivery: formatDate(order.expected_delivery),
        status: normalizeOrderStatus(orderDto.status),
      };
    });
}

// ──── CUSTOMERS ────────────────────────────────────────────────────────────

export async function getMarketingCustomers(): Promise<MarketingCustomer[]> {
  const { data: customers, error: customersError } = await supabase.from("customers").select("*");
  console.log("CUSTOMERS RAW", customers);
  console.log("CUSTOMERS ERROR", customersError);
  if (customersError) {
    console.error("QUERY FAILED", customersError);
    throw customersError;
  }

    // Get orders for each customer to calculate totals
    const { data: orders, error: ordersError } = await supabase.from("orders").select("*");
    console.log("ORDERS RAW", orders);
    console.log("ORDERS ERROR", ordersError);

    if (ordersError) {
      console.error("QUERY FAILED", ordersError);
      throw ordersError;
    }

    const customerOrderMap = new Map<string, { count: number; total: number }>();
    ((orders || []) as OrderTotalRow[]).forEach((order) => {
      if (!order.customer_id) return;
      const existing = customerOrderMap.get(order.customer_id) || { count: 0, total: 0 };
      customerOrderMap.set(order.customer_id, {
        count: existing.count + 1,
        total: existing.total + Number(order.total_amount || 0),
      });
    });

    return ((customers || []) as CustomerRow[]).map((customer) => {
      const orderStats = customerOrderMap.get(customer.id) || { count: 0, total: 0 };
      return {
        id: customer.customer_code || customer.id,
        name: customer.name || customer.email || "Unknown",
        contactPerson: "",
        email: customer.email || "",
        phone: customer.phone || "",
        state: customer.state || "",
        status: customer.status || "",
        location: customer.city || "N/A",
        orders: orderStats.count,
        value: formatCurrency(orderStats.total),
        since: "N/A",
      };
    });
}

// ──── MONTHLY REVENUE ──────────────────────────────────────────────────────

export async function getMonthlyRevenue(): Promise<RevenuePoint[]> {
  try {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("order_date, total_amount");

    if (error) throw error;

    // Group by month
    const monthlyMap = new Map<string, number>();

    ((orders || []) as RevenueOrderRow[]).forEach((order) => {
      if (!order.order_date) return;
      const date = new Date(order.order_date);
      if (Number.isNaN(date.getTime())) return;
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      const current = monthlyMap.get(monthKey) || 0;
      monthlyMap.set(monthKey, current + Number(order.total_amount || 0));
    });

    // Convert to array and sort chronologically
    const result: RevenuePoint[] = Array.from(monthlyMap.entries())
      .map(([monthKey, revenue]) => {
        const [year, month] = monthKey.split("-");
        return {
          month: getMonthName(parseInt(month)),
          revenue,
        };
      })
      .sort((a, b) => {
        const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
      });

    return result;
  } catch (error) {
    console.error("QUERY FAILED", error);
    throw error;
  }
}

// ──── DEPARTMENT PERFORMANCE (BY PRODUCT) ──────────────────────────────────

export async function getDepartmentPerformance(): Promise<DepartmentPerformance[]> {
  try {
    const { data: orderItems, error: itemsError } = await supabase.from("order_items").select("*");
    console.log("ORDER_ITEMS RAW", orderItems);
    console.log("ORDER_ITEMS ERROR", itemsError);

    if (itemsError) throw itemsError;

    // Group by product
    const productIds = Array.from(new Set((orderItems ?? []).map((item) => item.product_id).filter(Boolean))) as string[];
    const { data: products, error: productsError } = await supabase.from("products").select("*");
    console.log("PRODUCTS RAW", products);
    console.log("PRODUCTS ERROR", productsError);
    if (productsError) {
      console.error("QUERY FAILED", productsError);
      throw productsError;
    }
    const productsMap = new Map((products ?? []).map((product) => [String(product.id).trim(), product]));
    console.log("PRODUCT MAP SIZE", productsMap.size);
    console.log("PRODUCT MAP KEYS", [...productsMap.keys()]);
    const productMap = new Map<string, { name: string; revenue: number; unitsSold: number; orderIds: Set<string> }>();

    ((orderItems || []) as OrderItemRow[]).forEach((item) => {
      if (!item.product_id) return;
      const productId = String(item.product_id).trim();
      const product = productsMap.get(productId);
      console.log("ORDER ITEM PRODUCT ID", item.product_id);
      console.log("ORDER ITEM PRODUCT ID TYPE", typeof item.product_id);
      console.log("PRODUCT ID SAMPLE", products?.[0]?.id, "TYPE", typeof products?.[0]?.id);
      console.log("PRODUCT MAP LOOKUP", productId, product);
      const productName = product?.name || "Unknown Product";
      const existing = productMap.get(productId) || { name: productName, revenue: 0, unitsSold: 0, orderIds: new Set<string>() };
      productMap.set(productId, {
        name: productName,
        revenue: existing.revenue + Number(item.total_price || 0),
        unitsSold: existing.unitsSold + Number(item.quantity || 0),
        orderIds: new Set(existing.orderIds).add(item.order_id),
      });
    });

    // Calculate total revenue
    const totalRevenue = Array.from(productMap.values()).reduce((sum, p) => sum + p.revenue, 0);

    // Convert to array and sort by revenue descending
    const result = Array.from(productMap.values())
      .map((product) => ({
        name: product.name,
        pct: totalRevenue > 0 ? Math.round((product.revenue / totalRevenue) * 100) : 0,
        val: formatCurrency(product.revenue),
        unitsSold: product.unitsSold,
        revenue: product.revenue,
        ordersCount: product.orderIds.size,
      }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5); // Top 5 products

    return result;
  } catch (error) {
    console.error("QUERY FAILED", error);
    throw error;
  }
}

export async function exportMarketingWorkbook(
  orders: MarketingOrder[],
  customers: MarketingCustomer[],
  metrics: DashboardMetrics,
  revenue: RevenuePoint[],
  performance: DepartmentPerformance[],
): Promise<void> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const orderRows = orders.map((order) => ({
    "Order Number": order.ref,
    Customer: order.customer,
    "Order Date": order.date,
    "Expected Delivery": order.delivery,
    Status: order.status,
    Quantity: order.qty,
    Value: order.value,
  }));
  const customerRows = customers.map((customer) => ({
    "Customer Code": customer.id,
    "Company Name": customer.name,
    "Contact Person": customer.contactPerson,
    Email: customer.email,
    Phone: customer.phone,
    City: customer.location,
    State: customer.state,
    Status: customer.status,
  }));
  const averageOrderValue = metrics.totalOrders > 0 ? metrics.totalRevenue / metrics.totalOrders : 0;
  const dashboardRows = [
    { Type: "KPI", Label: "Total Orders", Value: metrics.totalOrders },
    { Type: "KPI", Label: "Pending Orders", Value: metrics.pendingOrders },
    { Type: "KPI", Label: "Completed Orders", Value: metrics.completedOrders },
    { Type: "KPI", Label: "Revenue", Value: metrics.totalRevenue },
    { Type: "KPI", Label: "Average Order Value", Value: averageOrderValue },
    { Type: "KPI", Label: "Customer Count", Value: customers.length },
    ...revenue.map((point) => ({ Type: "Revenue Chart", Label: point.month, Value: point.revenue })),
    ...performance.map((point) => ({ Type: "Product Chart", Label: point.name, Value: point.val })),
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(orderRows), "Orders");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(customerRows), "Customers");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(dashboardRows), "Dashboard");
  XLSX.writeFile(workbook, `marketing_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ──── MARKETING V1 DOMAIN SERVICE ─────────────────────────────────────────

export interface MarketingLead {
  id: string;
  assigned_to: string;
  campaign_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  value: number;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  budget: number;
  manager_id: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface MarketingConversion {
  id: string;
  lead_id: string;
  converted_by: string;
  campaign_id: string | null;
  conversion_date: string;
  conversion_value: number;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface MarketingActivityLog {
  id: string;
  assigned_to: string;
  lead_id: string | null;
  campaign_id: string | null;
  activity_type: string;
  description: string | null;
  activity_date: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface MarketingTarget {
  id: string;
  manager_id: string;
  target_quantity: number;
  actual_quantity: number;
  target_period: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface MarketingResult<T> {
  data: T | null;
  error: Error | null;
}

export interface CreateLeadInput {
  assigned_to: string;
  campaign_id?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  status?: string;
  value?: number;
}

export interface CreateCampaignInput {
  name: string;
  description?: string | null;
  status?: string;
  start_date?: string | null;
  end_date?: string | null;
  budget?: number;
  manager_id: string;
}

export interface CreateConversionInput {
  lead_id: string;
  converted_by: string;
  campaign_id?: string | null;
  conversion_date: string;
  conversion_value: number;
}

export interface CreateActivityLogInput {
  assigned_to: string;
  lead_id?: string | null;
  campaign_id?: string | null;
  activity_type: string;
  description?: string | null;
  activity_date: string;
}

export interface CreateMarketingTargetInput {
  manager_id: string;
  target_quantity: number;
  target_period: string;
  start_date: string;
  end_date: string;
}

export interface MarketingTargetVsActual {
  target_quantity: number;
  actual_quantity: number;
  variance: number;
  achievement_percentage: number;
}

export interface MarketingWorkerDashboard {
  total_leads: number;
  qualified_leads: number;
  converted_leads: number;
  conversion_rate: number;
}

export interface MarketingSupervisorDashboard {
  team_leads: number;
  team_conversions: number;
  team_conversion_rate: number;
  active_campaigns: number;
}

export interface MarketingManagerDashboard {
  campaign_count: number;
  revenue: number;
  target: number;
  actual: number;
  achievement_percentage: number;
}

export interface MarketingCMDashboard {
  department_efficiency: number;
  campaign_performance: number;
  target_achievement: number;
}

export interface MarketingGMDashboard {
  department_analytics: number;
  revenue_trends: Array<{ period: string; revenue: number }>;
  conversion_trends: Array<{ period: string; conversions: number }>;
}

export interface MarketingMDashboard {
  revenue_growth: number;
  strategic_campaign_metrics: number;
  annual_target_achievement: number;
}

function marketingError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error ?? "Marketing request failed"));
}

function marketingInvalid(message: string): MarketingResult<never> {
  return { data: null, error: new Error(message) };
}

function requiredMarketingId(value: string | undefined, label: string): Error | null {
  return value?.trim() ? null : new Error(`${label} is required`);
}

function marketingNumber(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function rowPeriod(row: Record<string, unknown>): string {
  return String(row.conversion_date ?? row.activity_date ?? row.created_at ?? "").slice(0, 7);
}

function monthRevenue(rows: MarketingConversion[], period: string): number {
  return rows.filter((row) => rowPeriod(row) === period).reduce((sum, row) => sum + marketingNumber(row.conversion_value), 0);
}

async function readMarketingTable<T>(table: string): Promise<MarketingResult<T[]>> {
  try {
    const { data, error } = await supabase.from(table).select("*");
    if (error) return { data: null, error: marketingError(error) };
    return { data: (data ?? []) as T[], error: null };
  } catch (error) {
    return { data: null, error: marketingError(error) };
  }
}

async function readMarketingById<T>(table: string, id: string): Promise<MarketingResult<T>> {
  try {
    const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
    if (error) return { data: null, error: marketingError(error) };
    return { data: (data as T | null) ?? null, error: null };
  } catch (error) {
    return { data: null, error: marketingError(error) };
  }
}

async function readMarketingByColumn<T>(table: string, column: string, value: string): Promise<MarketingResult<T[]>> {
  try {
    const { data, error } = await supabase.from(table).select("*").eq(column, value);
    if (error) return { data: null, error: marketingError(error) };
    return { data: (data ?? []) as T[], error: null };
  } catch (error) {
    return { data: null, error: marketingError(error) };
  }
}

async function insertMarketing<T>(table: string, payload: Record<string, unknown>): Promise<MarketingResult<T>> {
  try {
    const { data, error } = await supabase.from(table).insert(payload).select("*").single();
    if (error) return { data: null, error: marketingError(error) };
    return { data: data as T, error: null };
  } catch (error) {
    return { data: null, error: marketingError(error) };
  }
}

async function updateMarketing<T>(table: string, id: string, updates: Record<string, unknown>): Promise<MarketingResult<T>> {
  try {
    const { data, error } = await supabase.from(table).update(updates).eq("id", id).select("*").single();
    if (error) return { data: null, error: marketingError(error) };
    return { data: data as T, error: null };
  } catch (error) {
    return { data: null, error: marketingError(error) };
  }
}

export async function getLeads(): Promise<MarketingResult<MarketingLead[]>> { return readMarketingTable<MarketingLead>("marketing_leads"); }

export async function getLeadById(id: string): Promise<MarketingResult<MarketingLead>> {
  const error = requiredMarketingId(id, "Lead ID");
  return error ? marketingInvalid(error.message) : readMarketingById<MarketingLead>("marketing_leads", id);
}

export async function getLeadsByEmployee(employeeId: string): Promise<MarketingResult<MarketingLead[]>> {
  const error = requiredMarketingId(employeeId, "Employee ID");
  return error ? marketingInvalid(error.message) : readMarketingByColumn<MarketingLead>("marketing_leads", "assigned_to", employeeId);
}

export async function createLead(data: CreateLeadInput): Promise<MarketingResult<MarketingLead>> {
  if (!data.name.trim()) return marketingInvalid("Lead name is required");
  if (!data.assigned_to.trim()) return marketingInvalid("Assignee ID is required");
  if (data.value !== undefined && (!Number.isFinite(data.value) || data.value < 0)) return marketingInvalid("Lead value must be zero or greater");
  return insertMarketing<MarketingLead>("marketing_leads", { ...data, campaign_id: data.campaign_id ?? null, email: data.email ?? null, phone: data.phone ?? null, source: data.source ?? null, status: data.status ?? "New", value: data.value ?? 0 });
}

export async function updateLead(id: string, data: Partial<MarketingLead>): Promise<MarketingResult<MarketingLead>> {
  const error = requiredMarketingId(id, "Lead ID");
  if (error) return marketingInvalid(error.message);
  const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...updates } = data;
  return updateMarketing<MarketingLead>("marketing_leads", id, updates);
}

export async function getConversions(): Promise<MarketingResult<MarketingConversion[]>> { return readMarketingTable<MarketingConversion>("marketing_conversions"); }

export async function getConversionsByEmployee(employeeId: string): Promise<MarketingResult<MarketingConversion[]>> {
  const error = requiredMarketingId(employeeId, "Employee ID");
  return error ? marketingInvalid(error.message) : readMarketingByColumn<MarketingConversion>("marketing_conversions", "converted_by", employeeId);
}

export async function recordConversion(data: CreateConversionInput): Promise<MarketingResult<MarketingConversion>> {
  if (!data.lead_id.trim() || !data.converted_by.trim()) return marketingInvalid("Lead ID and converter ID are required");
  if (!data.conversion_date || !Number.isFinite(data.conversion_value) || data.conversion_value < 0) return marketingInvalid("Conversion date and non-negative conversion value are required");
  return insertMarketing<MarketingConversion>("marketing_conversions", { ...data, campaign_id: data.campaign_id ?? null });
}

export async function getCampaigns(): Promise<MarketingResult<MarketingCampaign[]>> { return readMarketingTable<MarketingCampaign>("marketing_campaigns"); }

export async function getCampaignById(id: string): Promise<MarketingResult<MarketingCampaign>> {
  const error = requiredMarketingId(id, "Campaign ID");
  return error ? marketingInvalid(error.message) : readMarketingById<MarketingCampaign>("marketing_campaigns", id);
}

export async function createCampaign(data: CreateCampaignInput): Promise<MarketingResult<MarketingCampaign>> {
  if (!data.name.trim() || !data.manager_id.trim()) return marketingInvalid("Campaign name and manager ID are required");
  if (data.budget !== undefined && (!Number.isFinite(data.budget) || data.budget < 0)) return marketingInvalid("Campaign budget must be zero or greater");
  return insertMarketing<MarketingCampaign>("marketing_campaigns", { ...data, description: data.description ?? null, status: data.status ?? "Planned", start_date: data.start_date ?? null, end_date: data.end_date ?? null, budget: data.budget ?? 0 });
}

export async function updateCampaign(id: string, data: Partial<MarketingCampaign>): Promise<MarketingResult<MarketingCampaign>> {
  const error = requiredMarketingId(id, "Campaign ID");
  if (error) return marketingInvalid(error.message);
  const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...updates } = data;
  return updateMarketing<MarketingCampaign>("marketing_campaigns", id, updates);
}

export async function getActiveCampaigns(): Promise<MarketingResult<MarketingCampaign[]>> {
  try {
    const { data, error } = await supabase.from("marketing_campaigns").select("*").eq("status", "Active");
    if (error) return { data: null, error: marketingError(error) };
    return { data: (data ?? []) as MarketingCampaign[], error: null };
  } catch (error) { return { data: null, error: marketingError(error) }; }
}

export async function getTargets(): Promise<MarketingResult<MarketingTarget[]>> { return readMarketingTable<MarketingTarget>("marketing_targets"); }

export async function getTargetByManager(managerId: string): Promise<MarketingResult<MarketingTarget[]>> {
  const error = requiredMarketingId(managerId, "Manager ID");
  return error ? marketingInvalid(error.message) : readMarketingByColumn<MarketingTarget>("marketing_targets", "manager_id", managerId);
}

export async function createTarget(data: CreateMarketingTargetInput): Promise<MarketingResult<MarketingTarget>> {
  if (!data.manager_id.trim() || !data.target_period || !data.start_date || !data.end_date) return marketingInvalid("Manager ID and target period are required");
  if (!Number.isFinite(data.target_quantity) || data.target_quantity < 0) return marketingInvalid("Target quantity must be zero or greater");
  return insertMarketing<MarketingTarget>("marketing_targets", data as unknown as Record<string, unknown>);
}

export async function updateTarget(id: string, data: Partial<MarketingTarget>): Promise<MarketingResult<MarketingTarget>> {
  const error = requiredMarketingId(id, "Target ID");
  if (error) return marketingInvalid(error.message);
  const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...updates } = data;
  return updateMarketing<MarketingTarget>("marketing_targets", id, updates);
}

export async function calculateTargetVsActual(managerId: string): Promise<MarketingResult<MarketingTargetVsActual>> {
  const [targets, conversions] = await Promise.all([getTargetByManager(managerId), getConversions()]);
  if (targets.error || !targets.data) return { data: null, error: targets.error };
  if (conversions.error || !conversions.data) return { data: null, error: conversions.error };
  const target = targets.data.reduce((sum, row) => sum + marketingNumber(row.target_quantity), 0);
  const actual = targets.data.reduce((sum, row) => sum + marketingNumber(row.actual_quantity), 0);
  return { data: { target_quantity: target, actual_quantity: actual, variance: actual - target, achievement_percentage: target ? (actual / target) * 100 : 0 }, error: null };
}

export async function getActivityLogs(): Promise<MarketingResult<MarketingActivityLog[]>> { return readMarketingTable<MarketingActivityLog>("marketing_activity_logs"); }

export async function getActivityLogsByEmployee(employeeId: string): Promise<MarketingResult<MarketingActivityLog[]>> {
  const error = requiredMarketingId(employeeId, "Employee ID");
  return error ? marketingInvalid(error.message) : readMarketingByColumn<MarketingActivityLog>("marketing_activity_logs", "assigned_to", employeeId);
}

export async function createActivityLog(data: CreateActivityLogInput): Promise<MarketingResult<MarketingActivityLog>> {
  if (!data.assigned_to.trim() || !data.activity_type.trim() || !data.activity_date) return marketingInvalid("Assignee ID, activity type, and activity date are required");
  return insertMarketing<MarketingActivityLog>("marketing_activity_logs", { ...data, lead_id: data.lead_id ?? null, campaign_id: data.campaign_id ?? null, description: data.description ?? null });
}

async function marketingTeamIds(supervisorId: string): Promise<MarketingResult<string[]>> {
  try {
    const subordinates = await getSubordinates(supervisorId);
    return { data: [supervisorId, ...subordinates], error: null };
  } catch (error) { return { data: null, error: marketingError(error) }; }
}

export async function getWorkerDashboard(employeeId: string): Promise<MarketingResult<MarketingWorkerDashboard>> {
  const [leads, conversions] = await Promise.all([getLeadsByEmployee(employeeId), getConversionsByEmployee(employeeId)]);
  if (leads.error || !leads.data) return { data: null, error: leads.error };
  if (conversions.error || !conversions.data) return { data: null, error: conversions.error };
  const qualified = leads.data.filter((lead) => ["qualified", "converted"].includes(String(lead.status).toLowerCase())).length;
  const converted = conversions.data.length;
  return { data: { total_leads: leads.data.length, qualified_leads: qualified, converted_leads: converted, conversion_rate: leads.data.length ? (converted / leads.data.length) * 100 : 0 }, error: null };
}

export async function getSupervisorDashboard(supervisorId: string): Promise<MarketingResult<MarketingSupervisorDashboard>> {
  const scope = await resolveDashboardScope(supervisorId, "Supervisor");
  const ids = await marketingTeamIds(supervisorId);
  if (ids.error || !ids.data) return { data: null, error: ids.error };
  const [leads, conversions, campaigns] = await Promise.all([getLeads(), getConversions(), getActiveCampaigns()]);
  const failure = [leads, conversions, campaigns].find((result) => result.error);
  if (failure?.error) return { data: null, error: failure.error };
  const team = new Set(ids.data);
  const teamLeads = leads.data!.filter((lead) => inDashboardScope(scope, lead.assigned_to)).length;
  const teamConversions = conversions.data!.filter((conversion) => inDashboardScope(scope, conversion.converted_by)).length;
  return { data: { team_leads: teamLeads, team_conversions: teamConversions, team_conversion_rate: teamLeads ? (teamConversions / teamLeads) * 100 : 0, active_campaigns: campaigns.data!.length }, error: null };
}

export async function getManagerDashboard(managerId: string, department?: string | null): Promise<MarketingResult<MarketingManagerDashboard>> {
  const scope = await resolveDashboardScope(managerId, "Manager", department);
  const [campaigns, conversions, targetActual] = await Promise.all([getCampaigns(), getConversions(), calculateTargetVsActual(managerId)]);
  if (campaigns.error || !campaigns.data) return { data: null, error: campaigns.error };
  if (conversions.error || !conversions.data) return { data: null, error: conversions.error };
  if (targetActual.error || !targetActual.data) return { data: null, error: targetActual.error };
  const managerCampaigns = campaigns.data.filter((campaign) => inDashboardScope(scope, campaign.manager_id));
  const campaignIds = new Set(managerCampaigns.map((campaign) => campaign.id));
  const revenue = conversions.data.filter((row) => row.campaign_id !== null && campaignIds.has(row.campaign_id)).reduce((sum, row) => sum + marketingNumber(row.conversion_value), 0);
  return { data: { campaign_count: managerCampaigns.length, revenue, target: targetActual.data.target_quantity, actual: targetActual.data.actual_quantity, achievement_percentage: targetActual.data.achievement_percentage }, error: null };
}

export async function getCMDashboard(department?: string | null): Promise<MarketingResult<MarketingCMDashboard>> {
  const scope = await resolveDashboardScope("", "Chief Manager", department);
  const [leads, conversions, targets, campaigns] = await Promise.all([getLeads(), getConversions(), getTargets(), getCampaigns()]);
  const failure = [leads, conversions, targets, campaigns].find((result) => result.error);
  if (failure?.error) return { data: null, error: failure.error };
  const scopedLeads = leads.data!.filter((lead) => inDashboardScope(scope, lead.assigned_to));
  const scopedConversions = conversions.data!.filter((conversion) => inDashboardScope(scope, conversion.converted_by));
  const scopedCampaigns = campaigns.data!.filter((campaign) => inDashboardScope(scope, campaign.manager_id));
  const leadCount = scopedLeads.length;
  const conversionCount = scopedConversions.length;
  const target = targets.data!.filter((row) => inDashboardScope(scope, row.manager_id)).reduce((sum, row) => sum + marketingNumber(row.target_quantity), 0);
  return { data: { department_efficiency: leadCount ? (conversionCount / leadCount) * 100 : 0, campaign_performance: scopedCampaigns.length ? (conversionCount / scopedCampaigns.length) * 100 : 0, target_achievement: target ? (conversionCount / target) * 100 : 0 }, error: null };
}

export async function getGMDashboard(department?: string | null): Promise<MarketingResult<MarketingGMDashboard>> {
  const scope = await resolveDashboardScope("", "General Manager", department);
  const [conversions, leads] = await Promise.all([getConversions(), getLeads()]);
  if (conversions.error || !conversions.data) return { data: null, error: conversions.error };
  if (leads.error || !leads.data) return { data: null, error: leads.error };
  const scopedConversions = conversions.data!.filter((conversion) => inDashboardScope(scope, conversion.converted_by));
  const scopedLeads = leads.data!.filter((lead) => inDashboardScope(scope, lead.assigned_to));
  const revenueByPeriod = new Map<string, number>();
  const conversionsByPeriod = new Map<string, number>();
  scopedConversions.forEach((row) => { const period = rowPeriod(row); revenueByPeriod.set(period, (revenueByPeriod.get(period) ?? 0) + marketingNumber(row.conversion_value)); conversionsByPeriod.set(period, (conversionsByPeriod.get(period) ?? 0) + 1); });
  return { data: { department_analytics: scopedLeads.length ? (scopedConversions.length / scopedLeads.length) * 100 : 0, revenue_trends: Array.from(revenueByPeriod, ([period, revenue]) => ({ period, revenue })), conversion_trends: Array.from(conversionsByPeriod, ([period, conversionsCount]) => ({ period, conversions: conversionsCount })) }, error: null };
}

export async function getMDMarketingDashboard(): Promise<MarketingResult<MarketingMDashboard>> {
  const [conversions, targets, campaigns] = await Promise.all([getConversions(), getTargets(), getCampaigns()]);
  const failure = [conversions, targets, campaigns].find((result) => result.error);
  if (failure?.error) return { data: null, error: failure.error };
  const current = new Date();
  const currentPeriod = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
  const previousDate = new Date(current.getFullYear(), current.getMonth() - 1, 1);
  const previousPeriod = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`;
  const currentRevenue = monthRevenue(conversions.data!, currentPeriod);
  const previousRevenue = monthRevenue(conversions.data!, previousPeriod);
  const target = targets.data!.reduce((sum, row) => sum + marketingNumber(row.target_quantity), 0);
  const actualQuantity = targets.data!.reduce((sum, row) => sum + marketingNumber(row.actual_quantity), 0);
  const revenueGrowth = previousRevenue ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : currentRevenue ? 100 : 0;
  return { data: { revenue_growth: revenueGrowth, strategic_campaign_metrics: campaigns.data!.length ? (campaigns.data!.filter((campaign) => campaign.status.toLowerCase() === "active").length / campaigns.data!.length) * 100 : 0, annual_target_achievement: target ? (actualQuantity / target) * 100 : 0 }, error: null };
}