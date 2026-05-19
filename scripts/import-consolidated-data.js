#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY required in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CONSOLIDATED_FILE = path.join(__dirname, '../consolidation/CONSOLIDATED-ALL-TABLES.json');
const BATCH_SIZE = 100;

async function importConsolidatedData() {
  console.log('='.repeat(80));
  console.log('IMPORTING CONSOLIDATED DATA TO NEW DATABASE');
  console.log('='.repeat(80));
  console.log(`Database: ${supabaseUrl}\n`);

  // Load consolidated data
  console.log('Loading consolidated data...');
  let consolidatedData;
  try {
    const fileContent = fs.readFileSync(CONSOLIDATED_FILE, 'utf8');
    consolidatedData = JSON.parse(fileContent);
  } catch (err) {
    console.error(`ERROR loading consolidated file: ${err.message}`);
    process.exit(1);
  }

  const meta = consolidatedData.meta || {};
  const dataByTable = consolidatedData.data || {};
  const tables = Object.keys(dataByTable);

  console.log(`✓ Loaded ${tables.length} tables with ${meta.total_records || 0} records\n`);

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  const failedTables = {};

  // Import each table
  for (const tableName of tables) {
    const records = dataByTable[tableName] || [];
    if (records.length === 0) continue;

    process.stdout.write(`[${String(tables.indexOf(tableName) + 1).padStart(2)}/${tables.length}] ${tableName.padEnd(40)} → `);

    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    // Insert in batches
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      try {
        // Use upsert to handle duplicates
        const { data, error } = await supabase
          .from(tableName)
          .upsert(batch, { onConflict: 'id' });

        if (error) {
          // If upsert fails, try insert (new records)
          const { error: insertError } = await supabase
            .from(tableName)
            .insert(batch);

          if (insertError) {
            failed += batch.length;
            failedTables[tableName] = insertError.message;
          } else {
            inserted += batch.length;
          }
        } else {
          inserted += batch.length;
        }
      } catch (err) {
        failed += batch.length;
        failedTables[tableName] = err.message;
      }
    }

    totalInserted += inserted;
    totalSkipped += skipped;
    totalFailed += failed;

    const status =
      failed > 0
        ? `${inserted} inserted, ${failed} failed ❌`
        : `${inserted} inserted ✓`;

    console.log(status);
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('IMPORT COMPLETE');
  console.log('='.repeat(80));
  console.log(`Total inserted: ${totalInserted}`);
  console.log(`Total failed: ${totalFailed}`);

  if (Object.keys(failedTables).length > 0) {
    console.log('\nFailed tables:');
    Object.entries(failedTables).forEach(([table, error]) => {
      console.log(`  • ${table}: ${error}`);
    });
  }

  console.log('\nImport finished!\n');
}

importConsolidatedData().catch((err) => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
