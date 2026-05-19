-- RUN THIS IN SUPABASE SQL EDITOR FOR EACH DATABASE

-- GET COUNT OF ALL PUBLIC TABLES
SELECT COUNT(*) as total_tables 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- GET ALL TABLE NAMES
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- GET ALL TABLES WITH COLUMN INFO (AS JSON)
SELECT json_agg(
  json_build_object(
    'table', t.table_name,
    'columns', (
      SELECT json_agg(
        json_build_object(
          'name', column_name,
          'type', data_type,
          'nullable', is_nullable
        )
        ORDER BY ordinal_position
      )
      FROM information_schema.columns c
      WHERE c.table_name = t.table_name
      AND c.table_schema = 'public'
    )
  )
  ORDER BY t.table_name
) as schema_info
FROM information_schema.tables t
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE';
