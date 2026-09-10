import { adminOnly, database, reply } from '../lib/admin-auth';

export const handler = adminOnly(async event => {
  if (!['GET', 'PATCH'].includes(event.httpMethod)) return reply(405, { error: 'Method not allowed.' });
  const sql = database();
  if (event.httpMethod === 'PATCH') {
    if ((event.body?.length || 0) > 16384) return reply(413, { error: 'The update is too large.' });
    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const id = typeof body.id === 'string' ? body.id : '';
    if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) return reply(400, { error: 'Invalid application.' });
    const reviewStatus = typeof body.review_status === 'string' ? body.review_status : '';
    const allowed = ['in_progress', 'needs_review', 'in_review', 'approved', 'changes_requested', 'rejected'];
    if (!allowed.includes(reviewStatus)) return reply(400, { error: 'Invalid review status.' });
    const notes = typeof body.review_notes === 'string' ? body.review_notes.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const propertyName = typeof body.property_name === 'string' ? body.property_name.trim() : '';
    if (!name || name.length > 200 || email.length > 254 || notes.length > 10000 || propertyName.length > 200) return reply(400, { error: 'Check the application details and try again.' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { error: 'Enter a valid contact email.' });
    const sessions = await sql`select id, organisation_id, property_id, schema_version from public.onboarding_sessions where id=${id}::uuid and onboarding_type in ('brand','operator') limit 1`;
    if (!sessions.length) return reply(404, { error: 'Application not found.' });
    const session = sessions[0];
    await sql.transaction([
      sql`update public.organisations set name=${name}, primary_email=${email || null}, metadata=jsonb_set(coalesce(metadata,'{}'::jsonb),'{admin_review}',${JSON.stringify({ status: reviewStatus, notes, updated_at: new Date().toISOString() })}::jsonb,true), updated_at=now() where id=${session.organisation_id}::uuid`,
      session.property_id && propertyName ? sql`update public.properties set name=${propertyName}, updated_at=now() where id=${session.property_id}::uuid and operator_organisation_id=${session.organisation_id}::uuid` : sql`select 1`,
      sql`insert into public.onboarding_audit_log (onboarding_session_id,organisation_id,event_type,schema_version,details) values (${id}::uuid,${session.organisation_id}::uuid,'admin_review_updated',${session.schema_version || null},${JSON.stringify({ status: reviewStatus })}::jsonb)`,
    ]);
    return reply(200, { ok: true });
  }
  const params = event.queryStringParameters || {};
  const id = params.id;
  if (id) {
    if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) return reply(400, { error: 'Invalid submission.' });
    const rows = await sql`
      select s.id, s.onboarding_type as type, s.status, s.current_step, s.completion_percentage,
        s.submitted_at, s.updated_at, o.name, o.primary_email as email,
        p.name as property_name, s.schema_version, snap.answers as snapshot,
        coalesce(o.metadata #>> '{admin_review,status}', case when o.status='approved' then 'approved' when s.status='submitted' then 'needs_review' else 'in_progress' end) as review_status,
        coalesce(o.metadata #>> '{admin_review,notes}', '') as review_notes,
        coalesce((select bool_or(a.review_required) from public.brand_audience_profiles a where a.onboarding_session_id = s.id), false) as audience_review_required,
        coalesce((select bool_or(bp.legal_review_required) from public.brand_onboarding_products bp where bp.onboarding_session_id = s.id), false) as legal_review_required
      from public.onboarding_sessions s join public.organisations o on o.id = s.organisation_id
      left join public.properties p on p.id = s.property_id
      left join public.irl_submission_snapshots snap on snap.session_id = s.id
      where s.id = ${id}::uuid and s.onboarding_type in ('brand', 'operator') limit 1
    `;
    if (!rows.length) return reply(404, { error: 'Application not found.' });
    const { snapshot, ...submission } = rows[0];
    const answers = snapshot ? Object.entries(snapshot).map(([field_key, answer_json]) => ({ field_key, answer_json }))
      : await sql`select section_key, field_key, answer_json from public.onboarding_answers where onboarding_session_id = ${id}::uuid order by section_key, field_key`;
    return reply(200, { submission, answers });
  }
  const type = params.type || 'all';
  if (!['all', 'brand', 'operator'].includes(type)) return reply(400, { error: 'Invalid submission type.' });
  const status = params.status || 'all';
  if (!['all', 'in_progress', 'needs_review', 'in_review', 'approved', 'changes_requested', 'rejected'].includes(status)) return reply(400, { error: 'Invalid application status.' });
  const page = Math.max(1, Math.min(100000, Number.parseInt(params.page || '1', 10) || 1));
  const search = (params.q || '').trim().slice(0, 150);
  const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
  const rows = await sql`
    select s.id, s.onboarding_type as type, s.status, s.current_step, s.completion_percentage,
      s.submitted_at, s.updated_at, o.name, o.primary_email as email,
      p.name as property_name, s.schema_version,
      coalesce(o.metadata #>> '{admin_review,status}', case when o.status='approved' then 'approved' when s.status='submitted' then 'needs_review' else 'in_progress' end) as review_status,
      coalesce((select bool_or(a.review_required) from public.brand_audience_profiles a where a.onboarding_session_id = s.id), false) as audience_review_required,
      coalesce((select bool_or(bp.legal_review_required) from public.brand_onboarding_products bp where bp.onboarding_session_id = s.id), false) as legal_review_required
    from public.onboarding_sessions s join public.organisations o on o.id = s.organisation_id
    left join public.properties p on p.id = s.property_id
    where s.onboarding_type in ('brand','operator')
      and (${type} = 'all' or s.onboarding_type = ${type})
      and (${status} = 'all' or coalesce(o.metadata #>> '{admin_review,status}', case when o.status='approved' then 'approved' when s.status='submitted' then 'needs_review' else 'in_progress' end) = ${status})
      and (${search} = '' or o.name ilike ${pattern} or o.primary_email ilike ${pattern} or p.name ilike ${pattern})
    order by s.updated_at desc nulls last, s.id desc limit 26 offset ${(page - 1) * 25}
  `;
  const counts = await sql`
    with applications as (
      select s.onboarding_type,
        coalesce(o.metadata #>> '{admin_review,status}', case when o.status='approved' then 'approved' when s.status='submitted' then 'needs_review' else 'in_progress' end) as review_status
      from public.onboarding_sessions s join public.organisations o on o.id=s.organisation_id
      where s.onboarding_type in ('brand','operator')
    )
    select count(*)::int as total,
      count(*) filter (where onboarding_type = 'brand')::int as brands,
      count(*) filter (where onboarding_type = 'operator')::int as operators,
      count(*) filter (where review_status = 'in_progress')::int as in_progress,
      count(*) filter (where review_status in ('needs_review','in_review','changes_requested'))::int as review,
      count(*) filter (where review_status = 'approved')::int as approved
    from applications
  `;
  return reply(200, { submissions: rows.slice(0, 25), hasMore: rows.length > 25, page, counts: counts[0] });
});
