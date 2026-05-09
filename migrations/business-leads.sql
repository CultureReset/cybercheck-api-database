-- Business leads from the advertise page
CREATE TABLE IF NOT EXISTS business_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name TEXT NOT NULL,
    category TEXT,
    contact_name TEXT,
    phone TEXT,
    email TEXT NOT NULL,
    website TEXT,
    notes TEXT,
    plan TEXT DEFAULT 'Listed',
    status TEXT DEFAULT 'new', -- new | contacted | live | closed
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON business_leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_submitted ON business_leads(submitted_at DESC);
