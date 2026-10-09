import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import type { NotificationRecord } from "../services/notification.service";
import { getNotifications } from "../services/notification.service";
import { isValidUUID } from "../utils/uuid";

export function useNotifications(userId?: string) {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    if (!isValidUUID(userId)) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    let active = true;

    async function load() {
      const activeUserId = userId;
      if (!activeUserId) {
        if (active) {
          setNotifications([]);
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const items = await getNotifications(activeUserId);
        if (active) setNotifications(items);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load notifications");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    const channel = supabase
      .channel(`notifications-user-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        const newNotif = payload.new as NotificationRecord;
        setNotifications((current) => [newNotif, ...current]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        const updatedNotif = payload.new as NotificationRecord;
        setNotifications((current) => current.map((item) => item.id === updatedNotif.id ? updatedNotif : item));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        const deletedId = String(payload.old?.id ?? "");
        setNotifications((current) => current.filter((item) => item.id !== deletedId));
      })
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      active = false;
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [userId]);

  return {
    notifications,
    loading,
    error,
  };
}
