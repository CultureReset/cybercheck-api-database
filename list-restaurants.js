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

async function run() {
    const { data } = await supabase
        .from('entity')
        .select('name, slug, city')
        .eq('is_active', true)
        .eq('entity_subtype', 'restaurant')
        .order('name');
    
    const real = data.filter(e => !isTestSlug(e.slug));
    
    console.log(`═══════════════════════════════════════════════════════════════`);
    console.log(`🍽️  RESTAURANTS ON GCR — ${real.length} total`);
    console.log(`═══════════════════════════════════════════════════════════════\n`);
    
    real.forEach((e, i) => {
        const n = String(i+1).padStart(3);
        const city = e.city ? ` — ${e.city}` : '';
        console.log(`${n}. ${e.name}${city}`);
    });
}

run();
