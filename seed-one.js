require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

console.log('GCR_SUPABASE_URL:', process.env.GCR_SUPABASE_URL);
console.log('GCR_SUPABASE_KEY exists:', !!process.env.GCR_SUPABASE_KEY);

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

async function testSeed() {
    // Test with first activity
    const actDir = '/Users/owner/build-main/activities';
    const folders = fs.readdirSync(actDir).slice(0, 1);

    for (const folder of folders) {
        const dataPath = path.join(actDir, folder, 'data.json');
        if (!fs.existsSync(dataPath)) {
            console.log(`No data.json in ${folder}`);
            continue;
        }

        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        console.log('\n=== Testing with:', data.title, '===');
        console.log('Data:', JSON.stringify(data, null, 2).slice(0, 300));

        // Try to insert entity
        const { data: result, error } = await supabase
            .from('entity')
            .insert({
                slug: data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                name: data.title,
                subtitle: data.category || 'Activity',
                entity_type: 'business',
                entity_subtype: (data.category || 'activity').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                is_active: true
            })
            .select();

        if (error) {
            console.log('❌ Error:', error);
        } else {
            console.log('✅ Success:', result);
        }
    }
}

testSeed().catch(e => console.error('Fatal:', e.message));
