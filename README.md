# Project Pulse — Frontend

Next.js 16 (App Router) frontend for Project Pulse — AI-Native Fitness Concierge.

## Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS v4 (Tech-Noir Glassmorphism theme)
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Charts:** Recharts
- **State:** React hooks + IndexedDB (offline)

## Features

- **Multimodal Omnibar:** Text, camera (with compression), hold-to-speak audio
- **Photo + Caption:** Attach image preview, add optional caption, combined upload
- **Review Queue:** Tinder-style card stack with swipe gestures, edit modal, sponsor cards
- **Progress Rings:** Real-time calorie/protein/movement tracking
- **Dashboard:** Weight trend chart, consistency tracker, biometrics, AI coaching insight
- **Onboarding:** 3-step wizard (persona, preferences, goals)
- **Offline-First:** IndexedDB storage + automatic sync on reconnect
- **BYOK Settings:** Encrypted API key management
- **Health Sync:** Foreground visibility-based step/heart rate sync

## Setup

```bash
npm install
cp .env.local.example .env.local  # Fill in your values
npm run dev
```

Open http://localhost:3000

## Build

```bash
npm run build
npm start
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `NEXT_PUBLIC_BACKEND_URL` | FastAPI backend URL |
| `BACKEND_API_URL` | Backend URL for server-side routes |

## Project Structure

```
src/
├── app/
│   ├── page.tsx           # Main home stream + routing
│   ├── settings/page.tsx  # BYOK settings
│   ├── api/health/        # Frontend health check route
│   └── globals.css        # Design system tokens
├── components/
│   ├── Omnibar.tsx        # Multimodal input bar
│   ├── ReviewQueue.tsx    # Card stack + sponsor cards
│   ├── ParsedCards.tsx    # Food/workout/biometric cards
│   ├── ProgressRings.tsx  # SVG ring indicators
│   ├── Dashboard.tsx      # Analytics overlay
│   └── Onboarding.tsx     # Setup wizard
├── hooks/
│   └── useHealthSync.ts   # Foreground health sync
└── lib/
    ├── types.ts           # TypeScript interfaces
    ├── utils.ts           # cn() utility
    ├── supabase.ts        # Supabase client
    ├── indexedDb.ts       # Offline storage
    └── image-utils.ts     # Canvas compression
```

## Deployment

Deploy to Vercel with root directory set to `frontend`. See `DEPLOY.md` in the project root for full instructions.
