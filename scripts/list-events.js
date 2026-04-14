#!/usr/bin/env node
require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function main() {
  const { data, error } = await supabase
    .from('entity_events')
    .select('event_name, event_date, day_of_week, start_time, venue_location, event_type')
    .eq('is_active', true)
    .not('event_date', 'is', null)
    .order('event_date')
    .order('start_time');

  if (error) { console.error(error.message); process.exit(1); }

  console.log(`\nTotal events with dates: ${data.length}\n`);
  console.log('DATE        DAY        TIME   VENUE                                    EVENT');
  console.log('─'.repeat(110));

  let lastDate = '';
  for (const e of data) {
    if (e.event_date !== lastDate) {
      console.log('');
      lastDate = e.event_date;
    }
    const date  = (e.event_date || '').padEnd(11);
    const day   = (e.day_of_week || '').padEnd(10);
    const time  = (e.start_time || '—').padEnd(6);
    const venue = (e.venue_location || '').substring(0, 40).padEnd(41);
    const name  = e.event_name || '';
    console.log(`${date}${day}${time} ${venue} ${name}`);
  }

  console.log('\n─'.repeat(110));

  // Summary by type
  const byType = {};
  data.forEach(e => { byType[e.event_type] = (byType[e.event_type] || 0) + 1; });
  console.log('\nBy category:');
  Object.entries(byType).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${v.toString().padStart(3)}  ${k}`));
}

main().catch(console.error);
