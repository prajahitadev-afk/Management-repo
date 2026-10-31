import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import type { NotificationRecord } from "../services/notification.service";
import {
  getNotifications,
  markAllAsRead as markAllNotificationsAsRead,
  markAsRead as markNotificationAsRead,
} from "../services/notification.service";
import { isValidUUID } from "../utils/uuid";

function mapNotificationRow(value: Record<string, unknown>): NotificationRecord {
  return {
    id: String(value.id ?? ""),
    user_id: String(value.user_id ?? ""),
    type: String(value.type ?? "custom") as NotificationRecord["type"],
    title: String(value.title ?? ""),
    message: String(value.message ?? ""),
    related_entity_type: value.related_entity_type ? String(value.related_entity_type) : null,
    related_entity_id: value.related_entity_id ? String(value.related_entity_id) : null,
    read: Boolean(value.is_read),
    created_at: value.created_at ? String(value.created_at) : null,
    action_url: value.action_url ? String(value.action_url) : null,
    forwarded_from: value.forwarded_from ? String(value.forwarded_from) : null,
    forwarded_to: value.forwarded_to ? String(value.forwarded_to) : null,
    forwarded_at: value.forwarded_at ? String(value.forwarded_at) : null,
  };
}

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
        const newNotif = mapNotificationRow(payload.new as Record<string, unknown>);
        setNotifications((current) => [newNotif, ...current.filter((item) => item.id !== newNotif.id)]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        const updatedNotif = mapNotificationRow(payload.new as Record<string, unknown>);
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
        subscriptionRef.current = null;
      }
    };
  }, [userId]);

  async function markRead(notificationId: string) {
    await markNotificationAsRead(notificationId);
    setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, read: true } : item));
  }

  async function markAllRead() {
    if (!isValidUUID(userId)) return;
    await markAllNotificationsAsRead(userId);
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  }

  return {
    notifications,
    loading,
    error,
    markRead,
    markAllRead,
  };
}
