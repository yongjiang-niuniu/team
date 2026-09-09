import api from '../../api/axios';

export type AppNotification = {
  id: number;
  user_id: number;
  kind: string;
  severity: string;
  title: string;
  body?: string | null;
  target_path?: string | null;
  read_at?: string | null;
  created_at?: string | null;
};

export async function fetchMyNotifications(limit = 20): Promise<{
  notifications: AppNotification[];
  unread_count: number;
}> {
  const response = await api.get('/api/notifications/mine', {
    params: { limit },
  });
  return {
    notifications: response.data?.notifications ?? [],
    unread_count: response.data?.unread_count ?? 0,
  };
}

export async function markNotificationRead(notificationId: number): Promise<AppNotification | null> {
  const response = await api.patch(`/api/notifications/${notificationId}/read`);
  return response.data?.notification ?? null;
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  const response = await api.patch('/api/notifications/read-all');
  return response.data ?? { updated: 0 };
}
