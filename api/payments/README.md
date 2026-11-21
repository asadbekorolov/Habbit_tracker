# To'lovlar (Click / Payme)

Narx va tanga soni faqat serverda (`coin_packs`, migratsiya 049). Mijoz faqat
`pack_id` va to'lov tizimini yuboradi; tanga faqat callback tasdig'idan keyin,
`credit_payment()` orqali (idempotent) qo'shiladi.

## Vercel env

| O'zgaruvchi | Qayerdan |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (allaqachon kerak) |
| `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY` | Click merchant kabineti |
| `PAYME_MERCHANT_ID`, `PAYME_KEY` | Payme biznes kabineti (KEY — kassa kaliti) |
| `APP_PUBLIC_URL` (ixtiyoriy) | To'lovdan qaytish sayti, standart: habit-tracker-asadbek.vercel.app. `.uz` domen ulanganda shu domenga o'rnating (`docs/DOMAIN.md`) |

Biror tizim kalitlari kiritilmagan bo'lsa, `create-invoice` 503
`payments_not_configured` qaytaradi va ilova "To'lovlar tez kunda ishga
tushadi" deydi — hech qanday havola ochilmaydi.

## Kabinetlarga yoziladigan manzillar

- Click: Prepare URL va Complete URL — `https://<sayt>/api/payments/click-callback`
- Payme: Endpoint URL — `https://<sayt>/api/payments/payme-callback`, hisob maydoni `order_id`

## Endpoint'lar

- `POST /api/payments/create-invoice` — JWT talab qilinadi; tranzaksiya yaratib checkout havolasini qaytaradi
- `POST /api/payments/click-callback` — Click SHOP API (imzo md5 bilan tekshiriladi)
- `POST /api/payments/payme-callback` — Payme Merchant API (Basic auth `Paycom:<PAYME_KEY>`)

Protokol mantiqi `_lib/click.ts` va `_lib/payme.ts` da, `tests/payments.test.ts` bilan qoplangan.
