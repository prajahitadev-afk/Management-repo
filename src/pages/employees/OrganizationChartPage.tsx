import { useState } from "react";
import { AlertCircle, Building2, Contact, Users } from "lucide-react";
import { useOrganizationChart } from "../../hooks/useOrganizationChart";
import type { OrganizationNode } from "../../types/employee.types";

interface OrganizationCardProps {
  node: OrganizationNode;
}

function OrganizationCard({ node }: OrganizationCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm">
      <button onClick={() => setOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
        <div>
          <div className="font-semibold text-slate-800">{node.name}</div>
          <div className="text-sm text-slate-600">{node.role}</div>
        </div>
        <div className="text-xs text-slate-500">{node.department}</div>
      </button>
      {open && (
        <div className="mt-3 rounded-xl border border-white/60 bg-white/80 p-3 text-sm text-slate-700">
          <div className="flex items-center gap-2"><Contact size={14} /> Manager: {node.managerName ?? "—"}</div>
          <div className="mt-2 flex items-center gap-2"><Users size={14} /> Direct reports: {node.children.length}</div>
          <div className="mt-2 flex items-center gap-2"><Building2 size={14} /> Department: {node.department}</div>
        </div>
      )}
      {node.children.length > 0 && (
        <div className="mt-3 space-y-3 border-l border-white/60 pl-3">
          {node.children.map((child) => (
            <OrganizationCard key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}

export function OrganizationChartPage() {
  const { nodes, loading, error } = useOrganizationChart();

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Loading organization chart...</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          <div className="flex items-center gap-2"><AlertCircle size={16} /> {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="rounded-2xl border border-white/50 bg-white/40 p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-800">Organization Chart</h1>
        <p className="text-sm text-slate-600">The hierarchy is built dynamically from employee reporting relationships.</p>
      </div>
      <div className="space-y-3">
        {nodes.map((node) => (
          <OrganizationCard key={node.id} node={node} />
        ))}
      </div>
    </div>
  );
}
