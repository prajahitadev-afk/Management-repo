import { useEffect, useState } from "react";
import { getPayments, type PaymentRow } from "../services/payments.service";

export function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    console.log("PAYMENTS COMPONENT STATE", payments.length);
  }, [payments]);
  useEffect(() => {
    let active = true;
    const loadPayments = async () => {
      setLoading(true);
      try {
        setPayments(await getPayments());
        setError(null);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load payments");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadPayments();
    const handleWorkflowChange = () => void loadPayments();
    window.addEventListener("order-workflow-changed", handleWorkflowChange);
    return () => {
      active = false;
      window.removeEventListener("order-workflow-changed", handleWorkflowChange);
    };
  }, []);
  console.log("PAYMENTS TABLE ROWS", payments.length);
  return <main className="min-h-full p-6"><div className="mx-auto max-w-7xl space-y-5"><div><h1 className="text-2xl font-bold text-slate-800">Payments</h1><p className="mt-1 text-sm text-slate-600">Payment records linked to orders</p></div>{error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}{loading ? <div className="rounded-2xl border border-white/50 bg-white/40 p-8 text-sm text-slate-600">Loading payments...</div> : <div className="overflow-x-auto rounded-2xl border border-white/50 bg-white/40 shadow-sm"><table className="min-w-full text-left text-sm"><thead className="bg-white/60 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Payment ID</th><th className="px-4 py-3">Order Number</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Payment Method</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Date</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id} className="border-t border-white/40"><td className="px-4 py-3">{payment.id}</td><td className="px-4 py-3">{payment.order_number}</td><td className="px-4 py-3">{payment.customer_name}</td><td className="px-4 py-3">{payment.amount ?? "-"}</td><td className="px-4 py-3">{payment.payment_method ?? "-"}</td><td className="px-4 py-3">{payment.status ?? "-"}</td><td className="px-4 py-3">{payment.created_at ? new Date(payment.created_at).toLocaleDateString("en-IN") : "-"}</td></tr>)}</tbody></table></div>}</div></main>;
}
