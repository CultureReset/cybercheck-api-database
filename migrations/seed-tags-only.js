const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
    process.env.GCR_SUPABASE_URL || 'https://adpnhipmdefutkzzltbs.supabase.co',
    process.env.GCR_SUPABASE_KEY
);

const DATA_DIR = path.join(__dirname, '../../build-main/structured data ');
const FILES = ['dockside_real_data_fixed.json','sunny_lady_real_data_complete.json','teeoff_real_data.json','cobalt_real_data_fixed.json'];

async function main() {
    for (const file of FILES) {
        const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
        const features   = data.entity_features   || data.features    || [];
        const perfectFor = data.entity_perfect_for || data.perfect_for || [];
        const slug = data.entity.slug;

        const { data: entity } = await supabase.from('entity').select('id').eq('slug', slug).single();
        if (!entity) { console.log(`❌ Not found: ${slug}`); continue; }

        const tags = [
            ...features.map((f,i)   => ({ entity_id: entity.id, tag: f.label.toLowerCase().trim(), tag_category: 'feature',    sort_order: i })),
            ...perfectFor.map((p,i) => ({ entity_id: entity.id, tag: p.label.toLowerCase().trim(), tag_category: 'perfect_for', sort_order: i })),
        ].filter((t,i,arr) => arr.findIndex(x => x.tag === t.tag) === i);

        const { error } = await supabase.from('entity_tags').upsert(tags, { onConflict: 'entity_id,tag' });
        if (error) { console.log(`❌ ${slug}: ${error.message}`); continue; }
        console.log(`✅ ${slug} — ${tags.length} tags`);
    }
}
main();
