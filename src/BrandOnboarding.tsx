import { Check, FileUp, Plus, Trash2 } from 'lucide-react';

export type NestedAnswer = Record<string, string | string[]>;
export type BrandFormValue = string | string[] | NestedAnswer[];
export type BrandForm = Record<string, BrandFormValue>;

type Props = {
  step: string;
  form: BrandForm;
  update: (key: string, value: BrandFormValue) => void;
  toggle: (key: string, value: string, max?: number) => void;
};

type FieldProps = {
  label: string;
  name: string;
  form: BrandForm;
  update: Props['update'];
  type?: string;
  placeholder?: string;
  optional?: boolean;
  helper?: string;
  maxLength?: number;
};

export const primaryCategories = ['Food & Beverage', 'Health & Wellness', 'Beauty & Personal Care', 'Sleep & Bedding', 'Home & Living', 'Outdoor & Movement', 'Other'];
export const subcategories: Record<string, string[]> = {
  'Food & Beverage': ['Tea & Coffee', 'Water & Hydration', 'Instant & Hot Beverages', 'Confectionery & Gifting', 'Snacks & Food', 'Alcohol', 'Other'],
  'Health & Wellness': ['Functional Shots & Supplements', 'Recovery & Performance', 'Vitamins & Nutrition', 'CBD & Wellness', 'Other'],
  'Beauty & Personal Care': ['Skincare', 'Bath & Body', 'Haircare', 'Fragrance (Personal)', 'Other'],
  'Sleep & Bedding': ['Mattress', 'Linen & Textiles', 'Pillows & Sleep Accessories', 'Other'],
  'Home & Living': ['Candles & Home Fragrance', 'Décor & Lighting', 'Kitchenware', 'Other'],
  'Outdoor & Movement': ['Fitness Accessories', 'Outdoor Gear', 'Apparel', 'Other'],
  Other: ['Other'],
};

const salesChannels = ['Brand website', 'Brand-owned stores', 'Major retail', 'Independent retail', 'Online marketplaces', 'Hospitality', 'Professional or trade channels', 'Subscription', 'Other'];
const audienceGeography = ['Primarily South African', 'Primarily international', 'Both local and international', 'Specific countries or regions', 'Geography is not a priority'];
const ageGroups = ['Under 18', '18–24', '25–34', '35–44', '45–54', '55–64', '65+', 'Age is not a priority'];
const lifeStages = ['Student', 'Early-career professional', 'Established professional', 'Entrepreneur or business owner', 'Parent or caregiver', 'Retired', 'Other', 'Life stage is not a priority'];
const spendingPower = ['Value-conscious', 'Mainstream', 'Premium', 'Affluent', 'Luxury', 'Mixed or broad', 'Not sure'];
const discoveryChannels = ['Instagram', 'TikTok', 'Facebook', 'YouTube', 'Google Search', 'Online marketplaces', 'Influencer or creator content', 'Word of mouth', "Brand's own website", 'Other'];
const decisionFactors = ['Price', 'Quality', 'Performance', 'Design', 'Ingredients or materials', 'Convenience', 'Trust', 'Reviews or recommendations', 'Sustainability', 'Local provenance', 'Status or identity', 'Availability', 'Other'];
const needContexts = ['Morning', 'Evening', 'Before or during travel', 'During social occasions', 'During or after exercise', 'When stressed or tired', 'During daily routine', 'Special occasions', 'Not time-specific'];
const marketingChannels = ['Social media (organic)', 'Paid social ads', 'Google or search ads', 'Influencer or creator partnerships', 'Email marketing', 'PR or media coverage', 'Retail or in-store presence', 'Word of mouth', 'Events or activations', 'Own website', 'Other'];
const opportunities = ['Not enough people know we exist', "People know us but haven't tried us", "They've tried us but don't come back", 'They buy elsewhere, we need loyalty', 'We lack real customer trust or proof', 'Distribution is the problem, not demand', 'Not sure yet'];
const experientialTactics = ['Sampling', 'Gifting', 'Events', 'Influencer gifting', 'Retail activation', 'Hospitality placement', 'Other', 'None of these'];
const placementOptions = ['Bedside', 'Bathroom', 'Kitchen or dining', 'Communal or shared area', 'Reception or arrival', 'Welcome gift', 'Outdoor space', 'Other'];
const handlingRequirements = ['Refrigeration', 'Electricity', 'Water', 'Preparation', 'Staff involvement', 'Secure storage', 'Age restriction', 'Fragile handling', 'Installation', 'Regular replenishment', 'None', 'Other'];
const successSignals = ['Guests reached', 'Guest nights or exposure', 'Product use', 'Repeat use', 'Guest feedback', 'QR or page engagement', 'Redemptions or purchases', 'Content generated', 'Operational fulfilment', 'Other'];

function selectedOne(value: BrandFormValue | undefined) {
  return Array.isArray(value) && (value.length === 0 || typeof value[0] === 'string') ? String(value[0] || '') : typeof value === 'string' ? value : '';
}

function Field({ label, name, form, update, type = 'text', placeholder = '', optional = false, helper, maxLength }: FieldProps) {
  return <label className="field"><span>{label} {optional && <em>Optional</em>}</span>{helper && <small>{helper}</small>}<input type={type} value={typeof form[name] === 'string' ? form[name] as string : ''} placeholder={placeholder} maxLength={maxLength} onChange={(event) => update(name, event.target.value)} /></label>;
}

function TextArea({ label, name, form, update, optional = false, helper, maxLength }: Omit<FieldProps, 'type' | 'placeholder'>) {
  return <label className="field"><span>{label} {optional && <em>Optional</em>}</span>{helper && <small>{helper}</small>}<textarea value={typeof form[name] === 'string' ? form[name] as string : ''} maxLength={maxLength} onChange={(event) => update(name, event.target.value)} /></label>;
}

function ChoiceGrid({ label, name, options, form, toggle, max, optional = false, helper, ranked = false }: { label: string; name: string; options: string[]; form: BrandForm; toggle: Props['toggle']; max?: number; optional?: boolean; helper?: string; ranked?: boolean }) {
  const selected = Array.isArray(form[name]) && (form[name] as unknown[]).every(item => typeof item === 'string') ? form[name] as string[] : [];
  return <fieldset className="field"><legend>{label} {optional && <em>Optional</em>}{helper && <small>{helper}</small>}{max && <small>{selected.length} of {max} selected{ranked ? ' in priority order' : ''}</small>}</legend><div className="choice-grid">{options.map((option) => {
    const rank = selected.indexOf(option);
    return <button type="button" key={option} className={rank >= 0 ? 'selected' : ''} onClick={() => toggle(name, option, max)}>{ranked && rank >= 0 ? <span className="rank-number">{rank + 1}</span> : rank >= 0 ? <Check size={15} /> : null}{option}</button>;
  })}</div></fieldset>;
}

function SingleChoice(props: Omit<Parameters<typeof ChoiceGrid>[0], 'max' | 'ranked'>) { return <ChoiceGrid {...props} max={1} />; }

function UploadPlaceholder({ label, helper }: { label: string; helper: string }) {
  return <div className="upload-placeholder brand-upload"><FileUp size={20} /><div><strong>{label} <em>Optional</em></strong><p>{helper}</p><small>Document storage is not connected yet. You can submit the profile without an upload.</small></div></div>;
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) { return <button type="button" className="text-action add-row" onClick={onClick}><Plus size={16} /> {label}</button>; }

function NestedField({ label, value, onChange, type = 'text', optional = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; optional?: boolean }) {
  return <label className="field"><span>{label} {optional && <em>Optional</em>}</span><input type={type} value={value} onChange={event => onChange(event.target.value)} /></label>;
}

function nested(form: BrandForm, key: string) {
  const value = form[key];
  return Array.isArray(value) && value.every(item => typeof item === 'object') ? value as NestedAnswer[] : [];
}

function updateNested(form: BrandForm, key: string, index: number, field: string, value: string | string[], update: Props['update']) {
  const rows = [...nested(form, key)];
  rows[index] = { ...(rows[index] || {}), [field]: value };
  update(key, rows);
}

function addNested(form: BrandForm, key: string, update: Props['update']) { update(key, [...nested(form, key), {}]); }
function removeNested(form: BrandForm, key: string, index: number, update: Props['update']) { update(key, nested(form, key).filter((_, rowIndex) => rowIndex !== index)); }

function NestedSingleChoice({ label, value, options, onChange }: { label: string; value: string | string[] | undefined; options: string[]; onChange: (value: string[]) => void }) {
  const selected = Array.isArray(value) ? value : [];
  return <fieldset className="field"><legend>{label}</legend><div className="choice-grid">{options.map(option => <button type="button" key={option} className={selected.includes(option) ? 'selected' : ''} onClick={() => onChange(selected.includes(option) ? [] : [option])}>{selected.includes(option) && <Check size={15} />}{option}</button>)}</div></fieldset>;
}

function NestedChoiceGrid({ label, value, options, onChange }: { label: string; value: string | string[] | undefined; options: string[]; onChange: (value: string[]) => void }) {
  const selected = Array.isArray(value) ? value : [];
  return <fieldset className="field"><legend>{label}<small>Select all that apply</small></legend><div className="choice-grid">{options.map(option => <button type="button" key={option} className={selected.includes(option) ? 'selected' : ''} onClick={() => onChange(selected.includes(option) ? selected.filter(item => item !== option) : [...selected, option])}>{selected.includes(option) && <Check size={15} />}{option}</button>)}</div></fieldset>;
}

function AdditionalContacts({ form, update }: Pick<Props, 'form' | 'update'>) {
  const rows = nested(form, 'additionalContacts');
  return <>{rows.map((contact, index) => <div className="progressive-card" key={`contact-${index}`}><div className="progressive-heading"><h3>Additional contact {index + 1}</h3><button type="button" className="icon-action" aria-label={`Remove additional contact ${index + 1}`} onClick={() => removeNested(form, 'additionalContacts', index, update)}><Trash2 size={17} /></button></div><div className="field-row"><NestedField label="First name" value={String(contact.firstName || '')} onChange={value => updateNested(form, 'additionalContacts', index, 'firstName', value, update)} /><NestedField label="Last name" value={String(contact.lastName || '')} onChange={value => updateNested(form, 'additionalContacts', index, 'lastName', value, update)} /></div><NestedField label="Work email" type="email" value={String(contact.email || '')} onChange={value => updateNested(form, 'additionalContacts', index, 'email', value, update)} /><NestedField label="Job title or role" value={String(contact.jobTitle || '')} onChange={value => updateNested(form, 'additionalContacts', index, 'jobTitle', value, update)} /></div>)}{rows.length < 4 && <AddButton label="Add another contact" onClick={() => addNested(form, 'additionalContacts', update)} />}</>;
}

function AdditionalProducts({ form, update, categories }: Pick<Props, 'form' | 'update'> & { categories: string[] }) {
  const rows = nested(form, 'additionalProducts');
  return <>{rows.map((product, index) => {
    const category = Array.isArray(product.category) ? String(product.category[0] || '') : '';
    const hasWebpage = Array.isArray(product.hasWebpage) ? String(product.hasWebpage[0] || '') : '';
    const sameAvailability = Array.isArray(product.sameAvailability) ? String(product.sameAvailability[0] || '') : '';
    const shipping = Array.isArray(product.internationalShipping) ? String(product.internationalShipping[0] || '') : '';
    return <div className="progressive-card" key={`product-${index}`}><div className="progressive-heading"><h3>Additional product or range {index + 1}</h3><button type="button" className="icon-action" aria-label={`Remove additional product ${index + 1}`} onClick={() => removeNested(form, 'additionalProducts', index, update)}><Trash2 size={17} /></button></div><NestedField label="Product or range name" value={String(product.name || '')} onChange={value => updateNested(form, 'additionalProducts', index, 'name', value, update)} /><NestedSingleChoice label="Does it have a product webpage?" value={product.hasWebpage} options={['Yes', 'No']} onChange={value => updateNested(form, 'additionalProducts', index, 'hasWebpage', value, update)} />{hasWebpage === 'Yes' && <NestedField label="Product webpage" type="url" value={String(product.webpage || '')} onChange={value => updateNested(form, 'additionalProducts', index, 'webpage', value, update)} />}<NestedSingleChoice label="Product category" value={product.category} options={categories} onChange={value => updateNested(form, 'additionalProducts', index, 'category', value, update)} />{category && <NestedSingleChoice label="Product subcategory" value={product.subcategory} options={subcategories[category] || ['Other']} onChange={value => updateNested(form, 'additionalProducts', index, 'subcategory', value, update)} />}<div className="field-row"><NestedField label="Currency" value={String(product.currency || '')} onChange={value => updateNested(form, 'additionalProducts', index, 'currency', value, update)} /><NestedField label="Minimum retail price" type="number" value={String(product.priceMin || '')} onChange={value => updateNested(form, 'additionalProducts', index, 'priceMin', value, update)} /></div><NestedField label="Maximum retail price" type="number" optional value={String(product.priceMax || '')} onChange={value => updateNested(form, 'additionalProducts', index, 'priceMax', value, update)} /><NestedField label="Variants" optional value={String(product.variants || '')} onChange={value => updateNested(form, 'additionalProducts', index, 'variants', value, update)} /><NestedSingleChoice label="Same markets and channels as the brand?" value={product.sameAvailability} options={['Yes', 'No']} onChange={value => updateNested(form, 'additionalProducts', index, 'sameAvailability', value, update)} />{sameAvailability === 'No' && <><NestedField label="Product-specific markets" value={String(product.markets || '')} onChange={value => updateNested(form, 'additionalProducts', index, 'markets', value, update)} /><NestedChoiceGrid label="Product-specific channels" value={product.channels} options={salesChannels} onChange={value => updateNested(form, 'additionalProducts', index, 'channels', value, update)} /></>}<NestedSingleChoice label="Do you ship this product internationally?" value={product.internationalShipping} options={['Yes', 'Yes, to specific regions', 'No']} onChange={value => updateNested(form, 'additionalProducts', index, 'internationalShipping', value, update)} />{shipping === 'Yes, to specific regions' && <NestedField label="International shipping regions" value={String(product.shippingRegions || '')} onChange={value => updateNested(form, 'additionalProducts', index, 'shippingRegions', value, update)} />}<NestedField label="Legal, safety or compliance information" optional value={String(product.legalSafetyCompliance || '')} onChange={value => updateNested(form, 'additionalProducts', index, 'legalSafetyCompliance', value, update)} /></div>;
  })}{rows.length < 3 && <AddButton label="Add another product or range" onClick={() => addNested(form, 'additionalProducts', update)} />}</>;
}

function CounterpartContact({ role, form, update }: { role: 'Approver' | 'Day-to-day contact'; form: BrandForm; update: Props['update'] }) {
  return <div className="progressive-card"><h3>{role}</h3><p className="progressive-intro">Please add the person IRL should work with in this role.</p><div className="field-row"><Field label="First name" name="counterpartFirstName" form={form} update={update} /><Field label="Last name" name="counterpartLastName" form={form} update={update} /></div><Field label="Work email" name="counterpartEmail" type="email" form={form} update={update} /><Field label="Job title" name="counterpartJobTitle" form={form} update={update} /></div>;
}

function AudienceFields({ prefix = '', form, update, toggle }: Props & { prefix?: string }) {
  const key = (name: string) => prefix ? `${prefix}${name.charAt(0).toUpperCase()}${name.slice(1)}` : name;
  return <>
    <TextArea label="Describe this priority audience" name={key('audienceDescription')} form={form} update={update} maxLength={200} helper="Maximum 200 characters." />
    <SingleChoice label="How do you know this about your audience?" name={key('audienceEvidence')} options={['Customer or sales data', 'Surveys or customer feedback', 'Social media analytics', 'Industry research', "Founder's direct experience", 'Assumption, not yet tested', 'Other']} form={form} toggle={toggle} />
    {selectedOne(form[key('audienceEvidence')]) === 'Assumption, not yet tested' && <p className="field-notice">IRL will mark this audience information for review before it informs a match.</p>}
    <SingleChoice label="Where is this audience based?" name={key('audienceGeography')} options={audienceGeography} form={form} toggle={toggle} />
    <details><summary>Add optional audience detail</summary>
      <ChoiceGrid label="Which age groups are most relevant?" name={key('ageGroups')} options={ageGroups} form={form} toggle={toggle} max={3} optional />
      <ChoiceGrid label="Which life stages are most relevant?" name={key('lifeStages')} options={lifeStages} form={form} toggle={toggle} max={3} optional />
      <ChoiceGrid label="Which income or spending-power bands are most relevant?" name={key('spendingPower')} options={spendingPower} form={form} toggle={toggle} optional />
      <SingleChoice label="Is this customer typically travelling for business, leisure, or both?" name={key('travelPurpose')} options={['Business', 'Leisure', 'Both', 'Not travel-related', 'Not sure']} form={form} toggle={toggle} optional />
      <ChoiceGrid label="Where do they typically discover or buy products like yours?" name={key('discoveryChannels')} options={discoveryChannels} form={form} toggle={toggle} max={4} optional />
    </details>
    <ChoiceGrid label="What matters most when they choose this type of product?" name={key('decisionFactors')} options={decisionFactors} form={form} toggle={toggle} max={3} ranked helper="Choose their first, second and third priorities in order." />
    <SingleChoice label="How open are they to trying an unfamiliar brand or product?" name={key('discoveryOpenness')} options={['1 — Very unlikely', '2', '3 — Neutral', '4', '5 — Very open', 'Not sure']} form={form} toggle={toggle} />
    <Field label="Is there anyone this product is not intended for?" name={key('audienceExclusions')} form={form} update={update} optional />
    <TextArea label="Is there anything else IRL should understand about this audience?" name={key('audienceNotes')} form={form} update={update} optional />
  </>;
}

export default function BrandOnboardingStep({ step, form, update, toggle }: Props) {
  if (step === 'team') {
    const role = selectedOne(form.onboardingRole);
    if (role === 'Neither') return <><SingleChoice label="Which best describes your role in this partnership?" name="onboardingRole" options={['Day-to-day contact', 'Approver', 'Both', 'Neither']} form={form} toggle={toggle} /><div className="forward-message"><h3>Please send this profile to the right person</h3><p>The questionnaire should be completed by the day-to-day IRL contact, the approver, or someone who fulfils both roles. Your answers have been saved on this device.</p></div></>;
    return <><div className="field-row"><Field label="First name" name="firstName" form={form} update={update} /><Field label="Last name" name="lastName" form={form} update={update} /></div><Field label="Work email" name="email" type="email" form={form} update={update} /><Field label="Mobile number" name="mobile" type="tel" form={form} update={update} optional /><Field label="Job title" name="jobTitle" form={form} update={update} /><SingleChoice label="Which best describes your role in this partnership?" name="onboardingRole" options={['Day-to-day contact', 'Approver', 'Both', 'Neither']} form={form} toggle={toggle} />{role === 'Day-to-day contact' && <CounterpartContact role="Approver" form={form} update={update} />}{role === 'Approver' && <CounterpartContact role="Day-to-day contact" form={form} update={update} />}<AdditionalContacts form={form} update={update} /></>;
  }

  if (step === 'brand') return <><Field label="Brand name" name="brandName" form={form} update={update} /><Field label="Brand website" name="brandWebsite" type="url" form={form} update={update} /><SingleChoice label="Is the brand part of a larger company or group?" name="partOfGroup" options={['No', 'Yes']} form={form} toggle={toggle} />{selectedOne(form.partOfGroup) === 'Yes' && <Field label="Parent company or group name" name="parentCompany" form={form} update={update} />}<div className="field-row"><Field label="Country" name="brandCountry" form={form} update={update} helper="Where is the brand based?" /><Field label="City" name="brandCity" form={form} update={update} optional /></div><Field label="Which markets is the brand currently active in?" name="activeMarkets" form={form} update={update} helper="Enter countries or regions, separated by commas." /><SingleChoice label="What is the brand's primary category?" name="brandPrimaryCategory" options={primaryCategories} form={form} toggle={toggle} /><ChoiceGrid label="Does the brand also operate in another category?" name="brandSecondaryCategories" options={primaryCategories.filter(category => category !== selectedOne(form.brandPrimaryCategory))} form={form} toggle={toggle} max={2} optional /><TextArea label="How would you describe the brand in one sentence?" name="brandDescription" form={form} update={update} helper="Maximum 200 characters." maxLength={200} /><SingleChoice label="What most sets your brand apart?" name="brandDifferentiator" options={['Product quality', 'Innovation', 'Design', 'Price', 'Convenience', 'Expertise']} form={form} toggle={toggle} /><SingleChoice label="What does your brand stand for?" name="brandValues" options={['Sustainability', 'Craft', 'Heritage', 'Community', 'Wellness', 'Status & Identity']} form={form} toggle={toggle} /><ChoiceGrid label="Where can customers currently buy the brand?" name="salesChannels" options={salesChannels} form={form} toggle={toggle} /><TextArea label="Are there any competitor brands or categories you'd rather we didn't place you alongside?" name="competitorLockouts" form={form} update={update} optional /><TextArea label="Which 3–4 brands would be in your ideal customer's bag?" name="brandNeighbourhood" form={form} update={update} optional helper="This helps IRL understand how you see your brand. It will not be scored as a matching field." /></>;

  if (step === 'product') {
    const category = selectedOne(form.productCategory);
    const secondary = Array.isArray(form.brandSecondaryCategories) ? form.brandSecondaryCategories as string[] : [];
    const allowedCategories = [selectedOne(form.brandPrimaryCategory), ...secondary].filter(Boolean);
    const categoryOptions = allowedCategories.length ? allowedCategories : primaryCategories;
    return <><SingleChoice label="What should IRL consider?" name="productScope" options={['One specific product', 'A product range', 'Several products', 'Help us decide']} form={form} toggle={toggle} /><Field label="Product or range name" name="productName" form={form} update={update} /><SingleChoice label="Does it have a product webpage?" name="hasProductWebpage" options={['Yes', 'No']} form={form} toggle={toggle} />{selectedOne(form.hasProductWebpage) === 'Yes' && <Field label="Product webpage" name="productWebpage" type="url" form={form} update={update} />}<SingleChoice label="Product category" name="productCategory" options={categoryOptions} form={form} toggle={toggle} />{category && <SingleChoice label="Product subcategory" name="productSubcategory" options={subcategories[category] || ['Other']} form={form} toggle={toggle} />}<div className="field-row"><Field label="Currency" name="priceCurrency" form={form} update={update} placeholder="ZAR" /><Field label="Minimum retail price" name="priceMin" type="number" form={form} update={update} /></div><Field label="Maximum retail price" name="priceMax" type="number" form={form} update={update} optional helper="Leave blank for a single-price product." /><Field label="Which variants should IRL consider?" name="variants" form={form} update={update} optional /><SingleChoice label="Is this product available through the same markets and channels listed for the brand?" name="sameProductAvailability" options={['Yes', 'No']} form={form} toggle={toggle} />{selectedOne(form.sameProductAvailability) === 'No' && <div className="progressive-card"><Field label="Product-specific markets" name="productMarkets" form={form} update={update} /><ChoiceGrid label="Product-specific channels" name="productChannels" options={salesChannels} form={form} toggle={toggle} /></div>}<SingleChoice label="Do you ship internationally?" name="internationalShipping" options={['Yes', 'Yes, to specific regions', 'No']} form={form} toggle={toggle} />{selectedOne(form.internationalShipping) === 'Yes, to specific regions' && <Field label="Which regions do you ship to?" name="internationalShippingRegions" form={form} update={update} />}<TextArea label="Is there anything we need to know for legal, safety, or compliance reasons before your product goes in front of a guest?" name="legalSafetyCompliance" form={form} update={update} optional={selectedOne(form.brandPrimaryCategory) !== 'Health & Wellness'} helper={selectedOne(form.brandPrimaryCategory) === 'Health & Wellness' ? 'Required for Health & Wellness brands.' : 'Include age restrictions, health warnings or ingredient concerns.'} /><AdditionalProducts form={form} update={update} categories={categoryOptions} /></>;
  }

  if (step === 'audience') return <><AudienceFields step={step} form={form} update={update} toggle={toggle} /><UploadPlaceholder label="Upload existing audience material" helper="Persona, research, survey or audience deck." />{selectedOne(form.secondaryAudienceEnabled) === 'Yes' ? <div className="progressive-card"><div className="progressive-heading"><h3>Secondary audience</h3><button type="button" className="icon-action" aria-label="Remove secondary audience" onClick={() => update('secondaryAudienceEnabled', [])}><Trash2 size={17} /></button></div><AudienceFields prefix="secondary" step={step} form={form} update={update} toggle={toggle} /></div> : <AddButton label="Add a secondary audience" onClick={() => update('secondaryAudienceEnabled', ['Yes'])} />}</>;

  if (step === 'need') return <><SingleChoice label="What outcome is your customer looking for?" name="customerOutcome" options={['Save time', 'Feel confident or reassured', 'Feel good or indulge', 'Improve health or performance', 'Look or feel better', 'Simplify a routine', 'Feel calm or relaxed', 'Enhance my home or space', 'Solve a specific problem', 'Other']} form={form} toggle={toggle} /><Field label="Add detail if useful" name="customerOutcomeDetail" form={form} update={update} optional maxLength={100} helper="Maximum 100 characters." /><ChoiceGrid label="When is this need most relevant?" name="needContext" options={needContexts} form={form} toggle={toggle} max={3} /><SingleChoice label="What are they currently using instead?" name="currentAlternative" options={['Nothing, this is new to them', 'A competitor brand', 'A generic or unbranded alternative', 'A DIY or homemade solution', 'They avoid the category entirely', 'Not sure']} form={form} toggle={toggle} /><Field label="Add an explanation if useful" name="alternativeExplanation" form={form} update={update} optional /><SingleChoice label="What do you believe is the single biggest barrier to choosing this product?" name="primaryBarrier" options={['Price', "Awareness — they don't know it exists", 'Access — hard to find or buy', 'Trust — unproven or unfamiliar', 'Habit — hard to switch from current choice', 'Not sure']} form={form} toggle={toggle} /><ChoiceGrid label="What do you believe would most help a customer choose your product?" name="barrierReducers" options={['Experiencing it firsthand — trying it, seeing or feeling the quality', 'Seeing other people use it', 'A trusted recommendation', 'Understanding it better', 'Better value', 'Easier availability', 'Being experienced in a credible, high-quality setting', 'Not sure']} form={form} toggle={toggle} max={2} /><TextArea label="Is there anything else IRL should understand about this decision?" name="decisionNotes" form={form} update={update} optional /></>;

  if (step === 'value-success') {
    const selectedMarketing = Array.isArray(form.marketingChannels) ? form.marketingChannels as string[] : [];
    const experiential = Array.isArray(form.experientialHistory) ? form.experientialHistory as string[] : [];
    const usedExperiential = experiential.some(value => value !== 'None of these');
    return <><div className="subsection-heading"><p className="eyebrow">Current marketing and opportunity</p><h2>How you reach this audience today</h2></div><ChoiceGrid label="Which channels do you currently use to reach this audience?" name="marketingChannels" options={marketingChannels} form={form} toggle={toggle} helper="Select all that apply." />{selectedMarketing.length > 0 && <ChoiceGrid label="Rank the three channels you use most" name="marketingChannelRank" options={selectedMarketing} form={form} toggle={toggle} max={3} ranked />}{selectedMarketing.length > 0 && <SingleChoice label="Which channel currently drives the most measurable customer acquisition or sales?" name="measuredAcquisitionChannel" options={[...selectedMarketing, "We don't currently know"]} form={form} toggle={toggle} />}<SingleChoice label="Do you currently run any paid marketing?" name="paidMarketing" options={['Yes, ongoing', 'Yes, occasionally', 'No, not yet', 'Not sure']} form={form} toggle={toggle} /><ChoiceGrid label="Have you used any of the following before?" name="experientialHistory" options={experientialTactics} form={form} toggle={toggle} />{usedExperiential && <><SingleChoice label="How effective was it?" name="experientialEffectiveness" options={['Very effective', 'Somewhat effective', 'Hard to measure', 'Not effective']} form={form} toggle={toggle} /><SingleChoice label="What's that based on?" name="experientialEvidence" options={['Direct sales or booking data', 'Customer feedback', 'General impression', 'Not sure']} form={form} toggle={toggle} /></>}<SingleChoice label="What's the main gap or opportunity IRL should address?" name="irlOpportunity" options={opportunities} form={form} toggle={toggle} /><div className="subsection-heading subsection-heading--second"><p className="eyebrow">Success</p><h2>What winning looks like</h2></div><Field label="What is the single most important result IRL should support?" name="primarySuccessResult" form={form} update={update} helper={selectedOne(form.irlOpportunity) ? `Starting point: ${selectedOne(form.irlOpportunity)}` : 'This should confirm or refine the gap selected above.'} /><ChoiceGrid label="Which signals would be most useful to see in reporting?" name="successSignals" options={successSignals} form={form} toggle={toggle} max={3} /></>;
  }

  if (step === 'operations') return <><ChoiceGrid label="Where or how could a guest realistically use or experience this product?" name="brandSuggestedPlacements" options={placementOptions} form={form} toggle={toggle} /><ChoiceGrid label="Does the product require anything special to use, store, or display?" name="handlingRequirements" options={handlingRequirements} form={form} toggle={toggle} /><SingleChoice label="Could you supply product for an initial IRL experience?" name="supplyCapability" options={['Yes', 'Probably', 'Need to discuss', 'No']} form={form} toggle={toggle} />{['Yes', 'Probably'].includes(selectedOne(form.supplyCapability)) && <Field label="Is there a practical limit to how much product you could supply initially?" name="initialSupplyLimit" form={form} update={update} optional />}</>;

  return <BrandReview form={form} update={update} />;
}

export function validateBrandStep(step: string, form: BrandForm): string[] {
  const missing: string[] = [];
  const requireText = (key: string, label: string) => { if (!String(typeof form[key] === 'string' ? form[key] : '').trim()) missing.push(label); };
  const requireChoice = (key: string, label: string) => { if (!selectedOne(form[key])) missing.push(label); };
  const requireMany = (key: string, label: string) => { if (!Array.isArray(form[key]) || !(form[key] as unknown[]).some(value => typeof value === 'string')) missing.push(label); };
  if (step === 'team') {
    requireChoice('onboardingRole', 'Partnership role');
    if (selectedOne(form.onboardingRole) === 'Neither') return ['The profile must be completed by the day-to-day contact, approver, or someone who is both.'];
    ['firstName:First name', 'lastName:Last name', 'email:Work email', 'jobTitle:Job title'].forEach(item => { const [key, label] = item.split(':'); requireText(key, label); });
    if (['Day-to-day contact', 'Approver'].includes(selectedOne(form.onboardingRole))) ['counterpartFirstName:Counterpart first name', 'counterpartLastName:Counterpart last name', 'counterpartEmail:Counterpart email', 'counterpartJobTitle:Counterpart job title'].forEach(item => { const [key, label] = item.split(':'); requireText(key, label); });
    if (nested(form, 'additionalContacts').some(contact => ['firstName', 'lastName', 'email', 'jobTitle'].some(key => !String(contact[key] || '').trim()))) missing.push('Each additional contact or remove the incomplete contact');
  }
  if (step === 'brand') {
    ['brandName:Brand name', 'brandWebsite:Brand website', 'brandCountry:Brand country', 'activeMarkets:Active markets', 'brandDescription:Brand description'].forEach(item => { const [key, label] = item.split(':'); requireText(key, label); });
    ['partOfGroup:Company or group status', 'brandPrimaryCategory:Primary category', 'brandDifferentiator:Brand differentiator', 'brandValues:Brand values'].forEach(item => { const [key, label] = item.split(':'); requireChoice(key, label); });
    if (selectedOne(form.partOfGroup) === 'Yes') requireText('parentCompany', 'Parent company');
    requireMany('salesChannels', 'Sales channels');
  }
  if (step === 'product') {
    ['productName:Product or range name', 'priceCurrency:Currency', 'priceMin:Minimum retail price'].forEach(item => { const [key, label] = item.split(':'); requireText(key, label); });
    ['productScope:Product scope', 'hasProductWebpage:Product webpage status', 'productCategory:Product category', 'productSubcategory:Product subcategory', 'sameProductAvailability:Product availability', 'internationalShipping:International shipping'].forEach(item => { const [key, label] = item.split(':'); requireChoice(key, label); });
    if (selectedOne(form.hasProductWebpage) === 'Yes') requireText('productWebpage', 'Product webpage');
    if (selectedOne(form.sameProductAvailability) === 'No') { requireText('productMarkets', 'Product-specific markets'); requireMany('productChannels', 'Product-specific channels'); }
    if (selectedOne(form.internationalShipping) === 'Yes, to specific regions') requireText('internationalShippingRegions', 'International shipping regions');
    if (selectedOne(form.brandPrimaryCategory) === 'Health & Wellness') requireText('legalSafetyCompliance', 'Legal, safety or compliance information');
    if (nested(form, 'additionalProducts').some(product => !String(product.name || '').trim() || !String(product.currency || '').trim() || !String(product.priceMin || '').trim() || !selectedOne(product.hasWebpage) || !selectedOne(product.category) || !selectedOne(product.subcategory) || !selectedOne(product.sameAvailability) || !selectedOne(product.internationalShipping) || (selectedOne(product.hasWebpage) === 'Yes' && !String(product.webpage || '').trim()) || (selectedOne(product.sameAvailability) === 'No' && (!String(product.markets || '').trim() || !Array.isArray(product.channels) || !product.channels.length)) || (selectedOne(product.internationalShipping) === 'Yes, to specific regions' && !String(product.shippingRegions || '').trim()) || (selectedOne(product.category) === 'Health & Wellness' && !String(product.legalSafetyCompliance || '').trim()))) missing.push('Each additional product or remove the incomplete product');
  }
  if (step === 'audience') {
    requireText('audienceDescription', 'Priority audience'); ['audienceEvidence:Audience evidence', 'audienceGeography:Audience geography', 'discoveryOpenness:Openness to unfamiliar brands'].forEach(item => { const [key, label] = item.split(':'); requireChoice(key, label); }); if (!Array.isArray(form.decisionFactors) || form.decisionFactors.length !== 3) missing.push('Exactly three ranked decision priorities');
    if (selectedOne(form.secondaryAudienceEnabled) === 'Yes') { requireText('secondaryAudienceDescription', 'Secondary audience description'); ['secondaryAudienceEvidence:Secondary audience evidence', 'secondaryAudienceGeography:Secondary audience geography', 'secondaryDiscoveryOpenness:Secondary audience openness'].forEach(item => { const [key, label] = item.split(':'); requireChoice(key, label); }); if (!Array.isArray(form.secondaryDecisionFactors) || form.secondaryDecisionFactors.length !== 3) missing.push('Exactly three secondary audience priorities'); }
  }
  if (step === 'need') { ['customerOutcome:Customer outcome', 'currentAlternative:Current alternative', 'primaryBarrier:Primary barrier'].forEach(item => { const [key, label] = item.split(':'); requireChoice(key, label); }); requireMany('needContext', 'Need context'); requireMany('barrierReducers', 'Barrier reducers'); }
  if (step === 'value-success') {
    ['measuredAcquisitionChannel:Measured acquisition channel', 'paidMarketing:Paid marketing', 'irlOpportunity:Main gap or opportunity'].forEach(item => { const [key, label] = item.split(':'); requireChoice(key, label); }); requireMany('marketingChannels', 'Marketing channels'); const marketingCount = Array.isArray(form.marketingChannels) ? form.marketingChannels.length : 0; if (!Array.isArray(form.marketingChannelRank) || form.marketingChannelRank.length !== Math.min(3, marketingCount)) missing.push('Up to three marketing channels ranked in order'); requireMany('experientialHistory', 'Experiential marketing history'); const experiential = Array.isArray(form.experientialHistory) ? form.experientialHistory as string[] : []; if (experiential.some(value => value !== 'None of these')) { requireChoice('experientialEffectiveness', 'Experiential effectiveness'); requireChoice('experientialEvidence', 'Experiential evidence'); } requireText('primarySuccessResult', 'Most important result'); requireMany('successSignals', 'Reporting signals');
  }
  if (step === 'operations') { requireMany('brandSuggestedPlacements', 'Suggested placements'); requireMany('handlingRequirements', 'Handling requirements'); requireChoice('supplyCapability', 'Supply capability'); }
  if (step === 'review' && form.profileConfirmed !== 'yes') missing.push('Profile accuracy confirmation');
  return missing;
}

function BrandReview({ form, update }: { form: BrandForm; update: Props['update'] }) {
  const entries = Object.entries(form).filter(([key, value]) => !key.endsWith('Enabled') && (Array.isArray(value) ? value.length : Boolean(value)));
  const display = (value: BrandFormValue): string => Array.isArray(value) ? value.map(item => typeof item === 'string' ? item : Object.entries(item).map(([key, answer]) => `${key.replace(/([A-Z])/g, ' $1')}: ${Array.isArray(answer) ? answer.join(', ') : answer}`).join(' · ')).join('\n') : value;
  return <div className="review-list"><div className="review-intro"><h3>Review your Brand Profile</h3><p>Check your answers before sending them to IRL. You can return to any section from the navigation to make changes.</p></div>{entries.length === 0 ? <p>No answers have been added yet.</p> : entries.map(([key, value]) => <div key={key}><span>{key.replace(/([A-Z])/g, ' $1')}</span><strong>{display(value)}</strong></div>)}<TextArea label="Is there anything else IRL should know?" name="finalNotes" form={form} update={update} optional /><label className="confirm"><input type="checkbox" checked={form.profileConfirmed === 'yes'} onChange={(event) => update('profileConfirmed', event.target.checked ? 'yes' : '')} /> I confirm that this Brand Profile is accurate to the best of my knowledge.</label><p className="privacy-note">IRL uses this information to build and maintain your Brand Profile, identify suitable property matches and support future partnership conversations. Contact IRL if information needs to be corrected.</p></div>;
}
