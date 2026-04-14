#!/usr/bin/env node
// Reset admin user password in Supabase
// Usage: node tools/reset-admin-password.js newpassword
//    or: NEW_PASS=yourpassword node tools/reset-admin-password.js

require('dotenv').config();
const bcrypt = require('bcrypt');
const supabase = require('../db');

const newPassword = process.argv[2] || process.env.NEW_PASS;

if (!newPassword) {
  console.error('Usage: node tools/reset-admin-password.js <newpassword>');
  process.exit(1);
}

async function run() {
  // First find the admin user
  const { data: admins, error } = await supabase
    .from('users')
    .select('id, name, email, role')
    .eq('role', 'admin');

  if (error) { console.error('DB error:', error.message); process.exit(1); }
  if (!admins || admins.length === 0) { console.error('No admin users found in users table.'); process.exit(1); }

  console.log('Found admin users:');
  admins.forEach(u => console.log(`  id=${u.id}  email=${u.email}  name=${u.name}`));

  const hash = await bcrypt.hash(newPassword, 10);

  // Update all admin users
  const { error: updateErr } = await supabase
    .from('users')
    .update({ password_hash: hash })
    .eq('role', 'admin');

  if (updateErr) { console.error('Update failed:', updateErr.message); process.exit(1); }

  console.log(`\n✓ Password updated for ${admins.length} admin user(s).`);
  console.log(`  Login with email: ${admins[0].email} or name: ${admins[0].name}`);
  console.log(`  Password: ${newPassword}`);
}

run();
