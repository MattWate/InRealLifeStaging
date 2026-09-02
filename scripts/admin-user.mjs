import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { neon } from '@neondatabase/serverless';
import { hashPassword } from '../netlify/lib/password.mjs';

const [emailArg, nameArg] = process.argv.slice(2);
const email = (emailArg || '').trim().toLowerCase();
const name = (nameArg || '').trim();
if (!process.env.DATABASE_URL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || !process.stdin.isTTY) {
  console.error('Set DATABASE_URL, then run in a terminal: node scripts/admin-user.mjs <email> "Full name"');
  process.exit(1);
}
let muted = false;
const output = new Writable({ write(chunk, encoding, callback) { if (!muted) process.stdout.write(chunk, encoding); callback(); } });
const rl = createInterface({ input: process.stdin, output, terminal: true });
try {
  muted = true; process.stdout.write('New password (at least 12 characters): ');
  const password = await rl.question(''); process.stdout.write('\nConfirm password: ');
  const confirmation = await rl.question(''); process.stdout.write('\n');
  if (password.length < 12 || password.length > 512 || password !== confirmation) throw new Error('Passwords must match and contain 12–512 characters.');
  const encoded = await hashPassword(password);
  const sql = neon(process.env.DATABASE_URL);
  await sql.transaction([
    sql`insert into public.irl_admin_users (email, name, password_hash, role, active)
      values (${email}, ${name}, ${encoded}, 'admin', true)
      on conflict (email) do update set name = excluded.name, password_hash = excluded.password_hash, role = 'admin', active = true`,
    sql`delete from public.irl_admin_sessions where user_id = (select id from public.irl_admin_users where email = ${email})`,
  ]);
  console.log('Administrator account saved. Existing sessions for this account have been revoked.');
} catch (error) {
  // Do not print database errors: they can contain query parameters or connection information.
  console.error(error.message.startsWith('Passwords') ? error.message : 'Account setup failed. Check the database connection and admin migration.');
  process.exitCode = 1;
} finally { muted = false; rl.close(); }
