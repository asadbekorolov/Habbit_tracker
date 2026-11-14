# Baseline sxema

`000_baseline_schema.sql` — jonli bazadagi `public` sxemaning to'liq holati
(jadvallar, cheklovlar, indekslar, funksiyalar, triggerlar, RLS, policy'lar,
jadval/ustun/funksiya huquqlari, realtime, `coin_packs` va `shop_items` katalogi).

Repodagi migratsiyalardan uni qayta qurib bo'lmaydi: `001` yo'q, asosiy
jadvallar eskirgan `legacy/setup.DO_NOT_RUN.sql` da. Shuning uchun fayl
jonli bazaning katalogidan generatsiya qilinadi.

## Yangilash

Avval 049 migratsiyasi qo'llangan bo'lishi kerak (generator `coin_packs` ni o'qiydi).

```powershell
$env:SUPABASE_DB_URL = "postgresql://postgres.<ref>:<PAROL>@aws-0-<region>.pooler.supabase.com:5432/postgres"
npm run db:baseline
```

Yoki Supabase SQL Editor'da `generate_baseline.sql` ni ishga tushirib, natija
katagini `000_baseline_schema.sql` ga saqlang.

Generator faqat o'qiydi (`BEGIN READ ONLY`). U PGlite'da aylanma sinovdan
o'tgan: chiqarilgan DDL bo'sh bazaga qo'llansa, qayta chiqarilgan DDL aynan
bir xil bo'ladi, funksiyalar va ustun huquqlari saqlanadi.
