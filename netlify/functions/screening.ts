import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

const allowedStatuses = ['researching','ready_for_review','under_review','approach','hold','rejected','contacted','converted_to_onboarding','archived'];

type Payload = Record<string, any>;

export const handler: Handler = async (event) => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return reply(500, { error: 'DATABASE_URL is not configured.' });
  const sql = neon(databaseUrl);

  try {
    if (event.httpMethod === 'GET') {
      const id = event.queryStringParameters?.id;
      if (id) return getOne(sql, id);
      return getList(sql);
    }

    if (event.httpMethod === 'POST' || event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}') as Payload;
      return saveProspect(sql, body);
    }

    return reply(405, { error: 'Method not allowed.' });
  } catch (error) {
    console.error('Screening API failed', error);
    return reply(500, { error: error instanceof Error ? error.message : 'Screening request failed.' });
  }
};

async function getList(sql: any) {
  const rows = await sql`
    select
      pp.id, pp.name, pp.slug, pp.city, pp.region, pp.country_code,
      pp.property_types, pp.status, pp.updated_at,
      op.name as operator_name,
      a.total_score, a.total_points_available, a.normalised_score,
      a.completion_percentage, a.confidence_level, a.score_tier,
      a.recommended_action, a.assessment_status
    from public.property_prospects pp
    left join public.operator_prospects op on op.id = pp.operator_prospect_id
    left join lateral (
      select * from public.property_screening_assessments psa
      where psa.property_prospect_id = pp.id
      order by psa.assessment_number desc
      limit 1
    ) a on true
    where pp.status <> 'archived'
    order by pp.updated_at desc
  `;
  return reply(200, { prospects: rows });
}

async function getOne(sql: any, id: string) {
  const properties = await sql`
    select pp.*, op.name as operator_name, op.website_url as operator_website,
      op.operator_type, op.estimated_property_count
    from public.property_prospects pp
    left join public.operator_prospects op on op.id = pp.operator_prospect_id
    where pp.id = ${id}::uuid
    limit 1
  `;
  if (!properties.length) return reply(404, { error: 'Screening record not found.' });

  const property = properties[0];
  const assessments = await sql`
    select * from public.property_screening_assessments
    where property_prospect_id = ${id}::uuid
    order by assessment_number desc
    limit 1
  `;
  const assessment = assessments[0] || null;
  const [answers, socials, notes, decisions] = await Promise.all([
    assessment ? sql`select field_key, answer_json, score_value, max_score_value, evidence_status, source_type, source_url, notes from public.property_screening_answers where assessment_id = ${assessment.id}` : [],
    sql`select platform, handle, profile_url, follower_count, engagement_notes, last_verified_at from public.property_prospect_social_channels where property_prospect_id = ${id}::uuid order by platform`,
    sql`select id, note_type, body, is_pinned, created_at from public.property_screening_notes where property_prospect_id = ${id}::uuid order by is_pinned desc, created_at desc`,
    sql`select id, decision, rationale, next_action, next_review_date, decided_at from public.property_screening_decisions where property_prospect_id = ${id}::uuid order by decided_at desc`,
  ]);
  return reply(200, { property, assessment, answers, socials, notes, decisions });
}

async function saveProspect(sql: any, body: Payload) {
  if (!String(body.name || '').trim()) return reply(400, { error: 'Property name is required.' });
  const status = allowedStatuses.includes(body.status) ? body.status : 'researching';
  const slug = slugify(body.slug || body.name) + (body.id ? '' : `-${Date.now().toString(36)}`);

  const operatorRows = body.operator_name ? await sql`
    insert into public.operator_prospects (slug, name, website_url, operator_type, estimated_property_count, status, source, source_notes)
    values (${slugify(body.operator_name)}-${Date.now().toString(36)}, ${body.operator_name}, ${empty(body.operator_website)}, ${empty(body.operator_type)}, ${numberOrNull(body.estimated_property_count)}, ${status}, 'manual_screening', ${empty(body.source_notes)})
    on conflict (slug) do update set name = excluded.name, website_url = coalesce(excluded.website_url, public.operator_prospects.website_url), updated_at = now()
    returning id
  ` : [];

  const existingOperatorId = body.operator_prospect_id || operatorRows[0]?.id || null;
  const propertyRows = body.id ? await sql`
    update public.property_prospects set
      operator_prospect_id = coalesce(${existingOperatorId}::uuid, operator_prospect_id),
      name = ${body.name}, website_url = ${empty(body.website_url)}, address_line_1 = ${empty(body.address_line_1)},
      suburb = ${empty(body.suburb)}, city = ${empty(body.city)}, region = ${empty(body.region)}, country_code = ${empty(body.country_code)},
      property_types = ${body.property_types || []}, booking_platforms = ${body.booking_platforms || []}, communal_areas = ${body.communal_areas || []},
      years_operating_band = ${empty(body.years_operating_band)}, room_count_band = ${empty(body.room_count_band)},
      estimated_room_count = ${numberOrNull(body.estimated_room_count)}, average_nightly_rate_band = ${empty(body.average_nightly_rate_band)},
      average_nightly_rate_currency = ${empty(body.average_nightly_rate_currency)}, google_rating = ${numberOrNull(body.google_rating)},
      google_review_count = ${numberOrNull(body.google_review_count)}, location_quality = ${empty(body.location_quality)},
      location_notes = ${empty(body.location_notes)}, research_summary = ${empty(body.research_summary)}, status = ${status}, updated_at = now()
    where id = ${body.id}::uuid returning *
  ` : await sql`
    insert into public.property_prospects (
      operator_prospect_id, slug, name, website_url, address_line_1, suburb, city, region, country_code,
      property_types, booking_platforms, communal_areas, years_operating_band, room_count_band, estimated_room_count,
      average_nightly_rate_band, average_nightly_rate_currency, google_rating, google_review_count,
      location_quality, location_notes, research_summary, status
    ) values (
      ${existingOperatorId}::uuid, ${slug}, ${body.name}, ${empty(body.website_url)}, ${empty(body.address_line_1)}, ${empty(body.suburb)},
      ${empty(body.city)}, ${empty(body.region)}, ${empty(body.country_code)}, ${body.property_types || []}, ${body.booking_platforms || []},
      ${body.communal_areas || []}, ${empty(body.years_operating_band)}, ${empty(body.room_count_band)}, ${numberOrNull(body.estimated_room_count)},
      ${empty(body.average_nightly_rate_band)}, ${empty(body.average_nightly_rate_currency)}, ${numberOrNull(body.google_rating)},
      ${numberOrNull(body.google_review_count)}, ${empty(body.location_quality)}, ${empty(body.location_notes)}, ${empty(body.research_summary)}, ${status}
    ) returning *
  `;
  const property = propertyRows[0];

  const modelRows = await sql`select id, total_max_score from public.screening_models where code='irl_operator_fit' and active=true order by version desc limit 1`;
  if (!modelRows.length) return reply(500, { error: 'Screening model not found. Run the screening schema migration.' });
  const model = modelRows[0];
  const score = calculate(body);

  const current = await sql`select id, assessment_number from public.property_screening_assessments where property_prospect_id=${property.id} order by assessment_number desc limit 1`;
  const assessmentRows = current.length ? await sql`
    update public.property_screening_assessments set
      verifiable_score=${score.verifiable}, verifiable_points_available=${score.verifiableAvailable}, visual_score=${score.visual}, visual_points_available=${score.visualAvailable},
      total_score=${score.total}, total_points_available=${score.available}, normalised_score=${score.normalised}, completion_percentage=${score.completion},
      confidence_level=${score.confidence}, score_tier=${score.tier}, recommended_action=${score.action}, assessment_status=${body.assessment_status || 'draft'},
      summary=${empty(body.assessment_summary)}, reviewer_notes=${empty(body.reviewer_notes)}, updated_at=now()
    where id=${current[0].id} returning *
  ` : await sql`
    insert into public.property_screening_assessments (
      property_prospect_id, screening_model_id, assessment_number, assessment_status,
      verifiable_score, verifiable_points_available, visual_score, visual_points_available,
      total_score, total_points_available, normalised_score, completion_percentage, confidence_level, score_tier, recommended_action, summary, reviewer_notes
    ) values (
      ${property.id}, ${model.id}, 1, ${body.assessment_status || 'draft'},
      ${score.verifiable}, ${score.verifiableAvailable}, ${score.visual}, ${score.visualAvailable},
      ${score.total}, ${score.available}, ${score.normalised}, ${score.completion}, ${score.confidence}, ${score.tier}, ${score.action}, ${empty(body.assessment_summary)}, ${empty(body.reviewer_notes)}
    ) returning *
  `;
  const assessment = assessmentRows[0];

  const answerMap = body.answers || {};
  for (const [fieldKey, answer] of Object.entries(answerMap)) {
    if (answer === '' || answer === null || answer === undefined || (Array.isArray(answer) && !answer.length)) continue;
    await sql`
      insert into public.property_screening_answers (assessment_id, field_key, answer_json, evidence_status, source_type)
      values (${assessment.id}, ${fieldKey}, ${JSON.stringify(answer)}::jsonb, 'unverified', 'partner_input')
      on conflict (assessment_id, field_key) do update set answer_json=excluded.answer_json, updated_at=now()
    `;
  }

  if (Array.isArray(body.socials)) {
    for (const social of body.socials) {
      if (!social.platform) continue;
      await sql`
        insert into public.property_prospect_social_channels (property_prospect_id, platform, handle, profile_url, follower_count, engagement_notes)
        values (${property.id}, ${social.platform}, ${empty(social.handle)}, ${empty(social.profile_url)}, ${numberOrNull(social.follower_count)}, ${empty(social.engagement_notes)})
        on conflict (property_prospect_id, platform) do update set handle=excluded.handle, profile_url=excluded.profile_url, follower_count=excluded.follower_count, engagement_notes=excluded.engagement_notes, updated_at=now()
      `;
    }
  }

  if (body.new_note) await sql`insert into public.property_screening_notes (property_prospect_id, assessment_id, note_type, body) values (${property.id}, ${assessment.id}, ${body.note_type || 'general'}, ${body.new_note})`;
  if (body.decision) {
    await sql`insert into public.property_screening_decisions (property_prospect_id, assessment_id, decision, rationale, next_action, next_review_date) values (${property.id}, ${assessment.id}, ${body.decision}, ${empty(body.decision_rationale)}, ${empty(body.next_action)}, ${empty(body.next_review_date)}::date)`;
  }

  return reply(200, { property, assessment });
}

function calculate(body: Payload) {
  const a = body.answers || {};
  const propertyTypes = body.property_types || [];
  const platforms = body.booking_platforms || [];
  const communal = body.communal_areas || [];
  let v = 0, va = 0, visual = 0, visualAvailable = 0;
  if (propertyTypes.length) { va += 4; v += propertyTypes.some((x:string)=>['boutique_hotel','guesthouse','b_and_b','villa'].includes(x)) ? 4 : propertyTypes.some((x:string)=>['serviced_apartment','self_catering_cottage','loft','townhouse'].includes(x)) ? 3 : 2; }
  if (platforms.length) { va += 4; v += platforms.includes('direct_website') || platforms.length >= 3 ? 4 : platforms.length === 2 ? 2 : 1; }
  const scoreMap: Record<string, Record<string, number>> = {
    years_operating_band:{less_than_1:2,'1_to_2':4,'3_to_5':6,'6_plus':8}, room_count_band:{'1_to_5':2,'6_to_10':4,'11_to_20':6,'21_to_50':7,'50_plus':8},
    rating_band:{below_4:1,'4_0_to_4_3':4,'4_4_to_4_6':6,'4_7_to_5':8}, average_nightly_rate_band:{under_800:2,'800_to_1500':5,'1500_to_3000':7,'3000_plus':8},
    location_quality:{mixed_or_up_and_coming:2,good_lifestyle_suburb:3,prime_lifestyle_suburb:4,other:0},
  };
  for (const [key,max] of [['years_operating_band',8],['room_count_band',8],['rating_band',8],['average_nightly_rate_band',8],['location_quality',4]] as [string,number][]) {
    const val = body[key] || a[key]; if (val) { va += max; v += scoreMap[key][val] ?? 0; }
  }
  const socialFollowers = (body.socials || []).reduce((sum:number,s:any)=>sum+(Number(s.follower_count)||0),0);
  if ((body.socials || []).length) { va += 4; v += socialFollowers>=10000?4:socialFollowers>=2000?3:socialFollowers>0?2:1; }
  if (communal.length) { visualAvailable += 5; visual += communal.length>=4?5:communal.length; }
  for (const key of ['design_aesthetic','bathroom_quality','kitchen_coffee_quality','cleanliness']) { const n=Number(a[key]); if(n){visualAvailable+=5;visual+=Math.min(5,n);} }
  const total=v+visual, available=va+visualAvailable, completion=Math.round(available/65*100), normalised=available?Math.round(total/available*10000)/100:null;
  const confidence=completion>=80?'high':completion>=45?'medium':'low';
  const tier=normalised==null?null:normalised>=80?'strong_approach':normalised>=60?'good_fit':normalised>=40?'marginal':'not_right_now';
  const action=tier==='strong_approach'?'approach':tier==='good_fit'?'continue_research':tier==='marginal'?'hold':'reject';
  return {verifiable:v,verifiableAvailable:va,visual,visualAvailable,total,available,completion,normalised,confidence,tier,action};
}

function empty(value: unknown) { const text = String(value ?? '').trim(); return text || null; }
function numberOrNull(value: unknown) { const number = Number(value); return Number.isFinite(number) && String(value).trim() !== '' ? number : null; }
function slugify(value: unknown) { return String(value || 'prospect').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70); }
function reply(statusCode: number, body: unknown) { return { statusCode, headers: { 'content-type':'application/json', 'cache-control':'no-store' }, body: JSON.stringify(body) }; }
