# Lumen — Apps

Each subdirectory is a full-stack tool in the Lumen ecosystem.
All require their own server deployment (Railway recommended — configs included).

| Tool     | Stack                          | Deploy status |
|----------|-------------------------------|---------------|
| liminal  | Next.js 14 + PostgreSQL + AI  | Configure Railway |
| praxis   | Vite/React + Express + SQLite | Configure Railway |
| axiom    | Vite/React + Express + SQLite | Configure Railway |

## To deploy each app to Railway

1. `railway link` inside the app directory
2. Set environment variables (see each app's `.env.example`)
3. `railway up`

Once deployed, update the card URLs in `/index.html` (search for `TOOL_URL_LIMINAL` etc).

## Development

All sub-apps live under `apps/`. This monorepo is the single source of truth.
Future development should happen here, not in the standalone repos.
