import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App as CapApp } from '@capacitor/app';

interface UseMobileLifecycleOptions {
  isDark: boolean;
}

export function useMobileLifecycle({ isDark }: UseMobileLifecycleOptions) {
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

  // Handle Android native back button
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const backButtonListener = CapApp.addListener('backButton', ({ canGoBack }) => {
      // Check if any open modal / dialog exists in DOM
      const hasOpenModal = document.querySelector('[role="dialog"], [data-state="open"]');
      if (hasOpenModal) {
        // Trigger Escape key event to close topmost modal
        const escapeEvent = new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          keyCode: 27,
          which: 27,
          bubbles: true,
          cancelable: true,
        });
        document.dispatchEvent(escapeEvent);
        return;
      }

      if (canGoBack) {
        window.history.back();
      } else {
        CapApp.minimizeApp();
      }
    });

    return () => {
      backButtonListener.then((handler) => handler.remove());
    };
  }, []);
}
