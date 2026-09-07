import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { toast } from 'sonner';

export function useHardwareBackButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const lastBackPressTimeRef = useRef<number>(0);
  const backPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const backButtonListener = CapApp.addListener('backButton', () => {
      // 1. Check for explicit data-modal-close-trigger elements in DOM
      const closeTriggers = document.querySelectorAll('[data-modal-close-trigger]');
      if (closeTriggers.length > 0) {
        const topCloseBtn = closeTriggers[closeTriggers.length - 1] as HTMLElement;
        topCloseBtn.click();
        return;
      }

      // 2. Check for active open modal / overlay / dialog in DOM
      const activeModal = document.querySelector(
        '[role="dialog"], [aria-modal="true"], [data-state="open"], .fixed.inset-0.z-50, .fixed.inset-0.z-40'
      );

      if (activeModal) {
        const closeBtn = activeModal.querySelector(
          'button[data-modal-close-trigger], button[aria-label*="close" i], button[aria-label*="yop" i], button[aria-label*="bekor" i], button.close'
        ) as HTMLElement;

        if (closeBtn) {
          closeBtn.click();
          return;
        }

        // Fallback: Dispatch Escape key event to close open modal/dialog/sheet
        try {
          const escapeEvent = new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            which: 27,
            bubbles: true,
            cancelable: true,
          });
          document.dispatchEvent(escapeEvent);
        } catch {
          const event: any = document.createEvent('KeyboardEvent');
          if (event.initEvent) event.initEvent('keydown', true, true);
          document.dispatchEvent(event);
        }
        return;
      }

      // 3. Check if on root screen or an inner subpage/tab
      const pathname = location.pathname;
      const cleanPath = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
      const isRootScreen = cleanPath === '/dashboard' || cleanPath === '' || cleanPath === '/' || cleanPath === '/login';

      if (!isRootScreen) {
        // If on an inner subpage or non-home tab: navigate back to the main/home tab
        navigate('/dashboard');
        return;
      }

      // 4. On root screen: double-tap within 2000ms to exit app
      const now = Date.now();
      if (now - lastBackPressTimeRef.current < 2000) {
        if (backPressTimerRef.current) {
          clearTimeout(backPressTimerRef.current);
          backPressTimerRef.current = null;
        }
        lastBackPressTimeRef.current = 0;
        CapApp.exitApp();
      } else {
        lastBackPressTimeRef.current = now;
        toast("Chiqish uchun yana bir marta bosing");

        if (backPressTimerRef.current) {
          clearTimeout(backPressTimerRef.current);
        }
        backPressTimerRef.current = setTimeout(() => {
          lastBackPressTimeRef.current = 0;
          backPressTimerRef.current = null;
        }, 2000);
      }
    });

    return () => {
      if (backPressTimerRef.current) {
        clearTimeout(backPressTimerRef.current);
      }
      backButtonListener.then((handler) => handler.remove());
    };
  }, [location.pathname, navigate]);
}
