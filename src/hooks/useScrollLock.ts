import { useEffect } from 'react';

// Global counter to track nested modals/overlays safely
let activeModalCount = 0;
let originalStyles: {
  overflow: string;
  overscrollBehavior: string;
  touchAction: string;
} | null = null;

export function useScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;

    if (activeModalCount === 0) {
      originalStyles = {
        overflow: document.body.style.overflow,
        overscrollBehavior: document.body.style.overscrollBehavior,
        touchAction: document.body.style.touchAction,
      };

      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';
      document.body.style.touchAction = 'none';
    }

    activeModalCount++;

    return () => {
      activeModalCount = Math.max(0, activeModalCount - 1);

      if (activeModalCount === 0 && originalStyles) {
        document.body.style.overflow = originalStyles.overflow;
        document.body.style.overscrollBehavior = originalStyles.overscrollBehavior;
        document.body.style.touchAction = originalStyles.touchAction;
        originalStyles = null;
      }
    };
  }, [isLocked]);
}
