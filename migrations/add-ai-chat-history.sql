-- AI Chat Conversation History
-- Auto-saves conversations; AI references them only when explicitly asked

CREATE TABLE IF NOT EXISTS ai_chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title VARCHAR(255),
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_chat_user_created ON ai_chat_conversations(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_organizer_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  entity_name VARCHAR(255),
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  FOREIGN KEY (entity_id) REFERENCES entity(id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_organizer_user_entity ON ai_organizer_conversations(user_id, entity_id, created_at DESC);
