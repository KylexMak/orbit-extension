-- Migration to add Google Calendar and Tasks sync support
-- Add this to your Supabase SQL editor to update the events table

-- Add new columns for Google Calendar and Tasks integration
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS google_calendar_id text,
ADD COLUMN IF NOT EXISTS google_task_id text;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_events_google_calendar_id ON public.events(google_calendar_id);
CREATE INDEX IF NOT EXISTS idx_events_google_task_id ON public.events(google_task_id);
