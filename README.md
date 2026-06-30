# 🏡 Reltor — Real Estate Marketing Automation

A fast, production-ready MVP of a marketing automation SaaS built for real
estate agents. Agents get a polished dashboard, an email campaign builder with
real-estate templates, a Facebook/Instagram post scheduler, a contact &
lead CRM, automated nurture sequences, and open/click analytics.

## ✨ Features

- **Dashboard** — campaigns, performance metrics, engagement trend, quick actions
- **Email campaign builder** — 3-step builder, real-estate templates (new
  listing, follow-up, open house, price drop, just sold, past client), live
  preview, audience segmentation, send-now or schedule
- **Nurture sequences** — multi-step automated drips with per-step delays,
  manual or stage-based enrollment, run by a background scheduler
- **Social scheduler** — queue posts to Facebook & Instagram, post now or schedule
- **Contacts & leads CRM** — store, tag, segment by lifecycle stage, CSV import
- **Analytics** — open rate, click rate, per-campaign performance, 14-day trend
- **Auth** — JWT email/password authentication
- **Pricing page** — Starter / Pro / Team plans (switch plan in-app)

## 🧱 Tech Stack

| Layer     | Tech                                              |
|-----------|---------------------------------------------------|
| Frontend  | React 18, React Router, Recharts, Vite            |
| Backend   | Node.js, Express                                  |
| Database  | PostgreSQL                                         |
| Email     | SendGrid (`@sendgrid/mail`) + event webhook       |
| Social    | Meta Graph API (Facebook Pages + Instagram)       |
| Scheduler | `node-cron` (sequences, scheduled campaigns/posts)|
| Auth      | JWT (`jsonwebtoken`) + `bcryptjs`                  |

### Mock mode
The app runs end-to-end **without any third-party credentials**. If
`SENDGRID_API_KEY` is unset, emails are simulated (logged) and a
"Simulate opens & clicks" button populates realistic analytics. If Meta tokens
are unset, social posts are mock-published. Add real keys in `.env` to go live.

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+
- PostgreSQL 14+ (or run `docker compose up -d db` to start one on `:5432`)

### 2. Install
```bash
npm run install:all
```

### 3. Configure
```bash
cp .env.example .env
# Edit DATABASE_URL / JWT_SECRET if needed. Leave SENDGRID/META blank for mock mode.
```

### 4. Create the database & seed demo data
```bash
docker compose up -d db      # optional: starts Postgres
npm run db:migrate
npm run db:seed              # creates demo@reltor.app / demo1234 with sample data
```

### 5. Run
```bash
npm run dev                  # starts API (:4000) and client (:5173) together
```

Open **http://localhost:5173** and log in with the pre-filled demo account:

```
Email:    demo@reltor.app
Password: demo1234
```

## 🗂️ Project Structure

```
.
├── server/                 # Express API
│   └── src/
│       ├── routes/         # auth, contacts, templates, campaigns, social,
│       │                   #   sequences, analytics, webhooks
│       ├── services/       # email (SendGrid), social (Meta), scheduler, sender
│       ├── middleware/     # auth, async, errors
│       ├── db/             # pool, schema.sql, migrate, seed
│       └── data/           # real-estate email templates
└── client/                 # React + Vite app
    └── src/
        ├── pages/          # Dashboard, Campaigns, Sequences, Social,
        │                   #   Contacts, Analytics, Pricing, Settings, auth
        ├── components/      # Layout, UI kit (modal, toast, stat, badge…)
        └── lib/            # api client, auth context
```

## 🔌 Going Live with Integrations

**SendGrid** — set `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL`. To record opens
and clicks, point a SendGrid Event Webhook at
`POST https://your-host/api/webhooks/sendgrid`.

**Facebook / Instagram** — set `FACEBOOK_PAGE_ID`,
`FACEBOOK_PAGE_ACCESS_TOKEN`, and `INSTAGRAM_BUSINESS_ACCOUNT_ID`. Instagram
posts require a public `image_url`.

## 📜 API Overview

`/api/auth` · `/api/contacts` · `/api/templates` · `/api/campaigns` ·
`/api/social` · `/api/sequences` · `/api/analytics` · `/api/webhooks/sendgrid`
· `/api/health`

All routes except `auth/login`, `auth/register`, and the webhook require a
`Bearer <jwt>` header.
