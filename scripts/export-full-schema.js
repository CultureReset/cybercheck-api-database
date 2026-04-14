#!/usr/bin/env node
/**
 * EXPORT OLD DB FULL SCHEMA
 * Gets REAL table definitions from information_schema
 */
require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const old = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function getTableSchemas() {
  console.log('\n📋 QUERYING INFORMATION_SCHEMA\n');

  // Get all tables and their columns from information_schema
  const { data: tables, error: tablesError } = await old
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_type', 'BASE TABLE');

  if (tablesError) {
    console.error('❌ Cannot query information_schema.tables:', tablesError.message);
    return null;
  }

  console.log(`Found ${tables.length} tables\n`);

  const schemas = {};

  for (const table of tables) {
    const tableName = table.table_name;

    // Get columns for this table
    const { data: columns, error: colError } = await old
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_schema', 'public')
      .eq('table_name', tableName);

    if (colError) {
      console.log(`⚠️  ${tableName} - Cannot read columns`);
      schemas[tableName] = { columns: [] };
      continue;
    }

    schemas[tableName] = { columns: columns || [] };
    console.log(`✅ ${tableName.padEnd(35)} - ${(columns || []).length} columns`);
  }

  return schemas;
}

async function main() {
  const schemas = await getTableSchemas();

  if (!schemas) {
    console.error('\n❌ Failed to read schema');
    process.exit(1);
  }

  // Generate SQL
  let sql = '';
  sql += `-- OLD DATABASE FULL SCHEMA\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n`;
  sql += `-- Source: mhafixflyffflwjhcgfn (old DB)\n`;
  sql += `-- Tables: ${Object.keys(schemas).length}\n\n`;

  for (const [tableName, info] of Object.entries(schemas)) {
    const cols = info.columns;

    if (!cols || cols.length === 0) {
      sql += `-- ${tableName} (no columns found - may be empty)\n`;
      sql += `CREATE TABLE IF NOT EXISTS ${tableName} ();\n\n`;
      continue;
    }

    sql += `-- ${tableName} (${cols.length} columns)\n`;
    sql += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
    sql += cols.map((col, i) => {
      let colDef = `  ${col.column_name} ${col.data_type}`;
      if (col.is_nullable === 'NO') {
        colDef += ' NOT NULL';
      }
      if (col.column_default) {
        colDef += ` DEFAULT ${col.column_default}`;
      }
      return colDef;
    }).join(',\n');
    sql += '\n);\n\n';
  }

  const outputFile = '/tmp/old-db-full-schema.sql';
  fs.writeFileSync(outputFile, sql);

  console.log(`\n${'='*70}`);
  console.log(`✅ FULL SCHEMA EXPORTED\n`);
  console.log(`File: ${outputFile}`);
  console.log(`Size: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB`);
  console.log(`Tables: ${Object.keys(schemas).length}\n`);
  console.log(`NEXT: Copy this SQL and run it in GCR Supabase SQL editor\n`);
}

main().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
