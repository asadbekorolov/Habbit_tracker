import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Coins, Plus, RotateCcw, Shield, ShieldCheck, Zap, Star,
  BookOpen, CheckSquare, Send, Check, Loader2, Lock, Sparkles,
  ShoppingBag, X, ArrowRight, ExternalLink, Download, CreditCard,
  Crown, Award, AlertCircle, Flame
} from "lucide-react";
import { useUser } from "../store/UserContext";
import { useLang } from "../store/LangContext";
import {
  purchaseCoinItem, buyStar, isStarActive, getOwnedItemIds,
  updateUserProfile, getFramePurchases, cleanupExpiredFrame
} from "../services/db";
import { supabase } from "../services/supabase";
import { FRAMES, FRAME_DURATION_DAYS, PREMIUM_AVATAR_COLORS, USERNAME_GLOW_ID, USERNAME_GLOW_PRICE, getUsernameGlowStyle } from "../utils/cosmetics";
import { AvatarFrame } from "../components/AvatarFrame";
import type { Profile } from "../services/supabase";

interface StoreProps {
  isDark?: boolean;
  profile?: Profile;
  onProfileUpdate?: (p: Profile) => void;
  onClose?: () => void;
  isModal?: boolean;
}

export type CategoryTab = "all" | "buffs" | "frames" | "resources";

export interface TopUpPackage {
  id: string;
  name: string;
  coins: number;
  bonus: number;
  priceSom: string;
  popular?: boolean;
  color: string;
}

const TOP_UP_PACKAGES: TopUpPackage[] = [
  {
    id: "pack_small",
    name: "Kichik xalta",
    coins: 500,
    bonus: 0,
    priceSom: "9 900 so'm",
    color: "#38BDF8",
  },
  {
    id: "pack_gold",
    name: "Oltin qop",
    coins: 1500,
    bonus: 150,
    priceSom: "24 900 so'm",
    popular: true,
    color: "#FBBF24",
  },
  {
    id: "pack_chest",
    name: "Xazina sandig'i",
    coins: 5000,
    bonus: 550,
    priceSom: "59 900 so'm",
    color: "#A855F7",
  },
];

export interface ShopItem {
  id: string;
  category: "buffs" | "frames" | "resources";
  name: string;
  desc: string;
  price: number;
  icon: any;
  color: string;
  colorBg: string;
  colorBorder: string;
  type?: "buff" | "frame" | "glow" | "title" | "resource" | "star";
  actionUrl?: string;
  downloadUrl?: string;
}

export const TITLES = [
  { id: "title_master", name: "Intizom Ustasi", price: 150, color: "#38BDF8" },
  { id: "title_legend", name: "Besh Yulduzli Afsona", price: 350, color: "#F59E0B" },
];

export function Store({ isDark = true, profile: propsProfile, onProfileUpdate, onClose, isModal = false }: StoreProps) {
  const { t } = useLang();
  const { profile: contextProfile, setProfile, updateCoins, refreshUserProfile } = useUser();
  const profile = contextProfile || propsProfile;

  const [activeTab, setActiveTab] = useState<CategoryTab>("all");
  const [currentCoins, setCurrentCoins] = useState<number>(profile?.coins ?? 0);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [activeFrame, setActiveFrame] = useState<string | null>(profile?.active_frame ?? null);
  const [activeTitle, setActiveTitle] = useState<string | null>(profile?.active_title ?? null);
  const [starExpiresAt, setStarExpiresAt] = useState<string | null>(profile?.star_expires_at ?? null);
  const starActive = isStarActive({ has_star: true, star_expires_at: starExpiresAt });

  const [framePurchases, setFramePurchases] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState<boolean>(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [equipping, setEquipping] = useState<string | null>(null);

  // Top-Up Modal state
  const [showTopUpModal, setShowTopUpModal] = useState<boolean>(false);
  const [selectedPack, setSelectedPack] = useState<TopUpPackage | null>(null);
  const [topUpProcessing, setTopUpProcessing] = useState<boolean>(false);

  // Confirmation dialog state
  const [confirmItem, setConfirmItem] = useState<{ item: ShopItem | any; action: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (!profile) return;
    setCurrentCoins(profile.coins ?? 0);
    setActiveFrame(profile.active_frame ?? null);
    setActiveTitle(profile.active_title ?? null);
    setStarExpiresAt(profile.star_expires_at ?? null);

    Promise.all([
      getOwnedItemIds(profile.id),
      getFramePurchases(profile.id),
      cleanupExpiredFrame(profile.id),
    ]).then(([owned, frames, effectiveFrame]) => {
      setOwnedIds(owned);
      setFramePurchases(frames);
      setActiveFrame(effectiveFrame);
      if (effectiveFrame !== (profile.active_frame ?? null)) {
        onProfileUpdate?.({ ...profile, active_frame: effectiveFrame });
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [profile?.id]);

  if (!profile) return null;

  function frameExpiresAt(frameId: string): Date | null {
    const purchasedAt = framePurchases.get(frameId);
    if (!purchasedAt) return null;
    return new Date(new Date(purchasedAt).getTime() + FRAME_DURATION_DAYS * 24 * 60 * 60 * 1000);
  }

  function frameDaysLeft(frameId: string): number | null {
    const exp = frameExpiresAt(frameId);
    if (!exp) return null;
    const days = Math.ceil((exp.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return days > 0 ? days : null;
  }

  // Handle Top-Up checkout redirection (Opens Click / Payme payment URL safely)
  async function executeTopUp(pack: TopUpPackage, provider: 'click' | 'payme') {
    setTopUpProcessing(true);
    toast.info("To'lov sahifasiga o'tilmoqda...", { duration: 3000 });

    try {
      const priceNumeric = pack.priceSom.replace(/\D/g, '');
      let paymentUrl = "";

      if (provider === 'click') {
        paymentUrl = `https://my.click.uz/services/pay?amount=${priceNumeric}&merchant_param=${profile.id}&pack_id=${pack.id}`;
      } else {
        const amountInTiyin = Number(priceNumeric) * 100;
        paymentUrl = `https://checkout.paycom.uz/?amount=${amountInTiyin}&account[user_id]=${profile.id}&account[pack_id]=${pack.id}`;
      }

      // Open payment gateway URL safely in external window/browser
      window.open(paymentUrl, '_blank', 'noopener,noreferrer');

      setSelectedPack(null);
      setShowTopUpModal(false);
    } catch (e: any) {
      toast.error(e?.message || "To'lov sahifasiga o'tishda xatolik yuz berdi.");
    } finally {
      setTopUpProcessing(false);
    }
  }

  // Handle Equip / Unequip Frame
  async function handleEquipFrame(frameId: string) {
    const next = activeFrame === frameId ? null : frameId;
    setEquipping(frameId);
    try {
      const updated = await updateUserProfile(profile.id, { active_frame: next });
      setActiveFrame(next);
      setProfile(updated);
      onProfileUpdate?.(updated);
      toast.success(next ? "Ramka muvaffaqiyatli taqildi! ✨" : "Ramka yechildi.");
    } catch (e: any) {
      toast.error(e?.message || "Xatolik yuz berdi.");
    } finally {
      setEquipping(null);
    }
  }

  // Handle Equip / Unequip Title
  async function handleEquipTitle(titleId: string) {
    const next = activeTitle === titleId ? null : titleId;
    setEquipping(titleId);
    try {
      const updated = await updateUserProfile(profile.id, { active_title: next });
      setActiveTitle(next);
      setProfile(updated);
      onProfileUpdate?.(updated);
      toast.success(next ? "Unvon muvaffaqiyatli taqildi! 👑" : "Unvon yechildi.");
    } catch (e: any) {
      toast.error(e?.message || "Xatolik yuz berdi.");
    } finally {
      setEquipping(null);
    }
  }

  // Handle Generic Buy Action with Confirmation Dialog
  function triggerBuyWithConfirmation(item: ShopItem | any, buyFn: () => Promise<void>) {
    if (currentCoins < item.price) {
      toast.error("Tangalar yetarli emas! Tanga to'ldirish tugmasini bosing.");
      return;
    }
    setConfirmItem({
      item,
      action: buyFn,
    });
  }

  async function processConfirmedPurchase() {
    if (!confirmItem) return;
    const { action } = confirmItem;
    setConfirmItem(null);
    await action();
  }

  // Purchase Handlers
  async function buyItemStandard(item: ShopItem) {
    setBuying(item.id);
    try {
      const newBalance = await purchaseCoinItem(profile.id, item.id, item.price);
      setCurrentCoins(newBalance);
      updateCoins(newBalance);
      setOwnedIds((prev) => new Set(prev).add(item.id));

      if (item.actionUrl) {
        window.open(item.actionUrl, '_blank');
      }

      toast.success(`"${item.name}" muvaffaqiyatli xarid qilindi!`);
    } catch (e: any) {
      toast.error(e?.message || "Xarid qilishda xatolik yuz berdi.");
    } finally {
      setBuying(null);
    }
  }

  async function buyStarBadge() {
    setBuying("star_badge");
    try {
      const newExpiry = await buyStar(profile.id);
      const nextCoins = currentCoins - 500;
      setCurrentCoins(nextCoins);
      updateCoins(nextCoins);
      setStarExpiresAt(newExpiry);

      const updated = { ...profile, coins: nextCoins, has_star: true, star_expires_at: newExpiry };
      setProfile(updated);
      onProfileUpdate?.(updated);

      toast.success("VIP Status (Yulduz) faollashtirildi! 🌟");
    } catch (e: any) {
      toast.error(e?.message || "Xatolik yuz berdi.");
    } finally {
      setBuying(null);
    }
  }

  async function buyGlowName() {
    setBuying(USERNAME_GLOW_ID);
    try {
      const newBalance = await purchaseCoinItem(profile.id, USERNAME_GLOW_ID, USERNAME_GLOW_PRICE);
      setCurrentCoins(newBalance);
      updateCoins(newBalance);
      setOwnedIds((prev) => new Set(prev).add(USERNAME_GLOW_ID));

      const updated = await updateUserProfile(profile.id, { username_glow: true });
      setProfile(updated);
      onProfileUpdate?.(updated);

      toast.success("Yaltiroq ism effekti faollashtirildi! ✨");
    } catch (e: any) {
      toast.error(e?.message || "Xatolik yuz berdi.");
    } finally {
      setBuying(null);
    }
  }

  async function buyCosmetic(itemId: string, price: number, isFrame = false, isTitle = false) {
    setBuying(itemId);
    try {
      const newBalance = await purchaseCoinItem(profile.id, itemId, price);
      setCurrentCoins(newBalance);
      updateCoins(newBalance);
      setOwnedIds((prev) => new Set(prev).add(itemId));

      if (isFrame) {
        const updated = await updateUserProfile(profile.id, { active_frame: itemId });
        setActiveFrame(itemId);
        setProfile(updated);
        onProfileUpdate?.(updated);
        toast.success("Ramka xarid qilindi va taqildi! 🎨");
      } else if (isTitle) {
        const updated = await updateUserProfile(profile.id, { active_title: itemId });
        setActiveTitle(itemId);
        setProfile(updated);
        onProfileUpdate?.(updated);
        toast.success("Unvon xarid qilindi va taqildi! 👑");
      } else {
        toast.success("Xarid qilindi!");
      }
    } catch (e: any) {
      toast.error(e?.message || "Xatolik yuz berdi.");
    } finally {
      setBuying(null);
    }
  }

  // ITEMS CATALOG
  const BUFF_ITEMS: ShopItem[] = [
    {
      id: "streak_repair",
      category: "buffs",
      name: "Streak Qutqaruvchi (Tiklash)",
      desc: "Uzilib qolgan oxirgi seriyangizni (streak) qayta tiklang va natijangizni saqlab qoling! 🔥",
      price: 250,
      icon: RotateCcw,
      color: "#10B981",
      colorBg: "rgba(16,185,129,0.1)",
      colorBorder: "rgba(16,185,129,0.25)",
      type: "buff",
    },
    {
      id: "streak_freeze",
      category: "buffs",
      name: "Streak Qalqoni (1 kun)",
      desc: "1 kun davomida odat bajarilmasa ham seriyangiz va natijangiz buzilmaydi.",
      price: 10,
      icon: Shield,
      color: "#38BDF8",
      colorBg: "rgba(56,189,248,0.1)",
      colorBorder: "rgba(56,189,248,0.25)",
      type: "buff",
    },
    {
      id: "shield_gold_3d",
      category: "buffs",
      name: "Oltin Qalqon (3 kun)",
      desc: "3 kunlik ketma-ket himoya va seriyangizni saqlash kafolati.",
      price: 25,
      icon: ShieldCheck,
      color: "#F59E0B",
      colorBg: "rgba(245,158,11,0.1)",
      colorBorder: "rgba(245,158,11,0.25)",
      type: "buff",
    },
    {
      id: "xp_booster",
      category: "buffs",
      name: "XP Booster (2x)",
      desc: "Keyingi 24 soat davomida bajarilgan har bir odatdan 2 baravar ko'p XP to'plang!",
      price: 100,
      icon: Zap,
      color: "#A855F7",
      colorBg: "rgba(168,85,247,0.1)",
      colorBorder: "rgba(168,85,247,0.25)",
      type: "buff",
    },
    {
      id: "star_badge",
      category: "buffs",
      name: "VIP Status (Yulduz)",
      desc: "Profil va reytingda oltin yulduz belgisi hamda 30 kunlik eksklyuziv VIP imtiyozlar.",
      price: 500,
      icon: Star,
      color: "#FBBF24",
      colorBg: "rgba(251,191,36,0.12)",
      colorBorder: "rgba(251,191,36,0.3)",
      type: "star",
    },
  ];

  const RESOURCE_ITEMS: ShopItem[] = [
    {
      id: "pdf_focus_guide",
      category: "resources",
      name: "Fokus & Vaqtni Boshqarish Qo'llanmasi (PDF)",
      desc: "Proffessional vaqt boshqaruvi va doimiy fokusda bo'lish bo'yicha eksklyuziv qo'llanma.",
      price: 400,
      icon: BookOpen,
      color: "#818CF8",
      colorBg: "rgba(129,140,248,0.1)",
      colorBorder: "rgba(129,140,248,0.25)",
      type: "resource",
      downloadUrl: "https://example.com/focus_guide.pdf",
    },
    {
      id: "checklist_productivity",
      category: "resources",
      name: "Kunlik Samaradorlik Cheklisti",
      desc: "Har kungi ishlarni tartibga solish va maksimal natijaga erishish uchun bosqichma-bosqich cheklist.",
      price: 150,
      icon: CheckSquare,
      color: "#34D399",
      colorBg: "rgba(52,211,153,0.1)",
      colorBorder: "rgba(52,211,153,0.25)",
      type: "resource",
    },
    {
      id: "telegram_vip_access",
      category: "resources",
      name: "Yopiq Telegram Jamiyatiga Kirish",
      desc: "O'z ustida ishlaydigan kuchli hamjamiyat va ekspertlar bilan muloqot qiluvchi yopiq guruh.",
      price: 1000,
      icon: Send,
      color: "#38BDF8",
      colorBg: "rgba(56,189,248,0.1)",
      colorBorder: "rgba(56,189,248,0.25)",
      type: "resource",
      actionUrl: "https://t.me/+vip_community_tracker",
    },
  ];

  const filteredBuffs = activeTab === "all" || activeTab === "buffs" ? BUFF_ITEMS : [];
  const filteredResources = activeTab === "all" || activeTab === "resources" ? RESOURCE_ITEMS : [];
  const showFramesSection = activeTab === "all" || activeTab === "frames";

  return (
    <div className={`w-full ${isModal ? "" : "max-w-2xl mx-auto pb-24"}`}>
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 border border-slate-700/60 shadow-2xl mb-6">
        <div className="absolute -right-6 -bottom-6 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg">
              <Coins size={26} className="fill-amber-400/30" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{t('profile_coin_shop')}</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-white font-mono">{currentCoins}</span>
                <span className="text-xs font-bold text-amber-400">tanga</span>
              </div>
            </div>
          </div>

          {/* High contrast "Tanga olish" button */}
          <button
            type="button"
            onClick={() => setShowTopUpModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={16} strokeWidth={3} />
            <span>Tanga olish</span>
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 mb-6 overflow-x-auto no-scrollbar gap-1">
        {[
          { id: "all", label: "Hammasi" },
          { id: "buffs", label: "Qalqonlar" },
          { id: "frames", label: "Ramkalar" },
          { id: "resources", label: "Bilim & Resurslar" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as CategoryTab)}
            className={`flex-1 min-w-[90px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-slate-800 text-emerald-400 shadow-md border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {/* Buffs / Qalqonlar Section */}
        {filteredBuffs.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Faol Bufflar va Qalqonlar</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredBuffs.map((item) => {
                const Icon = item.icon;
                const isBuying = buying === item.id;
                const isStar = item.id === "star_badge";

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl flex flex-col justify-between transition-all hover:border-slate-600"
                    style={{ background: item.colorBg, border: `1px solid ${item.colorBorder}` }}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-10 h-10 rounded-xl bg-slate-900/60 border border-white/10 flex items-center justify-center">
                          <Icon className="w-5 h-5" style={{ color: item.color }} />
                        </div>
                        <span className="text-xs font-extrabold font-mono text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                          <Coins size={12} /> {item.price}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1">{item.name}</h4>
                      <p className="text-xs text-slate-300 leading-relaxed mb-4">{item.desc}</p>
                    </div>

                    <button
                      type="button"
                      disabled={isBuying}
                      onClick={() => {
                        if (isStar) {
                          triggerBuyWithConfirmation(item, buyStarBadge);
                        } else {
                          triggerBuyWithConfirmation(item, () => buyItemStandard(item));
                        }
                      }}
                      className="w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md disabled:opacity-50"
                    >
                      {isBuying ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Sotib olish</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Frames & Cosmetics Section */}
        {showFramesSection && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Crown className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Profil Ramkalari & Unvonlar</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4 mb-6">
              {FRAMES.map((frame) => {
                const daysLeft = frameDaysLeft(frame.id);
                const isOwned = daysLeft !== null || ownedIds.has(frame.id);
                const isEquipped = activeFrame === frame.id;
                const isBuying = buying === frame.id;
                const isEquipping = equipping === frame.id;

                return (
                  <div
                    key={frame.id}
                    className={`p-4 rounded-2xl flex flex-col justify-between items-center text-center transition-all border ${
                      isEquipped
                        ? "bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/5"
                        : "bg-slate-900/80 border-slate-800/80 hover:border-slate-700"
                    }`}
                  >
                    {/* Upper Preview Area */}
                    <div className="flex flex-col items-center pt-1 pb-2">
                      <AvatarFrame frameId={frame.id} radius={14}>
                        <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-xl shadow-inner">
                          👑
                        </div>
                      </AvatarFrame>
                      <p className="text-xs font-bold text-white tracking-tight mt-3 text-center line-clamp-1">
                        {frame.name}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">30 kunlik</p>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="w-full mt-3">
                      {isOwned ? (
                        <button
                          type="button"
                          disabled={isEquipping}
                          onClick={() => handleEquipFrame(frame.id)}
                          className={`w-full h-10 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                            isEquipped
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                          }`}
                        >
                          {isEquipping ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : isEquipped ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Taqilgan</span>
                            </>
                          ) : (
                            <span>Taqish</span>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isBuying}
                          onClick={() => triggerBuyWithConfirmation({ id: frame.id, name: frame.name, price: frame.price }, () => buyCosmetic(frame.id, frame.price, true, false))}
                          className="w-full h-10 px-3 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer whitespace-nowrap"
                        >
                          {isBuying ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Coins className="w-3.5 h-3.5 fill-slate-950" />
                              <span>{frame.price} · Sotib olish</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Titles & Glow Name */}
            <div className="space-y-3">
              <div
                className={`p-4 rounded-2xl flex items-center justify-between gap-3 border transition-all ${
                  ownedIds.has(USERNAME_GLOW_ID)
                    ? "bg-slate-900/80 border-slate-800"
                    : "bg-slate-900/60 border-slate-800"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate" style={getUsernameGlowStyle(isDark)}>
                      {profile.display_name || "Yaltiroq Ism Effekti"}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">Profil va reytingda yaltiroq ism dizayni</p>
                  </div>
                </div>

                <div className="shrink-0">
                  {ownedIds.has(USERNAME_GLOW_ID) ? (
                    <span className="h-9 px-3.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 whitespace-nowrap">
                      <Check className="w-3.5 h-3.5" /> Faol
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={buying === USERNAME_GLOW_ID}
                      onClick={() => triggerBuyWithConfirmation({ id: USERNAME_GLOW_ID, name: "Yaltiroq Ism", price: USERNAME_GLOW_PRICE }, buyGlowName)}
                      className="h-9 px-3.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer whitespace-nowrap"
                    >
                      {buying === USERNAME_GLOW_ID ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Coins className="w-3.5 h-3.5 fill-slate-950" />
                          <span>{USERNAME_GLOW_PRICE} · Sotib olish</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {TITLES.map((tItem) => {
                const isOwned = ownedIds.has(tItem.id);
                const isEquipped = activeTitle === tItem.id;
                const isBuying = buying === tItem.id;
                const isEquipping = equipping === tItem.id;

                return (
                  <div
                    key={tItem.id}
                    className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3 transition-all"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                        <Award className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{tItem.name}</p>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">Eksklyuziv unvon va maqom</p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isOwned ? (
                        <button
                          type="button"
                          disabled={isEquipping}
                          onClick={() => handleEquipTitle(tItem.id)}
                          className={`h-9 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                            isEquipped
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                          }`}
                        >
                          {isEquipping ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : isEquipped ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Taqilgan</span>
                            </>
                          ) : (
                            <span>Taqish</span>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isBuying}
                          onClick={() => triggerBuyWithConfirmation(tItem, () => buyCosmetic(tItem.id, tItem.price, false, true))}
                          className="h-9 px-3.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer whitespace-nowrap"
                        >
                          {isBuying ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <Coins className="w-3.5 h-3.5 fill-slate-950" />
                              <span>{tItem.price} · Sotib olish</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bilim & Resurslar Section */}
        {filteredResources.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Bilim & Raqamli Resurslar</h3>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {filteredResources.map((item) => {
                const Icon = item.icon;
                const isBuying = buying === item.id;
                const isOwned = ownedIds.has(item.id);

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl flex items-center justify-between gap-4 transition-all"
                    style={{ background: item.colorBg, border: `1px solid ${item.colorBorder}` }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" style={{ color: item.color }} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{item.name}</h4>
                        <p className="text-xs text-slate-300 leading-relaxed mt-0.5">{item.desc}</p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isOwned ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (item.actionUrl) window.open(item.actionUrl, '_blank');
                            else toast.success("Raqamli mahsulot xarid qilingan!");
                          }}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4" /> Ochish
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isBuying}
                          onClick={() => triggerBuyWithConfirmation(item, () => buyItemStandard(item))}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 transition-all shadow-md"
                        >
                          {isBuying ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Coins className="w-3.5 h-3.5" /> {item.price}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Real Monetization Top-Up Modal */}
      <AnimatePresence>
        {showTopUpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setShowTopUpModal(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400">
                  <Coins size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white">Tanga Paketlari</h3>
                  <p className="text-xs text-slate-400">Hisobingizni to'ldiring va eksklyuziv imkoniyatlarga ega bo'ling</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                {TOP_UP_PACKAGES.map((pack) => {
                  const isSelected = selectedPack?.id === pack.id;
                  const totalCoins = pack.coins + pack.bonus;

                  return (
                    <div
                      key={pack.id}
                      onClick={() => setSelectedPack(pack)}
                      className={`p-5 rounded-2xl border text-left transition-all relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer ${
                        isSelected
                          ? "bg-amber-500/15 border-amber-500 shadow-xl shadow-amber-500/10 ring-1 ring-amber-500/50"
                          : "bg-slate-800/80 border-slate-700/80 hover:border-slate-600 hover:bg-slate-800"
                      }`}
                    >
                      {pack.popular && (
                        <span className="absolute -top-2.5 right-4 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500 to-emerald-400 text-slate-950 shadow-md flex items-center gap-1">
                          <Flame size={12} className="fill-slate-950 text-slate-950 shrink-0" />
                          <span>Ommabop</span>
                        </span>
                      )}

                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-400 shadow-inner">
                          <Coins size={24} className="fill-amber-400/20" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-base font-bold text-white">{pack.name}</p>
                            {pack.bonus > 0 && (
                              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                                +{pack.bonus} BONUS
                              </span>
                            )}
                          </div>
                          <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-lg font-black text-amber-400 font-mono tracking-tight">{totalCoins.toLocaleString()}</span>
                            <span className="text-xs font-semibold text-slate-400">tanga</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:flex-col sm:items-end gap-3 shrink-0 border-t sm:border-t-0 border-slate-700/50 pt-3 sm:pt-0">
                        <span className="text-base font-semibold text-white/90 font-mono">
                          {pack.priceSom}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPack(pack);
                          }}
                          className={`h-10 px-5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                            isSelected
                              ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                              : "bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
                          }`}
                        >
                          <ShoppingBag size={14} />
                          <span>Sotib olish</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedPack ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-400">To'lov tizimini tanlang:</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={topUpProcessing}
                      onClick={() => executeTopUp(selectedPack, 'click')}
                      className="h-11 px-4 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                      style={{ background: "#00A1F1" }}
                    >
                      {topUpProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <>
                          <CreditCard size={16} className="text-white" />
                          <span>Click</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={topUpProcessing}
                      onClick={() => executeTopUp(selectedPack, 'payme')}
                      className="h-11 px-4 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                      style={{ background: "#17C1C4" }}
                    >
                      {topUpProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <>
                          <CreditCard size={16} className="text-white" />
                          <span>Payme</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-center text-slate-400 py-1">To'lov qilish uchun yuqoridagi paketlardan birini tanlang</p>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog Modal */}
      <AnimatePresence>
        {confirmItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>

              <h3 className="text-base font-bold text-white mb-2">Xaridni tasdiqlash</h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                Ushbu buyumni <span className="font-bold text-amber-400 font-mono">{confirmItem.item.price} tangaga</span> xarid qilishni tasdiqlaysizmi?
              </p>

              <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700 mb-6 flex items-center gap-3 text-left">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{confirmItem.item.name}</p>
                  <p className="text-[10px] text-amber-400 font-mono font-bold">{confirmItem.item.price} tanga</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmItem(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all"
                >
                  Bekor qilish
                </button>
                <button
                  type="button"
                  onClick={processConfirmedPurchase}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg transition-all"
                >
                  Tasdiqlash
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Store;
