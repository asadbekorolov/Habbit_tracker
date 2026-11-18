# Google Play'ga chiqarish — Play Console uchun tayyor javoblar

Ilova: **IDROK**, paket nomi `com.idrok.app` (`android/app/build.gradle`,
hozir `versionCode 1`). Ushbu hujjatdagi inglizcha matnlarni
Play Console'ga to'g'ridan-to'g'ri nusxalash mumkin.

Muhim havolalar (Vercel'da ochiq):

| Nima | URL |
| --- | --- |
| Privacy policy | `https://habit-tracker-asadbek.vercel.app/privacy.html` |
| Account deletion | `https://habit-tracker-asadbek.vercel.app/delete-account.html` |

---

## 0. Chiqarishdan oldin

- [ ] Yangi **shaxsiy** developer hisoblari uchun: production'dan oldin
      **yopiq test (closed testing)** — kamida 12 ta tester, 14 kun. Avval
      Internal testing, keyin Closed testing trekidan boshlang.
- [ ] Reliz `bundleRelease` (AAB) bilan, mavjud `release-key.keystore` orqali
      imzolanadi (Play App Signing yoqiladi).
- [ ] Ilovada tanga **sotib olish yo'q** (faqat ishlanadi) —
      `src/utils/platformPolicy.ts`. Click/Payme faqat veb-versiyada.
- [ ] Reviewer uchun test hisob (pastda, "App access").

---

## 1. App content → Privacy policy

`https://habit-tracker-asadbek.vercel.app/privacy.html`

## 2. App content → App access

"All or some functionality is restricted" — ilova kirishni talab qiladi.
Reviewer uchun **alohida test hisob** yarating (email + parol) va faqat Play
Console'ga yozing (repoga emas):

> Sign in on the login screen with the email and password below. Health
> Connect and Usage access are optional; the app works without them.

## 3. App content → Ads

**No**, the app does not contain ads.

## 4. App content → Target audience

13+ (13–15, 16–17, 18+). 13 yoshdan kichiklarni tanlamang — bu Families
siyosatini yoqadi.

## 5. App content → Data safety

Umumiy savollar:

- Does your app collect or share any of the required user data types? **Yes**
- Is all of the user data collected by your app encrypted in transit? **Yes**
- Do you provide a way for users to request that their data is deleted? **Yes**
  (in-app: Settings → Privacy & account → Delete account; web: delete-account URL)

Xizmat ko'rsatuvchilar (Supabase, Vercel, Anthropic) sizning nomingizdan
ishlov beradi — Google ta'rifiga ko'ra bu **"sharing" emas**. Shu sabab
quyidagilarning barchasi: **Collected = Yes, Shared = No**.

| Kategoriya → tur | Majburiy? | Maqsad |
| --- | --- | --- |
| Personal info → Name | Required | App functionality, Account management |
| Personal info → Email address | Required | Account management |
| Personal info → User IDs | Required | App functionality, Account management |
| Personal info → Phone number | Optional | App functionality |
| Personal info → Other info (bio, Telegram/Instagram handle, birth date) | Optional | App functionality, Personalization |
| Health and fitness → Health info (sleep duration, height, weight) | Optional | App functionality, Personalization |
| Health and fitness → Fitness info (steps) | Optional | App functionality, Personalization |
| Financial info → Purchase history (store items bought with coins) | Required* | App functionality |
| Photos and videos → Photos (profile photo) | Optional | App functionality |
| App activity → App interactions (screens opened) | Required | Analytics |
| App activity → Other user-generated content (journal notes, "not done" reasons, feedback) | Optional | App functionality, Personalization |
| App activity → Other actions (daily total screen time) | Optional | App functionality, Personalization |

\* Faqat do'konda tanga sarflanganda yoziladi.

Yig'ilmaydi: Location, Contacts, Messages, Calendar, Audio, Files, Web
browsing, App info and performance (crash logs), Device or other IDs.

> Ekran vaqti uchun: faqat kunlik **jami daqiqa** saqlanadi, ilovalar
> ro'yxati yuborilmaydi — shuning uchun "Apps on device" emas, "Other actions".

## 6. App content → Health apps (Health Connect)

Health features: **Activity and fitness**, **Sleep management**.

`android.permission.health.READ_STEPS`:

> IDROK is a habit tracker. It reads the daily step count to show it on the
> Health screen and in the daily summary, and to include the user's average
> steps in the personal habit analysis the user requests. Data is read only,
> never written, never used for advertising and never sold.

`android.permission.health.READ_SLEEP`:

> IDROK reads last night's sleep duration to fill in the user's daily card
> automatically (instead of manual entry) and to show how sleep relates to
> the user's habit completion in their personal analysis. Data is read only,
> never written, never used for advertising and never sold.

## 7. Sensitive permissions (agar Play Console so'rasa)

`PACKAGE_USAGE_STATS` (Usage access) — foydalanuvchi o'zi Android
sozlamalarida yoqadi; ilova oldin tushuntirish kartasini ko'rsatadi
(`AutoMetricsCard`):

> The app shows the user's total daily screen time next to their habits so
> they can reduce phone use, which is a core goal of the habit tracker. The
> total is calculated on the device; only one number per day (minutes) is
> stored. The list of apps and per-app usage are never sent to our servers.
> The feature is optional and the user grants access manually in system
> settings.

`SCHEDULE_EXACT_ALARM` — odat eslatmalari belgilangan vaqtda kelishi uchun
(foydalanuvchi o'zi tanlagan soat). Android 14+ da foydalanuvchi ruxsat beradi.

## 8. App content → Financial features

**My app doesn't provide any financial features.** (Tanga — ilova ichidagi
o'yin valyutasi, faqat ishlanadi.)

## 9. Store listing (qisqa)

- Short description (80): *Build habits with streaks, a daily routine and
  personal AI insights.*
- Kategoriya: Health & Fitness yoki Productivity.
- Skrinshotlar: Bosh sahifa, Kundalik, Tahlil (AI Tahlil), Guruhlar, Profil.

---

## Keyinroq: tanga sotish (B variant)

Foydalanuvchilar tanga sotib olishga tayyor ekani ko'rinsa — Google Play
Billing (consumable mahsulotlar) + serverda xaridni Google Play Developer API
orqali tekshirish + `credit_payment` ga o'xshash RPC. O'zbekiston merchant
ro'yxatdan o'tishni qo'llab-quvvatlaydi (to'lov USD, O'zbekiston QQS — sizning
javobgarligingizda). Yoqish nuqtasi: `src/utils/platformPolicy.ts`.
