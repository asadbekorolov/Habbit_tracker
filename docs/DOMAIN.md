# `.uz` domenni ulash — tartib

Kod tayyor: sayt manzili faqat bitta joyda — `src/config/site.ts` (`SITE_URL`).
`privacy.html` va `delete-account.html` nisbiy havolalar ishlatadi, shuning
uchun ular istalgan domenda o'zgarishsiz ishlaydi.

Quyida `idrok.uz` misol sifatida yozilgan — o'zingiz olgan domen bilan almashtiring.

## 1. Domenni sotib olish

- `.uz` domenlar cctld.uz ro'yxatidagi akkreditatsiyalangan registratorlar orqali olinadi.
- Ham `idrok.uz`, ham `www.idrok.uz` ishlashi uchun DNS'ni registrator panelida boshqarish imkoni bo'lsin.

## 2. Vercel

1. Vercel → loyiha → **Settings → Domains → Add**: `idrok.uz` va `www.idrok.uz`.
2. Vercel ko'rsatgan DNS yozuvlarini (apex uchun `A`, `www` uchun `CNAME`) registrator panelida kiriting. SSL sertifikati avtomatik chiqadi.
3. `www.idrok.uz` → `idrok.uz` ga yo'naltirish (redirect) qo'yish mumkin.
4. **`habit-tracker-asadbek.vercel.app` ni yangi domenga YO'NALTIRMANG.**
   - O'rnatilgan ilovalar (1.0.2 va undan oldingilar) `/api/*` ni shu manzilga yuboradi. Yo'naltirish CORS preflight so'rovini buzadi, natijada AI tahlil va to'lovlar ishlamay qoladi.
   - Avval tarqatilgan `?ref=` / `?pack=` havolalar ham shu manzilda ochilishda davom etishi kerak.
   - Ikkala manzil bir xil saytni ko'rsatsin.
5. **Settings → Environment Variables**: `APP_PUBLIC_URL = https://idrok.uz` (Click/Payme'dan keyin qaytish sahifasi). So'ng **Redeploy**.

## 3. Supabase Auth

Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://idrok.uz`
- **Redirect URLs** — eskilarini O'CHIRMASDAN quyidagilarni qo'shing:
  - `https://idrok.uz/auth/callback`
  - `https://idrok.uz/reset-password`
  - `https://www.idrok.uz/auth/callback` (agar `www` redirect qilinmasa)
  - mavjudlari qoladi: `https://habit-tracker-asadbek.vercel.app/**`, `com.idrok.app://reset-password`

Email shablonlarida `{{ .SiteURL }}` ishlatilgan bo'lsa, ular yangi domenni o'zi oladi.

Google orqali kirish Supabase'ning `...supabase.co/auth/v1/callback` manzili orqali o'tadi. Google Cloud'dagi OAuth sozlamasini o'zgartirish odatda shart emas — kirishni yangi domenda bir marta sinab ko'ring.

## 4. Kod (bitta qator) va yangi build

1. `src/config/site.ts`: `export const SITE_URL = "https://idrok.uz";`
   - `API_SITE_URL` ni hozircha `LEGACY_SITE_URL` da qoldiring (2-bo'lim, 4-band).
2. `npm run typecheck`, `npm test` (testlar `SITE_URL` dan o'qiydi — o'zgartirish shart emas), `npm run build && npx cap sync android`.
3. `android/app/build.gradle`: `versionCode` ni oshiring (Play'ga yuklangan oxirgisidan katta bo'lsin).
4. `bundleRelease` → Play Console.

Shundan keyin taklif va to'plam havolalari hamda poster pastidagi manzil yangi domenni ko'rsatadi.

## 5. Tekshiruv

- [ ] `https://idrok.uz` ochiladi, kirish (email va Google) ishlaydi.
- [ ] `https://idrok.uz/privacy.html` va `/delete-account.html` ochiladi; "Sozlamalarni ochish" tugmasi `/settings` ga o'tadi.
- [ ] `https://idrok.uz/?ref=KOD` va `/?pack=KOD` ilovada qabul qilinadi.
- [ ] Parolni tiklash xatidagi havola yangi domenga olib boradi.
- [ ] Eski `https://habit-tracker-asadbek.vercel.app` ham ochiladi (redirectsiz).

## 6. Keyinroq (shoshilinch emas)

- Play Console → Privacy policy va Account deletion URL'larini yangi domenga almashtirish (eskisi ham ishlaydi).
- Click/Payme kabinetlariga callback manzillarini yangi domen bilan yozish: `https://idrok.uz/api/payments/click-callback`, `https://idrok.uz/api/payments/payme-callback`.
- Domen bir necha hafta barqaror ishlagach, `API_SITE_URL` ni `SITE_URL` ga o'tkazish mumkin. Eski ilovalar baribir vercel.app'ga murojaat qiladi va u ishlashda davom etadi.
