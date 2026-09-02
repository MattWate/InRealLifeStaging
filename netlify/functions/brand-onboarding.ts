import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { saveBrandOnboarding, type BrandPayload } from './brand-onboarding-save';
import { validateSubmission } from '../lib/onboarding-validation';

export const handler: Handler = async (event) => {
  if (!['POST', 'PUT'].includes(event.httpMethod)) return reply(405, { error: 'Method not allowed.' });
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return reply(500, { error: 'DATABASE_URL is not configured.' });

  try {
    if ((event.body?.length || 0) > 262144) return reply(413, { error: 'This form is too large to save.' });
    const body = JSON.parse(event.body || '{}') as BrandPayload;
    const invalid = validateSubmission(body, 'brand');
    if (invalid) return reply(400, { error: invalid });
    if (body.flow !== 'brand') return reply(400, { error: 'This endpoint supports brand onboarding only.' });
    const sql = neon(databaseUrl);
    const result = await saveBrandOnboarding(sql, body);
    return reply(200, result);
  } catch (error) {
    console.error('Brand onboarding save failed', error);
    return reply(error instanceof SyntaxError ? 400 : 500, { error: error instanceof SyntaxError ? 'Invalid request.' : 'Unable to save online. Please try again.' });
  }
};

function readableError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
  return 'Unknown database error.';
}

function reply(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  };
}
