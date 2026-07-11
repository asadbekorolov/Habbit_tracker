# Traccer — Data-Driven Habit Tracker

**Platforma:** Web / PWA (https://habit-tracker-asadbek.vercel.app)
**Texnologiyalar:** React 18, TypeScript, Vite, Tailwind CSS, Supabase (Postgres + Auth + RLS + Realtime)

---

## Nima bu?

Traccer — foydalanuvchilarga **kunlik odatlarini kuzatish**, **yaxshi odatlar hosil qilish** va **yomon odatlardan qutilish**ga yordam beruvchi ijtimoiy platforma.

Oddiy odat trackerlardan farqi:

- **Guruh tizimi**: haqiqiy mas'uliyat — sardor isbotni ko'rib tasdiqlaydi, o'zgarishlar barcha a'zolarga real-time yetib boradi
- **Sog'liq moduli**: uyqu, ekran vaqti, vazn kabi ko'rsatkichlarni alohida kuzatish
- **Ma'lumotlarga asoslangan tahlil**: oylik grafiklar, heatmap, PDF hisobot, haftalik sarhisob
- **Standartlashtirilgan odat katalogi**: erkin matn o'rniga oldindan tayyorlangan, kategoriyalangan odatlar ro'yxati

---

## Kelib chiqishi (nima muammoni hal qiladi)

Asl guruh (7 kishi, Telegram orqali kuzatish):

- Har kuni video, ovoz xabari, screenshot tashlardik — kim ertalab turdi, turnikda nechta qildi, telefon ekran vaqti qancha
- Sardor ularni ko'rib tekshirardi
- **Muammo**: hech narsani yozib bormadik → oylik tahlil yo'q → demotivatsiya → guruh 80 kundan keyin tarqaldi

Traccer bu muammoni hal qiladi:

- Har qanday isbotni platformada qayd etish
- Sardor bir joyda hammasini tasdiqlaydi
- Oylik statistika avtomatik chiqadi

---

## Asosiy imkoniyatlar

### 📋 Kunlik Jurnal / Odatlar

- Ijobiy odatlarni belgilash: **Bajarildi / Bajarilmadi / Belgilanmagan** — uch holatli tizim (avval faqat salbiy odatlarda bo'lgan mantiq endi ijobiy odatlarga ham qo'llanildi)
- Raqamli odatlar: suv ichish (stakan), yugurish (daqiqa) va h.k.
- **Odat katalogi**: yangi odat qo'shishda erkin matn kiritish olib tashlandi — foydalanuvchi faqat kategoriyalangan tayyor ro'yxatdan tanlaydi (Sog'liq, Diqqat va Ta'lim, Muntazamlik kategoriyalari; masalan "Kuniga 2 litr suv ichish", "8 soat uxlash", "Ertalabki badantarbiya", "30 daqiqa kitob o'qish", "Telefonni 2 soatga cheklash")
- **Qat'iy kunlik qulflash** (`isLogDateLocked`): har bir kun uchun odat belgilash/o'zgartirish oynasi shu kun 00:00'dan ertasi kuni soat 09:00'gacha ochiq. Bu muddat o'tgach — hatto avval belgilangan yozuv bo'lsa ham — kun butunlay qulflanadi (checkbox/X tugmalari yo'qoladi, 🔒 belgisi chiqadi); haftalik navigatsiyada eski kunlarni ko'rish mumkin, lekin faqat o'qish uchun. Jurnal yozuvlari (kayfiyat/matn) ham xuddi shunday o'tgan kunlar uchun **faqat o'qish uchun** (read-only)

### 👥 Guruh Tizimi (asosiy funksiya)

**Guruh tuzilmasi:**

- Sardor (leader) — odat bajarilganini tasdiqlash huquqiga ega
- A'zolar — o'z odatlarini o'zlari belgilaydi
- Kichik jamoalar (sub-team) tuzish imkoniyati
- Umumiy guruh odatlari (hamma bajarishi shart)

**Isbotlash va tasdiqlash jarayoni:**

1. A'zo odat bajarganini belgilaydi + izohi yozadi ("bugun 60ta adjimaniya: 3×20")
2. Status → `kutilmoqda` (pending)
3. Sardor platformada ro'yxatni ko'radi — Telegram'dagi isbotni ko'rib platformada **Tasdiqlaydi** yoki **Rad etadi**
4. Tasdiqlangandan keyin ball va tahlilga qo'shiladi

**Real-time sinxronizatsiya:** guruh sahifasi (a'zolar, kutayotgan isbotlar, kunlik loglar) Supabase Realtime orqali barcha ochiq oynalarda avtomatik yangilanadi — qo'lda "refresh" qilish shart emas.

**Sardor paneli:**

- Bugungi barcha kutilayotgan isbotlar
- Har bir a'zo uchun: bajarganmi, izoh bormi
- Bir bosishda tasdiqlash / sabab bilan rad etish

**Guruh tahlili:**

- Oylik jadval — har bir a'zo uchun alohida statistika
- Kim faol, kim orqada qolmoqda
- Haftalik va oylik guruh natijalari (bajarilgan % vs tasdiqlangan %)

### 🩺 Sog'liq (Health)

- Uyqu soati, ekran vaqti kabi ko'rsatkichlarni kunlik kiritish — bitta yagona manba (`health_logs`) orqali; Kunlik Jurnaldagi va Sog'liq sahifasidagi qiymatlar endi bir-biriga sinxron
- Haftalik grafik, maqsad (goal) belgilash, oldingi kundan avtomatik to'ldirish
- Qisman (incremental) saqlash — faqat o'zgargan maydon yuboriladi, tugma qulflanib qolish xatosi tuzatilgan

### 🗓️ Haftalik Sarhisob (Weekly Reflection)

- Haftalik o'z-o'zini baholash faqat **hafta oxirida** ochiq: Shanba 18:00 dan keyin yoki Yakshanba kuni
- O'tgan haftalar har doim faqat o'qish uchun (read-only)
- Joriy hafta muddatidan oldin qulflangan holatda, aniq ogohlantirish ko'rsatiladi: "🔒 Hafta sarhisobini yozish uchun Shanba 18:00 dan keyin yoki Yakshanba kuni kiring."

### 📅 Oylik Jadval va Tarixiy Jurnal

- Heatmap ko'rinishida oy davomidagi faollik
- Har kun uchun bajarilgan odatlar soni
- Oy davomidagi barcha kunlik jurnal yozuvlarini ko'rish uchun aylanuvchi (scrollable) ro'yxat

### 🏆 Ball va Daraja Tizimi

Har bir **tasdiqlangan** ijobiy odat uchun **+1 ball**. 5 daraja:

| Daraja | Nom | Ball |
| 1 🌱 | Yangi | 0–49 |
| 2 ⚡ | Izlanuvchi | 50–149 |
| 3 🔥 | Barqaror | 150–299 |
| 4 💎 | Usta | 300–499 |
| 5 👑 | Chempion | 500+ |

### 🎯 Streak (Ketma-ketlik) va Streak Freeze

- Har kun bajarish ketma-ketligi hisoblanadi
- 7, 14, 21, 30 kunlik milestonelar uchun maxsus bildirishnoma
- Dashboard'da smart ogohlantirish: "3 kunlik seriangiz xavf ostida!"
- **Streak Freeze** — tanga (coin) evaziga bir kunlik "muzlatish" sotib olish, seriyani uzmasdan saqlab qolish

### 🪙 Do'kon (Coin Shop) va Star

- Ball evaziga tanga yig'ish, tangalarni do'konda maxsus belgilar (badge), qo'shimcha streak freeze va **Star** holatiga almashtirish

### 🌍 Global Reyting va Ijtimoiy Feed

- Barcha foydalanuvchilar orasida ball bo'yicha reyting, top liderlik taxtasi
- **Obuna (Follow)** tizimi — boshqa foydalanuvchilarni kuzatish, ularning seriyasi/yangi odatlari bo'yicha feed
- Ochiq profil (Public Profile) — o'zga foydalanuvchi profilini ko'rish, unga izoh (reaction) qoldirish, Telegram orqali maxfiylik-hurmat qiluvchi tarzda bog'lanish so'rovi yuborish (shaxsiy `@username` faqat profil egasiga ko'rinadi, boshqalarga chiqmaydi)

### 🏅 Yutuqlar (Achievements)

Mijoz tomonidan hisoblanadigan 6 ta nishon (Birinchi qadam, 7/30 kunlik seriya, 100/500 ball, 100 ta odat) + server tomonidan beriladigan maxsus nishonlar (`iron_will`, `early_bird`, `negative_killer`).

### 🤖 AI Coach

- Foydalanuvchi progressi asosida shaxsiylashtirilgan tavsiya/qayd (`ai-coach` API endpoint, Anthropic Claude orqali)

### 📊 Tahlil (Analytics)

- 30 kunlik statistika, kunlik trend grafigi (area chart)
- Joriy va eng yaxshi seriya taqqoslash grafigi
- Haftalik barqarorlik (bajarilish %) bar-chart ko'rinishida
- PDF hisobot yuklab olish

### 🔔 Bildirishnomalar

- Push-bildirishnoma obunasi, kunlik eslatma
- Streak xavfi haqida ogohlantirish
- Guruh ichidagi tasdiq/rad javoblari haqida real-time bildirishnoma

### 💬 Fikr Bildirish (Feedback)

- Har bir foydalanuvchi ilova ichidan to'g'ridan-to'g'ri fikr-mulohaza yuborishi mumkin (Sidebar'dagi "Fikr bildirish" tugmasi)
- Fikrlar faqat sayt admini tomonidan ko'riladi (SECURITY DEFINER RPC orqali)

### 🛠️ Admin Panel

Bo'limli (tabbed) interfeys:

- **Statistika** — umumiy ko'rsatkichlar + CSV eksport (Foydalanuvchilar, Fikr-mulohazalar, Barcha odatlar — odat yaratuvchisining ismi/username'i bilan birga)
- **Foydalanuvchilar** — jadval ko'rinishida (Ism, Username, Ball, Ro'yxatdan o'tgan sana, Oxirgi faollik), ban/unban
- **Fikr-mulohazalar** — foydalanuvchilar yuborgan fikrlar ro'yxati
- **Monitoring** — faol bo'lmagan guruhlar, tizim monitoringi
- **Sog'liq** (health/moderation)

---

## Foydalanuvchi yo'li

1. **Ro'yxatdan o'tish** → Email + parol + ism + username + telefon
2. **Odatlar qo'shish** → Standart katalogdan tanlash (erkin matn kiritish yo'q)
3. **Guruhga qo'shilish** → Invite kod orqali, sardor isbotlarni tasdiqlaydi
4. **Har kuni belgilash** → Dashboard yoki Jurnal orqali + izoh
5. **Natijalarni ko'rish** → Yutuqlar, Tahlil, Guruh statistikasi, Haftalik sarhisob

---

## Texnik arxitektura

Frontend: React 18 + TypeScript (Vite)
Styling:  Tailwind CSS + CSS Variables (dark/light theme)
Auth:     Supabase Auth (email/password)
Database: Supabase (PostgreSQL) + Row Level Security + Realtime
Deploy:   Vercel (habit-tracker-asadbek.vercel.app)
i18n:     uz / ru / en (src/utils/i18n.ts, uchala til qat'iy sinxron)

### Asosiy jadvallar

- `profiles` — foydalanuvchi ma'lumotlari, ball, daraja, bio, `last_seen`
- `habits` — odatlar (ijobiy/salbiy, maqsad, birlik) — endi faqat katalogdan yaratiladi
- `habit_logs` — kunlik belgilashlar + proof_note + approval_status, uch holatli (done/missed/pending)
- `groups` / `group_members` / `group_habits` / `group_habit_logs` — guruh tizimi (realtime yoqilgan)
- `daily_notes` — kunlik jurnal (kayfiyat, matn); uyqu/ekran vaqti endi `health_logs`da saqlanadi
- `health_logs` — uyqu, ekran vaqti va boshqa sog'liq ko'rsatkichlari (yagona manba)
- `weekly_reflections` — haftalik sarhisob yozuvlari
- `user_feedback` — foydalanuvchi fikrlari (faqat admin o'qiy oladi)
- `achievements` / unlocked badges
- **`duels` jadvali va 1v1 Duel funksiyasi butunlay olib tashlangan** (015-migratsiya)

### Muhim Supabase RPC funksiyalari (SECURITY DEFINER, `auth.uid()` + `is_admin` tekshiruvi bilan)

- `get_admin_monitoring_stats`, `get_inactive_groups`, `reset_all_data`, `get_all_feedback` — admin-only o'qish/yozish
- `get_leaderboard`, `get_group_leaderboard` — reyting
- `increment_score` — ball qo'shish/ayirish

### Migratsiyalar

`supabase/migrations/` papkasida raqamlangan SQL fayllar (002–016) — har bir sxema o'zgarishi alohida faylda hujjatlashtiriladi, Supabase SQL Editor orqali qo'lda ishga tushiriladi.

---

## Maqsadli auditoriya

- O'z-o'zini rivojlantirmoqchi bo'lgan yoshlar
- Do'stlar yoki hamkasblar bilan mas'uliyatli guruh tuzmoqchilar
- Oylik tahlilni avtomatik ko'rmoqchi bo'lganlar
- Odat hosil qilishda motivatsiya kerak bo'lganlar

---

*Traccer — isbotlash, tasdiqlash, tahlil qilish. Odatlaringizni raqamlarga aylantirib, o'sishingizni ko'rsatadi.*
