import { useEffect, useState } from "react";
import {
  getDashboardMetrics,
  getShipments,
  getFleetStatus,
  getDeliveryReports,
  confirmDelivery,
  updateDeliveryStatus,
  getNextDeliveryStatus,
  TransportShipment,
  TransportMetrics,
  FleetVehicle,
  DeliveryReport,
} from "../services/transport.service";

export function useTransport() {
  const [metrics, setMetrics] = useState<TransportMetrics>({
    totalDeliveries: 0,
    created: 0,
    loaded: 0,
    dispatched: 0,
    awaitingConfirmation: 0,
    failed: 0,
    cancelled: 0,
    delivered: 0,
    pending: 0,
    inTransit: 0,
    delayed: 0,
    completed: 0,
  });

  const [shipments, setShipments] = useState<TransportShipment[]>([]);
  const [fleetStatus, setFleetStatus] = useState<FleetVehicle[]>([]);
  const [deliveryReports, setDeliveryReports] = useState<DeliveryReport>({
    totalDeliveries: 0,
    delivered: 0,
    pending: 0,
    delayed: 0,
    inTransit: 0,
    averageDeliveryTime: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshData() {
    try {
      setLoading(true);
      setError(null);

      const [metricsData, shipmentsData, fleetData, reportsData] = await Promise.all([
        getDashboardMetrics(),
        getShipments(),
        getFleetStatus(),
        getDeliveryReports(),
      ]);

      setMetrics(metricsData);
      setShipments(shipmentsData);
      setFleetStatus(fleetData);
      setDeliveryReports(reportsData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load transport data"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshData();
    const handleWorkflowChange = () => void refreshData();
    window.addEventListener("order-workflow-changed", handleWorkflowChange);
    return () => window.removeEventListener("order-workflow-changed", handleWorkflowChange);
  }, []);

  async function handleConfirmDelivery(deliveryId: string) {
    try {
      const success = await confirmDelivery(deliveryId);
      if (success) {
        await refreshData();
      }
    } catch (err) {
      console.error("Error confirming delivery:", err);
    }
  }

  async function handleUpdateStatus(deliveryId: string) {
    try {
      const shipment = shipments.find(s => s.deliveryId === deliveryId);
      if (!shipment) throw new Error("Shipment not found");

      const nextStatus = getNextDeliveryStatus(shipment.status);
      if (!nextStatus) throw new Error("No next status available");

      await updateDeliveryStatus(deliveryId, nextStatus);
      await refreshData();
    } catch (err) {
      console.error("Error updating delivery status:", err);
      throw err;
    }
  }

  return {
    metrics,
    shipments,
    fleetStatus,
    deliveryReports,
    loading,
    error,
    refreshData,
    confirmDelivery: handleConfirmDelivery,
    updateStatus: handleUpdateStatus,
  };
}
