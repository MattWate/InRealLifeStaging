import type { Handler } from '@netlify/functions';
import { randomBytes } from 'node:crypto';
import { verifyPassword } from '../lib/password.mjs';
import { currentAdmin, database, digest, reply, sameOrigin, sessionCookie, sessionToken } from '../lib/admin-auth';

export const handler: Handler = async event => {
  try {
    if (event.httpMethod === 'GET') {
      const user = await currentAdmin(event);
      return reply(user ? 200 : 401, { user });
    }
    if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed.' }, { Allow: 'GET, POST' });
    if (!sameOrigin(event)) return reply(403, { error: 'Request origin is not allowed.' });
    if ((event.body?.length || 0) > 4096) return reply(400, { error: 'Invalid sign-in request.' });
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return reply(400, { error: 'Invalid sign-in request.' }); }
    if (!body || typeof body !== 'object') return reply(400, { error: 'Invalid sign-in request.' });
    const sql = database();
    if (body.action === 'logout') {
      const token = sessionToken(event);
      if (token) await sql`delete from public.irl_admin_sessions where token_hash = ${digest(token)}`;
      return reply(200, { ok: true }, { 'set-cookie': sessionCookie('', true) });
    }
    if (body.action !== 'login' || typeof body.email !== 'string' || typeof body.password !== 'string'
      || body.email.length > 254 || body.password.length > 512) return reply(400, { error: 'Enter your email and password.' });
    const email = body.email.trim().toLowerCase();
    // Netlify supplies this address; do not trust a client-supplied X-Forwarded-For.
    const ip = event.headers['x-nf-client-connection-ip'] || 'unknown';
    for (const [key, limit] of [[`email:${email}`, 8], [`ip:${ip}`, 30]] as const) {
      const rows = await sql`
        insert into public.irl_login_limits (key_hash, attempts, reset_at)
        values (${digest(key)}, 1, now() + interval '15 minutes')
        on conflict (key_hash) do update set
          attempts = case when irl_login_limits.reset_at <= now() then 1 else irl_login_limits.attempts + 1 end,
          reset_at = case when irl_login_limits.reset_at <= now() then now() + interval '15 minutes' else irl_login_limits.reset_at end
        returning attempts
      `;
      if (Number(rows[0].attempts) > limit) return reply(429, { error: 'Too many sign-in attempts. Please try again in 15 minutes.' }, { 'retry-after': '900' });
    }
    const users = await sql`select id, email, name, password_hash, role, active from public.irl_admin_users where email = ${email} limit 1`;
    const user = users[0];
    // Neon SQL Editor accounts use pgcrypto's bcrypt hashes. Existing CLI-created
    // scrypt accounts remain valid. Accept bounded costs to avoid unbounded KDF work.
    const bcrypt = /^\$2a\$1[0-4]\$[./A-Za-z0-9]{53}$/.test(user?.password_hash || '');
    let valid: boolean;
    if (bcrypt) {
      // Bcrypt truncates after 72 bytes. Reject longer input instead of accepting
      // a different password with the same prefix. PostgreSQL text excludes NUL.
      if (Buffer.byteLength(body.password, 'utf8') > 72 || body.password.includes('\0')) valid = false;
      else {
        const checked = await sql`select crypt(${body.password}, ${user.password_hash}) = ${user.password_hash} as valid`;
        valid = checked[0]?.valid === true;
      }
    } else valid = await verifyPassword(body.password, user?.password_hash || null);
    if (!valid || !user?.active || user.role !== 'admin') return reply(401, { error: 'Email or password is incorrect, or admin access is unavailable.' });
    const token = randomBytes(32).toString('hex');
    const previous = sessionToken(event);
    await sql.transaction([
      sql`delete from public.irl_admin_sessions where expires_at <= now() or token_hash = ${digest(previous || '')}`,
      sql`delete from public.irl_login_limits where reset_at <= now() or key_hash = ${digest(`email:${email}`)}`,
      sql`insert into public.irl_admin_sessions (token_hash, user_id, expires_at) values (${digest(token)}, ${user.id}::uuid, now() + interval '8 hours')`,
    ]);
    return reply(200, { user: { id: user.id, email: user.email, name: user.name, role: user.role } }, { 'set-cookie': sessionCookie(token) });
  } catch (error) {
    console.error('Admin authentication failed', error);
    return reply(503, { error: 'Sign-in is temporarily unavailable. Please contact your IRL administrator.' });
  }
};
