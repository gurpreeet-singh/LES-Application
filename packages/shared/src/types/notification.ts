// Notifications

export type NotificationChannel = 'in_app' | 'whatsapp' | 'email' | 'push';
export type NotificationCategory = 'assessment' | 'content' | 'attendance' | 'recording' | 'recommendation' | 'system';
export type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Notification {
  id: string;
  user_id: string;
  channel: NotificationChannel;
  category: NotificationCategory;
  title: string;
  body: string;
  action_url?: string;
  external_id?: string;
  delivery_status: DeliveryStatus;
  read_at?: string;
  created_at: string;
}
