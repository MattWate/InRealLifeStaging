# IRL Network staging

Initial staging build for the IRL brand and operator onboarding journeys.

## Stack

- React 19 + TypeScript + Vite
- Netlify hosting and Functions
- Neon PostgreSQL
- GitHub deployment from `main`

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

Add the pooled Neon connection string as `DATABASE_URL` in Netlify. Do not expose it through a `VITE_` variable.

## Netlify

Build command: `npm run build`

Publish directory: `dist`

Database test endpoint after deployment:

```text
/.netlify/functions/db-health
```

## Current state

The first commit provides:

- Brand and operator journey selector
- Responsive guided onboarding shell
- Desktop step navigation and mobile progress treatment
- Progressive optional sections
- Multi-select choice controls
- Local browser autosave for early UX testing
- Review screen
- Neon connection health function

The next phase is to connect authenticated onboarding sessions to Neon and replace browser-only draft storage with server-side autosave.
