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

function normAddr(a) {
    if (!a) return '';
    return a.toLowerCase().trim().replace(/\./g,'').replace(/,/g,'').replace(/\s+/g,' ')
        .replace(/\bstreet\b/g,'st').replace(/\bavenue\b/g,'ave').replace(/\bboulevard\b/g,'blvd')
        .replace(/\bdrive\b/g,'dr').replace(/\broad\b/g,'rd').replace(/\bhighway\b/g,'hwy')
        .replace(/\bnorth\b/g,'n').replace(/\bsouth\b/g,'s').replace(/\beast\b/g,'e').replace(/\bwest\b/g,'w')
        .replace(/\bsuite\s+[a-z0-9]+/g,'').replace(/\bste\s+[a-z0-9]+/g,'').replace(/\bunit\s+[a-z0-9]+/g,'')
        .replace(/#[a-z0-9]+/g,'').trim();
}

async function run() {
    const { data } = await supabase.from('entity')
        .select('id, name, slug, entity_subtype, city, address_line_1, is_active')
        .eq('is_active', true);
    const real = data.filter(e => !isTestSlug(e.slug));

    const byAddr = {};
    for (const e of real) {
        const k = normAddr(e.address_line_1);
        if (!k || k.length < 6) continue;
        (byAddr[k] ||= []).push(e);
    }
    const groups = Object.entries(byAddr).filter(([_, a]) => a.length > 1);
    console.log(`Addresses with multiple active entities: ${groups.length}\n`);
    for (const [addr, arr] of groups.sort((a,b) => b[1].length - a[1].length)) {
        console.log(`\n${addr} (${arr.length}):`);
        for (const e of arr) {
            console.log(`  "${e.name}" | ${e.entity_subtype || '—'} | ${e.city||'—'} | slug=${e.slug}`);
        }
    }
}

run();
