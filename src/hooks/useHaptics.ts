import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export function useHaptics() {
  const isNative = Capacitor.isNativePlatform();

  const isHapticsEnabled = () => {
    try {
      const stored = localStorage.getItem('haptics_enabled');
      return stored === 'true'; // Disabled for minor taps to preserve battery
    } catch {
      return false;
    }
  };

  const impactLight = async () => {
    if (!isNative || !isHapticsEnabled()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
  };

  const impactMedium = async () => {
    if (!isNative || !isHapticsEnabled()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {}
  };

  const impactHeavy = async () => {
    if (!isNative || !isHapticsEnabled()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {}
  };

  // Keep success and error notifications for key achievements / task completions
  const notificationSuccess = async () => {
    if (!isNative) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {}
  };

  const notificationWarning = async () => {
    if (!isNative || !isHapticsEnabled()) return;
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch {}
  };

  const notificationError = async () => {
    if (!isNative) return;
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {}
  };

  const selectionChanged = async () => {
    // Disabled to prevent battery drain on minor scroll / selection events
    return;
  };

  const vibrate = async (duration = 150) => {
    if (!isNative || !isHapticsEnabled()) return;
    try {
      await Haptics.vibrate({ duration });
    } catch {}
  };

  return {
    impactLight,
    impactMedium,
    impactHeavy,
    notificationSuccess,
    notificationWarning,
    notificationError,
    selectionChanged,
    vibrate,
  };
}
