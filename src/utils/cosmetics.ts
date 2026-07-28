// Coin do'kon kosmetika ta'riflari — CoinShopModal, EditProfilePage va
// AvatarFrame shu yerdan bir xil ro'yxatni o'qiydi, shunda narx/uslub
// bir joyda o'zgartirilsa hamma joyda mos keladi.

export const FREE_AVATAR_COLORS = [
  "linear-gradient(135deg, #4ADE80 0%, #22C55E 100%)",
  "linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)",
  "linear-gradient(135deg, #F87171 0%, #EF4444 100%)",
  "linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)",
  "linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)",
  "linear-gradient(135deg, #34D399 0%, #059669 100%)",
];

export type ShopColorItem = { id: string; name: string; price: number; gradient: string };
export const PREMIUM_AVATAR_COLORS: ShopColorItem[] = [
  { id: "avatar_color_sunset", name: "Shafaq", price: 20, gradient: "linear-gradient(135deg, #FB923C 0%, #EC4899 50%, #A855F7 100%)" },
  { id: "avatar_color_galaxy", name: "Galaktika", price: 20, gradient: "linear-gradient(135deg, #4C1D95 0%, #7C3AED 50%, #06B6D4 100%)" },
  { id: "avatar_color_ocean", name: "Okean", price: 20, gradient: "linear-gradient(135deg, #0891B2 0%, #0369A1 50%, #1E3A8A 100%)" },
];

export type ShopFrameItem = { id: string; name: string; price: number; emoji: string; border: string; shadow: string };
export const FRAMES: ShopFrameItem[] = [
  { id: "frame_bronze", name: "Bronza ramka", price: 8, emoji: "🥉", border: "3px solid #CD7F32", shadow: "0 0 10px rgba(205,127,50,0.5)" },
  { id: "frame_silver", name: "Kumush ramka", price: 20, emoji: "🥈", border: "3px solid #C0C0C0", shadow: "0 0 12px rgba(192,192,192,0.6)" },
  { id: "frame_gold", name: "Oltin ramka", price: 50, emoji: "👑", border: "3px solid #FBBF24", shadow: "0 0 16px rgba(251,191,36,0.7)" },
];

// Ramkalar 30 kunlik xarid — coin_purchases.purchased_at + shu muddat orqali
// hisoblanadi, alohida "expires_at" ustuni shart emas (028-migratsiya).
export const FRAME_DURATION_DAYS = 30;

export function getFrameStyle(frameId: string | null | undefined): { border: string; boxShadow: string } | null {
  const f = FRAMES.find((x) => x.id === frameId);
  return f ? { border: f.border, boxShadow: f.shadow } : null;
}

// "Yaltiroq ism" — doimiy (muddatsiz) kosmetika, profiles.username_glow
// bayrog'i orqali saqlanadi.
export const USERNAME_GLOW_ID = "username_glow";
export const USERNAME_GLOW_PRICE = 40;

export function getUsernameGlowStyle(isDark: boolean): { textShadow: string } {
  return isDark
    ? { textShadow: "0 0 6px #4ADE80, 0 0 14px rgba(74,222,128,0.65), 0 0 22px rgba(74,222,128,0.35)" }
    : { textShadow: "0 0 3px rgba(22,163,74,0.55), 0 0 8px rgba(22,163,74,0.35)" };
}
