#!/usr/bin/env node
/**
 * EXPORT SIMPLE BUSINESS LIST
 * Just: site_id, name, address, phone
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('📥 Exporting businesses...\n');

  // Get businesses + site_content
  const { data: businesses } = await supabase
    .from('businesses')
    .select('site_id, name');

  const { data: content } = await supabase
    .from('site_content')
    .select('site_id, address, contact_phone, website_url');

  // Merge
  const list = businesses.map(biz => {
    const cont = content.find(c => c.site_id === biz.site_id) || {};
    return {
      site_id: biz.site_id,
      name: biz.name,
      address: cont.address || '',
      phone: cont.contact_phone || '',
      website: cont.website_url || '',
    };
  });

  // Save JSON
  fs.writeFileSync(
    '/Users/owner/cybercheck-api-database/businesses-simple.json',
    JSON.stringify(list, null, 2)
  );

  // Save CSV too
  const csv = [
    'site_id,name,address,phone,website',
    ...list.map(b =>
      `"${b.site_id}","${b.name.replace(/"/g, '""')}","${b.address.replace(/"/g, '""')}","${b.phone}","${b.website}"`
    ),
  ].join('\n');

  fs.writeFileSync(
    '/Users/owner/cybercheck-api-database/businesses-simple.csv',
    csv
  );

  console.log(`✓ Saved: businesses-simple.json (${list.length} businesses)`);
  console.log(`✓ Saved: businesses-simple.csv`);
  console.log(`\nColumns: site_id, name, address, phone, website`);
}

main().catch(console.error);
