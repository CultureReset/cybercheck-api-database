require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

const norm = s => (s || '').toLowerCase().replace(/[''`]/g, "'").trim();

async function run() {
    console.log('\n=== Check orphan venues for matches to existing entities ===\n');

    // Load all entities
    const allEntities = [];
    {
        let from = 0, page = 1000;
        while (true) {
            const { data, error } = await supabase.from('entity').select('id, slug, name, city, entity_type, entity_subtype').range(from, from + page - 1);
            if (error) throw error;
            if (!data || !data.length) break;
            allEntities.push(...data);
            if (data.length < page) break;
            from += page;
        }
    }

    // Load all events
    const allEvents = [];
    {
        let from = 0, page = 1000;
        while (true) {
            const { data, error } = await supabase.from('entity_events').select('id, event_name, venue_location, entity_id').range(from, from + page - 1);
            if (error) throw error;
            if (!data || !data.length) break;
            allEvents.push(...data);
            if (data.length < page) break;
            from += page;
        }
    }

    const orphans = allEvents.filter(e => !e.entity_id);
    console.log(`Found ${orphans.length} orphan events\n`);

    // Get unique venues from orphans
    const venueMap = new Map();
    orphans.forEach(e => {
        const v = (e.venue_location || '').trim();
        if (v) {
            if (!venueMap.has(v)) venueMap.set(v, []);
            venueMap.get(v).push(e);
        }
    });

    const venues = Array.from(venueMap.entries()).sort((a,b) => b[1].length - a[1].length);
    console.log(`${venues.length} unique orphan venues\n`);
    console.log('Top venues + potential entity matches:\n');

    const results = [];
    for (const [venue, events] of venues.slice(0, 50)) {
        const venue_n = norm(venue);
        const venue_first = venue.split(',')[0].trim();
        const venue_first_n = norm(venue_first);

        // Try to find matches
        let bestMatch = null, bestScore = 0;
        for (const ent of allEntities) {
            const ent_n = norm(ent.name);
            const ent_city = norm(ent.city);
            let score = 0;

            // Exact name match
            if (ent_n === venue_n) score = 100;
            // Name prefix match
            else if (venue_n.includes(ent_n) && ent_n.length > 4) score = 90;
            else if (ent_n.includes(venue_n) && venue_n.length > 4) score = 85;
            // First token match (before comma)
            else if (ent_n === venue_first_n && venue_first_n.length > 4) score = 80;
            else if (venue_first_n.includes(ent_n) && ent_n.length > 4) score = 75;
            // Token overlap
            else {
                const v_tokens = new Set(venue_n.match(/\b[a-z]{3,}\b/g) || []);
                const e_tokens = new Set(ent_n.match(/\b[a-z]{3,}\b/g) || []);
                const common = [...v_tokens].filter(t => e_tokens.has(t));
                if (common.length >= 2) score = 30 + common.length * 15;
            }

            if (score > bestScore) {
                bestMatch = ent;
                bestScore = score;
            }
        }

        const match_text = bestScore > 50
            ? `✓ MATCH: "${bestMatch.name}" (${bestMatch.city}) [${bestMatch.entity_type}/${bestMatch.entity_subtype}] score=${bestScore}`
            : `✗ no match (score=${bestScore})`;

        results.push({ venue, events: events.length, match: match_text, score: bestScore });
        console.log(`${events.length.toString().padStart(3)} events | "${venue}"`);
        console.log(`            ${match_text}\n`);
    }

    // Summary
    const matchCount = results.filter(r => r.score > 50).length;
    console.log(`\n=== SUMMARY ===`);
    console.log(`Checked: ${results.length} venues`);
    console.log(`Potential matches (score > 50): ${matchCount}`);
    console.log(`Need new entities: ${results.length - matchCount}`);
}

run().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
