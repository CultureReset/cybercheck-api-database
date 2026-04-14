#!/usr/bin/env node
require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const old = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // Raw SQL to get table definitions
  const sql = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;

  const { data, error } = await old.rpc('sql', { query: sql }).catch(() => ({ data: null, error: 'RPC failed' }));

  if (error) {
    console.log('Try running this SQL directly in Supabase:\n');
    console.log(sql);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

main();
