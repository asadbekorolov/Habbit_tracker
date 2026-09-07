# Tracker — Odatlar va Salomatlikni Boshqarish Ilovasi

> **Tracker** — zamonaviy, gamifikatsiyalashgan va ma'lumotlarga asoslangan odatlarni kuzatish hamda salomatlik tahlili platformasi (Web va Android Native).

## 🚀 Jonli Havola va Platformalar
- **Web App (Vercel):** [https://habit-tracker-asadbek.vercel.app](https://habit-tracker-asadbek.vercel.app)
- **Mobil Platforma:** Android Native App (Capacitor 8)

---

## 📌 Ilova Haqida Umumiy Ma'lumot

**Tracker** foydalanuvchilarga kunlik ijobiy va salbiy odatlarini shakllantirish, salomatlik ko'rsatkichlarini (qadamlar, suv, uyqu, ekran vaqti, kaloriyalar, yurak urishi) kuzatib borish va guruhlarda birgalikda rivojlanish imkoniyatini beradi.

Ilova quyidagi asosiy tamoyillarga asoslangan:
1. **Gamifikatsiya (O'yinlashtirish):** Har bir bajarilgan odat va salomatlik maqsadi uchun XP (tajriba) hamda Tanga (Coins) beriladi.
2. **Mobil Avtonomlik va Native Integratsiya:** Android apparat tugmalari (Double-tap exit), Native bildirishnomalar, Haptics (vibratsiya) va Health Connect sinxronizatsiyasi.
3. **Guruhlar va Hamjamiyat:** Do'stlar bilan guruhlar tuzish, haftalik musobaqalar o'tkazish va umumiy reytingda peshqadam bo'lish.
4. **Monetizatsiya va Ekosistema:** Unikal profil ramkalari (Avatar Frames), Yaltiroq ism effektlari (Username Glow) va Click / Payme to'lov tizimlari orqali tanga to'ldirish.

---

## ✨ Asosiy Imkoniyatlar va Funksiyalar

### 1. 🎯 Odatlarni Boshqarish va Kunlik Jurnal
- **Ijobiy va Salbiy Odatlar:** Rivojlantiruvchi odat joylash va zararli odatlarga cheklov qo'yish (Saqlandi / Buzildi).
- **Moslashuvchan Metrikalar:** Ha/Yo'q (check), Sanoq (count - masalan: 8 stakan suv), Vaqt (time - masalan: 30 daqiqa yugurish).
- **Visual Tarix va Grid:** 30 kunlik kalendar issiqlik xaritasi (Heatmap), oylik va haftalik tahlillar.
- **Tezkor Jurnal va Eslatmalar:** Kunlik kayfiyat (1-5), chuqur uyqu va ekran vaqtini kiritish.

### 2. 📱 Android Native va Mobil Xususiyatlar
- **Suzuvchi Navigatsiya Paneli (Floating Bottom Dock):** 5-elementli zamonaviy pastki navigatsiya bar (Bosh sahifa, Odatlar, Markaziy yorqin "+" tugmasi, Statistika, Profil).
- **Apparat Back Tugmasi (Hardware Back Button):** 
  - Ochiq modal, dialog yoki bildirishnoma darchalarini birinchi bo'lib yopadi.
  - Ichki sahifalardan bosh sahifaga (`/dashboard`) qaytaradi.
  - Bosh sahifada 2 soniya ichida ikki marta bosilganda ilovani toza yopadi (*"Chiqish uchun yana bir marta bosing"*).
- **Bildirishnomalar Paneli:** Orqa fon xiralashuvi (backdrop blur), tashqariga bosganda yopilish va toza o'zbekcha bildirishnomalar ro'yxati.
- **Samsung Health & Health Connect:** Qadamlar, uyqu, suv va ekran vaqtini avtomatik fon rejimida sinxronlash.

### 3. 🏥 Salomatlik Monitoringi (Health Connect & Manual)
- **Avtomatik va Qo'lda Kiritish:** Qadamlar, uyqu, suv, ekran vaqti, kaloriyalar va yurak urishi (BPM).
- **To'g'ri Holat va Kunlik Nollanish:**
  - Yurak urishi ("Yurak urishi") kiritilmagan kunlarda `-- BPM` va `"Bugun kiritilmagan"` neytral holatini ko'rsatadi (soxta 72 BPM sukut bo'yicha berilmaydi).
  - Har bir yangi kunda salomatlik ko'rsatkichlari toza kunga moslanadi.

### 4. 🛍️ Do'kon va Monetizatsiya (Coin Shop)
- **Tanga Paketlari (Top-Up):**
  - **Kichik xalta:** 500 tanga (9 900 so'm)
  - **Oltin qop:** 1,500 tanga + **150 BONUS** (24 900 so'm) — Ommabop 🔥
  - **Xazina sandig'i:** 5,000 tanga + **550 BONUS** (59 900 so'm)
- **Xavfsiz To'lov Integratsiyasi:** Click (`#00A1F1`) va Payme (`#17C1C4`) to mezon rasmiy to'lov sahifasiga yo'naltirish.
- **Profil Kosmetikasi:**
  - **Ramkalar (Avatar Frames):** Bronza, Kumush, Oltin ramkalar (30 kunlik amal qilish muddati bilan).
  - **Yaltiroq Ism Effekti (Username Glow):** Profil va reytingda maxsus yaltiroq ism dizayni.
  - **Unvonlar (Titles):** Intizom Ustasi, Besh Yulduzli Afsona va b.

### 5. 👑 Gamifikatsiya, Darajalar va Guruhlar
- **XP va Level Tizimi:** Odatlarni bajarib darajangizni oshiring (🌱 Yangi -> ⚡ Izlanuvchi -> 🔥 Barqaror -> 💎 Usta -> 👑 Chempion).
- **Guruhlar va Subteamlar:** O'z guruhlaringizni tuzing, do'stlarni taklif kodi orqali qo'shing va guruh vazifalarini tasdiqlang.
- **Global Reyting (Leaderboard):** Barcha foydalanuvchilar orasida top-100 o'rin va shohsupa (Podium).

### 6. 🛡️ Admin Panel va Moderatsiya
- Foydalanuvchilarni bloklash / blokdan chiqarish (Ban/Unban).
- Global tizim bildirishnomalarini yuborish.
- Tizim statistikasi va foydalanuvchilar harakatini tahlil qilish.

---

## 🛠️ Texnologiyalar Steki (Tech Stack)

| Qatlam | Texnologiya |
|---|---|
| **Frontend Framework** | React 18 + TypeScript (Vite) |
| **Mobil Engine** | Capacitor 8 (Android Native / Java / Kotlin) |
| **Dizayn & Stil** | Tailwind CSS + CSS Variables + Framer Motion (Glassmorphism) |
| **Ikonkalar** | Lucide React |
| **Backend & DB** | Supabase (PostgreSQL + Auth + Storage + Realtime + RLS) |
| **Kesh & State** | TanStack React Query + Custom React Contexts |
| **Xosting va CI/CD** | Vercel (Auto Deploy) |
| **Shriftlar** | Inter (asosiy matnlar), Geist Mono (sonlar va kodlar) |

---

## 📁 Ilova Loyiha Tuzilmasi

```
Habbit_tracker/
├── android/                        # Android Studio & Capacitor native loyihasi
├── public/                         # PWA manifest, service worker va ikonkalari
├── src/
│   ├── App.tsx                    # Asosiy root komponent, marshrutlash, navigatsiya bar
│   ├── main.tsx                   # React root, Router va ErrorBoundary
│   ├── components/                # Umumiy UI komponentlar
│   │   ├── AddHabitModal.tsx      # Yangi odat qo'shish modali
│   │   ├── NotificationBell.tsx   # Bildirishnomalar darchasi
│   │   ├── PublicProfileModal.tsx # Public profil ko'rish modali
│   │   ├── Sidebar.tsx            # Desktop yon navigatsiya paneli
│   │   ├── AvatarFrame.tsx        # Kosmetik ramkalar renderi
│   │   └── LevelUpToast.tsx       # Daraja oshganda chiquvchi celebration
│   ├── features/                  # Mantiqiy modullar
│   │   ├── dashboard/             # Dashboard, Kunlik eslatmalar, Oy jadvali
│   │   ├── habits/                # HabitsManager, HabitsLog, HealthPage
│   │   ├── groups/                # GroupsPage, AdminPanel, GroupWeeklyCompetition
│   │   ├── profile/               # ProfilePage, EditProfilePage, CoinShopModal, Achievements
│   │   ├── analytics/             # Analytics va PDF eksport
│   │   └── leaderboard/           # GlobalLeaderboardPage
│   ├── hooks/                     # Custom React hooklar
│   │   ├── useHardwareBackButton.ts # Android back button 2-tap exit va modal logic
│   │   ├── useMobileLifecycle.ts    # Status bar, notifications, health sync
│   │   └── useHaptics.ts            # Haptics tebranishlari
│   ├── services/                  # Supabase, DB, Offline storage, Notifications
│   │   ├── db.ts                  # Barcha Supabase SQL so'rovlari va RPC
│   │   ├── supabase.ts            # Supabase klienti
│   │   └── healthSyncService.ts   # Health Connect sinxronlash
│   ├── store/                     # UserContext, ThemeContext, LangContext
│   ├── styles/                    # Tailwind va CSS mavzu o'zgaruvchilari
│   └── utils/                     # i18n, darajalar, kosmetika va yordamchilar
├── supabase/                      # Database migratsiyalari va SQL funksiyalar
├── capacitor.config.ts            # Capacitor sozlamalari
└── vite.config.ts                 # Vite sozlamalari
```

---

## ⚙️ Mahalliy Ishga Tushirish (Local Setup)

### 1. Repozitoriyani klonlash va bog'liqliklarni o'rnatish
```bash
git clone https://github.com/asadbekorolov/Habbit_tracker.git
cd Habbit_tracker
npm install
```

### 2. `.env.local` faylini yaratish
Loyiha ildizida `.env.local` faylini yarating va Supabase kalitlarini kiriting:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Ishga tushirish va Build
```bash
# Serverni ishga tushirish (http://localhost:5173)
npm run dev

# Production Build
npm run build
```

---

## 📱 Android Capacitor Build va Sync

Ilovani Android qurilmalar uchun kompilyatsiya qilish:

```bash
# 1. Web paketini build qilish va Android loyihasiga nusxalash
npm run build && npx cap sync android

# 2. Android Studioda loyihani ochish
npx cap open android
```

---

## 🗄️ Supabase Ma'lumotlar Bazasi va SQL Sozlamalari

Ilova to'liq Supabase PostgreSQL ma'lumotlar bazasi va RLS (Row Level Security) xavfsizlik qoidalariga tayanch qiladi.

### Asosiy Jadvallar (Tables):
- `profiles` — Foydalanuvchilar profili, XP score, tangalar, faol ramka, yaltiroq ism va rol (`user` / `admin`).
- `habits` — Barcha shakllantirilgan odatlar (ijobiy / salbiy, target qiymatlari bilan).
- `habit_logs` — Odatlarning kunlik bajarilish tarixi.
- `health_logs` — Qadamlar, uyqu, suv, ekran vaqti, kaloriyalar va yurak urishi jurnali.
- `groups`, `group_members`, `group_habits`, `group_habit_logs` — Guruhlar ekosistemasi.
- `notifications` — Foydalanuvchiga yuboriladigan tizim va ijtimoiy bildirishnomalar.
- `coin_purchases` — Kosmetika va do'kon xaridlari tarixi.

---

## 🌐 Til va Mavzular (i18n & Theme)
- **Tillar:** O'zbek tili (`uz`), Rus tili (`ru`), Ingliz tili (`en`).
- **Mavzu:** To'q rejim (Dark Mode - sukut bo'yicha) va Yorug' rejim (Light Mode).

---

## 👨‍💻 Loyiha Muallifi
- **Dasturchi:** Asadbek Orolov
- **GitHub Repozitoriyasi:** [https://github.com/asadbekorolov/Habbit_tracker](https://github.com/asadbekorolov/Habbit_tracker)
