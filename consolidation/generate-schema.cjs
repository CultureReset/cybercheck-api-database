#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('='.repeat(100));
console.log('GENERATING SQL SCHEMA FROM CONSOLIDATED DATABASE');
console.log('='.repeat(100) + '\n');

// Load consolidated database
console.log('📖 Loading consolidated database...\n');
const consolidated = JSON.parse(fs.readFileSync(path.join(__dirname, './CONSOLIDATED-ALL-TABLES.json')));

const tables = consolidated.data;
const tableNames = Object.keys(tables).sort();

console.log(`✓ Loaded ${tableNames.length} tables\n`);

// Infer column types from sample records
function inferType(value) {
  if (value === null || value === undefined) return 'TEXT';
  if (typeof value === 'boolean') return 'BOOLEAN';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return 'INTEGER';
    return 'NUMERIC';
  }
  if (typeof value === 'string') {
    if (value.match(/^\d{4}-\d{2}-\d{2}/)) return 'TIMESTAMP';
    if (value.match(/^\d+$/)) return 'INTEGER';
    if (value.length > 1000) return 'TEXT';
    return 'VARCHAR(255)';
  }
  if (typeof value === 'object') return 'JSONB';
  return 'TEXT';
}

// Generate schema
console.log('🔧 Generating table schemas...\n');

const sqlStatements = [];
sqlStatements.push('-- CONSOLIDATED DATABASE SCHEMA');
sqlStatements.push(`-- Generated: ${new Date().toISOString()}`);
sqlStatements.push('-- Tables: ' + tableNames.length);
sqlStatements.push('-- Source: GCR + Profiles + CultureReset\n');
sqlStatements.push('');

tableNames.forEach((tableName) => {
  const records = tables[tableName] || [];

  if (records.length === 0) {
    console.log(`  ⊘ ${tableName}: No records, skipping`);
    return;
  }

  // Collect all columns from all records
  const columns = {};
  records.forEach(record => {
    Object.keys(record).forEach(col => {
      if (!columns[col]) {
        columns[col] = { type: 'TEXT', count: 0 };
      }
      columns[col].count++;

      // Refine type based on actual values
      const val = record[col];
      const inferredType = inferType(val);
      if (inferredType !== 'TEXT') {
        columns[col].type = inferredType;
      }
    });
  });

  // Build CREATE TABLE statement
  const columnDefs = Object.entries(columns)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([colName, colInfo]) => {
      let colDef = `  ${colName} ${colInfo.type}`;

      // Add NOT NULL for columns present in all records
      if (colInfo.count === records.length) {
        colDef += ' NOT NULL';
      }

      return colDef;
    });

  // Add timestamps if not present
  if (!columns.created_at) {
    columnDefs.push(`  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  }
  if (!columns.updated_at) {
    columnDefs.push(`  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  }

  // Build table statement
  const createTable = `CREATE TABLE IF NOT EXISTS ${tableName} (
${columnDefs.join(',\n')},
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);`;

  sqlStatements.push(createTable);
  sqlStatements.push(`CREATE INDEX idx_${tableName}_created ON ${tableName}(created_at);`);
  sqlStatements.push(`COMMENT ON TABLE ${tableName} IS '${records.length} records';`);
  sqlStatements.push('');

  console.log(`  ✓ ${tableName.padEnd(35)} ${records.length.toString().padStart(6)} records, ${Object.keys(columns).length} columns`);
});

const sqlOutput = sqlStatements.join('\n');

// Save SQL schema
console.log('\n' + '='.repeat(100));
console.log('💾 SAVING SQL SCHEMA\n');

const schemaFile = path.join(__dirname, 'SCHEMA.sql');
fs.writeFileSync(schemaFile, sqlOutput);

const sizeKb = (fs.statSync(schemaFile).size / 1024).toFixed(2);
console.log(`✓ Saved: SCHEMA.sql (${sizeKb} KB)\n`);

// Generate summary
const summary = {
  generated_at: new Date().toISOString(),
  schema_file: 'SCHEMA.sql',
  file_size_kb: parseFloat(sizeKb),
  total_tables: tableNames.length,
  tables: tableNames,

  next_steps: [
    '1. Create new database:',
    '   createdb cybercheck-unified',
    '',
    '2. Load schema:',
    '   psql cybercheck-unified < SCHEMA.sql',
    '',
    '3. Or use Supabase SQL Editor:',
    '   - Create new Supabase project',
    '   - Copy SCHEMA.sql contents',
    '   - Paste into SQL Editor and execute'
  ]
};

fs.writeFileSync(
  path.join(__dirname, 'SCHEMA-SUMMARY.json'),
  JSON.stringify(summary, null, 2)
);

console.log('✓ Saved: SCHEMA-SUMMARY.json\n');

console.log('='.repeat(100));
console.log('✅ SCHEMA GENERATION COMPLETE\n');

console.log('📋 QUICK START:\n');
console.log('PostgreSQL:');
console.log('  psql -U postgres -d your_database < consolidation/SCHEMA.sql\n');

console.log('Supabase:');
console.log('  1. Go to SQL Editor');
console.log('  2. Create new query');
console.log('  3. Copy & paste contents of consolidation/SCHEMA.sql');
console.log('  4. Execute\n');

console.log('='.repeat(100));
console.log(`✓ Tables ready: ${tableNames.length} tables`);
console.log('✓ No data loaded - schema only');
console.log('='.repeat(100) + '\n');
