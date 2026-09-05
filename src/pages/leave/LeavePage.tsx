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
    <div data-leave-module className="min-h-full p-4 sm:p-6" style={{ background: "linear-gradient(180deg, #F7E7CB 0%, #EFD7AF 100%)" }}>
      <style>{`
        [data-leave-module] .bg-slate-50 { background-color: rgba(255,255,255,0.45) !important; }
        [data-leave-module] .bg-blue-50 { background-color: rgba(78,128,80,0.12) !important; }
        [data-leave-module] .text-blue-700,
        [data-leave-module] .text-blue-800 { color: #4E8050 !important; }
        [data-leave-module] .bg-blue-700 { background-color: #4E8050 !important; }
        [data-leave-module] .hover\\:bg-blue-800:hover { background-color: #3A6040 !important; }
        [data-leave-module] .hover\\:text-blue-900:hover { color: #3A6040 !important; }
      `}</style>
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="rounded-2xl border border-white/60 bg-white/45 p-5 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-800">Leave</h1>
          <nav aria-label="Leave sections" className="mt-4 flex gap-1 overflow-x-auto border-b border-[#d9d0bf] pb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? "page" : undefined}
                className={`whitespace-nowrap rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === tab.id ? "bg-[#4e8050] text-white" : "text-[#4e8050] hover:bg-[#e8f0e5]"}`}
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
