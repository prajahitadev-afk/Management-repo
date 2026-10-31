import { useCallback, useEffect, useState } from "react";
import {
  getCanManagePayments,
  getPayments,
  setPaymentStatus,
  type PaymentRow,
  type PaymentStatus,
} from "../services/payments.service";

export function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, permission] = await Promise.all([getPayments(), getCanManagePayments()]);
      setPayments(rows);
      setCanManage(permission);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPayments();
    const handleWorkflowChange = () => void loadPayments();
    window.addEventListener("order-workflow-changed", handleWorkflowChange);
    return () => window.removeEventListener("order-workflow-changed", handleWorkflowChange);
  }, [loadPayments]);

  const updateStatus = async (payment: PaymentRow, status: Exclude<PaymentStatus, "Pending">) => {
    setUpdatingId(payment.id);
    setError(null);
    try {
      await setPaymentStatus(payment.id, status);
      await loadPayments();
      window.dispatchEvent(new Event("order-workflow-changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update payment status");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <main className="min-h-full p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Payments</h1>
          <p className="mt-1 text-sm text-slate-600">Payment records linked to orders</p>
        </div>
        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
        {loading ? (
          <div className="rounded-2xl border border-white/50 bg-white/40 p-8 text-sm text-slate-600">Loading payments...</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/50 bg-white/40 shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/60 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Payment ID</th>
                  <th className="px-4 py-3">Order Number</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Payment Method</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  {canManage && <th className="px-4 py-3">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan={canManage ? 8 : 7} className="px-4 py-8 text-center text-slate-500">No payment records yet. New orders create a pending payment record.</td></tr>
                ) : payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-white/40">
                    <td className="px-4 py-3 font-mono text-xs">{payment.id}</td>
                    <td className="px-4 py-3">{payment.order_number}</td>
                    <td className="px-4 py-3">{payment.customer_name}</td>
                    <td className="px-4 py-3">{payment.amount ?? "-"}</td>
                    <td className="px-4 py-3">{payment.payment_method ?? "-"}</td>
                    <td className="px-4 py-3">{payment.status ?? "-"}</td>
                    <td className="px-4 py-3">{payment.created_at ? new Date(payment.created_at).toLocaleDateString("en-IN") : "-"}</td>
                    {canManage && (
                      <td className="px-4 py-3">
                        {payment.status === "Pending" ? (
                          <div className="flex flex-wrap gap-2">
                            <button type="button" disabled={updatingId === payment.id} onClick={() => void updateStatus(payment, "Paid")} className="rounded-md bg-[#4e8050] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                              {updatingId === payment.id ? "Saving..." : "Mark paid"}
                            </button>
                            <button type="button" disabled={updatingId === payment.id} onClick={() => void updateStatus(payment, "Failed")} className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 disabled:opacity-50">
                              Mark failed
                            </button>
                          </div>
                        ) : <span className="text-xs text-slate-500">No further action</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
