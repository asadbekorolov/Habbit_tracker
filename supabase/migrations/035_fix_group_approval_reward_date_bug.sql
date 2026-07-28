-- Migration 035: Guruh odatini tasdiqlaganda ball/tanga/XP berilmay qolish bug'i
--
-- Muammo: approve_group_log() mukofot (ball/tanga/XP) berish shartiga
-- "v_log_date = CURRENT_DATE" qo'shgan edi — ya'ni faqat bajarilgan sana
-- SERVERNING BUGUNGI kuni bilan aynan bir xil bo'lsagina mukofot beriladi.
-- Bu ikki holatda noto'g'ri ishlaydi:
--
--   1) Vaqt zonasi: Supabase Postgres CURRENT_DATE odatda UTC bo'yicha
--      hisoblanadi, lekin foydalanuvchining kunlik sanasi (log_date)
--      brauzerda MAHALLIY vaqt bo'yicha hisoblanadi (masalan Toshkent,
--      UTC+5). Har kecha soat 00:00–05:00 (mahalliy) oralig'ida bu
--      ikkisi bir-biriga to'g'ri kelmaydi — foydalanuvchi uchun "bugun"
--      bo'lgan bajarilish serverga ko'ra "kecha" bo'lib chiqadi.
--
--   2) Tasdiqlash kechikishi: a'zo odatni bajarib isbot yuboradi, lekin
--      admin/sardor uni FAQAT ERTASI KUNI tasdiqlaydi (band bo'lgani
--      uchun, yoki tunda). Bu — mutlaqo qonuniy holat, orqaga sanani
--      "firibgarlik" qilish emas, chunki logGroupHabit() a'zoning
--      qaysidir o'tmish sanasini tanlashiga umuman yo'l qo'ymaydi (u
--      har doim faqat "bugun" uchun yoziladi). Demak orqaga sana
--      qo'yib firibgarlik qilish YO'LI guruh oqimida umuman mavjud
--      emas — bu tekshiruv shaxsiy "Kunlik Jurnal"dagi (o'tmish
--      kunlarni ham belgilash mumkin bo'lgan) tizimdan ko'chirilgan,
--      lekin u yerdagi xavf bu yerda yo'q.
--
-- Natijada: a'zo hech qanday xato qilmasa ham, ko'p hollarda tasdiqlash
-- "muvaffaqiyatli" ko'rinadi (belgi yashil bo'ladi), lekin ball/tanga/XP
-- HECH QACHON berilmaydi.
--
-- Yechim: "v_log_date = CURRENT_DATE" shartini olib tashlaymiz. Qayta
-- mukofotlashdan himoya endi ham to'liq ishlaydi — chunki u
-- COALESCE(v_prev_completed, false) = false orqali ta'minlanadi (bog'langan
-- shaxsiy habit_logs qatori ALLAQACHON completed=true bo'lsa, qayta
-- mukofot berilmaydi) — sana tekshiruviga bog'liq emas.

CREATE OR REPLACE FUNCTION approve_group_log(p_log_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_group_habit_id uuid;
  v_member_id uuid;
  v_log_date date;
  v_reps integer;
  v_is_site_admin boolean;
  v_habit_type text;
  v_linked_habit_id uuid;
  v_prev_completed boolean;
  v_safe_xp integer;
BEGIN
  SELECT ghl.group_id, ghl.group_habit_id, ghl.user_id, ghl.log_date, ghl.reps, gh.type
    INTO v_group_id, v_group_habit_id, v_member_id, v_log_date, v_reps, v_habit_type
  FROM group_habit_logs ghl
  JOIN group_habits gh ON gh.id = ghl.group_habit_id
  WHERE ghl.id = p_log_id;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Log topilmadi';
  END IF;

  SELECT is_admin INTO v_is_site_admin FROM profiles WHERE id = auth.uid();

  IF NOT is_group_admin(v_group_id, auth.uid()) AND NOT COALESCE(v_is_site_admin, false) THEN
    RAISE EXCEPTION 'Faqat guruh sardori yoki sayt admini tasdiqlashi mumkin';
  END IF;

  UPDATE group_habit_logs
  SET approval_status = 'approved', approved_by = auth.uid(), approved_at = now()
  WHERE id = p_log_id;

  SELECT habit_id INTO v_linked_habit_id
  FROM group_habit_links WHERE group_habit_id = v_group_habit_id AND user_id = v_member_id;

  IF v_linked_habit_id IS NOT NULL THEN
    SELECT completed INTO v_prev_completed
    FROM habit_logs WHERE habit_id = v_linked_habit_id AND user_id = v_member_id AND log_date = v_log_date;

    INSERT INTO habit_logs (habit_id, user_id, log_date, completed, value)
    VALUES (v_linked_habit_id, v_member_id, v_log_date, true, GREATEST(1, COALESCE(v_reps, 1)))
    ON CONFLICT (habit_id, user_id, log_date)
    DO UPDATE SET completed = true, value = GREATEST(1, COALESCE(v_reps, 1));

    -- Mukofot: faqat salbiy bo'lmagan VA shu bajarilish uchun ilgari
    -- hali mukofot berilmagan bo'lsa (v_prev_completed = false). Sana
    -- CURRENT_DATE bilan solishtirilmaydi — tasdiqlash bir necha kun
    -- kechiksa ham, haqiqiy bajarilish uchun mukofot berilishi kerak.
    IF v_habit_type IS DISTINCT FROM 'negative' AND COALESCE(v_prev_completed, false) = false THEN
      UPDATE profiles SET score = COALESCE(score, 0) + 1, coins = COALESCE(coins, 0) + 1 WHERE id = v_member_id;

      UPDATE habit_logs SET xp_awarded = true
      WHERE habit_id = v_linked_habit_id AND user_id = v_member_id AND log_date = v_log_date AND xp_awarded = false;
      IF FOUND THEN
        v_safe_xp := 10;
        UPDATE profiles
        SET total_xp = total_xp + v_safe_xp, current_level = calculate_level(total_xp + v_safe_xp)
        WHERE id = v_member_id;
      END IF;
    END IF;
  END IF;
END;
$$;

-- ── Tuzatish: eski (buglik) funksiya sabab mukofotsiz qolgan
--    ALLAQACHON tasdiqlangan loglarni bir martalik "to'ldirish" ──
-- Har bir tasdiqlangan (approved/auto), salbiy bo'lmagan guruh logi uchun:
-- bog'langan shaxsiy habit_logs qatori completed=true bo'lsa-yu, hali XP
-- berilmagan bo'lsa (xp_awarded=false) — endi beramiz.
DO $$
DECLARE
  v_row RECORD;
BEGIN
  FOR v_row IN
    SELECT ghl.user_id, hl.habit_id, hl.log_date
    FROM group_habit_logs ghl
    JOIN group_habits gh ON gh.id = ghl.group_habit_id
    JOIN group_habit_links gl ON gl.group_habit_id = ghl.group_habit_id AND gl.user_id = ghl.user_id
    JOIN habit_logs hl ON hl.habit_id = gl.habit_id AND hl.user_id = ghl.user_id AND hl.log_date = ghl.log_date
    WHERE ghl.approval_status IN ('approved', 'auto')
      AND gh.type IS DISTINCT FROM 'negative'
      AND hl.completed = true
      AND hl.xp_awarded = false
  LOOP
    UPDATE profiles SET score = COALESCE(score, 0) + 1, coins = COALESCE(coins, 0) + 1 WHERE id = v_row.user_id;

    UPDATE habit_logs SET xp_awarded = true
    WHERE habit_id = v_row.habit_id AND user_id = v_row.user_id AND log_date = v_row.log_date AND xp_awarded = false;

    IF FOUND THEN
      UPDATE profiles
      SET total_xp = total_xp + 10, current_level = calculate_level(total_xp + 10)
      WHERE id = v_row.user_id;
    END IF;
  END LOOP;
END $$;
