-- Add type column to distinguish tasks (due date) vs events (start/end)
-- Run in Supabase SQL editor if your events table doesn't have this column yet.
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS type text; -- 'event' | 'task'; null = legacy
