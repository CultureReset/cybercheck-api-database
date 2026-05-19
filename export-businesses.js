#!/usr/bin/env node
/**
 * EXPORT ALL BUSINESSES TO LOCAL JSON
 * Simple download of all businesses + site_content for local matching
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('📥 Exporting all businesses...\n');

  // Get all businesses
  const { data: businesses, error: bizError } = await supabase
    .from('businesses')
    .select('*');

  if (bizError) {
    console.error('Error fetching businesses:', bizError);
    process.exit(1);
  }

  console.log(`✓ Fetched ${businesses.length} businesses`);

  // Get all site_content
  const { data: content, error: contentError } = await supabase
    .from('site_content')
    .select('*');

  if (contentError) {
    console.error('Error fetching site_content:', contentError);
    process.exit(1);
  }

  console.log(`✓ Fetched ${content.length} site_content records`);

  // Merge them together keyed by site_id
  const merged = businesses.map(biz => {
    const cont = content.find(c => c.site_id === biz.site_id) || {};
    return {
      site_id: biz.site_id,
      name: biz.name,
      type: biz.type,
      status: biz.status,
      domain: biz.domain,
      subdomain: biz.subdomain,
      website_url: cont.website_url,
      contact_phone: cont.contact_phone,
      contact_email: cont.contact_email,
      address: cont.address,
      city: cont.city,
      state: cont.state,
      hours: cont.hours,
      created_at: biz.created_at,
    };
  });

  // Save locally
  fs.writeFileSync(
    '/Users/owner/cybercheck-api-database/all-businesses.json',
    JSON.stringify(merged, null, 2)
  );

  console.log(`\n✓ Saved: all-businesses.json`);
  console.log(`\nYou now have a local reference with:`);
  console.log(`  - site_id (unique ID)`);
  console.log(`  - name, type, status`);
  console.log(`  - website_url (for matching)`);
  console.log(`  - contact info, hours, address`);
}

main().catch(console.error);
