-- Add per-provider API key columns to ai_settings table
-- Run in OLD CyberCheck Supabase SQL Editor (where ai_settings lives)
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS api_key_anthropic text;
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS api_key_openai text;
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS api_key_grok text;
