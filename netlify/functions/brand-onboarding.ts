import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { saveBrandOnboarding, type BrandPayload } from './brand-onboarding-save';

export const handler: Handler = async (event) => {
  if (!['POST', 'PUT'].includes(event.httpMethod)) return reply(405, { error: 'Method not allowed.' });
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return reply(500, { error: 'DATABASE_URL is not configured.' });

  try {
    const body = JSON.parse(event.body || '{}') as BrandPayload;
    if (body.flow !== 'brand') return reply(400, { error: 'This endpoint supports brand onboarding only.' });
    const sql = neon(databaseUrl);
    const result = await saveBrandOnboarding(sql, body);
    return reply(200, result);
  } catch (error) {
    console.error('Brand onboarding save failed', error);
    return reply(500, { error: readableError(error) });
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
