---
name: run-reltor
description: Build, run, and drive Reltor — the real-estate marketing SaaS (React + Vite client, Express API, PostgreSQL). Use when asked to start Reltor, launch the app, run the dev servers, take a screenshot of the UI, smoke-test it, or interact with the running app.
---

Reltor is a full-stack web app: an Express API (`server/`, port 4000) + a
React/Vite SPA (`client/`, port 5173, which proxies `/api` → 4000), backed by
PostgreSQL. You drive the running UI with a headless-Chromium **Playwright
driver** at `.claude/skills/run-reltor/driver.mjs` — it logs in with the seeded
demo account, walks every page, opens the campaign-builder modal, and writes
screenshots + a console-error report.

All paths below are relative to the repo root (`New-rep/`).

## Prerequisites

Already present in this container — no `apt-get` was needed:

- **Node 22** (`node -v`) — the app is ESM (`"type":"module"`).
- **PostgreSQL 16** server + client binaries at `/usr/lib/postgresql/16/bin`.
- **Playwright + Chromium** pre-installed at `/opt/pw-browsers` (the driver
  auto-detects `chromium-*/chrome-linux/chrome` and resolves the global
  `playwright` package itself). Confirm with `npm ls -g playwright`.

## Setup

Install all workspaces (root + server + client):

```bash
npm run install:all
```

Bring up PostgreSQL. **Docker isn't running in this container and `initdb`
refuses to run as root**, so start a throwaway cluster as the `postgres` user
on port 55432 (if you have a Docker daemon, `docker compose up -d db` on 5432
works too — then use that port below):

```bash
install -d -o postgres -g postgres /tmp/pgtest
su postgres -s /bin/bash -c '
  export PATH="/usr/lib/postgresql/16/bin:$PATH"
  [ -d /tmp/pgtest/data ] || initdb -D /tmp/pgtest/data -U postgres --auth=trust
  pg_ctl -D /tmp/pgtest/data -o "-p 55432 -k /tmp/pgtest" -l /tmp/pgtest/pg.log start
  sleep 3
  createdb -h 127.0.0.1 -p 55432 -U postgres reltor 2>/dev/null
  psql -h 127.0.0.1 -p 55432 -U postgres -d reltor -tAc "select 1"
'
```

Point `.env` at that database, then migrate + seed the demo agent
(`demo@reltor.app` / `demo1234`) with 48 contacts, 4 sent campaigns, social
posts, and a nurture sequence:

```bash
cp .env.example .env
sed -i 's#^DATABASE_URL=.*#DATABASE_URL=postgres://postgres@127.0.0.1:55432/reltor#' .env
sed -i 's#^JWT_SECRET=.*#JWT_SECRET=test-secret-for-local-verification-only#' .env
npm run db:migrate
npm run db:seed
```

Leaving `SENDGRID_API_KEY` / Meta tokens blank runs the app in **mock mode** —
emails and social posts are simulated so the whole flow works with no
credentials.

## Build

No build step for the agent path — the driver runs against the Vite **dev**
server. (`npm run build` compiles the client to `client/dist/` for production.)

## Run (agent path)

Start both servers in the background, wait for them to serve, then run the
driver:

```bash
mkdir -p /tmp/reltor-run
(npm run dev:server >/tmp/reltor-run/api.log 2>&1 &)
(npm run dev:client >/tmp/reltor-run/client.log 2>&1 &)
timeout 40 bash -c 'until curl -sf http://localhost:4000/api/health >/dev/null; do sleep 1; done'
timeout 40 bash -c 'until curl -sf http://localhost:5173 >/dev/null; do sleep 1; done'
node .claude/skills/run-reltor/driver.mjs
```

Expected tail:

```
✓ logged in — dashboard rendered
✓ dashboard  → /tmp/reltor-shots/dashboard.png
... (campaigns, sequences, social, contacts, analytics, pricing)
✓ builder    → /tmp/reltor-shots/campaign-builder.png (modal opened, name filled)
✓ no console errors — smoke passed
```

**Screenshots → `/tmp/reltor-shots/`.** Open them (e.g. `dashboard.png`,
`analytics.png`) to confirm real content rendered — a blank page or error
screen means the API/DB isn't wired up even if the driver "passed".

Driver env overrides: `BASE_URL` (default `http://localhost:5173`), `SHOT_DIR`
(default `/tmp/reltor-shots`), `EMAIL` / `PASSWORD`, `CHROME` (chromium path).

Stop everything:

```bash
pkill -f 'dev:server'; pkill -f 'dev:client'
su postgres -s /bin/bash -c 'PATH="/usr/lib/postgresql/16/bin:$PATH" pg_ctl -D /tmp/pgtest/data stop'
```

## Direct invocation (backend smoke, no browser)

Every API route is reachable with a Bearer token. Quick end-to-end check:

```bash
B=http://localhost:4000/api
TOK=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"demo@reltor.app","password":"demo1234"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
curl -s -H "Authorization: Bearer $TOK" $B/analytics/overview | python3 -m json.tool | head
# populate open/click analytics in mock mode:
curl -s -H "Authorization: Bearer $TOK" -X POST $B/analytics/simulate-engagement
```

## Run (human path)

`npm run dev` (root) runs API + client together via `concurrently`; open
http://localhost:5173 and log in with the pre-filled demo creds. Useless
headless — use the driver above instead.

## Test

No unit-test suite exists in this repo (`package.json` has no `test` script).
The driver above **is** the smoke test for the UI, and the Direct-invocation
block is the smoke test for the API.

## Gotchas

- **`initdb` refuses to run as root** — the container's default user. Run all
  Postgres commands as the `postgres` user (`su postgres -s /bin/bash -c '…'`),
  as shown in Setup.
- **Drive the Vite dev server (5173), not `vite preview`.** `vite.config.js`
  only sets `server.proxy` for `/api`; `preview` has no proxy, so a
  preview-served client can't reach the API.
- **ESM ignores `NODE_PATH`** for bare imports, so `NODE_PATH=$(npm root -g)
  node driver.mjs` fails with `ERR_MODULE_NOT_FOUND`. The driver sidesteps this
  by resolving `playwright` via `createRequire` against `npm root -g` and
  dynamic-importing by absolute path — just run `node driver.mjs`.
- **Mock mode analytics start empty for new campaigns.** Without a SendGrid
  webhook there are no real opens/clicks — hit `POST /api/analytics/simulate-engagement`
  (or the "Simulate opens & clicks" button on the dashboard) to populate them.
- **`text[]` columns need an explicit cast when combined with a literal
  default** — inserts use `COALESCE($n::text[], '{}')`. If you add a route that
  writes an array column and skip the `::text[]` cast, Postgres throws
  *"column is of type text[] but expression is of type text"*.
- **The scheduler runs every minute** (`node-cron`, started in
  `server/src/index.js`) — it sends due nurture steps, scheduled campaigns, and
  queued social posts. Watch `/tmp/reltor-run/api.log` for `[email:mock] ->`
  lines to see it fire.

## Troubleshooting

- **`EADDRINUSE` on 4000 or 5173**: a previous run is still up →
  `pkill -f 'dev:server'; pkill -f 'dev:client'` before relaunching.
- **Driver: `Could not locate the 'playwright' package`**: no global Playwright.
  Verify with `npm ls -g playwright`, or `npm install playwright` in the repo
  (the driver also checks local `node_modules`).
- **Login step times out (`waiting for selector "Emails Sent"`)**: the API or DB
  isn't ready. Check `/tmp/reltor-run/api.log`; re-run `npm run db:seed`; confirm
  `curl -s localhost:4000/api/health` returns `"ok":true`.
- **Screenshots render but are missing data**: `emailMockMode`/`socialMockMode`
  is expected (shown in `/api/health`); the *data* comes from the seed — re-run
  `npm run db:seed` if the demo account is empty.
