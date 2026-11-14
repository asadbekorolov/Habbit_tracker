import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useScrollLock } from '../hooks/useScrollLock';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  maxWidthClass?: string;
  className?: string;
  showCloseButton?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidthClass = 'sm:max-w-lg',
  className = '',
  showCloseButton = true,
}: ModalProps) {
  useScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overscroll-contain touch-none"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className={`w-full ${maxWidthClass} bg-slate-900/95 border border-slate-800 text-white rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col max-h-[85vh] overscroll-contain touch-pan-y ${className}`}
        >
          {/* Optional Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 shrink-0">
              <div className="flex-1 min-w-0 font-bold text-base sm:text-lg text-white">
                {title}
              </div>
              {showCloseButton && (
                <button
                  type="button"
                  data-modal-close-trigger
                  aria-label="yopish"
                  onClick={onClose}
                  className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          )}

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y pr-1 space-y-4 text-slate-200">
            {children}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
