import { useState } from "react";
import { X, Check, Loader2 } from "lucide-react";
import { purchaseCoinItem, buyStar, isStarActive } from "../../services/db";
import type { Profile } from "../../services/supabase";
import { useLang } from "../../store/LangContext";

interface CoinShopModalProps {
  isDark: boolean;
  profile: Profile;
  coins: number;
  onClose: () => void;
  onCoinsChange: (newCoins: number) => void;
  // Star sotib olingach/yangilangach yangi tugash sanasi bilan chaqiriladi —
  // profile.star_expires_at App.tsx'da darhol yangilanmagani uchun bu
  // modal o'zining lokal holatini yuritadi, ProfilePage esa shundan xabardor
  // bo'lib o'z ⭐ belgisini yangilaydi.
  onStarPurchased?: (newExpiresAt: string) => void;
}

export function CoinShopModal({ isDark, profile, coins, onClose, onCoinsChange, onStarPurchased }: CoinShopModalProps) {
  const { t } = useLang();
  const [starExpiresAt, setStarExpiresAt] = useState<string | null>(profile.star_expires_at ?? null);
  const starActive = isStarActive({ has_star: true, star_expires_at: starExpiresAt });

  const ITEMS = [
    {
      id: "streak_freeze",
      name: t('shop_item_freeze_name'),
      desc: t('shop_item_freeze_desc'),
      price: 10,
      emoji: "🛡️",
      color: "#93C5FD",
      colorBg: "rgba(147,197,253,0.1)",
      colorBorder: "rgba(147,197,253,0.22)",
      isStar: false,
    },
    {
      id: "star_badge",
      name: t('shop_item_star_name'),
      desc: t('shop_item_star_desc'),
      price: 500,
      emoji: "⭐",
      color: "#FBBF24",
      colorBg: "rgba(251,191,36,0.1)",
      colorBorder: "rgba(251,191,36,0.22)",
      isStar: true,
    },
  ];
  const [currentCoins, setCurrentCoins] = useState(coins);
  const [buying, setBuying] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleBuy(item: typeof ITEMS[0]) {
    if (currentCoins < item.price) return;
    setBuying(item.id);
    setError("");
    setSuccess(null);
    try {
      if (item.isStar) {
        const newExpiry = await buyStar(profile.id);
        setCurrentCoins((c) => {
          const next = c - item.price;
          onCoinsChange(next);
          return next;
        });
        setStarExpiresAt(newExpiry);
        onStarPurchased?.(newExpiry);
      } else {
        const newBalance = await purchaseCoinItem(profile.id, item.id, item.price);
        setCurrentCoins(newBalance);
        onCoinsChange(newBalance);
      }
      setSuccess(item.id);
      setTimeout(() => setSuccess(null), 2500);
    } catch (e: any) {
      setError(e.message || t('shop_error_generic'));
    } finally {
      setBuying(null);
    }
  }

  const modalBg: React.CSSProperties = {
    background: isDark ? "#161B22" : "#ffffff",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{ ...modalBg, maxHeight: "85vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}` }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
              style={{ background: "rgba(167,139,250,0.15)" }}
            >
              🪙
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{t('profile_coin_shop')}</p>
              <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                {t('shop_balance')}{" "}
                <span className="font-bold" style={{ color: "#A78BFA", fontFamily: "'Geist Mono', monospace" }}>
                  {currentCoins} 🪙
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)", color: "var(--muted-foreground)" }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Items */}
        <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: "60vh", paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
          {error && (
            <div
              className="px-3 py-2 rounded-xl text-xs"
              style={{ background: "rgba(248,113,113,0.1)", color: "#F87171", border: "1px solid rgba(248,113,113,0.25)" }}
            >
              ⚠ {error}
            </div>
          )}

          {ITEMS.map(item => {
            const canAfford = currentCoins >= item.price;
            const isBuying = buying === item.id;
            const isSuccess = success === item.id;
            // Star endi 30 kunlik obuna — "egalik" doim tugaydi, shuning
            // uchun tugma hech qachon butunlay o'chirilmaydi, faol bo'lsa
            // "Uzaytirish" (cho'zish) sifatida qoladi.
            const buyLabel = item.isStar && starActive ? t('shop_extend') : t('shop_buy');

            return (
              <div
                key={item.id}
                className="p-4 rounded-2xl"
                style={{ background: item.colorBg, border: `1px solid ${item.colorBorder}` }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{ background: isDark ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.6)" }}
                  >
                    {item.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: item.color }}>{item.name}</p>
                    <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                      {item.desc}
                    </p>
                    {item.isStar && starActive && starExpiresAt && (
                      <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: "#4ADE80" }}>
                        <Check size={10} /> {t('shop_active_until')} {new Date(starExpiresAt).toLocaleDateString()}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      <span
                        className="text-sm font-bold"
                        style={{ color: "#A78BFA", fontFamily: "'Geist Mono', monospace" }}
                      >
                        🪙 {item.price}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleBuy(item)}
                        disabled={!canAfford || isBuying}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                        style={{
                          background: isSuccess
                            ? "rgba(74,222,128,0.15)"
                            : !canAfford
                            ? isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"
                            : item.colorBg,
                          color: isSuccess ? "#4ADE80" : !canAfford ? "var(--muted-foreground)" : item.color,
                          border: `1px solid ${
                            isSuccess ? "rgba(74,222,128,0.3)" : !canAfford ? "rgba(255,255,255,0.08)" : item.colorBorder
                          }`,
                          opacity: isBuying ? 0.7 : 1,
                        }}
                      >
                        {isBuying ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : isSuccess ? (
                          <><Check size={12} /> {t('shop_purchased')}</>
                        ) : !canAfford ? (
                          t('shop_insufficient')
                        ) : (
                          buyLabel
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div
          className="px-5 py-3.5 text-center"
          style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}` }}
        >
          <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
            {t('shop_hint_before')}{" "}
            <span style={{ color: "#A78BFA", fontWeight: 600 }}>+1 🪙</span> {t('shop_hint_after')}
          </p>
        </div>
      </div>
    </div>
  );
}
