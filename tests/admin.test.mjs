import test from 'node:test';
import assert from 'node:assert/strict';
import { configure, calls } from './sql-mock.mjs';
import { hashPassword, verifyPassword } from '../netlify/lib/password.mjs';
import { adminOnly, digest, sessionCookie, sessionToken } from '../netlify/lib/admin-auth.ts';
import { handler as auth } from '../netlify/functions/admin-auth.ts';
import { handler as submissions } from '../netlify/functions/admin-submissions.ts';
import { validateSubmission } from '../netlify/lib/onboarding-validation.ts';
import { saveBrandOnboarding } from '../netlify/functions/brand-onboarding-save.ts';
import { handler as operator } from '../netlify/functions/onboarding.ts';
import { neon } from './sql-mock.mjs';

process.env.APP_ORIGIN = 'https://irl.example';
process.env.DATABASE_URL = 'test-only';
const token = 'a'.repeat(64);
const id = '11111111-1111-1111-1111-111111111111';
const event = (method = 'GET', body = null, headers = {}) => ({ httpMethod: method, headers, body: body == null ? null : JSON.stringify(body), queryStringParameters: {} });
const signed = () => event('GET', null, { cookie: `__Host-irl_admin=${token}` });

test('salted password hashes validate only the correct password', async () => {
  const a = await hashPassword('a long test password'); const b = await hashPassword('a long test password');
  assert.notEqual(a, b); assert(await verifyPassword('a long test password', a));
  assert.equal(await verifyPassword('wrong password', a), false);
  assert.equal(await verifyPassword('anything', null), false);
});
test('cookies are host-only, secure, HttpOnly, strict and bounded', () => {
  const cookie = sessionCookie(token); for (const value of ['__Host-', 'Secure', 'HttpOnly', 'SameSite=Strict', 'Max-Age=28800', 'Path=/']) assert(cookie.includes(value));
  assert(!cookie.includes('Domain=')); assert(sessionCookie('', true).includes('Max-Age=0'));
  assert.equal(sessionToken(event('GET', null, { cookie: '__Host-irl_admin=forged' })), null);
});
test('anonymous API access is rejected before querying submissions', async () => {
  configure(); const result = await submissions(event(), {}); assert.equal(result.statusCode, 401); assert.equal(calls.length, 0);
});
test('expired, revoked or non-admin session returns no data; role and expiry checked server-side', async () => {
  configure(query => { assert(query.includes("u.role = 'admin'")); assert(query.includes('u.active = true')); assert(query.includes('s.expires_at > now()')); return []; });
  const result = await submissions(signed(), {}); assert.equal(result.statusCode, 401); assert.equal(calls.length, 1);
  assert.equal(calls[0].values[0], digest(token));
});
test('cross-origin mutations rejected before authentication or database access', async () => {
  configure(); const result = await adminOnly(async () => { throw new Error('must not run'); })(event('POST', {}, { origin: 'https://evil.example' }), {});
  assert.equal(result.statusCode, 403); assert.equal(calls.length, 0);
  assert.equal((await auth(event('POST', { action: 'login' }, { origin: 'https://evil.example' }), {})).statusCode, 403);
});
test('logout deletes the server session and expires the cookie', async () => {
  configure(); const result = await auth(event('POST', { action: 'logout' }, { origin: process.env.APP_ORIGIN, cookie: `__Host-irl_admin=${token}` }), {});
  assert.equal(result.statusCode, 200); assert(result.headers['set-cookie'].includes('Max-Age=0')); assert.equal(calls[0].values[0], digest(token));
});
test('login rate limit is enforced before checking passwords', async () => {
  configure(() => [{ attempts: 31 }]);
  const result = await auth(event('POST', { action: 'login', email: 'test@example.com', password: 'test' }, { origin: process.env.APP_ORIGIN }), {});
  assert.equal(result.statusCode, 429); assert.equal(calls.length, 1);
});
test('valid login creates an opaque session and never returns a password hash', async () => {
  const password_hash = await hashPassword('correct horse battery staple');
  configure(query => query.includes('irl_login_limits') ? [{ attempts: 1 }] : query.includes('select id, email') ? [{ id, name: 'Test admin', email: 'test@example.com', password_hash, role: 'admin', active: true }] : []);
  const result = await auth(event('POST', { action: 'login', email: 'test@example.com', password: 'correct horse battery staple' }, { origin: process.env.APP_ORIGIN }), {});
  assert.equal(result.statusCode, 200); assert(!result.body.includes(password_hash));
  const raw = result.headers['set-cookie'].split(';')[0].split('=')[1];
  assert.equal(calls.find(c => c.query.startsWith('insert into public.irl_admin_sessions')).values[0], digest(raw));
});
test('dashboard queries only submitted sessions and parameterises searches', async () => {
  configure(query => query.includes('join public.irl_admin_users') ? [{ id, role: 'admin' }] : query.includes('count(*)') ? [{ total: 0, brands: 0, operators: 0 }] : []);
  const request = signed(); request.queryStringParameters = { q: "%' OR true --", type: 'brand' };
  const result = await submissions(request, {}); assert.equal(result.statusCode, 200);
  const query = calls.find(c => c.query.includes('order by s.submitted_at'));
  assert(query.query.includes("s.status = 'submitted'")); assert(!query.query.includes('OR true --')); assert(query.values.includes('brand'));
  assert(result.headers['cache-control'].includes('no-store'));
});
test('detail uses final snapshot and does not query mutable answers', async () => {
  configure(query => query.includes('join public.irl_admin_users') ? [{ id, role: 'admin' }] : [{ id, type: 'brand', name: 'Example', snapshot: { brandName: 'Final name' } }]);
  const request = signed(); request.queryStringParameters = { id };
  const result = await submissions(request, {}); assert.equal(result.statusCode, 200); assert.equal(JSON.parse(result.body).answers[0].answer_json, 'Final name');
  assert(!calls.some(c => c.query.includes('from public.onboarding_answers')));
});
test('unknown or draft submission detail is 404', async () => {
  configure(query => query.includes('join public.irl_admin_users') ? [{ id, role: 'admin' }] : []);
  const request = signed(); request.queryStringParameters = { id };
  assert.equal((await submissions(request, {})).statusCode, 404);
});
test('brand submission requires contact, product and accuracy confirmation', () => {
  const body = { flow: 'brand', submit: true, form: { brandName: 'Example', firstName: 'A', lastName: 'B', email: 'a@example.com', productName: 'Product' } };
  assert.match(validateSubmission(body, 'brand'), /Confirm/);
  body.form.profileConfirmed = 'yes'; assert.equal(validateSubmission(body, 'brand'), null);
  body.form.email = 'invalid'; assert.match(validateSubmission(body, 'brand'), /email/);
  assert.equal(validateSubmission({ flow: 'brand', form: {} }, 'brand'), null);
});
test('later brand autosaves do not modify a submitted form', async () => {
  configure(() => [{ id, organisation_id: id, status: 'submitted', submitted_at: '2026-09-02T12:00:00Z' }]);
  const result = await saveBrandOnboarding(neon(), { session_id: id, flow: 'brand', form: { brandName: 'Changed' }, submit: false });
  assert.equal(result.status, 'submitted'); assert.equal(calls.length, 1);
});
test('later operator autosaves do not modify a submitted form', async () => {
  configure(() => [{ id, organisation_id: id, status: 'submitted', submitted_at: '2026-09-02T12:00:00Z' }]);
  const result = await operator(event('POST', { session_id: id, flow: 'operator', form: { operatorName: 'Changed' }, submit: false }), {});
  assert.equal(JSON.parse(result.body).status, 'submitted'); assert.equal(calls.length, 1);
});
test('older submissions fall back to their recorded answers', async () => {
  configure(query => query.includes('join public.irl_admin_users') ? [{ id, role: 'admin' }] : query.includes('from public.onboarding_answers') ? [{ field_key: 'brandName', section_key: 'brand', answer_json: 'Legacy brand' }] : [{ id, type: 'brand', name: 'Legacy brand', snapshot: null }]);
  const request = signed(); request.queryStringParameters = { id };
  const result = await submissions(request, {}); assert.equal(JSON.parse(result.body).answers[0].answer_json, 'Legacy brand');
});
test('operator submission marks completion and snapshots final answers in one transaction', async () => {
  configure(query => query.includes('from public.onboarding_sessions') ? [{ id, organisation_id: id, property_id: id, status: 'in_progress' }] : []);
  const form = { operatorName: 'Example', operatorFirstName: 'A', operatorLastName: 'B', operatorEmail: 'a@example.com', propertyName: 'Property', spaces: [] };
  const result = await operator(event('POST', { session_id: id, flow: 'operator', form, submit: true }), {});
  assert.equal(result.statusCode, 200); assert.equal(JSON.parse(result.body).status, 'submitted');
  const tx = calls.slice(calls.findIndex(c => c.query === 'BEGIN'));
  assert(tx[1].query.startsWith('update public.onboarding_sessions'));
  assert(tx[2].query.startsWith('insert into public.irl_submission_snapshots'));
  assert.deepEqual(JSON.parse(tx[2].values[1]), form); assert.equal(tx.at(-1).query, 'COMMIT');
});
test('brand submission marks completion and snapshots final answers in one transaction', async () => {
  configure(query => query.includes('from public.onboarding_sessions') ? [{ id, organisation_id: id, status: 'in_progress' }] : query.includes('returning id') ? [{ id }] : []);
  const form = { brandName: 'Example', firstName: 'A', lastName: 'B', email: 'a@example.com', productName: 'Product', profileConfirmed: 'yes' };
  const result = await saveBrandOnboarding(neon(), { session_id: id, flow: 'brand', form, submit: true });
  assert.equal(result.status, 'submitted');
  const tx = calls.slice(calls.findIndex(c => c.query === 'BEGIN'));
  assert(tx[1].query.startsWith('update public.onboarding_sessions'));
  assert(tx[2].query.startsWith('insert into public.irl_submission_snapshots'));
  assert.deepEqual(JSON.parse(tx[2].values[1]), form); assert.equal(tx.at(-1).query, 'COMMIT');
});
test('failed finalisation reports an error rather than submission success', async () => {
  configure(query => { if (query.includes('from public.onboarding_sessions')) return [{ id, organisation_id: id, property_id: id, status: 'in_progress' }]; if (query.includes('irl_submission_snapshots')) throw new Error('test storage failure'); return []; });
  const previous = console.error; console.error = () => {};
  try {
    const result = await operator(event('POST', { session_id: id, flow: 'operator', submit: true, form: { operatorName: 'Example', operatorFirstName: 'A', operatorLastName: 'B', operatorEmail: 'a@example.com', propertyName: 'Property' } }), {});
    assert.equal(result.statusCode, 500); assert(!result.body.includes('test storage failure')); assert(!calls.some(c => c.query === 'COMMIT'));
  } finally { console.error = previous; }
});
test('onboarding requests serialize autosave and submit using the returned session ID', async () => {
  const { saveOnboarding } = await import('../src/onboarding-persistence.ts');
  const previousFetch = globalThis.fetch; const previousStorage = globalThis.localStorage;
  const storage = new Map(); const requests = []; let release;
  globalThis.localStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
  globalThis.fetch = async (url, init) => { requests.push(JSON.parse(init.body)); if (requests.length === 1) await new Promise(resolve => { release = resolve; }); return { ok: true, json: async () => ({ session_id: id, status: requests.length === 1 ? 'in_progress' : 'submitted' }) }; };
  try {
    const draft = saveOnboarding({ brandName: 'Example' }, 'brand', 'brand', 20);
    const submitted = saveOnboarding({ brandName: 'Final' }, 'brand', 'review', 100, true);
    await new Promise(resolve => setImmediate(resolve)); assert.equal(requests.length, 1); release();
    await draft; await submitted; assert.equal(requests[1].session_id, id); assert.equal(requests[1].form.brandName, 'Final'); assert.equal(requests[1].submit, true);
  } finally { globalThis.fetch = previousFetch; globalThis.localStorage = previousStorage; }
});
