-- ============================================================
-- Review Questions — per-business custom review questions
-- ============================================================

CREATE TABLE IF NOT EXISTS review_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,

    -- Question content
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL,  -- 'stars' | 'yesno' | 'text' | 'rating'

    -- Order & visibility
    display_order INT DEFAULT 0,
    enabled BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_questions_site ON review_questions(site_id);
CREATE INDEX IF NOT EXISTS idx_review_questions_order ON review_questions(site_id, display_order);

-- ============================================================
-- Review Answers — customer responses to custom questions
-- ============================================================

CREATE TABLE IF NOT EXISTS review_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES review_questions(id) ON DELETE CASCADE,

    -- Answer (flexible — could be int for stars, text for text, 'yes'/'no' for yesno)
    answer TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_answers_review ON review_answers(review_id);
CREATE INDEX IF NOT EXISTS idx_review_answers_question ON review_answers(question_id);

-- ============================================================
-- Update reviews table to track more metadata
-- ============================================================

ALTER TABLE reviews
    ADD COLUMN IF NOT EXISTS review_token VARCHAR(100) UNIQUE,  -- one-time token for review link
    ADD COLUMN IF NOT EXISTS token_used BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS review_method VARCHAR(20) DEFAULT 'text',  -- 'text' | 'voice'
    ADD COLUMN IF NOT EXISTS original_voice_text TEXT,
    ADD COLUMN IF NOT EXISTS published_to_site BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS photo_added_to_gallery BOOLEAN DEFAULT false;

-- ============================================================
-- Insert default review questions for new businesses
-- ============================================================

-- NOTE: Trigger or application code should insert default questions when a business signs up
-- Default questions (can be customized per business):
-- 1. How was the boat condition? (stars)
-- 2. How was the check-in experience? (stars)
-- 3. Would you recommend us to a friend? (yesno)
-- 4. What could we improve? (text)
-- 5. How was the staff friendliness? (stars)
