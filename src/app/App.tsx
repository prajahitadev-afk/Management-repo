import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { usePortalTheme } from "../hooks/usePortalTheme";
import { useNotifications } from "../hooks/useNotifications";
import { ThemeToggle } from "../components/ThemeToggle";
import { CreateOrderPage } from "./CreateOrderPage";
import { CreateDispatchPage } from "./CreateDispatchPage";
import { EmployeeDirectoryPage } from "../pages/employees/EmployeeDirectoryPage";
import { EmployeeProfilePage } from "../pages/employees/EmployeeProfilePage";
import { AttendancePage as EmployeeAttendancePage } from "../pages/employees/AttendancePage";
import { OrganizationChartPage } from "../pages/employees/OrganizationChartPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";
import AuditLogPage from "../pages/AuditLogPage";
import { LeavePage } from "../pages/leave/LeavePage";
import { PaymentsPage } from "../pages/PaymentsPage";
import DepartmentPage from "../pages/department/DepartmentPage";
import {
  AdminPage,
  BillsPage,
  DashboardPage,
  MarketingPage,
  NotificationsPage,
  ReportsPage,
  TransportPage,
  LoginPage,
} from "./AppImplementation";
import { B, GlassCard, Sidebar, TopBar, NAV_ITEMS, navAccess } from "../components/portal";
import type { AppUser, EmployeeRoute, Page } from "../components/portal";

function getEmployeeRoutePath() {
  if (typeof window === "undefined") return "";
  const hash = window.location.hash.replace(/^#\/?/, "");
  const path = window.location.pathname.replace(/^\/?/, "");
  return hash || path;
}

function getRecoverySearchParams() {
  if (typeof window === "undefined") return new URLSearchParams();

  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#\/?/, ""));
  for (const [key, value] of hashParams.entries()) {
    if (!params.has(key)) {
      params.set(key, value);
    }
  }

  return params;
}

function getDepartmentRoute(routePath: string): { department?: string; tab?: string } | null {
  const parts = routePath.split("/").filter(Boolean);
  if (parts[0] !== "department" || parts.length > 3) return null;
  const departments = new Set(["administration", "manufacturing", "marketing", "transportation", "transport", "research", "research-and-development", "rd"]);
  if (parts[1] && !departments.has(parts[1].toLowerCase())) return null;
  return { department: parts[1], tab: parts[2] };
}

function NotFoundPage() {
  return <main className="flex min-h-full items-center justify-center p-6"><section className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><p className="text-sm font-semibold uppercase tracking-widest text-slate-500">404</p><h1 className="mt-2 text-2xl font-bold text-slate-800">Page not found</h1><p className="mt-2 text-sm text-slate-600">The requested page does not exist.</p><button type="button" onClick={() => { window.history.pushState({}, "", "/"); window.dispatchEvent(new PopStateEvent("popstate")); }} className="mt-5 rounded-lg bg-[#4e8050] px-4 py-2 text-sm font-medium text-white">Go to Dashboard</button></section></main>;
}

export default function App() {
  const { theme, toggleTheme } = usePortalTheme();
  const { profile, loading } = useAuth();
  const {
    notifications,
    loading: notificationsLoading,
    error: notificationsError,
    reload: reloadNotifications,
    markRead: markNotificationRead,
    markAllRead: markAllNotificationsRead,
  } = useNotifications(profile?.id);

  const [page, setPage] = useState<Page>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("portal.sidebar-collapsed") === "true";
    } catch (error) {
      console.error("Unable to read sidebar preference", error);
      return false;
    }
  });
  const [recentPages, setRecentPages] = useState<Page[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1440,
  );
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showCreateDispatch, setShowCreateDispatch] = useState(false);
  const [openBillSubmit, setOpenBillSubmit] = useState(false);
  const [pageSearch, setPageSearch] = useState<{ page: Page; term: string } | null>(null);
  const [employeeRoute, setEmployeeRoute] = useState<EmployeeRoute>("directory");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    const handle = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    try {
      const saved = window.localStorage.getItem(`portal.recent-pages.${profile.id}`);
      if (!saved) {
        setRecentPages([]);
        return;
      }
      const parsed: unknown = JSON.parse(saved);
      const validPages: Page[] = ["dashboard", "attendance", "employees", "department", "leave", "reports", "notifications", "profile", "bills", "orders", "customers", "payments", "collaboration", "transport", "admin", "audit"];
      setRecentPages(Array.isArray(parsed) ? parsed.filter((value): value is Page => typeof value === "string" && validPages.includes(value as Page)).slice(0, 5) : []);
    } catch (error) {
      console.error("Unable to read recent workspace pages", error);
      setRecentPages([]);
    }
  }, [profile?.id]);

  useEffect(() => {
    const syncEmployeeRoute = () => {
      const routePath = getEmployeeRoutePath();
      const parts = routePath.split("/").filter(Boolean);

      if (parts[0] === "profile") {
        setPage("profile");
        setEmployeeRoute("directory");
        setSelectedEmployeeId(null);
        return;
      }

      if (parts[0] === "reset-password") {
        if (typeof window !== "undefined") {
          const search = window.location.search || "";
          window.history.replaceState({}, "", "/reset-password" + search);
        }
        return;
      }

      if (parts[0] === "employees") {
        if (parts[1] === "attendance") {
          setEmployeeRoute("attendance");
          setSelectedEmployeeId(null);
        } else if (parts[1] === "organization") {
          setEmployeeRoute("directory");
          setSelectedEmployeeId(null);
          setPage("organization");
        } else if (parts[1]) {
          setEmployeeRoute("profile");
          setSelectedEmployeeId(parts[1]);
        } else {
          setEmployeeRoute("directory");
          setSelectedEmployeeId(null);
        }
        setPage("employees");
        return;
      }

      const pageRoutes: Record<string, Page> = {
        dashboard: "dashboard",
        attendance: "attendance",
        bills: "bills",
        marketing: "marketing",
        orders: "orders",
        customers: "customers",
        payments: "payments",
        collaboration: "collaboration",
        transport: "transport",
        admin: "admin",
        reports: "reports",
        notifications: "notifications",
        organization: "organization",
        audit: "audit",
        login: "login",
        "leave": "leave",
        "leave/dashboard": "leave",
        "leave/apply": "leave",
        "leave/requests": "leave",
        "leave/approvals": "leave",
        "leave/balance": "leave",
        "department": "department",
      };

      const departmentRoute = getDepartmentRoute(routePath);
      const isDepartmentPath = parts[0] === "department";
      const nextPage = isDepartmentPath ? (departmentRoute ? "department" : "not-found") : routePath === "" ? "dashboard" : pageRoutes[routePath] ?? pageRoutes[parts[0] ?? ""] ?? "not-found";
      setEmployeeRoute("directory");
      setSelectedEmployeeId(null);
      setPage(nextPage);
      if (parts[0] === "login") {
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", "/login");
        }
      }
    };

    syncEmployeeRoute();
    window.addEventListener("hashchange", syncEmployeeRoute);
    window.addEventListener("popstate", syncEmployeeRoute);
    return () => {
      window.removeEventListener("hashchange", syncEmployeeRoute);
      window.removeEventListener("popstate", syncEmployeeRoute);
    };
  }, []);

  useEffect(() => {
    if (!loading && profile && page === "login") {
      setPage("dashboard");
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", "/");
      }
    }
  }, [loading, profile, page]);

  const isResetPasswordPath = typeof window !== "undefined" && window.location.pathname === "/reset-password";
  const isRecoveryUrl = typeof window !== "undefined" && (() => {
    const params = getRecoverySearchParams();
    const detected = params.get("type") === "recovery" || !!params.get("access_token") || !!params.get("refresh_token");
    if (detected) {
      const search = window.location.search || "";
      const hash = window.location.hash || "";
      if (window.location.pathname !== "/reset-password") {
        window.history.replaceState({}, "", "/reset-password" + search + hash);
      }
    }
    return detected;
  })();

  if (isResetPasswordPath || isRecoveryUrl) {
    return (
      <>
        <div className="portal-standalone-theme-toggle"><ThemeToggle theme={theme} onToggle={toggleTheme} /></div>
        <ResetPasswordPage />
      </>
    );
  }

  if (loading) return <div className="portal-loading" role="status" aria-live="polite"><span className="portal-spinner" aria-hidden="true" /><span>Loading your workspace…</span></div>;

  if (page === "login" && !profile) {
    return <LoginPage theme={theme} onToggleTheme={toggleTheme} onLogin={() => {
      setPage("dashboard");
      if (typeof window !== "undefined") window.history.replaceState({}, "", "/");
    }} />;
  }

  if (!profile) {
    return <LoginPage theme={theme} onToggleTheme={toggleTheme} />;
  }

  const isMobile = windowWidth < 768;
  const notifCount = notifications.filter((notification) => !notification.read).length;
  const handleMarkAllNotificationsRead = async () => {
    try {
      await markAllNotificationsRead();
    } catch (error) {
      console.error("Unable to mark all notifications as read", error);
      alert(error instanceof Error ? error.message : "Unable to update notifications.");
    }
  };
  const safeNavAccess = (currentPage: Page) => {
    const accessPage = currentPage === "organization" ? "employees" : currentPage;
    const item = NAV_ITEMS.find((navItem) => navItem.id === accessPage);
    return item ? navAccess(item, profile) : false;
  };

  function rememberPage(nextPage: Page) {
    if (!profile) return;
    const nextRecentPages = [nextPage, ...recentPages.filter((recentPage) => recentPage !== nextPage)].slice(0, 5);
    setRecentPages(nextRecentPages);
    try {
      window.localStorage.setItem(`portal.recent-pages.${profile.id}`, JSON.stringify(nextRecentPages));
    } catch (error) {
      console.error("Unable to save recent workspace pages", error);
    }
  }

  function handleNav(nextPage: Page, searchTerm?: string) {
    if (!safeNavAccess(nextPage)) return;
    setPage(nextPage);
    setPageSearch(searchTerm ? { page: nextPage, term: searchTerm } : null);
    rememberPage(nextPage);
    if (typeof window === "undefined") return;

    if (nextPage === "employees") {
      window.location.hash = "#/employees";
      return;
    }

    const routeMap: Record<Page, string> = {
      login: "/",
      dashboard: "/",
      attendance: "/attendance",
      bills: "/bills",
      marketing: "/marketing",
      orders: "/orders",
      customers: "/customers",
      payments: "/payments",
      collaboration: "/collaboration",
      transport: "/transport",
      admin: "/admin",
      reports: "/reports",
      notifications: "/notifications",
      employees: "/employees",
      organization: "/employees/organization",
      audit: "/audit",
      profile: "/profile",
      leave: "/leave",
      department: "/department",
      "not-found": "/404",
    };

    window.history.pushState({}, "", routeMap[nextPage] ?? "/");
    window.location.hash = "";
  }

  function handleSearchResult(target: Page, searchTerm?: string, employeeId?: string) {
    if (target === "employees" && employeeId) {
      if (!safeNavAccess("employees")) return;
      setPageSearch(null);
      setEmployeeRoute("profile");
      setSelectedEmployeeId(employeeId);
      setPage("employees");
      rememberPage("employees");
      window.location.hash = `#/employees/${encodeURIComponent(employeeId)}`;
      return;
    }
    handleNav(target, searchTerm);
  }

  function renderPage() {
    if (showCreateOrder) {
      return <CreateOrderPage onClose={() => setShowCreateOrder(false)} onSubmit={() => setShowCreateOrder(false)} />;
    }
    if (showCreateDispatch) {
      return <CreateDispatchPage onClose={() => setShowCreateDispatch(false)} onSubmit={() => setShowCreateDispatch(false)} />;
    }
    if (page === "not-found") return <NotFoundPage />;
    if (!safeNavAccess(page)) {
      return (
        <div className="p-6 flex items-center justify-center min-h-64">
          <GlassCard className="p-10 text-center max-w-sm">
            <Lock size={24} className="mx-auto mb-4" style={{ color: "#9CA3AF" }} />
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
      if (employeeRoute === "profile") return <EmployeeProfilePage employeeId={selectedEmployeeId ?? ""} editable currentUserId={profile.id} currentUserRole={profile.role} />;
      if (employeeRoute === "attendance") {
        return <EmployeeAttendancePage currentUser={{ id: profile.id, role: profile.role, department: profile.department }} />;
      }
      if (employeeRoute === "organization") return <OrganizationChartPage currentUser={profile} onSelectEmployee={(employeeId) => {
        setSelectedEmployeeId(employeeId);
        window.location.hash = `#/employees/${employeeId}`;
      }} />;
      return <EmployeeDirectoryPage currentUser={profile} onSelectEmployee={(employeeId) => {
        setSelectedEmployeeId(employeeId);
        window.location.hash = `#/employees/${employeeId}`;
      }} />;
    }
    if (page === "login" && window.location.pathname === "/reset-password") {
      return <ResetPasswordPage />;
    }

    switch (page) {
      case "dashboard": return <DashboardPage user={profile} notifications={notifications} notificationsLoading={notificationsLoading} notificationsError={notificationsError} onRetryNotifications={reloadNotifications} onNav={handleNav} />;
      case "attendance": return <EmployeeAttendancePage currentUser={{ id: profile.id, role: profile.role, department: profile.department }} />;
      case "bills": return <BillsPage user={profile} initialTab={openBillSubmit ? "submit" : "list"} onInitialTabHandled={() => setOpenBillSubmit(false)} initialSearch={pageSearch?.page === "bills" ? pageSearch.term : undefined} />;
      case "marketing": return <MarketingPage setShowCreateOrder={setShowCreateOrder} />;
      case "orders": return <MarketingPage initialTab="orders" initialSearch={pageSearch?.page === "orders" ? pageSearch.term : undefined} showSectionTabs={profile.role !== "Vice Chairman"} setShowCreateOrder={setShowCreateOrder} />;
      case "customers": return <MarketingPage initialTab="customers" showSectionTabs={false} setShowCreateOrder={setShowCreateOrder} />;
      case "payments": return <PaymentsPage />;
      case "collaboration": return <MarketingPage initialTab="collaboration" showSectionTabs={false} setShowCreateOrder={setShowCreateOrder} />;
      case "transport": return <TransportPage setShowCreateDispatch={setShowCreateDispatch} />;
      case "admin": return <AdminPage user={profile} />;
      case "reports": return <ReportsPage user={profile} />;
      case "notifications": return <NotificationsPage notifications={notifications} loading={notificationsLoading} error={notificationsError} onRetry={reloadNotifications} onMarkAllRead={handleMarkAllNotificationsRead} onMarkRead={markNotificationRead} />;
      case "audit": return <AuditLogPage />;
      case "organization": return <OrganizationChartPage currentUser={profile} onSelectEmployee={(employeeId) => {
        setSelectedEmployeeId(employeeId);
        window.location.hash = `#/employees/${employeeId}`;
      }} />;
      case "leave": return <LeavePage employeeId={profile.id} role={profile.role} />;
        case "department": { const route = getDepartmentRoute(getEmployeeRoutePath()); return <DepartmentPage profile={profile} routeDepartment={route?.department} routeTab={route?.tab} />; }
      default: return <DashboardPage user={profile} />;
    }
  }

  return (
    <div className="portal-shell flex h-screen overflow-hidden" style={{ background: B.bgSolid, fontFamily: "Inter, sans-serif" }}>
      <Sidebar
        user={profile} page={page} onNav={handleNav}
        collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((collapsed) => {
          const next = !collapsed;
          try {
            window.localStorage.setItem("portal.sidebar-collapsed", String(next));
          } catch (error) {
            console.error("Unable to save sidebar preference", error);
          }
          return next;
        })}
        mobile={isMobile} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)}
        onViewProfile={() => handleNav("profile")}
      />
      <div className="portal-workspace flex-1 flex flex-col min-w-0 h-full overflow-hidden" style={{ background: B.bg }}>
        <TopBar
          user={profile}
          onMenuClick={() => setMobileOpen(true)}
          onNav={handleNav}
          notifCount={notifCount}
          onNotifClick={() => handleNav("notifications")}
          onViewProfile={() => handleNav("profile")}
          currentPage={page}
          recentPages={recentPages}
          onSearchResult={handleSearchResult}
          onCreateOrder={() => setShowCreateOrder(true)}
          onSubmitBill={() => { setOpenBillSubmit(true); handleNav("bills"); }}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <main className="portal-main flex-1 overflow-y-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
