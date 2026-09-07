import { useMemo, useState } from 'react';

import {
  notificationCategories,
  previewNotifications,
  type NotificationCategory,
  type NotificationPermissionState,
  type NotificationScreen,
  type NotificationTarget,
} from '../models/Notification';

export function useNotificationsViewModel() {
  const [screen, setScreen] = useState<NotificationScreen>('center');
  const [history, setHistory] = useState<NotificationScreen[]>([]);
  const [notifications, setNotifications] = useState(previewNotifications);
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('All');
  const [permissionState, setPermissionState] =
    useState<NotificationPermissionState>('notDetermined');
  const [notice, setNotice] = useState<string | null>(null);

  const unreadCount = notifications.filter((item) => !item.read).length;
  const filteredNotifications = useMemo(
    () =>
      activeCategory === 'All'
        ? notifications
        : notifications.filter((item) => item.category === activeCategory),
    [activeCategory, notifications],
  );

  const navigate = (next: NotificationScreen) => {
    setHistory((current) => [...current, screen]);
    setScreen(next);
    setNotice(null);
  };

  const goBack = () => {
    setHistory((current) => {
      setScreen(current.at(-1) ?? 'center');
      return current.slice(0, -1);
    });
    setNotice(null);
  };

  const openCenter = () => {
    setScreen('center');
    setHistory([]);
    setNotice(null);
  };

  const openNotification = (id: string): NotificationTarget => {
    const selected = notifications.find((item) => item.id === id);
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
    return selected?.target ?? 'none';
  };

  const markAllRead = () =>
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));

  const previewEmptyState = () => navigate('empty');

  const restorePreviewNotifications = () => {
    setNotifications(previewNotifications);
    setActiveCategory('All');
    openCenter();
  };

  const grantPermissionPreview = () => {
    setPermissionState('granted');
    openCenter();
    setNotice('Push notifications are shown as enabled in this frontend preview.');
  };

  const denyPermissionPreview = () => {
    setPermissionState('denied');
    setScreen('permissionDenied');
    setNotice(null);
  };

  return {
    screen,
    notifications,
    filteredNotifications,
    categories: notificationCategories,
    activeCategory,
    permissionState,
    unreadCount,
    notice,
    navigate,
    goBack,
    openCenter,
    setActiveCategory,
    openNotification,
    markAllRead,
    previewEmptyState,
    restorePreviewNotifications,
    grantPermissionPreview,
    denyPermissionPreview,
    setNotice,
  };
}

export type NotificationsViewModel = ReturnType<typeof useNotificationsViewModel>;
