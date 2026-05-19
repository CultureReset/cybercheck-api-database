require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const db = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

async function countFilesRecursive(path = '') {
  const { data, error } = await db.storage.from('entity-images').list(path, { limit: 1000 });
  if (error) {
    console.error(`Error listing ${path}:`, error.message);
    return 0;
  }

  let total = 0;
  for (const item of data) {
    if (item.metadata?.mimetype?.startsWith('image/')) {
      total++;
    } else if (item.metadata === null && item.name !== 'entity-images') {
      // Might be a folder
      total += await countFilesRecursive(`${path}${path ? '/' : ''}${item.name}`);
    }
  }
  return total;
}

async function main() {
  const count = await countFilesRecursive();
  console.log(`\nTotal images in Supabase storage: ${count}`);
}

main().catch(e => console.error('Error:', e.message));
