import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarDays, Check, Clock3, FileText, Loader2, X } from "lucide-react";
import {
  approveLeaveRequest,
  createLeaveRequest,
  getLeaveApprovalHistory,
  getLeaveBalance,
  getLeaveRequests,
  getLeaveRequestsForUser,
  getDirectLeaveRequestsForUser,
  getLeaveRequest,
  rejectLeaveRequest,
} from "../../services/leave.service";
import {
  getLeaveTotalDays,
  LEAVE_TYPES,
  type LeaveApprovalHistory,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveRequestInput,
  type LeaveType,
  validateLeaveRequestInput,
} from "../../types/leave.types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../app/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../app/components/ui/select";

export interface LeavePageProps {
  employeeId: string;
  role?: string;
}

const EMPTY_BALANCE: LeaveBalance = {
  id: "",
  employee_id: "",
  casual_leave: 0,
  sick_leave: 0,
  earned_leave: 0,
  unpaid_leave: 0,
  updated_at: "",
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function PageShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="portal-feature-page min-h-full bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-[#e8f0e5] p-2.5 text-[#4e8050]"><CalendarDays className="h-5 w-5" /></div>
            <div><h1 className="text-xl font-semibold text-slate-900">{title}</h1><p className="mt-1 text-sm text-slate-500">{description}</p></div>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

function Feedback({ error, success }: { error: string; success: string }) {
  return <>
    {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
    {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>}
  </>;
}

function LoadingState() {
  return <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading leave data...</div>;
}

function StatusBadge({ status }: { status: LeaveRequest["status"] }) {
  const styles = { Pending: "bg-amber-50 text-amber-700 ring-amber-200", Approved: "bg-emerald-50 text-emerald-700 ring-emerald-200", Rejected: "bg-red-50 text-red-700 ring-red-200", Cancelled: "bg-slate-100 text-slate-600 ring-slate-200" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles[status]}`}>{status}</span>;
}

function DateRange({ request }: { request: LeaveRequest }) {
  return <span>{request.start_date} <span className="text-slate-400">to</span> {request.end_date}</span>;
}

function RequestDetails({ requestId, open, onOpenChange }: { requestId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [request, setRequest] = useState<LeaveRequest | null>(null);
  const [history, setHistory] = useState<LeaveApprovalHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !requestId) return;
    setLoading(true); setError("");
    Promise.all([getLeaveRequest(requestId), getLeaveApprovalHistory(requestId)])
      .then(([loadedRequest, loadedHistory]) => { setRequest(loadedRequest); setHistory(loadedHistory); })
      .catch((loadError) => setError(errorMessage(loadError)))
      .finally(() => setLoading(false));
  }, [open, requestId]);

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
    <DialogHeader><DialogTitle>Leave request details</DialogTitle><DialogDescription>Request history and approval activity.</DialogDescription></DialogHeader>
    {loading && <LoadingState />}
    {error && <Feedback error={error} success="" />}
    {!loading && !error && request && <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4"><div><div className="text-xs text-slate-500">Type</div><div className="font-medium text-slate-900">{request.leave_type}</div></div><div><div className="text-xs text-slate-500">Status</div><StatusBadge status={request.status} /></div><div className="col-span-2"><div className="text-xs text-slate-500">Dates</div><div className="font-medium text-slate-900"><DateRange request={request} /> ({request.total_days} days)</div></div><div className="col-span-2"><div className="text-xs text-slate-500">Reason</div><div className="text-slate-700">{request.reason}</div></div></div>
      <div><h3 className="mb-2 font-semibold text-slate-900">Approval history</h3>{history.length === 0 ? <p className="text-slate-500">No approval activity yet.</p> : <div className="space-y-2">{history.map((item) => <div key={item.id} className="rounded-lg border border-slate-200 p-3"><div className="flex justify-between gap-3"><span className="font-medium">{item.action}</span><span className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</span></div><div className="mt-1 text-xs text-slate-500">Approver: {item.approver_id}</div>{item.remarks && <p className="mt-1 text-slate-600">Remarks: {item.remarks}</p>}</div>)}</div>}</div>
    </div>}
    <DialogFooter><button type="button" onClick={() => onOpenChange(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Close</button></DialogFooter>
  </DialogContent></Dialog>;
}

export function ApplyLeavePage({ employeeId }: LeavePageProps) {
  const [input, setInput] = useState<LeaveRequestInput>({ leaveType: "Casual", startDate: "", endDate: "", reason: "" });
  const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  const days = input.startDate && input.endDate ? getLeaveTotalDays(input.startDate, input.endDate) : 0;
  async function submit(event: React.FormEvent) { event.preventDefault(); setError(""); setSuccess(""); try { validateLeaveRequestInput(input); setSaving(true); await createLeaveRequest(input); setSuccess("Leave request submitted for approval."); setInput({ leaveType: "Casual", startDate: "", endDate: "", reason: "" }); } catch (submitError) { setError(errorMessage(submitError)); } finally { setSaving(false); } }
  return <PageShell title="Apply Leave" description="Submit a leave request to your reporting approver."><form onSubmit={submit} className="max-w-2xl space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><Feedback error={error} success={success} /><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Leave type<Select value={input.leaveType} onValueChange={(value) => setInput({ ...input, leaveType: value as LeaveType })}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent>{LEAVE_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></label><div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800"><div className="text-xs font-medium uppercase tracking-wide">Total days</div><div className="mt-1 text-2xl font-semibold">{days > 0 ? days : "-"}</div></div><label className="text-sm font-medium text-slate-700">Start date<input required type="date" value={input.startDate} onChange={(event) => setInput({ ...input, startDate: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></label><label className="text-sm font-medium text-slate-700">End date<input required type="date" min={input.startDate || undefined} value={input.endDate} onChange={(event) => setInput({ ...input, endDate: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></label></div><label className="block text-sm font-medium text-slate-700">Reason<textarea required maxLength={2000} rows={5} value={input.reason} onChange={(event) => setInput({ ...input, reason: event.target.value })} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Explain the reason for your leave" /></label><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Submit leave request</button></form></PageShell>;
}

function RequestsTable({ requests, onView }: { requests: LeaveRequest[]; onView: (id: string) => void }) {
  if (!requests.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No leave requests found.</div>;
  return <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Type</th><th className="px-5 py-3">Dates</th><th className="px-5 py-3">Days</th><th className="px-5 py-3">Reason</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{requests.map((request) => <tr key={request.id}><td className="px-5 py-4 font-medium text-slate-900">{request.leave_type}</td><td className="px-5 py-4 text-slate-600"><DateRange request={request} /></td><td className="px-5 py-4 text-slate-600">{request.total_days}</td><td className="max-w-xs px-5 py-4 text-slate-600">{request.reason}</td><td className="px-5 py-4"><StatusBadge status={request.status} /></td><td className="px-5 py-4 text-right"><button onClick={() => onView(request.id)} className="font-medium text-blue-700 hover:text-blue-900">View details</button></td></tr>)}</tbody></table></div>;
}

export function MyLeaveRequestsPage({ employeeId }: LeavePageProps) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => { getLeaveRequests(employeeId).then(setRequests).catch((loadError) => setError(errorMessage(loadError))).finally(() => setLoading(false)); }, [employeeId]);
  return <PageShell title="My Leave Requests" description="Track the status and approval history of your requests.">{loading ? <LoadingState /> : error ? <Feedback error={error} success="" /> : <RequestsTable requests={requests} onView={setSelectedId} />}<RequestDetails requestId={selectedId} open={Boolean(selectedId)} onOpenChange={(open) => !open && setSelectedId(null)} /></PageShell>;
}

export function LeaveApprovalsPage({ employeeId, role = "Worker" }: LeavePageProps) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [review, setReview] = useState<{ request: LeaveRequest; decision: "Approved" | "Rejected" } | null>(null); const [remarks, setRemarks] = useState(""); const [saving, setSaving] = useState(false);
  async function load() { setLoading(true); setError(""); try { setRequests((await getDirectLeaveRequestsForUser(employeeId, role)).filter((request) => request.status === "Pending")); } catch (loadError) { setError(errorMessage(loadError)); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  async function submitReview() { if (!review || (review.decision === "Rejected" && !remarks.trim())) { setError("A rejection reason is required."); return; } setSaving(true); setError(""); try { if (review.decision === "Approved") await approveLeaveRequest(review.request.id, remarks); else await rejectLeaveRequest(review.request.id, remarks); setSuccess(`Leave request ${review.decision.toLowerCase()}.`); setReview(null); setRemarks(""); await load(); } catch (reviewError) { setError(errorMessage(reviewError)); } finally { setSaving(false); } }
  return <PageShell title="Leave Approvals" description="Review requests currently assigned to you."><div className="space-y-4"><Feedback error={error} success={success} />{loading ? <LoadingState /> : <RequestsTable requests={requests} onView={(id) => { const request = requests.find((item) => item.id === id); if (request) setReview({ request, decision: "Approved" }); }} />}</div><Dialog open={Boolean(review)} onOpenChange={(open) => !open && setReview(null)}><DialogContent><DialogHeader><DialogTitle>{review?.decision === "Rejected" ? "Reject" : "Approve"} leave request</DialogTitle><DialogDescription>{review && <DateRange request={review.request} />} for {review?.request.total_days} day(s).</DialogDescription></DialogHeader><div className="flex gap-2"><button type="button" onClick={() => setReview(review ? { ...review, decision: "Approved" } : null)} className={`rounded-lg px-3 py-2 text-sm font-medium ${review?.decision === "Approved" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}><Check className="mr-1 inline h-4 w-4" />Approve</button><button type="button" onClick={() => setReview(review ? { ...review, decision: "Rejected" } : null)} className={`rounded-lg px-3 py-2 text-sm font-medium ${review?.decision === "Rejected" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"}`}><X className="mr-1 inline h-4 w-4" />Reject</button></div><label className="text-sm font-medium text-slate-700">Remarks<textarea rows={4} value={remarks} onChange={(event) => setRemarks(event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder={review?.decision === "Rejected" ? "Explain why this request is rejected" : "Optional remarks"} /></label><DialogFooter><button type="button" onClick={() => setReview(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button><button type="button" disabled={saving} onClick={() => void submitReview()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : "Submit decision"}</button></DialogFooter></DialogContent></Dialog></PageShell>;
}

const BALANCE_CARDS: Array<{ key: keyof Pick<LeaveBalance, "casual_leave" | "sick_leave" | "earned_leave" | "unpaid_leave">; label: string; tone: string }> = [{ key: "casual_leave", label: "Casual Leave", tone: "blue" }, { key: "sick_leave", label: "Sick Leave", tone: "rose" }, { key: "earned_leave", label: "Earned Leave", tone: "emerald" }, { key: "unpaid_leave", label: "Unpaid Leave", tone: "amber" }];

export function LeaveBalancePage({ employeeId }: LeavePageProps) {
  const [balance, setBalance] = useState<LeaveBalance>(EMPTY_BALANCE); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { getLeaveBalance(employeeId).then((result) => result && setBalance(result)).catch((loadError) => setError(errorMessage(loadError))).finally(() => setLoading(false)); }, [employeeId]);
  return <PageShell title="Leave Balance" description="Available leave balances for the current leave year.">{loading ? <LoadingState /> : error ? <Feedback error={error} success="" /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{BALANCE_CARDS.map((card) => <div key={card.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-600">{card.label}</span><Clock3 className="h-4 w-4 text-slate-400" /></div><div className="mt-4 text-3xl font-semibold text-slate-900">{balance[card.key]}</div><div className="mt-1 text-xs text-slate-500">days available</div></div>)}</div>}</PageShell>;
}

export function LeaveDashboardPage({ employeeId, role = "Worker" }: LeavePageProps) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]); const [balance, setBalance] = useState<LeaveBalance>(EMPTY_BALANCE); const [selectedId, setSelectedId] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { Promise.all([getLeaveRequestsForUser(employeeId, role), getLeaveBalance(employeeId)]).then(([loadedRequests, loadedBalance]) => { setRequests(loadedRequests); if (loadedBalance) setBalance(loadedBalance); }).catch((loadError) => setError(errorMessage(loadError))).finally(() => setLoading(false)); }, [employeeId, role]);
  const counts = useMemo(() => ({ Pending: requests.filter((request) => request.status === "Pending").length, Approved: requests.filter((request) => request.status === "Approved").length, Rejected: requests.filter((request) => request.status === "Rejected").length }), [requests]);
  return <PageShell title="Leave Dashboard" description="A quick view of your leave requests and available balances.">{loading ? <LoadingState /> : error ? <Feedback error={error} success="" /> : <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{([{ label: "Pending Requests", value: counts.Pending, icon: Clock3 }, { label: "Approved Requests", value: counts.Approved, icon: Check }, { label: "Rejected Requests", value: counts.Rejected, icon: X }, { label: "Total Requests", value: requests.length, icon: FileText }] as const).map((card) => <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><card.icon className="h-5 w-5 text-blue-700" /><div className="mt-4 text-3xl font-semibold text-slate-900">{card.value}</div><div className="mt-1 text-sm text-slate-500">{card.label}</div></div>)}</div><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-blue-700" /><h2 className="font-semibold text-slate-900">Leave Balance Summary</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-4">{BALANCE_CARDS.map((card) => <div key={card.key} className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-500">{card.label}</div><div className="mt-2 text-xl font-semibold text-slate-900">{balance[card.key]} days</div></div>)}</div></section><section><h2 className="mb-3 font-semibold text-slate-900">Leave History</h2><RequestsTable requests={requests} onView={setSelectedId} /></section><RequestDetails requestId={selectedId} open={Boolean(selectedId)} onOpenChange={(open) => !open && setSelectedId(null)} /></>}</PageShell>;
}
