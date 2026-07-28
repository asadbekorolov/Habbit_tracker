# Traccer — Vazifalar ro'yxati

## 🔴 Roadmap & Backlog (joriy ustuvorlik)

### 1. Yuqori ustuvorlik va xato tuzatishlar
- [x] **Admin fikr-mulohaza ko'rish/eksport:** Kod allaqachon to'liq mavjud edi (AdminPanel → Fikr-mulohaza tab, CSV eksport). Email o'rniga shu tanlandi. Faqat production deploy qilinishini kutmoqda (Vercel webhook muammosi tufayli).
- [x] **Daraja (Level) balansini qayta ko'rib chiqish:** 5 tadan 10 ta darajaga o'tkazildi, eksponensial formula `round(N^1.5 * 100)` bilan (0/283/520/800/1118/1470/1852/2263/2700/3162). Client (`levels.ts`) va server (`calculate_level()` SQL, migration 024) ikkalasi ham yangilandi.

### 2. Adolatli reyting (Global Reyting / Tahlil)
- [x] **Samaradorlikka asoslangan reyting:** `get_leaderboard()` va yangi `get_user_rank_efficiency()` endi so'nggi 30 kunlik `(bajarilgan / faol odatlar soni * kunlar) * 100` samaradorlik foiziga qarab tartiblanadi (xom ball emas). Reyting sahifasida foiz asosiy ko'rsatkich, ball kichik ikkinchi darajali statistika sifatida qoladi.

### 3. Coin Do'kon va Monetizatsiya
- [x] **Do'konni kengaytirish:** Profil ramkalari (bronza/kumush/oltin — sotib olib "Faollashtirish" bilan tanlanadi, avatar ko'rinadigan hamma joyda: Profil, Reyting, boshqa profil) va maxsus avatar gradientlari (3 ta, Profilni tahrirlashda tanlanadi) qo'shildi. Egalik `coin_purchases` jadvali orqali umumiy tarzda kuzatiladi.
- [x] **Ramka muddati (30 kun) + narx balansi + Yaltiroq ism:** Ramkalar endi 30 kunlik xarid (`cleanup_expired_frame()` RPC — kirganda/do'kon ochilganda avtomatik yechadi, reytingda ham mustaqil tekshiriladi). Aniq "Faollashtirish"/"O'chirish" tugmasi va "N kun qoldi" ko'rsatkichi qo'shildi. Narxlar qayta balanslandi: Bronza 8, Kumush 20, Oltin 50 (avval 15/30/60). Yangi doimiy kosmetika: "Yaltiroq ism" (40🪙, `profiles.username_glow`) — Profil, boshqa profil va Reytingda ismi yaltirab ko'rinadi, dark/light rejimga moslashadi. Migratsiya: `028_frame_expiry_and_username_glow.sql`.
- [x] **Kunlik vazifalar (Daily Quests) + Guruh haftalik musobaqasi:** Bosh sahifada 3 ta kunlik vazifa kartasi (3 ta odat bajarish +5🪙, kunni 100% yakunlash +10🪙, salbiy odatga qarshi turish +5🪙) — shart har doim serverda (`claim_daily_quest()` RPC) mustaqil tekshiriladi, firibgarlik imkonsiz. Guruh "Reyting" tabida jonli "Shu hafta" mini-reyting va o'tgan hafta g'olibiga avtomatik +20🪙 mukofot banneri (`settle_group_week()` — kirganda o'z-o'zini hisoblaydi, cron shart emas). Migratsiya: `029_daily_quests_and_group_weekly.sql`.
- [~] **Monetizatsiya integratsiyasi:** Arxitektura tayyorlandi — `docs/Monetization_Architecture.md` (Click/Payme oqimi, `payment_transactions` jadvali, xavfsizlik nazorat ro'yxati). Kod hali yozilmagan — merchant hisobi va API kalitlari kutilmoqda.

### 4. Guruh A'zoligini Boshqarish (Group Membership & Management Rework)
- [x] **Guruhdan chiqish:** Oddiy a'zo istalgan payt chiqadi. Asosiy sardor faqat (a) yagona a'zo bo'lsa (guruh butunlay o'chadi) yoki (b) avval egalikni boshqasiga topshirgandan keyin chiqa oladi.
- [x] **Guruhni o'chirish:** Faqat asosiy sardor — guruh sozlamalari (⚙️) menyusidan, ikki bosishli tasdiqlash bilan. Barcha bog'liq odat/log/a'zolik yozuvlari kaskad orqali tozalanadi.
- [x] **A'zoni chiqarib yuborish:** Sardor va co-adminlar A'zolar tabidan istalgan (o'zidan va asosiy sardordan tashqari) a'zoni chiqarib yubora oladi.
- [x] **Ikkinchi admin (co-admin):** Asosiy sardor A'zolar tabidan istalgan a'zoga admin huquqi bera/olib tashlay oladi (`group_members.role`) — co-admin odat qo'shish/o'chirish, isbot tasdiqlash/rad etish va a'zo chiqarib yuborishni bajara oladi, lekin guruhni o'chira yoki boshqa birovni admin qila olmaydi. Egalikni to'liq topshirish (`transfer_group_ownership`) ham qo'shildi.

Migratsiya: `031_group_membership_management.sql`.

---

## 🛠 Admin Monitoring & Health-Check (avvalgi vazifa)

1. [x] `touch_last_seen()` integratsiyasi App.tsx'ga (sessiya init va login paytida chaqiriladi)
2. [x] "Monitoring" tab UI — DAU stat kartasi (last_seen_at asosida) + top 5 odat chart (get_admin_monitoring_stats)
3. [x] "Sog'liq tekshiruvi" tab UI — faolsiz guruhlar ro'yxati (get_inactive_groups) + o'chirish tugmasi (tasdiqlash bilan)
4. [x] Build & typecheck tekshiruvi
5. [x] Production'ga deploy (`npx vercel --prod`)

---

## ✅ Bajarilgan
- Score tizimi (increment_score RPC, retroaktiv SQL)
- Salbiy odatlar 3 holat (Ha/Yo'q/belgilanmagan)
- Oldingi kunlar uchun belgilash (7 kun orqaga)
- Dashboard count sinkronizatsiyasi
- ProfilePage va Achievements fresh score fetch
- Salbiy odatlar ball qo'shmasligi (isNegative flag)
- Bildirishnomalar UI (denied/default/granted holat)
- Vercel deploy pipeline
- Telefon raqam +998 prefiksi va auto-format
- Profilni tahrirlash sahifasi (EditProfilePage) — avatar, ism, bio
- Sozlamalar sahifasi tozalandi — faqat parol + bildirishnomalar + chiqish
- Guruh tizimi to'liq: tur/birlik bilan odat qo'shish, isbotlash, tasdiqlash, sardor paneli, tahlil
- Follow/Follower tizimi — kuzatish/bekor qilish, hisob, ro'yxat
- Apple Calendar uslubida HabitsLog (Jurnal) — haftalik timeline, vaqt bloklar
- SMS OTP telefon tasdiqlash (LoginPage)
- Calendar vaqt belgilash (HabitsManager — scheduled_start/end)
- **Lenta (FeedPage)** — kuzatayotganlarning natijalarini ko'rish, foydalanuvchi qidirish
- SQL Migrations — habits scheduled_start/end, group_habits type/unit/RLS, profiles bio

---

## 🔴 Navbatdagi vazifalar (prioritet bo'yicha)

### ~~1. Profil + Sozlamalar birlashtirish~~ ✅
### ~~2. Til tanlash UI yaxshilash~~ ✅
### ~~3. Lenta (Feed) — Profil ichiga ko'chirildi~~ ✅

### ~~4. Guruh oylik hisobot eksporti~~ ✅
- ~~Stats tab'ida "Yuklab olish" tugmasi (html2canvas orqali)~~

---

### ~~3. Kuzatuvchilar lentalari yaxshilash~~ ✅
- ~~Lenta sahifasida streak ko'rsatish~~
- ~~"Yangi odat qo'shdi" events ham ko'rsatish~~

---

### ~~4. Sub-team~~ ✅
- ~~Guruh ichida 2–3 kishilik kichik jamoalar~~

---

## 💡 Kelajakdagi g'oyalar
- ~~Instagram profil havolasini profilda ko'rsatish~~ ✅
- ~~Duel so'rovini followers ichidan yuborish~~ ✅
- ~~Guruhda Telegram guruh havolasini ko'rsatish~~ ✅
- ~~A'zo odat bajarganida Telegram botga avtomatik xabar~~ ✅

---

## 🔄 Avtomatlashtirish va Integratsiya

### ~~Salomatlik ilovalari integratsiyasi~~ ✅
- ~~Qadam, uyqu, suv, ekran vaqti kunlik kiritish~~
- ~~7 kunlik trend grafigi, maqsad progress bar~~
- ~~Mos odat topib avtomatik to'ldirish (Auto-fill)~~
- ~~Web app uchun: manual entry + habit auto-fill (Apple Health/Google Fit native API faqat native app da ishlaydi)~~

### ~~Telegram Bot yordamchisi~~ ✅
- ~~Foydalanuvchilar ilovaga kirmasdan Telegram orqali odat bajarganini tasdiqlashsin~~
- ~~Bitta tugma: "✅ Bajarildi" — aktivlikni keskin oshiradi~~

---

## 🎮 Gamifikatsiya va Psixologiya

### ~~Streak Freeze (Muzlatish)~~ ✅
- ~~Duolingo kabi tizim: oyda 1 kun bepul + coin shop orqali qo'shimcha muzlatish~~
- ~~Foydalanuvchi kasal bo'lsa yoki ta'tilda bo'lsa, seriyasi uzilmasin~~
- ~~Dashboard da "Muzlat 🛡️" banneri — seria xavf ostida bo'lganda ko'rinadi~~

### ~~Haftalik Sarhisob (Weekly Reflection)~~ ✅
- ~~Jurnal → "Sarhisob" tab: hafta navigatsiyasi, 2 savol, saqlash~~

### ~~Ichki Do'kon (Coin Shop)~~ ✅
- ~~Ballardan tashqari tangalar (coins) tizimi~~
- ~~Odat bajarganda tanga yig'ish~~
- ~~Sarflash imkoniyatlari: Seriya Himoyasi 🛡️ (10🪙), Yulduz Nishoni ⭐ (15🪙)~~
- ~~Profil sahifasida coin hisobi ko'rsatilsin~~

---

## 🤖 Sun'iy Intellekt va Kengaytirilgan Tahlil

### ~~AI Korrelyatsiya Tahlili~~ ✅
- ~~DailyNotes (kayfiyat, uyqu, ekran vaqti) + odat ma'lumotlari asosida bog'liqlik topish~~
- ~~Kayfiyat/Uyqu/Ekran vaqti va odat bajarish foizi taqqoslanadi~~
- ~~Analytics sahifasida "AI Tahlil" bo'limi — 5 kundan kam bo'lsa "yetarli emas" xabari~~

### ~~Smart Odat Tavsiyalari~~ ✅
- ~~Maqsad tanlash (4 xil): "Sog'lom hayot", "Samaradorlik", "Stress kamaytirish", "Raqamli detoks"~~
- ~~Har bir maqsad uchun odatlar ro'yxati, checkbox bilan tanlash, bir tugma bilan qo'shish~~

---

## 👥 Ijtimoiy Interaksiya

### ~~Kudos / Reaksiyalar (Feed)~~ ✅
- ~~Lenta sahifasida 🔥 / 👏 tugmalari — optimistik update, toggle (bosib-ochish)~~
- ~~feed_reactions jadval, getFeedReactions / toggleFeedReaction DB funksiyalari~~

### ~~Duel Revanshi~~ ✅
- ~~Tugagan duelda "Revansh" tugmasi — raqib bilan yangi duel formi ochiladi~~

---

## 📱 Texnik va Platforma Qulayligi

### ~~PWA (Progressive Web App)~~ ✅
- ~~manifest.json, service worker, iconlar (192/512px), install banner~~

### ~~Oflayn Rejim~~ ✅
- ~~Internet yo'q bo'lganda ham odatlarni belgilash imkoniyati~~
- ~~IndexedDB yoki localStorage ga vaqtincha saqlash~~
- ~~Aloqa tiklanganda Supabase bilan avtomatik sinxronizatsiya~~
