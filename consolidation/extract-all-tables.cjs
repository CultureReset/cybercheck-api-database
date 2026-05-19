#!/usr/bin/env node

/**
 * EXTRACT ALL TABLES FROM SUPABASE DATABASES
 *
 * Run this script inside SQL Editor for each Supabase project:
 * Copy the SQL below and execute in Supabase SQL Editor
 * Save the results as JSON
 */

const gcr_sql = `
-- GCR DATABASE - EXTRACT ALL TABLES WITH COLUMNS
SELECT
  json_build_object(
    'database', 'gulf-coast-radar',
    'tables', json_agg(
      json_build_object(
        'name', t.tablename,
        'columns', (
          SELECT json_agg(
            json_build_object(
              'name', attname,
              'type', pg_catalog.format_type(atttypid, atttypmod),
              'nullable', NOT attnotnull,
              'default', adsrc
            )
          )
          FROM pg_attribute
          LEFT JOIN pg_attrdef ON adrelid = attrelid AND adnum = attnum
          WHERE attrelid = ('public.' || t.tablename)::regclass
          AND attnum > 0
          AND NOT attisdropped
        )
      )
    )
  ) as result
FROM pg_tables t
WHERE schemaname = 'public'
AND tablename NOT LIKE 'pg_%'
AND tablename NOT LIKE 'sql_%';
`;

const profiles_sql = `
-- PROFILES DATABASE - EXTRACT ALL TABLES WITH COLUMNS
SELECT
  json_build_object(
    'database', 'profiles',
    'tables', json_agg(
      json_build_object(
        'name', t.tablename,
        'columns', (
          SELECT json_agg(
            json_build_object(
              'name', attname,
              'type', pg_catalog.format_type(atttypid, atttypmod),
              'nullable', NOT attnotnull,
              'default', adsrc
            )
          )
          FROM pg_attribute
          LEFT JOIN pg_attrdef ON adrelid = attrelid AND adnum = attnum
          WHERE attrelid = ('public.' || t.tablename)::regclass
          AND attnum > 0
          AND NOT attisdropped
        )
      )
    )
  ) as result
FROM pg_tables t
WHERE schemaname = 'public'
AND tablename NOT LIKE 'pg_%'
AND tablename NOT LIKE 'sql_%';
`;

const culturereset_sql = `
-- CULTURERESET DATABASE - EXTRACT ALL TABLES WITH COLUMNS
SELECT
  json_build_object(
    'database', 'culturereset',
    'tables', json_agg(
      json_build_object(
        'name', t.tablename,
        'columns', (
          SELECT json_agg(
            json_build_object(
              'name', attname,
              'type', pg_catalog.format_type(atttypid, atttypmod),
              'nullable', NOT attnotnull,
              'default', adsrc
            )
          )
          FROM pg_attribute
          LEFT JOIN pg_attrdef ON adrelid = attrelid AND adnum = attnum
          WHERE attrelid = ('public.' || t.tablename)::regclass
          AND attnum > 0
          AND NOT attisdropped
        )
      )
    )
  ) as result
FROM pg_tables t
WHERE schemaname = 'public'
AND tablename NOT LIKE 'pg_%'
AND tablename NOT LIKE 'sql_%';
`;

console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║ EXTRACT ALL TABLES FROM SUPABASE DATABASES                                  ║
╚══════════════════════════════════════════════════════════════════════════════╝

📋 INSTRUCTIONS:

1. Go to Supabase Dashboard
2. Select GCR project → SQL Editor → New Query
3. Copy & paste the SQL below:

${gcr_sql}

4. Execute and download results as JSON
5. Save as: gulf-coast-radar-schema.json

6. Repeat for Profiles database:

${profiles_sql}

Save as: profiles-schema.json

7. Repeat for CultureReset database:

${culturereset_sql}

Save as: culturereset-schema.json

═══════════════════════════════════════════════════════════════════════════════

📌 OR use command line if you have credentials:

export SUPABASE_URL="your_url"
export SUPABASE_KEY="your_key"

psql postgresql://postgres:password@db.supabase.co:5432/postgres \\
  -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" \\
  > table_count.txt

═══════════════════════════════════════════════════════════════════════════════
`);
