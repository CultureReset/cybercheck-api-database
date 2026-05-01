require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

const DRY_RUN = process.argv.includes('--apply') ? false : true;

function isTestSlug(slug) {
    const s = (slug || '').toLowerCase();
    return s.startsWith('gcr-upload-test-') ||
           s.startsWith('gcr-sections-test-') ||
           s.startsWith('gcr-toggle-test-') ||
           s.startsWith('gcr-section-flow-test-') ||
           s.startsWith('gcr-items-test-') ||
           s.startsWith('gcr-events-test-') ||
           s.startsWith('gcr-tags-test-') ||
           s.startsWith('gcr-verify-') ||
           (s.startsWith('gcr-') && s.includes('-test-'));
}

function normalizeAddress(addr) {
    if (!addr) return '';
    return addr
        .toLowerCase()
        .trim()
        .replace(/\./g, '')                           // remove periods
        .replace(/,/g, '')                            // remove commas
        .replace(/\s+/g, ' ')                         // collapse whitespace
        .replace(/\bstreet\b/g, 'st')
        .replace(/\bavenue\b/g, 'ave')
        .replace(/\bboulevard\b/g, 'blvd')
        .replace(/\bdrive\b/g, 'dr')
        .replace(/\broad\b/g, 'rd')
        .replace(/\bhighway\b/g, 'hwy')
        .replace(/\bnorth\b/g, 'n')
        .replace(/\bsouth\b/g, 's')
        .replace(/\beast\b/g, 'e')
        .replace(/\bwest\b/g, 'w')
        .replace(/\bsuite\s+[a-z0-9]+/g, '')          // drop suite numbers
        .replace(/\bste\s+[a-z0-9]+/g, '')
        .replace(/\bunit\s+[a-z0-9]+/g, '')
        .replace(/#[a-z0-9]+/g, '')                   // drop #123
        .trim();
}

function isUUIDSlug(slug) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug || '');
}

function scoreEntity(e) {
    let score = 0;
    if (e.is_active) score += 1000;
    if (!isUUIDSlug(e.slug)) score += 100;
    if ((e.city || '').trim()) score += 50;
    if (e.entity_subtype && e.entity_subtype !== 'restaurant' && e.entity_subtype !== 'shopping') score += 10;
    score += (e.created_at || '').localeCompare('');
    return score;
}

async function run() {
    console.log(DRY_RUN ? '=== DRY RUN (use --apply to commit) ===' : '=== APPLYING CHANGES ===');
    console.log('');

    const { data, error } = await supabase
        .from('entity')
        .select('id, name, slug, entity_subtype, city, address_line_1, is_active, created_at')
        .order('name');

    if (error) { console.error(error); return; }

    const real = data.filter(e => !isTestSlug(e.slug));

    // Group by normalized address
    const byAddr = {};
    for (const e of real) {
        const key = normalizeAddress(e.address_line_1);
        if (!key || key.length < 6) continue; // skip empty or junk addresses
        (byAddr[key] ||= []).push(e);
    }

    const toDeactivate = [];
    const deactivated = new Set();
    const dupGroups = Object.entries(byAddr).filter(([_, arr]) => arr.length > 1);
    console.log(`Address groups with >1 entity: ${dupGroups.length}`);

    for (const [addr, group] of dupGroups) {
        // Only treat as duplicate if same address AND (same name OR very similar)
        // Group by normalized name within the address
        const byName = {};
        for (const e of group) {
            const n = (e.name || '').trim().toLowerCase();
            (byName[n] ||= []).push(e);
        }

        // Case 1: same address + same name = definitely duplicate
        for (const [n, arr] of Object.entries(byName)) {
            if (arr.length < 2) continue;
            const sorted = [...arr].sort((a, b) => scoreEntity(b) - scoreEntity(a));
            const keeper = sorted[0];
            for (const e of sorted.slice(1)) {
                if (deactivated.has(e.id)) continue;
                if (e.is_active === false) continue;
                toDeactivate.push({ ...e, _keeper: keeper.slug, _reason: 'same addr + same name' });
                deactivated.add(e.id);
            }
        }

        // Case 2: same address + different names but all active
        // If all active copies at same address have different names, they're probably separate businesses. Skip.
    }

    // Also check name-only duplicates where address is missing
    const byNameForNoAddr = {};
    for (const e of real) {
        if (deactivated.has(e.id)) continue;
        const k = (e.name || '').trim().toLowerCase();
        if (!k) continue;
        (byNameForNoAddr[k] ||= []).push(e);
    }
    for (const [name, arr] of Object.entries(byNameForNoAddr)) {
        if (arr.length < 2) continue;
        // Same name, different cities = separate locations (like McDonald's in 4 cities). Keep all.
        const cities = new Set(arr.map(e => (e.city || '').trim().toLowerCase()).filter(Boolean));
        // Exception: if some have no city and others do, treat no-city copies as likely stubs
        const noCity = arr.filter(e => !(e.city || '').trim());
        if (cities.size > 1 && noCity.length === 0) continue; // genuine multi-location

        // Same city (or unknown) — dedupe
        const byCity = {};
        for (const e of arr) {
            (byCity[(e.city || '').trim().toLowerCase()] ||= []).push(e);
        }
        // Merge no-city group into largest city group
        if (byCity[''] && Object.keys(byCity).length > 1) {
            const biggest = Object.entries(byCity).filter(([k]) => k).sort((a,b) => b[1].length - a[1].length)[0];
            if (biggest) {
                biggest[1].push(...byCity['']);
                delete byCity[''];
            }
        }
        for (const [_, group] of Object.entries(byCity)) {
            if (group.length < 2) continue;
            const sorted = [...group].sort((a, b) => scoreEntity(b) - scoreEntity(a));
            const keeper = sorted[0];
            for (const e of sorted.slice(1)) {
                if (deactivated.has(e.id)) continue;
                if (e.is_active === false) continue;
                toDeactivate.push({ ...e, _keeper: keeper.slug, _reason: 'same name + same city' });
                deactivated.add(e.id);
            }
        }
    }

    console.log(`Total to deactivate: ${toDeactivate.length}`);
    console.log('');

    if (toDeactivate.length) {
        console.log('--- Will deactivate ---');
        for (const e of toDeactivate) {
            console.log(`  [${e._reason}] ${e.name} (${e.city||'—'}) | ${e.address_line_1||'—'} | slug=${e.slug} | keeping=${e._keeper}`);
        }
        console.log('');
    }

    if (DRY_RUN) {
        console.log('Dry run complete. Run with --apply to commit.');
        return;
    }

    let ok = 0, fail = 0;
    for (const e of toDeactivate) {
        const { error: upErr } = await supabase
            .from('entity')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', e.id);
        if (upErr) {
            fail++;
            console.log(`  FAIL: ${e.name} | ${upErr.message}`);
        } else {
            ok++;
        }
    }
    console.log(`Updated: ${ok}  Failed: ${fail}`);
}

run();
