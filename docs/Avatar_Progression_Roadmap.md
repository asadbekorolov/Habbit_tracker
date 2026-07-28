# Procedural Avatar Progression — Texnik Roadmap

**Holati:** Kechiktirilgan (postponed) — asosiy e'tibor core stability va admin xavfsizligiga qaratilgan. Bu hujjat g'oyani kelajakda amalga oshirish uchun arxivlaydi.

---

## Konsept

Foydalanuvchi ro'yxatdan o'tishda o'zining jismoniy ko'rsatkichlarini (bo'y, vazn va h.k.) kiritadi va shundan kelib chiqqan holda shaxsiy 3D avatar (persona) yaratiladi. Bu avatar keyinchalik foydalanuvchining kunlik odat bajarish ma'lumotlariga (habit_logs) qarab vaqt o'tishi bilan **rivojlanadi va o'zgaradi** — sport odatlari mushak massasini oshiradi, bilim/o'qish odatlari "aql nuri" (intellect glow) effektini kuchaytiradi va hokazo. Maqsad — mavhum "ball"/"daraja" tizimidan tashqari, foydalanuvchi o'z taraqqiyotini **vizual, shaxsiylashtirilgan** tarzda ko'rishi.

## Mexanika

- **XP va Daraja tizimi**: mavjud `score`/`getLevel()` tizimiga parallel yoki uni kengaytiruvchi alohida XP hisoblagichi — har bir tasdiqlangan ijobiy odat uchun XP beriladi.
- **Morfologik o'zgarishlar**: daraja oshgani sayin avatar modelida ko'rinadigan o'zgarishlar (masalan, "Barqaror" darajasida mushak hajmi ortadi, "Chempion" darajasida maxsus vizual effekt — porlash, aura va h.k. qo'shiladi).
- Har bir toifadagi odat (jismoniy, bilim, ijtimoiy) avatarning tegishli morfologik parametriga alohida ta'sir qilishi mumkin (masalan sport → mushak, o'qish → "aql nuri").

## Texnologik yondashuv (variantlar)

- **Three.js / React Three Fiber** — brauzerda 3D render qilish uchun asosiy kutubxona nomzodi (React ekotizimiga mos, mavjud Vite+React stack bilan integratsiya qilish nisbatan sodda).
- **Blender GLTF/GLB modellar** — avatar bazaviy 3D modellari Blender'da tayyorlanadi va `.glb` formatida eksport qilinadi (veb uchun standart, kichik hajm).
- **Morph Targets (blend shapes)** — bitta bazaviy modelning turli morfologik holatlar (ozg'in/mushakli, past/yuqori daraja) orasida silliq interpolatsiya qilish uchun ishlatiladi — bu alohida-alohida to'liq modellar yaratishdan ko'ra samaraliroq.

## Bosqichlar (Phases)

### Phase 1 — XP & Leveling Engine

- Mavjud ball tizimidan mustaqil yoki unga bog'liq XP hisoblash mantig'ini loyihalash
- Backend: XP saqlash uchun sxema (yangi ustun/jadval), daraja chegaralarini aniqlash
- Frontend: XP progress UI (hozirgi `getLevel()`/level-bar tizimiga o'xshash, lekin avatar-yo'naltirilgan)

### Phase 2 — 3D Model Integration & Avatar Engine

- Bazaviy avatar modelini Blender'da yaratish va GLB sifatida eksport qilish
- React Three Fiber orqali modelni ilovaga integratsiya qilish
- Morph target'larni XP/daraja qiymatlariga bog'lash (daraja oshganda model asta-sekin yoki bosqichma-bosqich o'zgaradi)
- Ishlash (performance) testlari — mobil qurilmalarda 3D render og'irlik qilishi mumkin, shuning uchun past-poly modellar va fallback (statik rasm) rejimi ko'rib chiqilishi kerak

### Phase 3 — Marketplace & Visual Cosmetics

- Tanga (coin) tizimi orqali (mavjud Coin Shop bilan integratsiya) qo'shimcha vizual buyumlar — kiyim, aksessuar, maxsus effektlar sotib olish imkoniyati
- Bu qism mavjud gamifikatsiya (coin shop, streak freeze) arxitekturasi bilan tabiiy bog'lanadi

---

## Ochiq savollar (kelajakda hal qilinishi kerak)

- Mobil qurilmalarda 3D render ishlashi va batareya sarfi — real qurilmalarda profiling talab qilinadi
- Bazaviy avatar yaratish uchun jismoniy ko'rsatkichlar (bo'y/vazn) qanchalik sensitive ma'lumot sifatida saqlanishi va RLS bilan himoyalanishi kerak
- Bir nechta 3D model variantini saqlash/yuklash CDN/Storage xarajatlariga ta'siri
