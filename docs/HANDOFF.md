# IDROK — qilingan ishlar va loyiha holati (topshirish hujjati)

> Bu hujjat loyihada ishlaydigan keyingi yordamchi (AI yoki dasturchi) uchun.
> Avval shuni to'liq o'qing — qoidalar, joriy holat va qilinmagan ishlar shu yerda.
> Sana: 2026-11-18. Oxirgi kod commiti: `0930f42` (`main` = `idrok/refactor`).

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

- **Jurnal:** `app_meta.schema_migrations` (anon/authenticated uchun yopiq). Prod bazada **002–056 `adopt` qilingan** (55 ta, SQL qayta ishga tushirilmagan). **057** — `main` ga push'dan keyin CI `migrate` job orqali qo'llanadi (`production` environment tasdig'i yoqilgan bo'lsa — GitHub Actions'da "Review deployments" tasdig'idan keyin). Tekshirish: `npm run db:status`.
- **Buyruqlar:** `npm run db:status` · `npm run db:migrate` (`-- --dry-run`) · `npm run db:adopt -- --through NNN` (faqat bir martalik edi, bajarilgan).
- **Ulanish:** `SUPABASE_DB_URL` muhit o'zgaruvchisi (Session pooler). TLS Supabase CA bilan to'liq tekshiriladi: `supabase/certs/prod-ca-2021.crt` (ommaviy sertifikat, commit qilingan).
- **CI** (`.github/workflows/ci.yml`): har push/PR'da `typecheck`, `npm test`, `build`. `main` ga push'da `migrate` job kutilayotgan migratsiyalarni qo'llaydi — GitHub'da `SUPABASE_DB_URL` secret va `DB_AUTO_MIGRATE=true` o'zgaruvchisi **o'rnatilgan**, `production` environment (ixtiyoriy tasdiq) bilan.
- **Yangi migratsiya qoidasi:** keyingi raqam `057_…`; `BEGIN; … COMMIT;`; qayta ishga tushirishga chidamli (`IF NOT EXISTS`, `CREATE OR REPLACE`, qaytish turi o'zgarsa avval `DROP FUNCTION IF EXISTS`); test `tests/db/057-….test.mjs`. Qo'llangan faylni tahrirlamang — yangi raqam qo'shing.
- **Tartib:** avval baza, keyin kod (Vercel `main` ni parallel deploy qiladi).
- Repoda `001` yo'q; 002–046 jonli bazada qo'lda qo'llangan. To'liq sxema: `npm run db:baseline` (`supabase/baseline/`).

### Testlar
- `npm test` = unit (`tests/*.test.ts`) + migratsiya testlari (`tests/db/*.test.mjs`, PGlite — xotiradagi Postgres). Hozir **129/129**.
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

## 4. Joriy holat

- Kod: `main` = `idrok/refactor`, oxirgi kod commiti `0930f42`. Testlar **130/130**, typecheck 0 xato.
- Vercel: deploy yana ishlaydi (`4e63a43` dan beri). `privacy.html` va `delete-account.html` ochiq, `/api/ai-analysis` javob beradi.
- Prod baza: 002–056 qo'llangan va jurnalda; 057 CI orqali qo'llanadi. Ilova `kiwrqzetpyobaemrsquq` loyihasiga ulangan (`ccjtciguxjogeadmstnd` — boshqa, bo'sh loyiha, ishlatilmaydi).
- Baza parollari almashtirilgan; yangi parol faqat GitHub secret'da va foydalanuvchida.
- **Paketlar** (`versionName 1.0.0`, `versionCode 1`, `com.idrok.app`):
  - sinov: `android\app\build\outputs\apk\debug\app-debug.apk` (~9.5 MB);
  - Play Console: `android\app\build\outputs\bundle\release\app-release.aab` (~6.8 MB), release kaliti bilan imzolangan (`jarsigner`: `jar verified`, `CN=Tracker, O=Tracker, C=UZ`). Imzo `android/keystore.properties` (git-ignored) dan o'qiladi.
- Ma'lum ogohlantirish: release build'da `@capgo/capacitor-health` uchun "Kotlin metadata 2.4.0, expected 2.2.0" xabarlari chiqadi — build muvaffaqiyatli, lekin Kotlin/AGP versiyasini keyinroq moslash kerak.
- Keyingi AAB yuklashda `versionCode` ni oshiring (2, 3, …).

## 5. Qilinmagan / keyingi ishlar

1. **Play Market:** `app-release.aab` ni Internal testing trekiga yuklash; Play Console'da Data safety, Health apps, App access (reviewer test hisobi), Target audience formalarini `docs/PLAY_STORE.md` bo'yicha to'ldirish; keyin Closed testing (12 tester, 14 kun).
2. **057 prod'da qo'llanganini tasdiqlash:** GitHub Actions → CI → `migrate` (kerak bo'lsa "Review deployments"), keyin `npm run db:status` — kutilayotgan 0.
3. **Tanga sotish (B variant, keyinroq):** Google Play Billing (consumable) + serverda Google Play Developer API orqali xaridni tekshirish + `credit_payment` kabi RPC; yoqish — `platformPolicy.ts`.
4. **Tanga iqtisodi:** narxlar 150–600 ga tushirildi (057); foydalanuvchi kuniga qancha tanga ishlashini haqiqiy ma'lumotda o'lchab, kerak bo'lsa yana moslash.
5. **Sinov (telefonda ko'rilmagan):** yangi vaqt tanlagich, AI closeup kadri, ekran vaqti va uyqu hisoblari (Samsung Digital Wellbeing bilan farq bo'lishi mumkin), 20 kunlik bezaklar va yangi narxlar, admin bildirishnomasi, Sozlamalardan akkauntni o'chirish, veb-versiyaga kirish va AI tahlil (Vercel tiklangandan keyin).
6. **Texnik qarz (qolgan):** `social.ts` dagi "sizi kuzatishni boshladi" bildirishnoma matni boshqa foydalanuvchi uchun bazaga o'zbekcha yoziladi (qabul qiluvchi tili noma'lum); Kotlin metadata ogohlantirishi (`@capgo/capacitor-health`); admin `UsersTab` boshqalarning ramkasini `profiles` dan ko'rsatadi (faqat admin uchun).
7. **Mahsulot:** funksiyalar ko'p; yangi narsa qo'shishdan oldin yopiq beta va 7/30 kunlik qaytish (retention) ko'rsatkichini o'lchash tavsiya etilgan.

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
