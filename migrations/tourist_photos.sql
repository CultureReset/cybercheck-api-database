-- Community Photos submitted by TripSwipe users
-- Tied to tourist accounts, approved by admin before showing publicly
-- Run this in your main (cybercheck) Supabase SQL editor.

CREATE TABLE IF NOT EXISTS tourist_photos (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID,               -- null = anonymous (submitted via link without login)
    entity_slug  TEXT NOT NULL,      -- which business this photo is for
    entity_id    UUID,               -- GCR entity id (optional, for cross-ref)
    image_url    TEXT NOT NULL,
    caption      TEXT,
    uploader_name TEXT,
    category     TEXT DEFAULT 'general',  -- 'food','activities','nightlife','shopping','general'
    status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected')),
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at  TIMESTAMPTZ,
    reviewed_by  TEXT
);

CREATE INDEX IF NOT EXISTS idx_tp_entity_slug  ON tourist_photos(entity_slug);
CREATE INDEX IF NOT EXISTS idx_tp_user_id      ON tourist_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_tp_status       ON tourist_photos(status);
CREATE INDEX IF NOT EXISTS idx_tp_entity_status ON tourist_photos(entity_slug, status);
