import { adminOnly } from '../lib/admin-auth';
import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

type Payload = Record<string, any>;

export const handler: Handler = adminOnly(async (event) => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return reply(500, { error: 'DATABASE_URL is not configured.' });
  const sql = neon(databaseUrl);

  try {
    if (event.httpMethod === 'GET') {
      const id = event.queryStringParameters?.id;
      const [benchmarks, scenarios] = await Promise.all([
        sql`select id, code, name, rate_per_experience, tier, confidence_level, evidence_note, source_note
            from public.rate_engine_benchmarks where active=true order by sort_order desc, name`,
        id
          ? sql`select * from public.rate_engine_scenarios where id=${id}::uuid limit 1`
          : sql`select s.*, b.code as benchmark_code, b.name as benchmark_name
                from public.rate_engine_scenarios s
                left join public.rate_engine_benchmarks b on b.id=s.benchmark_id
                where s.status <> 'archived'
                order by s.updated_at desc limit 50`,
      ]);
      return reply(200, id ? { benchmarks, scenario: scenarios[0] || null } : { benchmarks, scenarios });
    }

    if (event.httpMethod === 'POST' || event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}') as Payload;
      const brandName = String(body.brand_name || '').trim();
      if (!brandName) return reply(400, { error: 'Enter a brand name before saving.' });

      const benchmarkRows = body.benchmark_code
        ? await sql`select id from public.rate_engine_benchmarks where code=${body.benchmark_code} and active=true limit 1`
        : [];
      const benchmarkId = benchmarkRows[0]?.id || null;
      const name = String(body.name || `${brandName} rate estimate`).trim();
      const values = {
        exposure: score(body.exposure_score),
        interaction: score(body.interaction_score),
        environment: score(body.environment_score),
        context: score(body.context_score),
      };
      const index = values.exposure && values.interaction && values.environment && values.context
        ? values.exposure * values.interaction * values.environment * values.context
        : null;
      const indexTier = index == null ? null : index >= 300 ? 'high' : index >= 150 ? 'medium' : index >= 60 ? 'low' : 'below_threshold';
      const recommendedRate = numberOrNull(body.recommended_rate);
      const rooms = integerOrNull(body.rooms_in_scope);
      const days = integerOrNull(body.campaign_days);
      const occupancy = numberOrNull(body.average_occupancy_percentage);
      const guests = numberOrNull(body.average_guests_per_room);
      const roomNights = rooms && days && occupancy ? Math.round(rooms * days * occupancy / 100) : null;
      const experiences = roomNights && guests ? Math.round(roomNights * guests) : null;
      const fee = experiences && recommendedRate != null ? experiences * recommendedRate : null;
      const status = ['draft','ready_for_review','approved','archived'].includes(body.status) ? body.status : 'draft';

      const rows = body.id ? await sql`
        update public.rate_engine_scenarios set
          name=${name}, brand_name=${brandName}, benchmark_id=${benchmarkId},
          exposure_score=${values.exposure}, interaction_score=${values.interaction}, environment_score=${values.environment}, context_score=${values.context},
          irl_index=${index}, index_tier=${indexTier}, recommended_rate=${recommendedRate},
          rooms_in_scope=${rooms}, campaign_days=${days}, average_occupancy_percentage=${occupancy}, average_guests_per_room=${guests},
          estimated_room_nights=${roomNights}, estimated_experiences=${experiences}, estimated_campaign_fee=${fee},
          rationale=${empty(body.rationale)}, assumptions=${empty(body.assumptions)}, status=${status}, updated_at=now()
        where id=${body.id}::uuid returning *
      ` : await sql`
        insert into public.rate_engine_scenarios (
          name, brand_name, benchmark_id, exposure_score, interaction_score, environment_score, context_score,
          irl_index, index_tier, recommended_rate, rooms_in_scope, campaign_days,
          average_occupancy_percentage, average_guests_per_room, estimated_room_nights,
          estimated_experiences, estimated_campaign_fee, rationale, assumptions, status
        ) values (
          ${name}, ${brandName}, ${benchmarkId}, ${values.exposure}, ${values.interaction}, ${values.environment}, ${values.context},
          ${index}, ${indexTier}, ${recommendedRate}, ${rooms}, ${days}, ${occupancy}, ${guests}, ${roomNights},
          ${experiences}, ${fee}, ${empty(body.rationale)}, ${empty(body.assumptions)}, ${status}
        ) returning *
      `;

      return reply(200, { scenario: rows[0] });
    }

    return reply(405, { error: 'Method not allowed.' });
  } catch (error) {
    console.error('Rate engine API failed', error);
    return reply(500, { error: readableError(error) });
  }
});

function score(value: unknown) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}
function numberOrNull(value: unknown) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function integerOrNull(value: unknown) {
  const n = numberOrNull(value);
  return n == null ? null : Math.round(n);
}
function empty(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}
function readableError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String((error as any).message);
  return 'Unknown database error.';
}
function reply(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) };
}
