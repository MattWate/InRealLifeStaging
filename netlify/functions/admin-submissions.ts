import { adminOnly, database, reply } from '../lib/admin-auth';

export const handler = adminOnly(async event => {
  if (event.httpMethod !== 'GET') return reply(405, { error: 'Method not allowed.' });
  const sql = database();
  const params = event.queryStringParameters || {};
  const id = params.id;
  if (id) {
    if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) return reply(400, { error: 'Invalid submission.' });
    const rows = await sql`
      select s.id, s.onboarding_type as type, s.submitted_at, o.name, o.primary_email as email,
        p.name as property_name, snap.answers as snapshot
      from public.onboarding_sessions s join public.organisations o on o.id = s.organisation_id
      left join public.properties p on p.id = s.property_id
      left join public.irl_submission_snapshots snap on snap.session_id = s.id
      where s.id = ${id}::uuid and s.status = 'submitted' and s.onboarding_type in ('brand', 'operator') limit 1
    `;
    if (!rows.length) return reply(404, { error: 'Completed submission not found.' });
    const { snapshot, ...submission } = rows[0];
    const answers = snapshot ? Object.entries(snapshot).map(([field_key, answer_json]) => ({ field_key, answer_json }))
      : await sql`select section_key, field_key, answer_json from public.onboarding_answers where onboarding_session_id = ${id}::uuid order by section_key, field_key`;
    return reply(200, { submission, answers });
  }
  const type = params.type || 'all';
  if (!['all', 'brand', 'operator'].includes(type)) return reply(400, { error: 'Invalid submission type.' });
  const page = Math.max(1, Math.min(100000, Number.parseInt(params.page || '1', 10) || 1));
  const search = (params.q || '').trim().slice(0, 150);
  const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
  const rows = await sql`
    select s.id, s.onboarding_type as type, s.submitted_at, o.name, o.primary_email as email,
      p.name as property_name
    from public.onboarding_sessions s join public.organisations o on o.id = s.organisation_id
    left join public.properties p on p.id = s.property_id
    where s.status = 'submitted' and s.onboarding_type in ('brand','operator')
      and (${type} = 'all' or s.onboarding_type = ${type})
      and (${search} = '' or o.name ilike ${pattern} or o.primary_email ilike ${pattern} or p.name ilike ${pattern})
    order by s.submitted_at desc nulls last, s.id desc limit 26 offset ${(page - 1) * 25}
  `;
  const counts = await sql`
    select count(*)::int as total,
      count(*) filter (where onboarding_type = 'brand')::int as brands,
      count(*) filter (where onboarding_type = 'operator')::int as operators
    from public.onboarding_sessions where status = 'submitted' and onboarding_type in ('brand','operator')
  `;
  return reply(200, { submissions: rows.slice(0, 25), hasMore: rows.length > 25, page, counts: counts[0] });
});
