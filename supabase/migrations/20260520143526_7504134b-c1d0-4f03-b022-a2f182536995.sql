
-- Make legacy required cols nullable & add new fields
ALTER TABLE public.workouts ALTER COLUMN goal DROP NOT NULL;
ALTER TABLE public.workouts ALTER COLUMN level DROP NOT NULL;
ALTER TABLE public.workouts ALTER COLUMN days_per_week DROP NOT NULL;
ALTER TABLE public.workouts ALTER COLUMN equipment DROP NOT NULL;

ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS anamnesis jsonb;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS weeks integer;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS title text;

-- Session completion tracking
CREATE TABLE IF NOT EXISTS public.session_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workout_id uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  day_number integer NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workout_id, week_number, day_number)
);

ALTER TABLE public.session_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own completions" ON public.session_completions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own completions" ON public.session_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own completions" ON public.session_completions
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_session_completions_workout ON public.session_completions(workout_id);
