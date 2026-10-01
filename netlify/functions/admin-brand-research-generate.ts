import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { adminOnly, reply } from '../lib/admin-auth';
import { generateBrandResearch, GeminiResearchError } from '../lib/brand-research-gemini';

const MAX_REQUEST_BYTES = 12 * 1024;
const requestSchema = z.object({
  website: z.string().trim().url().max(2048).refine(isPublicHttpsUrl, 'Enter a public HTTPS brand website.'),
  notes: z.string().trim().max(3000).optional().default(''),
}).strict();

export const handler: Handler = adminOnly(async event => {
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed.' }, { Allow: 'POST' });
  if (Buffer.byteLength(event.body || '', 'utf8') > MAX_REQUEST_BYTES) return reply(413, { error: 'The research request is too large.' });
  if (!process.env.GEMINI_API_KEY) return reply(503, { error: 'Gemini research has not been configured yet.' });

  let raw: unknown;
  try { raw = JSON.parse(event.body || ''); }
  catch { return reply(400, { error: 'The request is not valid JSON.' }); }
  const request = requestSchema.safeParse(raw);
  if (!request.success) return reply(400, {
    error: 'Enter a valid public HTTPS brand website.',
    details: request.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })),
  });

  try {
    const result = await generateBrandResearch(request.data.website, request.data.notes, {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL,
    });
    return reply(200, result);
  } catch (error) {
    if (error instanceof GeminiResearchError) return reply(error.statusCode, { error: error.message });
    throw error;
  }
});

function isPublicHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || !hostname) return false;
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) return false;
    if (/^(?:127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(hostname)) return false;
    if (hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80:')) return false;
    return true;
  } catch { return false; }
}
