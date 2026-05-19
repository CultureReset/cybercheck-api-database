require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function check() {
  const { data } = await supabase
    .from('entity')
    .select('id, name, phone')
    .eq('is_active', true);

  const withPhone = (data || []).filter(e => e.phone && e.phone.trim().length > 0).length;
  const withoutPhone = (data || []).filter(e => !e.phone || e.phone.trim().length === 0).length;

  console.log('PHONE NUMBERS:\n');
  console.log(`With phone: ${withPhone} / 921`);
  console.log(`Without phone: ${withoutPhone} / 921`);
  console.log(`Coverage: ${((withPhone / 921) * 100).toFixed(1)}%`);
}

check().catch(console.error);
