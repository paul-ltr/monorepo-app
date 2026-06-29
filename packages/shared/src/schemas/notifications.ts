import { z } from 'zod';
import { uuid, isoTimestamp } from '../ids';
import { notificationSeverity } from '../enums';

export const notification = z.object({
  id: uuid,
  severity: notificationSeverity,
  category: z.enum(['Maintenance', 'Énergie', 'Recettes', 'Réseau']),
  icon: z.enum(['power', 'droplet', 'euro', 'alert', 'wrench']),
  title: z.string(),
  body: z.string(),
  siteName: z.string(),
  at: isoTimestamp,
  read: z.boolean(),
});
export type Notification = z.infer<typeof notification>;

export const notificationList = z.object({
  items: z.array(notification),
  unreadCount: z.number().int(),
});
export type NotificationList = z.infer<typeof notificationList>;

export const notificationPrefs = z.object({
  critical: z.array(z.enum(['push', 'email', 'sms'])),
  warning: z.array(z.enum(['push', 'email', 'sms'])),
  info: z.array(z.enum(['push', 'email', 'sms'])),
  dailyDigest: z.boolean(),
});
export type NotificationPrefs = z.infer<typeof notificationPrefs>;
