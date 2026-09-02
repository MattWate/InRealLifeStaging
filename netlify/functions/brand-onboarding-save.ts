type FormValue = string | string[];
export type BrandPayload = {
  session_id?: string | null;
  flow?: 'brand';
  current_step?: string;
  completion_percentage?: number;
  schema_version?: string;
  submit?: boolean;
  form?: Record<string, FormValue>;
};

const SECTION_BY_FIELD: Record<string, string> = {
  firstName: 'team', lastName: 'team', email: 'team', mobile: 'team', jobTitle: 'team', onboardingRole: 'team',
  additionalContactEnabled: 'team', contact2Name: 'team', contact2Email: 'team', contact2Role: 'team', contact2Updates: 'team',
  brandName: 'brand', brandWebsite: 'brand', partOfGroup: 'brand', parentCompany: 'brand', brandCountry: 'brand', brandCity: 'brand',
  activeMarkets: 'brand', brandPrimaryCategory: 'brand', brandSecondaryCategories: 'brand', brandDescription: 'brand', qualities: 'brand', salesChannels: 'brand',
  productScope: 'product', productName: 'product', productWebpage: 'product', productCategory: 'product', productSubcategory: 'product',
  priceCurrency: 'product', priceMin: 'product', priceMax: 'product', variants: 'product', sameProductAvailability: 'product', productMarkets: 'product', productChannels: 'product',
  additionalProductEnabled: 'product', product2Name: 'product', product2Category: 'product', product2Price: 'product',
  audienceDescription: 'audience', audienceGeography: 'audience', ageGroups: 'audience', lifeStages: 'audience', decisionFactors: 'audience', discoveryOpenness: 'audience',
  audienceExclusions: 'audience', audienceEvidence: 'audience', audienceNotes: 'audience', secondaryAudienceEnabled: 'audience', secondaryAudienceDescription: 'audience', secondaryAudienceGeography: 'audience',
  customerNeed: 'need', needContext: 'need', currentAlternative: 'need', alternativeExplanation: 'need', primaryBarrier: 'need', barrierReducers: 'need', decisionNotes: 'need',
  marketingChannels: 'value', irlOpportunity: 'value',
  guestUsageModel: 'operations', handlingRequirements: 'operations', supplyCapability: 'operations',
  primarySuccessResult: 'success', successSignals: 'success',
  complianceRequirements: 'requirements', messagingRequirements: 'requirements', associationRestrictions: 'requirements',
  finalNotes: 'review', profileConfirmed: 'review',
};

export async function saveBrandOnboarding(sql: any, body: BrandPayload) {
  const form = body.form || {};
  const brandName = text(form.brandName);
  if (!brandName) throw new Error('Enter the brand name before saving online.');

  let organisationId: string;
  let sessionId = body.session_id || null;

  if (sessionId) {
    const rows = await sql`
      select id, organisation_id, status, submitted_at
      from public.onboarding_sessions
      where id = ${sessionId}::uuid and onboarding_type = 'brand'
      limit 1
    `;
    if (!rows.length) throw new Error('The saved brand onboarding session could not be found. Clear the local draft and start again.');
    if (rows[0].status === 'submitted') return { ok: true, session_id: sessionId, status: 'submitted', saved_at: rows[0].submitted_at };
    organisationId = rows[0].organisation_id;
  } else {
    const organisationSlug = `${slugify(brandName)}-${Date.now().toString(36)}`;
    const organisationRows = await sql`
      insert into public.organisations (
        name, slug, organisation_type, primary_email, country_code, city,
        status, onboarding_status, metadata
      ) values (
        ${brandName}, ${organisationSlug}, 'brand', ${nullable(form.email)},
        ${countryCode(form.brandCountry)}, ${nullable(form.brandCity)},
        'pending', 'in_progress', ${JSON.stringify({ onboarding_schema_version: body.schema_version || 'brand-onboarding-v01' })}::jsonb
      ) returning id
    `;
    organisationId = organisationRows[0].id;

    const sessionRows = await sql`
      insert into public.onboarding_sessions (
        organisation_id, onboarding_type, current_step, status, completion_percentage, schema_version
      ) values (
        ${organisationId}::uuid, 'brand', ${nullableText(body.current_step)},
        'in_progress', ${percentage(body.completion_percentage)},
        ${body.schema_version || 'brand-onboarding-v01'}
      ) returning id
    `;
    sessionId = sessionRows[0].id;

    await audit(sql, sessionId, organisationId, 'session_created', body.schema_version, { flow: 'brand' });
  }

  const submitted = body.submit === true;
  const profileStatus = submitted ? 'submitted' : 'draft';

  await sql`
    update public.organisations set
      name = ${brandName},
      primary_email = ${nullable(form.email)},
      country_code = coalesce(${countryCode(form.brandCountry)}, country_code),
      city = coalesce(${nullable(form.brandCity)}, city),
      onboarding_status = ${submitted ? 'submitted' : 'in_progress'},
      updated_at = now()
    where id = ${organisationId}::uuid
  `;

  await sql`
    insert into public.brand_onboarding_profiles (
      organisation_id, website, parent_company_name, active_market_codes,
      primary_category_code, secondary_category_codes, description, quality_codes,
      sales_channel_codes, marketing_channel_codes, primary_opportunity_code,
      primary_success_result, mandatory_requirements, messaging_requirements,
      association_exclusions, final_notes, confirmed_accurate, status
    ) values (
      ${organisationId}::uuid, ${nullable(form.brandWebsite)}, ${nullable(form.parentCompany)},
      ${pgTextArray(codes(form.activeMarkets))}::text[], ${code(first(form.brandPrimaryCategory))},
      ${pgTextArray(codes(form.brandSecondaryCategories))}::text[], ${nullable(form.brandDescription)},
      ${pgTextArray(codes(form.qualities))}::text[], ${pgTextArray(codes(form.salesChannels))}::text[],
      ${pgTextArray(codes(form.marketingChannels))}::text[], ${code(first(form.irlOpportunity))},
      ${nullable(form.primarySuccessResult)}, ${nullable(form.complianceRequirements)},
      ${nullable(form.messagingRequirements)}, ${nullable(form.associationRestrictions)},
      ${nullable(form.finalNotes)}, ${text(form.profileConfirmed) === 'yes'}, ${profileStatus}
    )
    on conflict (organisation_id) do update set
      website=excluded.website,
      parent_company_name=excluded.parent_company_name,
      active_market_codes=excluded.active_market_codes,
      primary_category_code=excluded.primary_category_code,
      secondary_category_codes=excluded.secondary_category_codes,
      description=excluded.description,
      quality_codes=excluded.quality_codes,
      sales_channel_codes=excluded.sales_channel_codes,
      marketing_channel_codes=excluded.marketing_channel_codes,
      primary_opportunity_code=excluded.primary_opportunity_code,
      primary_success_result=excluded.primary_success_result,
      mandatory_requirements=excluded.mandatory_requirements,
      messaging_requirements=excluded.messaging_requirements,
      association_exclusions=excluded.association_exclusions,
      final_notes=excluded.final_notes,
      confirmed_accurate=excluded.confirmed_accurate,
      status=excluded.status,
      updated_at=now()
  `;

  await upsertPrimaryContact(sql, organisationId, sessionId, form);
  await upsertAdditionalContact(sql, organisationId, sessionId, form);
  const productId = await upsertPrimaryProduct(sql, organisationId, sessionId, form);
  await upsertAdditionalProduct(sql, organisationId, sessionId, form);
  await upsertPrimaryAudience(sql, organisationId, sessionId, productId, form);
  await upsertSecondaryAudience(sql, organisationId, sessionId, productId, form);
  await saveAnswers(sql, sessionId, form, submitted);

  const finalUpdate = sql`
    update public.onboarding_sessions set
      current_step = ${nullableText(body.current_step)},
      completion_percentage = case when status = 'submitted' or ${submitted} then 100 else ${percentage(body.completion_percentage)} end,
      status = case when status = 'submitted' or ${submitted} then 'submitted' else 'in_progress' end,
      schema_version = ${body.schema_version || 'brand-onboarding-v01'},
      submitted_at = coalesce(submitted_at, ${submitted ? new Date().toISOString() : null}::timestamptz),
      updated_at = now()
    where id = ${sessionId}::uuid
  `;
  if (submitted) await sql.transaction([
    finalUpdate,
    sql`insert into public.irl_submission_snapshots (session_id, answers) values (${sessionId}::uuid, ${JSON.stringify(form)}::jsonb) on conflict (session_id) do nothing`,
    sql`insert into public.onboarding_audit_log (onboarding_session_id,organisation_id,event_type,schema_version,details) values (${sessionId}::uuid,${organisationId}::uuid,'submitted',${body.schema_version || 'brand-onboarding-v01'},'{}'::jsonb)`,
  ]);
  else await finalUpdate;

  return {
    ok: true,
    session_id: sessionId,
    organisation_id: organisationId,
    product_id: productId,
    status: submitted ? 'submitted' : 'in_progress',
    saved_at: new Date().toISOString(),
  };
}

async function upsertPrimaryContact(sql: any, organisationId: string, sessionId: string, form: Record<string, FormValue>) {
  const rows = await sql`select id from public.brand_contacts where organisation_id=${organisationId}::uuid and is_primary=true limit 1`;
  const values = {
    first: nullable(form.firstName), last: nullable(form.lastName), email: nullable(form.email), mobile: nullable(form.mobile),
    title: nullable(form.jobTitle), role: code(first(form.onboardingRole)),
  };
  if (rows.length) {
    await sql`update public.brand_contacts set first_name=${values.first}, last_name=${values.last}, work_email=${values.email}, mobile_number=${values.mobile}, job_title=${values.title}, onboarding_role_code=${values.role}, onboarding_session_id=${sessionId}::uuid, updated_at=now() where id=${rows[0].id}::uuid`;
  } else {
    await sql`insert into public.brand_contacts (organisation_id,onboarding_session_id,first_name,last_name,work_email,mobile_number,job_title,onboarding_role_code,is_primary,receive_updates) values (${organisationId}::uuid,${sessionId}::uuid,${values.first},${values.last},${values.email},${values.mobile},${values.title},${values.role},true,true)`;
  }
}

async function upsertAdditionalContact(sql: any, organisationId: string, sessionId: string, form: Record<string, FormValue>) {
  if (text(form.additionalContactEnabled) !== 'yes' || !text(form.contact2Name)) return;
  const rows = await sql`select id from public.brand_contacts where organisation_id=${organisationId}::uuid and is_primary=false order by created_at asc limit 1`;
  const [firstName, ...rest] = text(form.contact2Name).split(/\s+/);
  const lastName = rest.join(' ') || null;
  const receiveUpdates = first(form.contact2Updates).toLowerCase() !== 'no';
  if (rows.length) {
    await sql`update public.brand_contacts set first_name=${firstName || null},last_name=${lastName},work_email=${nullable(form.contact2Email)},onboarding_role_code=${code(text(form.contact2Role))},receive_updates=${receiveUpdates},onboarding_session_id=${sessionId}::uuid,updated_at=now() where id=${rows[0].id}::uuid`;
  } else {
    await sql`insert into public.brand_contacts (organisation_id,onboarding_session_id,first_name,last_name,work_email,onboarding_role_code,is_primary,receive_updates) values (${organisationId}::uuid,${sessionId}::uuid,${firstName || null},${lastName},${nullable(form.contact2Email)},${code(text(form.contact2Role))},false,${receiveUpdates})`;
  }
}

async function upsertPrimaryProduct(sql: any, organisationId: string, sessionId: string, form: Record<string, FormValue>) {
  const rows = await sql`select id from public.brand_onboarding_products where organisation_id=${organisationId}::uuid and is_primary=true limit 1`;
  const same = first(form.sameProductAvailability).toLowerCase();
  const sameAvailability = same === 'yes' ? true : same === 'no' ? false : null;
  const marketCodes = sameAvailability === false ? codes(form.productMarkets) : codes(form.activeMarkets);
  const channelCodes = sameAvailability === false ? codes(form.productChannels) : codes(form.salesChannels);
  if (rows.length) {
    const id = rows[0].id;
    await sql`update public.brand_onboarding_products set onboarding_session_id=${sessionId}::uuid,scope_code=${code(first(form.productScope))},name=${nullable(form.productName)},webpage=${nullable(form.productWebpage)},category_code=${code(text(form.productCategory))},subcategory_code=${code(text(form.productSubcategory))},currency_code=${code(text(form.priceCurrency))},retail_price_min=${numberOrNull(form.priceMin)},retail_price_max=${numberOrNull(form.priceMax)},variants=${nullable(form.variants)},same_brand_availability=${sameAvailability},market_codes=${pgTextArray(marketCodes)}::text[],sales_channel_codes=${pgTextArray(channelCodes)}::text[],usage_model_code=${code(first(form.guestUsageModel))},handling_requirement_codes=${pgTextArray(codes(form.handlingRequirements))}::text[],supply_capability_code=${code(first(form.supplyCapability))},updated_at=now() where id=${id}::uuid`;
    return id as string;
  }
  const inserted = await sql`insert into public.brand_onboarding_products (organisation_id,onboarding_session_id,is_primary,scope_code,name,webpage,category_code,subcategory_code,currency_code,retail_price_min,retail_price_max,variants,same_brand_availability,market_codes,sales_channel_codes,usage_model_code,handling_requirement_codes,supply_capability_code) values (${organisationId}::uuid,${sessionId}::uuid,true,${code(first(form.productScope))},${nullable(form.productName)},${nullable(form.productWebpage)},${code(text(form.productCategory))},${code(text(form.productSubcategory))},${code(text(form.priceCurrency))},${numberOrNull(form.priceMin)},${numberOrNull(form.priceMax)},${nullable(form.variants)},${sameAvailability},${pgTextArray(marketCodes)}::text[],${pgTextArray(channelCodes)}::text[],${code(first(form.guestUsageModel))},${pgTextArray(codes(form.handlingRequirements))}::text[],${code(first(form.supplyCapability))}) returning id`;
  return inserted[0].id as string;
}

async function upsertAdditionalProduct(sql: any, organisationId: string, sessionId: string, form: Record<string, FormValue>) {
  if (text(form.additionalProductEnabled) !== 'yes' || !text(form.product2Name)) return;
  const rows = await sql`select id from public.brand_onboarding_products where organisation_id=${organisationId}::uuid and is_primary=false order by created_at asc limit 1`;
  if (rows.length) {
    await sql`update public.brand_onboarding_products set onboarding_session_id=${sessionId}::uuid,name=${nullable(form.product2Name)},category_code=${code(text(form.product2Category))},variants=${nullable(form.product2Price)},updated_at=now() where id=${rows[0].id}::uuid`;
  } else {
    await sql`insert into public.brand_onboarding_products (organisation_id,onboarding_session_id,is_primary,name,category_code,variants) values (${organisationId}::uuid,${sessionId}::uuid,false,${nullable(form.product2Name)},${code(text(form.product2Category))},${nullable(form.product2Price)})`;
  }
}

async function upsertPrimaryAudience(sql: any, organisationId: string, sessionId: string, productId: string, form: Record<string, FormValue>) {
  const rows = await sql`select id from public.brand_audience_profiles where organisation_id=${organisationId}::uuid and is_primary=true limit 1`;
  const params = {
    description: nullable(form.audienceDescription), geography: code(first(form.audienceGeography)), ages: pgTextArray(codes(form.ageGroups)), stages: pgTextArray(codes(form.lifeStages)), decisions: pgTextArray(codes(form.decisionFactors)), openness: code(first(form.discoveryOpenness)), exclusions: nullable(form.audienceExclusions), evidence: pgTextArray(codes(form.audienceEvidence)), notes: nullable(form.audienceNotes), need: nullable(form.customerNeed), contexts: pgTextArray(codes(form.needContext)), alternative: code(first(form.currentAlternative)), alternativeExplanation: nullable(form.alternativeExplanation), barrier: code(first(form.primaryBarrier)), reducers: pgTextArray(codes(form.barrierReducers)), decisionNotes: nullable(form.decisionNotes),
  };
  if (rows.length) {
    await sql`update public.brand_audience_profiles set product_id=${productId}::uuid,onboarding_session_id=${sessionId}::uuid,description=${params.description},geography_code=${params.geography},age_group_codes=${params.ages}::text[],life_stage_codes=${params.stages}::text[],decision_factor_codes=${params.decisions}::text[],discovery_openness_code=${params.openness},exclusions=${params.exclusions},evidence_source_codes=${params.evidence}::text[],notes=${params.notes},customer_need=${params.need},need_context_codes=${params.contexts}::text[],current_alternative_code=${params.alternative},alternative_explanation=${params.alternativeExplanation},primary_barrier_code=${params.barrier},barrier_reducer_codes=${params.reducers}::text[],decision_notes=${params.decisionNotes},updated_at=now() where id=${rows[0].id}::uuid`;
  } else {
    await sql`insert into public.brand_audience_profiles (organisation_id,product_id,onboarding_session_id,is_primary,description,geography_code,age_group_codes,life_stage_codes,decision_factor_codes,discovery_openness_code,exclusions,evidence_source_codes,notes,customer_need,need_context_codes,current_alternative_code,alternative_explanation,primary_barrier_code,barrier_reducer_codes,decision_notes) values (${organisationId}::uuid,${productId}::uuid,${sessionId}::uuid,true,${params.description},${params.geography},${params.ages}::text[],${params.stages}::text[],${params.decisions}::text[],${params.openness},${params.exclusions},${params.evidence}::text[],${params.notes},${params.need},${params.contexts}::text[],${params.alternative},${params.alternativeExplanation},${params.barrier},${params.reducers}::text[],${params.decisionNotes})`;
  }
}

async function upsertSecondaryAudience(sql: any, organisationId: string, sessionId: string, productId: string, form: Record<string, FormValue>) {
  if (text(form.secondaryAudienceEnabled) !== 'yes' || !text(form.secondaryAudienceDescription)) return;
  const rows = await sql`select id from public.brand_audience_profiles where organisation_id=${organisationId}::uuid and is_primary=false order by created_at asc limit 1`;
  if (rows.length) {
    await sql`update public.brand_audience_profiles set product_id=${productId}::uuid,onboarding_session_id=${sessionId}::uuid,description=${nullable(form.secondaryAudienceDescription)},geography_code=${code(first(form.secondaryAudienceGeography))},updated_at=now() where id=${rows[0].id}::uuid`;
  } else {
    await sql`insert into public.brand_audience_profiles (organisation_id,product_id,onboarding_session_id,is_primary,description,geography_code) values (${organisationId}::uuid,${productId}::uuid,${sessionId}::uuid,false,${nullable(form.secondaryAudienceDescription)},${code(first(form.secondaryAudienceGeography))})`;
  }
}

async function saveAnswers(sql: any, sessionId: string, form: Record<string, FormValue>, submitted: boolean) {
  const status = submitted ? 'submitted' : 'draft';
  for (const [fieldKey, answer] of Object.entries(form)) {
    const section = SECTION_BY_FIELD[fieldKey];
    if (!section) continue;
    await sql`
      insert into public.onboarding_answers (onboarding_session_id, section_key, field_key, answer_json, status)
      values (${sessionId}::uuid, ${section}, ${fieldKey}, ${JSON.stringify(answer)}::jsonb, ${status})
      on conflict (onboarding_session_id, section_key, field_key) do update set
        answer_json=excluded.answer_json, status=excluded.status, updated_at=now()
    `;
  }
}

async function audit(sql: any, sessionId: string, organisationId: string, eventType: string, schemaVersion: string | undefined, details: unknown) {
  await sql`insert into public.onboarding_audit_log (onboarding_session_id,organisation_id,event_type,schema_version,details) values (${sessionId}::uuid,${organisationId}::uuid,${eventType},${schemaVersion || 'brand-onboarding-v01'},${JSON.stringify(details)}::jsonb)`;
}

function codes(value: FormValue | undefined) {
  const values = Array.isArray(value) ? value : text(value) ? text(value).split(',').map((item) => item.trim()).filter(Boolean) : [];
  return values.map(code).filter(Boolean) as string[];
}
function code(value: string) { return value ? slugify(value).replace(/-/g, '_') : null; }
function first(value: FormValue | undefined) { return Array.isArray(value) ? String(value[0] || '') : text(value); }
function text(value: FormValue | undefined) { return typeof value === 'string' ? value.trim() : ''; }
function nullable(value: FormValue | undefined) { return text(value) || null; }
function nullableText(value: string | undefined) { return value?.trim() || null; }
function isBlank(value: FormValue) { return Array.isArray(value) ? value.length === 0 : !value.trim(); }
function percentage(value: unknown) { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0; }
function numberOrNull(value: FormValue | undefined) { const raw = text(value); if (!raw) return null; const n = Number(raw); return Number.isFinite(n) && n >= 0 ? n : null; }
function pgTextArray(values: string[]) { return `{${values.map((item) => `"${String(item).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')}}`; }
function slugify(value: unknown) { return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100); }
function countryCode(value: FormValue | undefined) {
  const raw = text(value);
  if (!raw) return null;
  const map: Record<string, string> = { 'south africa':'ZA','united kingdom':'GB','uk':'GB','zimbabwe':'ZW','united states':'US','usa':'US','united arab emirates':'AE','uae':'AE' };
  if (/^[a-z]{2}$/i.test(raw)) return raw.toUpperCase();
  return map[raw.toLowerCase()] || null;
}
