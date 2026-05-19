#!/usr/bin/env node
/**
 * EXPORT ENTITIES FROM SUPABASE
 * Gets all businesses from the 'entity' table with: id, name, address, phone, website
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('📥 Exporting entities from Supabase...\n');

  const { data, error } = await supabase
    .from('entity')
    .select('id, name, address_line_1, address_line_2, city, state, zip, phone, website_url, slug, place_id')
    .eq('is_active', true)
    .limit(1000);

  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('⚠️  No entities found in database');
    process.exit(1);
  }

  // Format for easy matching
  const formatted = data.map(e => ({
    id: e.id,
    name: e.name,
    slug: e.slug,
    place_id: e.place_id,
    address: [e.address_line_1, e.address_line_2, e.city, e.state, e.zip]
      .filter(Boolean)
      .join(', '),
    phone: e.phone || '',
    website: e.website_url || '',
  }));

  // Save JSON
  fs.writeFileSync(
    '/Users/owner/cybercheck-api-database/entities.json',
    JSON.stringify(formatted, null, 2)
  );

  // Save CSV
  const csv = [
    'id,name,slug,place_id,address,phone,website',
    ...formatted.map(e =>
      `"${e.id}","${e.name.replace(/"/g, '""')}","${e.slug}","${e.place_id || ''}","${e.address.replace(/"/g, '""')}","${e.phone}","${e.website}"`
    ),
  ].join('\n');

  fs.writeFileSync(
    '/Users/owner/cybercheck-api-database/entities.csv',
    csv
  );

  console.log(`✓ Exported ${formatted.length} entities`);
  console.log(`✓ Saved: entities.json`);
  console.log(`✓ Saved: entities.csv`);
  console.log(`\nColumns: id, name, slug, place_id, address, phone, website`);
}

main().catch(console.error);
