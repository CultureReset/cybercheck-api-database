// Initialize GCR Supabase database schema
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

async function initSchema() {
    console.log('🏗️  Initializing GCR schema...\n');

    try {
        // Check if entity table exists
        const { data, error } = await gcrDb.from('entity').select('count', { count: 'exact' }).limit(1);
        
        if (!error) {
            console.log('✅ GCR schema already exists');
            return;
        }

        console.log('❌ GCR schema missing. You must manually run gcr-entity-schema.sql in Supabase SQL editor:');
        console.log('\n1. Go to: https://supabase.com/dashboard');
        console.log('2. Select project: adpnhipmdefutkzzltbs');
        console.log('3. Go to SQL Editor');
        console.log('4. Create new query');
        console.log('5. Paste contents of: migrations/gcr-entity-schema.sql');
        console.log('6. Click "Run"\n');

    } catch (err) {
        console.error('Error:', err.message);
    }
}

initSchema();
