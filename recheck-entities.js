require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

(async () => {
  try {
    // Get the first orphaned entity ID
    const testId = 'a44e10e7-cb29-4b86-a16d-c7646a48d00f';

    console.log(`Checking if entity ${testId} exists...\n`);

    // Direct select
    const { data: direct } = await gcrDb
      .from('entity')
      .select('id, name')
      .eq('id', testId);

    console.log('Direct lookup (eq):');
    console.log('  Found:', direct.length > 0 ? 'YES' : 'NO');
    if (direct.length > 0) console.log('  Name:', direct[0].name);

    // Count all entities
    const { data: all, count } = await gcrDb
      .from('entity')
      .select('id', { count: 'exact', head: true });

    console.log(`\nTotal entities in table: ${count}`);

    // Check range of IDs that start with 'a'
    const { data: startsWithA } = await gcrDb
      .from('entity')
      .select('id, name')
      .like('id', 'a%')
      .limit(5);

    console.log(`\nSample entities starting with 'a': ${startsWithA.length}`);
    startsWithA.forEach(e => console.log(`  ${e.id.substring(0, 8)}... ${e.name}`));
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
