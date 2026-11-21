# IDROK — qilingan ishlar va loyiha holati (topshirish hujjati)

> Bu hujjat loyihada ishlaydigan keyingi yordamchi (AI yoki dasturchi) uchun.
> Avval shuni to'liq o'qing — qoidalar, joriy holat va qilinmagan ishlar shu yerda.
> Sana: 2026-11-21. Oxirgi kod commiti: `4d0e0a4` (`main` = `idrok/refactor`).

---

## 1. Loyiha haqida

**IDROK** — odat kuzatuvchi ilova (Android + veb). Foydalanuvchi o'zbek tilida
yozadi; barcha javoblar va hisobotlar **o'zbekcha**.

| | |
| --- | --- |
| Repo | `github.com/asadbekorolov/Habbit_tracker` (ochiq) |
| Mahalliy papka | `C:\Users\asadb\Downloads\Habbit_tracker-main\Habbit_tracker-main` (OneDrive'dagi nusxa ESKI — ishlatmang) |
| Branch'lar | `idrok/refactor` (ish), `main` (Vercel prod). Har ishdan keyin `main` fast-forward qilinadi |
| Frontend | React 18, TypeScript strict, Vite 6, Tailwind 4, framer-motion, lucide-react, React Query, react-router 7 |
| Mobil | Capacitor 8 (Android, Java). Paket `com.idrok.app`. Plaginlar `MainActivity` da `super.onCreate` dan oldin ro'yxatga olinadi |
| Backend | Supabase (Postgres + RLS + SECURITY DEFINER RPC'lar + ustun huquqlari). Loyiha `kiwrqzetpyobaemrsquq`, region `eu-central-1` (Frankfurt), pooler `aws-1-eu-central-1.pooler.supabase.com:5432` |
| Server funksiyalar | Vercel `api/` (AI tahlil — Anthropic SDK, model `claude-opus-5-5`, tuzilgan javob; Click/Payme to'lovlari; Telegram bot) |
| Veb | `https://habit-tracker-asadbek.vercel.app` |
| Admin | faqat `asadbekorolov0@gmail.com` (051: `is_admin` trigger orqali email'ga bog'langan) |

### Qat'iy qoidalar (foydalanuvchi talabi)
- **Dizayn:** faqat dark mode, fon `#090d16`; squircle kartalar `rounded-2xl` / `rounded-3xl`; zumrad aksent `#10b981`; raqam va vaqtlar `font-mono` (Geist Mono).
- **Ikonkalar:** faqat `lucide-react` SVG. **Emoji umuman yo'q** (UI'da ham, bildirishnomalarda ham).
- **Tarjima:** har bir yangi/o'zgargan matn `uz / ru / en` lug'atlarida, `t('kalit')` orqali (`src/i18n/*.ts`).
- **Vaqt:** Toshkent vaqti — `src/utils/date` (`getTashkentToday` va h.k.), serverda `tashkent_today()`.
- **Ma'lumot:** React Query kesh, odat belgilari `habitSyncQueue` orqali (offlayn navbat).
- **Har bir modal:** `useScrollLock(isOpen)` + Android "Orqaga" tugmasi uchun yopish tugmasida `data-modal-close-trigger` (global `useHardwareBackButton` DOM'dagi oxirgi trigger'ni bosadi; shuning uchun ichki modallar `createPortal(…, document.body)` bilan).
- **Ish tartibi:** har qadam — alohida commit (o'zbekcha xabar). Keyin `npm run typecheck`, `npm test`, `npm run build && npx cap sync android`, APK: `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"` bilan `android\gradlew.bat assembleDebug`. Push — faqat foydalanuvchi aytganda.
- **TEGMANG:** `android/app/release-key.keystore` va imzo sozlamalari; `.env` ga yozmang; maxfiy kalit/parolni commit qilmang. `android/app/capacitor.build.gradle` va `android/capacitor.settings.gradle` dagi o'zgarishlar faqat qator oxiri (CRLF) — commit qilinmaydi.

---

## 2. Migratsiyalar va baza (MUHIM — yangi tartib)

Endi bazaga o'zgarish **faqat** `supabase/migrations/NNN_nom.sql` orqali va
**jurnal bilan** kiradi. SQL Editor'da qo'lda ishga tushirish shart emas.
To'liq qo'llanma: `supabase/MIGRATIONS.md`.

- **Jurnal:** `app_meta.schema_migrations` (anon/authenticated uchun yopiq). Prod bazada **002–056 `adopt` qilingan** (55 ta, SQL qayta ishga tushirilmagan). **057** CI orqali qo'llangan. **058** — `main` ga push'dan keyin CI `migrate` job orqali qo'llanadi (`production` environment tasdig'i yoqilgan bo'lsa — GitHub Actions'da "Review deployments" tasdig'idan keyin). Tekshirish: `npm run db:status`.
- **Buyruqlar:** `npm run db:status` · `npm run db:migrate` (`-- --dry-run`) · `npm run db:adopt -- --through NNN` (faqat bir martalik edi, bajarilgan).
- **Ulanish:** `SUPABASE_DB_URL` muhit o'zgaruvchisi (Session pooler). TLS Supabase CA bilan to'liq tekshiriladi: `supabase/certs/prod-ca-2021.crt` (ommaviy sertifikat, commit qilingan).
- **CI** (`.github/workflows/ci.yml`): har push/PR'da `typecheck`, `npm test`, `build`. `main` ga push'da `migrate` job kutilayotgan migratsiyalarni qo'llaydi — GitHub'da `SUPABASE_DB_URL` secret va `DB_AUTO_MIGRATE=true` o'zgaruvchisi **o'rnatilgan**, `production` environment (ixtiyoriy tasdiq) bilan.
- **Yangi migratsiya qoidasi:** keyingi raqam `059_…`; `BEGIN; … COMMIT;`; qayta ishga tushirishga chidamli (`IF NOT EXISTS`, `CREATE OR REPLACE`, qaytish turi o'zgarsa avval `DROP FUNCTION IF EXISTS`); test `tests/db/059-….test.mjs`. Qo'llangan faylni tahrirlamang — yangi raqam qo'shing.
- **Tartib:** avval baza, keyin kod (Vercel `main` ni parallel deploy qiladi).
- Repoda `001` yo'q; 002–046 jonli bazada qo'lda qo'llangan. To'liq sxema: `npm run db:baseline` (`supabase/baseline/`).

### Testlar
- `npm test` = unit (`tests/*.test.ts`) + migratsiya testlari (`tests/db/*.test.mjs`, PGlite — xotiradagi Postgres). Hozir **135/135**.
- `tests/db/harness.mjs` — umumiy vositalar; `tests/db/legacy-schema.sql` — Supabase muhiti yaqinlashuvi + 047 dan oldingi sxema.
- `tests/db/chain.test.mjs` — nomlar qoidasi va 047+ har biri ketma-ket 2 marta qo'llanishi.
- `tests/db/migrator.test.mjs` — ishga tushirgich (adopt, xato, tartib, checksum, huquqlar).
- Pure modullar `.ts` kengaytma bilan import qilinadi (`node --test`).

---

## 3. Bajarilgan ishlar (xronologik)

### 3.1. Oldingi bosqichlar (qisqacha)
UI/UX audit va tuzatishlar (yagona odat kartasi, dock ostida kontent, atamalar,
ikonkalar), odat tafsilotlari oynasi + zanjirni muzlatish RPC (050), `+` tezkor
menyu, "Bilasizmi?" maslahatlar, Profil "Barcha bo'limlar", Lenta olib
tashlandi, admin faqat bitta email (051), hafta kunlari (052) va aqlli zanjir,
odat tahlili ("soat nechada", 053 `completed_at`), Android bosh ekran vidjeti
"IDROK — Bugungi odatlar" (native `IdrokWidgetProvider`), Kundalik hafta
navigatori, Android "Orqaga" — haqiqiy sahifalar tarixi (LIFO, `utils/navStack`),
Sozlamalar qayta qurildi, personaj (vaqtinchalik video `CharacterVideo`),
`PageHeader`, React #310 va AI tahlil tuzatishlari.

### 3.2. "Bajarilmadi" sababi va zanjir — `4c84b64`
Migratsiya 054 (`habit_logs.fail_reason`, `set_habit_fail_reason` RPC, 500 belgi,
done bo'lsa NULL). Bosh sahifada ✓/✕; ✕ — sabab oynasi (`HabitFailReasonModal`) +
muzlatish taklifi; zanjir ko'zga tashlanadi.

### 3.3. AI tahlil — foydalanuvchining "raqamli aksi" — `1ea4446`
`src/utils/aiTwin.ts` (uzilgan zanjirlar, sabablar formati), AI'ga 30 kunlik
sabablar va uzilgan zanjirlar yuboriladi; `api/ai-analysis.ts` prompti "sen"
murojaatida, sabablarni guruhlaydi, foydalanuvchi iborasini keltiradi, sabab
matnini buyruq emas — ma'lumot deb biladi. Natija: kuchli tomonlar / zaif
nuqtalar va sabablar / 3 aniq harakat.

### 3.4. Avtomatik uyqu va ekran vaqti — `003fe5a`
Native `IdrokScreenTimePlugin` (UsageStatsManager, `PACKAGE_USAGE_STATS`,
faqat kunlik jami daqiqa), Health Connect'dan o'tgan tun uyqusi
(`utils/autoMetrics.ts`), `services/autoMetricsService.ts` — `health_logs` ga
yozadi (ochilish/qaytish/fon). Kundalikdagi qo'lda slayderlar o'rniga
`AutoMetricsCard`.

### 3.5. Profil, pastki panel, a'zolar — `09f7247`
Dumaloq avatar; sozlanadigan dock (`utils/dockConfig.ts`, 3 tagacha bo'lim,
Asosiy va Profil doim); guruh/reytingda to'liq ism (`utils/publicName.ts`);
migratsiya 055 `get_public_profile_stats` (faqat yig'ma raqamlar, yopiq profil);
boy `PublicProfileModal`.

### 3.6. Telefon sinovidan keyingi 4 ta UI tuzatish
- `b609c35` — Bosh sahifadan "Kun jarayoni / Bugungi odatlar" ichki kartasi olib tashlandi (native vidjet saqlangan).
- `db82177` — `CustomTimePickerModal` qayta yozildi (Soat 00–23 / Daqiqa 00–59 scroll-snap ustunlari, o'qlar, 07/09/13/21 tezkor, Bekor/Tozalash/O'rnatish, portal). Barcha `<input type="time">` almashtirildi.
- `ec2c020` — AI natija sarlavhasi "AI Tahlil"; `CharacterVideo` `variant: 'full' | 'closeup'` (closeup: `object-top scale-[1.85] origin-top`).
- `6449680` — Tahlil sahifasi sarlavhasi ixcham: avatar yo'q, "Tahlil" + Shaxsiy/Reyting.

### 3.7. Sabab matni, bezaklar, fikr-takliflar
- `63bd548` — sabab placeholder'i neytral ("Bugun rejam o'zgarib…"), uz/ru/en.
- `f71cee1` — **Bezaklar (056, 1-qism):** `coin_purchases.expires_at` (trigger), narxlar Bronza 300 / Kumush 600 / Oltin 1000 / Yaltiroq ism 800, muddat **20 kun**; yechish muddatni kuydirmaydi; `equip_cosmetic('glow', …)`; faol bezakni qayta sotib bo'lmaydi (`already_active`); muddat tugagach "Yana sotib olish"; reyting va `cleanup_expired_frame` `expires_at` bo'yicha. Frontend `utils/cosmetics.ts` (narxlar test orqali 056 bilan solishtiriladi).
- `0b60222` — **Fikr-takliflar (056, 2-qism):** `user_feedback` yagona jadval (`type`: bug/suggestion/question/feedback, `is_read`, `read_at`); RLS — faqat admin o'qiydi/belgilaydi/o'chiradi; `AFTER INSERT` trigger adminga "Yangi fikr va taklif" bildirishnomasi (`link: admin?tab=feedback`); RPC `get_all_feedback` (to'liq ism, email, tur), `set_feedback_read`, `delete_feedback`, `reply_to_feedback` (emoji'siz). Admin panelda "Fikr va takliflar" tabi: o'qilmaganlar badge'i, filtr, belgilash, tasdiqli o'chirish. Fikr oynalarida Xatolik/Taklif/Savol tanlovi.

### 3.8. Migratsiya infratuzilmasi
- `4ebb907` — PGlite testlari repoga ko'chirildi; **041 tuzatildi** (toza bazada "cannot change return type" xatosi — endi avval `DROP FUNCTION`).
- `40fe78c` — `scripts/db-migrate.mjs` + `scripts/lib/migrator.mjs` (jurnal, checksum CRLF'siz, advisory lock, xatoda ROLLBACK, tartib himoyasi, jurnal bo'sh bo'lsa `up` ishlamaydi, `status` 047–056 izlaridan `--through` taklif qiladi); GitHub Actions CI.
- `4100818`, `6b53ef4` — Supabase CA bilan TLS (`scripts/lib/pgSsl.mjs`, `DB_SSL_CA`).
- Prod bazada `adopt --through 056` bajarildi (oldin 056 ning har bir qismi faqat o'qib tekshirildi).

### 3.9. Google Play tayyorgarligi (A variant)
- `f6225c1` — **Android/iOS ilovada tanga SOTIB OLISH yo'q** (Google Play: raqamli narsa faqat Play Billing orqali; Click/Payme'ga yo'naltirish ham, "vebda sotib oling" havolasi ham taqiqlangan). Ilovada "Tanga qanday ishlanadi" kartasi. Veb-versiyada Click/Payme qoladi. Bitta qaror nuqtasi: `src/utils/platformPolicy.ts` (`canBuyCoins(platform)`).
- `9404871` — `public/privacy.html` va `public/delete-account.html` (uz/ru/en, dark). `DeleteAccountModal` avval hech qayerdan ochilmasdi — endi **Sozlamalar → Maxfiylik va hisob → Akkauntni o'chirish**; yonida siyosat havolasi; kirish sahifasi pastida havola (`utils/openPublicPage.ts`).
- `3bfc073` — `docs/PLAY_STORE.md`: Data safety jadvali, Health apps (READ_STEPS / READ_SLEEP) asoslari, usage access izohi, app access, target audience 13+, yopiq test talabi.

### 3.10. Vercel deployi tiklandi — `4e63a43`
2026-09-07 dan beri **barcha** Vercel deploylari `npm install` bosqichida
`ERESOLVE` bilan yiqilgan (`@codetrix-studio/capacitor-google-auth` peer
`@capacitor/core@^6`, loyihada 8). Prod veb va `api/` (AI tahlil) avgust
kodida qolgan, yangi baza bilan mos emas edi ("permission denied for table
profiles", AI "Server bilan bog'lanib bo'lmadi"). Yechim: `.npmrc`
(`legacy-peer-deps=true`). Deploy holatini GitHub Deployments API'dan tekshirish
mumkin (Vercel statusi commit'ga yoziladi).

### 3.11. Narx muvozanati va tozalash
- `efa5b8c` — **057:** narxlar Bronza **150** / Kumush **300** / Yaltiroq ism **400** / Oltin **600** (20 kun); 039 admin statistikasi faol ramkalarni `expires_at > now()` bo'yicha sanaydi; `get_effective_cosmetics(uuid[])` — boshqa foydalanuvchilarning faqat amaldagi ramka/yaltirashi (ommaviy profil oynasi shundan foydalanadi; guruh ro'yxatlarining o'zida bezak ko'rsatilmaydi). `tests/cosmetics.test.ts` frontend narxlarini eng oxirgi migratsiya bilan solishtiradi.
- `0930f42` — `[DEBUG ROUTINES]` loglari olib tashlandi; `src/services/*` dagi xato matnlari `svc_* / ai_err_* / sync_*` kalitlariga o'tdi (`src/utils/serviceT.ts` — React'dan tashqarida `st()`); `habitSyncQueueCore` tarjimani `deps.translate` orqali oladi; eski `get_leaderboard()` / `get_user_rank_efficiency` zaxiralari olib tashlandi.

---

### 3.12. Xavfsizlik yangilanishi — `afffc57`
Capacitor 8.5.0 → **8.5.1** (critical GHSA-rvm3-566m-v7fv: ichki HTTP proxy
orqali ilova manzilida tashqi kontent). `npm audit fix` — production
paketlarida 0 zaiflik. Vite 6.3.5 → 6.4.4 (dev server; qolgan bitta
"moderate" faqat Vite 7 bilan yopiladi). `versionCode 2`, `versionName 1.0.1`.
AI tahlildagi "tanga yechilmadi" xatosi: Vercel'dagi `SUPABASE_SERVICE_ROLE_KEY`
noto'g'ri edi — foydalanuvchi almashtirdi, AI tahlil jonli serverda ishlaydi.

### 3.13. Taklif tizimi va ulashish posteri
- `c80e72e` — **058:** `profiles.referral_code` (7 belgi, 0/O/1/I/L yo'q,
  unikal; mavjudlarga berildi, yangilariga BEFORE INSERT trigger) va
  `referred_by` — mijoz o'qiy/yoza olmaydi; `referral_rewards` (RLS, mijozga
  huquq yo'q, `referred_id UNIQUE`); `apply_referral_code(p_code)` — o'zini,
  ikkinchi marta, 48 soatdan eski akkaunt, o'zaro (A↔B) va bloklangan
  foydalanuvchi kodi rad etiladi; do'st **+50**, taklif qiluvchi **+100**
  tanga va bildirishnoma (`link: profile:<do'st id>`); taklif qiluvchi
  sutkada ko'pi bilan **10** marta mukofot oladi (keyin 0, do'st baribir +50).
  `get_my_referral_info()` — kod, `can_apply`, muddat, taklif qilinganlar
  soni, ishlangan tangalar.
- `604f9ea` — `?ref=KOD` `main.tsx` da saqlanadi (`utils/referral.ts`), kirgach
  `useReferralAutoApply` qo'llaydi (tarmoq xatosida keyin qayta urinadi).
  Profil: `InviteFriendsCard` → `InviteFriendsModal` (nusxalash, ulashish,
  Telegram, statistika, 48 soat ichida kodni qo'lda kiritish).
  `utils/share.ts` — umumiy ulashish yordamchilari.
- `4d0e0a4` — `ShareAnalyticsModal` + `AnalyticsPoster`: Story 9:16
  (1080x1920) va Post 1:1 (1080x1080) PNG. Telegram tugmasi natija va taklif
  havolasini matn sifatida yuboradi (Telegram'ning ochiq ulashish havolasi
  rasm qabul qilmaydi); Ulashish — PNG; Rasmni saqlash — Documents/IDROK,
  bo'lmasa ulashish oynasi. Personaj — `idle-poster.jpg` statik kadri.
  Shriftlar `utils/posterFonts.ts` orqali PNG ichiga joylanadi.

## 4. Joriy holat

- Kod: `main` = `idrok/refactor`, oxirgi kod commiti `4d0e0a4`. Testlar **135/135**, typecheck 0 xato.
- Vercel: deploy yana ishlaydi (`4e63a43` dan beri). `privacy.html` va `delete-account.html` ochiq, `/api/ai-analysis` javob beradi.
- Prod baza: 002–057 qo'llangan va jurnalda; 058 CI orqali qo'llanadi (tekshirish: `npm run db:status`). Ilova `kiwrqzetpyobaemrsquq` loyihasiga ulangan (`ccjtciguxjogeadmstnd` — boshqa, bo'sh loyiha, ishlatilmaydi).
- Baza parollari almashtirilgan; yangi parol faqat GitHub secret'da va foydalanuvchida.
- **Paketlar** (`versionName 1.0.1`, `versionCode 2`, `com.idrok.app`):
  - sinov: `android\app\build\outputs\apk\debug\app-debug.apk` (~9.7 MB, `4d0e0a4`);
  - Play Console: `android\app\build\outputs\bundle\release\app-release.aab` (~7.2 MB, `afffc57` holatida — taklif va poster yo'q; yuklashdan oldin `bundleRelease` ni qayta yig'ing), release kaliti bilan imzolangan (`jarsigner`: `jar verified`, `CN=Tracker, O=Tracker, C=UZ`). Imzo `android/keystore.properties` (git-ignored) dan o'qiladi.
- Ma'lum ogohlantirish: release build'da `@capgo/capacitor-health` uchun "Kotlin metadata 2.4.0, expected 2.2.0" xabarlari chiqadi — build muvaffaqiyatli, lekin Kotlin/AGP versiyasini keyinroq moslash kerak.
- Play Console'ga hali hech narsa yuklanmagan: birinchi yuklash `versionCode 2` bilan bo'lishi mumkin, keyingilarida oshiring.

## 5. Qilinmagan / keyingi ishlar

1. **Play Market:** `app-release.aab` ni Internal testing trekiga yuklash; Play Console'da Data safety, Health apps, App access (reviewer test hisobi), Target audience formalarini `docs/PLAY_STORE.md` bo'yicha to'ldirish; keyin Closed testing (12 tester, 14 kun).
2. **058 prod'da qo'llanganini tasdiqlash:** GitHub Actions → CI → `migrate` (kerak bo'lsa "Review deployments"), keyin `npm run db:status` — kutilayotgan 0.
3. **Tanga sotish (B variant, keyinroq):** Google Play Billing (consumable) + serverda Google Play Developer API orqali xaridni tekshirish + `credit_payment` kabi RPC; yoqish — `platformPolicy.ts`.
4. **Tanga iqtisodi:** narxlar 150–600 ga tushirildi (057); foydalanuvchi kuniga qancha tanga ishlashini haqiqiy ma'lumotda o'lchab, kerak bo'lsa yana moslash.
5. **Sinov (telefonda ko'rilmagan):** yangi vaqt tanlagich, AI closeup kadri, ekran vaqti va uyqu hisoblari (Samsung Digital Wellbeing bilan farq bo'lishi mumkin), 20 kunlik bezaklar va yangi narxlar, admin bildirishnomasi, Sozlamalardan akkauntni o'chirish, veb-versiyaga kirish va AI tahlil (Vercel tiklangandan keyin).
6. **Texnik qarz (qolgan):** `social.ts` dagi "sizi kuzatishni boshladi" bildirishnoma matni boshqa foydalanuvchi uchun bazaga o'zbekcha yoziladi (qabul qiluvchi tili noma'lum); Kotlin metadata ogohlantirishi (`@capgo/capacitor-health`); admin `UsersTab` boshqalarning ramkasini `profiles` dan ko'rsatadi (faqat admin uchun).
7. **Taklif tizimi:** soxta akkauntlar bilan tanga yig'ish kuzatilsa — taklif qiluvchi mukofotini do'st birinchi odatini bajargandan keyin berishga o'tkazish. `?ref` faqat veb havola orqali ishlaydi; Android App Links (havola ilovani ochishi) hali yo'q — ilova foydalanuvchisi kodni qo'lda kiritadi. Telefonda sinalmagan: ulashish oynasi, Documents/IDROK ga saqlash, Telegram havolasi.
8. **Personaj tizimi (reja):** Rive (holat mashinasi: emotsiya, harakat, kiyim joylari); `wearable_items` / `user_wearables` / `user_loadout`; darajaga qarab ochiladigan emotsiyalar; odat turkumiga bog'liq harakatlar (masalan, ertalabki yugurishda krossovka bog'lash). Avval rassom uchun texnik topshiriq.
9. **Maktablar:** Play'da 13+ (7–11-sinflar); 13 yoshdan kichiklar uchun Families siyosati talablari; shaxsiy ma'lumotlarni O'zbekistonda saqlash talabini huquqshunos bilan aniqlashtirish.
10. **Mahsulot:** funksiyalar ko'p; yangi narsa qo'shishdan oldin yopiq beta va 7/30 kunlik qaytish (retention) ko'rsatkichini o'lchash tavsiya etilgan.

## 6. Foydali fayllar

| Fayl | Nima |
| --- | --- |
| `supabase/MIGRATIONS.md` | migratsiya yozish/sinash/qo'llash |
| `docs/PLAY_STORE.md` | Play Console javoblari |
| `src/utils/platformPolicy.ts` | ilovada tanga sotish yoqilganmi |
| `src/utils/cosmetics.ts` | bezak narxlari va muddati (056 bilan bir xil bo'lishi shart) |
| `src/components/CustomTimePickerModal.tsx` | yagona vaqt tanlagich |
| `src/hooks/useHardwareBackButton.ts`, `src/utils/navStack.ts` | Android "Orqaga" |
| `src/services/autoMetricsService.ts`, `android/…/screentime/IdrokScreenTimePlugin.java` | uyqu va ekran vaqti |
| `api/ai-analysis.ts`, `src/utils/aiTwin.ts` | AI tahlil |
| `src/features/admin/tabs/FeedbackTab.tsx` | admin "Fikr va takliflar" |
