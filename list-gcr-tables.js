const { createClient } = require('@supabase/supabase-js');

const gcrUrl = 'https://adpnhipmdefutkzzltbs.supabase.co';
const gcrKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkcG5oaXBtZGVmdXRrenpsdGJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg2MDA3NCwiZXhwIjoyMDkwNDM2MDc0fQ.qxMRoAuU22Kd6NyVXZsK4iSFFi-_20BUuN5yQfr7oUY';

const gcrDb = createClient(gcrUrl, gcrKey);

(async () => {
  try {
    const { data, error } = await gcrDb
      .from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public');
    
    if (error) {
      // Try alternative query
      const result = await gcrDb.rpc('get_table_names');
      if (result.error) throw result.error;
      console.log('Tables:', result.data);
      return;
    }
    
    console.log('Tables in GCR Supabase:');
    (data || []).forEach(t => console.log(`  - ${t.tablename}`));
  } catch (e) {
    console.error('Error:', e.message);
    console.log('\nTrying direct query...');
    const { data: tables } = await gcrDb
      .from('entity')
      .select('*')
      .limit(0);
    console.log('✓ entity table exists');
  }
})();
