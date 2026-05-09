const { createClient } = require('@supabase/supabase-js');

const url = 'https://adpnhipmdefutkzzltbs.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkcG5oaXBtZGVmdXRrenpsdGJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg2MDA3NCwiZXhwIjoyMDkwNDM2MDc0fQ.qxMRoAuU22Kd6NyVXZsK4iSFFi-_20BUuN5yQfr7oUY';
const supabase = createClient(url, key);

(async () => {
  try {
    // Get all tables
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (error) throw error;
    
    console.log('Tables in GCR Supabase:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
