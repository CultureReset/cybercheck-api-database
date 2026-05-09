const { createClient } = require('@supabase/supabase-js');

const gcrUrl = 'https://adpnhipmdefutkzzltbs.supabase.co';
const gcrKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkcG5oaXBtZGVmdXRrenpsdGJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg2MDA3NCwiZXhwIjoyMDkwNDM2MDc0fQ.qxMRoAuU22Kd6NyVXZsK4iSFFi-_20BUuN5yQfr7oUY';

const gcrDb = createClient(gcrUrl, gcrKey);

(async () => {
  try {
    const { data, error } = await gcrDb
      .from('pg_columns')
      .select('column_name, data_type, character_maximum_length')
      .eq('table_name', 'entity')
      .eq('table_schema', 'public');
    
    if (error) {
      console.log('Schema query failed, trying alternative...');
      return;
    }

    console.log('Entity table columns:');
    (data || []).forEach(col => {
      if (col.character_maximum_length && col.character_maximum_length <= 30) {
        console.log(`  ✗ ${col.column_name}: varchar(${col.character_maximum_length})`);
      }
    });
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
