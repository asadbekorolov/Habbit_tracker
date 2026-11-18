# Migratsiyalar: yozish, sinash, qo'llash

Bazaga o'zgarish faqat `supabase/migrations/NNN_nom.sql` orqali kiradi. Qaysi
fayl qachon qo'llangani bazadagi `app_meta.schema_migrations` jurnalida
saqlanadi (`scripts/db-migrate.mjs`). Shu sabab SQL Editor'da qo'lda
ishga tushirish kerak emas, va frontend bazadan oldinga o'tib ketmaydi.

## Yangi migratsiya

1. Keyingi raqam bilan fayl: `057_qisqa_nom.sql` (3 xonali, takrorlanmaydi,
   uzilishsiz — `tests/db/chain.test.mjs` tekshiradi).
2. Ichi `BEGIN; … COMMIT;` bilan o'ralgan va **qayta ishga tushirishga
   chidamli** bo'lsin (`IF NOT EXISTS`, `CREATE OR REPLACE`,
   `DROP … IF EXISTS`). Funksiyaning qaytish turi o'zgarsa — avval
   `DROP FUNCTION IF EXISTS`.
3. Test: `tests/db/057-nom.test.mjs` (namuna sifatida `054-fail-reason.test.mjs`).
4. `npm test` — unit testlar + PGlite'dagi migratsiya testlari. Zanjir testi
   har bir migratsiyani ketma-ket ikki marta qo'llab ko'radi.

Qo'llangan migratsiyani tahrirlamang — yangi raqamli fayl qo'shing
(`db:status` o'zgargan faylni `OZGARGAN` deb ko'rsatadi).

## Qo'llash

Ulanish satri: Supabase -> **Connect** -> **Session pooler** (5432-port).

```powershell
$env:SUPABASE_DB_URL = "postgresql://postgres.<ref>:<PAROL>@aws-0-<region>.pooler.supabase.com:5432/postgres"
npm run db:status                  # qo'llangan / KUTMOQDA
npm run db:migrate -- --dry-run    # nima qo'llanishini ko'rish
npm run db:migrate                 # qo'llash
```

Tartib: **avval baza, keyin ilova.** Yangi ustun yoki funksiyaga tayanadigan
kod `main` ga tushishidan oldin migratsiya qo'llangan bo'lsin (yoki CI'dagi
avtomatik qo'llash yoqilgan bo'lsin — pastda).

## Bir martalik o'tish (adopt)

Hozirgacha migratsiyalar qo'lda qo'llangan, jurnal bo'sh. Bunday bazada
`db:migrate` ataylab ishlamaydi (aks holda 002–055 qayta ishga tushib ketardi).

1. `npm run db:status` — jurnal bo'sh bo'lsa, 047–056 ning bazadagi izlarini
   tekshirib, taklif beradi: `Taklif: npm run db:adopt -- --through 055`.
   "DIQQAT: oraliqda…" chiqsa — o'sha migratsiyalarni qo'lda tekshiring.
2. Taklif qilingan raqam bilan: `npm run db:adopt -- --through 055`.
   Bu hech qanday SQL ishga tushirmaydi — faqat 002..055 ni jurnalga yozadi.
3. `npm run db:migrate` — qolganlari (masalan 056) qo'llanadi.

## CI (GitHub Actions)

`.github/workflows/ci.yml`:

- **check** — har push/PR: `typecheck`, `npm test` (migratsiya testlari bilan),
  `build`.
- **migrate** — `main` ga push bo'lganda, `check` o'tgandan keyin kutilayotgan
  migratsiyalarni qo'llaydi. Sukut bo'yicha **o'chiq**. Yoqish uchun
  (adopt qilingandan keyin):
  1. GitHub -> Settings -> Secrets and variables -> Actions ->
     **Secrets**: `SUPABASE_DB_URL` (yuqoridagi ulanish satri).
  2. Shu joyda **Variables**: `DB_AUTO_MIGRATE` = `true`.
  3. Ixtiyoriy: Settings -> Environments -> `production` -> "Required
     reviewers" — har qo'llashdan oldin tasdiq so'raydi.

  Jurnal bo'sh bo'lsa, `db:status` 2-kod bilan tugaydi va qo'llash to'xtaydi.

Vercel `main` ni parallel ravishda deploy qiladi, shuning uchun bazani
buzadigan (ustunni o'chiradigan/nomini o'zgartiradigan) o'zgarishlarni ikki
bosqichda chiqaring: avval migratsiya, keyin kod.

## Sinov bazasi haqida

`tests/db/legacy-schema.sql` — Supabase muhitining yaqinlashuvi va 047 dan
oldingi sxemaning soddalashtirilgan nusxasi (repoda `001` yo'q, 002–046
qo'lda qo'llangan). Shuning uchun migratsiya testlari 047+ ni sinaydi.
Jonli bazaning to'liq sxemasi: `npm run db:baseline` (`supabase/baseline/`).
