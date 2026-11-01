import { useState } from "react";
import { ApplyLeavePage, LeaveApprovalsPage, LeaveBalancePage, LeaveDashboardPage, MyLeaveRequestsPage } from "./LeavePages";

export interface LeavePageProps {
  employeeId: string;
  role: string;
}

type LeaveTab = "dashboard" | "apply" | "requests" | "balance" | "approvals";

const baseTabs: Array<{ id: LeaveTab; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "apply", label: "Apply" },
  { id: "requests", label: "Requests" },
  { id: "balance", label: "Balance" },
];

export function LeavePage({ employeeId, role }: LeavePageProps) {
  const isWorker = role === "Worker";
  const tabs = isWorker
    ? baseTabs
    : [...baseTabs.filter((tab) => tab.id !== "apply" && tab.id !== "requests"), { id: "approvals" as const, label: "Approvals" }];
  const [activeTab, setActiveTab] = useState<LeaveTab>("dashboard");

  return (
    <div data-leave-module className="portal-leave-page min-h-full p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="portal-card rounded-2xl border border-white/60 bg-white/45 p-5 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-800">Leave</h1>
          <nav aria-label="Leave sections" className="mt-4 flex gap-1 overflow-x-auto border-b border-[#e3ebe6] pb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? "page" : undefined}
                className={`whitespace-nowrap rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === tab.id ? "bg-[#176b52] text-white" : "text-[#52645a] hover:bg-[#edf3ef]"}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        {activeTab === "dashboard" && <LeaveDashboardPage employeeId={employeeId} role={role} />}
        {activeTab === "apply" && isWorker && <ApplyLeavePage employeeId={employeeId} />}
        {activeTab === "requests" && isWorker && <MyLeaveRequestsPage employeeId={employeeId} />}
        {activeTab === "balance" && <LeaveBalancePage employeeId={employeeId} />}
        {activeTab === "approvals" && !isWorker && <LeaveApprovalsPage employeeId={employeeId} role={role} />}
      </div>
    </div>
  );
}

export default LeavePage;
