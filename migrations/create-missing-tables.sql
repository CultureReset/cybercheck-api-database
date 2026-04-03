-- ============================================================
-- Missing tables migration
-- Run in Supabase SQL Editor on the MAIN database
-- ============================================================

-- AI Settings
CREATE TABLE IF NOT EXISTS public.ai_settings (
    id          integer PRIMARY KEY DEFAULT 1,
    chat_provider   text DEFAULT 'anthropic',
    chat_model      text DEFAULT 'claude-sonnet-4-6',
    chat_api_key    text,
    api_key_anthropic text,
    api_key_openai  text,
    api_key_grok    text,
    rag_provider    text DEFAULT 'openai',
    rag_model       text DEFAULT 'text-embedding-3-small',
    rag_api_key     text,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);
-- Insert default row so it always exists
INSERT INTO public.ai_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
