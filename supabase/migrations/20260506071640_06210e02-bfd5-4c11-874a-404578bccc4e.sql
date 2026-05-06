-- Convert source columns to text so custom sources (created in settings) can be stored
ALTER TABLE public.contacts ALTER COLUMN source DROP DEFAULT;
ALTER TABLE public.contacts ALTER COLUMN source TYPE text USING source::text;
ALTER TABLE public.contacts ALTER COLUMN source SET DEFAULT 'Manual';

ALTER TABLE public.deals ALTER COLUMN source DROP DEFAULT;
ALTER TABLE public.deals ALTER COLUMN source TYPE text USING source::text;
ALTER TABLE public.deals ALTER COLUMN source SET DEFAULT 'Manual';