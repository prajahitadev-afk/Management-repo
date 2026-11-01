import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard, Users, FileText, ShoppingCart, Truck, Shield,
  BarChart2, Bell, Search, ChevronLeft, ChevronRight, LogOut,
  Menu, X, CheckCircle, Clock, XCircle, AlertTriangle, Eye,
  Download, Upload, Plus, Calendar,
  Package, MapPin, User, ChevronDown, ArrowRight,
  Lock, RefreshCw, Heart, Activity, DollarSign, MessageSquare,
  FileCheck, FileX, Send, Printer, CheckSquare, Archive, Zap,
  Handshake, Globe2, Sparkles, Trash2, Key, UserCheck, UserX,
  ClipboardList, Layers, Building2, FlaskConical, ArrowUpRight,
  Moon, Sun,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie,
  Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useAuth } from "../hooks/useAuth";
import { useDashboard } from "../hooks/useDashboard";
import { useAttendance } from "../hooks/useAttendance";
import { useBills } from "../hooks/useBills"; 
import { useMarketing } from "../hooks/useMarketing";
import { useTransport } from "../hooks/useTransport";
import { useNotifications } from "../hooks/useNotifications";
import { markAllAsRead } from "../services/notification.service";
import type { NotificationEventType, NotificationRecord } from "../services/notification.service";
import type { MarketingCustomer, MarketingOrder } from "../services/marketing.service";
import { getBillAttachments, getBillHistory, viewBillAttachment, downloadBillAttachment, type BillAttachment, type BillHistory, type BillRecord, exportBillToPDF, exportBillsToXLSX, uploadBillAttachments } from "../services/bills.service";
import logoSrc from "../assets/images/Prajahita.jpeg";
import { getMonthlyRevenueData, getCommunityImpactData, getWeeklyAttendanceData, getAttendanceBreakdownData, type MonthData, type CommunityData, type AttendanceDay, type AttendanceBreakdown } from "../services/dashboard.service";
import { exportMarketingWorkbook } from "../services/marketing.service";
import { approveOrder, rejectOrder, getOrderDetails, type OrderDetails } from "../services/orders.service";
import { ORDER_STATUS } from "../services/order-statuses";
import { exportShipmentsToCSV, getDeliveryDetails, getDeliveryEditableOptions, updateDeliveryDetails, type TransportShipment, type DeliveryOption } from "../services/transport.service";
import { exportAttendanceToCSV } from "../services/attendance.service";
import { generateReport, exportReportToCSV, exportReportToExcel, exportReportToPDF, type GeneratedReport, type ReportExportFormat, type ReportType } from "../services/reports.service";
import { supabase } from "../lib/supabase";
import { usePrograms } from "../hooks/usePrograms";
import { useCommunityImpact } from "../hooks/useCommunityImpact";
import { CreateOrderPage } from "./CreateOrderPage";
import { CreateDispatchPage } from "./CreateDispatchPage";
import { EmployeeDirectoryPage } from "../pages/employees/EmployeeDirectoryPage";
import { EmployeeProfilePage } from "../pages/employees/EmployeeProfilePage";
import { PaymentsPage } from "../pages/PaymentsPage";
import { CollaborationModule } from "../pages/marketing/CollaborationModule";
import { AttendancePage as EmployeeAttendancePage } from "../pages/employees/AttendancePage";
import { OrganizationChartPage } from "../pages/employees/OrganizationChartPage";
import { EmployeeKpiWidget } from "../components/EmployeeKpiWidget";
import { LeavePage } from "../pages/leave/LeavePage";
import AuditLogPage from "../pages/AuditLogPage";
import { ExecutiveAnalyticsDashboard } from "../components/ExecutiveAnalyticsDashboard";
import { canAccessDepartmentModule } from "../services/hierarchy.service";

// ─── Types ────────────────────────────────────────────────────────────────────
type Role =
  | "Vice Chairman" | "President" | "Vice President"
  | "Managing Director"
  | "MD-Manufacturing" | "MD-Marketing" | "MD-Transport" | "MD-RD"
  | "General Manager" | "Chief Manager" | "Manager" | "Supervisor" | "Worker"
  | "Admin";

type Page = "login" | "dashboard" | "attendance" | "bills" | "marketing" | "orders" | "transport" | "admin" | "reports" | "notifications" | "employees" | "organization" | "audit" | "profile" | "leave" | "department" | "not-found";
type EmployeeRoute = "directory" | "profile" | "attendance" | "organization";

interface AppUser { id: string; name: string; role: Role; department: string; avatar: string; email: string; employeeId?: string; }

interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  suspendedEmployees: number;
  totalRoles: number;
  ordersReceived: number;
  pendingApprovals: number;
  pendingBills: number;
  approvedBills: number;
  rejectedBills: number;
  monthlyRevenue: number;
  weeklyAttendance: Array<{ day: string; present: number; absent: number }>;
  communityImpact: Array<{ month: string; beneficiaries: number; volunteers: number }>;
  revenueTrend: Array<{ month: string; orders: number; delivered: number; revenue: number }>;
  managerCount: number;
  supervisorCount: number;
  teamResponsibilities: Array<{ id: string; name: string; role: string; department: string; status: string }>;
  leaveBalance: number;
  leaveTaken: number;
  todayAttendanceStatus: string;
  attendanceHistory: Array<{ id: string; date: string; status: string; checkIn: string; checkOut: string }>;
  supervisorWorkersCount: number;
  supervisorPresentCount: number;
  supervisorAbsentCount: number;
  supervisorHalfDayCount: number;
  supervisorLateCount: number;
  supervisorAttendanceRows: Array<{ id: string; employeeId: string; employeeName: string; status: string; checkIn: string }>;
}

interface Customer {
  id: string;
  customer_code: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  status: string | null;
  created_at: string | null;
}

interface Product {
  id: string;
  product_code: string | null;
  name: string | null;
  category: string | null;
  price: number | string | null;
  stock_quantity: number | null;
  status: string | null;
  created_at: string | null;
}

interface Order {
  id: string;
  order_number: string | null;
  customer_id: string | null;
  order_date: string | null;
  expected_delivery: string | null;
  status: string | null;
  total_amount: number | string | null;
  created_by: string | null;
  created_at: string | null;
}

function normalizeRoleName(roleName: string): Role {
  if (roleName in ROLE_LEVEL) {
    return roleName as Role;
  }
  return "Worker";
}

function getTodayLabel() {
  return new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function navigateDashboardAction(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function getEmployeeRoutePath() {
  if (typeof window === "undefined") return "";
  const hash = window.location.hash.replace(/^#\/?/, "");
  const path = window.location.pathname.replace(/^\/?/, "");
  return hash || path;
}

function getNotificationCategory(type: NotificationEventType) {
  if (type.startsWith("bill_")) return "bill";
  if (type.startsWith("order_")) return "order";
  if (type === "dispatch_created" || type.startsWith("delivery_")) return "delivery";
  if (type === "attendance_absent_three_days") return "attendance";
  if (type === "employee_recruited") return "recruit";
  if (type === "employee_suspended" || type === "employee_activated") return "suspension";
  if (type.startsWith("leave_") || type === "report_generated" || type === "password_reset") return "approval";
  return "announce";
}

function formatRoleLabel(roleName: string): string {
  const normalized = normalizeRoleName(roleName);
  return normalized.startsWith("MD-") ? `MD – ${MD_DEPT[normalized]}` : normalized;
}

// Role hierarchy level (higher = more authority)
const ROLE_LEVEL: Record<Role, number> = {
  "Vice Chairman": 8, "President": 7, "Vice President": 7,
  "Managing Director": 6,
  "MD-Manufacturing": 6, "MD-Marketing": 6, "MD-Transport": 6, "MD-RD": 6,
  "General Manager": 5, "Chief Manager": 4, "Manager": 3, "Supervisor": 2, "Worker": 1,
  "Admin": 9,
};

const isMD   = (r: Role) => r === "Managing Director" || r.startsWith("MD-");
const isExec = (r: Role) => r === "Vice Chairman" || r === "President" || r === "Vice President";
const canApproveBills = (r: Role) => ["Vice Chairman","MD-Manufacturing","MD-Marketing","MD-Transport","MD-RD","General Manager"].includes(r);
const canSubmitBills  = (r: Role) => ROLE_LEVEL[r] >= ROLE_LEVEL["Supervisor"];
const canViewReports  = (r: Role) => ["Manager", "Chief Manager", "General Manager", "Managing Director", "MD-Manufacturing", "MD-Marketing", "MD-Transport", "MD-RD", "Vice Chairman"].includes(r);
const canViewAdmin    = (r: Role) => isExec(r) || r === "Admin";

const MD_DEPT: Partial<Record<Role, string>> = {
  "MD-Manufacturing": "Manufacturing",
  "MD-Marketing":     "Marketing",
  "MD-Transport":     "Transport",
  "MD-RD":            "Research & Development",
};

const EMPLOYEE_NAV_ROLES: Role[] = ["Worker", "Supervisor", "Manager", "General Manager", "Managing Director", "MD-Manufacturing", "MD-Marketing", "MD-Transport", "MD-RD", "Vice President", "Vice Chairman"];
const MANAGEMENT_NAV_ROLES: Role[] = ["Manager", "Chief Manager", "General Manager", "Managing Director", "MD-Manufacturing", "MD-Marketing", "MD-Transport", "MD-RD", "Vice President", "Vice Chairman"];
const DEPARTMENT_MODULE_ROLES: Role[] = ["Worker", "Supervisor", "Manager", "Chief Manager", "General Manager", "Managing Director", "MD-Manufacturing", "MD-Marketing", "MD-Transport", "MD-RD"];

// ─── Brand ───────────────────────────────────────────────────────────────────
const B = {
  nav: "#153A32", navDark: "#102D27", navLight: "#23624F",
  navAct: "rgba(255,255,255,0.12)", navBorder: "rgba(255,255,255,0.10)", navTxt: "rgba(238,247,242,0.72)",
  bg: "linear-gradient(180deg, #F7F9F7 0%, #F1F5F2 100%)", bgSolid: "#F4F7F5",
  glass: "#FFFFFF", glassDark: "#F7FAF8",
  glassBorder: "#E3EBE6", glassBlur: "none",
  glassShadow: "0 2px 8px rgba(22,45,35,0.04), 0 12px 28px rgba(22,45,35,0.035)",
  glassShadowHov: "0 8px 20px rgba(22,45,35,0.08), 0 18px 38px rgba(22,45,35,0.06)",
  green: "#176B52", greenLight: "rgba(23,107,82,0.10)",
  blue: "#356FC0", blueLight: "rgba(53,111,192,0.10)",
  gold: "#C58A2A", goldLight: "rgba(197,138,42,0.12)",
  red: "#D64F57", redLight: "rgba(214,79,87,0.10)",
  teal: "#218296", tealLight: "rgba(33,130,150,0.10)",
  purple: "#7657B8", purpleLight: "rgba(118,87,184,0.10)",
  text: "#17231F", textSub: "#43534B", textMuted: "#718078", textFaint: "#9AA69F",
  border: "#E3EBE6",
};
const CG = B.green; const CB = B.blue; const CGo = B.gold; const CR = B.red; const CT = B.teal;
const ATTEND_WEEK = [
  { day: "Mon", present: 0, absent: 0 },
  { day: "Tue", present: 0, absent: 0 },
  { day: "Wed", present: 0, absent: 0 },
  { day: "Thu", present: 0, absent: 0 },
  { day: "Fri", present: 0, absent: 0 },
];

// ─── Glass Card ───────────────────────────────────────────────────────────────
function GlassCard({ children, className = "", hover = false, onClick, style = {} }: {
  children: React.ReactNode; className?: string; hover?: boolean; onClick?: () => void; style?: React.CSSProperties;
}) {
  return (
    <div
      onClick={onClick}
      onKeyDown={onClick ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`portal-card rounded-2xl transition-all duration-200 ${onClick || hover ? "cursor-pointer" : ""} ${className}`}
      style={{ background: B.glass, backdropFilter: B.glassBlur, WebkitBackdropFilter: B.glassBlur,
        border: `1px solid ${B.glassBorder}`, boxShadow: B.glassShadow, ...style }}
      onMouseEnter={e => { if (hover || onClick) (e.currentTarget as HTMLElement).style.boxShadow = B.glassShadowHov; }}
      onMouseLeave={e => { if (hover || onClick) (e.currentTarget as HTMLElement).style.boxShadow = B.glassShadow; }}>
      {children}
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KPICard({ icon: Icon, label, value, sub, accentColor = CG }: {
  icon: ComponentType<{ size?: number; style?: React.CSSProperties }>; label: string; value: string; sub?: string; accentColor?: string;
}) {
  return (
    <div className="portal-kpi-card rounded-2xl overflow-hidden transition-all duration-200"
      style={{ background: B.glass, backdropFilter: B.glassBlur, WebkitBackdropFilter: B.glassBlur,
        border: `1px solid ${B.glassBorder}`, borderTop: `3px solid ${accentColor}`, boxShadow: B.glassShadow }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = B.glassShadowHov}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = B.glassShadow}>
      <div className="p-5">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
          style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}30` }}>
          <Icon size={20} style={{ color: accentColor }} />
        </div>
        <div className="font-bold tracking-tight mb-1" style={{ fontSize: 40, lineHeight: 1, color: B.text, fontFamily: "Inter, sans-serif" }}>{value}</div>
        <div className="text-sm font-semibold mb-1" style={{ color: B.textSub }}>{label}</div>
        {sub && <div className="text-xs" style={{ color: B.textMuted }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── Badges ───────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  "Present":             { bg: "rgba(78,128,80,0.15)",   text: CG  },
  "Absent":              { bg: "rgba(239,68,68,0.12)",    text: CR  },
  "Half Day":            { bg: "rgba(212,160,23,0.15)",   text: "#92700A" },
  "Leave":               { bg: "rgba(37,99,235,0.12)",    text: CB  },
  "Draft":               { bg: "rgba(0,0,0,0.06)",        text: B.textMuted },
  "Pending Approval":   { bg: "rgba(37,99,235,0.12)",    text: CB  },
  "Pending Verification":{ bg: "rgba(124,58,237,0.12)",   text: B.purple },
  "General Manager Approval": { bg: "rgba(37,99,235,0.10)",    text: CB  },
  "MD Approval":         { bg: "rgba(13,116,144,0.12)",   text: CT  },
  "Vice President Review":      { bg: "rgba(78,128,80,0.15)",    text: CG  },
  "Vice Chairman Final Review": { bg: "rgba(78,128,80,0.20)",    text: CG  },
  "Approved":            { bg: "rgba(78,128,80,0.15)",    text: CG  },
  "Passed":              { bg: "rgba(13,116,144,0.12)",   text: CT  },
  "Payment Completed":   { bg: "rgba(78,128,80,0.20)",    text: CG  },
  "Rejected":            { bg: "rgba(239,68,68,0.12)",    text: CR  },
  "Returned for Correction": { bg: "rgba(212,160,23,0.15)", text: "#92700A" },
  "Paid":                { bg: "rgba(78,128,80,0.15)",    text: CG  },
  "Delivered":           { bg: "rgba(78,128,80,0.15)",    text: CG  },
  "Dispatched":          { bg: "rgba(13,116,144,0.12)",   text: CT  },
  "Order Approved":      { bg: "rgba(78,128,80,0.15)",    text: CG  },
  "Pending":             { bg: "rgba(212,160,23,0.15)",   text: "#92700A" },
  "In Transit":          { bg: "rgba(37,99,235,0.12)",    text: CB  },
  "Delayed":             { bg: "rgba(239,68,68,0.12)",    text: CR  },
  "Completed":           { bg: "rgba(78,128,80,0.15)",    text: CG  },
  "Confirmed":           { bg: "rgba(78,128,80,0.20)",    text: CG  },
  "Cancelled":           { bg: "rgba(0,0,0,0.06)",        text: B.textMuted },
  "Active":              { bg: "rgba(78,128,80,0.15)",    text: CG  },
  "Suspended":           { bg: "rgba(239,68,68,0.12)",    text: CR  },
  "Scheduled":           { bg: "rgba(37,99,235,0.12)",    text: CB  },
};

function StatusBadge({ status }: { status?: string }) {
  const displayStatus = status ?? "";
  const s = STATUS_COLORS[displayStatus] ?? { bg: "rgba(0,0,0,0.06)", text: B.textMuted };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.text }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.text }} />
      {displayStatus}
    </span>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const map: Partial<Record<Role, { bg: string; text: string }>> = {
    "Vice Chairman":    { bg: "rgba(78,128,80,0.18)",  text: B.navDark },
    "Vice President":          { bg: "rgba(78,128,80,0.12)",  text: CG },
    "MD-Manufacturing": { bg: "rgba(37,99,235,0.12)",  text: CB },
    "MD-Marketing":     { bg: "rgba(212,160,23,0.15)", text: "#92700A" },
    "MD-Transport":     { bg: "rgba(13,116,144,0.12)", text: CT },
    "MD-RD":            { bg: "rgba(124,58,237,0.12)", text: B.purple },
    "General Manager":  { bg: "rgba(0,0,0,0.07)",      text: B.textSub },
    "Chief Manager":    { bg: "rgba(0,0,0,0.06)",      text: B.textMuted },
    "Manager":          { bg: "rgba(0,0,0,0.05)",      text: B.textMuted },
    "Supervisor":       { bg: "rgba(0,0,0,0.04)",      text: B.textFaint },
    "Worker":           { bg: "rgba(0,0,0,0.04)",      text: B.textFaint },
  };
  const s = map[role] ?? { bg: "rgba(0,0,0,0.06)", text: B.textMuted };
  const label = role.startsWith("MD-") ? `MD – ${MD_DEPT[role]}` : role;
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.text }}>{label}</span>
  );
}

// ─── Buttons ─────────────────────────────────────────────────────────────────
function PrimaryButton({ children, onClick, icon: Icon, size: sz = "md", disabled = false, gold = false, danger = false, type = "button" }: {
  children: React.ReactNode; onClick?: () => void; icon?: ComponentType<{ size?: number; style?: React.CSSProperties }>; size?: "sm" | "md" | "lg";
  disabled?: boolean; gold?: boolean; danger?: boolean; type?: "button" | "submit";
}) {
  const sizes = { sm: "px-3 py-1.5 text-xs gap-1.5", md: "px-4 py-2 text-sm gap-2", lg: "px-5 py-2.5 text-sm gap-2" };
  const bg = danger ? B.red : gold ? B.gold : B.green;
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`portal-button portal-button-primary inline-flex items-center font-semibold text-white rounded-xl transition-all duration-150 ${sizes[sz]} ${disabled ? "opacity-40 cursor-not-allowed" : "hover:opacity-90 active:scale-95"}`}
      style={{ background: disabled ? "#9CA3AF" : bg, fontFamily: "Inter, sans-serif", boxShadow: disabled ? "none" : `0 4px 14px ${bg}40` }}>
      {Icon && <Icon size={sz === "sm" ? 13 : 15} />}
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, icon: Icon, disabled = false, type = "button" }: {
  children: React.ReactNode; onClick?: () => void; icon?: ComponentType<{ size?: number; style?: React.CSSProperties }>; disabled?: boolean; type?: "button" | "submit";
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`portal-button portal-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-150 ${disabled ? "opacity-40 cursor-not-allowed" : "active:scale-95"}`}
      style={{ background: B.glass, backdropFilter: B.glassBlur, WebkitBackdropFilter: B.glassBlur,
        border: `1px solid ${B.glassBorder}`, color: B.textSub, fontFamily: "Inter, sans-serif", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
      {Icon && <Icon size={14} style={{ color: B.textMuted }} />}
      {children}
    </button>
  );
}

function SectionHeader({ title, subtitle, actions }: {
  title: string; subtitle?: string; actions?: React.ReactNode;
}) {
  return (
    <div className="portal-section-header flex items-start justify-between flex-wrap gap-3 mb-6">
      <div>
        <h1 className="font-bold tracking-tight" style={{ fontSize: 28, fontFamily: "Inter, sans-serif", color: B.text, lineHeight: 1.2 }}>{title}</h1>
        {subtitle && <p className="text-sm mt-0.5" style={{ color: B.textMuted }}>{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap items-center">{actions}</div>}
    </div>
  );
}

const TT = {
  background: "rgba(255,255,255,0.85)", backdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.5)", borderRadius: 12, fontSize: 12,
  boxShadow: "0 8px 24px rgba(0,0,0,0.10)", color: B.text,
};

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }: { onLogin?: () => void }) {
  const { login, logout, profileError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  async function doLogin(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setLoginError(null);
    try {
      setLoading(true);
      await login(email.trim(), password);
      onLogin?.();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function sendResetLink(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setResetError(null);
    setResetSuccess(null);
    try {
      setLoading(true);
      if (!email.trim()) throw new Error("Please enter your email address.");
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
      setResetSuccess("Password reset link sent to your email.");
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Unable to send password reset link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="portal-login-screen min-h-screen flex" style={{ background: B.bg }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between p-10 w-96 flex-shrink-0 relative overflow-hidden"
        style={{ background: B.nav }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at top left, rgba(255,255,255,0.10) 0%, transparent 60%)" }} />
        <div className="relative z-10">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-8 overflow-hidden"
            style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", backdropFilter: "blur(10px)" }}>
            <img src={logoSrc} alt="Prajahita Trust logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: "Inter, sans-serif" }}>Prajahita Charitable Trust</h1>
          <p className="text-sm mb-1" style={{ color: "rgba(255,255,255,0.60)" }}>Management Portal</p>
          <p className="text-xs tracking-widest mb-8 font-semibold" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.15em" }}>FAITH · SERVICE · HOPE</p>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.50)" }}>
            Empowering communities through sustainable soap manufacturing, economic inclusion, and serving families across Maharashtra.
          </p>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="portal-login-card rounded-2xl p-8" style={{
            background: "rgba(255,255,255,0.45)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.55)", boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
          }}>
            {!forgot ? (
              <form onSubmit={doLogin} noValidate={false}>
                <h2 className="text-xl font-bold mb-1" style={{ color: B.text }}>Welcome back</h2>
                <p className="text-sm mb-5" style={{ color: B.textMuted }}>Sign in with your Prajahita Trust account</p>
                {profileError && (
                  <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                    <p>{profileError}</p>
                    <button type="button" onClick={() => { void logout().catch((err) => alert(err instanceof Error ? err.message : "Unable to sign out")); }} className="mt-2 font-semibold underline">
                      Sign out and try another account
                    </button>
                  </div>
                )}
                {loginError && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{loginError}</div>}
                <div className="mb-4">
                  <label htmlFor="portal-login-email" className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: B.textMuted }}>Email</label>
                  <input id="portal-login-email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} type="email"
                    autoComplete="username" inputMode="email" required aria-required="true"
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: "rgba(255,255,255,0.50)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }} />
                </div>
                <div className="mb-4">
                  <label htmlFor="portal-login-password" className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: B.textMuted }}>Password</label>
                  <input id="portal-login-password" name="password" value={password} onChange={e => setPassword(e.target.value)} type="password"
                    autoComplete="current-password" required aria-required="true"
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: "rgba(255,255,255,0.50)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }} />
                </div>
                <PrimaryButton type="submit" disabled={loading || !email.trim() || !password} size="lg" icon={loading ? RefreshCw : ArrowRight}>
                  {loading ? "Authenticating…" : "Sign In"}
                </PrimaryButton>
                <button type="button" onClick={() => { setLoginError(null); setForgot(true); }} className="block mt-3 text-sm text-center w-full hover:underline" style={{ color: B.green }}>
                  Forgot password?
                </button>
              </form>
            ) : (
              <>
                <button type="button" onClick={() => setForgot(false)} className="flex items-center gap-1.5 mb-5 text-sm" style={{ color: B.textMuted }}>
                  <ChevronLeft size={16} /> Back
                </button>
                <h2 className="text-xl font-bold mb-2" style={{ color: B.text }}>Reset Password</h2>
                <p className="text-sm mb-4" style={{ color: B.textMuted }}>
                  Enter your email and we will send you a password reset link.
                </p>
                <form onSubmit={sendResetLink}>
                  <label htmlFor="portal-reset-email" className="mb-1.5 block text-xs font-bold uppercase tracking-widest" style={{ color: B.textMuted }}>Email</label>
                  <input
                    id="portal-reset-email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    required
                    placeholder="your@prajahita.org"
                    className="mb-4 w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: "rgba(255,255,255,0.50)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }}
                  />
                  {resetError && <div role="alert" className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{resetError}</div>}
                  {resetSuccess && <div role="status" className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{resetSuccess}</div>}
                  <PrimaryButton type="submit" disabled={loading || !email.trim()} size="lg" icon={Send}>
                    {loading ? "Sending…" : "Send reset link"}
                  </PrimaryButton>
                </form>
              </>
            )}
          </div>
          <p className="text-center mt-4 text-xs" style={{ color: "rgba(0,0,0,0.30)" }}>© {new Date().getFullYear()} Prajahita Charitable Trust</p>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "dashboard",     label: "Dashboard",       icon: LayoutDashboard, minLevel: 1 },
  { id: "attendance",    label: "Attendance",       icon: Calendar,        minLevel: 1, allowedRoles: EMPLOYEE_NAV_ROLES },
  { id: "employees",     label: "Employees",        icon: Users,           minLevel: 1, allowedRoles: EMPLOYEE_NAV_ROLES },
  { id: "department",    label: "Department",       icon: Building2,       minLevel: 1 },
  { id: "leave",         label: "Leave Dashboard",  icon: Calendar,        minLevel: 1 },
  { id: "reports",       label: "Reports",          icon: BarChart2,       minLevel: 3, allowedRoles: ["Manager", "Chief Manager", "General Manager", "Managing Director", "MD-Manufacturing", "MD-Marketing", "MD-Transport", "MD-RD"] as Role[] },
  { id: "notifications", label: "Notifications",    icon: Bell,            minLevel: 1 },
  { id: "profile",       label: "My Profile",        icon: User,            minLevel: 1 },
  { id: "bills",         label: "Bill Management",  icon: FileText,        minLevel: 3, allowedRoles: MANAGEMENT_NAV_ROLES },
  { id: "orders",        label: "Orders",            icon: ShoppingCart,    minLevel: 1, allowedRoles: DEPARTMENT_MODULE_ROLES, requiredDepartment: "Marketing" },
  { id: "transport",     label: "Transport",        icon: Truck,           minLevel: 1, allowedRoles: DEPARTMENT_MODULE_ROLES, requiredDepartment: "Transport" },
  { id: "admin",         label: "Admin / RBAC",     icon: Shield,          adminOnly: true },
  { id: "audit",          label: "Audit Log",         icon: ClipboardList,   adminOnly: true },
];

function navAccess(item: typeof NAV_ITEMS[0], user: AppUser): boolean {
  if (item.adminOnly) return canViewAdmin(user.role);
  if (item.allowedRoles && !item.allowedRoles.includes(user.role)) return false;
  if (item.id === "reports" && !canViewReports(user.role)) return false;
  const requiredDepartment = (item as { requiredDepartment?: string }).requiredDepartment;
  if (requiredDepartment && !canAccessDepartmentModule(user.department, requiredDepartment)) return false;
  const lvl = ROLE_LEVEL[user.role];
  return lvl >= (item.minLevel ?? 1);
}

function Sidebar({ user, page, onNav, collapsed, onToggle, mobile, mobileOpen, onMobileClose, onViewProfile }: {
  user: AppUser; page: Page; onNav: (p: Page) => void; collapsed: boolean; onToggle: () => void;
  mobile: boolean; mobileOpen: boolean; onMobileClose: () => void; onViewProfile?: () => void;
}) {
  const { logout } = useAuth();
  const roleLabel = user.role.startsWith("MD-") ? `MD – ${MD_DEPT[user.role]}` : user.role;
  const visibleNavItems = NAV_ITEMS.filter((item) => (!("visible" in item) || item.visible !== false) && navAccess(item, user));

  const content = (
    <div className="flex flex-col h-full relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at top left, rgba(255,255,255,0.08) 0%, transparent 55%)" }} />

      {/* Brand */}
      <div className="relative z-10 flex-shrink-0 px-4 pt-5 pb-4" style={{ borderBottom: `1px solid ${B.navBorder}` }}>
        <div className="portal-sidebar-brand flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.28)", backdropFilter: "blur(10px)" }}>
            <img src={logoSrc} alt="Prajahita logo" className="w-full h-full object-cover" />
          </div>
          {(!collapsed || mobile) && (
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white leading-tight">Prajahita Trust</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Management Portal</div>
            </div>
          )}
          {!mobile && (
            <button type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={onToggle} className="ml-auto flex-shrink-0" style={{ color: "rgba(255,255,255,0.35)" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "white"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)"}>
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          )}
          {mobile && <button type="button" aria-label="Close navigation" onClick={onMobileClose} style={{ color: "rgba(255,255,255,0.5)" }}><X size={18} /></button>}
        </div>
        {(!collapsed || mobile) && (
          <div className="mt-3 pt-3 text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.09)" }}>
            <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.28)", letterSpacing: "0.14em" }}>
              FAITH · SERVICE · HOPE
            </span>
          </div>
        )}
      </div>

      {/* User chip */}
      <div className="relative z-10 px-3 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${B.navBorder}` }}>
        <button
          type="button"
          onClick={() => { onViewProfile?.(); if (mobile) onMobileClose(); }}
          className="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-xl text-left"
          style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(8px)" }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.22)", border: "1px solid rgba(255,255,255,0.30)" }}>
            {user.avatar}
          </div>
          {(!collapsed || mobile) && (
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{user.name}</div>
              <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.45)" }}>{roleLabel}</div>
            </div>
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
        {visibleNavItems.map(item => {
          const active = page === item.id || (item.id === "employees" && page === "organization");
          return (
            <button type="button" key={item.id} aria-current={active ? "page" : undefined}
              onClick={() => { onNav(item.id as Page); if (mobile) onMobileClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150"
              style={{
                background: active ? B.navAct : "transparent",
                boxShadow: active ? "0 2px 12px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.18)" : "none",
                backdropFilter: active ? "blur(8px)" : "none",
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <item.icon size={17} style={{ color: active ? "white" : B.navTxt, flexShrink: 0 }} />
              {(!collapsed || mobile) && (
                <>
                  <span className="text-sm flex-1 font-medium" style={{ color: active ? "white" : B.navTxt }}>{item.label}</span>
                  {active && <div className="w-1.5 h-4 rounded-full" style={{ background: CGo, boxShadow: `0 0 8px ${CGo}` }} />}
                </>
              )}
            </button>
          );
        })}
      </nav>

      <div className="relative z-10 px-2.5 py-3 flex-shrink-0" style={{ borderTop: `1px solid ${B.navBorder}` }}>
        <button type="button" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
          style={{ color: "rgba(255,255,255,0.38)" }}
          onClick={() => { void logout().catch((err) => alert(err instanceof Error ? err.message : "Unable to sign out")); }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "white"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.38)"; }}>
          <LogOut size={16} />
          {(!collapsed || mobile) && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>
    </div>
  );

  if (mobile) return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onMobileClose} />}
      <aside className={`portal-sidebar fixed left-0 top-0 h-full w-64 z-50 transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: B.nav }}>{content}</aside>
    </>
  );

  return (
    <aside className={`portal-sidebar hidden md:flex flex-col flex-shrink-0 h-full transition-all duration-300 ${collapsed ? "w-[60px]" : "w-64"}`}
      style={{ background: B.nav }}>{content}</aside>
  );
}

// ─── TopBar ───────────────────────────────────────────────────────────────────
function TopBar({ user, onMenuClick, onNav, notifCount, onNotifClick, onViewProfile }: {
  user: AppUser; onMenuClick: () => void; onNav: (page: Page) => void; notifCount: number; onNotifClick: () => void; onViewProfile: () => void;
}) {
  const { logout } = useAuth();
  const roleLabel = user.role.startsWith("MD-") ? `MD – ${MD_DEPT[user.role]}` : user.role;
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchResults = NAV_ITEMS
    .filter((item) => navAccess(item, user) && item.label.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    .slice(0, 6);
  const runModuleSearch = (target?: Page) => {
    if (!target) return;
    onNav(target);
    setSearchQuery("");
    setSearchOpen(false);
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuWidth = 288;
    const menuHeight = 220;
    setMenuPosition({
      top: Math.max(16, Math.min(rect.bottom + 8, window.innerHeight - menuHeight - 16)),
      left: Math.max(16, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 16)),
    });
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.closest("[data-profile-menu]") || target.closest("[data-profile-menu-content]"))) return;
      setMenuOpen(false);
    };
    const handleResize = () => updateMenuPosition();
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    updateMenuPosition();
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [menuOpen]);

  return (
    <header className="portal-topbar flex items-center gap-3 px-5 flex-shrink-0 overflow-visible"
      style={{ background: "rgba(255,255,255,0.30)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.40)", height: 64, boxShadow: "0 2px 16px rgba(0,0,0,0.05)", overflow: "visible" }}>
      <button type="button" aria-label="Open navigation" onClick={onMenuClick} className="md:hidden p-2 rounded-xl hover:bg-white/20" style={{ color: B.text }}>
        <Menu size={20} />
      </button>
      <div className="portal-global-search relative flex-1 max-w-md" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSearchOpen(false); }}>
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl"
          style={{ background: "#F7FAF8", border: "1px solid #E3EBE6", boxShadow: "inset 0 1px 2px rgba(22,45,35,0.025)" }}>
          <Search size={15} style={{ color: B.textFaint }} />
          <input
            aria-label="Find a portal module"
            aria-controls="portal-module-search-results"
            aria-expanded={searchOpen && Boolean(searchQuery.trim())}
            placeholder="Find a module…"
            value={searchQuery}
            onFocus={() => setSearchOpen(true)}
            onChange={(event) => { setSearchQuery(event.target.value); setSearchOpen(true); }}
            onKeyDown={(event) => {
              if (event.key === "Enter") { event.preventDefault(); runModuleSearch(searchResults[0]?.id as Page | undefined); }
              if (event.key === "Escape") { setSearchOpen(false); setSearchQuery(""); }
            }}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: B.text }}
          />
          {searchQuery && <button type="button" aria-label="Clear module search" onClick={() => setSearchQuery("")} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X size={13} /></button>}
        </div>
        {searchOpen && searchQuery.trim() && (
          <div id="portal-module-search-results" role="listbox" aria-label="Matching modules" className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
            {searchResults.length ? searchResults.map((item) => (
              <button type="button" key={item.id} role="option" aria-selected="false"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runModuleSearch(item.id as Page)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-900">
                <item.icon size={15} className="text-emerald-700" />
                <span>{item.label}</span>
              </button>
            )) : <p className="px-3 py-3 text-xs text-slate-500">No matching modules available for your role.</p>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <button type="button" aria-label={`Open notifications${notifCount ? `, ${notifCount} unread` : ""}`} onClick={onNotifClick} className="relative p-2 rounded-xl transition-colors hover:bg-white/20"
          style={{ border: "1px solid rgba(255,255,255,0.40)", background: "rgba(255,255,255,0.25)", backdropFilter: "blur(10px)" }}>
          <Bell size={17} style={{ color: B.textSub }} />
          {notifCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white font-bold flex items-center justify-center"
              style={{ background: B.red, fontSize: 9 }}>{notifCount}</span>
          )}
        </button>
        <div className="relative overflow-visible" data-profile-menu>
          <button type="button" ref={triggerRef} aria-label="Open account menu" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => {
            if (menuOpen) {
              setMenuOpen(false);
              return;
            }
            setMenuOpen(true);
            requestAnimationFrame(() => updateMenuPosition());
          }} className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl"
            style={{ background: "rgba(255,255,255,0.30)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.45)" }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: B.nav }}>
              {user.avatar}
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-semibold" style={{ color: B.text }}>{user.name.split(" ")[0]}</div>
              <div className="text-xs" style={{ color: B.textMuted }}>{roleLabel}</div>
            </div>
            <ChevronDown size={13} style={{ color: B.textFaint }} />
          </button>
          {menuOpen && createPortal(
            <div data-profile-menu-content role="menu" aria-label="Account options" className="w-72 rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl" style={{ position: "fixed", top: menuPosition.top, left: menuPosition.left, zIndex: 2147483647 }}>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-sm font-semibold text-slate-900">{user.name}</div>
                <div className="text-xs mt-1 text-slate-500">Employee ID: {user.employeeId ?? user.id}</div>
                <div className="text-xs mt-1 text-slate-500">Role: {user.role}</div>
                <div className="text-xs mt-1 text-slate-500">Department: {user.department}</div>
              </div>
              <div className="mt-2 space-y-1">
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onViewProfile(); }} className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-50">
                  <User size={14} /> Profile
                </button>
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); void logout().catch((err) => alert(err instanceof Error ? err.message : "Unable to sign out")); }} className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50">
                  <LogOut size={14} /> Logout
                </button>
              </div>
            </div>,
            document.body,
          )}
        </div>
      </div>
    </header>
  );
}

// ─── Communication flow notice ────────────────────────────────────────────────
function CommFlowNotice({ role }: { role: Role }) {
  const levelMap: Partial<Record<Role, string>> = {
    "Worker": "Supervisor", "Supervisor": "Manager", "Manager": "Chief Manager",
    "Chief Manager": "General Manager", "General Manager": "Managing Director",
  };
  const reportTo = levelMap[role];
  if (!reportTo) return null;
  return (
    <div className="p-4 rounded-2xl flex items-start gap-3 mb-1"
      style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)" }}>
      <AlertTriangle size={16} style={{ color: CR, flexShrink: 0, marginTop: 2 }} />
      <div>
        <p className="text-sm font-semibold" style={{ color: CR }}>Communication Restriction</p>
        <p className="text-xs mt-0.5" style={{ color: B.textMuted }}>
          As {role}, you must communicate exclusively through your {reportTo}. Direct contact with Vice Chairman or Vice President is not permitted.
        </p>
      </div>
    </div>
  );
}

// ─── VC / Vice President Dashboard ────────────────────────────────────────────
function VCDashboard({ user, stats }: { user: AppUser; stats: DashboardStats }) {
  const { pendingBills } = useBills();
  const { programs } = usePrograms();
  const { summary } = useAttendance();
  const [communityData, setCommunityData] = useState<CommunityData[]>([]);
  const [attendanceTrend, setAttendanceTrend] = useState<AttendanceDay[]>([]);
  const [pieData, setPieData] = useState<AttendanceBreakdown[]>([]);

  useEffect(() => {
    let active = true;

    async function loadDashboardCharts() {
      const [community, weekly, breakdown] = await Promise.all([
        getCommunityImpactData(),
        getWeeklyAttendanceData(),
        getAttendanceBreakdownData(CG, CR, CGo, CB),
      ]);

      if (!active) return;
      setCommunityData(community);
      setAttendanceTrend(weekly);
      setPieData(breakdown);
    }

    void loadDashboardCharts();

    return () => {
      active = false;
    };
  }, []);

  const attendancePieData = pieData.length > 0 ? pieData : [
    { name: "Present", value: summary.present, color: CG },
    { name: "Absent", value: summary.absent, color: CR },
    { name: "Half Day", value: summary.halfDay, color: CGo },
    { name: "Leave", value: summary.onLeave, color: CB },
  ];

  const communitySummary = communityData.reduce(
    (acc, item) => ({
      beneficiaries: acc.beneficiaries + Number(item.beneficiaries || 0),
      volunteers: acc.volunteers + Number(item.volunteers || 0),
      communities: acc.communities + Number(item.communities || 0),
    }),
    { beneficiaries: 0, volunteers: 0, communities: 0 }
  );
  const todayLabel = getTodayLabel();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold" style={{ fontSize: 36, fontFamily: "Inter, sans-serif", color: B.text, lineHeight: 1.15 }}>
            Welcome Back, {user.name.split(" ")[0]}
          </h1>
          <p className="text-base mt-1 font-medium" style={{ color: B.green }}>Supporting Communities Through Service</p>
          <p className="text-sm mt-0.5" style={{ color: B.textMuted }}>{todayLabel} · All Departments</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: B.textMuted }}>Trust Operations</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon={Users}        label="Staff Present Today"    value={String(stats.activeEmployees)} sub={`${Math.round((stats.activeEmployees / Math.max(stats.totalEmployees, 1)) * 100)}% active`} accentColor={CG}  />
          <KPICard icon={FileText}     label="Bills Pending Approval"  value={String(stats.pendingBills)}  sub={`₹${stats.monthlyRevenue.toLocaleString()} tracked`}         accentColor={CGo} />
          <KPICard icon={ShoppingCart} label="Pending Approvals"       value={String(stats.pendingApprovals)} sub="Orders awaiting approval"       accentColor={CB}  />
          <KPICard icon={DollarSign}   label="Monthly Revenue"         value={`₹${stats.monthlyRevenue.toLocaleString()}`} sub="Aggregated from bills"    accentColor={CT}  />
        </div>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: B.textMuted }}>Community Impact — {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon={Heart}     label="Beneficiaries Served"  value={communitySummary.beneficiaries.toLocaleString()} sub="Live from program impact" accentColor={CR}  />
          <KPICard icon={Handshake} label="Active Programs"        value={String(communityData.length || 0)} sub="Recorded impact entries" accentColor={CGo} />
          <KPICard icon={Users}     label="Volunteer Participants" value={communitySummary.volunteers.toLocaleString()} sub="Live from program impact" accentColor={CG}  />
          <KPICard icon={Globe2}    label="Communities Reached"    value={communitySummary.communities.toLocaleString()} sub="Live from program impact" accentColor={CB}  />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <GlassCard className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-base" style={{ color: B.text }}>Orders & Deliveries</h3>
              <p className="text-xs mt-0.5" style={{ color: B.textMuted }}>Jan – Jul 2025</p>
            </div>
            
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.revenueTrend}>
              <defs>
                <linearGradient id="vc-gO" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={CB} stopOpacity={0.18}/>
                  <stop offset="95%" stopColor={CB} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="vc-gD" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={CG} stopOpacity={0.18}/>
                  <stop offset="95%" stopColor={CG} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: B.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: B.textMuted }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TT} />
              <Area id="vc-orders"    type="monotone" dataKey="orders"    stroke={CB} fill="url(#vc-gO)" strokeWidth={2} name="Orders" />
              <Area id="vc-delivered" type="monotone" dataKey="delivered" stroke={CG} fill="url(#vc-gD)" strokeWidth={2} name="Delivered" />
              <Legend iconSize={8} iconType="circle" />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="font-semibold text-base mb-1" style={{ color: B.text }}>Staff Attendance</h3>
          <p className="text-xs mb-4" style={{ color: B.textMuted }}>Today — all departments</p>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={attendancePieData} cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={3} dataKey="value">
                {attendancePieData.map((d, i) => <Cell key={`att-${i}`} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={TT} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {attendancePieData.map(d => (
              <div key={d.name} className="flex items-center gap-2 text-xs" style={{ color: B.textMuted }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                <span>{d.name} <span className="font-semibold" style={{ color: B.text }}>{d.value}%</span></span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-base" style={{ color: B.text }}>Monthly Community Impact</h3>
              <p className="text-xs mt-0.5" style={{ color: B.textMuted }}>Beneficiaries & Volunteer Participation</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: B.greenLight, color: CG }}>↑ 6.6% MoM</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={communityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: B.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: B.textMuted }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TT} />
              <Bar id="vc-ben" dataKey="beneficiaries" fill={CB}  radius={[4,4,0,0]} name="Beneficiaries" />
              <Bar id="vc-vol" dataKey="volunteers"    fill={CGo} radius={[4,4,0,0]} name="Volunteers" />
              <Legend iconSize={8} iconType="circle" />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-base" style={{ color: B.text }}>Bills Pending Approval</h3>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: B.redLight, color: CR }}>{pendingBills.length} Pending</span>
          </div>
          {pendingBills.slice(0, 4).map((bill, i, arr) => (
            <div key={bill.ref} className="flex items-center gap-3 py-3"
              style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: B.goldLight }}>
                <FileText size={15} style={{ color: CGo }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: B.text }}>{bill.ref}</div>
                <div className="text-xs truncate" style={{ color: B.textMuted }}>{bill.vendor} · {bill.department}</div>
              </div>
              <div className="text-right flex-shrink-0 mr-2">
                <div className="text-sm font-bold" style={{ color: B.text }}>₹{bill.amount.toLocaleString()}</div>
                <div className="text-xs" style={{ color: B.textMuted }}>{bill.status}</div>
              </div>
              <PrimaryButton size="sm" icon={FileText} onClick={() => navigateDashboardAction("/bills")}>Review</PrimaryButton>
            </div>
          ))}
        </GlassCard>
      </div>

      {/* Outreach */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: B.textMuted }}>Active Outreach Programs</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {programs.map(p => (
            <div key={p.id} className="p-4 rounded-2xl transition-all duration-200"
              style={{ background: B.glass, backdropFilter: B.glassBlur, WebkitBackdropFilter: B.glassBlur,
                border: `1px solid ${B.glassBorder}`, borderLeft: `3px solid ${CG}`, boxShadow: B.glassShadow }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-semibold leading-snug" style={{ color: B.text }}>{p.title}</p>
                <StatusBadge status={p.status} />
              </div>
              <div className="flex items-center gap-3 mt-3 text-xs" style={{ color: B.textMuted }}>
                <span className="flex items-center gap-1"><Calendar size={11} /> {new Date(p.start_date).toLocaleDateString()}</span>
                <span className="flex items-center gap-1"><Users size={11} /> {p.location}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MD Dashboard ─────────────────────────────────────────────────────────────
function MDDashboard({ user, stats }: { user: AppUser; stats: DashboardStats }) {
  const dept = MD_DEPT[user.role] ?? user.department;
  const deptIcons: Record<string, ComponentType<{ size?: number }>> = {
    "Manufacturing": Building2, "Marketing": ShoppingCart,
    "Transport": Truck, "Research & Development": FlaskConical,
  };
  const DIcon = deptIcons[dept] ?? Layers;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold" style={{ fontSize: 36, fontFamily: "Inter, sans-serif", color: B.text, lineHeight: 1.15 }}>
            {dept} Division
          </h1>
          <p className="text-sm mt-0.5 font-medium" style={{ color: B.green }}>MD Operations Dashboard · Prajahita Trust</p>
          <p className="text-sm" style={{ color: B.textMuted }}>{getTodayLabel()} · {user.name}</p>
        </div>
        {/* Future task module actions are disabled for now.
        <div className="flex gap-2">
          <SecondaryButton icon={MessageSquare}>Message Vice President</SecondaryButton>
          <PrimaryButton icon={Plus}>New Request</PrimaryButton>
        </div>
        */}
      </div>

      {/* Future MD communication escalation block disabled for now.
      <div className="p-4 rounded-2xl flex items-start gap-3"
        style={{ background: "rgba(78,128,80,0.08)", border: "1px solid rgba(78,128,80,0.18)" }}>
        <ArrowUpRight size={16} style={{ color: CG, flexShrink: 0, marginTop: 2 }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: CG }}>Direct Escalation Enabled</p>
          <p className="text-xs mt-0.5" style={{ color: B.textMuted }}>
            As Managing Director, you are authorised to communicate directly with the Vice Chairman and Vice President. All subordinate roles must escalate through you.
          </p>
        </div>
      </div>
      */}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Users}    label="Team Present Today"     value={String(stats.activeEmployees)} sub="Live from profiles"    accentColor={CG}  />
        <KPICard icon={FileText} label="Bills Awaiting Review"  value={String(stats.pendingBills)} sub={`₹${stats.monthlyRevenue.toLocaleString()} tracked`}       accentColor={CGo} />
        {/* Future task KPI card disabled for now.
        <KPICard icon={DIcon}    label={`${dept} Tasks`}        value={String(stats.totalRoles)} sub="Roles configured"           accentColor={CB}  />
        */}
        <KPICard icon={Activity} label="Dept. Attendance Rate"  value={`${Math.round((stats.activeEmployees / Math.max(stats.totalEmployees, 1)) * 100)}%`} sub="Based on active profiles"   accentColor={CT}  />
      </div>

      <div className="grid grid-cols-1 gap-5">
        <GlassCard className="p-5">
          <h3 className="font-semibold text-base mb-1" style={{ color: B.text }}>Monthly Revenue Trend — {dept}</h3>
          <p className="text-xs mb-4" style={{ color: B.textMuted }}>Jan – Jul 2025</p>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={stats.revenueTrend.length > 0 ? stats.revenueTrend : []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: B.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: B.textMuted }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
              <Tooltip contentStyle={TT} formatter={(v: any) => [`₹${v.toLocaleString()}`, "Revenue"]} />
              <Line id="md-rev" type="monotone" dataKey="revenue" stroke={CG} strokeWidth={2.5} dot={{ fill: CG, r: 4, strokeWidth: 0 }} name="Revenue" />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>
    </div>
  );
}

// ─── GM Dashboard ─────────────────────────────────────────────────────────────
function GMDashboard({ user, stats }: { user: AppUser; stats: DashboardStats }) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-bold" style={{ fontSize: 36, fontFamily: "Inter, sans-serif", color: B.text, lineHeight: 1.15 }}>General Manager</h1>
        <p className="text-sm mt-0.5 font-medium" style={{ color: B.green }}>{user.department} Department · {user.name}</p>
        <p className="text-sm" style={{ color: B.textMuted }}>{getTodayLabel()}</p>
      </div>
      {/* Future communication restriction notice disabled for now.
      <CommFlowNotice role={user.role} />
      */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Users}       label="Team Present"        value={String(stats.activeEmployees)}  sub="From active profiles"         accentColor={CG}  />
        <KPICard icon={FileText}    label="Bills to Review"     value={String(stats.pendingBills)}   sub="Current pending bills"        accentColor={CGo} />
        <KPICard icon={CheckCircle} label="Bills Approved Today" value={String(stats.approvedBills)} sub="Approved bills count"  accentColor={CB}  />
        {/* Future task KPI card disabled for now.
        <KPICard icon={Activity}    label="Active CM Tasks"     value={String(stats.totalRoles)}  sub="Configured roles"         accentColor={CT}  />
        */}
      </div>
      <GlassCard className="p-5">
        <h3 className="font-semibold text-base mb-4" style={{ color: B.text }}>Weekly Attendance — {user.department}</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={stats.weeklyAttendance.length > 0 ? stats.weeklyAttendance : ATTEND_WEEK}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: B.textMuted }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: B.textMuted }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TT} />
            <Bar id="gm-pres" dataKey="present" fill={CG} radius={[4,4,0,0]} name="Present" />
            <Bar id="gm-abs"  dataKey="absent"  fill={CR} radius={[4,4,0,0]} name="Absent" />
            <Legend iconSize={8} iconType="circle" />
          </BarChart>
        </ResponsiveContainer>
      </GlassCard>
    </div>
  );
}

// ─── Chief Manager Dashboard ──────────────────────────────────────────────────
function CMDashboard({ user, stats }: { user: AppUser; stats: DashboardStats }) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-bold" style={{ fontSize: 36, fontFamily: "Inter, sans-serif", color: B.text, lineHeight: 1.15 }}>Chief Manager</h1>
        <p className="text-sm mt-0.5 font-medium" style={{ color: B.green }}>{user.department} Department · {user.name}</p>
        <p className="text-sm" style={{ color: B.textMuted }}>{getTodayLabel()}</p>
      </div>
      {/* Future communication restriction notice disabled for now.
      <CommFlowNotice role={user.role} />
      */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard icon={Users}    label="Managers Under You"   value={String(stats.managerCount)}  sub="Reports to you"            accentColor={CG}  />
        <KPICard icon={Calendar} label="Team Attendance Today" value={`${Math.round((stats.activeEmployees / Math.max(stats.totalEmployees, 1)) * 100)}%`} sub="Based on active profiles"   accentColor={CB}  />
        <KPICard icon={ClipboardList} label="Active Operations" value={String(stats.approvedBills)} sub="Approved bills"   accentColor={CGo} />
      </div>
      <GlassCard className="p-5">
        <h3 className="font-semibold text-base mb-4" style={{ color: B.text }}>Team Responsibilities</h3>
        {stats.teamResponsibilities.length === 0 ? (
          <p className="text-sm" style={{ color: B.textMuted }}>No direct reports found.</p>
        ) : stats.teamResponsibilities.map((member, i, arr) => (
          <div key={member.id} className="flex items-center gap-3 py-3"
            style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: B.nav }}>{member.name.split(" ").map(w => w[0]).join("")}</div>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: B.text }}>{member.name}</div>
              <div className="text-xs" style={{ color: B.textMuted }}>{member.role} · {member.department}</div>
            </div>
            <StatusBadge status={member.status} />
          </div>
        ))}
      </GlassCard>
    </div>
  );
}

// ─── Manager Dashboard ────────────────────────────────────────────────────────
function ManagerDashboard({ user, stats }: { user: AppUser; stats: DashboardStats }) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-bold" style={{ fontSize: 36, fontFamily: "Inter, sans-serif", color: B.text, lineHeight: 1.15 }}>
          Good morning, {user.name.split(" ")[0]} 👋
        </h1>
        <p className="text-sm mt-0.5 font-medium" style={{ color: B.green }}>Manager · {user.department}</p>
        <p className="text-sm" style={{ color: B.textMuted }}>{getTodayLabel()}</p>
      </div>
      {/* Future communication restriction notice disabled for now.
      <CommFlowNotice role={user.role} />
      */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Users}       label="Supervisors Under You" value={String(stats.supervisorCount)}  sub="Reports to you"         accentColor={CG}  />
        <KPICard icon={Calendar}    label="Team Attendance"       value={`${Math.round((stats.activeEmployees / Math.max(stats.totalEmployees, 1)) * 100)}%`} sub="Based on profiles" accentColor={CB}  />
        <KPICard icon={FileText}    label="Bills Submitted"       value={String(stats.pendingBills)}  sub="Current pending"         accentColor={CGo} />
        {/* Future task KPI card disabled for now.
        <KPICard icon={Activity}    label="Daily Tasks"           value={String(stats.approvedBills)} sub="Approved bills"           accentColor={CT}  />
        */}
      </div>
      <GlassCard>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <h2 className="font-semibold text-base" style={{ color: B.text }}>Quick Actions</h2>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: FileText,  label: "Submit Bill",    desc: "Expense reimbursement", color: CB, path: "/bills" },
            { icon: Calendar,  label: "Apply Leave",    desc: "Request time off",       color: CGo, path: "/leave" },
            { icon: Users,     label: "Team Attendance",desc: "Mark for your team",     color: CG, path: "/attendance" },
            { icon: Bell,      label: "Notifications",  desc: "View updates",           color: CR, path: "/notifications" },
          ].map(a => (
            <button type="button" key={a.label} className="flex flex-col items-center gap-2.5 p-4 rounded-xl text-center transition-all duration-200"
              onClick={() => navigateDashboardAction(a.path)}
              style={{ border: "1px solid rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.20)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: `${a.color}18`, border: `1px solid ${a.color}30` }}>
                <a.icon size={20} style={{ color: a.color }} />
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: B.text }}>{a.label}</div>
                <div className="text-xs" style={{ color: B.textMuted }}>{a.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Supervisor Dashboard ─────────────────────────────────────────────────────
function SupervisorDashboard({ user, stats }: { user: AppUser; stats: DashboardStats }) {
  const attendanceRows = stats.supervisorAttendanceRows ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-bold" style={{ fontSize: 36, fontFamily: "Inter, sans-serif", color: B.text, lineHeight: 1.15 }}>
          Good morning, {user.name.split(" ")[0]} 👋
        </h1>
        <p className="text-sm mt-0.5 font-medium" style={{ color: B.green }}>Supervisor · {user.department}</p>
        <p className="text-sm" style={{ color: B.textMuted }}>{getTodayLabel()}</p>
      </div>
      {/* Future communication restriction notice disabled for now.
      <CommFlowNotice role={user.role} />
      */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Users} label="Workers Under Me" value={String(stats.supervisorWorkersCount)} sub="Direct reports" accentColor={CG} />
        <KPICard icon={CheckCircle} label="Present Today" value={String(stats.supervisorPresentCount)} sub="Attendance recorded" accentColor={CG} />
        <KPICard icon={XCircle} label="Absent Today" value={String(stats.supervisorAbsentCount)} sub="No attendance record" accentColor={CR} />
        <KPICard icon={Clock} label="Half Day" value={String(stats.supervisorHalfDayCount)} sub="Partial attendance" accentColor={CGo} />
      </div>
      <GlassCard className="overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <h2 className="font-semibold text-base" style={{ color: B.text }}>Today Attendance</h2>
          <p className="text-xs mt-0.5" style={{ color: B.textMuted }}>Live data from attendance records</p>
        </div>
        {attendanceRows.length === 0 ? (
          <div className="px-5 py-6 text-sm" style={{ color: B.textMuted }}>No attendance records found</div>
        ) : attendanceRows.map((row: { id: string; employeeId: string; employeeName: string; status: string; checkIn: string }, i: number, arr: Array<{ id: string; employeeId: string; employeeName: string; status: string; checkIn: string }>) => (
          <div key={row.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/10"
            style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: B.nav }}>{row.employeeName.split(" ").map((x: string) => x[0]).join("").slice(0, 2)}</div>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: B.text }}>{row.employeeName}</div>
              <div className="text-xs" style={{ color: B.textMuted }}>{row.employeeId}</div>
            </div>
            <span className="text-xs mr-3" style={{ color: B.textMuted, fontFamily: "monospace" }}>{row.checkIn}</span>
            <StatusBadge status={row.status} />
          </div>
        ))}
      </GlassCard>
    </div>
  );
}

// ─── Worker Dashboard ─────────────────────────────────────────────────────────
function WorkerDashboard({ user, stats }: { user: AppUser; stats: DashboardStats }) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-bold" style={{ fontSize: 36, fontFamily: "Inter, sans-serif", color: B.text, lineHeight: 1.15 }}>
          Good morning, {user.name.split(" ")[0]} 👋
        </h1>
        <p className="text-sm mt-1" style={{ color: B.textMuted }}>{getTodayLabel()} · {user.department} Department</p>
      </div>
      {/* Future communication restriction notice disabled for now.
      <CommFlowNotice role="Worker" />
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl overflow-hidden"
          style={{ background: B.glass, backdropFilter: B.glassBlur, WebkitBackdropFilter: B.glassBlur,
            border: `1px solid ${B.glassBorder}`, borderTop: `3px solid ${CG}`, boxShadow: B.glassShadow }}>
          <div className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${CG}18`, border: `1px solid ${CG}30` }}>
              <CheckCircle size={22} style={{ color: CG }} />
            </div>
            <div>
              <div className="font-bold" style={{ fontSize: 28, color: B.text, lineHeight: 1.1 }}>{stats.todayAttendanceStatus === "Present" ? "Present" : stats.todayAttendanceStatus === "Absent" ? "Absent" : "Not Marked"}</div>
              <div className="text-sm font-medium mt-0.5" style={{ color: B.textSub }}>Today's Attendance Status</div>
              <div className="text-xs mt-0.5" style={{ color: B.textMuted }}>{stats.todayAttendanceStatus === "Present" ? "Attendance recorded today" : "No attendance record today"}</div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl overflow-hidden"
          style={{ background: B.glass, backdropFilter: B.glassBlur, WebkitBackdropFilter: B.glassBlur,
            border: `1px solid ${B.glassBorder}`, borderTop: `3px solid ${CB}`, boxShadow: B.glassShadow }}>
          <div className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${CB}18`, border: `1px solid ${CB}30` }}>
              <Calendar size={22} style={{ color: CB }} />
            </div>
            <div>
              <div className="font-bold" style={{ fontSize: 28, color: B.text, lineHeight: 1.1 }}>{stats.leaveBalance}</div>
              <div className="text-sm font-medium mt-0.5" style={{ color: B.textSub }}>Leave Balance Remaining</div>
              <div className="text-xs mt-0.5" style={{ color: B.textMuted }}>Taken: {stats.leaveTaken}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Future assigned work widget disabled for now.
      <GlassCard>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <h2 className="font-semibold text-base" style={{ color: B.text }}>Assigned Work — Today</h2>
          <p className="text-xs mt-0.5" style={{ color: B.textMuted }}>Tasks assigned by your Supervisor</p>
        </div>
        {[
          { task: "Batch QC check — Neem Fresh 500g",     priority: "High",   status: "Pending",  time: "09:00 AM" },
          { task: "Soap moulding — Line 3",               priority: "Medium", status: "Completed",time: "10:30 AM" },
          { task: "Inventory count — Raw materials store", priority: "Low",   status: "Pending",  time: "02:00 PM" },
          { task: "End-of-day cleaning — Section B",       priority: "Low",   status: "Pending",  time: "05:00 PM" },
        ].map((w, i, arr) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-white/10"
            style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: B.text }}>{w.task}</div>
              <div className="text-xs mt-0.5" style={{ color: B.textMuted }}>Due: {w.time}</div>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full mr-2"
              style={{ background: w.priority === "High" ? B.redLight : w.priority === "Medium" ? B.goldLight : "rgba(0,0,0,0.05)",
                color: w.priority === "High" ? CR : w.priority === "Medium" ? CGo : B.textMuted }}>
              {w.priority}
            </span>
            <StatusBadge status={w.status} />
          </div>
        ))}
      </GlassCard>
      */}

      {/* Attendance History */}
      <GlassCard>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <h2 className="font-semibold text-base" style={{ color: B.text }}>Attendance History</h2>
          <p className="text-xs mt-0.5" style={{ color: B.textMuted }}>Your recent attendance records</p>
        </div>
        {stats.attendanceHistory.length === 0 ? (
          <div className="px-5 py-4 text-sm" style={{ color: B.textMuted }}>No attendance history found.</div>
        ) : stats.attendanceHistory.map((record, i, arr) => (
          <div key={record.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/10"
            style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: B.text }}>{record.date}</div>
              <div className="text-xs" style={{ color: B.textMuted }}>Check in: {record.checkIn} · Check out: {record.checkOut}</div>
            </div>
            <StatusBadge status={record.status} />
          </div>
        ))}
      </GlassCard>

      {/* Quick actions */}
      <GlassCard>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <h2 className="font-semibold text-base" style={{ color: B.text }}>Quick Actions</h2>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {[
            { icon: Calendar, label: "Attendance",      desc: "View attendance",       color: CG, path: "/attendance" },
            { icon: Calendar, label: "Apply Leave",     desc: "Submit leave request", color: CGo, path: "/leave" },
            { icon: Users,    label: "Employee Directory", desc: "View employees",    color: CB, path: "/employees" },
            { icon: FileText, label: "Bills",           desc: "Submit a bill",        color: CT, path: "/bills" },
            ...(user.department === "Transport" ? [{ icon: Truck, label: "Transport", desc: "View transport", color: CT, path: "/transport" }] : []),
            ...(user.department === "Marketing" ? [{ icon: ShoppingCart, label: "Orders", desc: "View orders", color: CB, path: "/orders" }] : []),
            ...(ROLE_LEVEL[user.role] >= ROLE_LEVEL.Manager ? [{ icon: BarChart2, label: "Reports", desc: "View reports", color: CGo, path: "/reports" }] : []),
          ].map(a => (
            <button type="button" key={a.label} onClick={() => navigateDashboardAction(a.path)} className="flex flex-col items-center gap-2.5 p-4 rounded-xl text-center transition-all"
              style={{ border: "1px solid rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.20)" }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: `${a.color}18`, border: `1px solid ${a.color}30` }}>
                <a.icon size={20} style={{ color: a.color }} />
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: B.text }}>{a.label}</div>
                <div className="text-xs" style={{ color: B.textMuted }}>{a.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function DashboardPage({ user }: { user: AppUser }) {
  const { stats, loading, error } = useDashboard(user);

  if (loading) {
    return <div className="p-6">Loading dashboard…</div>;
  }

  if (error) {
    return <div className="p-6" style={{ color: CR }}>Failed to load dashboard data.</div>;
  }

  let dashboard = <WorkerDashboard user={user} stats={stats} />;
  if (isExec(user.role)) dashboard = <ExecutiveAnalyticsDashboard role={user.role === "Vice Chairman" ? "Vice Chairman" : user.role === "President" ? "President" : "Vice President"} department={user.department} userId={user.id} />;
  else if (isMD(user.role)) dashboard = <ExecutiveAnalyticsDashboard role="MD" department={user.department} userId={user.id} />;
  else if (user.role === "General Manager") dashboard = <ExecutiveAnalyticsDashboard role="General Manager" department={user.department} userId={user.id} />;
  else if (user.role === "Chief Manager") dashboard = <ExecutiveAnalyticsDashboard role="Chief Manager" department={user.department} userId={user.id} />;
  else if (user.role === "Manager") dashboard = <ManagerDashboard user={user} stats={stats} />;
  else if (user.role === "Supervisor") dashboard = <SupervisorDashboard user={user} stats={stats} />;

  return <>
    {dashboard}
    <div className="px-6 pb-6">
      <EmployeeKpiWidget userId={user.id} role={user.role} department={user.department} />
    </div>
  </>;
}

// ─── Attendance Page ──────────────────────────────────────────────────────────
function AttendancePage({ user }: { user: AppUser }) {
  const [view, setView] = useState<"daily" | "weekly" | "monthly">("daily");
  const [dept, setDept] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const attendanceScope = useMemo(() => ({ role: user.role, department: user.department, userId: user.id }), [user.role, user.department, user.id]);

  const { rows, setRows, weekly, summary, loading, error, reloadAttendance } = useAttendance(selectedDate, attendanceScope);

  const updateAttendanceStatus = (employeeId: string, status: string) => {
    setRows((prev) => prev.map((row) => (row.employee_id === employeeId ? { ...row, status: status as typeof row.status } : row)));
  };

  const isOrgWide = isExec(user.role) || isMD(user.role);
  const isWorker = user.role === "Worker";
  const myDept = user.department;
  const today = new Date().toISOString().split("T")[0];
  const isFutureDate = selectedDate > today;

  const filtered = rows
    .filter((emp) => (isWorker ? emp.employee_id === user.id : true))
    .filter((emp) => {
      const deptOk = dept === "All" || emp.department === dept;
      const searchOk = [emp.name, emp.department, emp.employee_id, emp.role, emp.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search.toLowerCase()));
      return deptOk && searchOk;
    });

  async function submitAttendance() {
    if (isFutureDate) return;

    try {
      const payload = filtered.map((employee) => ({
        employee_id: employee.employee_id,
        attendance_date: selectedDate,
        status: employee.status === "Not Marked" ? "Absent" : employee.status,
        check_in: employee.check_in_time && employee.check_in_time !== "-" ? employee.check_in_time : null,
      }));

      const { error } = await supabase.from("attendance").upsert(payload, {
        onConflict: "employee_id,attendance_date",
        ignoreDuplicates: false,
      });

      if (error) throw error;

      await reloadAttendance(selectedDate);
      alert("Attendance submitted successfully");
    } catch (err) {
      console.error(err);
      alert("Failed to submit attendance");
    }
  }
  return (
    <div className="p-6 space-y-5">
      <SectionHeader
        title="Attendance"
        subtitle={new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        actions={
          <>
            <SecondaryButton icon={Download} onClick={() => exportAttendanceToCSV(filtered)}>Export</SecondaryButton>
            {!isWorker && (
              <div title={isFutureDate ? "Future attendance cannot be marked." : undefined}>
                <PrimaryButton onClick={submitAttendance} disabled={isFutureDate}>
                  Submit Attendance
                </PrimaryButton>
              </div>
            )}
          </>
        }
      />

      {loading && <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.25)" }}>Loading attendance…</div>}
      {error && <div className="p-3 rounded-xl" style={{ background: "rgba(239,68,68,0.08)", color: CR }}>Failed to load attendance data.</div>}

      {!isOrgWide && (
        <div className="p-3 rounded-xl flex items-center gap-2"
          style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.18)" }}>
          <Lock size={13} style={{ color: CB }} />
          <p className="text-xs font-medium" style={{ color: CB }}>
            Showing attendance for your department only: <strong>{myDept}</strong>
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={CheckCircle} label="Present Today" value={String(summary.present)} sub="Current attendance summary" accentColor={CG} />
        <KPICard icon={XCircle} label="Absent" value={String(summary.absent)} sub="Current attendance summary" accentColor={CR} />
        <KPICard icon={Clock} label="Half Day" value={String(summary.halfDay)} sub="Current attendance summary" accentColor={CGo} />
        <KPICard icon={Calendar} label="On Leave" value={String(summary.onLeave)} sub="Current attendance summary" accentColor={CB} />
      </div>

      <GlassCard>
        <div className="flex items-center gap-3 px-5 py-4 flex-wrap" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <div className="flex rounded-xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.50)", background: "rgba(255,255,255,0.20)" }}>
            {(["daily","weekly","monthly"] as const).map(v => (
              <button type="button" key={v} onClick={() => setView(v)}
                className="px-4 py-2 text-sm font-medium capitalize transition-all"
                style={{ background: view === v ? "rgba(255,255,255,0.60)" : "transparent",
                  color: view === v ? B.nav : B.textMuted, fontWeight: view === v ? 600 : 400,
                  borderRight: v !== "monthly" ? "1px solid rgba(255,255,255,0.40)" : "none" }}>{v}</button>
            ))}
          </div>
          {isOrgWide && (
            <select value={dept} onChange={(e) => setDept(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl outline-none"
              style={{ background: "rgba(255,255,255,0.40)", border: "1px solid rgba(255,255,255,0.50)", color: B.text }}>
              <option>All</option>
              {(["Administration", "Manufacturing", "Marketing", "Transport", "Research & Development"] as const).map((d) => <option key={d}>{d}</option>)}
            </select>
          )}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl outline-none"
            style={{ background: "rgba(255,255,255,0.40)", border: "1px solid rgba(255,255,255,0.50)", color: B.text }}
          />
          <div className="flex items-center gap-2.5 flex-1 min-w-0 max-w-xs px-3 py-2 rounded-xl"
            style={{ background: "rgba(255,255,255,0.40)", border: "1px solid rgba(255,255,255,0.50)", backdropFilter: "blur(10px)" }}>
            <Search size={14} style={{ color: B.textFaint }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee…"
              className="flex-1 bg-transparent text-sm outline-none" style={{ color: B.text }} />
          </div>
        </div>

        {view === "daily" && (
          <div className="overflow-x-auto">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-sm" style={{ color: B.textMuted }}>
                No attendance records found
              </div>
            ) : (
            <table className="w-full min-w-[600px]">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", background: "rgba(255,255,255,0.15)" }}>
                  {["Employee","ID","Department","Status","Clock In"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider" style={{ color: B.textMuted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => (
                  <tr key={emp.id} className="transition-colors hover:bg-white/20" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: B.nav }}>{emp.name.split(" ").map((w: string) => w[0]).join("").slice(0,2)}</div>
                        <span className="text-sm font-medium" style={{ color: B.text }}>{emp.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs" style={{ color: B.textMuted, fontFamily: "monospace" }}>{emp.employee_id}</td>
                    <td className="py-3.5 px-4 text-sm" style={{ color: B.textSub }}>{emp.department}</td>
                    <td className="py-3.5 px-4">
                      {
                        user.role === "Worker"
                          ? (
                              <StatusBadge
                                status={emp.status}
                              />
                            )
                          : (
                              <select
                                value={emp.status}
                                onChange={(e) => updateAttendanceStatus(emp.employee_id, e.target.value)}
                              >
                                <option value="Not Marked">Not Marked</option>
                                <option value="Present">Present</option>
                                <option value="Absent">Absent</option>
                                <option value="Half Day">Half Day</option>
                                <option value="Leave">Leave</option>
                              </select>
                            )
                      }
                    </td>
                    <td className="py-3.5 px-4 text-sm" style={{ color: B.text, fontFamily: "monospace" }}>{emp.check_in_time}</td>
                    
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        )}

        {view === "weekly" && (
          <div className="p-5">
            <h3 className="font-semibold text-sm mb-4" style={{ color: B.text }}>Weekly Attendance Trend</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: B.textMuted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: B.textMuted }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TT} />
                <Bar id="att-pres" dataKey="present" fill={CG} radius={[4,4,0,0]} name="Present" />
                <Bar id="att-abs"  dataKey="absent"  fill={CR} radius={[4,4,0,0]} name="Absent" />
                <Legend iconSize={8} iconType="circle" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {view === "monthly" && (
          <div className="p-5">
            <h3 className="font-semibold text-sm mb-4" style={{ color: B.text }}>Monthly Analytics — Jan to Jul 2025</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={weekly}>
                <defs>
                  <linearGradient id="att-gOrd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={CG} stopOpacity={0.18}/>
                    <stop offset="95%" stopColor={CG} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: B.textMuted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: B.textMuted }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TT} />
                <Area id="att-monthly" type="monotone" dataKey="present" stroke={CG} fill="url(#att-gOrd)" strokeWidth={2} name="Avg Present" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="flex items-center justify-between px-5 py-4" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
          <span className="text-xs" style={{ color: B.textMuted }}>Showing {filtered.length} employees</span>
          <span className="text-xs" style={{ color: B.textMuted }}>Page controls are not available in this view.</span>
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Bills Page ───────────────────────────────────────────────────────────────
function BillsPage({ user }: { user: AppUser }) {
  const [tab, setTab] = useState<"list"|"submit"|"detail">("list");
  const [selectedBill, setSelectedBill] = useState<BillRecord | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const { bills, pendingBills, loading, error, refreshBills, createBill, approveBill, reviewBill, rejectBill, returnBill, cancelApproval } = useBills();
  const canSubmit  = canSubmitBills(user.role);

  const normalizeDepartment = (department: string) => String(department || "").replace(/\s+/g, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const isMDOfDepartment = (role: Role, department: string) => {
    const departmentKeys: Record<string, string[]> = {
      "MD-Manufacturing": ["MANUFACTURING"],
      "MD-Marketing": ["MARKETING"],
      "MD-Transport": ["TRANSPORT", "TRANSPORTATION"],
      "MD-RD": ["RD", "RND", "RESEARCHANDDEVELOPMENT", "RESEARCHDEVELOPMENT"],
    };
    return departmentKeys[role]?.includes(normalizeDepartment(department)) ?? false;
  };
  const canApprovePendingBill = (role: Role, department: string) => ["Vice Chairman", "Vice President", "General Manager"].includes(role) || isMDOfDepartment(role, department);

  interface BillActions {
    primaryLabel: string | null;
    primaryAction: "approve" | "review" | null;
    canReject: boolean;
    canReturn: boolean;
    canCancelApproval: boolean;
  }

  const getBillActions = (bill: BillRecord | null, actor: AppUser): BillActions => {
    const noActions: BillActions = { primaryLabel: null, primaryAction: null, canReject: false, canReturn: false, canCancelApproval: false };
    if (!bill) return noActions;

    if (bill.status === "Pending Approval") {
      if (canApprovePendingBill(actor.role, bill.department)) {
        return { primaryLabel: "Approve Bill", primaryAction: "approve", canReject: true, canReturn: true, canCancelApproval: false };
      }
      return noActions;
    }

    if (bill.status === "Approved") {
      if (actor.role === "Vice Chairman") {
        return { primaryLabel: "Review Bill", primaryAction: "review", canReject: true, canReturn: true, canCancelApproval: true };
      }
      return noActions;
    }

    if (bill.status === "Reviewed") {
      if (actor.role === "Vice Chairman") {
        return { primaryLabel: "Reviewed", primaryAction: null, canReject: true, canReturn: true, canCancelApproval: false };
      }
      return noActions;
    }

    return noActions;
  };

  const billActions = getBillActions(selectedBill, user);

  const filteredBills = bills.filter((bill) => {
    const matchesSearch = [bill.ref, bill.vendor, bill.department, bill.status]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "All" || bill.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const [actionNote, setActionNote] = useState<string>("");
  const [formInvoice, setFormInvoice] = useState<string>("");
  const [formVendor, setFormVendor] = useState<string>("");
  const [formDepartment, setFormDepartment] = useState<string>("Manufacturing");
  const [formAmount, setFormAmount] = useState<number | "">("");
  const [formGst, setFormGst] = useState<number | "">("");
  const [formBillDate, setFormBillDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [formDueDate, setFormDueDate] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formAttachmentFiles, setFormAttachmentFiles] = useState<File[]>([]);
  const [formAttachmentUrls, setFormAttachmentUrls] = useState<BillAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [approvalCancelReason, setApprovalCancelReason] = useState<string>("");

  async function handleViewAttachment(attachment: BillAttachment) {
    try {
      const url = await viewBillAttachment(attachment);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Failed to view attachment", err);
    }
  }

  async function handleDownloadAttachment(attachment: BillAttachment) {
    try {
      const url = await downloadBillAttachment(attachment);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.file_name || "bill-attachment";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to download attachment", err);
    }
  }

  async function handleApprove() {
    if (!selectedBill) return;
    try {
      const updated = await approveBill(selectedBill.id, user.id, user.role, actionNote || "Approved by workflow");
      setSelectedBill(updated);
    } catch (err) {
      console.error("Approve failed", err);
    }
  }

  async function handleReview() {
    if (!selectedBill) return;
    try {
      const updated = await reviewBill(selectedBill.id, user.id, user.role, actionNote || "Reviewed by Vice Chairman");
      setSelectedBill(updated);
    } catch (err) {
      console.error("Review failed", err);
    }
  }

  async function handleReturn() {
    if (!selectedBill) return;
    try {
      const updated = await returnBill(selectedBill.id, user.id, user.role, actionNote || "Returned for correction");
      setSelectedBill(updated);
    } catch (err) {
      console.error("Return failed", err);
    }
  }

  async function handleReject() {
    if (!selectedBill) return;
    try {
      const updated = await rejectBill(selectedBill.id, user.id, user.role, actionNote || "Rejected");
      setSelectedBill(updated);
    } catch (err) {
      console.error("Reject failed", err);
    }
  }

  async function handleCancelApproval() {
    if (!selectedBill) return;
    try {
      const updated = await cancelApproval(selectedBill.id, user.id, user.role, approvalCancelReason || "Approval cancelled by Vice Chairman");
      setSelectedBill(updated);
    } catch (err) {
      console.error("Cancel approval failed", err);
    }
  }

  async function handleSubmitNewBill() {
    setSubmitting(true);
    try {
      if (!formVendor || formAmount === "" || Number(formAmount) <= 0) {
        throw new Error("Vendor and amount are required");
      }

      const uploadedUrls = formAttachmentFiles.length > 0
        ? await uploadBillAttachments(formAttachmentFiles)
        : [];
      setFormAttachmentUrls(uploadedUrls);

      const payload: Partial<BillRecord> & { submitted_by: string; submitted_role: string; bill_number?: string; vendor: string; bill_date: string } = {
        bill_number: formInvoice || undefined,
        title: undefined,
        vendor: formVendor,
        department: formDepartment,
        amount: Number(formAmount || 0),
        gst: Number(formGst || 0),
        bill_date: formBillDate || new Date().toISOString().slice(0,10),
        due_date: formDueDate || null,
        description: formDescription || "",
        attachment_url: uploadedUrls.length > 0 ? JSON.stringify(uploadedUrls.map(({ file_name, storage_path }) => ({ file_name, storage_path }))) : null,
        submitted_by: user.id,
        submitted_role: user.role,
        status: "Pending Approval",
      };

      await createBill(payload);
      // clear and navigate back
      setFormInvoice(""); setFormVendor(""); setFormDepartment("Manufacturing"); setFormAmount(""); setFormGst(""); setFormBillDate(new Date().toISOString().slice(0,10)); setFormDueDate(""); setFormDescription(""); setFormAttachmentFiles([]); setFormAttachmentUrls([]);
      setTab("list");
    } catch (err) {
      console.error("Failed to submit bill", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveDraft() {
    setSubmitting(true);
    try {
      const uploadedUrls = formAttachmentFiles.length > 0
        ? await uploadBillAttachments(formAttachmentFiles)
        : [];
      setFormAttachmentUrls(uploadedUrls);
      const payload: Partial<BillRecord> & { submitted_by: string; submitted_role: string; bill_number?: string; vendor: string; bill_date: string } = {
        bill_number: formInvoice || undefined,
        title: undefined,
        vendor: formVendor,
        department: formDepartment,
        amount: Number(formAmount || 0),
        gst: Number(formGst || 0),
        bill_date: formBillDate || new Date().toISOString().slice(0,10),
        due_date: formDueDate || null,
        description: formDescription || "",
        attachment_url: uploadedUrls.length > 0 ? JSON.stringify(uploadedUrls.map(({ file_name, storage_path }) => ({ file_name, storage_path }))) : null,
        submitted_by: user.id,
        submitted_role: user.role,
        status: "Draft",
      };

      await createBill(payload);
      setTab("list");
    } catch (err) {
      console.error("Failed to save draft", err);
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (bills[0]) {
      setSelectedBill(bills[0]);
    }
  }, [bills]);

  const [billHistory, setBillHistory] = useState<BillHistory[]>([]);

  useEffect(() => {
    if (!selectedBill) return;

    const loadHistory = async () => {
      try {
        const history = await getBillHistory(selectedBill.id);
        setBillHistory(history);
      } catch (err) {
        console.error("Failed to load bill history", err);
        setBillHistory([]);
      }
    };

    void loadHistory();
  }, [selectedBill]);

  const BillDetail = () => (
    <div className="space-y-5">
      <button type="button" onClick={() => setTab("list")} className="flex items-center gap-2 text-sm font-medium" style={{ color: B.textMuted }}>
        <ChevronLeft size={16} /> Back to Bills
      </button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <GlassCard className="p-6 lg:col-span-2">
          <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-bold" style={{ color: B.text }}>{selectedBill?.ref}</h2>
              <p className="text-sm mt-0.5" style={{ color: B.textMuted }}>{selectedBill?.vendor} · {selectedBill?.department}</p>
            </div>
            <StatusBadge status={selectedBill?.status} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {[
              { label: "Invoice Amount",  val: `₹${selectedBill?.amount.toLocaleString()}` },
              { label: "GST (18%)",       val: `₹${selectedBill?.gst.toLocaleString()}` },
              { label: "Total Payable",   val: selectedBill ? `₹${(selectedBill.amount + selectedBill.gst).toLocaleString()}` : "—" },
              { label: "Department",      val: selectedBill?.department },
              { label: "Bill Date",       val: selectedBill?.date + " 2025" },
              { label: "Due Date",        val: selectedBill?.due_date + " 2025" },
            ].map(f => (
              <div key={f.label} className="p-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.30)", border: "1px solid rgba(255,255,255,0.45)" }}>
                <div className="text-xs mb-1" style={{ color: B.textMuted }}>{f.label}</div>
                <div className="text-sm font-bold" style={{ color: B.text }}>{f.val}</div>
              </div>
            ))}
          </div>

          <h3 className="font-semibold mb-4" style={{ color: B.text }}>Complete Audit Trail</h3>
          {(() => {
            const attachments = getBillAttachments(selectedBill?.attachment_url ?? null);
            if (attachments.length > 0) {
              return (
                <div className="mb-4 space-y-2 text-xs" style={{ color: B.textMuted }}>
                  {attachments.map((attachment) => (
                    <div key={`${attachment.file_name}-${attachment.storage_path ?? attachment.attachment_url ?? "unknown"}`} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2"
                      style={{ background: "rgba(255,255,255,0.30)", border: "1px solid rgba(255,255,255,0.45)" }}>
                      <span className="truncate">{attachment.file_name}</span>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => void handleViewAttachment(attachment)} className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: B.text }}>
                          <Eye size={13} /> View
                        </button>
                        <button type="button" onClick={() => void handleDownloadAttachment(attachment)} className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: B.text }}>
                          <Download size={13} /> Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            }
            return <div className="mb-4 text-xs" style={{ color: B.textMuted }}>No attachments uploaded for this bill.</div>;
          })()}
          {billHistory.length > 0 ? billHistory.map((entry, i) => {
            const done = entry.action !== "saved_draft" && entry.action !== "submitted";
            return (
              <div key={entry.id ?? i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: done ? CG : "rgba(0,0,0,0.10)" }}>
                    {done ? <CheckCircle size={14} color="white" /> : <Clock size={14} color="#9CA3AF" />}
                  </div>
                  {i < billHistory.length - 1 && <div className="w-0.5 h-8 my-1" style={{ background: done ? CG : "rgba(0,0,0,0.10)" }} />}
                </div>
                <div className="pb-4 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: B.text }}>{entry.action.replace(/_/g, " ")}</span>
                    {entry.performed_role && entry.performed_role !== "" && <span className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.35)", color: B.text }}>{entry.performed_role}</span>}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: B.textMuted }}>
                    {entry.performed_by ?? "System"} · {entry.created_at ? new Date(entry.created_at).toLocaleString("en-IN") : "Pending timestamp"}
                  </div>
                  {entry.comments && (
                    <div className="text-xs mt-1 px-2.5 py-1.5 rounded-lg inline-block"
                      style={{ background: "rgba(255,255,255,0.40)", color: B.textSub, border: "1px solid rgba(255,255,255,0.50)" }}>
                      {entry.comments}
                    </div>
                  )}
                </div>
              </div>
            );
          }) : (
            <div className="text-xs text-gray-500">No history available for this bill.</div>
          )}
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="font-semibold mb-4" style={{ color: B.text }}>Action Panel</h3>
          {!selectedBill || (!billActions.primaryAction && !billActions.canReject && !billActions.canReturn && !billActions.canCancelApproval) ? (
            <div className="p-5 rounded-xl text-center" style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.06)" }}>
              <Lock size={28} className="mx-auto mb-3" style={{ color: B.textFaint }} />
              <p className="text-sm" style={{ color: B.textSub }}>This bill is not in your approval queue or you do not have the correct role.</p>
              <p className="text-xs mt-1.5" style={{ color: B.textMuted }}>Your role: <strong>{user.role}</strong></p>
              <p className="text-xs mt-1" style={{ color: B.textMuted }}>Current status: <strong>{selectedBill?.status ?? "—"}</strong></p>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea placeholder="Add a comment or note (required for rejection/return)…" rows={3}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                style={{ background: "rgba(255,255,255,0.40)", border: "1px solid rgba(255,255,255,0.50)", color: B.text }} />
              {billActions.primaryLabel && billActions.primaryAction === "approve" && (
                <PrimaryButton icon={CheckCircle} size="lg" onClick={handleApprove}>{billActions.primaryLabel}</PrimaryButton>
              )}
              {billActions.primaryAction === "review" && (
                <PrimaryButton icon={CheckCircle} size="lg" onClick={handleReview}>{billActions.primaryLabel}</PrimaryButton>
              )}
              {billActions.canReturn && (
                <SecondaryButton icon={RefreshCw} onClick={handleReturn}>Return for Correction</SecondaryButton>
              )}
              {billActions.canReject && (
                <button type="button" onClick={handleReject} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl"
                  style={{ background: B.redLight, border: "1px solid rgba(239,68,68,0.20)", color: CR }}>
                  <XCircle size={15} /> Reject Bill
                </button>
              )}
              {selectedBill?.status === "Approved" && user.role === "Vice Chairman" && (
                <>
                  <textarea placeholder="Reason for approval cancellation…" rows={3}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                    value={approvalCancelReason}
                    onChange={(e) => setApprovalCancelReason(e.target.value)}
                    style={{ background: "rgba(255,255,255,0.40)", border: "1px solid rgba(255,255,255,0.50)", color: B.text }} />
                  <button type="button" onClick={() => handleCancelApproval()} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl"
                    style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.20)", color: "#b45309" }}>
                    <XCircle size={15} /> Cancel Approval
                  </button>
                </>
              )}
            </div>
          )}
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <button type="button" onClick={() => { if (selectedBill) void exportBillToPDF(selectedBill); }} className="flex items-center gap-2 text-sm font-medium" style={{ color: B.textMuted }}>
              <Printer size={14} /> Print Bill
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );

  const SubmitForm = () => (
    <div>
      <button type="button" onClick={() => setTab("list")} className="flex items-center gap-2 text-sm font-medium mb-5" style={{ color: B.textMuted }}>
        <ChevronLeft size={16} /> Back
      </button>
      <GlassCard className="p-6 max-w-2xl">
        <h2 className="text-xl font-bold mb-1" style={{ color: B.text }}>Submit New Bill</h2>
        <p className="text-sm mb-5" style={{ color: B.textMuted }}>All bills are reviewed by GM before approval</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: B.textMuted }}>Invoice Number</label>
            <input value={formInvoice} onChange={(e) => setFormInvoice(e.target.value)} type="text" placeholder="INV-2025-XXXX" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }} />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: B.textMuted }}>Vendor Name</label>
            <input value={formVendor} onChange={(e) => setFormVendor(e.target.value)} type="text" placeholder="Vendor name" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }} />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: B.textMuted }}>Department</label>
            <select value={formDepartment} onChange={(e) => setFormDepartment(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }}>
              {['Administration','Manufacturing','Marketing','Transport','Research & Development'].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: B.textMuted }}>Amount (₹)</label>
            <input value={formAmount} onChange={(e) => setFormAmount(e.target.value === '' ? '' : Number(e.target.value))} type="number" placeholder="0.00" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }} />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: B.textMuted }}>GST Amount (₹)</label>
            <input value={formGst} onChange={(e) => setFormGst(e.target.value === '' ? '' : Number(e.target.value))} type="number" placeholder="Auto-calc" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }} />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: B.textMuted }}>Bill Date</label>
            <input value={formBillDate} onChange={(e) => setFormBillDate(e.target.value)} type="date" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }} />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: B.textMuted }}>Due Date</label>
            <input value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} type="date" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: B.textMuted }}>Description</label>
            <textarea rows={3} value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Purpose of this expense…" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }} />
          </div>
         <div className="sm:col-span-2">
            <label
              className="block text-xs font-bold mb-1.5 uppercase tracking-widest"
              style={{ color: B.textMuted }}
            >
              Attach Invoice (PDF/Image)
            </label>

            <label
              className="relative block border-2 border-dashed rounded-2xl p-8 text-center hover:bg-white/20 cursor-pointer transition-colors"
              style={{ borderColor: "rgba(255,255,255,0.50)" }}
            >
              <Upload
                size={22}
                className="mx-auto mb-2"
                style={{ color: B.textFaint }}
              />

              <p className="text-sm" style={{ color: B.textSub }}>
                Drop PDF or Image, or{" "}
                <span style={{ color: B.green }}>browse files</span>
              </p>

              <p className="text-xs mt-1" style={{ color: B.textMuted }}>
                Max 10MB · PDF, JPG, PNG
              </p>

              {formAttachmentFiles.length > 0 && (
                <div
                  className="text-xs mt-2"
                  style={{ color: B.textMuted }}
                >
                  Selected:{" "}
                  {formAttachmentFiles.map((file) => file.name).join(", ")}
                </div>
              )}

              <input
                type="file"
                accept="application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                multiple
                onChange={(e) =>
                  setFormAttachmentFiles(
                    Array.from(e.target.files ?? [])
                  )
                }
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </label>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <PrimaryButton icon={Send} onClick={handleSubmitNewBill} disabled={submitting}>Submit for Approval</PrimaryButton>
          <SecondaryButton icon={Archive} onClick={handleSaveDraft} disabled={submitting}>Save as Draft</SecondaryButton>
        </div>
      </GlassCard>
    </div>
  );

  if (tab === "detail") return <div className="p-6">{BillDetail()}</div>;
  if (tab === "submit") return <div className="p-6">{SubmitForm()}</div>;

  return (
    <div className="p-6 space-y-5">
      <SectionHeader title="Bill Management" subtitle="Digital bill submission, tracking and approval workflow"
        actions={
          <>
            <SecondaryButton icon={Download} onClick={() => void exportBillsToXLSX(bills)}>Export</SecondaryButton>
            {canSubmit
              ? <PrimaryButton icon={Plus} onClick={() => setTab("submit")}>New Bill</PrimaryButton>
              : <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
                  style={{ background: "rgba(0,0,0,0.06)", color: B.textMuted }}>
                  <Lock size={13} /> Supervisor / Worker cannot submit bills
                </div>
            }
          </>
        } />

      {loading && <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.25)" }}>Loading bills…</div>}
      {error && <div className="p-3 rounded-xl" style={{ background: "rgba(239,68,68,0.08)", color: CR }}>Failed to load bills.</div>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Clock}      label="Pending Approval" value={String(pendingBills.filter((bill) => bill.status === "Pending Approval").length)}  sub="Awaiting Vice Chairman review" accentColor={B.purple} />
        <KPICard icon={FileCheck}  label="Reviewed"             value={String(pendingBills.filter((bill) => bill.status === "Reviewed").length)}       sub="Reviewed by Vice Chairman" accentColor={CGo} />
        <KPICard icon={CheckCircle}label="Approved / Reviewed"      value={String(bills.filter((bill) => ["Approved", "Reviewed"].includes(bill.status)).length)} sub="This month"          accentColor={CG}  />
        <KPICard icon={FileX}      label="Rejected / Returned"  value={String(bills.filter((bill) => ["Rejected", "Returned for Correction"].includes(bill.status)).length)}  sub="Need resubmission"  accentColor={CR}  />
      </div>

      {/* Bill workflow visual */}
      <GlassCard className="p-5">
        <h3 className="font-semibold text-sm mb-4" style={{ color: B.text }}>Bill Workflow</h3>
        <div className="flex items-center gap-1 flex-wrap">
          {["Draft","Pending Approval","Approved","Reviewed"].map((step, i, arr) => (
            <div key={step} className="flex items-center gap-1">
              <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ background: "rgba(255,255,255,0.40)", color: B.textSub, border: "1px solid rgba(255,255,255,0.50)" }}>{step}</span>
              {i < arr.length - 1 && <span style={{ color: B.textFaint, fontSize: 10 }}>→</span>}
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex items-center gap-3 px-5 py-4 flex-wrap" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
          <div className="flex items-center gap-2.5 flex-1 min-w-0 max-w-xs px-3 py-2 rounded-xl"
            style={{ background: "rgba(255,255,255,0.40)", border: "1px solid rgba(255,255,255,0.50)", backdropFilter: "blur(10px)" }}>
            <Search size={14} style={{ color: B.textFaint }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bills…" className="flex-1 bg-transparent text-sm outline-none" style={{ color: B.text }} />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 text-sm rounded-xl outline-none"
            style={{ background: "rgba(255,255,255,0.40)", border: "1px solid rgba(255,255,255,0.50)", color: B.text }}>
            <option value="All">All Status</option>
            {Array.from(new Set(bills.map((bill) => bill.status))).map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px]">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.05)", background: "rgba(255,255,255,0.15)" }}>
                {["Bill Ref","Vendor","Dept","Amount","Total (GST)","Date","Status","Action"].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider" style={{ color: B.textMuted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredBills.map(bill => (
                <tr key={bill.ref} className="transition-colors hover:bg-white/20 cursor-pointer"
                  style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}
                  onClick={() => { setSelectedBill(bill); setTab("detail"); }}>
                  <td className="py-3.5 px-4 text-sm font-bold" style={{ color: B.text, fontFamily: "monospace" }}>{bill.ref}</td>
                  <td className="py-3.5 px-4 text-sm font-medium" style={{ color: B.text }}>{bill.vendor}</td>
                  <td className="py-3.5 px-4 text-sm" style={{ color: B.textMuted }}>{bill.department}</td>
                  <td className="py-3.5 px-4 text-sm font-semibold" style={{ color: B.text }}>₹{bill.amount.toLocaleString()}</td>
                  <td className="py-3.5 px-4 text-sm" style={{ color: B.textMuted }}>₹{(bill.amount + bill.gst).toLocaleString()}</td>
                  <td className="py-3.5 px-4 text-sm" style={{ color: B.textMuted }}>{bill.date}</td>
                  <td className="py-3.5 px-4"><StatusBadge status={bill.status} /></td>
                  <td className="py-3.5 px-4">
                    <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedBill(bill); setTab("detail"); }} aria-label="View bill details" className="p-1.5 rounded-lg hover:bg-white/30" style={{ color: B.textMuted }}><Eye size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Marketing Page ───────────────────────────────────────────────────────────
function MarketingPage({ setShowCreateOrder }: { setShowCreateOrder?: (show: boolean) => void }) {
  const { profile } = useAuth();
  const userRole = profile?.role as Role | undefined;
  const { metrics, orders, customers, revenue, performance, loading, error, refreshData } = useMarketing();
  const [activeTab, setActiveTab] = useState<"orders"|"customers"|"payments"|"collaboration">("orders");
  const [orderSearch, setOrderSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [actionLoadingOrderId, setActionLoadingOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<MarketingOrder | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<MarketingCustomer | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [orderDetailsLoading, setOrderDetailsLoading] = useState(false);

  const normalizedOrderSearch = orderSearch.trim().toLowerCase();
  const filteredOrders = orders.filter((order) => {
    if (!normalizedOrderSearch) return true;
    return [order.ref, order.customer, order.location, order.soap, order.status]
      .some((value) => String(value ?? "").toLowerCase().includes(normalizedOrderSearch));
  });

  const canApproveOrders = (role?: Role) => ["Vice Chairman", "Vice President", "MD-Marketing", "MD-Transport", "General Manager"].includes(role ?? "Worker");
  const canApproveCurrentUser = canApproveOrders(userRole);


  async function handleApproveOrder(order: MarketingOrder) {
    if (!canApproveOrders(userRole)) return;
    setActionLoadingOrderId(order.id);
    try {
      await approveOrder(order.id, order.ref, userRole);
      await refreshData();
      // no success shown until database update succeeds
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to approve order");
    } finally {
      setActionLoadingOrderId(null);
    }
  }

  async function handleRejectOrder(order: MarketingOrder) {
    if (!canApproveOrders(userRole)) return;
    const reason = window.prompt(`Provide a reason for rejecting order ${order.ref}:`);
    if (!reason) return;
    setActionLoadingOrderId(order.id);
    try {
      await rejectOrder(order.id, order.ref, reason, userRole);
      await refreshData();
      alert(`Order ${order.ref} rejected.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reject order");
    } finally {
      setActionLoadingOrderId(null);
    }
  }

  async function handleOpenOrder(order: MarketingOrder) {
    setSelectedOrder(order);
    setOrderDetails(null);
    setOrderDetailsLoading(true);
    try {
      setOrderDetails(await getOrderDetails(order.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load order details");
    } finally {
      setOrderDetailsLoading(false);
    }
  }

  const normalizedCustomerSearch = customerSearch.trim().toLowerCase();
  const filteredCustomers = customers.filter((customer) => {
    if (!normalizedCustomerSearch) return true;
    return [customer.id, customer.name, customer.location]
      .some((value) => String(value ?? "").toLowerCase().includes(normalizedCustomerSearch));
  });

  const handleExport = () => {
    void exportMarketingWorkbook(filteredOrders, filteredCustomers, metrics, revenue, performance);
  };


  return (
    <div className="p-6 space-y-5">
      <SectionHeader title="Marketing & Orders" subtitle="Customer orders, sales analytics and performance"
        actions={
          <>
            <SecondaryButton icon={Download} onClick={handleExport}>Export</SecondaryButton>
            <PrimaryButton icon={Plus} onClick={() => setShowCreateOrder?.(true)}>New Order</PrimaryButton>
          </>
        } />

      {/* ─── COLLABORATION MODULE BANNER SECTION ─── */}
      <div className="rounded-2xl p-5 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-emerald-500/30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 font-bold flex-shrink-0">
            <Handshake size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 font-bold text-[10px] uppercase tracking-wider">
                Marketing Sector Exclusive
              </span>
            </div>
            <h3 className="text-lg font-bold text-white">Collaboration Module & External Handshake Hub</h3>
            <p className="text-xs text-emerald-100/80">Manage collaborator profiles, Apply Bill applications, 3-tier internal approval routing, and generated bills.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab("collaboration")}
          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 whitespace-nowrap transition-all"
        >
          <Handshake size={16} /> Open Collaboration Section <ArrowRight size={14} />
        </button>
      </div>

      {loading && (
        <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.25)" }}>
          Loading marketing data…
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl" style={{ background: "rgba(239,68,68,0.08)", color: CR }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={ShoppingCart} label="Total Orders"      value={String(metrics.totalOrders)} sub={`${metrics.pendingOrders} pending`}          accentColor={CB}  />
        <KPICard icon={Clock}        label="Pending / Approved" value={String(metrics.pendingOrders)}  sub={`₹${(metrics.monthlySales / 100000).toFixed(1)}L this month`}    accentColor={CGo} />
        <KPICard icon={Truck}        label="Dispatched"         value={String(metrics.dispatchedOrders)}  sub="En route to customers" accentColor={CT}  />
        <KPICard icon={CheckCircle}  label="Delivered"          value={String(metrics.completedOrders)} sub={`${Math.round((metrics.completedOrders / Math.max(metrics.totalOrders, 1)) * 100)}%`}        accentColor={CG}  />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <GlassCard className="p-5 lg:col-span-2">
          <h3 className="font-semibold text-base mb-1" style={{ color: B.text }}>Monthly Sales Revenue</h3>
          <p className="text-xs mb-4" style={{ color: B.textMuted }}>Year to date</p>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={revenue}>
              <defs>
                <linearGradient id="mkt-gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={CG} stopOpacity={0.20}/>
                  <stop offset="95%" stopColor={CG} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: B.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: B.textMuted }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000000).toFixed(0)}M`} />
              <Tooltip contentStyle={TT} formatter={(v: any) => [`₹${(v/100000).toFixed(1)}L`, "Revenue"]} />
              <Area id="mkt-revenue" type="monotone" dataKey="revenue" stroke={CG} fill="url(#mkt-gRev)" strokeWidth={2.5} name="Revenue" />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="font-semibold text-base mb-4" style={{ color: B.text }}>Product Performance</h3>
          {performance.length === 0 ? (
            <p className="text-xs" style={{ color: B.textMuted }}>No product data available</p>
          ) : (
            performance.map((p, idx) => (
              <div key={idx} className="mb-3.5">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium" style={{ color: B.text }}>{p.name}</span>
                  <span style={{ color: B.textMuted }}>{p.unitsSold} units · {p.val}</span>
                </div>
                <div className="text-xs mb-1.5" style={{ color: B.textMuted }}>{p.ordersCount} orders · Revenue {p.val}</div>
                <div className="h-1.5 rounded-full" style={{ background: "rgba(0,0,0,0.08)" }}>
                  <div className="h-1.5 rounded-full" style={{ width: `${p.pct}%`, background: CG }} />
                </div>
              </div>
            ))
          )}
        </GlassCard>
      </div>

      {/* Tabs */}
      <div className="flex rounded-2xl overflow-hidden w-fit"
        style={{ border: "1px solid rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.20)" }}>
        {(["orders","customers","payments","collaboration"] as const).map(t => (
          <button type="button" key={t} onClick={() => setActiveTab(t)}
            className="px-5 py-2.5 text-sm font-medium capitalize transition-all"
            style={{
              background: activeTab === t ? "rgba(255,255,255,0.55)" : "transparent",
              color: activeTab === t ? B.nav : B.textMuted, fontWeight: activeTab === t ? 600 : 400,
              borderRight: t !== "collaboration" ? "1px solid rgba(255,255,255,0.40)" : "none",
            }}>
            {t === "orders" ? "Orders" : t === "customers" ? "Customer Database" : t === "payments" ? "Payments" : "Collaboration"}
          </button>
        ))}
      </div>

      {activeTab === "collaboration" && (
        <CollaborationModule currentUser={profile} />
      )}

      {activeTab === "payments" && <PaymentsPage />}

      {activeTab === "orders" && (
        <GlassCard>
          <div className="flex items-center gap-3 px-5 py-4 flex-wrap" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
            <div className="flex items-center gap-2.5 flex-1 min-w-0 max-w-sm px-3 py-2 rounded-xl"
              style={{ background: "rgba(255,255,255,0.40)", border: "1px solid rgba(255,255,255,0.50)", backdropFilter: "blur(10px)" }}>
              <Search size={14} style={{ color: B.textFaint }} />
              <input 
                value={orderSearch} 
                onChange={(e) => setOrderSearch(e.target.value)} 
                placeholder="Search orders, customers…" 
                className="flex-1 bg-transparent text-sm outline-none" 
                style={{ color: B.text }} 
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.05)", background: "rgba(255,255,255,0.15)" }}>
                  {["Order No.","Customer","Location","Product","Qty","Value","Order Date","Expected Delivery","Status","Action"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider" style={{ color: B.textMuted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(o => (
                  <tr key={o.id} onClick={() => void handleOpenOrder(o)} className="transition-colors hover:bg-white/20 cursor-pointer" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                    <td className="py-3.5 px-4 text-sm font-bold" style={{ color: B.text, fontFamily: "monospace" }}>{o.ref}</td>
                    <td className="py-3.5 px-4 text-sm font-medium" style={{ color: B.text }}>{o.customer}</td>
                    <td className="py-3.5 px-4 text-sm" style={{ color: B.textMuted }}><span className="flex items-center gap-1"><MapPin size={11} />{o.location}</span></td>
                    <td className="py-3.5 px-4 text-sm" style={{ color: B.textSub }}>{o.soap}</td>
                    <td className="py-3.5 px-4 text-sm font-semibold" style={{ color: B.text }}>{o.qty.toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-sm font-semibold" style={{ color: B.text }}>₹{o.value.toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-sm" style={{ color: B.textMuted }}>{o.date}</td>
                    <td className="py-3.5 px-4 text-sm" style={{ color: B.textMuted }}>{o.delivery}</td>
                    <td className="py-3.5 px-4"><StatusBadge status={o.status} /></td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); void handleApproveOrder(o); }}
                          disabled={actionLoadingOrderId === o.id || ["Approved", "Rejected", "Delivered"].includes(o.status)}
                          className="px-3 py-2 text-xs font-semibold rounded-xl"
                          style={{
                            background: !["Approved", "Rejected", "Delivered"].includes(o.status) ? "rgba(78,128,80,0.15)" : "rgba(156,163,175,0.18)",
                            color: !["Approved", "Rejected", "Delivered"].includes(o.status) ? CG : B.textMuted,
                            border: `1px solid ${!["Approved", "Rejected", "Delivered"].includes(o.status) ? `${CG}33` : "rgba(156,163,175,0.22)"}`,
                            cursor: !["Approved", "Rejected", "Delivered"].includes(o.status) ? "pointer" : "not-allowed",
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); void handleRejectOrder(o); }}
                          disabled={actionLoadingOrderId === o.id || ["Approved", "Rejected", "Delivered"].includes(o.status)}
                          className="px-3 py-2 text-xs font-semibold rounded-xl"
                          style={{
                            background: !["Approved", "Rejected", "Delivered"].includes(o.status) ? "rgba(239,68,68,0.10)" : "rgba(156,163,175,0.10)",
                            color: !["Approved", "Rejected", "Delivered"].includes(o.status) ? CR : B.textMuted,
                            border: `1px solid ${!["Approved", "Rejected", "Delivered"].includes(o.status) ? `${CR}33` : "rgba(156,163,175,0.22)"}`,
                            cursor: !["Approved", "Rejected", "Delivered"].includes(o.status) ? "pointer" : "not-allowed",
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredOrders.length === 0 && (
              <div className="p-4 text-center" style={{ color: B.textMuted }}>No orders found</div>
            )}
          </div>
        </GlassCard>
      )}

      {activeTab === "customers" && (
        <GlassCard>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
            <h3 className="font-semibold text-base" style={{ color: B.text }}>Customer Database</h3>
            <p className="text-xs mt-0.5" style={{ color: B.textMuted }}>All registered customers and their order history</p>
            <div className="flex items-center gap-2.5 flex-1 min-w-0 max-w-sm mt-3 px-3 py-2 rounded-xl"
              style={{ background: "rgba(255,255,255,0.40)", border: "1px solid rgba(255,255,255,0.50)", backdropFilter: "blur(10px)" }}>
              <Search size={14} style={{ color: B.textFaint }} />
              <input 
                value={customerSearch} 
                onChange={(e) => setCustomerSearch(e.target.value)} 
                placeholder="Search customers…" 
                className="flex-1 bg-transparent text-sm outline-none" 
                style={{ color: B.text }} 
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.05)", background: "rgba(255,255,255,0.15)" }}>
                  {["Customer ID","Name","Location","Total Orders","Lifetime Value","Customer Since","Action"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider" style={{ color: B.textMuted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map(c => (
                  <tr key={c.id} className="transition-colors hover:bg-white/20" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                    <td className="py-3.5 px-4 text-xs" style={{ color: B.textMuted, fontFamily: "monospace" }}>{c.id}</td>
                    <td className="py-3.5 px-4 text-sm font-medium" style={{ color: B.text }}>{c.name}</td>
                    <td className="py-3.5 px-4 text-sm" style={{ color: B.textMuted }}><span className="flex items-center gap-1"><MapPin size={11} />{c.location}</span></td>
                    <td className="py-3.5 px-4 text-sm font-semibold" style={{ color: B.text }}>{c.orders}</td>
                    <td className="py-3.5 px-4 text-sm font-semibold" style={{ color: CG }}>{c.value}</td>
                    <td className="py-3.5 px-4 text-sm" style={{ color: B.textMuted }}>{c.since}</td>
                    <td className="py-3.5 px-4">
                      <button type="button" onClick={() => setSelectedCustomer(c)} aria-label="View customer details" className="p-1.5 rounded-lg hover:bg-white/30" style={{ color: B.textMuted }}><Eye size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredCustomers.length === 0 && (
              <div className="p-4 text-center" style={{ color: B.textMuted }}>No customers found</div>
            )}
          </div>
        </GlassCard>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.28)" }}>
          <GlassCard className="w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-bold" style={{ color: B.text }}>Order Details</h2>
                <p className="text-xs mt-1" style={{ color: B.textMuted }}>{selectedOrder.ref}</p>
              </div>
              <button type="button" onClick={() => { setSelectedOrder(null); setOrderDetails(null); }} className="p-2 rounded-lg hover:bg-white/30" style={{ color: B.textMuted }}><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm mb-6">
              <div><span className="font-semibold" style={{ color: B.text }}>Order Number:</span> {selectedOrder.ref}</div>
              <div><span className="font-semibold" style={{ color: B.text }}>Customer:</span> {selectedOrder.customer}</div>
              <div><span className="font-semibold" style={{ color: B.text }}>Date:</span> {selectedOrder.date}</div>
              <div><span className="font-semibold" style={{ color: B.text }}>Status:</span> {selectedOrder.status}</div>
              <div><span className="font-semibold" style={{ color: B.text }}>Total Amount:</span> ₹{selectedOrder.value.toLocaleString()}</div>
            </div>
            <h3 className="font-semibold mb-3" style={{ color: B.text }}>Items</h3>
            {orderDetailsLoading && <p className="text-sm" style={{ color: B.textMuted }}>Loading items...</p>}
            {!orderDetailsLoading && orderDetails && (
              <>
                <div className="space-y-2">
                  {orderDetails.items.map((item) => (
                    <div key={item.id} className="grid grid-cols-4 gap-3 text-sm py-2 border-b border-black/5">
                      <span style={{ color: B.text }}>{item.productName}</span>
                      <span style={{ color: B.textMuted }}>Qty {item.quantity}</span>
                      <span style={{ color: B.textMuted }}>₹{item.unitPrice.toLocaleString()}</span>
                      <span className="text-right" style={{ color: B.text }}>₹{item.totalPrice.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-3 mt-4 font-bold" style={{ color: B.text }}>Grand Total: ₹{orderDetails.grandTotal.toLocaleString()}</div>
              </>
            )}
          </GlassCard>
        </div>
      )}

      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.28)" }}>
          <GlassCard className="w-full max-w-lg p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-bold" style={{ color: B.text }}>Customer Details</h2>
                <p className="text-xs mt-1" style={{ color: B.textMuted }}>{selectedCustomer.id}</p>
              </div>
              <button type="button" onClick={() => setSelectedCustomer(null)} aria-label="Close customer details" className="p-2 rounded-lg hover:bg-white/30" style={{ color: B.textMuted }}><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs uppercase tracking-wide" style={{ color: B.textMuted }}>Name</p><p className="font-semibold" style={{ color: B.text }}>{selectedCustomer.name}</p></div>
              <div><p className="text-xs uppercase tracking-wide" style={{ color: B.textMuted }}>Contact Person</p><p style={{ color: B.text }}>{selectedCustomer.contactPerson || "—"}</p></div>
              <div><p className="text-xs uppercase tracking-wide" style={{ color: B.textMuted }}>Email</p><p style={{ color: B.text }}>{selectedCustomer.email || "—"}</p></div>
              <div><p className="text-xs uppercase tracking-wide" style={{ color: B.textMuted }}>Phone</p><p style={{ color: B.text }}>{selectedCustomer.phone || "—"}</p></div>
              <div><p className="text-xs uppercase tracking-wide" style={{ color: B.textMuted }}>Location</p><p style={{ color: B.text }}>{selectedCustomer.location || "—"}</p></div>
              <div><p className="text-xs uppercase tracking-wide" style={{ color: B.textMuted }}>State</p><p style={{ color: B.text }}>{selectedCustomer.state || "—"}</p></div>
              <div><p className="text-xs uppercase tracking-wide" style={{ color: B.textMuted }}>Total Orders</p><p style={{ color: B.text }}>{selectedCustomer.orders}</p></div>
              <div><p className="text-xs uppercase tracking-wide" style={{ color: B.textMuted }}>Lifetime Value</p><p style={{ color: B.text }}>{selectedCustomer.value}</p></div>
              <div><p className="text-xs uppercase tracking-wide" style={{ color: B.textMuted }}>Customer Since</p><p style={{ color: B.text }}>{selectedCustomer.since}</p></div>
              <div><p className="text-xs uppercase tracking-wide" style={{ color: B.textMuted }}>Status</p><p style={{ color: B.text }}>{selectedCustomer.status}</p></div>
            </div>
            <div className="flex justify-end mt-6">
              <SecondaryButton onClick={() => setSelectedCustomer(null)}>Close</SecondaryButton>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

// ─── Transport Page ───────────────────────────────────────────────────────────
function TransportPage({ setShowCreateDispatch }: { setShowCreateDispatch?: (show: boolean) => void }) {
  const { metrics, shipments, fleetStatus, loading, error, confirmDelivery, updateStatus, refreshData } = useTransport();
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [deliveryDetails, setDeliveryDetails] = useState<Awaited<ReturnType<typeof getDeliveryDetails>> | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [isEditingDelivery, setIsEditingDelivery] = useState(false);
  const [editVehicleId, setEditVehicleId] = useState<string>("");
  const [editDriverId, setEditDriverId] = useState<string>("");
  const [editExpectedDate, setEditExpectedDate] = useState<string>("");
  const [deliveryOptions, setDeliveryOptions] = useState<{ vehicles: DeliveryOption[]; drivers: DeliveryOption[] }>({ vehicles: [], drivers: [] });
  const [savingDelivery, setSavingDelivery] = useState(false);

  async function handleOpenDetails(deliveryId: string) {
    try {
      setSelectedDeliveryId(deliveryId);
      setDetailsLoading(true);
      setIsEditingDelivery(false);
      const data = await getDeliveryDetails(deliveryId);
      setDeliveryDetails(data);
      setEditVehicleId(data.vehicleId ?? "");
      setEditDriverId(data.driverId ?? "");
      setEditExpectedDate(data.expectedDeliveryDate ?? "");
      const options = await getDeliveryEditableOptions();
      setDeliveryOptions(options);
    } catch (err) {
      console.error("Failed to load delivery details", err);
      alert(err instanceof Error ? err.message : "Failed to load delivery details");
    } finally {
      setDetailsLoading(false);
    }
  }

  function resetDeliveryEditor() {
    setIsEditingDelivery(false);
    setEditVehicleId(deliveryDetails?.vehicleId ?? "");
    setEditDriverId(deliveryDetails?.driverId ?? "");
    setEditExpectedDate(deliveryDetails?.expectedDeliveryDate ?? "");
  }

  async function handleSaveDeliveryDetails() {
    if (!selectedDeliveryId) return;

    try {
      setSavingDelivery(true);
      const updated = await updateDeliveryDetails(selectedDeliveryId, {
        vehicleId: editVehicleId || null,
        driverId: editDriverId || null,
        expectedDeliveryDate: editExpectedDate || null,
      });
      setDeliveryDetails(updated);
      setEditVehicleId(updated.vehicleId ?? "");
      setEditDriverId(updated.driverId ?? "");
      setEditExpectedDate(updated.expectedDeliveryDate ?? "");
      await refreshData();
      setIsEditingDelivery(false);
    } catch (err) {
      console.error("Failed to save delivery details", err);
      alert(err instanceof Error ? err.message : "Failed to update delivery details");
    } finally {
      setSavingDelivery(false);
    }
  }

  const filteredShipments = shipments.filter(s => {
    const matchesSearch = [s.order, s.vehicle, s.driver, s.dest, s.status]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "All" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExportShipments = () => {
    exportShipmentsToCSV(filteredShipments);
  };

  return (
    <div className="p-6 space-y-5">
      <SectionHeader title="Transport & Delivery" subtitle="Fleet tracking, dispatch, driver assignment and delivery confirmation"
        actions={
          <>
            <SecondaryButton icon={Download} onClick={handleExportShipments}>Export</SecondaryButton>
            <PrimaryButton icon={Plus} onClick={() => setShowCreateDispatch?.(true)}>New Dispatch</PrimaryButton>
          </>
        } />

      {loading && (
        <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.25)" }}>
          Loading transport data…
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl" style={{ background: "rgba(239,68,68,0.08)", color: CR }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard icon={CheckCircle}   label="Delivered"         value={String(metrics.delivered)} sub="+6% this month"    accentColor={CG}  />
        <KPICard icon={Clock}         label="Pending Dispatch"  value={String(metrics.pending)}  sub="Awaiting dispatch"  accentColor={CGo} />
        <KPICard icon={Truck}         label="Dispatched"        value={String(metrics.dispatched)}   sub="Left warehouse"     accentColor={CT}  />
        <KPICard icon={Activity}      label="In Transit"        value={String(metrics.inTransit)}   sub="On the road now"    accentColor={CB}  />
        <KPICard icon={AlertTriangle} label="Delayed"           value={String(metrics.delayed)}   sub="Needs attention"    accentColor={CR}  />
      </div>

      <GlassCard>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
          <h3 className="font-semibold text-base" style={{ color: B.text }}>Shipment Tracker</h3>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2.5 flex-1 min-w-0 max-w-xs px-3 py-2 rounded-xl"
              style={{ background: "rgba(255,255,255,0.40)", border: "1px solid rgba(255,255,255,0.50)", backdropFilter: "blur(10px)" }}>
              <Search size={14} style={{ color: B.textFaint }} />
              <input 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                placeholder="Search shipments…" 
                className="flex-1 bg-transparent text-sm outline-none" 
                style={{ color: B.text }} 
              />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 text-sm rounded-xl outline-none"
              style={{ background: "rgba(255,255,255,0.40)", border: "1px solid rgba(255,255,255,0.50)", color: B.text }}>
              <option value="All">All Status</option>
              <option value="Approved">Approved</option>
            </select>
            
          </div>
        </div>
        <div className="overflow-x-auto">
          {filteredShipments.length === 0 ? (
            <div className="p-6 text-center text-sm" style={{ color: B.textMuted }}>
              No shipments match the current search or status filter.
            </div>
          ) : (
          <table className="w-full min-w-[800px]">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.05)", background: "rgba(255,255,255,0.15)" }}>
                {["Order No.","Vehicle","Driver","Destination","Dispatch","Delivery","Status","Actions"].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider" style={{ color: B.textMuted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredShipments.map(s => (
                <tr key={s.id} className="transition-colors hover:bg-white/20" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                  <td className="py-3.5 px-4 text-sm font-bold" style={{ color: B.text, fontFamily: "monospace" }}>{s.order}</td>
                  <td className="py-3.5 px-4 text-sm" style={{ color: B.textMuted, fontFamily: "monospace" }}>{s.vehicle}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: B.nav }}>{s.driver.split(" ").map(w => w[0]).join("")}</div>
                      <span className="text-sm" style={{ color: B.text }}>{s.driver}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-sm" style={{ color: B.textMuted }}><span className="flex items-center gap-1"><MapPin size={11} />{s.dest}</span></td>
                  <td className="py-3.5 px-4 text-sm" style={{ color: B.textMuted }}>{s.dispatch}</td>
                  <td className="py-3.5 px-4 text-sm" style={{ color: B.textMuted }}>{s.delivery}</td>
                  <td className="py-3.5 px-4"><StatusBadge status={s.status} /></td>
                  <td className="py-3.5 px-4">
                    <div className="text-xs" style={{ color: B.textMuted }}>Select for dispatch</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </GlassCard>

      {selectedDeliveryId && (
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h3 className="font-semibold text-base" style={{ color: B.text }}>Delivery Details</h3>
            <button type="button" onClick={() => { setSelectedDeliveryId(null); setDeliveryDetails(null); }} className="text-xs font-semibold" style={{ color: B.textMuted }}>Close</button>
          </div>
          {detailsLoading && <div className="text-sm" style={{ color: B.textMuted }}>Loading delivery details…</div>}
          {!detailsLoading && deliveryDetails && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3 text-sm" style={{ color: B.textSub }}>
                <div><span className="font-semibold" style={{ color: B.text }}>Order:</span> {deliveryDetails.orderNumber}</div>
                <div><span className="font-semibold" style={{ color: B.text }}>Destination:</span> {deliveryDetails.customerCity}</div>
                <div>
                  <span className="font-semibold" style={{ color: B.text }}>Vehicle:</span>
                  {isEditingDelivery ? (
                    <select value={editVehicleId} onChange={(e) => setEditVehicleId(e.target.value)} className="ml-2 px-2 py-1 rounded-lg text-sm" style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)" }}>
                      <option value="">Select vehicle</option>
                      {deliveryOptions.vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>{vehicle.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="ml-2">{deliveryDetails.vehicleNumber}</span>
                  )}
                </div>
                <div>
                  <span className="font-semibold" style={{ color: B.text }}>Driver:</span>
                  {isEditingDelivery ? (
                    <select value={editDriverId} onChange={(e) => setEditDriverId(e.target.value)} className="ml-2 px-2 py-1 rounded-lg text-sm" style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)" }}>
                      <option value="">Select driver</option>
                      {deliveryOptions.drivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>{driver.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="ml-2">{deliveryDetails.driverName}</span>
                  )}
                </div>
                <div><span className="font-semibold" style={{ color: B.text }}>Dispatch:</span> {deliveryDetails.dispatchDate ?? "N/A"}</div>
                <div>
                  <span className="font-semibold" style={{ color: B.text }}>Expected:</span>
                  {isEditingDelivery ? (
                    <input type="date" value={editExpectedDate} onChange={(e) => setEditExpectedDate(e.target.value)} className="ml-2 px-2 py-1 rounded-lg text-sm" style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)" }} />
                  ) : (
                    <span className="ml-2">{deliveryDetails.expectedDeliveryDate ?? "N/A"}</span>
                  )}
                </div>
                <div><span className="font-semibold" style={{ color: B.text }}>Delivery:</span> {deliveryDetails.deliveryDate ?? "N/A"}</div>
                <div><span className="font-semibold" style={{ color: B.text }}>Status:</span> <StatusBadge status={deliveryDetails.status} /></div>
                <div className="flex items-center gap-2 pt-2">
                  {deliveryDetails.status === "Created" && !isEditingDelivery && (
                    <PrimaryButton icon={ArrowRight} onClick={() => setIsEditingDelivery(true)}>Edit</PrimaryButton>
                  )}
                  {deliveryDetails.status === "Loaded" && !isEditingDelivery && (
                    <PrimaryButton icon={ArrowRight} onClick={() => setIsEditingDelivery(true)}>Edit</PrimaryButton>
                  )}
                  {isEditingDelivery && (
                    <>
                      <PrimaryButton icon={CheckCircle} onClick={() => void handleSaveDeliveryDetails()} disabled={savingDelivery}>{savingDelivery ? "Saving..." : "Save"}</PrimaryButton>
                      <SecondaryButton icon={X} onClick={resetDeliveryEditor}>Cancel</SecondaryButton>
                    </>
                  )}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2" style={{ color: B.text }}>Tracking History</h4>
                <div className="space-y-2 max-h-64 overflow-auto">
                  {deliveryDetails.tracking.length === 0 ? (
                    <p className="text-xs" style={{ color: B.textMuted }}>No tracking history yet.</p>
                  ) : deliveryDetails.tracking.map((entry, index) => (
                    <div key={`${entry.updated_at}-${index}`} className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(255,255,255,0.25)" }}>
                      <div className="font-semibold" style={{ color: B.text }}>{entry.status}</div>
                      <div style={{ color: B.textMuted }}>{entry.remarks ?? "No remarks"}</div>
                      <div style={{ color: B.textFaint }}>{new Date(entry.updated_at).toLocaleString("en-IN")}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      )}

      <GlassCard className="p-5">
        <h3 className="font-semibold text-base mb-4" style={{ color: B.text }}>Vehicle Allocation & Fleet Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {fleetStatus.length === 0 ? (
            <p className="text-xs" style={{ color: B.textMuted }}>No fleet data available</p>
          ) : (
            fleetStatus.map((vehicle, idx) => (
              <div key={idx} className="p-4 rounded-xl"
                style={{ background: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.45)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Truck size={14} style={{ color: B.green }} />
                  <span className="text-xs font-bold" style={{ color: B.text, fontFamily: "monospace" }}>{vehicle.vehicleNumber}</span>
                </div>
                <p className="text-xs mb-1" style={{ color: B.textMuted }}>Driver: {vehicle.driverName}</p>
                <p className="text-xs mb-3" style={{ color: B.textMuted }}>→ {vehicle.destination}</p>
                <div className="flex items-center justify-between">
                  <StatusBadge status={vehicle.status} />
                  <span className="text-xs" style={{ color: B.textFaint }}>{vehicle.vehicleStatus === "Active" ? "Active" : "Idle"}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Admin / RBAC Page ────────────────────────────────────────────────────────
function AdminPage({ user }: { user: AppUser }) {
  const isVC = user.role === "Vice Chairman";
  const isVicePresident = user.role === "Vice President";
  const [activeTab, setActiveTab] = useState<"roles"|"audit">("roles");

  if (!canViewAdmin(user.role)) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <GlassCard className="p-10 text-center max-w-sm">
          <Lock size={24} className="mx-auto mb-4" style={{ color: B.textFaint }} />
          <h2 className="text-lg font-bold mb-2" style={{ color: B.text }}>Access Restricted</h2>
          <p className="text-sm" style={{ color: B.textSub }}>Admin & RBAC requires Vice Chairman or Vice President level access.</p>
          <p className="text-xs mt-2" style={{ color: B.textMuted }}>Your role: <strong>{user.role}</strong></p>
        </GlassCard>
      </div>
    );
  }


  return (
    <div className="p-6 space-y-5">
      <SectionHeader title="Admin & RBAC" subtitle="Roles & permissions and audit logs" />

      {/* VC-only notice */}
      {isVicePresident && (
        <div className="p-3 rounded-xl flex items-center gap-2"
          style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)" }}>
          <Lock size={13} style={{ color: CR }} />
          <p className="text-xs" style={{ color: CR }}>
            Vice President cannot modify or suspend the Vice Chairman account. Only the Vice Chairman can manage Vice President accounts.
          </p>
        </div>
      )}

      <div className="flex rounded-2xl overflow-hidden w-fit"
        style={{ border: "1px solid rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.20)" }}>
        {(["roles","audit"] as const).map(t => (
          <button type="button" key={t} onClick={() => setActiveTab(t)}
            className="px-5 py-2.5 text-sm font-medium transition-all"
            style={{ background: activeTab === t ? "rgba(255,255,255,0.55)" : "transparent",
              color: activeTab === t ? B.nav : B.textMuted, fontWeight: activeTab === t ? 600 : 400,
              borderRight: t !== "audit" ? "1px solid rgba(255,255,255,0.40)" : "none" }}>
            {t === "roles" ? "Roles & Permissions" : "Audit Log"}
          </button>
        ))}
      </div>

      {/* Employee Directory removed from Admin page — manage employees under Employees module */}

      {activeTab === "roles" && (
        <GlassCard className="p-5">
          <h3 className="font-semibold text-base mb-4" style={{ color: B.text }}>Role Permission Matrix</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                  <th className="text-left py-3 px-4 text-xs font-bold" style={{ color: B.textMuted }}>Role</th>
                  {["View All","Approve Bills","Submit Bills","Manage Users","Delete Users","Reports","Communication"].map(p => (
                    <th key={p} className="text-center py-3 px-3 text-xs font-bold" style={{ color: B.textMuted }}>{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { role: "Vice Chairman",    perms: [true,  true,  true,  true,  true,  true,  "All levels"] },
                  { role: "Vice President",          perms: [true,  true,  true,  true,  false, true,  "All levels"] },
                  { role: "MD-Manufacturing", perms: [false, true,  true,  false, false, true,  "VC / Vice President"] },
                  { role: "General Manager",  perms: [false, true,  true,  false, false, true,  "→ MD only"] },
                  { role: "Chief Manager",    perms: [false, false, false, false, false, false, "→ GM only"] },
                  { role: "Manager",          perms: [false, false, true,  false, false, false, "→ CM only"] },
                  { role: "Supervisor",       perms: [false, false, false, false, false, true,  "→ Mgr only"] },
                  { role: "Worker",           perms: [false, false, false, false, false, false, "→ Spv only"] },
                ].map(r => (
                  <tr key={r.role} className="hover:bg-white/15" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                    <td className="py-3.5 px-4"><RoleBadge role={r.role as Role} /></td>
                    {r.perms.map((p, i) => (
                      <td key={i} className="py-3.5 px-3 text-center">
                        {typeof p === "string"
                          ? <span className="text-xs font-medium" style={{ color: B.textMuted }}>{p}</span>
                          : p ? <CheckCircle size={15} style={{ color: CG }} className="mx-auto" />
                               : <XCircle size={15} style={{ color: "rgba(0,0,0,0.12)" }} className="mx-auto" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {activeTab === "audit" && <AuditLogPage />}
    </div>
  );
}

// ─── Reports Page ─────────────────────────────────────────────────────────────
function ReportsPage({ user }: { user: AppUser }) {
  const { stats } = useDashboard(user);
  const [reportType, setReportType] = useState<ReportType>("Attendance");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [department, setDepartment] = useState("All Departments");
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const REPORT_TYPES: ReportType[] = ["Attendance", "Bills", "Marketing", "Transport", "Community Impact"];

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const report = await generateReport(reportType, {
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        department: department === "All Departments" ? undefined : department,
        userDepartment: user.department,
      });
      setGeneratedReport(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate this report.");
      setGeneratedReport(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: ReportExportFormat) => {
    if (!generatedReport) return;
    if (format === "csv") exportReportToCSV(generatedReport);
    if (format === "excel") exportReportToExcel(generatedReport);
    if (format === "pdf") exportReportToPDF(generatedReport);
  };

  useEffect(() => {
    void handleGenerate();
  }, []);

  return (
    <div className="p-6 space-y-5">
      <SectionHeader title="Reports & Analytics"
        subtitle="Generate, filter and export reports across all departments"
        actions={
          <div className="flex gap-2">
            <SecondaryButton icon={Download} onClick={() => handleExport("pdf")}>Export PDF</SecondaryButton>
            <SecondaryButton icon={Download} onClick={() => handleExport("excel")}>Export Excel</SecondaryButton>
            <SecondaryButton icon={Download} onClick={() => handleExport("csv")}>Export CSV</SecondaryButton>
          </div>
        } />

      <GlassCard className="p-5">
        <h3 className="font-semibold text-base mb-4" style={{ color: B.text }}>Report Builder</h3>
        <div className="flex flex-wrap gap-2 mb-5">
          {REPORT_TYPES.map(t => (
            <button type="button" key={t} onClick={() => setReportType(t)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: reportType === t ? B.nav : "rgba(255,255,255,0.35)",
                border: reportType === t ? `1px solid ${B.navLight}` : "1px solid rgba(255,255,255,0.50)",
                color: reportType === t ? "white" : B.textMuted,
                fontWeight: reportType === t ? 600 : 400,
                boxShadow: reportType === t ? `0 4px 14px ${B.nav}40` : "none",
              }}>{t}</button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div>
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: B.textMuted }}>From Date</label>
            <input value={fromDate} onChange={(e) => setFromDate(e.target.value)} type="date" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: B.textMuted }}>To Date</label>
            <input value={toDate} onChange={(e) => setToDate(e.target.value)} type="date" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: B.textMuted }}>Department</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }}>
              <option>All Departments</option>
              {['Administration','Manufacturing','Marketing','Transport','Research & Development'].map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap mb-6">
          <PrimaryButton icon={BarChart2} onClick={() => void handleGenerate()}>Generate Report</PrimaryButton>
        </div>

        <div className="p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.40)" }}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-sm" style={{ color: B.text }}>{reportType} Report — Preview</h4>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: B.greenLight, color: CG }}>{generatedReport?.subtitle ?? "Live data"}</span>
          </div>

          {loading && <div className="text-sm" style={{ color: B.textMuted }}>Generating report…</div>}
          {error && <div className="text-sm" style={{ color: CR }}>{error}</div>}
          {!loading && !error && !generatedReport && <div className="text-sm" style={{ color: B.textMuted }}>Generate a report to preview live data.</div>}

          {generatedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {generatedReport.metrics.map((metric) => (
                  <div key={metric.label} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.30)", border: "1px solid rgba(255,255,255,0.45)" }}>
                    <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: B.textMuted }}>{metric.label}</div>
                    <div className="text-lg font-semibold mt-1" style={{ color: B.text }}>{metric.value}</div>
                    <div className="text-xs mt-1" style={{ color: B.textSub }}>{metric.detail}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.20)", border: "1px solid rgba(255,255,255,0.40)" }}>
                <ResponsiveContainer width="100%" height={220}>
                  {generatedReport.chartKind === "line" ? (
                    <LineChart data={generatedReport.chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: B.textMuted }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: B.textMuted }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TT} />
                      <Line dataKey="value" stroke={CG} strokeWidth={2.5} dot={{ fill: CG, r: 4, strokeWidth: 0 }} />
                    </LineChart>
                  ) : (
                    <BarChart data={generatedReport.chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: B.textMuted }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: B.textMuted }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TT} />
                      <Bar dataKey="value" fill={CG} radius={[4,4,0,0]} />
                      {generatedReport.chartData.some((item) => item.secondaryValue != null) && <Bar dataKey="secondaryValue" fill={CB} radius={[4,4,0,0]} />}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {generatedReport.tableRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between rounded-xl p-3" style={{ background: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.40)" }}>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: B.text }}>{row.label}</div>
                      {row.detail && <div className="text-xs" style={{ color: B.textMuted }}>{row.detail}</div>}
                    </div>
                    <div className="text-sm font-medium" style={{ color: B.text }}>{row.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Notifications Page ───────────────────────────────────────────────────────

function NotificationsPage({
  notifications,
  onMarkAllRead,
  onMarkRead,
}: {
  notifications: NotificationRecord[];
  onMarkAllRead: () => void;
  onMarkRead?: (notificationId: string) => Promise<void>;
}) {
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all"
    ? notifications
    : filter === "unread"
      ? notifications.filter((n) => !n.read)
      : notifications.filter((n) => getNotificationCategory(n.type) === filter);

  const icons: Record<string,any>    = {
    approval: CheckCircle, order: ShoppingCart, attendance: Calendar,
    recruit: UserCheck, suspension: UserX, delivery: Truck,
    bill: FileText, outreach: Globe2, rejection: XCircle, announce: Bell,
  };
  const colors: Record<string,string> = {
    approval: CG, order: CB, attendance: CGo, recruit: CG, suspension: CR,
    delivery: CT, bill: CGo, outreach: CB, rejection: CR, announce: B.purple,
  };

  return (
    <div className="p-6 space-y-5">
      <SectionHeader title="Notifications"
        subtitle={`${notifications.filter((n) => !n.read).length} unread — organisational updates and approvals`}
        actions={<SecondaryButton icon={CheckSquare} onClick={() => void onMarkAllRead()}>Mark All Read</SecondaryButton>} />

      <div className="flex gap-2 flex-wrap">
        {["all","unread","approval","order","attendance","recruit","suspension","delivery","bill"].map(f => (
          <button type="button" key={f} onClick={() => setFilter(f)}
            className="px-4 py-2 text-sm font-medium rounded-xl capitalize transition-all"
            style={{ background: filter === f ? B.nav : "rgba(255,255,255,0.30)", border: filter === f ? `1px solid ${B.navLight}` : "1px solid rgba(255,255,255,0.50)",
              color: filter === f ? "white" : B.textMuted, fontWeight: filter === f ? 600 : 400,
              boxShadow: filter === f ? `0 4px 14px ${B.nav}40` : "none" }}>{f}</button>
        ))}
      </div>

      <GlassCard className="overflow-hidden">
        {filtered.length === 0 && (
          <div className="py-12 text-center" style={{ color: B.textFaint }}>No notifications in this category.</div>
        )}
        {filtered.map((n, i) => {
          const category = getNotificationCategory(n.type);
          const Icon = icons[category] || Bell;
          const color = colors[category] || CB;
          return (
            <div key={i} className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-white/15"
              style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
                background: !n.read ? "rgba(78,128,80,0.04)" : "transparent" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: `${color}18` }}>
                <Icon size={16} style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: B.text }}>{n.title}</span>
                  {!n.read && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: CG }} />}
                </div>
                <p className="text-sm mt-0.5" style={{ color: B.textSub }}>{n.message}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className="text-xs" style={{ color: B.textFaint }}>
                  {n.created_at ? new Date(n.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Just now"}
                </span>
                {!n.read && <button type="button" title="Mark as read" aria-label="Mark notification as read" disabled={!onMarkRead} onClick={() => { void onMarkRead?.(n.id).catch((err) => alert(err instanceof Error ? err.message : "Unable to mark notification as read")); }} className="p-1 rounded-md hover:bg-white/20 disabled:opacity-40" style={{ color: B.textFaint }}><CheckCircle size={15} /></button>}
              </div>
            </div>
          );
        })}
      </GlassCard>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const { profile, loading } = useAuth();
  const { notifications } = useNotifications(profile?.id);

  const [page, setPage] = useState<Page>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1440
  );
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showCreateDispatch, setShowCreateDispatch] = useState(false);
  const [employeeRoute, setEmployeeRoute] = useState<EmployeeRoute>("directory");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    const handle = () => setWindowWidth(window.innerWidth);

    window.addEventListener("resize", handle);

    return () =>
      window.removeEventListener("resize", handle);
  }, []);

  useEffect(() => {
    const syncEmployeeRoute = () => {
      const routePath = getEmployeeRoutePath();
      const parts = routePath.split("/").filter(Boolean);
      if (parts[0] !== "employees") {
        setEmployeeRoute("directory");
        setSelectedEmployeeId(null);
        return;
      }

      if (parts[1] === "attendance") {
        setEmployeeRoute("attendance");
        setSelectedEmployeeId(null);
      } else if (parts[1] === "organization") {
        setEmployeeRoute("organization");
        setSelectedEmployeeId(null);
      } else if (parts[1]) {
        setEmployeeRoute("profile");
        setSelectedEmployeeId(parts[1]);
      } else {
        setEmployeeRoute("directory");
        setSelectedEmployeeId(null);
      }

      setPage("employees");
    };

    syncEmployeeRoute();
    window.addEventListener("hashchange", syncEmployeeRoute);

    return () => window.removeEventListener("hashchange", syncEmployeeRoute);
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  const isMobile = windowWidth < 768;

  if (!profile)
  return <LoginPage />;

  const notifCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllNotificationsRead = async () => {
    if (!profile?.id) return;
    await markAllAsRead(profile.id);
  };

  const safeNavAccess = (p: Page) => {
    const item = NAV_ITEMS.find(n => n.id === p);
    return item ? navAccess(item, profile) : false;
  };

  function handleNav(p: Page) {
    if (!safeNavAccess(p)) return;
    setPage(p);
    if (p === "employees") {
      window.location.hash = "#/employees";
    } else if (p === "organization") {
      window.location.hash = "#/employees/organization";
    } else if (typeof window !== "undefined" && window.location.hash.startsWith("#/employees")) {
      window.location.hash = "";
    }
  }

  const renderPage = () => {
    if (showCreateOrder) {
      return <CreateOrderPage onClose={() => setShowCreateOrder(false)} onSubmit={() => setShowCreateOrder(false)} />;
    }

    if (showCreateDispatch) {
      return <CreateDispatchPage onClose={() => setShowCreateDispatch(false)} onSubmit={() => setShowCreateDispatch(false)} />;
    }

    if (!safeNavAccess(page)) {
      return (
        <div className="p-6 flex items-center justify-center min-h-64">
          <GlassCard className="p-10 text-center max-w-sm">
            <Lock size={24} className="mx-auto mb-4" style={{ color: B.textFaint }} />
            <h2 className="text-lg font-bold mb-2" style={{ color: B.text }}>Access Denied</h2>
            <p className="text-sm" style={{ color: B.textSub }}>Your role does not have permission to access this module.</p>
            <button type="button" onClick={() => setPage("dashboard")} className="mt-4 text-sm font-medium hover:underline" style={{ color: B.green }}>
              Go to Dashboard
            </button>
          </GlassCard>
        </div>
      );
    }
    if (page === "profile") {
      return <EmployeeProfilePage employeeId={profile.id} editable currentUserId={profile.id} currentUserRole={profile.role} />;
    }

    if (page === "employees") {
      if (employeeRoute === "profile") {
        return <EmployeeProfilePage employeeId={selectedEmployeeId ?? ""} editable currentUserId={profile.id} currentUserRole={profile.role} />;
      }
      if (employeeRoute === "attendance") {
        return <EmployeeAttendancePage currentUser={{ id: profile.id, role: profile.role, department: profile.department }} />;
      }
      if (employeeRoute === "organization") {
        return <OrganizationChartPage currentUser={{ id: profile.id, role: profile.role }} onSelectEmployee={(employeeId) => {
          setSelectedEmployeeId(employeeId);
          window.location.hash = `#/employees/${employeeId}`;
        }} />;
      }
      return <EmployeeDirectoryPage currentUser={profile} onSelectEmployee={(employeeId) => {
        setSelectedEmployeeId(employeeId);
        window.location.hash = `#/employees/${employeeId}`;
      }} />;
    }

    switch (page) {
      case "organization": return <OrganizationChartPage currentUser={{ id: profile.id, role: profile.role }} onSelectEmployee={(employeeId) => {
        setSelectedEmployeeId(employeeId);
        window.location.hash = `#/employees/${employeeId}`;
      }} />;
      case "dashboard":     return <DashboardPage user={profile} />;
      case "attendance":    return <EmployeeAttendancePage currentUser={{ id: profile.id, role: profile.role, department: profile.department }} />;
      case "bills":         return <BillsPage user={profile} />;
      case "marketing":     return <MarketingPage setShowCreateOrder={setShowCreateOrder} />;
      case "transport":     return <TransportPage setShowCreateDispatch={setShowCreateDispatch} />;
      case "admin":         return <AdminPage user={profile} />;
      case "reports":       return <ReportsPage user={profile} />;
      case "notifications": return <NotificationsPage notifications={notifications} onMarkAllRead={handleMarkAllNotificationsRead} />;
      default:              return <DashboardPage user={profile} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: B.bgSolid, fontFamily: "Inter, sans-serif" }}>
      <Sidebar
        user={profile} page={page} onNav={handleNav}
        collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobile={isMobile} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)}
        onViewProfile={() => handleNav("profile")}
      />
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden" style={{ background: B.bg }}>
        <TopBar user={profile} onMenuClick={() => setMobileOpen(true)} onNav={handleNav} notifCount={notifCount} onNotifClick={() => handleNav("notifications")} onViewProfile={() => handleNav("profile")} />
        <main className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          <style>{`main::-webkit-scrollbar{display:none}`}</style>
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export {
  AdminPage,
  AttendancePage,
  BillsPage,
  DashboardPage,
  MarketingPage,
  NotificationsPage,
  ReportsPage,
  TransportPage,
  LoginPage,
  Sidebar,
  TopBar,
  GlassCard,
  B,
  NAV_ITEMS,
  navAccess,
  getEmployeeRoutePath,
};

export type { AppUser, EmployeeRoute, Page };
