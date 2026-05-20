-- ============================================================
--  TMS SUPPORT TICKET SYSTEM — SUPABASE / POSTGRESQL SCHEMA
--  Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

CREATE TABLE IF NOT EXISTS brokers (
    broker_id       VARCHAR(20)     NOT NULL PRIMARY KEY,
    broker_name     VARCHAR(100)    NOT NULL,
    contact_person  VARCHAR(100),
    contact_email   VARCHAR(150),
    contact_phone   VARCHAR(20),
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    user_id         SERIAL          PRIMARY KEY,
    full_name       VARCHAR(100)    NOT NULL,
    email           VARCHAR(150)    NOT NULL UNIQUE,
    password_hash   VARCHAR(256)    NOT NULL,
    role            VARCHAR(20)     NOT NULL CHECK (role IN ('support','technical','admin')),
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_categories (
    category_id     SERIAL          PRIMARY KEY,
    category_name   VARCHAR(100)    NOT NULL UNIQUE,
    sla_hours       INT             NOT NULL DEFAULT 24,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sub_issues (
    sub_issue_id    SERIAL          PRIMARY KEY,
    category_id     INT             NOT NULL REFERENCES ticket_categories(category_id),
    sub_issue_name  VARCHAR(150)    NOT NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS tickets (
    ticket_id           VARCHAR(20)     NOT NULL PRIMARY KEY,
    broker_id           VARCHAR(20)     NOT NULL REFERENCES brokers(broker_id),
    category_id         INT             NOT NULL REFERENCES ticket_categories(category_id),
    sub_issue_id        INT             NOT NULL REFERENCES sub_issues(sub_issue_id),
    heading             VARCHAR(200)    NOT NULL,
    remarks             TEXT            NOT NULL,
    client_account_id   VARCHAR(50),
    priority            VARCHAR(10)     NOT NULL CHECK (priority IN ('critical','high','medium','low')),
    status              VARCHAR(15)     NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open','inprogress','resolved','closed','rejected')),
    raised_by_user_id   INT             NOT NULL REFERENCES users(user_id),
    assigned_to_user_id INT             REFERENCES users(user_id),
    sla_deadline        TIMESTAMPTZ,
    sla_breached        BOOLEAN         NOT NULL DEFAULT FALSE,
    raised_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    last_updated_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    closed_at           TIMESTAMPTZ,
    closed_by_user_id   INT             REFERENCES users(user_id),
    resolution_notes    TEXT,
    is_rejected         BOOLEAN         NOT NULL DEFAULT FALSE,
    rejected_at         TIMESTAMPTZ,
    rejected_by_user_id INT             REFERENCES users(user_id),
    rejection_reason    TEXT
);

CREATE TABLE IF NOT EXISTS ticket_timeline (
    timeline_id     SERIAL          PRIMARY KEY,
    ticket_id       VARCHAR(20)     NOT NULL REFERENCES tickets(ticket_id),
    action_by       INT             NOT NULL REFERENCES users(user_id),
    action_type     VARCHAR(30)     NOT NULL,
    action_note     VARCHAR(500)    NOT NULL,
    action_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_attachments (
    attachment_id   SERIAL          PRIMARY KEY,
    ticket_id       VARCHAR(20)     NOT NULL REFERENCES tickets(ticket_id),
    file_name       VARCHAR(200)    NOT NULL,
    file_path       VARCHAR(500)    NOT NULL,
    uploaded_by     INT             NOT NULL REFERENCES users(user_id),
    uploaded_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sla_breach_log (
    breach_id       SERIAL          PRIMARY KEY,
    ticket_id       VARCHAR(20)     NOT NULL REFERENCES tickets(ticket_id),
    breached_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    notified_at     TIMESTAMPTZ,
    notified_to     VARCHAR(150)
);

CREATE TABLE IF NOT EXISTS ticket_fields (
    field_id        SERIAL          PRIMARY KEY,
    ticket_id       VARCHAR(20)     NOT NULL REFERENCES tickets(ticket_id),
    field_name      VARCHAR(50)     NOT NULL,
    field_value     VARCHAR(500),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_ticket_fields_ticket_id ON ticket_fields(ticket_id);

CREATE TABLE IF NOT EXISTS feature_requests (
    request_id          SERIAL          PRIMARY KEY,
    title               VARCHAR(200)    NOT NULL,
    description         TEXT            NOT NULL,
    requested_by        INT             NOT NULL REFERENCES users(user_id),
    priority            VARCHAR(10)     NOT NULL DEFAULT 'medium'
                            CHECK (priority IN ('critical','high','medium','low')),
    status              VARCHAR(20)     NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','under_review','approved','in_development','completed','rejected')),
    module              VARCHAR(100),
    estimated_effort    VARCHAR(50),
    admin_notes         TEXT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ
);

-- Auto-update updated_at trigger for feature_requests
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_feature_requests_updated_at ON feature_requests;
CREATE TRIGGER trg_feature_requests_updated_at
  BEFORE UPDATE ON feature_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
