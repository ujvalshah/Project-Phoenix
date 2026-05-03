import type { InAppNotification } from '@/services/notificationService';

export interface NotificationGroup {
  id: string;
  type: 'single' | 'grouped';
  notifications: InAppNotification[];
  primary: InAppNotification;
  count: number;
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export function groupNotifications(notifications: InAppNotification[]): NotificationGroup[] {
  if (notifications.length === 0) return [];

  const groups: NotificationGroup[] = [];
  let i = 0;

  while (i < notifications.length) {
    const current = notifications[i];

    if (current.type !== 'new_nugget') {
      groups.push({
        id: current._id,
        type: 'single',
        notifications: [current],
        primary: current,
        count: 1,
      });
      i++;
      continue;
    }

    const batch: InAppNotification[] = [current];
    let j = i + 1;

    while (j < notifications.length) {
      const next = notifications[j];
      if (next.type !== 'new_nugget') break;

      const timeDiff = Math.abs(
        new Date(current.createdAt).getTime() - new Date(next.createdAt).getTime(),
      );
      if (timeDiff > TWO_HOURS_MS) break;

      batch.push(next);
      j++;
    }

    if (batch.length >= 8) {
      groups.push({
        id: `group-${current._id}`,
        type: 'grouped',
        notifications: batch,
        primary: batch[0],
        count: batch.length,
      });
    } else {
      for (const n of batch) {
        groups.push({
          id: n._id,
          type: 'single',
          notifications: [n],
          primary: n,
          count: 1,
        });
      }
    }

    i = j;
  }

  return groups;
}
