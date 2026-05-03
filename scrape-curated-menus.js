require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not set in .env');
    process.exit(1);
}

const DRY_RUN = process.argv.includes('--apply') ? false : true;

// URLs you provided, grouped by slug + type
const CURATED = [
    { slug: 'cobalt-the-restaurant',                     type: 'menu',       url: 'https://cobaltrestaurant.net/menu/' },
    { slug: 'zekes-restaurant',                          type: 'menu',       url: 'https://www.zekeslanding.com/wp-content/uploads/sites/7671/2025/03/dinner.pdf', format: 'pdf', section: 'Dinner' },
    { slug: 'cosmos-restaurant-and-bar',                 type: 'menu',       url: 'https://www.cosmosrestaurantandbar.com/menu' },
    { slug: 'gts-on-the-bay',                            type: 'menu',       url: 'https://gtsonthebay.com/menu/' },
    { slug: 'gts-on-the-bay',                            type: 'happy_hour', url: 'https://gtsonthebay.com/happy-hour/' },
    { slug: 'coastal-orange-beach',                      type: 'menu',       url: 'https://www.coastalorangebeach.com/coastal-restaurant-menu',  section: 'Restaurant' },
    { slug: 'coastal-orange-beach',                      type: 'menu',       url: 'https://www.coastalorangebeach.com/coastal-breakfast-menu',   section: 'Breakfast' },
    { slug: 'coastal-orange-beach',                      type: 'menu',       url: 'https://www.coastalorangebeach.com/beachside-bar-menu',       section: 'Beach Bar' },
    { slug: 'flora-bama-yacht-club',                     type: 'menu',       url: 'https://www.florabamayachtclub.com/menu' },
    { slug: 'voyagers',                                  type: 'menu',       url: 'https://voyagersrestaurant.com/menu' },
    { slug: 'voyagers',                                  type: 'menu',       url: 'https://voyagersrestaurant.com/admin/fm/source/5635_VoyagersPerdido/Voyagers-Dinner-Menu-March-2025-Website.pdf', format: 'pdf', section: 'Dinner' },
    { slug: 'docs-seafood-shack',                        type: 'menu',       url: 'https://www.docsseafoodshack.com/seafood-menu/' },
    { slug: 'docs-seafood-shack',                        type: 'menu',       url: 'https://www.docsseafoodshack.com/wp-content/uploads/2019/07/Docs-Seafood-Shack-and-Oyster-Bar-Menu.pdf', format: 'pdf' },
    { slug: 'lunas-eat-and-drink',                       type: 'menu',       url: 'https://www.lunaseatanddrink.com/menu' },
    { slug: 'tacky-jacks-seafood-restaurant-and-tavern', type: 'menu',       url: 'https://www.tackyjacks.com/download-menus' },
    { slug: 'sunliner-diner',                            type: 'specials',   url: 'https://sunlinerdiner.com/happy-days-special/' }
];

async function fetchContent(url, format) {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
            redirect: 'follow',
            signal: AbortSignal.timeout(30000)
        });
        if (!res.ok) return null;
        if (format === 'pdf') {
            const buf = Buffer.from(await res.arrayBuffer());
            return { pdfBase64: buf.toString('base64'), size: buf.length };
        }
        const text = await res.text();
        return { html: text.slice(0, 100000) };
    } catch (e) {
        return null;
    }
}

async function askHaiku(content) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 8192,
            messages: [{ role: 'user', content }]
        })
    });
    if (!res.ok) throw new Error(`Haiku API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.content?.[0]?.text || null;
}

function buildExtractPrompt(entry, fetched) {
    const typeInstruct = {
        menu: 'food menu items (with sections like Appetizers, Entrees, etc.)',
        drinks: 'drink menu (cocktails, wine, beer, etc.)',
        happy_hour: 'happy hour menu items AND schedule (days + start/end times + description)',
        specials: 'daily/weekly specials and deals'
    };
    const label = typeInstruct[entry.type] || 'menu items';

    return `Extract ${label} from this restaurant content.

Return ONLY valid JSON in this exact format (no prose, no markdown):
{
  "schedule": "e.g. Daily 4-6pm — only for happy_hour type, null otherwise",
  "schedule_days": "e.g. Monday-Friday or Daily",
  "schedule_start": "e.g. 4:00 PM",
  "schedule_end": "e.g. 6:00 PM",
  "sections": [
    {
      "name": "Section name (e.g. Appetizers)",
      "items": [
        { "name": "Item name", "description": "Optional description or null", "price": 12.99 }
      ]
    }
  ]
}

Rules:
- Use null for missing fields, NEVER empty strings for price
- Price must be a number, not a string (e.g. 12.99 not "$12.99")
- Combine entries where price varies (e.g. "cup $8 / bowl $12") into one item with description
- Skip items that clearly are not food/drinks (navigation, footer text, etc.)
- For PDFs, extract structured menu data
- If no menu data found, return {"sections":[]}

Content type: ${entry.type}${entry.section ? ' (force section name: "' + entry.section + '")' : ''}
Source URL: ${entry.url}`;
}

async function extractFromEntry(entry) {
    const fetched = await fetchContent(entry.url, entry.format);
    if (!fetched) return { ...entry, status: 'fetch-failed' };

    const prompt = buildExtractPrompt(entry, fetched);
    let content;
    if (fetched.pdfBase64) {
        content = [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fetched.pdfBase64 } },
            { type: 'text', text: prompt }
        ];
    } else {
        content = prompt + '\n\nHTML:\n' + fetched.html;
    }

    let raw;
    try {
        raw = await askHaiku(content);
    } catch (e) {
        return { ...entry, status: 'haiku-error', error: e.message };
    }

    if (!raw) return { ...entry, status: 'no-response' };

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { ...entry, status: 'no-json', raw: raw.slice(0, 200) };

    try {
        const data = JSON.parse(match[0]);
        if (entry.section && data.sections?.length === 1 && !data.sections[0].name) {
            data.sections[0].name = entry.section;
        } else if (entry.section && data.sections?.length === 1) {
            data.sections[0].name = entry.section;
        }
        return { ...entry, status: 'ok', data };
    } catch (e) {
        return { ...entry, status: 'parse-error', raw: match[0].slice(0, 300) };
    }
}

async function importToDb(entry, entityId) {
    if (!entry.data || !entry.data.sections) return { inserted: 0, sections: 0 };

    const isHH = entry.type === 'happy_hour';
    const sectionsTable = isHH ? 'happy_hour_sections' : 'menu_sections';
    const itemsTable    = isHH ? 'happy_hour_items'    : 'menu_items';

    let sectionsCreated = 0;
    let itemsInserted = 0;

    // Update HH schedule on entity if provided
    if (isHH && entry.data.schedule_days) {
        await supabase.from('entity').update({
            hh_days: entry.data.schedule_days || null,
            hh_start: entry.data.schedule_start || null,
            hh_end: entry.data.schedule_end || null,
            hh_description: entry.data.schedule || null,
            updated_at: new Date().toISOString()
        }).eq('id', entityId);
    }

    for (const section of entry.data.sections) {
        if (!section.items || section.items.length === 0) continue;

        const { data: sec, error: secErr } = await supabase.from(sectionsTable).insert({
            entity_id: entityId,
            section_name: section.name || 'Menu',
            sort_order: sectionsCreated
        }).select('id').single();

        if (secErr) { console.log(`    Section insert failed: ${secErr.message}`); continue; }
        sectionsCreated++;

        const rows = section.items.filter(i => i.name).map((item, idx) => ({
            entity_id: entityId,
            [isHH ? 'happy_hour_section_id' : 'menu_section_id']: sec.id,
            item_name: item.name,
            description: item.description || null,
            price: typeof item.price === 'number' ? item.price : null,
            price_text: typeof item.price === 'number' ? `$${item.price}` : (item.price_text || null),
            sort_order: idx,
            is_available: true
        }));

        if (rows.length > 0) {
            // Chunk into 100s
            for (let i = 0; i < rows.length; i += 100) {
                const chunk = rows.slice(i, i + 100);
                const { error } = await supabase.from(itemsTable).insert(chunk);
                if (error) { console.log(`    Items insert failed: ${error.message}`); }
                else itemsInserted += chunk.length;
            }
        }
    }

    return { inserted: itemsInserted, sections: sectionsCreated };
}

async function run() {
    console.log(DRY_RUN ? '=== DRY RUN (use --apply to commit) ===\n' : '=== APPLYING ===\n');
    console.log(`Curated URLs to scrape: ${CURATED.length}\n`);

    // Verify all slugs exist
    const slugs = [...new Set(CURATED.map(c => c.slug))];
    const { data: entities } = await supabase.from('entity').select('id, name, slug').in('slug', slugs);
    const byId = {};
    const byS = {};
    entities.forEach(e => { byId[e.id] = e; byS[e.slug] = e; });

    const missingSlugs = slugs.filter(s => !byS[s]);
    if (missingSlugs.length) {
        console.log('⚠️  Slugs not found in DB:');
        missingSlugs.forEach(s => console.log(`    • ${s}`));
        console.log('');
    }

    const results = [];
    for (let i = 0; i < CURATED.length; i++) {
        const entry = CURATED[i];
        const entity = byS[entry.slug];
        console.log(`[${i+1}/${CURATED.length}] ${entity?.name || entry.slug} — ${entry.type}${entry.section ? ' · ' + entry.section : ''}`);
        console.log(`    ${entry.url}`);

        if (!entity) {
            console.log(`    ⏭ SKIP: entity not found`);
            results.push({ ...entry, status: 'entity-not-found' });
            continue;
        }

        const r = await extractFromEntry(entry);
        if (r.status !== 'ok') {
            console.log(`    ❌ ${r.status}${r.error ? ': ' + r.error : ''}`);
            if (r.raw) console.log(`       raw: ${r.raw}`);
            results.push({ ...r, entity_name: entity.name });
            continue;
        }

        const secs = (r.data.sections || []).filter(s => s.items?.length);
        const totalItems = secs.reduce((s, sec) => s + sec.items.length, 0);
        console.log(`    📋 Extracted: ${secs.length} sections, ${totalItems} items`);

        if (DRY_RUN) {
            console.log(`    (dry-run — not inserted)`);
        } else {
            const { inserted, sections } = await importToDb(r, entity.id);
            console.log(`    ✅ Inserted: ${sections} sections, ${inserted} items`);
        }
        results.push({ ...r, entity_name: entity.name });
    }

    console.log('\n' + '═'.repeat(72));
    console.log('SUMMARY');
    console.log('═'.repeat(72));
    const ok = results.filter(r => r.status === 'ok');
    const failed = results.filter(r => r.status !== 'ok');
    console.log(`  Scraped successfully: ${ok.length}`);
    console.log(`  Failed:               ${failed.length}`);
    const totalItems = ok.reduce((s, r) => s + (r.data?.sections || []).reduce((ss, sec) => ss + (sec.items?.length || 0), 0), 0);
    console.log(`  Total items extracted: ${totalItems}`);
    if (failed.length) {
        console.log(`\nFailed entries:`);
        failed.forEach(f => console.log(`    • ${f.entity_name || f.slug} [${f.type}] — ${f.status}`));
    }
}

run().catch(e => { console.error(e); process.exit(1); });
