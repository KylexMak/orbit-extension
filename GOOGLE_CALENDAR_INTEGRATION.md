# Google Calendar API Integration - Implementation Guide

## Overview
This document describes the Google Calendar and Google Tasks API integration implemented for the Orbit Chrome Extension.

## Changes Made

### 1. OAuth Scopes Update
**Files Modified:** 
- `src/App.tsx`
- `public/manifest.json`

**Changes:**
- Updated OAuth scopes to include both `calendar.events` and `tasks` scopes
- Added `host_permissions` for Google APIs in manifest
- Improved error handling in auth flow

### 2. Google Calendar API Enhancement
**File Modified:** `src/lib/googleCalendar.ts`

**New Features:**
- `getTasks()` - Fetches Google Tasks from user's task lists
- `updateEvent()` - Updates existing calendar events (for move functionality)
- `deleteEvent()` - Deletes calendar events
- `insertWellnessBreaks()` - Automatically inserts "Time to Eat and Breathe" breaks

**Improvements:**
- All API functions now throw errors instead of returning null for better error handling
- `createEvent()` now supports optional description parameter
- Added proper error messages from Google API responses

### 3. Event Model Enhancement
**File Modified:** `src/lib/scheduleUtils.ts`

**New Fields:**
- `description?: string` - Event descriptions
- `type?: 'event' | 'break' | 'task'` - Differentiates between calendar events, breaks, and tasks
- `google_calendar_id?: string` - Tracks Google Calendar event ID
- `google_task_id?: string` - Tracks Google Task ID

### 4. Hook Enhancement
**File Modified:** `src/hooks/useOrbitEvents.ts`

**New Functions:**
- `updateEvent()` - Updates events with new time/title/description
- `deleteEvent()` - Deletes events from Supabase

**Improvements:**
- `addEvent()` now supports description and Google Calendar ID parameters
- Better type safety with Record<string, string> instead of any

### 5. UI Enhancement
**File Modified:** `src/views/Home.tsx`

**New Features:**
- Google Tasks integration - fetches and displays tasks
- Enhanced "Add Event" form with:
  - Description field
  - Start time picker
  - End time picker
- Wellness breaks button to automatically insert breaks
- Visual indicators for event types (Calendar 📅, Task ✓, Clock 🕐)
- Event descriptions displayed in UI
- Move functionality syncs with Google Calendar

**Improvements:**
- Events are now categorized and displayed with icons
- Better handling of time inputs with intelligent defaults
- Bidirectional sync: Updates to events sync back to Google Calendar

### 6. Database Schema
**New File:** `schema-migration-google-sync.sql`

**Changes:**
- Adds `description` column to events table
- Adds `google_calendar_id` column for tracking Google Calendar events
- Adds `google_task_id` column for tracking Google Tasks
- Creates indexes for better query performance

## Setup Instructions

### 1. Update Supabase Database
Run the SQL migration in your Supabase SQL Editor:
```bash
# Execute the contents of schema-migration-google-sync.sql
```

### 2. Configure Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable the following APIs:
   - Google Calendar API
   - Google Tasks API
4. Configure OAuth consent screen
5. Add the following scopes:
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/tasks`
6. Get your Chrome Extension ID (it will be in format: `chrome-extension://YOUR_EXTENSION_ID/`)
7. Add redirect URL in Supabase: `https://YOUR_EXTENSION_ID.chromiumapp.org/`

### 3. Build and Install
```bash
npm install
npm run build
```

Load the `dist` folder as an unpacked extension in Chrome.

## Features Implemented

### ✅ Fixed Google Calendar API Integration
- OAuth2 flow with proper scopes
- Error handling and retry logic
- Support for both calendar events and tasks

### ✅ Feature Implementation
- Display Google Calendar events with 📅 icon
- Display Google Tasks with ✓ icon
- Event creation with end times and descriptions
- "Time to Eat and Breathe" automation
- Move/reschedule functionality with Google Calendar sync

### ✅ Data Synchronization
- Events created in Orbit sync to Google Calendar
- Events moved in Orbit update in Google Calendar
- Google Calendar events and tasks are fetched and displayed
- Supabase events table tracks Google Calendar/Task IDs

## Usage

### Creating Events
1. Click the "+" button
2. Enter event title, description, start time, and end time
3. Click "Add"
- Event is created in both Supabase and Google Calendar

### Moving Events
1. Click the "Skip & Reschedule" button on any event
2. The event is rescheduled to the next available time slot
- If it's a Google Calendar event, it's updated there too

### Inserting Wellness Breaks
1. Click the "🌿" button
2. The system analyzes your calendar for gaps >= 30 minutes
3. Automatically inserts "Time to Eat and Breathe" breaks
- These are created as Google Calendar events

## API Reference

### Google Calendar API Endpoints Used
- `GET /calendar/v3/calendars/primary/events` - Fetch events
- `POST /calendar/v3/calendars/primary/events` - Create event
- `PUT /calendar/v3/calendars/primary/events/{eventId}` - Update event
- `DELETE /calendar/v3/calendars/primary/events/{eventId}` - Delete event

### Google Tasks API Endpoints Used
- `GET /tasks/v1/users/@me/lists` - Fetch task lists
- `GET /tasks/v1/lists/{listId}/tasks` - Fetch tasks

## Error Handling

All API functions now throw errors with descriptive messages:
- Network errors
- Authentication errors
- API quota errors
- Invalid request errors

These errors are caught and logged in the browser console.

## Known Limitations

1. **Task Scheduling**: Tasks without due dates are scheduled for 1 hour from now
2. **Single Task List**: Only fetches tasks from the primary task list
3. **Manual Refresh**: Google data is not automatically refreshed (requires page reload)
4. **No Conflict Resolution**: If events are modified in both places, last write wins

## Future Enhancements

1. Real-time sync using webhooks/push notifications
2. Support for multiple task lists
3. Conflict resolution for bidirectional sync
4. Recurring event support
5. Calendar event attendees and reminders
6. Task completion sync
7. Offline support with queue

## Testing

To test the implementation:

1. **Authentication**: Verify OAuth flow requests correct scopes
2. **Event Creation**: Create event and verify it appears in Google Calendar
3. **Event Move**: Move event and verify time updates in Google Calendar
4. **Tasks Display**: Verify Google Tasks appear in the UI
5. **Wellness Breaks**: Verify breaks are inserted in calendar gaps
6. **Error Handling**: Test with invalid tokens or network errors

## Troubleshooting

### Events not syncing
- Check Chrome console for API errors
- Verify OAuth scopes in Google Cloud Console
- Ensure provider_token is present in session

### "Failed to fetch" errors
- Check if Google Calendar/Tasks APIs are enabled
- Verify network connectivity
- Check API quotas in Google Cloud Console

### Extension ID mismatch
- Ensure the redirect URL in Supabase matches the extension ID
- The format is: `https://EXTENSION_ID.chromiumapp.org/`
