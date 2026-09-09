# IRL Network staging

Staging application for the IRL public site, approved V03 brand onboarding, operator onboarding and protected administration tools.

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

## Database migrations

Apply the migrations relevant to the deployed features in this order:

1. `database/irl_brand_onboarding_v01.sql`
2. `database/irl_brand_onboarding_v03.sql`
3. `database/irl_admin_v01.sql`

The V03 migration is additive. It keeps the V01 fields and submissions while adding the approved V03 evidence, audience, placement, value and success structures.

Brand and operator drafts autosave locally and to Neon after an organisation name is entered. File upload storage and member account ownership remain future work.
