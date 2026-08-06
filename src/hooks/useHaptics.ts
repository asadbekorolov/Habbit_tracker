import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export function useHaptics() {
  const isNative = Capacitor.isNativePlatform();

  const impactLight = async () => {
    if (!isNative) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Ignore if unsupported
    }
  };

  const impactMedium = async () => {
    if (!isNative) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      // Ignore if unsupported
    }
  };

  const impactHeavy = async () => {
    if (!isNative) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      // Ignore if unsupported
    }
  };

  const notificationSuccess = async () => {
    if (!isNative) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      // Ignore if unsupported
    }
  };

  const notificationWarning = async () => {
    if (!isNative) return;
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch {
      // Ignore if unsupported
    }
  };

  const notificationError = async () => {
    if (!isNative) return;
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {
      // Ignore if unsupported
    }
  };

  const selectionChanged = async () => {
    if (!isNative) return;
    try {
      await Haptics.selectionChanged();
    } catch {
      // Ignore if unsupported
    }
  };

  const vibrate = async (duration = 300) => {
    if (!isNative) return;
    try {
      await Haptics.vibrate({ duration });
    } catch {
      // Ignore if unsupported
    }
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
