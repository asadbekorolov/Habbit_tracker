import React, { useState, useEffect } from "react";
import { PageHeader } from "../components/PageHeader";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Coins, Plus, RotateCcw, Shield, ShieldCheck, Zap, Star,
  BookOpen, CheckSquare, Send, Check, Loader2, Lock, Sparkles,
  ShoppingBag, X, ArrowRight, ExternalLink, Download, CreditCard,
  Crown, Award, AlertCircle, Flame, Info
} from "lucide-react";
import { useUser, useProfile } from "../store/UserContext";
import { useLang } from "../store/LangContext";
import {
  purchaseShopItem, buyStar, isStarActive, getOwnedItemIds,
  equipCosmetic, getMyProfile, getCosmeticExpiries, cleanupExpiredFrame
} from "../services/db";
import { supabase } from "../services/supabase";
import { postApi } from "../services/apiClient";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { FRAMES, PREMIUM_AVATAR_COLORS, USERNAME_GLOW_ID, USERNAME_GLOW_PRICE, getUsernameGlowStyle, cosmeticState, cosmeticDaysLeft } from "../utils/cosmetics";
import { AvatarFrame } from "../components/AvatarFrame";
import type { Profile } from "../services/supabase";
import { useScrollLock } from "../hooks/useScrollLock";
import { canBuyCoins, type Platform } from "../utils/platformPolicy";

interface StoreProps {
  onProfileUpdate?: (p: Profile) => void;
  onClose?: () => void;
  isModal?: boolean;
}

export type CategoryTab = "all" | "buffs" | "frames";

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

// Paket va unvon nomlari lug'atdan (id bo'yicha); topilmasa — asl nom.
const PACK_NAME_KEYS = { pack_small: "store_pack_small", pack_gold: "store_pack_gold", pack_chest: "store_pack_chest" } as const;
const TITLE_NAME_KEYS = { title_master: "store_title_master", title_legend: "store_title_legend" } as const;

export function Store({ onProfileUpdate, onClose, isModal = false }: StoreProps) {
  const { t } = useLang();
  const { setProfile, updateCoins, refreshUserProfile } = useUser();
  const profile = useProfile();

  // Google Play qoidasi: ilovada tanga sotib olinmaydi, faqat ishlanadi (utils/platformPolicy)
  const coinPurchase = canBuyCoins(Capacitor.getPlatform() as Platform);
  const [showEarnInfo, setShowEarnInfo] = useState(false);
  const [activeTab, setActiveTab] = useState<CategoryTab>("all");
  const [currentCoins, setCurrentCoins] = useState<number>(profile?.coins ?? 0);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [activeFrame, setActiveFrame] = useState<string | null>(profile?.active_frame ?? null);
  const [activeTitle, setActiveTitle] = useState<string | null>(profile?.active_title ?? null);
  const [starExpiresAt, setStarExpiresAt] = useState<string | null>(profile?.star_expires_at ?? null);
  const starActive = isStarActive({ has_star: true, star_expires_at: starExpiresAt });

  const [expiries, setExpiries] = useState<Map<string, string>>(new Map());
  const [glowOn, setGlowOn] = useState<boolean>(!!profile?.username_glow);
  const [loading, setLoading] = useState<boolean>(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [equipping, setEquipping] = useState<string | null>(null);

  // Top-Up Modal state
  const [showTopUpModal, setShowTopUpModal] = useState<boolean>(false);
  const [selectedPack, setSelectedPack] = useState<TopUpPackage | null>(null);
  const [topUpProcessing, setTopUpProcessing] = useState<boolean>(false);

  // Confirmation dialog state
  const [confirmItem, setConfirmItem] = useState<{ item: ShopItem | any; action: () => Promise<void> } | null>(null);

  useScrollLock(showTopUpModal || !!confirmItem);

  useEffect(() => {
    if (!profile) return;
    setCurrentCoins(profile.coins ?? 0);
    setActiveFrame(profile.active_frame ?? null);
    setActiveTitle(profile.active_title ?? null);
    setStarExpiresAt(profile.star_expires_at ?? null);

    Promise.all([
      getOwnedItemIds(profile.id),
      getCosmeticExpiries(profile.id),
      cleanupExpiredFrame(profile.id),
    ]).then(([owned, exp, effectiveFrame]) => {
      setOwnedIds(owned);
      setExpiries(exp);
      setActiveFrame(effectiveFrame);
      // Muddati o'tgan yaltirash serverda yechildi — mahalliy holat ham
      const effectiveGlow = !!profile.username_glow && cosmeticState(exp.get(USERNAME_GLOW_ID)) === "active";
      setGlowOn(effectiveGlow);
      if (effectiveFrame !== (profile.active_frame ?? null) || effectiveGlow !== !!profile.username_glow) {
        onProfileUpdate?.({ ...profile, active_frame: effectiveFrame, username_glow: effectiveGlow });
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [profile?.id]);

  if (!profile) return null;

  const errText = (e: any, fallback: string) =>
    e?.message === "already_active" ? t("store_already_active") : e?.message || fallback;

  const glowState = cosmeticState(expiries.get(USERNAME_GLOW_ID));
  const glowDaysLeft = cosmeticDaysLeft(expiries.get(USERNAME_GLOW_ID));

  /** Xariddan keyin yangi tugash sanasi (server 20 kun yozadi) */
  async function refreshExpiries() {
    try { setExpiries(await getCosmeticExpiries(profile!.id)); } catch { /* jim */ }
  }

  // Handle Top-Up checkout redirection (Opens Click / Payme payment URL safely)
  async function executeTopUp(pack: TopUpPackage, provider: 'click' | 'payme') {
    setTopUpProcessing(true);
    toast.info(t('store_redirecting_payment'), { duration: 3000 });

    try {
      // Buyurtma va narx serverda yaratiladi (api/payments/create-invoice);
      // mijoz faqat paket va to'lov tizimini yuboradi.
      const resp = await postApi('/api/payments/create-invoice', { pack_id: pack.id, provider });
      const data = await resp.json().catch(() => ({} as any));

      if (resp.status === 503 || data?.error === 'payments_not_configured') {
        toast.info(t('store_payments_soon'), { description: t('store_payments_soon_sub') });
        return;
      }
      if (!resp.ok || !data?.url) {
        toast.error(t('store_payment_redirect_error'));
        return;
      }

      if (Capacitor.isNativePlatform()) await Browser.open({ url: data.url });
      else window.open(data.url, '_blank', 'noopener,noreferrer');

      // To'lovdan qaytilganda balansni serverdan yangilaymiz (tanga callback orqali tushadi).
      const onBack = () => {
        if (document.visibilityState !== 'visible') return;
        document.removeEventListener('visibilitychange', onBack);
        refreshUserProfile().catch(() => {});
      };
      document.addEventListener('visibilitychange', onBack);

      setSelectedPack(null);
      setShowTopUpModal(false);
    } catch (e: any) {
      toast.error(e?.message || t('store_payment_redirect_error'));
    } finally {
      setTopUpProcessing(false);
    }
  }

  // Handle Equip / Unequip Frame
  async function handleEquipFrame(frameId: string) {
    const next = activeFrame === frameId ? null : frameId;
    setEquipping(frameId);
    try {
      const updated = await equipCosmetic('frame', next);
      setActiveFrame(next);
      setProfile(updated);
      onProfileUpdate?.(updated);
      toast.success(next ? t('store_frame_equipped') : t('store_frame_removed_kept'));
    } catch (e: any) {
      toast.error(e?.message || t('ep_error'));
    } finally {
      setEquipping(null);
    }
  }

  // "Yaltiroq ism"ni yoqish / o'chirish (muddat kuymaydi)
  async function handleToggleGlow() {
    const next = !glowOn;
    setEquipping(USERNAME_GLOW_ID);
    try {
      const updated = await equipCosmetic('glow', next ? USERNAME_GLOW_ID : null);
      setGlowOn(next);
      setProfile(updated);
      onProfileUpdate?.(updated);
      toast.success(next ? t('store_glow_enabled') : t('store_glow_disabled'));
    } catch (e: any) {
      toast.error(e?.message || t('ep_error'));
    } finally {
      setEquipping(null);
    }
  }

  // Handle Equip / Unequip Title
  async function handleEquipTitle(titleId: string) {
    const next = activeTitle === titleId ? null : titleId;
    setEquipping(titleId);
    try {
      const updated = await equipCosmetic('title', next);
      setActiveTitle(next);
      setProfile(updated);
      onProfileUpdate?.(updated);
      toast.success(next ? t('store_title_equipped') : t('store_title_removed'));
    } catch (e: any) {
      toast.error(e?.message || t('ep_error'));
    } finally {
      setEquipping(null);
    }
  }

  // Handle Generic Buy Action with Confirmation Dialog
  function triggerBuyWithConfirmation(item: ShopItem | any, buyFn: () => Promise<void>) {
    if (currentCoins < item.price) {
      toast.error(coinPurchase ? t('store_not_enough_coins') : t('store_not_enough_coins_earn'));
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
      const newBalance = await purchaseShopItem(item.id);
      setCurrentCoins(newBalance);
      updateCoins(newBalance);
      setOwnedIds((prev) => new Set(prev).add(item.id));

      if (item.actionUrl) {
        window.open(item.actionUrl, '_blank');
      }

      toast.success(t('store_item_bought').replace('{name}', item.name));
    } catch (e: any) {
      toast.error(e?.message || t('store_purchase_error'));
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

      toast.success(t('store_vip_activated'));
    } catch (e: any) {
      toast.error(e?.message || t('ep_error'));
    } finally {
      setBuying(null);
    }
  }

  async function buyGlowName() {
    setBuying(USERNAME_GLOW_ID);
    try {
      const newBalance = await purchaseShopItem(USERNAME_GLOW_ID);
      setCurrentCoins(newBalance);
      updateCoins(newBalance);
      setOwnedIds((prev) => new Set(prev).add(USERNAME_GLOW_ID));

      // Server xarid paytida username_glow ni o'zi yoqadi.
      const updated = (await getMyProfile()) || { ...profile, coins: newBalance, username_glow: true };
      setGlowOn(true);
      setProfile(updated);
      onProfileUpdate?.(updated);
      await refreshExpiries();

      toast.success(t('store_glow_activated'));
    } catch (e: any) {
      toast.error(errText(e, t('ep_error')));
    } finally {
      setBuying(null);
    }
  }

  async function buyCosmetic(itemId: string, price: number, isFrame = false, isTitle = false) {
    setBuying(itemId);
    try {
      const newBalance = await purchaseShopItem(itemId);
      setCurrentCoins(newBalance);
      updateCoins(newBalance);
      setOwnedIds((prev) => new Set(prev).add(itemId));

      if (isFrame) {
        // Server xarid paytida ramkani o'zi taqadi.
        const updated = (await getMyProfile()) || { ...profile, coins: newBalance, active_frame: itemId };
        setActiveFrame(itemId);
        setProfile(updated);
        onProfileUpdate?.(updated);
        await refreshExpiries();
        toast.success(t('store_frame_bought'));
      } else if (isTitle) {
        const updated = (await getMyProfile()) || { ...profile, coins: newBalance, active_title: itemId };
        setActiveTitle(itemId);
        setProfile(updated);
        onProfileUpdate?.(updated);
        toast.success(t('store_title_bought'));
      } else {
        toast.success(t('store_bought'));
      }
    } catch (e: any) {
      toast.error(errText(e, t('ep_error')));
    } finally {
      setBuying(null);
    }
  }

  // ITEMS CATALOG
  const BUFF_ITEMS: ShopItem[] = [
    {
      id: "streak_repair",
      category: "buffs",
      name: t('store_item_restore_name'),
      desc: t('store_item_restore_desc'),
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
      name: t('store_item_shield1_name'),
      desc: t('store_item_shield1_desc'),
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
      name: t('store_item_shield3_name'),
      desc: t('store_item_shield3_desc'),
      price: 25,
      icon: ShieldCheck,
      color: "#F59E0B",
      colorBg: "rgba(245,158,11,0.1)",
      colorBorder: "rgba(245,158,11,0.25)",
      type: "buff",
    },
  ];


  const filteredBuffs = activeTab === "all" || activeTab === "buffs" ? BUFF_ITEMS : [];
  const showFramesSection = activeTab === "all" || activeTab === "frames";

  return (
    <div className={`w-full ${isModal ? "" : "max-w-2xl mx-auto pb-32"}`}>
      {!isModal && <PageHeader title={t('sec_store')} subtitle={t('store_page_sub')} />}
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
                <span className="text-xs font-bold text-amber-400">{t('store_coin_unit')}</span>
              </div>
            </div>
          </div>

          {/* High contrast "Tanga olish" button — faqat vebda; ilovada "qanday ishlanadi" */}
          {coinPurchase ? (
          <button
            type="button"
            onClick={() => setShowTopUpModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={16} strokeWidth={3} />
            <span>{t('store_get_coins')}</span>
          </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowEarnInfo((v) => !v)}
              aria-expanded={showEarnInfo}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
            >
              <Info size={15} className="text-emerald-400" />
              <span>{t('store_earn_title')}</span>
            </button>
          )}
        </div>
        {!coinPurchase && showEarnInfo && (
          <div className="mt-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-1.5">
            <p className="text-xs font-bold text-emerald-300">{t('store_earn_title')}</p>
            <ul className="space-y-1 text-[12px] text-slate-300">
              <li className="flex gap-2"><CheckSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" />{t('store_earn_habits')}</li>
              <li className="flex gap-2"><Zap className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />{t('store_earn_quests')}</li>
              <li className="flex gap-2"><Award className="w-3.5 h-3.5 mt-0.5 shrink-0 text-violet-400" />{t('store_earn_badges')}</li>
            </ul>
          </div>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 mb-6 overflow-x-auto no-scrollbar gap-1">
        {[
          { id: "all", label: t('store_tab_all') },
          { id: "buffs", label: t('store_tab_buffs') },
          { id: "frames", label: t('store_tab_frames') },
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
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{t('store_active_buffs')}</h3>
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
                          <span>{t('shop_buy')}</span>
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
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{t('store_frames_titles')}</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4 mb-6">
              {FRAMES.map((frame) => {
                const state = cosmeticState(expiries.get(frame.id));
                const daysLeft = cosmeticDaysLeft(expiries.get(frame.id));
                const isOwned = state === "active";
                const isEquipped = isOwned && activeFrame === frame.id;
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
                          <Crown size={20} className="text-amber-400" />
                        </div>
                      </AvatarFrame>
                      <p className="text-xs font-bold text-white tracking-tight mt-3 text-center line-clamp-1">
                        {frame.name}
                      </p>
                      {isEquipped && (
                        <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
                          <Check className="w-3 h-3" /> {t('store_equipped')}
                        </span>
                      )}
                      {isOwned ? (
                        <p className="text-[11px] font-mono font-bold text-emerald-400 mt-0.5">{t('store_days_left').replace('{n}', String(daysLeft))}</p>
                      ) : state === "expired" ? (
                        <p className="text-[11px] text-rose-300 mt-0.5">{t('store_expired')}</p>
                      ) : (
                        <p className="text-[11px] text-slate-400 mt-0.5">{t('store_20_days')}</p>
                      )}
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
                              ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                              : "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                          }`}
                        >
                          {isEquipping ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : isEquipped ? (
                            <>
                              <X className="w-3.5 h-3.5" />
                              <span>{t('store_unequip')}</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>{t('store_equip')}</span>
                            </>
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
                              {state === "expired" ? <RotateCcw className="w-3.5 h-3.5" /> : <Coins className="w-3.5 h-3.5 fill-slate-950" />}
                              <span className="font-mono">{frame.price}</span>
                              <span>· {state === "expired" ? t('store_rebuy') : t('shop_buy')}</span>
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
                  glowState === "active" && glowOn
                    ? "bg-emerald-500/10 border-emerald-500/40"
                    : "bg-slate-900/60 border-slate-800"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate" style={getUsernameGlowStyle()}>
                      {profile.display_name || "Yaltiroq Ism Effekti"}
                    </p>
                    {glowState === "active" ? (
                      <p className="text-[11px] font-mono font-bold text-emerald-400 truncate mt-0.5">{t('store_days_left').replace('{n}', String(glowDaysLeft))}</p>
                    ) : glowState === "expired" ? (
                      <p className="text-[11px] text-rose-300 truncate mt-0.5">{t('store_expired')}</p>
                    ) : (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{t('store_glow_desc')} · {t('store_20_days')}</p>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  {glowState === "active" ? (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={glowOn}
                      aria-label={t('store_glow_name')}
                      disabled={equipping === USERNAME_GLOW_ID}
                      onClick={handleToggleGlow}
                      className="flex items-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      <span className={`text-[11px] font-bold ${glowOn ? "text-emerald-400" : "text-slate-400"}`}>
                        {glowOn ? t('store_glow_on') : t('store_glow_off')}
                      </span>
                      <span className={`w-12 h-6 rounded-full relative transition-colors ${glowOn ? "bg-emerald-500" : "bg-slate-700"}`}>
                        {equipping === USERNAME_GLOW_ID ? (
                          <Loader2 className="absolute top-1 left-4 w-4 h-4 animate-spin text-white" />
                        ) : (
                          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${glowOn ? "left-7" : "left-1"}`} />
                        )}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={buying === USERNAME_GLOW_ID}
                      onClick={() => triggerBuyWithConfirmation({ id: USERNAME_GLOW_ID, name: t('store_glow_name'), price: USERNAME_GLOW_PRICE }, buyGlowName)}
                      className="h-9 px-3.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer whitespace-nowrap"
                    >
                      {buying === USERNAME_GLOW_ID ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          {glowState === "expired" ? <RotateCcw className="w-3.5 h-3.5" /> : <Coins className="w-3.5 h-3.5 fill-slate-950" />}
                          <span className="font-mono">{USERNAME_GLOW_PRICE}</span>
                          <span>· {glowState === "expired" ? t('store_rebuy') : t('shop_buy')}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Unvonlar sotilmaydi (mehnat, zanjir va daraja bilan). Ilgari olinganlarini taqish/yechish qoladi. */}
              {TITLES.filter((tItem) => ownedIds.has(tItem.id)).map((tItem) => {
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
                        <p className="text-xs font-bold text-white truncate">{tItem.id in TITLE_NAME_KEYS ? t(TITLE_NAME_KEYS[tItem.id as keyof typeof TITLE_NAME_KEYS]) : tItem.name}</p>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{t('store_title_desc')}</p>
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
                              <span>{t('store_equipped')}</span>
                            </>
                          ) : (
                            <span>{t('store_equip')}</span>
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
                              <span>{tItem.price} · {t('shop_buy')}</span>
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
        {coinPurchase && showTopUpModal && (
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setShowTopUpModal(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overscroll-contain touch-none"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden max-h-[85vh] overflow-y-auto overscroll-contain touch-pan-y"
            >
              <button
                type="button"
                data-modal-close-trigger
                aria-label={t('close')}
                onClick={() => setShowTopUpModal(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400">
                  <Coins size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white">{t('store_coin_packs')}</h3>
                  <p className="text-xs text-slate-400">{t('store_coin_packs_sub')}</p>
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
                          <span>{t('store_popular')}</span>
                        </span>
                      )}

                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-400 shadow-inner">
                          <Coins size={24} className="fill-amber-400/20" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-base font-bold text-white">{pack.id in PACK_NAME_KEYS ? t(PACK_NAME_KEYS[pack.id as keyof typeof PACK_NAME_KEYS]) : pack.name}</p>
                            {pack.bonus > 0 && (
                              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                                +{pack.bonus} {t('store_bonus')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-lg font-black text-amber-400 font-mono tracking-tight">{totalCoins.toLocaleString()}</span>
                            <span className="text-xs font-semibold text-slate-400">{t('store_coin_unit')}</span>
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
                          <span>{t('shop_buy')}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedPack ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-400">{t('store_choose_payment')}</p>
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
                <p className="text-xs text-center text-slate-400 py-1">{t('store_choose_pack_hint')}</p>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog Modal */}
      <AnimatePresence>
        {confirmItem && (
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setConfirmItem(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overscroll-contain touch-none"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl text-center max-h-[85vh] overflow-y-auto overscroll-contain touch-pan-y"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>

              <h3 className="text-base font-bold text-white mb-2">{t('store_confirm_title')}</h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                {t('store_confirm_before')} <span className="font-bold text-amber-400 font-mono">{confirmItem.item.price} {t('store_confirm_price_unit')}</span> {t('store_confirm_after')}
              </p>

              <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700 mb-6 flex items-center gap-3 text-left">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{confirmItem.item.name}</p>
                  <p className="text-[10px] text-amber-400 font-mono font-bold">{confirmItem.item.price} {t('store_coin_unit')}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmItem(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={processConfirmedPurchase}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg transition-all"
                >
                  {t('store_confirm_btn')}
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
