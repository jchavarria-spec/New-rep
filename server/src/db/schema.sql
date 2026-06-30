-- Reltor schema — real estate marketing automation MVP

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  brokerage     TEXT,
  plan          TEXT NOT NULL DEFAULT 'starter',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name  TEXT NOT NULL,
  last_name   TEXT,
  email       TEXT NOT NULL,
  phone       TEXT,
  -- lead lifecycle: new, nurturing, active, client, past_client, lost
  stage       TEXT NOT NULL DEFAULT 'new',
  tags        TEXT[] NOT NULL DEFAULT '{}',
  source      TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_stage ON contacts(user_id, stage);

CREATE TABLE IF NOT EXISTS templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  scenario    TEXT NOT NULL,          -- new_listing, follow_up, open_house, ...
  name        TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,          -- HTML with {{merge}} fields
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  subject       TEXT NOT NULL,
  body          TEXT NOT NULL,
  scenario      TEXT,
  -- draft, scheduled, sending, sent
  status        TEXT NOT NULL DEFAULT 'draft',
  segment_stage TEXT,                  -- optional filter by lead stage
  segment_tags  TEXT[] NOT NULL DEFAULT '{}',
  scheduled_at  TIMESTAMPTZ,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id);

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id   UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  -- queued, sent, delivered, opened, clicked, bounced, failed
  status       TEXT NOT NULL DEFAULT 'queued',
  message_id   TEXT,
  opened_at    TIMESTAMPTZ,
  clicked_at   TIMESTAMPTZ,
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_recipients_msgid ON campaign_recipients(message_id);

CREATE TABLE IF NOT EXISTS social_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caption       TEXT NOT NULL,
  image_url     TEXT,
  platforms     TEXT[] NOT NULL DEFAULT '{}',  -- facebook, instagram
  -- draft, scheduled, posted, failed
  status        TEXT NOT NULL DEFAULT 'scheduled',
  scheduled_at  TIMESTAMPTZ,
  posted_at     TIMESTAMPTZ,
  results       JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_user ON social_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_due ON social_posts(status, scheduled_at);

CREATE TABLE IF NOT EXISTS sequences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  trigger_stage TEXT,                  -- auto-enroll contacts entering this stage
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sequence_steps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  step_order  INT NOT NULL,
  delay_days  INT NOT NULL DEFAULT 0,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_steps_seq ON sequence_steps(sequence_id);

CREATE TABLE IF NOT EXISTS enrollments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id   UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  contact_id    UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  current_step  INT NOT NULL DEFAULT 0,
  -- active, completed, cancelled
  status        TEXT NOT NULL DEFAULT 'active',
  next_send_at  TIMESTAMPTZ,
  enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  UNIQUE (sequence_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_enroll_due ON enrollments(status, next_send_at);
