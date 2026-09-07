import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { nativeNotificationService } from '../services/nativeNotificationService';
import { healthSyncService } from '../services/healthSyncService';
import { useHardwareBackButton } from './useHardwareBackButton';

interface UseMobileLifecycleOptions {
  isDark: boolean;
  profileId?: string;
}

export function useMobileLifecycle({ isDark, profileId }: UseMobileLifecycleOptions) {
  // Mount global Android hardware back button listener (double-tap exit, modal close, subpage navigation)
  useHardwareBackButton();

  // Sync Status Bar theme with app theme
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const updateStatusBar = async () => {
      try {
        if (isDark) {
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#0E1117' });
        } else {
          await StatusBar.setStyle({ style: Style.Light });
          await StatusBar.setBackgroundColor({ color: '#F9FAFB' });
        }
      } catch (err) {
        console.warn('StatusBar update failed:', err);
      }
    };

    updateStatusBar();
  }, [isDark]);

  // Request Notification Permissions on Startup
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const setupNotifications = async () => {
      try {
        await nativeNotificationService.init();
        await nativeNotificationService.requestPermissions();
      } catch (err) {
        console.warn('Native notification setup failed:', err);
      }
    };

    setupNotifications();
  }, []);

  // Health Connect Auto-Sync
  useEffect(() => {
    if (!profileId || !Capacitor.isNativePlatform()) return;

    const syncHealth = async () => {
      try {
        const isAvailable = await healthSyncService.isAvailable();
        if (!isAvailable) return;

        const isAuthorized = await healthSyncService.checkPermissions();
        if (!isAuthorized) {
          const hasAsked = localStorage.getItem('health_permissions_asked');
          if (!hasAsked) {
            await healthSyncService.requestPermissions();
            localStorage.setItem('health_permissions_asked', 'true');
          }
        } else {
          // Silent background sync
          await healthSyncService.syncAndSave(profileId);
        }
      } catch (err) {
        console.warn('Health auto-sync failed:', err);
      }
    };

    syncHealth();
  }, [profileId]);
}
