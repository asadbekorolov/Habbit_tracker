CREATE TABLE IF NOT EXISTS public.routines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    time_start TIME NOT NULL,
    time_end TIME NOT NULL,
    icon_name TEXT NOT NULL DEFAULT 'Sun',
    days_of_week INT[] NOT NULL DEFAULT '{1,2,3,4,5,6,7}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.routine_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
    habit_id UUID REFERENCES public.habits(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    order_index INT NOT NULL DEFAULT 0,
    is_completed_today BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage routines') THEN
        CREATE POLICY "Users can manage routines"
            ON public.routines FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage routine items') THEN
        CREATE POLICY "Users can manage routine items"
            ON public.routine_items FOR ALL
            USING (
                EXISTS (SELECT 1 FROM public.routines WHERE routines.id = routine_items.routine_id AND routines.user_id = auth.uid())
            )
            WITH CHECK (
                EXISTS (SELECT 1 FROM public.routines WHERE routines.id = routine_items.routine_id AND routines.user_id = auth.uid())
            );
    END IF;
END $$;
