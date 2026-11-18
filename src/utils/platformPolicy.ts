// Do'kon siyosati platformaga qarab.
//
// Google Play to'lov qoidasi: ilova ichida raqamli narsa (tanga) faqat
// Google Play Billing orqali sotilishi mumkin, tashqi to'lovga (Click/Payme)
// yo'naltirish ham, "veb-saytda sotib oling" havolasi ham taqiqlangan.
// Shuning uchun Android/iOS ilovada tanga SOTIB OLISH yo'q — tangalar odat
// bajarib ishlanadi. Veb-versiyada (Vercel) Click/Payme orqali sotib olish qoladi.
// Play Billing qo'shilganda shu yerda yoqiladi.

export type Platform = "web" | "android" | "ios";

export function canBuyCoins(platform: Platform): boolean {
  return platform === "web";
}
