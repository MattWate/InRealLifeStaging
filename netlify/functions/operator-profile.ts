import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

export const handler: Handler = async (event) => {
  const databaseUrl = process.env.DATABASE_URL;
  const slug = event.queryStringParameters?.slug || 'curiocity-green-point';
  if (!databaseUrl) return json(500, { error: 'DATABASE_URL is not configured.' });

  try {
    const sql = neon(databaseUrl);
    const properties = await sql`
      select p.*, o.name as operator_name, op.operator_type, op.number_of_properties,
        op.description as operator_description, op.instagram_handle,
        op.reporting_capability, op.other_systems
      from public.properties p
      join public.organisations o on o.id = p.operator_organisation_id
      left join public.operator_profiles op on op.organisation_id = o.id
      where p.slug = ${slug}
      limit 1
    `;
    if (!properties.length) return json(404, { error: 'Property not found.' });
    const property = properties[0];

    const [snapshots, roomTypes, spaces, zones, answers, channelMix, countryMix, stayLength,
      partyMix, roomPerformance, monthlyTrend, quality] = await Promise.all([
      sql`select * from public.property_metric_snapshots where property_id=${property.id} order by period_end desc, created_at desc limit 1`,
      sql`select name, number_of_sellable_units, maximum_guests, privacy_type from public.room_types where property_id=${property.id} and active=true order by number_of_sellable_units desc nulls last, name`,
      sql`select name, space_type, private_or_communal, estimated_capacity, guest_access_pattern, operational_constraints from public.spaces where property_id=${property.id} and active=true order by name`,
      sql`select ez.code, ez.name, ez.description, pez.strength, pez.evidence_notes, pez.physical_locations, pez.category_opportunities, pez.operational_constraints, pez.assessment_status from public.property_experience_zones pez join public.experience_zones ez on ez.id=pez.experience_zone_id where pez.property_id=${property.id} order by case pez.strength when 'exceptional' then 1 when 'strong' then 2 when 'medium' then 3 when 'emerging' then 4 else 5 end, ez.name`,
      sql`select oa.field_key, oa.answer_json from public.onboarding_answers oa join public.onboarding_sessions os on os.id=oa.onboarding_session_id where os.property_id=${property.id}`,
      sql`select coalesce(nullif(booking_channel,''),'Unknown') as label, count(*)::int as stays, coalesce(sum(guest_count),0)::int as guests, coalesce(sum(guest_count*number_of_nights),0)::int as guest_nights from public.reservations where property_id=${property.id} group by 1 order by stays desc`,
      sql`select coalesce(guest_country_code,'Unknown') as label, count(*)::int as stays, coalesce(sum(guest_count),0)::int as guests, coalesce(sum(guest_count*number_of_nights),0)::int as guest_nights from public.reservations where property_id=${property.id} group by 1 order by guests desc limit 10`,
      sql`select case when number_of_nights=1 then '1 night' when number_of_nights between 2 and 3 then '2–3 nights' when number_of_nights between 4 and 7 then '4–7 nights' else '8+ nights' end as label, count(*)::int as stays, coalesce(sum(guest_count),0)::int as guests from public.reservations where property_id=${property.id} group by 1 order by min(number_of_nights)`,
      sql`select case when guest_count=1 then 'Solo' when guest_count=2 then 'Couples / pairs' when guest_count between 3 and 5 then 'Small groups' else 'Large groups' end as label, count(*)::int as stays from public.reservations where property_id=${property.id} and guest_count is not null group by 1 order by stays desc`,
      sql`select coalesce(rt.name,'Unmapped') as label, count(*)::int as stays, coalesce(sum(r.guest_count),0)::int as guests, coalesce(sum(r.guest_count*r.number_of_nights),0)::int as guest_nights, round(avg(r.number_of_nights)::numeric,1) as average_stay from public.reservations r left join public.room_types rt on rt.id=r.room_type_id where r.property_id=${property.id} group by 1 order by guest_nights desc`,
      sql`select to_char(date_trunc('month',check_in_date),'Mon YYYY') as label, date_trunc('month',check_in_date) as month_start, count(*)::int as stays, coalesce(sum(guest_count),0)::int as guests, coalesce(sum(guest_count*number_of_nights),0)::int as guest_nights from public.reservations where property_id=${property.id} group by 1,2 order by 2`,
      sql`select count(*)::int as total_rows, count(guest_country_code)::int as rows_with_origin, count(booking_channel)::int as rows_with_channel, count(room_type_id)::int as rows_with_room_type, count(unit_id)::int as rows_with_unit, min(check_in_date) as first_check_in, max(check_out_date) as last_check_out from public.reservations where property_id=${property.id}`,
    ]);

    return json(200, {
      property,
      metrics: snapshots[0] || null,
      roomTypes, spaces, zones,
      onboarding: Object.fromEntries(answers.map((a) => [a.field_key, a.answer_json])),
      insights: { channelMix, countryMix, stayLength, partyMix, roomPerformance, monthlyTrend, quality: quality[0] || null },
    });
  } catch (error) {
    console.error('Operator profile query failed', error);
    return json(500, { error: 'Unable to load the operator profile.' });
  }
};

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60, stale-while-revalidate=300' }, body: JSON.stringify(body) };
}
