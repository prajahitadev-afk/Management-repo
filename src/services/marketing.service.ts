import { supabase } from "../lib/supabase";
import { normalizeOrderStatus, ORDER_STATUS } from "./order-statuses";

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
  customers: Array<{ first_name: string | null; last_name: string | null; email: string | null; city: string | null }> | null;
  order_items: Array<{ quantity: number | null; products: Array<{ name: string | null }> | null }> | null;
  total_amount: number | string | null;
  order_date: string | null;
  expected_delivery: string | null;
  status: string | null;
}
interface CustomerRow { id: string; customer_code: string | null; first_name: string | null; last_name: string | null; email: string | null; phone: string | null; city: string | null; state: string | null; status: string | null; created_at: string | null; }
interface OrderTotalRow { customer_id: string | null; total_amount: number | string | null; }
interface RevenueOrderRow { order_date: string | null; total_amount: number | string | null; }
interface ProductOrderItemRow { product_id: string; total_price: number | string | null; products: Array<{ name: string | null }> | null; }

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

    const { data: deliveries, error: deliveriesError } = await supabase
      .from("deliveries")
      .select("id, status");

    if (deliveriesError) throw deliveriesError;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const orders = (allOrders || []) as DashboardOrderRow[];
    const totalOrders = orders.length;
    const pendingOrders = orders.filter((o) => normalizeOrderStatus(o.status) === ORDER_STATUS.Pending).length;
    const completedOrders = orders.filter((o) => normalizeOrderStatus(o.status) === ORDER_STATUS.Delivered).length;
    const cancelledOrders = orders.filter((o) => normalizeOrderStatus(o.status) === ORDER_STATUS.Cancelled).length;
    const dispatchedOrders = (deliveries || []).filter((d) => normalizeOrderStatus(d.status) === ORDER_STATUS.Dispatched).length;

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
    console.error("Error fetching dashboard metrics:", error);
    return {
      totalOrders: 0,
      pendingOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      dispatchedOrders: 0,
      monthlySales: 0,
      totalRevenue: 0,
    };
  }
}

// ──── ORDERS ────────────────────────────────────────────────────────────────

export async function getMarketingOrders(): Promise<MarketingOrder[]> {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        customer_id,
        order_date,
        expected_delivery,
        status,
        total_amount,
        customers (
          first_name,
          last_name,
          email,
          city
        ),
        order_items (
          product_id,
          quantity,
          unit_price,
          products (
            name
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return ((data || []) as MarketingOrderRow[]).map((order) => {
      const customer = order.customers?.[0];
      const firstOrderItem = order.order_items?.[0];
      const productName = firstOrderItem?.products?.[0]?.name ?? "Product";

      const customerName = customer ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || customer.email || "Unknown" : "Unknown";
      return {
        id: order.id,
        ref: order.order_number || "N/A",
        customer: customerName,
        location: customer?.city || "N/A",
        soap: productName,
        qty: order.order_items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0,
        value: Number(order.total_amount || 0),
        date: formatDate(order.order_date),
        delivery: formatDate(order.expected_delivery),
        status: normalizeOrderStatus(order.status),
      };
    });
  } catch (error) {
    console.error("Error fetching marketing orders:", error);
    return [];
  }
}

// ──── CUSTOMERS ────────────────────────────────────────────────────────────

export async function getMarketingCustomers(): Promise<MarketingCustomer[]> {
  try {
    const { data: customers, error: customersError } = await supabase
      .from("customers")
      .select(`
        id,
        customer_code,
        first_name,
        last_name,
        email,
        phone,
        city,
        state,
        status,
        created_at
      `)
      .order("created_at", { ascending: false });

    if (customersError) throw customersError;

    // Get orders for each customer to calculate totals
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("customer_id, total_amount");

    if (ordersError) throw ordersError;

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
      const joinedDate = customer.created_at ? new Date(customer.created_at) : new Date();

      return {
        id: customer.customer_code || customer.id,
        name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Unknown",
        contactPerson: "",
        email: customer.email || "",
        phone: customer.phone || "",
        state: customer.state || "",
        status: customer.status || "",
        location: customer.city || "N/A",
        orders: orderStats.count,
        value: formatCurrency(orderStats.total),
        since: joinedDate.toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
      };
    });
  } catch (error) {
    console.error("Error fetching marketing customers:", error);
    return [];
  }
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

    // Ensure we have data for at least the current month
    if (result.length === 0) {
      const now = new Date();
      return [{
        month: getMonthName(now.getMonth()),
        revenue: 0,
      }];
    }

    return result;
  } catch (error) {
    console.error("Error fetching monthly revenue:", error);
    return [];
  }
}

// ──── DEPARTMENT PERFORMANCE (BY PRODUCT) ──────────────────────────────────

export async function getDepartmentPerformance(): Promise<DepartmentPerformance[]> {
  try {
    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select(`
        product_id,
        total_price,
        products (
          name
        )
      `);

    if (itemsError) throw itemsError;

    // Group by product
    const productMap = new Map<string, { name: string; revenue: number }>();

    ((orderItems || []) as ProductOrderItemRow[]).forEach((item) => {
      const productName = item.products?.[0]?.name || "Unknown";
      const existing = productMap.get(item.product_id) || { name: productName, revenue: 0 };
      productMap.set(item.product_id, {
        name: productName,
        revenue: existing.revenue + Number(item.total_price || 0),
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
      }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5); // Top 5 products

    return result;
  } catch (error) {
    console.error("Error fetching department performance:", error);
    return [];
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