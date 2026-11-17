// Android apparat "Orqaga" tugmasi.
// Ustuvorlik (utils/navStack.ts -> decideBack, testlari bilan):
//   1) ochiq modal / bottom sheet / menyu — eng ustkisi yopiladi;
//   2) sahifalar tarixi (LIFO) — bir qadam orqaga (Tahlil -> Reyting -> Tahlil);
//   3) tarix bo'sh, Bosh sahifada emas — Bosh sahifaga;
//   4) Bosh sahifada — 2 soniya ichida ikkinchi bosishda chiqish.
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { toast } from 'sonner';
import { navHistory } from '../services/navHistory';
import { decideBack, normalizePath } from '../utils/navStack';
import { getT, type Lang } from '../utils/i18n';

/** Eng ustki ochiq oynani yopuvchi amal (yo'q bo'lsa null). */
function findTopOverlayCloser(): (() => void) | null {
  // a) Aniq belgilangan yopish tugmalari — DOM'dagi oxirgisi eng ustki
  const triggers = document.querySelectorAll<HTMLElement>('[data-modal-close-trigger]');
  if (triggers.length > 0) {
    const top = triggers[triggers.length - 1];
    return () => top.click();
  }
  // b) Boshqa ochiq dialog/sheet
  const dialogs = document.querySelectorAll<HTMLElement>(
    '[role="dialog"], [aria-modal="true"], [data-state="open"], .fixed.inset-0.z-50, .fixed.inset-0.z-40'
  );
  if (dialogs.length === 0) return null;
  const active = dialogs[dialogs.length - 1];
  const btn = active.querySelector<HTMLElement>(
    'button[data-modal-close-trigger], button[aria-label*="close" i], button[aria-label*="yop" i], button[aria-label*="bekor" i], button.close'
  );
  if (btn) return () => btn.click();
  return () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
  };
}

function currentLang(): Lang {
  try { return (localStorage.getItem('lang') as Lang) || 'uz'; } catch { return 'uz'; }
}

export function useHardwareBackButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const lastPressRef = useRef(0);
  const pathRef = useRef('');

  // Har bir sahifaga o'tish tarixga yoziladi (ketma-ket takror yozilmaydi)
  const current = normalizePath(location.pathname, location.search);
  useEffect(() => {
    pathRef.current = current;
    if (current === '/login') navHistory.reset();
    else navHistory.record(current);
  }, [current]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = CapApp.addListener('backButton', () => {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});

      const closer = findTopOverlayCloser();
      const now = Date.now();
      const action = decideBack({
        overlayOpen: !!closer,
        stack: navHistory.get(),
        currentPath: pathRef.current,
        now,
        lastPressAt: lastPressRef.current,
      });

      switch (action.type) {
        case 'close-overlay':
          closer?.();
          return;
        case 'navigate':
          navHistory.set(action.stack);
          navigate(action.to);
          return;
        case 'confirm-exit':
          lastPressRef.current = now;
          toast(getT(currentLang())('back_exit_confirm', "Ilovadan chiqish uchun yana bir marta bosing"), { duration: 2000 });
          return;
        case 'exit':
          lastPressRef.current = 0;
          CapApp.exitApp();
          return;
      }
    });

    return () => {
      listener.then((h) => h.remove()).catch(() => {});
    };
  }, [navigate]);
}
