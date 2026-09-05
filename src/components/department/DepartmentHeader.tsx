import { Building2 } from "lucide-react";
import type { DepartmentMetadata } from "../../services/department.service";

export function DepartmentHeader({ metadata, role }: { metadata: DepartmentMetadata; role: string }) {
  return <header className="rounded-2xl border border-white/60 bg-white/45 p-5 shadow-sm"><div className="flex items-start gap-3"><div className="rounded-xl bg-[#e8f0e5] p-2.5 text-[#4e8050]"><Building2 className="h-5 w-5" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4e8050]">Department workspace</p><h1 className="mt-1 text-2xl font-semibold text-slate-800">{metadata.name}</h1><p className="mt-1 text-sm text-slate-600">{metadata.description} · {role}</p></div></div></header>;
}