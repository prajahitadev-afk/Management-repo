import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useNotifications } from "../hooks/useNotifications";
import { markAllAsRead } from "../services/notification.service";
import { CreateOrderPage } from "./CreateOrderPage";
import { CreateDispatchPage } from "./CreateDispatchPage";
import { EmployeeDirectoryPage } from "../pages/employees/EmployeeDirectoryPage";
import { EmployeeProfilePage } from "../pages/employees/EmployeeProfilePage";
import { AttendancePage as EmployeeAttendancePage } from "../pages/employees/AttendancePage";
import { OrganizationChartPage } from "../pages/employees/OrganizationChartPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";
import {
  AdminPage,
  AttendancePage,
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

export default function App() {
  const { profile, loading } = useAuth();
  const { notifications } = useNotifications(profile?.id);

  const [page, setPage] = useState<Page>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1440,
  );
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showCreateDispatch, setShowCreateDispatch] = useState(false);
  const [employeeRoute, setEmployeeRoute] = useState<EmployeeRoute>("directory");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    const handle = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

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
        return;
      }

      const pageRoutes: Record<string, Page> = {
        dashboard: "dashboard",
        attendance: "attendance",
        bills: "bills",
        marketing: "marketing",
        transport: "transport",
        admin: "admin",
        reports: "reports",
        notifications: "notifications",
        login: "login",
      };

      const nextPage = pageRoutes[parts[0] ?? ""] ?? "dashboard";
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
    return <ResetPasswordPage />;
  }

  if (loading) return <div>Loading...</div>;

  if (page === "login") {
    return <LoginPage />;
  }

  if (!profile) {
    return <LoginPage />;
  }

  const isMobile = windowWidth < 768;
  const notifCount = notifications.filter((notification) => !notification.read).length;
  const handleMarkAllNotificationsRead = async () => {
    await markAllAsRead(profile.id);
  };
  const safeNavAccess = (currentPage: Page) => {
    const item = NAV_ITEMS.find((navItem) => navItem.id === currentPage);
    return item ? navAccess(item, profile) : false;
  };

  function handleNav(nextPage: Page) {
    if (!safeNavAccess(nextPage)) return;
    setPage(nextPage);
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
      transport: "/transport",
      admin: "/admin",
      reports: "/reports",
      notifications: "/notifications",
      employees: "/employees",
      profile: "/profile",
    };

    window.history.pushState({}, "", routeMap[nextPage] ?? "/");
    window.location.hash = "";
  }

  function renderPage() {
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
            <Lock size={24} className="mx-auto mb-4" style={{ color: "#9CA3AF" }} />
            <h2 className="text-lg font-bold mb-2" style={{ color: B.text }}>Access Denied</h2>
            <p className="text-sm" style={{ color: B.textSub }}>Your role does not have permission to access this module.</p>
            <button onClick={() => setPage("dashboard")} className="mt-4 text-sm font-medium hover:underline" style={{ color: B.green }}>
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
      if (employeeRoute === "profile") return <EmployeeProfilePage employeeId={selectedEmployeeId ?? ""} />;
      if (employeeRoute === "attendance") {
        return <EmployeeAttendancePage currentUser={{ id: profile.id, role: profile.role, department: profile.dept }} />;
      }
      if (employeeRoute === "organization") return <OrganizationChartPage />;
      return <EmployeeDirectoryPage currentUser={profile} onSelectEmployee={(employeeId) => {
        setSelectedEmployeeId(employeeId);
        window.location.hash = `#/employees/${employeeId}`;
      }} />;
    }
    if (page === "login" && window.location.pathname === "/reset-password") {
      return <ResetPasswordPage />;
    }

    switch (page) {
      case "dashboard": return <DashboardPage user={profile} />;
      case "attendance": return <AttendancePage user={profile} />;
      case "bills": return <BillsPage user={profile} />;
      case "marketing": return <MarketingPage setShowCreateOrder={setShowCreateOrder} />;
      case "transport": return <TransportPage setShowCreateDispatch={setShowCreateDispatch} />;
      case "admin": return <AdminPage user={profile} />;
      case "reports": return <ReportsPage user={profile} />;
      case "notifications": return <NotificationsPage notifications={notifications} onMarkAllRead={handleMarkAllNotificationsRead} />;
      default: return <DashboardPage user={profile} />;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: B.bgSolid, fontFamily: "Inter, sans-serif" }}>
      <Sidebar
        user={profile} page={page} onNav={handleNav}
        collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobile={isMobile} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden" style={{ background: B.bg }}>
        <TopBar
          user={profile}
          onMenuClick={() => setMobileOpen(true)}
          notifCount={notifCount}
          onNotifClick={() => handleNav("notifications")}
          onViewProfile={() => handleNav("profile")}
        />
        <main className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          <style>{`main::-webkit-scrollbar{display:none}`}</style>
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
