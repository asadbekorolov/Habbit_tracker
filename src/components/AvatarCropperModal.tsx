import React, { useState, useCallback } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, RotateCcw, Loader2 } from "lucide-react";
import { getCroppedImg } from "../utils/cropImage";

interface AvatarCropperModalProps {
  imageSrc: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (croppedFile: File, croppedUrl: string) => void;
}

export function AvatarCropperModal({ imageSrc, isOpen, onClose, onCropComplete }: AvatarCropperModalProps) {
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);

  const onCropChange = (newCrop: { x: number; y: number }) => {
    setCrop(newCrop);
  };

  const onZoomChange = (newZoom: number) => {
    setZoom(newZoom);
  };

  const onCropCompleteCallback = useCallback((_croppedArea: Area, currentCroppedAreaPixels: Area) => {
    setCroppedAreaPixels(currentCroppedAreaPixels);
  }, []);

  const handleApplyCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setProcessing(true);

    try {
      const { file, url } = await getCroppedImg(imageSrc, croppedAreaPixels, "image/jpeg", 0.85);
      onCropComplete(file, url);
      onClose();
    } catch (e) {
      console.error("Cropping error:", e);
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[85vh] max-h-[650px] relative"
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between shrink-0 z-10">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Rasmni Qirqish va Masshtablash</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-all"
            >
              <X size={16} />
            </button>
          </div>

          {/* Crop Area */}
          <div className="relative flex-1 w-full bg-slate-900 overflow-hidden">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              showGrid={false}
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onCropComplete={onCropCompleteCallback}
            />
          </div>

          {/* Controls Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col gap-4 shrink-0 z-10">
            {/* Zoom Slider */}
            <div className="flex items-center gap-3 px-2">
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.05}
                aria-label="Zoom"
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
              <button
                type="button"
                onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1); }}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white shrink-0"
                title="Qayta tiklash"
              >
                <RotateCcw size={14} />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 rounded-2xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all active:scale-95"
              >
                Bekor qilish
              </button>

              <button
                type="button"
                disabled={processing}
                onClick={handleApplyCrop}
                className="flex-1 py-3 px-4 rounded-2xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
              >
                {processing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Tayyorlanmoqda...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} strokeWidth={3} />
                    <span>Tanlash</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
