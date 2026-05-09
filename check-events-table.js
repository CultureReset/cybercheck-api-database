require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

(async () => {
    // Try to fetch from events table
    const { data, error, count } = await supabase
        .from('events')
        .select('*', { count: 'exact' })
        .limit(10);
    
    if (error) {
        console.log('ERROR querying events table:', error.message);
        console.log('\nTrying to list all tables...');
        // List all tables — brute force check
        const tables = ['entity_events', 'events', 'qr_events', 'business_events', 'gcr_events'];
        for (const t of tables) {
            const { count: c } = await supabase.from(t).select('id', { count: 'exact', head: true });
            console.log(`  ${t}: ${c || 'not found'}`);
        }
        return;
    }
    
    console.log(`Found ${count} rows in events table`);
    if (data?.length) {
        console.log('\nSample:');
        data.forEach(e => console.log(`  ${e.name} | ${e.event_date} | site=${e.site_id?.slice(0,8)}`));
    }
})();
