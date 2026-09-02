import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import type { Handler, HandlerEvent } from '@netlify/functions';

export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function database() {
  if (!process.env.DATABASE_URL) throw new Error('Database unavailable');
  return neon(process.env.DATABASE_URL);
}
export function origin() {
  const value = process.env.APP_ORIGIN;
  if (!value) throw new Error('APP_ORIGIN must be configured');
  const url = new URL(value);
  if (url.origin !== value || (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('APP_ORIGIN must be an HTTPS origin (or local development origin)');
  }
  return url;
}
export function cookieName() { return origin().protocol === 'https:' ? '__Host-irl_admin' : 'irl_admin_dev'; }
export function sessionToken(event: HandlerEvent) {
  const value = (event.headers.cookie || '').split(';').map(part => part.trim())
    .find(part => part.startsWith(`${cookieName()}=`))?.split('=')[1];
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export function sessionCookie(token: string, clear = false) {
  return `${cookieName()}=${clear ? '' : token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : 28800}${origin().protocol === 'https:' ? '; Secure' : ''}`;
}
export function sameOrigin(event: HandlerEvent) { return event.headers.origin === origin().origin; }
export const reply = (statusCode: number, body: unknown, headers: Record<string, string> = {}) => ({
  statusCode,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store, private', 'x-content-type-options': 'nosniff', ...headers },
  body: JSON.stringify(body),
});
export async function currentAdmin(event: HandlerEvent) {
  const token = sessionToken(event);
  if (!token) return null;
  const sql = database();
  const rows = await sql`
    select u.id, u.email, u.name, u.role from public.irl_admin_sessions s
    join public.irl_admin_users u on u.id = s.user_id
    where s.token_hash = ${digest(token)} and s.expires_at > now()
      and u.active = true and u.role = 'admin'
    limit 1
  `;
  return rows[0] || null;
}
export function adminOnly(handler: Handler): Handler {
  return async (event, context) => {
    try {
      if (!['GET', 'HEAD'].includes(event.httpMethod) && !sameOrigin(event)) {
        return reply(403, { error: 'Request origin is not allowed.' });
      }
      if (!await currentAdmin(event)) return reply(401, { error: 'Please sign in with an IRL administrator account.' });
      return await handler(event, context);
    } catch (error) {
      console.error('Admin request failed', error);
      return reply(503, { error: 'The admin service is temporarily unavailable. Please try again.' });
    }
  };
}
