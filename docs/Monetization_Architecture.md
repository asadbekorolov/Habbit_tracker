# Monetizatsiya arxitekturasi — Click / Payme integratsiyasi

Bu hujjat coin do'koni va ⭐ Star obunasini haqiqiy pulga (Click va Payme
orqali) bog'lashning texnik rejasi. Hech qanday kod hali yozilmagan — bu
faqat implementatsiyadan oldingi loyihalash. Haqiqiy API kalitlari va
merchant ID'lar bo'lmagani uchun kod ishga tushmaydi; ular tayyor bo'lgach
shu rejaga asosan amalga oshiriladi.

## 1. Nima sotiladi

Ikkita variant bor, ikkalasini ham qo'shish mumkin:

1. **Tanga (coin) paketlari** — masalan 100/500/1000 tanga = ma'lum summa
   (so'm). Foydalanuvchi tangani keyin mavjud do'konda (ramka, avatar
   rangi, Star) sarflaydi — hozirgi `spend_coins`/`purchaseCoinItem`
   logikasi o'zgarishsiz qoladi, faqat tanga QANDAY olinishi o'zgaradi.
2. **To'g'ridan-to'g'ri Star obunasi** — coin bosqichini chetlab o'tib,
   to'g'ridan-to'g'ri so'm evaziga 30 kunlik Star sotib olish.

**Tavsiya:** avval faqat (1) — tanga paketlari — chunki bitta oddiy oqim
orqali butun do'konni (hozirgi va kelajakdagi barcha item'larni) avtomatik
qamrab oladi, alohida "Star uchun to'g'ridan-to'g'ri to'lov" oqimi shart
emas.

## 2. Click va Payme umumiy oqim naqshi

Ikkala provayder ham O'zbekistonda bir xil ikki bosqichli naqshga amal
qiladi (RPC uslubidagi webhook, JSON-RPC emas, lekin konseptual bir xil):

```
Foydalanuvchi          Bizning backend           Click/Payme
    |                        |                        |
    |-- "100 tanga sotib   ->|                        |
    |   olish" bosadi        |                        |
    |                        |-- to'lov havolasi     ->|
    |                        |   yaratadi (checkout)   |
    |<-- Click/Payme sahifasiga yo'naltiriladi ---------|
    |-- karta ma'lumotini to'ldiradi -------------------->|
    |                        |<-- 1) Prepare webhook --|
    |                        |    (buyurtma mavjudmi   |
    |                        |     tekshiradi)          |
    |                        |-- OK/xato javob ------->|
    |                        |<-- 2) Complete webhook -|
    |                        |    (to'lov tasdiqlandi) |
    |                        |-- tangani hisobga      ->|
    |                        |   qo'shadi, OK qaytaradi|
    |<-- "Muvaffaqiyatli" sahifasiga qaytariladi --------|
```

Muhim: **tanga hisobga faqat "Complete" webhook kelganda qo'shiladi**,
frontendning o'zi hech qachon to'g'ridan-to'g'ri `increment_coins`
chaqirmaydi — aks holda foydalanuvchi to'lovsiz ham konsoldan tanga
"ishlab chiqarishi" mumkin bo'lardi (xuddi shu sabab bilan mavjud
`increment_score`/`increment_coins` RPC'lari `auth.uid()` tekshiruvi bilan
himoyalangan, 006-migratsiyada).

## 3. Yangi DB jadvali: `payment_transactions`

```sql
CREATE TABLE payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('click', 'payme')),
  provider_transaction_id text NOT NULL,
  amount_tiyin bigint NOT NULL,       -- so'mning eng kichik birligi
  coin_package_id text NOT NULL,      -- masalan 'coins_100', 'coins_500'
  coins_awarded integer NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'cancelled', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(provider, provider_transaction_id)
);
```

`UNIQUE(provider, provider_transaction_id)` — bir xil to'lovni ikki marta
qayta ishlashning (double-crediting) oldini oladi; Click/Payme webhook'lari
tarmoq xatosi tufayli qayta yuborilishi mumkin, shuning uchun bu
idempotentlikni kafolatlaydi.

## 4. Yangi backend endpoint'lar (Vercel API, mavjud `api/` papkasidagi
naqshga mos)

Loyihada allaqachon `api/telegram.ts`, `api/notify-group.ts` kabi Vercel
serverless funksiyalar bor (`process.env`dan maxfiy kalit o'qish naqshi) —
xuddi shu naqsh davom ettiriladi:

- **`api/click-prepare.ts`** va **`api/click-complete.ts`** — Click ikkita
  alohida so'rov yuboradi (Prepare, keyin Complete), har biri o'zining
  status kodi va imzo tekshiruvini talab qiladi.
- **`api/payme-webhook.ts`** — Payme bitta endpoint'ga JSON-RPC uslubida
  turli `method` maydoni bilan yuboradi (`CheckPerformTransaction`,
  `CreateTransaction`, `PerformTransaction`, `CancelTransaction`).

Har birida:
1. Kelgan so'rovning imzosi/hash'i `process.env.CLICK_SECRET_KEY` yoki
   `process.env.PAYME_SECRET_KEY` bilan tekshiriladi (Click — MD5 hash,
   Payme — Basic Auth header). Noto'g'ri imzo — darhol rad etiladi.
2. `payment_transactions`da mos yozuv `status='pending'` bilan
   qidiriladi/yaratiladi.
3. Complete bosqichida: `status='completed'`ga o'zgartiriladi VA bir xil
   so'rovda (yagona transaction ichida, race condition oldini olish
   uchun) `increment_coins` RPC chaqiriladi.

## 5. Frontend o'zgarishi

`CoinShopModal.tsx`ga (yoki alohida "Tanga sotib olish" bo'limiga) yangi
bo'lim: 3 ta tanga paketi tugmasi → bosilganda backend orqali Click/Payme
checkout havolasini so'raydi → `window.location.href`ga yo'naltiradi.
Xarid tugagach foydalanuvchi ilovaga qaytadi (`return_url`), lekin
tanga bu paytda **allaqachon** webhook orqali qo'shilgan bo'ladi — qaytish
sahifasi shunchaki `getCoins()`ni qayta so'raydi va yangi balansni
ko'rsatadi (optimistik yangilash yo'q, chunki pul haqiqiy).

## 6. Xavfsizlik nazorat ro'yxati (implementatsiya paytida)

- [ ] Webhook imzosini har doim serverda tekshirish (hech qachon client
      tomonidan yuborilgan "muvaffaqiyatli" degan xabarga ishonmaslik)
- [ ] `UNIQUE(provider, provider_transaction_id)` orqali qayta ishlashni
      oldini olish
- [ ] Tanga qo'shish faqat `status: pending -> completed` o'tishida, va
      faqat SECURITY DEFINER RPC ichida (client'ning to'g'ridan-to'g'ri
      `profiles.coins`ga UPDATE huquqi yo'q — bu cheklash allaqachon
      006-migratsiyada mavjud)
- [ ] Maxfiy kalitlar (`CLICK_SECRET_KEY`, `PAYME_SECRET_KEY`) faqat
      Vercel muhit o'zgaruvchilarida, hech qachon frontend kodida yoki
      git'da emas
- [ ] `amount_tiyin` webhook'dan kelgan qiymat bilan kutilgan paket
      narxiga aniq mos kelishini tekshirish (noto'g'ri summa — rad etish)

## 7. Ochiq savollar (implementatsiyadan oldin hal qilinishi kerak)

1. Click va Payme'dan qaysi biri (yoki ikkalasi) bilan boshlanadi?
2. Merchant hisobi ochilganmi? (Click Merchant Cabinet / Payme Business —
   ikkalasi ham yuridik shaxs yoki YaTT sifatida ro'yxatdan o'tishni talab
   qiladi, odatda 1-3 kun tekshiruv)
3. Tanga paketlari narxi qanday bo'ladi (so'm/tanga nisbati)?

## Amalga oshirish tartibi (kalitlar tayyor bo'lgach)

1. `payment_transactions` migratsiyasi
2. Bitta provayder (tavsiya: Click, hujjatlari soddaroq) uchun
   `api/click-prepare.ts` + `api/click-complete.ts`
3. CoinShopModal'ga "Tanga sotib olish" bo'limi
4. Test rejimida (Click sandbox) to'liq oqimni sinash
5. Ikkinchi provayder (Payme) xuddi shu naqsh bilan qo'shiladi
