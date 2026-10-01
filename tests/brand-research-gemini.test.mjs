import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { configure, calls } from './sql-mock.mjs';
import {
  BRAND_RESEARCH_SCHEMA_VERSION,
} from '../netlify/lib/brand-research-schema.ts';
import {
  buildBrandResearchPrompt,
  generateBrandResearch,
  GEMINI_INTERACTIONS_URL,
} from '../netlify/lib/brand-research-gemini.ts';
import { handler as generateResearch } from '../netlify/functions/admin-brand-research-generate.ts';

process.env.APP_ORIGIN = 'https://irl.example';
process.env.DATABASE_URL = 'test-only';

const valid = JSON.parse(readFileSync(new URL('./fixtures/brand-research-nomu-valid.json', import.meta.url), 'utf8'));
const token = 'b'.repeat(64);
const adminId = '11111111-1111-4111-8111-111111111111';
const request = body => ({
  httpMethod: 'POST',
  headers: { origin: process.env.APP_ORIGIN, cookie: `__Host-irl_admin=${token}`, 'content-type': 'application/json' },
  body: JSON.stringify(body),
  queryStringParameters: {},
});

test('Gemini prompt treats web pages as untrusted and carries opportunity context', () => {
  const prompt = buildBrandResearchPrompt('https://brand.example', 'Prioritise the travel range.');
  assert.match(prompt, /https:\/\/brand\.example/);
  assert.match(prompt, /untrusted source material/);
  assert.match(prompt, /Prioritise the travel range/);
  assert.match(prompt, /audience\.description/);
});

test('Gemini generation uses URL context, search and structured output before contract validation', async () => {
  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({
      interaction: {
        output_text: JSON.stringify(valid),
        steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(valid), annotations: [{ type: 'url_citation', url: 'https://nomu.co.za', title: 'NOMU' }] }] }],
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const result = await generateBrandResearch('https://nomu.co.za', 'Hospitality opportunity', {
    apiKey: 'secret-test-key',
    model: 'gemini-test',
    fetchImpl,
    now: () => new Date('2026-10-01T10:00:00.000Z'),
  });

  assert.equal(captured.url, GEMINI_INTERACTIONS_URL);
  assert.equal(captured.init.headers['x-goog-api-key'], 'secret-test-key');
  assert.deepEqual(captured.body.tools, [{ type: 'url_context' }, { type: 'google_search' }]);
  assert.equal(captured.body.response_format.mime_type, 'application/json');
  assert.equal(result.research.schema_version, BRAND_RESEARCH_SCHEMA_VERSION);
  assert.equal(result.research.generator.model, 'gemini-test');
  assert.equal(result.research.brand.match_hints.website, 'https://nomu.co.za');
  assert.equal(result.validation.valid, true);
  assert.deepEqual(result.citations, ['https://nomu.co.za']);
});

test('generated documents that fail semantic validation are returned as editable invalid drafts', async () => {
  const invalid = structuredClone(valid);
  invalid.claims[0].entity_key = 'missing_brand';
  const fetchImpl = async () => new Response(JSON.stringify({ output_text: JSON.stringify(invalid) }), { status: 200 });
  const result = await generateBrandResearch('https://nomu.co.za', '', { apiKey: 'test', fetchImpl });
  assert.equal(result.validation.valid, false);
  assert(result.validation.errors.some(error => error.code === 'unknown_entity'));
  assert.equal(result.research.brand.reference_name, 'NOMU');
});

test('generation endpoint requires an authenticated admin and rejects private or non-HTTPS URLs', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  configure(query => query.includes('join public.irl_admin_users')
    ? [{ id: adminId, email: 'admin@example.com', name: 'Admin', role: 'admin' }]
    : []);

  const anonymous = request({ website: 'https://nomu.co.za' });
  anonymous.headers.cookie = '';
  assert.equal((await generateResearch(anonymous, {})).statusCode, 401);

  const insecure = await generateResearch(request({ website: 'http://nomu.co.za' }), {});
  assert.equal(insecure.statusCode, 400);
  const local = await generateResearch(request({ website: 'https://127.0.0.1/secret' }), {});
  assert.equal(local.statusCode, 400);
  assert.equal(calls.filter(call => call.query.includes('join public.irl_admin_users')).length, 2);
});
