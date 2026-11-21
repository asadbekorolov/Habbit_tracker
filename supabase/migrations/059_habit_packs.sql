-- ============================================================================
-- 059: Odatlar to'plamini ulashish (habit packs)
--
-- Foydalanuvchi o'z odatlaridan tanlab to'plam yaratadi (kod bilan), do'sti
-- kod orqali ko'radi va tanlaganlarini o'ziga MUSTAQIL nusxa qilib oladi.
--
-- items — faqat odat sozlamalari: name, emoji (ikonka kaliti), type,
--   target_value, unit, days_of_week, scheduled_start, scheduled_end.
--   Loglar, zanjirlar, izoh (description) va id'lar kiritilmaydi.
-- habit_packs — RLS: egasi o'z to'plamlarini ko'radi va o'chiradi; yaratish
--   faqat create_habit_pack orqali (odatlar haqiqatan egasiniki ekanini
--   server tekshiradi); boshqalar faqat get_habit_pack(kod) orqali o'qiydi.
-- habit_pack_imports — kim qaysi to'plamni olgan (imports_count bir
--   foydalanuvchi uchun bir marta oshadi). Mijozga yopiq.
--
-- Qayta ishga tushirishga chidamli.
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.habit_packs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text NOT NULL UNIQUE,
  creator_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title          text NOT NULL,
  items          jsonb NOT NULL,
  imports_count  integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT habit_packs_code_format CHECK (code ~ '^[A-Z0-9]{6,8}$'),
  CONSTRAINT habit_packs_title_len CHECK (char_length(btrim(title)) BETWEEN 1 AND 80),
  CONSTRAINT habit_packs_items_array CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) BETWEEN 1 AND 30)
);
CREATE INDEX IF NOT EXISTS idx_habit_packs_creator ON public.habit_packs (creator_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.habit_pack_imports (
  pack_id      uuid NOT NULL REFERENCES public.habit_packs(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  imported_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pack_id, user_id)
);

ALTER TABLE public.habit_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_pack_imports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.habit_packs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.habit_pack_imports FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.habit_packs TO authenticated;

DROP POLICY IF EXISTS habit_packs_select_own ON public.habit_packs;
DROP POLICY IF EXISTS habit_packs_delete_own ON public.habit_packs;
CREATE POLICY habit_packs_select_own ON public.habit_packs
  FOR SELECT TO authenticated USING (creator_id = auth.uid());
CREATE POLICY habit_packs_delete_own ON public.habit_packs
  FOR DELETE TO authenticated USING (creator_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Kod generatori (taklif kodi bilan bir xil alifbo: 0/O, 1/I/L yo'q)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._generate_habit_pack_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_alphabet CONSTANT text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code     text;
  i          integer;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..7 LOOP
      v_code := v_code || substr(c_alphabet, 1 + floor(random() * length(c_alphabet))::integer, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM habit_packs WHERE code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

-- ----------------------------------------------------------------------------
-- To'plam yaratish
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_habit_pack(p_title text, p_habit_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_max_items  CONSTANT integer := 30;
  c_daily_cap  CONSTANT integer := 20;
  v_uid        uuid := auth.uid();
  v_title      text := btrim(COALESCE(p_title, ''));
  v_ids        uuid[];
  v_items      jsonb;
  v_code       text;
  v_id         uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF COALESCE((SELECT is_banned FROM profiles WHERE id = v_uid), false) THEN
    RAISE EXCEPTION 'banned';
  END IF;
  IF char_length(v_title) < 1 OR char_length(v_title) > 80 THEN
    RAISE EXCEPTION 'invalid_title';
  END IF;

  -- Takrorlarsiz, tanlangan tartibda
  SELECT array_agg(x ORDER BY first_pos)
    INTO v_ids
    FROM (SELECT x, min(pos) AS first_pos
            FROM unnest(COALESCE(p_habit_ids, '{}'::uuid[])) WITH ORDINALITY AS t(x, pos)
           WHERE x IS NOT NULL
           GROUP BY x) d;

  IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
    RAISE EXCEPTION 'no_habits';
  END IF;
  IF cardinality(v_ids) > c_max_items THEN
    RAISE EXCEPTION 'too_many_habits';
  END IF;
  IF (SELECT count(*) FROM habits WHERE id = ANY (v_ids) AND user_id = v_uid) <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'habit_not_owned';
  END IF;
  IF (SELECT count(*) FROM habit_packs WHERE creator_id = v_uid AND created_at > now() - interval '1 day') >= c_daily_cap THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  SELECT jsonb_agg(
           jsonb_build_object(
             'name', h.name,
             'emoji', h.emoji,
             'type', h.type,
             'target_value', COALESCE(h.target_value, 1),
             'unit', COALESCE(h.unit, ''),
             'days_of_week', to_jsonb(COALESCE(h.days_of_week, ARRAY[1, 2, 3, 4, 5, 6, 7])),
             'scheduled_start', h.scheduled_start,
             'scheduled_end', h.scheduled_end
           )
           ORDER BY array_position(v_ids, h.id))
    INTO v_items
    FROM habits h
   WHERE h.id = ANY (v_ids) AND h.user_id = v_uid;

  v_code := _generate_habit_pack_code();
  INSERT INTO habit_packs (code, creator_id, title, items)
  VALUES (v_code, v_uid, v_title, v_items)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'code', v_code, 'count', jsonb_array_length(v_items));
END;
$$;

-- ----------------------------------------------------------------------------
-- Kod bo'yicha ko'rish (shaxsiy ma'lumotlarsiz)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_habit_pack(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_code text := upper(btrim(COALESCE(p_code, '')));
  v_pack record;
  v_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF v_code !~ '^[A-Z0-9]{6,8}$' THEN
    RAISE EXCEPTION 'pack_not_found';
  END IF;

  SELECT p.*, pr.full_name, pr.display_name, pr.username
    INTO v_pack
    FROM habit_packs p
    JOIN profiles pr ON pr.id = p.creator_id
   WHERE p.code = v_code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pack_not_found';
  END IF;

  -- utils/publicName.ts bilan bir xil: to'liq ism, display_name, @username
  v_name := COALESCE(NULLIF(btrim(v_pack.full_name), ''),
                     NULLIF(btrim(v_pack.display_name), ''),
                     '@' || v_pack.username);

  RETURN jsonb_build_object(
    'code', v_pack.code,
    'title', v_pack.title,
    'creator_name', v_name,
    'items', v_pack.items,
    'imports_count', v_pack.imports_count,
    'created_at', v_pack.created_at,
    'is_own', v_pack.creator_id = v_uid
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- Tanlangan odatlarni o'ziga nusxalash
-- p_selected_indices — items ichidagi 0 dan boshlanuvchi tartib raqamlari;
-- NULL — hammasi.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_habit_pack(p_code text, p_selected_indices integer[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_code     text := upper(btrim(COALESCE(p_code, '')));
  v_pack     record;
  v_len      integer;
  v_idx      integer[];
  v_item     jsonb;
  v_i        integer;
  v_type     text;
  v_days     integer[];
  v_new_id   uuid;
  v_new_ids  uuid[] := '{}';
  v_first    boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF COALESCE((SELECT is_banned FROM profiles WHERE id = v_uid), false) THEN
    RAISE EXCEPTION 'banned';
  END IF;
  IF v_code !~ '^[A-Z0-9]{6,8}$' THEN
    RAISE EXCEPTION 'pack_not_found';
  END IF;

  SELECT id, creator_id, items INTO v_pack FROM habit_packs WHERE code = v_code FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pack_not_found';
  END IF;
  IF v_pack.creator_id = v_uid THEN
    RAISE EXCEPTION 'own_pack';
  END IF;

  v_len := jsonb_array_length(v_pack.items);
  IF p_selected_indices IS NULL THEN
    SELECT array_agg(g ORDER BY g) INTO v_idx FROM generate_series(0, v_len - 1) g;
  ELSE
    SELECT array_agg(DISTINCT x ORDER BY x) INTO v_idx FROM unnest(p_selected_indices) x WHERE x IS NOT NULL;
  END IF;
  IF v_idx IS NULL OR cardinality(v_idx) = 0 THEN
    RAISE EXCEPTION 'no_habits';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_idx) x WHERE x < 0 OR x >= v_len) THEN
    RAISE EXCEPTION 'invalid_selection';
  END IF;

  FOREACH v_i IN ARRAY v_idx LOOP
    v_item := v_pack.items -> v_i;
    v_type := CASE WHEN v_item ->> 'type' = 'negative' THEN 'negative' ELSE 'positive' END;

    SELECT array_agg(DISTINCT d ORDER BY d)
      INTO v_days
      FROM (SELECT (e)::integer AS d
              FROM jsonb_array_elements_text(COALESCE(v_item -> 'days_of_week', '[]'::jsonb)) e
             WHERE e ~ '^[1-7]$') s;
    IF v_days IS NULL THEN
      v_days := ARRAY[1, 2, 3, 4, 5, 6, 7];
    END IF;

    INSERT INTO habits (user_id, name, emoji, type, target_value, unit, days_of_week, scheduled_start, scheduled_end)
    VALUES (
      v_uid,
      left(btrim(COALESCE(v_item ->> 'name', '')), 100),
      left(COALESCE(v_item ->> 'emoji', ''), 32),
      v_type,
      LEAST(GREATEST(COALESCE((v_item ->> 'target_value')::integer, 1), 1), 100000),
      left(COALESCE(v_item ->> 'unit', ''), 20),
      v_days,
      NULLIF(v_item ->> 'scheduled_start', '')::time,
      NULLIF(v_item ->> 'scheduled_end', '')::time
    )
    RETURNING id INTO v_new_id;
    v_new_ids := v_new_ids || v_new_id;
  END LOOP;

  INSERT INTO habit_pack_imports (pack_id, user_id) VALUES (v_pack.id, v_uid)
  ON CONFLICT (pack_id, user_id) DO NOTHING;
  GET DIAGNOSTICS v_i = ROW_COUNT;
  v_first := v_i > 0;
  IF v_first THEN
    UPDATE habit_packs SET imports_count = imports_count + 1 WHERE id = v_pack.id;
  END IF;

  RETURN jsonb_build_object('imported', cardinality(v_new_ids), 'habit_ids', to_jsonb(v_new_ids));
END;
$$;

REVOKE EXECUTE ON FUNCTION public._generate_habit_pack_code()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_habit_pack(text, uuid[])          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_habit_pack(text)                     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.import_habit_pack(text, integer[])       FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_habit_pack(text, uuid[])          TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_habit_pack(text)                     TO authenticated;
GRANT  EXECUTE ON FUNCTION public.import_habit_pack(text, integer[])       TO authenticated;

COMMIT;
