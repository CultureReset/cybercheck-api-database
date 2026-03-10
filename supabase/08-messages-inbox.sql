-- ============================================================
-- Messages / SMS Inbox
-- One number per business handles everything:
--   booking confirmations, loyalty, promos, two-way replies
-- ============================================================

-- ── messages — every SMS in/out per business ──────────────────
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,

    -- The conversation thread key = customer phone number
    customer_phone VARCHAR(20) NOT NULL,
    customer_name  VARCHAR(255),         -- looked up from customers table
    customer_id    UUID REFERENCES customers(id),

    -- Message content
    direction VARCHAR(10) NOT NULL,      -- 'inbound' (tourist→biz) | 'outbound' (biz→tourist)
    body      TEXT NOT NULL,
    media_url TEXT,                      -- MMS photo attachment

    -- Type tells us why this was sent
    -- booking_confirm | loyalty | promo | review_request | ai_reply | manual | inbound
    message_type VARCHAR(50) DEFAULT 'manual',

    -- Twilio tracking
    twilio_sid   VARCHAR(50),
    twilio_status VARCHAR(20),           -- queued | sent | delivered | failed | received

    -- Inbox state
    read BOOLEAN DEFAULT false,          -- has owner read this inbound message?

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_site     ON messages(site_id);
CREATE INDEX IF NOT EXISTS idx_messages_phone    ON messages(site_id, customer_phone);
CREATE INDEX IF NOT EXISTS idx_messages_unread   ON messages(site_id, read) WHERE direction = 'inbound';
CREATE INDEX IF NOT EXISTS idx_messages_created  ON messages(created_at DESC);

-- ── business_phones — the one number assigned to each business ─
-- (could also live in site_content but this is cleaner)
ALTER TABLE site_content
    ADD COLUMN IF NOT EXISTS twilio_number VARCHAR(20),   -- the business's Twilio number
    ADD COLUMN IF NOT EXISTS owner_phone   VARCHAR(20);   -- owner's personal cell for forwarding
