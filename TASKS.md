# Traccer — Vazifalar ro'yxati

## 🛠 Admin Monitoring & Health-Check (joriy vazifa)

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
