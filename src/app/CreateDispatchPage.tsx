import { useState, useEffect } from "react";
import { ChevronLeft, Send, Archive, Plus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { ORDER_STATUS } from "../services/order-statuses";
import { dispatchOrder } from "../services/orders.service";

const B = {
  text: "#1C1C1E",
  textSub: "#3A3A3C",
  textMuted: "#5F6368",
  textFaint: "#9CA3AF",
  glass: "rgba(255,255,255,0.28)",
  glassBlur: "blur(20px)",
  glassBorder: "rgba(255,255,255,0.40)",
  glassShadow: "0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
  green: "#4E8050",
  greenLight: "rgba(78,128,80,0.12)",
  red: "#EF4444",
  redLight: "rgba(239,68,68,0.10)",
};

interface Order {
  id: string;
  order_number: string | null;
  customer_id: string | null;
  total_amount: number | string | null;
}

interface Vehicle {
  id: string;
  vehicle_number: string | null;
}

interface Driver {
  id: string;
  name: string | null;
  phone: string | null;
  license_number: string | null;
  status: string | null;
}

type IconProps = { size?: number; style?: React.CSSProperties };

function PrimaryButton({
  children,
  onClick,
  icon: Icon,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ElementType;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center font-semibold text-white rounded-xl transition-all duration-150 px-4 py-2 text-sm gap-2"
      style={{
        background: disabled ? "#9CA3AF" : B.green,
        boxShadow: disabled ? "none" : `0 4px 14px ${B.green}40`,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  icon: Icon,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ElementType;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-150"
      style={{
        background: B.glass,
        backdropFilter: B.glassBlur,
        WebkitBackdropFilter: B.glassBlur,
        border: `1px solid ${B.glassBorder}`,
        color: B.textSub,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      {Icon && <Icon size={14} style={{ color: B.textMuted }} />}
      {children}
    </button>
  );
}

export function CreateDispatchPage({ onClose, onSubmit }: { onClose: () => void; onSubmit: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedOrder, setSelectedOrder] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedDriver, setSelectedDriver] = useState("");
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedDelivery, setExpectedDelivery] = useState(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [creatingVehicle, setCreatingVehicle] = useState(false);
  const [creatingDriver, setCreatingDriver] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [newVehicleNumber, setNewVehicleNumber] = useState("");
  const [newVehicleType, setNewVehicleType] = useState("");
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [newDriverLicense, setNewDriverLicense] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      const [ordersRes, vehiclesRes, driversRes] = await Promise.all([
        supabase.from("orders").select("*").eq("status", ORDER_STATUS.Approved).order("created_at", { ascending: false }),
        supabase.from("vehicles").select("id, vehicle_number"),
        supabase.from("drivers").select("id, name, phone, license_number, status"),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (driversRes.error) throw driversRes.error;

      setOrders(ordersRes.data || []);
      setVehicles(vehiclesRes.data || []);
      setDrivers(driversRes.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleCreateVehicle() {
    if (!newVehicleNumber.trim()) {
      alert("Vehicle number is required");
      return;
    }

    setCreatingVehicle(true);
    try {
      const { data: vehicleData, error: vehicleError } = await supabase
        .from("vehicles")
        .insert([
          {
            vehicle_number: newVehicleNumber.trim(),
            status: "Active",
            vehicle_type: newVehicleType.trim() || null,
          },
        ])
        .select("id, vehicle_number")
        .single();

      if (vehicleError) throw vehicleError;
      if (!vehicleData) throw new Error("Failed to create vehicle");

      setVehicles((prev) => [vehicleData, ...prev]);
      setSelectedVehicle(vehicleData.id);
      setShowVehicleForm(false);
      setNewVehicleNumber("");
      setNewVehicleType("");
      alert("Vehicle added successfully");
    } catch (err) {
      console.error("Failed to create vehicle:", err);
      alert(err instanceof Error ? err.message : "Failed to create vehicle");
    } finally {
      setCreatingVehicle(false);
    }
  }

  async function handleCreateDriver() {
    if (!newDriverName.trim()) {
      alert("Driver name is required");
      return;
    }

    const driverName = newDriverName.trim();
    const driverPhone = newDriverPhone.trim();
    const driverLicense = newDriverLicense.trim();
    const payload = {
      name: driverName,
      phone: driverPhone || null,
      license_number: driverLicense || null,
      status: "Active",
    };

    setCreatingDriver(true);
    try {
      const { data: driverData, error: driverError } = await supabase
        .from("drivers")
        .insert(payload)
        .select()
        .maybeSingle();

      if (driverError) throw driverError;
      if (!driverData) throw new Error("Failed to create driver");

      setDrivers((prev) => [driverData, ...prev]);
      setSelectedDriver(driverData.id);
      setShowDriverForm(false);
      setNewDriverName("");
      setNewDriverPhone("");
      setNewDriverLicense("");
      alert("Driver added successfully");
    } catch (err) {
      console.error("Failed to create driver:", err);
      alert(err instanceof Error ? err.message : "Failed to create driver");
    } finally {
      setCreatingDriver(false);
    }
  }

  async function handleSubmit() {
    if (!selectedOrder || !selectedVehicle || !selectedDriver) {
      alert("Please select order, vehicle, and driver");
      return;
    }

    setSubmitting(true);
    try {
      const selectedOrderData = orders.find((o) => o.id === selectedOrder);
      if (!selectedOrderData) throw new Error("Order not found");

      const { data: deliveryId, error: deliveryError } = await supabase.rpc("create_delivery_with_assignment", {
        p_order_id: selectedOrder,
        p_vehicle_id: selectedVehicle,
        p_driver_id: selectedDriver,
        p_dispatch_date: dispatchDate,
        p_expected_delivery_date: expectedDelivery,
      });
      if (deliveryError) throw deliveryError;
      if (typeof deliveryId !== "string") throw new Error("Failed to create delivery");

      await dispatchOrder(selectedOrder);

      alert("Dispatch created successfully!");
      onSubmit();
      onClose();
    } catch (err) {
      console.error("Failed to create dispatch:", err);
      alert(err instanceof Error ? err.message : "Failed to create dispatch");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6">
      <button onClick={onClose} className="flex items-center gap-2 text-sm font-medium mb-5" style={{ color: B.textMuted }}>
        <ChevronLeft size={16} /> Back
      </button>

      <div
        className="p-6 rounded-2xl max-w-2xl"
        style={{
          background: B.glass,
          backdropFilter: B.glassBlur,
          WebkitBackdropFilter: B.glassBlur,
          border: `1px solid ${B.glassBorder}`,
          boxShadow: B.glassShadow,
        }}
      >
        <h2 className="text-xl font-bold mb-1" style={{ color: B.text }}>
          Create New Dispatch
        </h2>
        <p className="text-sm mb-5" style={{ color: B.textMuted }}>
          Assign vehicle and driver to approved order
        </p>

        {loading && <div style={{ color: B.textMuted }}>Loading data…</div>}
        {error && <div style={{ color: B.red }}>{error}</div>}

        {!loading && !error && (
          <>
            <div className="mb-4">
              <label className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: B.textMuted }}>
                Select Approved Order
              </label>
              <select
                value={selectedOrder}
                onChange={(e) => setSelectedOrder(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.45)",
                  border: "1px solid rgba(255,255,255,0.55)",
                  color: B.text,
                }}
              >
                <option value="">-- Choose Order --</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.order_number} · ₹{Number(o.total_amount || 0).toLocaleString()}
                  </option>
                ))}
              </select>
              {orders.length === 0 && <p className="text-xs mt-1" style={{ color: B.textMuted }}>No approved orders available</p>}
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-widest" style={{ color: B.textMuted }}>
                  Select Vehicle
                </label>
                <button onClick={() => setShowVehicleForm((prev) => !prev)} className="text-xs font-semibold" style={{ color: B.green }}>
                  {showVehicleForm ? "Hide form" : "Add New Vehicle"}
                </button>
              </div>
              <select
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.45)",
                  border: "1px solid rgba(255,255,255,0.55)",
                  color: B.text,
                }}
              >
                <option value="">-- Choose Vehicle --</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vehicle_number}
                  </option>
                ))}
              </select>
              {showVehicleForm && (
                <div className="mt-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.26)", border: "1px solid rgba(255,255,255,0.45)" }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input value={newVehicleNumber} onChange={(e) => setNewVehicleNumber(e.target.value)} placeholder="Vehicle number" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }} />
                    <input value={newVehicleType} onChange={(e) => setNewVehicleType(e.target.value)} placeholder="Vehicle type" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }} />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <PrimaryButton icon={Plus} onClick={() => void handleCreateVehicle()} disabled={creatingVehicle}>
                      {creatingVehicle ? "Saving…" : "Save Vehicle"}
                    </PrimaryButton>
                    <SecondaryButton icon={Archive} onClick={() => setShowVehicleForm(false)}>
                      Cancel
                    </SecondaryButton>
                  </div>
                </div>
              )}
              {vehicles.length === 0 && <p className="text-xs mt-1" style={{ color: B.textMuted }}>No vehicles available</p>}
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-widest" style={{ color: B.textMuted }}>
                  Select Driver
                </label>
                <button onClick={() => setShowDriverForm((prev) => !prev)} className="text-xs font-semibold" style={{ color: B.green }}>
                  {showDriverForm ? "Hide form" : "Add New Driver"}
                </button>
              </div>
              <select
                value={selectedDriver}
                onChange={(e) => setSelectedDriver(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.45)",
                  border: "1px solid rgba(255,255,255,0.55)",
                  color: B.text,
                }}
              >
                <option value="">-- Choose Driver --</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name ? `${d.name} · ${d.phone ?? "No phone"}` : d.phone ?? "Driver"}
                  </option>
                ))}
              </select>
              {showDriverForm && (
                <div className="mt-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.26)", border: "1px solid rgba(255,255,255,0.45)" }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input value={newDriverName} onChange={(e) => setNewDriverName(e.target.value)} placeholder="Driver name" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }} />
                    <input value={newDriverPhone} onChange={(e) => setNewDriverPhone(e.target.value)} placeholder="Phone number" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }} />
                    <input value={newDriverLicense} onChange={(e) => setNewDriverLicense(e.target.value)} placeholder="License number" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }} />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <PrimaryButton icon={Plus} onClick={() => void handleCreateDriver()} disabled={creatingDriver}>
                      {creatingDriver ? "Saving…" : "Save Driver"}
                    </PrimaryButton>
                    <SecondaryButton icon={Archive} onClick={() => setShowDriverForm(false)}>
                      Cancel
                    </SecondaryButton>
                  </div>
                </div>
              )}
              {drivers.length === 0 && <p className="text-xs mt-1" style={{ color: B.textMuted }}>No drivers available</p>}
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: B.textMuted }}>
                Dispatch Date
              </label>
              <input
                type="date"
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.45)",
                  border: "1px solid rgba(255,255,255,0.55)",
                  color: B.text,
                }}
              />
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: B.textMuted }}>
                Expected Delivery Date
              </label>
              <input
                type="date"
                value={expectedDelivery}
                onChange={(e) => setExpectedDelivery(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.45)",
                  border: "1px solid rgba(255,255,255,0.55)",
                  color: B.text,
                }}
              />
            </div>

            <div className="p-3 rounded-xl mb-6" style={{ background: "rgba(78,128,80,0.10)", border: "1px solid rgba(78,128,80,0.20)" }}>
              <p className="text-xs mb-1" style={{ color: B.textMuted }}>Initial Status</p>
              <p className="text-sm font-semibold" style={{ color: B.text }}>
                Loaded
              </p>
            </div>

            <div className="flex gap-3">
              <PrimaryButton icon={Send} onClick={handleSubmit} disabled={submitting || !selectedOrder || !selectedVehicle || !selectedDriver}>
                {submitting ? "Creating…" : "Create Dispatch"}
              </PrimaryButton>
              <SecondaryButton icon={Archive} onClick={onClose}>
                Cancel
              </SecondaryButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
