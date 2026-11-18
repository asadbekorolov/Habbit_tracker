// Personaj (vaqtinchalik) — ovozsiz, takrorlanuvchi video. Haqiqiy personaj
// tayyor bo'lgach shu komponent ichini almashtirish kifoya.
// - Ekranda ko'rinmasa yoki ilova fonga o'tsa — to'xtaydi (batareya)
// - "Kamroq harakat" (prefers-reduced-motion) yoqilgan bo'lsa — faqat poster
import { useEffect, useRef, useState } from "react";

export const CHARACTER_VIDEO_SRC = "/assets/character/idle.mp4";
export const CHARACTER_POSTER_SRC = "/assets/character/idle-poster.jpg";

interface CharacterVideoProps {
  className?: string;
  /** object-position, masalan "50% 30%" */
  position?: string;
  /**
   * full — personaj to'liq bo'yi bilan (Bosh sahifa, Profil);
   * closeup — yuz va yelkagacha yaqinlashtirilgan kadr (AI Tahlil:
   * yuzma-yuz suhbat effekti).
   */
  variant?: "full" | "closeup";
}

const VARIANT_CLASS = {
  full: "",
  closeup: "object-top scale-[1.85] origin-top",
} as const;

function prefersReducedMotion(): boolean {
  try { return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false; } catch { return false; }
}

export function CharacterVideo({ className = "", position, variant = "full" }: CharacterVideoProps) {
  const objectPosition = position ?? (variant === "closeup" ? "50% 0%" : "50% 35%");
  const variantClass = VARIANT_CLASS[variant];
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [still] = useState(prefersReducedMotion);

  useEffect(() => {
    const video = ref.current;
    if (!video || still) return;
    // React "muted" atributini har doim DOM'ga yozmaydi — autoplay uchun aniq o'rnatamiz
    video.muted = true;
    video.defaultMuted = true;

    let visible = true;
    const sync = () => {
      if (visible && document.visibilityState === "visible") video.play().catch(() => {});
      else video.pause();
    };
    const io = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: 0.15 })
      : null;
    io?.observe(video);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", sync);
      video.pause();
    };
  }, [still]);

  if (still || failed) {
    return (
      <img
        src={CHARACTER_POSTER_SRC}
        alt=""
        aria-hidden="true"
        className={`w-full h-full object-cover ${variantClass} ${className}`}
        style={{ objectPosition }}
      />
    );
  }

  return (
    <video
      ref={ref}
      src={CHARACTER_VIDEO_SRC}
      poster={CHARACTER_POSTER_SRC}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      onError={() => setFailed(true)}
      className={`w-full h-full object-cover pointer-events-none select-none ${variantClass} ${className}`}
      style={{ objectPosition }}
    />
  );
}
