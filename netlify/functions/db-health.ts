import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

export const handler: Handler = async () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'DATABASE_URL is not configured.' }),
    };
  }

  try {
    const sql = neon(databaseUrl);
    const result = await sql`select now() as database_time`;

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, databaseTime: result[0]?.database_time }),
    };
  } catch (error) {
    console.error('Database health check failed', error);
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Database connection failed.' }),
    };
  }
};
