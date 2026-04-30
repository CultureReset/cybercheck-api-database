-- Tourist AI concierge: per-user conversations, messages, and long-term memory

-- Chat threads (keyed to auth.users tourist accounts)
CREATE TABLE IF NOT EXISTS tourist_ai_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  title       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS tourist_ai_conv_user_idx
  ON tourist_ai_conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS tourist_ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES tourist_ai_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content         TEXT NOT NULL,
  has_image       BOOLEAN NOT NULL DEFAULT FALSE,
  url             TEXT,
  tool_results    JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS tourist_ai_msg_conv_idx
  ON tourist_ai_messages(conversation_id, created_at);

-- Long-term memory per tourist (preferences, group size, dietary, allergies, etc.)
CREATE TABLE IF NOT EXISTS tourist_memories (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL,
  category            TEXT NOT NULL CHECK (category IN ('preference','fact','goal','decision','recurring','note')),
  key                 TEXT NOT NULL,
  value               TEXT NOT NULL,
  tags                TEXT[] DEFAULT '{}',
  confidence          TEXT DEFAULT 'medium' CHECK (confidence IN ('high','medium','low')),
  source_message      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_referenced_at  TIMESTAMPTZ,
  UNIQUE (user_id, category, key)
);
CREATE INDEX IF NOT EXISTS tourist_memories_user_cat_idx
  ON tourist_memories(user_id, category);
CREATE INDEX IF NOT EXISTS tourist_memories_tags_idx
  ON tourist_memories USING GIN(tags);
