export function validateSubmission(body: unknown, flow: 'brand' | 'operator'): string | null {
  if (!body || typeof body !== 'object') return 'Invalid onboarding request.';
  const payload = body as Record<string, unknown>;
  const form = payload.form;
  if (payload.flow !== flow || !form || typeof form !== 'object' || Array.isArray(form)) return 'Invalid onboarding form.';
  if (payload.submit !== undefined && typeof payload.submit !== 'boolean') return 'Invalid submission status.';
  if (payload.session_id != null && (typeof payload.session_id !== 'string' || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(payload.session_id))) return 'Invalid saved session.';
  if (Object.keys(form).length > 250 || Object.values(form).some(value => !validAnswer(value))) return 'Invalid answer format.';
  if (!payload.submit) return null;
  const answers = form as Record<string, unknown>;
  const required = flow === 'brand' ? ['brandName', 'brandWebsite', 'brandCountry', 'brandDescription', 'firstName', 'lastName', 'email', 'jobTitle', 'productName', 'priceCurrency', 'priceMin', 'audienceDescription', 'primarySuccessResult'] : ['operatorName', 'operatorFirstName', 'operatorLastName', 'operatorEmail', 'propertyName'];
  if (required.some(key => typeof answers[key] !== 'string' || !String(answers[key]).trim())) return 'Add the organisation, primary contact and product or property details before submitting.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(answers[flow === 'brand' ? 'email' : 'operatorEmail']))) return 'Enter a valid contact email before submitting.';
  if (flow === 'brand') {
    if (!hasListValue(answers.activeMarkets)) return 'Add at least one active market.';
    if (!/^[A-Z]{3}$/.test(String(answers.priceCurrency))) return 'Choose a valid three-letter currency code.';
    const requiredChoices = ['onboardingRole', 'partOfGroup', 'brandPrimaryCategory', 'brandDifferentiator', 'brandValues', 'salesChannels', 'productScope', 'hasProductWebpage', 'productCategory', 'productSubcategory', 'sameProductAvailability', 'internationalShipping', 'audienceEvidence', 'audienceGeography', 'decisionFactors', 'discoveryOpenness', 'customerOutcome', 'needContext', 'currentAlternative', 'primaryBarrier', 'barrierReducers', 'marketingChannels', 'marketingChannelRank', 'measuredAcquisitionChannel', 'paidMarketing', 'experientialHistory', 'irlOpportunity', 'successSignals', 'brandSuggestedPlacements', 'handlingRequirements', 'supplyCapability'];
    if (requiredChoices.some(key => !hasChoice(answers[key]))) return 'Complete all required Brand Profile questions before submitting.';
    const role = firstChoice(answers.onboardingRole);
    if (role === 'Neither') return 'The Brand Profile must be completed by the day-to-day contact or approver.';
    if (['Day-to-day contact', 'Approver'].includes(role) && ['counterpartFirstName', 'counterpartLastName', 'counterpartEmail', 'counterpartJobTitle'].some(key => typeof answers[key] !== 'string' || !String(answers[key]).trim())) return 'Add the required counterpart contact before submitting.';
    if (firstChoice(answers.partOfGroup) === 'Yes' && !String(answers.parentCompany || '').trim()) return 'Add the parent company or group name.';
    if (firstChoice(answers.hasProductWebpage) === 'Yes' && !String(answers.productWebpage || '').trim()) return 'Add the product webpage.';
    if (firstChoice(answers.sameProductAvailability) === 'No' && (!String(answers.productMarkets || '').trim() || !hasChoice(answers.productChannels))) return 'Add the product-specific markets and channels.';
    if (firstChoice(answers.internationalShipping) === 'Yes, to specific regions' && !String(answers.internationalShippingRegions || '').trim()) return 'Add the international shipping regions.';
    if (firstChoice(answers.audienceGeography) === 'Specific countries or regions' && !String(answers.audienceGeographyDetail || '').trim()) return 'Add the audience countries or regions.';
    if (firstChoice(answers.brandPrimaryCategory) === 'Health & Wellness' && !String(answers.legalSafetyCompliance || '').trim()) return 'Add the required legal, safety or compliance information.';
    if (choiceCount(answers.decisionFactors) !== 3) return 'Rank exactly three audience decision priorities.';
    const channelCount = choiceCount(answers.marketingChannels);
    if (choiceCount(answers.marketingChannelRank) !== Math.min(3, channelCount)) return 'Rank up to three of the marketing channels you use most.';
    if (firstChoice(answers.secondaryAudienceEnabled) === 'Yes' && ['secondaryAudienceDescription', 'secondaryAudienceEvidence', 'secondaryAudienceGeography', 'secondaryDecisionFactors', 'secondaryDiscoveryOpenness'].some(key => key === 'secondaryAudienceDescription' ? !String(answers[key] || '').trim() : !hasChoice(answers[key]))) return 'Complete the required secondary audience questions or remove that audience.';
    if (firstChoice(answers.secondaryAudienceEnabled) === 'Yes' && firstChoice(answers.secondaryAudienceGeography) === 'Specific countries or regions' && !String(answers.secondaryAudienceGeographyDetail || '').trim()) return 'Add the secondary audience countries or regions.';
    const otherFields = ['brandPrimaryCategory', 'brandSecondaryCategories', 'salesChannels', 'productCategory', 'productSubcategory', 'productChannels', 'audienceEvidence', 'lifeStages', 'discoveryChannels', 'decisionFactors', 'customerOutcome', 'marketingChannels', 'experientialHistory', 'successSignals', 'brandSuggestedPlacements', 'handlingRequirements'];
    for (const key of otherFields) if (includesOther(answers[key]) && !String(answers[`${key}Other`] || '').trim()) return `Add details for Other in ${key}.`;
    const secondaryOtherFields = ['secondaryAudienceEvidence', 'secondaryLifeStages', 'secondaryDiscoveryChannels', 'secondaryDecisionFactors'];
    for (const key of secondaryOtherFields) if (firstChoice(answers.secondaryAudienceEnabled) === 'Yes' && includesOther(answers[key]) && !String(answers[`${key}Other`] || '').trim()) return `Add details for Other in ${key}.`;
    if (!validNestedContacts(answers.additionalContacts)) return 'Complete or remove each additional contact.';
    if (!validNestedProducts(answers.additionalProducts)) return 'Complete or remove each additional product.';
    const experiential = Array.isArray(answers.experientialHistory) ? answers.experientialHistory : [];
    if (experiential.some(value => value !== 'None of these') && (!hasChoice(answers.experientialEffectiveness) || !hasChoice(answers.experientialEvidence))) return 'Complete the experiential marketing follow-up questions.';
    if (answers.profileConfirmed !== 'yes') return 'Confirm that your Brand Profile is accurate before submitting.';
  }
  return null;
}

function validAnswer(value: unknown): boolean {
  if (typeof value === 'string') return value.length <= 10000;
  if (!Array.isArray(value)) return false;
  if (value.every(item => typeof item === 'string')) return value.length <= 250 && value.every(item => item.length <= 1000);
  if (value.length > 20) return false;
  return value.every(item => Boolean(item) && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).length <= 20 && Object.values(item).every(nested => typeof nested === 'string' ? nested.length <= 10000 : Array.isArray(nested) && nested.length <= 20 && nested.every(entry => typeof entry === 'string' && entry.length <= 1000)));
}
function hasChoice(value: unknown) { return Array.isArray(value) && value.some(item => typeof item === 'string' && item.trim()); }
function hasListValue(value: unknown) { return typeof value === 'string' ? Boolean(value.trim()) : hasChoice(value); }
function includesOther(value: unknown) { return Array.isArray(value) && value.includes('Other'); }
function firstChoice(value: unknown) { return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : ''; }
function choiceCount(value: unknown) { return Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim()).length : 0; }
function validNestedContacts(value: unknown) {
  if (value === undefined) return true;
  return Array.isArray(value) && value.length <= 4 && value.every(item => Boolean(item) && typeof item === 'object' && ['firstName', 'lastName', 'email', 'jobTitle'].every(key => typeof (item as Record<string, unknown>)[key] === 'string' && String((item as Record<string, unknown>)[key]).trim()));
}
function validNestedProducts(value: unknown) {
  if (value === undefined) return true;
  return Array.isArray(value) && value.length <= 3 && value.every(item => {
    if (!item || typeof item !== 'object') return false;
    const product = item as Record<string, unknown>;
    const requiredText = ['name', 'currency', 'priceMin'].every(key => typeof product[key] === 'string' && String(product[key]).trim());
    const requiredChoices = ['hasWebpage', 'category', 'subcategory', 'sameAvailability', 'internationalShipping'].every(key => hasChoice(product[key]));
    if (!requiredText || !requiredChoices) return false;
    if (!/^[A-Z]{3}$/.test(String(product.currency))) return false;
    if (firstChoice(product.hasWebpage) === 'Yes' && !String(product.webpage || '').trim()) return false;
    if (firstChoice(product.sameAvailability) === 'No' && (!String(product.markets || '').trim() || !hasChoice(product.channels))) return false;
    if (firstChoice(product.internationalShipping) === 'Yes, to specific regions' && !String(product.shippingRegions || '').trim()) return false;
    if (firstChoice(product.category) === 'Health & Wellness' && !String(product.legalSafetyCompliance || '').trim()) return false;
    if (firstChoice(product.category) === 'Other' && !String(product.categoryOther || '').trim()) return false;
    if (firstChoice(product.subcategory) === 'Other' && !String(product.subcategoryOther || '').trim()) return false;
    if (includesOther(product.channels) && !String(product.channelsOther || '').trim()) return false;
    return true;
  });
}
