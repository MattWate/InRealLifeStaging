type NestedAnswer = Record<string, string | string[]>;
type FormValue = string | string[] | NestedAnswer[];
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
  counterpartFirstName: 'team', counterpartLastName: 'team', counterpartEmail: 'team', counterpartJobTitle: 'team', additionalContacts: 'team',
  brandName: 'brand', brandWebsite: 'brand', partOfGroup: 'brand', parentCompany: 'brand', brandCountry: 'brand', brandCity: 'brand',
  activeMarkets: 'brand', brandPrimaryCategory: 'brand', brandPrimaryCategoryOther: 'brand', brandSecondaryCategories: 'brand', brandSecondaryCategoriesOther: 'brand', brandDescription: 'brand', brandDifferentiator: 'brand', brandValues: 'brand', salesChannels: 'brand', salesChannelsOther: 'brand', competitorLockouts: 'brand', brandNeighbourhood: 'brand',
  productScope: 'product', productName: 'product', productWebpage: 'product', productCategory: 'product', productSubcategory: 'product',
  hasProductWebpage: 'product', priceCurrency: 'product', priceMin: 'product', priceMax: 'product', variants: 'product', sameProductAvailability: 'product', productMarkets: 'product', productChannels: 'product', productChannelsOther: 'product', productCategoryOther: 'product', productSubcategoryOther: 'product', internationalShipping: 'product', internationalShippingRegions: 'product', legalSafetyCompliance: 'product', additionalProducts: 'product',
  audienceDescription: 'audience', audienceGeography: 'audience', audienceGeographyDetail: 'audience', ageGroups: 'audience', lifeStages: 'audience', lifeStagesOther: 'audience', decisionFactors: 'audience', decisionFactorsOther: 'audience', discoveryOpenness: 'audience',
  spendingPower: 'audience', travelPurpose: 'audience', discoveryChannels: 'audience', discoveryChannelsOther: 'audience', audienceExclusions: 'audience', audienceEvidence: 'audience', audienceEvidenceOther: 'audience', audienceNotes: 'audience', secondaryAudienceEnabled: 'audience', secondaryAudienceDescription: 'audience', secondaryAudienceEvidence: 'audience', secondaryAudienceEvidenceOther: 'audience', secondaryAudienceGeography: 'audience', secondaryAudienceGeographyDetail: 'audience', secondaryAgeGroups: 'audience', secondaryLifeStages: 'audience', secondaryLifeStagesOther: 'audience', secondarySpendingPower: 'audience', secondaryTravelPurpose: 'audience', secondaryDiscoveryChannels: 'audience', secondaryDiscoveryChannelsOther: 'audience', secondaryDecisionFactors: 'audience', secondaryDecisionFactorsOther: 'audience', secondaryDiscoveryOpenness: 'audience', secondaryAudienceExclusions: 'audience', secondaryAudienceNotes: 'audience',
  customerOutcome: 'need', customerOutcomeOther: 'need', customerOutcomeDetail: 'need', needContext: 'need', currentAlternative: 'need', alternativeExplanation: 'need', primaryBarrier: 'need', barrierReducers: 'need', decisionNotes: 'need',
  marketingChannels: 'value-success', marketingChannelsOther: 'value-success', marketingChannelRank: 'value-success', measuredAcquisitionChannel: 'value-success', paidMarketing: 'value-success', experientialHistory: 'value-success', experientialHistoryOther: 'value-success', experientialEffectiveness: 'value-success', experientialEvidence: 'value-success', irlOpportunity: 'value-success', primarySuccessResult: 'value-success', successSignals: 'value-success', successSignalsOther: 'value-success',
  brandSuggestedPlacements: 'operations', brandSuggestedPlacementsOther: 'operations', handlingRequirements: 'operations', handlingRequirementsOther: 'operations', supplyCapability: 'operations', initialSupplyLimit: 'operations',
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
        'pending', 'in_progress', ${JSON.stringify({ onboarding_schema_version: body.schema_version || 'brand-onboarding-baseline-v01' })}::jsonb
      ) returning id
    `;
    organisationId = organisationRows[0].id;

    const sessionRows = await sql`
      insert into public.onboarding_sessions (
        organisation_id, onboarding_type, current_step, status, completion_percentage, schema_version
      ) values (
        ${organisationId}::uuid, 'brand', ${nullableText(body.current_step)},
        'in_progress', ${percentage(body.completion_percentage)},
        ${body.schema_version || 'brand-onboarding-baseline-v01'}
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
      association_exclusions, differentiator_code, values_code, competitor_lockouts,
      brand_self_perception, final_notes, confirmed_accurate, status
    ) values (
      ${organisationId}::uuid, ${nullable(form.brandWebsite)}, ${nullable(form.parentCompany)},
      ${pgTextArray(codes(form.activeMarkets))}::text[], ${code(first(form.brandPrimaryCategory) || first(form.productCategory))},
      ${pgTextArray(codes(form.brandSecondaryCategories))}::text[], ${nullable(form.brandDescription)},
      '{}'::text[], ${pgTextArray(codes(form.salesChannels))}::text[],
      ${pgTextArray(codes(form.marketingChannels))}::text[], ${code(first(form.irlOpportunity))},
      ${nullable(form.primarySuccessResult)}, ${nullable(form.legalSafetyCompliance)},
      null, ${nullable(form.competitorLockouts)}, ${code(first(form.brandDifferentiator))},
      ${code(first(form.brandValues))}, ${nullable(form.competitorLockouts)}, ${nullable(form.brandNeighbourhood)},
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
      differentiator_code=excluded.differentiator_code,
      values_code=excluded.values_code,
      competitor_lockouts=excluded.competitor_lockouts,
      brand_self_perception=excluded.brand_self_perception,
      final_notes=excluded.final_notes,
      confirmed_accurate=excluded.confirmed_accurate,
      status=excluded.status,
      updated_at=now()
  `;

  await upsertPrimaryContact(sql, organisationId, sessionId, form);
  await syncAdditionalContacts(sql, organisationId, sessionId, form);
  const productId = await upsertPrimaryProduct(sql, organisationId, sessionId, form);
  await syncAdditionalProducts(sql, organisationId, sessionId, form);
  await upsertPrimaryAudience(sql, organisationId, sessionId, productId, form);
  await upsertSecondaryAudience(sql, organisationId, sessionId, productId, form);
  await upsertValueAdd(sql, organisationId, sessionId, form);
  await upsertSuccess(sql, organisationId, sessionId, form);
  await saveAnswers(sql, sessionId, form, submitted);

  const finalUpdate = sql`
    update public.onboarding_sessions set
      current_step = ${nullableText(body.current_step)},
      completion_percentage = case when status = 'submitted' or ${submitted} then 100 else ${percentage(body.completion_percentage)} end,
      status = case when status = 'submitted' or ${submitted} then 'submitted' else status end,
      schema_version = ${body.schema_version || 'brand-onboarding-baseline-v01'},
      submitted_at = coalesce(submitted_at, ${submitted ? new Date().toISOString() : null}::timestamptz),
      updated_at = now()
    where id = ${sessionId}::uuid
  `;
  if (submitted) await sql.transaction([
    finalUpdate,
    sql`insert into public.irl_submission_snapshots (session_id, answers) values (${sessionId}::uuid, ${JSON.stringify(form)}::jsonb) on conflict (session_id) do nothing`,
    sql`insert into public.onboarding_audit_log (onboarding_session_id,organisation_id,event_type,schema_version,details) values (${sessionId}::uuid,${organisationId}::uuid,'submitted',${body.schema_version || 'brand-onboarding-baseline-v01'},'{}'::jsonb)`,
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
    await sql`update public.brand_contacts set first_name=${values.first}, last_name=${values.last}, work_email=${values.email}, mobile_number=${values.mobile}, job_title=${values.title}, onboarding_role_code=${values.role}, partnership_role_code=${values.role}, onboarding_session_id=${sessionId}::uuid, updated_at=now() where id=${rows[0].id}::uuid`;
  } else {
    await sql`insert into public.brand_contacts (organisation_id,onboarding_session_id,first_name,last_name,work_email,mobile_number,job_title,onboarding_role_code,partnership_role_code,is_primary,receive_updates) values (${organisationId}::uuid,${sessionId}::uuid,${values.first},${values.last},${values.email},${values.mobile},${values.title},${values.role},${values.role},true,true)`;
  }
}

async function syncAdditionalContacts(sql: any, organisationId: string, sessionId: string, form: Record<string, FormValue>) {
  const primaryRole = first(form.onboardingRole);
  const counterpartRole = primaryRole === 'Day-to-day contact' ? 'Approver' : primaryRole === 'Approver' ? 'Day-to-day contact' : '';
  const contacts: NestedAnswer[] = counterpartRole ? [{ firstName: text(form.counterpartFirstName), lastName: text(form.counterpartLastName), email: text(form.counterpartEmail), jobTitle: text(form.counterpartJobTitle), role: counterpartRole }, ...objects(form.additionalContacts)] : objects(form.additionalContacts);
  const existing = await sql`select id from public.brand_contacts where organisation_id=${organisationId}::uuid and is_primary=false order by created_at asc`;
  for (let index = 0; index < contacts.length; index += 1) {
    const contact = contacts[index];
    const role = code(firstNested(contact.role) || 'additional_contact');
    if (existing[index]) await sql`update public.brand_contacts set onboarding_session_id=${sessionId}::uuid,first_name=${nullableNested(contact.firstName)},last_name=${nullableNested(contact.lastName)},work_email=${nullableNested(contact.email)},job_title=${nullableNested(contact.jobTitle)},onboarding_role_code=${role},partnership_role_code=${role},receive_updates=true,updated_at=now() where id=${existing[index].id}::uuid`;
    else await sql`insert into public.brand_contacts (organisation_id,onboarding_session_id,first_name,last_name,work_email,job_title,onboarding_role_code,partnership_role_code,is_primary,receive_updates) values (${organisationId}::uuid,${sessionId}::uuid,${nullableNested(contact.firstName)},${nullableNested(contact.lastName)},${nullableNested(contact.email)},${nullableNested(contact.jobTitle)},${role},${role},false,true)`;
  }
  const staleIds = existing.slice(contacts.length).map((row: { id: string }) => row.id);
  if (staleIds.length) await sql`delete from public.brand_contacts where id = any(${pgTextArray(staleIds)}::uuid[]) and organisation_id=${organisationId}::uuid`;
}

async function upsertPrimaryProduct(sql: any, organisationId: string, sessionId: string, form: Record<string, FormValue>) {
  const rows = await sql`select id from public.brand_onboarding_products where organisation_id=${organisationId}::uuid and is_primary=true limit 1`;
  const same = first(form.sameProductAvailability).toLowerCase();
  const sameAvailability = same === 'yes' ? true : same === 'no' ? false : null;
  const marketCodes = sameAvailability === false ? codes(form.productMarkets) : codes(form.activeMarkets);
  const channelCodes = sameAvailability === false ? codes(form.productChannels) : codes(form.salesChannels);
  const hasWebpage = booleanChoice(form.hasProductWebpage) ?? Boolean(text(form.productWebpage));
  const legalReview = first(form.productCategory) === 'Health & Wellness' || first(form.brandPrimaryCategory) === 'Health & Wellness' || Boolean(text(form.legalSafetyCompliance));
  if (rows.length) {
    const id = rows[0].id;
    await sql`update public.brand_onboarding_products set onboarding_session_id=${sessionId}::uuid,scope_code=${code(first(form.productScope))},name=${nullable(form.productName)},has_webpage=${hasWebpage},webpage=${hasWebpage ? nullable(form.productWebpage) : null},category_code=${code(first(form.productCategory))},subcategory_code=${code(first(form.productSubcategory))},currency_code=${code(text(form.priceCurrency))},retail_price_min=${numberOrNull(form.priceMin)},retail_price_max=${numberOrNull(form.priceMax)},variants=${nullable(form.variants)},same_brand_availability=${sameAvailability},market_codes=${pgTextArray(marketCodes)}::text[],sales_channel_codes=${pgTextArray(channelCodes)}::text[],international_shipping_code=${code(first(form.internationalShipping))},international_shipping_regions=${nullable(form.internationalShippingRegions)},legal_safety_compliance=${nullable(form.legalSafetyCompliance)},legal_review_required=${legalReview},brand_suggested_placement_codes=${pgTextArray(codes(form.brandSuggestedPlacements))}::text[],handling_requirement_codes=${pgTextArray(codes(form.handlingRequirements))}::text[],supply_capability_code=${code(first(form.supplyCapability))},initial_supply_limit=${nullable(form.initialSupplyLimit)},updated_at=now() where id=${id}::uuid`;
    return id as string;
  }
  const inserted = await sql`insert into public.brand_onboarding_products (organisation_id,onboarding_session_id,is_primary,scope_code,name,has_webpage,webpage,category_code,subcategory_code,currency_code,retail_price_min,retail_price_max,variants,same_brand_availability,market_codes,sales_channel_codes,international_shipping_code,international_shipping_regions,legal_safety_compliance,legal_review_required,brand_suggested_placement_codes,handling_requirement_codes,supply_capability_code,initial_supply_limit) values (${organisationId}::uuid,${sessionId}::uuid,true,${code(first(form.productScope))},${nullable(form.productName)},${hasWebpage},${hasWebpage ? nullable(form.productWebpage) : null},${code(first(form.productCategory))},${code(first(form.productSubcategory))},${code(text(form.priceCurrency))},${numberOrNull(form.priceMin)},${numberOrNull(form.priceMax)},${nullable(form.variants)},${sameAvailability},${pgTextArray(marketCodes)}::text[],${pgTextArray(channelCodes)}::text[],${code(first(form.internationalShipping))},${nullable(form.internationalShippingRegions)},${nullable(form.legalSafetyCompliance)},${legalReview},${pgTextArray(codes(form.brandSuggestedPlacements))}::text[],${pgTextArray(codes(form.handlingRequirements))}::text[],${code(first(form.supplyCapability))},${nullable(form.initialSupplyLimit)}) returning id`;
  return inserted[0].id as string;
}

async function syncAdditionalProducts(sql: any, organisationId: string, sessionId: string, form: Record<string, FormValue>) {
  const products = objects(form.additionalProducts);
  const existing = await sql`select id from public.brand_onboarding_products where organisation_id=${organisationId}::uuid and is_primary=false order by created_at asc`;
  for (let index = 0; index < products.length; index += 1) {
    const product = products[index];
    const sameAvailability = firstNested(product.sameAvailability) === 'Yes' ? true : firstNested(product.sameAvailability) === 'No' ? false : null;
    const markets = sameAvailability === false ? codesNested(product.markets) : codes(form.activeMarkets);
    const channels = sameAvailability === false ? codesNested(product.channels) : codes(form.salesChannels);
    const hasWebpage = firstNested(product.hasWebpage) === 'Yes' ? true : firstNested(product.hasWebpage) === 'No' ? false : null;
    const legalReview = firstNested(product.category) === 'Health & Wellness' || Boolean(firstNested(product.legalSafetyCompliance));
    if (existing[index]) await sql`update public.brand_onboarding_products set onboarding_session_id=${sessionId}::uuid,name=${nullableNested(product.name)},has_webpage=${hasWebpage},webpage=${hasWebpage ? nullableNested(product.webpage) : null},category_code=${code(firstNested(product.category))},subcategory_code=${code(firstNested(product.subcategory))},currency_code=${code(firstNested(product.currency))},retail_price_min=${numberOrNullNested(product.priceMin)},retail_price_max=${numberOrNullNested(product.priceMax)},variants=${nullableNested(product.variants)},same_brand_availability=${sameAvailability},market_codes=${pgTextArray(markets)}::text[],sales_channel_codes=${pgTextArray(channels)}::text[],international_shipping_code=${code(firstNested(product.internationalShipping))},international_shipping_regions=${nullableNested(product.shippingRegions)},legal_safety_compliance=${nullableNested(product.legalSafetyCompliance)},legal_review_required=${legalReview},updated_at=now() where id=${existing[index].id}::uuid`;
    else await sql`insert into public.brand_onboarding_products (organisation_id,onboarding_session_id,is_primary,name,has_webpage,webpage,category_code,subcategory_code,currency_code,retail_price_min,retail_price_max,variants,same_brand_availability,market_codes,sales_channel_codes,international_shipping_code,international_shipping_regions,legal_safety_compliance,legal_review_required) values (${organisationId}::uuid,${sessionId}::uuid,false,${nullableNested(product.name)},${hasWebpage},${hasWebpage ? nullableNested(product.webpage) : null},${code(firstNested(product.category))},${code(firstNested(product.subcategory))},${code(firstNested(product.currency))},${numberOrNullNested(product.priceMin)},${numberOrNullNested(product.priceMax)},${nullableNested(product.variants)},${sameAvailability},${pgTextArray(markets)}::text[],${pgTextArray(channels)}::text[],${code(firstNested(product.internationalShipping))},${nullableNested(product.shippingRegions)},${nullableNested(product.legalSafetyCompliance)},${legalReview})`;
  }
  const staleIds = existing.slice(products.length).map((row: { id: string }) => row.id);
  if (staleIds.length) await sql`delete from public.brand_onboarding_products where id = any(${pgTextArray(staleIds)}::uuid[]) and organisation_id=${organisationId}::uuid`;
}

async function upsertPrimaryAudience(sql: any, organisationId: string, sessionId: string, productId: string, form: Record<string, FormValue>) {
  const rows = await sql`select id from public.brand_audience_profiles where organisation_id=${organisationId}::uuid and is_primary=true limit 1`;
  const params = {
    description: nullable(form.audienceDescription), geography: code(first(form.audienceGeography)), ages: pgTextArray(codes(form.ageGroups)), stages: pgTextArray(codes(form.lifeStages)), spending: pgTextArray(codes(form.spendingPower)), travel: code(first(form.travelPurpose)), discovery: pgTextArray(codes(form.discoveryChannels)), decisions: pgTextArray(codes(form.decisionFactors)), openness: code(first(form.discoveryOpenness)), exclusions: nullable(form.audienceExclusions), evidence: code(first(form.audienceEvidence)), notes: nullable(form.audienceNotes), outcome: code(first(form.customerOutcome)), outcomeDetail: nullable(form.customerOutcomeDetail), contexts: pgTextArray(codes(form.needContext)), alternative: code(first(form.currentAlternative)), alternativeExplanation: nullable(form.alternativeExplanation), barrier: code(first(form.primaryBarrier)), reducers: pgTextArray(codes(form.barrierReducers)), decisionNotes: nullable(form.decisionNotes),
  };
  const reviewRequired = first(form.audienceEvidence) === 'Assumption, not yet tested';
  if (rows.length) {
    await sql`update public.brand_audience_profiles set product_id=${productId}::uuid,onboarding_session_id=${sessionId}::uuid,description=${params.description},geography_code=${params.geography},age_group_codes=${params.ages}::text[],life_stage_codes=${params.stages}::text[],spending_power_codes=${params.spending}::text[],travel_purpose_code=${params.travel},discovery_channel_codes=${params.discovery}::text[],decision_factor_codes=${params.decisions}::text[],decision_factor_rank_codes=${params.decisions}::text[],discovery_openness_code=${params.openness},exclusions=${params.exclusions},evidence_source_code=${params.evidence},evidence_source_codes=${pgTextArray(params.evidence ? [params.evidence] : [])}::text[],confidence_flag=${reviewRequired ? 'assumption_not_tested' : 'brand_evidence'},review_required=${reviewRequired},notes=${params.notes},customer_outcome_code=${params.outcome},customer_outcome_detail=${params.outcomeDetail},customer_need=${params.outcomeDetail},need_context_codes=${params.contexts}::text[],current_alternative_code=${params.alternative},alternative_explanation=${params.alternativeExplanation},primary_barrier_code=${params.barrier},barrier_reducer_codes=${params.reducers}::text[],decision_notes=${params.decisionNotes},evidence_layer='brand_stated',updated_at=now() where id=${rows[0].id}::uuid`;
  } else {
    await sql`insert into public.brand_audience_profiles (organisation_id,product_id,onboarding_session_id,is_primary,description,geography_code,age_group_codes,life_stage_codes,spending_power_codes,travel_purpose_code,discovery_channel_codes,decision_factor_codes,decision_factor_rank_codes,discovery_openness_code,exclusions,evidence_source_code,evidence_source_codes,confidence_flag,review_required,notes,customer_outcome_code,customer_outcome_detail,customer_need,need_context_codes,current_alternative_code,alternative_explanation,primary_barrier_code,barrier_reducer_codes,decision_notes,evidence_layer) values (${organisationId}::uuid,${productId}::uuid,${sessionId}::uuid,true,${params.description},${params.geography},${params.ages}::text[],${params.stages}::text[],${params.spending}::text[],${params.travel},${params.discovery}::text[],${params.decisions}::text[],${params.decisions}::text[],${params.openness},${params.exclusions},${params.evidence},${pgTextArray(params.evidence ? [params.evidence] : [])}::text[],${reviewRequired ? 'assumption_not_tested' : 'brand_evidence'},${reviewRequired},${params.notes},${params.outcome},${params.outcomeDetail},${params.outcomeDetail},${params.contexts}::text[],${params.alternative},${params.alternativeExplanation},${params.barrier},${params.reducers}::text[],${params.decisionNotes},'brand_stated')`;
  }
}

async function upsertSecondaryAudience(sql: any, organisationId: string, sessionId: string, productId: string, form: Record<string, FormValue>) {
  if (first(form.secondaryAudienceEnabled) !== 'Yes' || !text(form.secondaryAudienceDescription)) {
    await sql`delete from public.brand_audience_profiles where organisation_id=${organisationId}::uuid and is_primary=false`;
    return;
  }
  const rows = await sql`select id from public.brand_audience_profiles where organisation_id=${organisationId}::uuid and is_primary=false order by created_at asc limit 1`;
  const evidence = code(first(form.secondaryAudienceEvidence));
  const reviewRequired = first(form.secondaryAudienceEvidence) === 'Assumption, not yet tested';
  if (rows.length) {
    await sql`update public.brand_audience_profiles set product_id=${productId}::uuid,onboarding_session_id=${sessionId}::uuid,description=${nullable(form.secondaryAudienceDescription)},geography_code=${code(first(form.secondaryAudienceGeography))},age_group_codes=${pgTextArray(codes(form.secondaryAgeGroups))}::text[],life_stage_codes=${pgTextArray(codes(form.secondaryLifeStages))}::text[],spending_power_codes=${pgTextArray(codes(form.secondarySpendingPower))}::text[],travel_purpose_code=${code(first(form.secondaryTravelPurpose))},discovery_channel_codes=${pgTextArray(codes(form.secondaryDiscoveryChannels))}::text[],decision_factor_codes=${pgTextArray(codes(form.secondaryDecisionFactors))}::text[],decision_factor_rank_codes=${pgTextArray(codes(form.secondaryDecisionFactors))}::text[],discovery_openness_code=${code(first(form.secondaryDiscoveryOpenness))},exclusions=${nullable(form.secondaryAudienceExclusions)},evidence_source_code=${evidence},evidence_source_codes=${pgTextArray(evidence ? [evidence] : [])}::text[],confidence_flag=${reviewRequired ? 'assumption_not_tested' : 'brand_evidence'},review_required=${reviewRequired},notes=${nullable(form.secondaryAudienceNotes)},evidence_layer='brand_stated',updated_at=now() where id=${rows[0].id}::uuid`;
  } else {
    await sql`insert into public.brand_audience_profiles (organisation_id,product_id,onboarding_session_id,is_primary,description,geography_code,age_group_codes,life_stage_codes,spending_power_codes,travel_purpose_code,discovery_channel_codes,decision_factor_codes,decision_factor_rank_codes,discovery_openness_code,exclusions,evidence_source_code,evidence_source_codes,confidence_flag,review_required,notes,evidence_layer) values (${organisationId}::uuid,${productId}::uuid,${sessionId}::uuid,false,${nullable(form.secondaryAudienceDescription)},${code(first(form.secondaryAudienceGeography))},${pgTextArray(codes(form.secondaryAgeGroups))}::text[],${pgTextArray(codes(form.secondaryLifeStages))}::text[],${pgTextArray(codes(form.secondarySpendingPower))}::text[],${code(first(form.secondaryTravelPurpose))},${pgTextArray(codes(form.secondaryDiscoveryChannels))}::text[],${pgTextArray(codes(form.secondaryDecisionFactors))}::text[],${pgTextArray(codes(form.secondaryDecisionFactors))}::text[],${code(first(form.secondaryDiscoveryOpenness))},${nullable(form.secondaryAudienceExclusions)},${evidence},${pgTextArray(evidence ? [evidence] : [])}::text[],${reviewRequired ? 'assumption_not_tested' : 'brand_evidence'},${reviewRequired},${nullable(form.secondaryAudienceNotes)},'brand_stated')`;
  }
}

async function upsertValueAdd(sql: any, organisationId: string, sessionId: string, form: Record<string, FormValue>) {
  await sql`insert into public.brand_value_add_profiles (organisation_id,onboarding_session_id,marketing_channel_codes,marketing_channel_rank_codes,measured_acquisition_channel_code,paid_marketing_code,experiential_history_codes,experiential_effectiveness_code,experiential_evidence_code,primary_opportunity_code) values (${organisationId}::uuid,${sessionId}::uuid,${pgTextArray(codes(form.marketingChannels))}::text[],${pgTextArray(codes(form.marketingChannelRank))}::text[],${code(first(form.measuredAcquisitionChannel))},${code(first(form.paidMarketing))},${pgTextArray(codes(form.experientialHistory))}::text[],${code(first(form.experientialEffectiveness))},${code(first(form.experientialEvidence))},${code(first(form.irlOpportunity))}) on conflict (organisation_id) do update set onboarding_session_id=excluded.onboarding_session_id,marketing_channel_codes=excluded.marketing_channel_codes,marketing_channel_rank_codes=excluded.marketing_channel_rank_codes,measured_acquisition_channel_code=excluded.measured_acquisition_channel_code,paid_marketing_code=excluded.paid_marketing_code,experiential_history_codes=excluded.experiential_history_codes,experiential_effectiveness_code=excluded.experiential_effectiveness_code,experiential_evidence_code=excluded.experiential_evidence_code,primary_opportunity_code=excluded.primary_opportunity_code,updated_at=now()`;
}

async function upsertSuccess(sql: any, organisationId: string, sessionId: string, form: Record<string, FormValue>) {
  await sql`insert into public.brand_success_profiles (organisation_id,onboarding_session_id,primary_success_result,reporting_signal_codes) values (${organisationId}::uuid,${sessionId}::uuid,${nullable(form.primarySuccessResult)},${pgTextArray(codes(form.successSignals))}::text[]) on conflict (organisation_id) do update set onboarding_session_id=excluded.onboarding_session_id,primary_success_result=excluded.primary_success_result,reporting_signal_codes=excluded.reporting_signal_codes,updated_at=now()`;
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
  await sql`insert into public.onboarding_audit_log (onboarding_session_id,organisation_id,event_type,schema_version,details) values (${sessionId}::uuid,${organisationId}::uuid,${eventType},${schemaVersion || 'brand-onboarding-baseline-v01'},${JSON.stringify(details)}::jsonb)`;
}

function codes(value: FormValue | undefined) {
  const values = Array.isArray(value) && value.every(item => typeof item === 'string') ? value as string[] : text(value) ? text(value).split(',').map((item) => item.trim()).filter(Boolean) : [];
  return values.map(code).filter(Boolean) as string[];
}
function code(value: string) { return value ? slugify(value).replace(/-/g, '_') : null; }
function first(value: FormValue | undefined) { return Array.isArray(value) && (value.length === 0 || typeof value[0] === 'string') ? String(value[0] || '') : text(value); }
function text(value: FormValue | undefined) { return typeof value === 'string' ? value.trim() : ''; }
function nullable(value: FormValue | undefined) { return text(value) || null; }
function nullableText(value: string | undefined) { return value?.trim() || null; }
function percentage(value: unknown) { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0; }
function numberOrNull(value: FormValue | undefined) { const raw = text(value); if (!raw) return null; const n = Number(raw); return Number.isFinite(n) && n >= 0 ? n : null; }
function booleanChoice(value: FormValue | undefined) { const selected = first(value); return selected === 'Yes' ? true : selected === 'No' ? false : null; }
function objects(value: FormValue | undefined) { return Array.isArray(value) && value.every(item => typeof item === 'object') ? value as NestedAnswer[] : []; }
function firstNested(value: string | string[] | undefined) { return Array.isArray(value) ? String(value[0] || '') : String(value || '').trim(); }
function codesNested(value: string | string[] | undefined) { const values = Array.isArray(value) ? value : firstNested(value).split(',').map(item => item.trim()).filter(Boolean); return values.map(item => code(item)).filter(Boolean) as string[]; }
function nullableNested(value: string | string[] | undefined) { const result = firstNested(value); return result || null; }
function numberOrNullNested(value: string | string[] | undefined) { const raw = firstNested(value); if (!raw) return null; const n = Number(raw); return Number.isFinite(n) && n >= 0 ? n : null; }
function pgTextArray(values: string[]) { return `{${values.map((item) => `"${String(item).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')}}`; }
function slugify(value: unknown) { return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100); }
function countryCode(value: FormValue | undefined) {
  const raw = text(value);
  if (!raw) return null;
  const map: Record<string, string> = { 'south africa':'ZA','united kingdom':'GB','uk':'GB','zimbabwe':'ZW','united states':'US','usa':'US','united arab emirates':'AE','uae':'AE' };
  if (/^[a-z]{2}$/i.test(raw)) return raw.toUpperCase();
  return map[raw.toLowerCase()] || null;
}
