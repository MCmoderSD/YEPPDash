export type NotificationKind = 'success' | 'failure';

export interface Notification {
  id: number;
  kind: NotificationKind;
  message: string;
}