require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

(async () => {
    const { count: c1 } = await supabase.from('entity_events').select('id', { count: 'exact', head: true });
    const { count: c2 } = await supabase.from('events').select('id', { count: 'exact', head: true });
    
    console.log('Event counts:');
    console.log(`  entity_events: ${c1}`);
    console.log(`  events: ${c2}`);
    
    const { data } = await supabase.from('events').select('*').limit(3);
    if (data?.length) {
        console.log('\nSample from events table:');
        data.forEach(e => console.log(`  "${e.name}" ${e.event_date} ${e.start_time}`));
    }
})();
