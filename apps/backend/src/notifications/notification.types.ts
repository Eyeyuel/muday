export type NotificationKind =
  'morning_reminder' | 'night_status' | 'weekly_summary' | 'monthly_summary';

export const MORNING_HOURS = [6, 7, 8, 9] as const;
export const NIGHT_HOURS = [20, 21, 22] as const;
export type MorningHour = (typeof MORNING_HOURS)[number];
export type NightHour = (typeof NIGHT_HOURS)[number];

export interface NotificationJobData {
  jobType: 'delivery';
  deliveryId: string;
  userId: string;
  kind: NotificationKind;
  periodKey: string;
  scheduledHour?: number;
}

export interface NotificationFanoutJobData {
  jobType: 'fanout';
  kind: NotificationKind;
  hour?: number;
}

export type NotificationQueueJobData = NotificationJobData | NotificationFanoutJobData;

export const NOTIFICATION_QUEUE_NAME = 'mezgeb-notifications';
export const NOTIFICATION_JOB_NAME = 'send-notification';
