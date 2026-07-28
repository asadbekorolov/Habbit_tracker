-- Migration 038: Admin Monitoring — DAU "0" va "Eng ommabop odatlar"
-- "Hali ma'lumot yo'q" ko'rsatishi
--
-- Bu ikkala ko'rsatkich ham `get_admin_monitoring_stats()` RPC orqali
-- keladi (005-migratsiya). Kod tomonida `AdminPanel.tsx`ning
-- `loadMonitoring()` funksiyasi RPC xato bersa uni faqat konsolga
-- yozib, foydalanuvchiga HECH QANDAY xato ko'rsatmas edi (endi bu ham
-- tuzatildi) — shu sabab RPC/ustun umuman mavjud bo'lmasa ham, ekranda
-- shunchaki "0" va "Hali ma'lumot yo'q" chiqib, aslida nima
-- bo'layotgani ko'rinmas edi. Bu — shu sessiyada bir necha marta
-- uchragan "migratsiya fayli yozilgan, lekin Supabase SQL Editor'da
-- hech qachon ishga tushirilmagan" holatiga juda o'xshaydi, shuning
-- uchun 005dagi obyektlarni shu yerda xavfsiz (IF NOT EXISTS / CREATE
-- OR REPLACE) qaytadan tasdiqlaymiz.
--
-- Bitta haqiqiy yaxshilash ham qo'shildi: "Eng ommabop 5 ta odat" avval
-- BUTUN TARIX bo'yicha (hech qanday sana chegarasisiz) hisoblanardi —
-- bu "hozir ommabop" emas, balki "hamma vaqt eng ko'p yozilgan"
-- ko'rsatkich edi. Endi so'nggi 30 kun bilan chegaralandi, shunda
-- ko'rsatkich haqiqatan ham joriy faollikni aks ettiradi.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at ON profiles(last_seen_at);

CREATE OR REPLACE FUNCTION touch_last_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET last_seen_at = now() WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION touch_last_seen() TO authenticated;

CREATE OR REPLACE FUNCTION get_admin_monitoring_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dau integer;
  v_top_habits json;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Faqat sayt admini bu amalni bajara oladi';
  END IF;

  SELECT COUNT(*) INTO v_dau
  FROM profiles
  WHERE last_seen_at >= now() - interval '24 hours';

  SELECT COALESCE(json_agg(t), '[]'::json) INTO v_top_habits
  FROM (
    SELECT h.name, COUNT(*) AS completions
    FROM habit_logs hl
    JOIN habits h ON h.id = hl.habit_id
    WHERE hl.completed = true
      AND hl.log_date >= (CURRENT_DATE - INTERVAL '30 days')
    GROUP BY h.name
    ORDER BY COUNT(*) DESC
    LIMIT 5
  ) t;

  RETURN json_build_object('dau', v_dau, 'top_habits', v_top_habits);
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_monitoring_stats() TO authenticated;
