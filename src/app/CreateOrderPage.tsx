import { useState, useEffect } from "react";
import { ChevronLeft, Plus, Trash2, Send, Archive } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { getCustomers } from "../services/customers.service";
import { getProducts } from "../services/products.service";
import { createOrderWithItems } from "../services/orders.service";
import { ORDER_STATUS } from "../services/order-statuses";
import { notifyInventoryShortage, notifyOrderPendingApproval } from "../services/notification.service";

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

interface Customer {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface Product {
  id: string;
  name: string | null;
  price: number | string | null;
  stock_quantity: number | null;
}

interface OrderItem {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
}

function PrimaryButton({
  children,
  onClick,
  icon: Icon,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ComponentType<{ size?: number }>;
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
  icon?: React.ComponentType<{ size?: number }>;
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
      {Icon && (
        <span className="inline-flex" style={{ color: B.textMuted }}>
          <Icon size={14} />
        </span>
      )}
      {children}
    </button>
  );
}

export function CreateOrderPage({ onClose, onSubmit }: { onClose: () => void; onSubmit: () => void }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const { user, profile } = useAuth();
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [newCustomerFirstName, setNewCustomerFirstName] = useState("");
  const [newCustomerLastName, setNewCustomerLastName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerCity, setNewCustomerCity] = useState("");
  const [newCustomerState, setNewCustomerState] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      const [customersData, productsData] = await Promise.all([getCustomers(), getProducts()]);
      setCustomers(customersData as Customer[]);
      setProducts(productsData as Product[]);
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

  function handleAddItem(productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const existingItem = orderItems.find((item) => item.product_id === productId);
    if (existingItem) {
      existingItem.quantity += 1;
      setOrderItems([...orderItems]);
    } else {
      setOrderItems([
        ...orderItems,
        {
          product_id: productId,
          product_name: product.name || "Unknown",
          unit_price: Number(product.price || 0),
          quantity: 1,
        },
      ]);
    }
  }

  function handleRemoveItem(productId: string) {
    setOrderItems(orderItems.filter((item) => item.product_id !== productId));
  }

  function handleQuantityChange(productId: string, quantity: number) {
    const item = orderItems.find((item) => item.product_id === productId);
    if (item) {
      item.quantity = Math.max(1, quantity);
      setOrderItems([...orderItems]);
    }
  }

  async function handleCreateCustomer() {
    if (!newCustomerFirstName.trim() || !newCustomerLastName.trim()) {
      alert("Customer first name and last name are required");
      return;
    }

    setCreatingCustomer(true);
    try {
      const customerCode = `CUST-${Date.now().toString().slice(-4)}`;
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .insert([
          {
            customer_code: customerCode,
            first_name: newCustomerFirstName.trim(),
            last_name: newCustomerLastName.trim(),
            email: newCustomerEmail.trim() || null,
            phone: newCustomerPhone.trim() || null,
            city: newCustomerCity.trim() || null,
            state: newCustomerState.trim() || null,
            status: "Active",
          },
        ])
        .select("id, first_name, last_name, email")
        .single();

      if (customerError) throw customerError;
      if (!customerData) throw new Error("Failed to create customer");

      setCustomers((prev) => [customerData, ...prev]);
      setSelectedCustomer(customerData.id);
      setShowCustomerForm(false);
      setNewCustomerFirstName("");
      setNewCustomerLastName("");
      setNewCustomerEmail("");
      setNewCustomerPhone("");
      setNewCustomerCity("");
      setNewCustomerState("");
      alert("Customer added successfully");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create customer");
    } finally {
      setCreatingCustomer(false);
    }
  }

  async function handleSubmit() {
    if (!selectedCustomer || orderItems.length === 0) {
      alert("Please select a customer and add at least one item");
      return;
    }

    const invalidItem = orderItems.find((item) => {
      const product = products.find((p) => p.id === item.product_id);
      return product && product.stock_quantity !== null && item.quantity > product.stock_quantity;
    });
    if (invalidItem) {
      alert("One or more items exceed available stock. Please reduce the quantity.");
      return;
    }

    setSubmitting(true);
    try {
      const totalAmount = orderItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
      const orderNumber = `ORD-${Date.now()}`;
      const expectedDelivery = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const itemsToInsert = orderItems.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }));
      const createdBy = profile?.id ?? user?.id;
      if (!createdBy) {
        throw new Error("Authenticated user profile is unavailable");
      }

      const orderId = await createOrderWithItems({
        order_number: orderNumber,
        customer_id: selectedCustomer,
        order_date: new Date().toISOString().split("T")[0],
        expected_delivery: expectedDelivery,
        status: ORDER_STATUS.Pending,
        total_amount: totalAmount,
        created_by: createdBy,
        items: itemsToInsert,
      });

      const customerName = `${customers.find((c) => c.id === selectedCustomer)?.first_name || ""} ${customers.find((c) => c.id === selectedCustomer)?.last_name || ""}`.trim() || "Customer";
      await notifyOrderPendingApproval(orderId, orderNumber, customerName);

      const notifyPromises = orderItems.map(async (item) => {
        const product = products.find((p) => p.id === item.product_id);
        if (!product || product.stock_quantity === null) return null;
        const remainingStock = product.stock_quantity - item.quantity;
        if (remainingStock <= 5) {
          return notifyInventoryShortage(product.name || "Product", product.id, remainingStock, 5);
        }
        return null;
      });
      await Promise.all(notifyPromises);

      alert(`Order ${orderNumber} created successfully!`);
      onSubmit();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  }

  const totalAmount = orderItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

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
          Create New Order
        </h2>
        <p className="text-sm mb-5" style={{ color: B.textMuted }}>
          Add products to customer order
        </p>

        {loading && <div style={{ color: B.textMuted }}>Loading data…</div>}
        {error && <div style={{ color: B.red }}>{error}</div>}

        {!loading && !error && (
          <>
            <div className="mb-6">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-widest" style={{ color: B.textMuted }}>
                  Select Customer
                </label>
                <button onClick={() => setShowCustomerForm((prev) => !prev)} className="text-xs font-semibold" style={{ color: B.green }}>
                  {showCustomerForm ? "Hide form" : "Add New Customer"}
                </button>
              </div>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.45)",
                  border: "1px solid rgba(255,255,255,0.55)",
                  color: B.text,
                }}
              >
                <option value="">-- Choose Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Unknown"}
                  </option>
                ))}
              </select>

              {showCustomerForm && (
                <div className="mt-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.26)", border: "1px solid rgba(255,255,255,0.45)" }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input value={newCustomerFirstName} onChange={(e) => setNewCustomerFirstName(e.target.value)} placeholder="First name" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }} />
                    <input value={newCustomerLastName} onChange={(e) => setNewCustomerLastName(e.target.value)} placeholder="Last name" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }} />
                    <input value={newCustomerEmail} onChange={(e) => setNewCustomerEmail(e.target.value)} placeholder="Email" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }} />
                    <input value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} placeholder="Phone" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }} />
                    <input value={newCustomerCity} onChange={(e) => setNewCustomerCity(e.target.value)} placeholder="City" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }} />
                    <input value={newCustomerState} onChange={(e) => setNewCustomerState(e.target.value)} placeholder="State" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }} />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <PrimaryButton icon={Plus} onClick={() => void handleCreateCustomer()} disabled={creatingCustomer}>
                      {creatingCustomer ? "Saving…" : "Save Customer"}
                    </PrimaryButton>
                    <SecondaryButton icon={Archive} onClick={() => setShowCustomerForm(false)}>
                      Cancel
                    </SecondaryButton>
                  </div>
                </div>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: B.textMuted }}>
                Select Products to Add
              </label>
              <div className="grid grid-cols-1 gap-2">
                {products.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.30)", border: "1px solid rgba(255,255,255,0.45)" }}>
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: B.text }}>
                        {p.name}
                      </p>
                      <p className="text-xs" style={{ color: B.textMuted }}>
                        ₹{Number(p.price || 0).toLocaleString()} · Stock: {p.stock_quantity || 0}
                      </p>
                    </div>
                    <button onClick={() => handleAddItem(p.id)} className="p-2 rounded-lg hover:bg-white/20">
                      <Plus size={16} style={{ color: B.green }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {orderItems.length > 0 && (
              <div className="mb-6">
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: B.textMuted }}>
                  Order Items ({orderItems.length})
                </label>
                <div className="space-y-2">
                  {orderItems.map((item) => (
                    <div key={item.product_id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.30)", border: "1px solid rgba(255,255,255,0.45)" }}>
                      <div className="flex-1">
                        <p className="text-sm font-medium" style={{ color: B.text }}>
                          {item.product_name}
                        </p>
                        <p className="text-xs" style={{ color: B.textMuted }}>
                          ₹{item.unit_price.toLocaleString()} each
                        </p>
                      </div>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.product_id, Number(e.target.value))}
                        className="w-16 px-2 py-1 text-sm rounded outline-none text-center"
                        style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", color: B.text }}
                      />
                      <p className="text-sm font-semibold w-24 text-right" style={{ color: B.text }}>
                        ₹{(item.unit_price * item.quantity).toLocaleString()}
                      </p>
                      <button onClick={() => handleRemoveItem(item.product_id)} className="p-1.5 rounded-lg hover:bg-red-500/20">
                        <Trash2 size={14} style={{ color: B.red }} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 rounded-xl mb-6" style={{ background: "rgba(78,128,80,0.10)", border: "1px solid rgba(78,128,80,0.20)" }}>
              <div className="flex items-center justify-between">
                <span style={{ color: B.textMuted }}>Total Amount:</span>
                <span className="text-lg font-bold" style={{ color: B.text }}>
                  ₹{totalAmount.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <PrimaryButton icon={Send} onClick={handleSubmit} disabled={submitting || !selectedCustomer || orderItems.length === 0}>
                {submitting ? "Creating…" : "Create Order"}
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
