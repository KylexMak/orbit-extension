# Orbit - Time & Support

A supportive time management Chrome Extension for college students to manage their time and mental health.

## Features

- 🗓️ **Google Calendar Integration** - View and manage your Google Calendar events
- ✅ **Google Tasks Support** - See your tasks alongside calendar events
- 🌿 **Wellness Breaks** - Automatically insert "Time to Eat and Breathe" breaks
- 📱 **Smart Scheduling** - Intelligent event scheduling with conflict detection
- 💬 **Community Chat** - Connect with other students
- 🎯 **Focus Rooms** - Collaborative study spaces
- 🌅 **Beautiful UI** - Aurora-themed interface with smooth animations

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **APIs:** Google Calendar API, Google Tasks API, Google Gemini AI
- **Build:** Vite with Chrome Extension support

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase project
- Google Cloud Project with Calendar and Tasks APIs enabled
- Chrome browser for testing

### Installation

1. Clone the repository:
```bash
git clone https://github.com/KylexMak/orbit-extension.git
cd orbit-extension
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GEMINI_API_KEY=your_gemini_api_key
```

4. Set up the database:
   - Run `schema.sql` in your Supabase SQL Editor
   - Run `schema-migration-google-sync.sql` for Google Calendar sync

5. Configure Google OAuth:
   - Enable Google Calendar API and Google Tasks API
   - Configure OAuth consent screen
   - Add scopes: `calendar.events` and `tasks`
   - See `GOOGLE_CALENDAR_INTEGRATION.md` for detailed setup

### Development

```bash
npm run dev
```

Visit http://localhost:5173 to see the app.

### Build Extension

```bash
npm run build
```

The extension will be built to the `dist/` folder.

### Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` folder

## Project Structure

```
orbit-extension/
├── public/
│   ├── manifest.json      # Chrome extension manifest
│   ├── background.js      # Service worker for auth
│   └── orbit-icon.png     # Extension icon
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── ui/           # Base UI components (Button, Input, Card)
│   │   └── Layout.tsx    # Main app layout
│   ├── hooks/            # React hooks
│   │   └── useOrbitEvents.ts  # Event management hook
│   ├── lib/              # Utilities and integrations
│   │   ├── googleCalendar.ts  # Google Calendar/Tasks API
│   │   ├── supabaseClient.ts  # Supabase client
│   │   ├── scheduleUtils.ts   # Scheduling algorithms
│   │   └── utils.ts           # Helper functions
│   ├── views/            # Main app views
│   │   ├── Home.tsx      # Calendar and events view
│   │   ├── Chat.tsx      # Community chat
│   │   ├── Focus.tsx     # Focus rooms
│   │   └── Onboarding.tsx # User onboarding
│   ├── App.tsx           # Root component
│   └── main.tsx          # Entry point
├── schema.sql            # Database schema
├── schema-migration-google-sync.sql  # Google sync migration
└── GOOGLE_CALENDAR_INTEGRATION.md    # Integration guide
```

## Key Features Explained

### Google Calendar Integration

Orbit syncs with your Google Calendar to:
- Display upcoming events with 📅 icon
- Create new events directly to your calendar
- Update event times when you reschedule
- Show event descriptions and details

### Google Tasks Integration

Your Google Tasks appear in Orbit with:
- ✓ icon for easy identification
- Due date awareness
- Intelligent scheduling for tasks without due dates

### Wellness Breaks

Click the 🌿 button to automatically insert wellness breaks:
- Analyzes your calendar for gaps ≥30 minutes
- Creates "Time to Eat and Breathe" events
- Helps prevent burnout with regular breaks

### Smart Scheduling

When you "Skip & Reschedule" an event:
- Finds the next available time slot
- Avoids conflicts with existing events
- Respects your sleep schedule
- Updates both Supabase and Google Calendar

## Documentation

- **[GOOGLE_CALENDAR_INTEGRATION.md](GOOGLE_CALENDAR_INTEGRATION.md)** - Detailed guide for Google Calendar setup
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Technical implementation overview

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Browser Compatibility

- Chrome 88+ (Manifest V3 support required)
- Other Chromium-based browsers (Edge, Brave, etc.)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is private and proprietary.

## Support

For issues or questions, please open an issue on GitHub.

---

Built with ❤️ for college students by college students
