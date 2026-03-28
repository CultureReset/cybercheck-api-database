-- ============================================
-- RAG: business_embeddings + ai_settings
-- Run this in Supabase SQL Editor
-- Requires pgvector extension
-- ============================================

-- Enable pgvector (already enabled in most Supabase projects)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- business_embeddings — stores text chunks + vectors for each business
-- ============================================
CREATE TABLE IF NOT EXISTS business_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  chunk_type VARCHAR(50) NOT NULL,
  -- chunk_type values: 'profile', 'menu', 'happy_hour', 'hours',
  --   'fleet', 'specials', 'events', 'reviews', 'pricing', 'highlights'
  content TEXT NOT NULL,      -- the raw text chunk that was embedded
  embedding vector(1536),     -- 1536 dims = OpenAI text-embedding-3-small
  slug VARCHAR(255),          -- business subdomain (for easy filtering)
  business_name TEXT,         -- denormalized for fast display in results
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ANN index for cosine similarity search
CREATE INDEX IF NOT EXISTS business_embeddings_ivfflat
  ON business_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index for filtering by site_id
CREATE INDEX IF NOT EXISTS business_embeddings_site_id
  ON business_embeddings (site_id);

-- Index for filtering by chunk_type
CREATE INDEX IF NOT EXISTS business_embeddings_chunk_type
  ON business_embeddings (chunk_type);

-- ============================================
-- ai_settings — stores AI provider config (admin-configurable)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_settings (
  id SERIAL PRIMARY KEY,
  -- Provider for chat/completions: 'anthropic', 'openai', 'grok', 'groq'
  chat_provider VARCHAR(50) DEFAULT 'anthropic',
  chat_model VARCHAR(100) DEFAULT 'claude-sonnet-4-6',
  chat_api_key TEXT,          -- encrypted at rest in Supabase
  -- Provider for embeddings: 'openai' (recommended), 'cohere'
  embed_provider VARCHAR(50) DEFAULT 'openai',
  embed_model VARCHAR(100) DEFAULT 'text-embedding-3-small',
  embed_dimensions INT DEFAULT 1536,
  embed_api_key TEXT,         -- usually the same key as OpenAI chat key
  -- Feature flags
  rag_enabled BOOLEAN DEFAULT TRUE,
  voice_enabled BOOLEAN DEFAULT FALSE,
  -- Prompt customization
  system_prompt TEXT DEFAULT 'You are a friendly local guide for Gulf Coast Radar, the ultimate tourism directory for Orange Beach and Gulf Shores, Alabama. You help visitors find the best restaurants, activities, nightlife, shopping, and experiences on the Alabama Gulf Coast. Answer questions using only the business information provided to you. Be specific, helpful, and enthusiastic. Always include the business name when mentioning it.',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default settings row (only one row needed)
INSERT INTO ai_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Helper: match_business_chunks(query_embedding, limit)
-- Called by /api/gcr/ask to find relevant chunks
-- ============================================
CREATE OR REPLACE FUNCTION match_business_chunks(
  query_embedding vector(1536),
  match_count INT DEFAULT 8,
  filter_slug TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  site_id UUID,
  slug TEXT,
  business_name TEXT,
  chunk_type TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    be.id,
    be.site_id,
    be.slug::TEXT,
    be.business_name,
    be.chunk_type::TEXT,
    be.content,
    1 - (be.embedding <=> query_embedding) AS similarity
  FROM business_embeddings be
  WHERE
    be.embedding IS NOT NULL
    AND (filter_slug IS NULL OR be.slug = filter_slug)
  ORDER BY be.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
