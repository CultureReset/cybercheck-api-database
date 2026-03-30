const { createClient } = require('@supabase/supabase-js');

const gcrSupabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

module.exports = gcrSupabase;
