#!/bin/bash
# Run all Supabase schema files in order
# Usage: ./run-all-schemas.sh

echo "📊 Concatenating all SQL schema files..."

cat \
  01-tables.sql \
  02-security.sql \
  03-seed-data.sql \
  04-ai-webhook.sql \
  05-storage-policies.sql \
  06-analytics-seo-social.sql \
  > combined-schema.sql

echo "✅ Combined schema created: combined-schema.sql"
echo "📋 Copying to clipboard..."

cat combined-schema.sql | pbcopy

echo "✅ SQL copied to clipboard!"
echo ""
echo "Next steps:"
echo "1. Go to Supabase SQL Editor"
echo "2. Click 'New Query'"
echo "3. Paste (Cmd+V)"
echo "4. Click 'Run'"
echo ""
echo "Total size: $(wc -l < combined-schema.sql) lines"
