import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

export const handler: Handler = async (event) => {
  const databaseUrl = process.env.DATABASE_URL;
  const slug = event.queryStringParameters?.slug || 'curiocity-green-point';

  if (!databaseUrl) {
    return json(500, { error: 'DATABASE_URL is not configured.' });
  }

  try {
    const sql = neon(databaseUrl);
    const properties = await sql`
      select
        p.id,
        p.name,
        p.slug,
        p.property_type,
        p.description_operator,
        p.city,
        p.region,
        p.country_code,
        p.total_rooms,
        p.total_units,
        p.total_dorm_beds,
        p.peak_season_notes,
        p.commercial_readiness_status,
        o.name as operator_name,
        op.operator_type,
        op.number_of_properties,
        op.description as operator_description,
        op.instagram_handle,
        op.reporting_capability,
        op.other_systems
      from public.properties p
      join public.organisations o on o.id = p.operator_organisation_id
      left join public.operator_profiles op on op.organisation_id = o.id
      where p.slug = ${slug}
      limit 1
    `;

    if (!properties.length) return json(404, { error: 'Property not found.' });
    const property = properties[0];

    const [snapshots, roomTypes, spaces, zones, answers] = await Promise.all([
      sql`
        select period_start, period_end, reservation_count, guest_count, room_nights,
          guest_nights, average_length_of_stay, international_guest_percentage,
          local_guest_percentage, guest_origin_coverage, occupancy_percentage,
          occupancy_calculation_available, data_confidence_score, status
        from public.property_metric_snapshots
        where property_id = ${property.id}
        order by period_end desc, created_at desc
        limit 1
      `,
      sql`
        select name, number_of_sellable_units, maximum_guests, privacy_type
        from public.room_types
        where property_id = ${property.id} and active = true
        order by number_of_sellable_units desc nulls last, name
      `,
      sql`
        select name, space_type, private_or_communal, estimated_capacity,
          guest_access_pattern, operational_constraints
        from public.spaces
        where property_id = ${property.id} and active = true
        order by name
      `,
      sql`
        select ez.code, ez.name, ez.description, pez.strength, pez.evidence_notes,
          pez.physical_locations, pez.category_opportunities, pez.operational_constraints,
          pez.assessment_status
        from public.property_experience_zones pez
        join public.experience_zones ez on ez.id = pez.experience_zone_id
        where pez.property_id = ${property.id}
        order by case pez.strength
          when 'exceptional' then 1 when 'strong' then 2 when 'medium' then 3
          when 'emerging' then 4 when 'weak' then 5 else 6 end, ez.name
      `,
      sql`
        select oa.field_key, oa.answer_json
        from public.onboarding_answers oa
        join public.onboarding_sessions os on os.id = oa.onboarding_session_id
        where os.property_id = ${property.id}
      `,
    ]);

    const onboarding = Object.fromEntries(
      answers.map((answer) => [answer.field_key, answer.answer_json]),
    );

    return json(200, {
      property,
      metrics: snapshots[0] || null,
      roomTypes,
      spaces,
      zones,
      onboarding,
    });
  } catch (error) {
    console.error('Operator profile query failed', error);
    return json(500, { error: 'Unable to load the operator profile.' });
  }
};

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=60, stale-while-revalidate=300',
    },
    body: JSON.stringify(body),
  };
}
