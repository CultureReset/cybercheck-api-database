-- AI assistant: conversations, messages, and structured long-term memory

-- Chat threads (one per "new conversation")
CREATE TABLE IF NOT EXISTS ai_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
  title       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_conversations_site_idx
  ON ai_conversations(site_id, updated_at DESC);

-- Every message in every conversation
CREATE TABLE IF NOT EXISTS ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content         TEXT NOT NULL,
  has_image       BOOLEAN NOT NULL DEFAULT FALSE,
  url             TEXT,
  tool_results    JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_messages_conv_idx
  ON ai_messages(conversation_id, created_at);

-- Long-term memory: facts the AI remembers across conversations
-- Structured by category + key for easy retrieval
CREATE TABLE IF NOT EXISTS business_memories (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id             UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
  category            TEXT NOT NULL CHECK (category IN ('preference','fact','goal','decision','recurring','note')),
  key                 TEXT NOT NULL,
  value               TEXT NOT NULL,
  tags                TEXT[] DEFAULT '{}',
  confidence          TEXT DEFAULT 'medium' CHECK (confidence IN ('high','medium','low')),
  source_message      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_referenced_at  TIMESTAMPTZ,
  UNIQUE (site_id, category, key)
);
CREATE INDEX IF NOT EXISTS business_memories_site_cat_idx
  ON business_memories(site_id, category);
CREATE INDEX IF NOT EXISTS business_memories_tags_idx
  ON business_memories USING GIN(tags);
