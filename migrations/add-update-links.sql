-- Daily Update Links
-- Run in your MAIN CyberCheck Supabase SQL Editor

CREATE TABLE IF NOT EXISTS update_links (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_id     UUID NOT NULL,
    link_type     VARCHAR(50) NOT NULL DEFAULT 'daily',  -- daily | specials | catch_of_day | menu_prices
    link_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    token         VARCHAR(100) UNIQUE NOT NULL,
    fields_config JSONB,
    send_phone    VARCHAR(20),
    expires_at    TIMESTAMPTZ,
    submitted_at  TIMESTAMPTZ,
    submitted_data JSONB,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entity_id, link_type, link_date)
);

CREATE INDEX IF NOT EXISTS idx_update_links_token ON update_links(token);
CREATE INDEX IF NOT EXISTS idx_update_links_entity_date ON update_links(entity_id, link_date);
