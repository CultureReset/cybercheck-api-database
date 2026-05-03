require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

function isTestSlug(slug) {
    const s = (slug || '').toLowerCase();
    return s.startsWith('gcr-upload-test-') || s.startsWith('gcr-sections-test-') ||
           s.startsWith('gcr-toggle-test-') || s.startsWith('gcr-section-flow-test-') ||
           s.startsWith('gcr-items-test-') || s.startsWith('gcr-events-test-') ||
           s.startsWith('gcr-tags-test-') || s.startsWith('gcr-verify-') ||
           (s.startsWith('gcr-') && s.includes('-test-'));
}

const BASE = 'https://launching-gcr.vercel.app';

async function run() {
    const { data } = await supabase
        .from('entity')
        .select('name, slug, entity_subtype')
        .eq('is_active', true)
        .eq('entity_subtype', 'restaurant')
        .order('name');
    
    const real = data.filter(e => !isTestSlug(e.slug));
    
    console.log(`🍽️  ${real.length} RESTAURANTS — PROFILE URLs\n`);
    real.forEach((e, i) => {
        console.log(`${String(i+1).padStart(3)}. ${e.name}`);
        console.log(`     ${BASE}/profile?id=${e.slug}`);
    });
}

run();
