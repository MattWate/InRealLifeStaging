import { Check, FileUp, Plus } from 'lucide-react';

export type BrandForm = Record<string, string | string[]>;

type Props = {
  step: string;
  form: BrandForm;
  update: (key: string, value: string | string[]) => void;
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

const qualities = ['Performance', 'Quality', 'Design', 'Convenience', 'Innovation', 'Wellness', 'Sustainability', 'Local provenance', 'Craft', 'Accessibility', 'Heritage', 'Community', 'Status or identity', 'Other'];
const salesChannels = ['Brand website', 'Brand-owned stores', 'Major retail', 'Independent retail', 'Online marketplaces', 'Hospitality', 'Professional or trade channels', 'Subscription', 'Other'];
const audienceGeography = ['Primarily South African', 'Primarily international', 'Both local and international', 'Specific countries or regions', 'Geography is not a priority'];
const ageGroups = ['Under 18', '18-24', '25-34', '35-44', '45-54', '55-64', '65+', 'Age is not a priority'];
const lifeStages = ['Student', 'Early-career professional', 'Established professional', 'Entrepreneur or business owner', 'Parent or caregiver', 'Retired', 'Other', 'Life stage is not a priority'];
const decisionFactors = ['Price', 'Quality', 'Performance', 'Design', 'Ingredients or materials', 'Convenience', 'Trust', 'Reviews or recommendations', 'Sustainability', 'Local provenance', 'Status or identity', 'Availability', 'Other'];
const needContexts = ['Daily routine', 'Sleep and recovery', 'Bath and self-care', 'Food and drink', 'Work and focus', 'Travel', 'Socialising or hosting', 'Health and wellness', 'Home and living', 'Special occasions', 'Other'];
const alternatives = ['A competing brand', 'A different type of product', 'A simpler or cheaper alternative', 'A familiar habit or routine', 'Nothing - they live with the need', 'Not sure', 'Other'];
const barriers = ['They are not aware of it', 'They do not understand the difference', 'They are unsure it will work', 'They need to try it first', 'The price or value is unclear', 'It is difficult to find or purchase', 'They already have a familiar alternative', 'It feels unnecessary', 'It feels complicated or inconvenient', 'Other', 'Not sure'];
const barrierReducers = ['Seeing the product in use', 'Trying it once', 'Using it repeatedly', 'Understanding the benefits', 'Comparing the quality', 'A trusted recommendation', 'Reviews or customer proof', 'A relevant offer', 'Making it easier to purchase', 'Other', 'Not sure'];
const marketingChannels = ['Paid social', 'Organic social and content', 'Creators or influencers', 'Search', 'Email or CRM', 'Retail or point of sale', 'PR or editorial', 'Events or activations', 'Partnerships or sponsorships', 'Sampling or product seeding', 'Out-of-home', 'Other', 'Not sure'];
const opportunities = ['More people need to discover the brand', 'People need to try the product', 'People need to understand why it is different', 'Repeated exposure is needed to build familiarity', 'People need more confidence or trust', 'We want deeper customer insight', 'We want to encourage purchase or another action', 'We want to support a launch or retail moment', 'Other'];
const usageModels = ['It remains at the property and is reused', 'It is consumed or used during the stay', 'Guests receive a sample', 'Guests may take the full product home', 'It is a service or digital experience', 'Not sure yet'];
const handlingRequirements = ['No special requirements', 'Secure or specific storage', 'Refrigeration or temperature control', 'Installation, electricity or equipment', 'Staff setup or explanation', 'Cleaning or maintenance', 'Safety, age or compliance requirements', 'Other', 'Not sure'];
const supplyCapability = ['Yes', 'Possibly - we need to discuss the scale', 'No', 'Not sure yet'];
const successSignals = ['Guests reached', 'Guest nights or exposure', 'Product use', 'Repeat use', 'Guest feedback', 'QR or page engagement', 'Redemptions or purchases', 'Content generated', 'Operational fulfilment', 'Other'];

function Field({ label, name, form, update, type = 'text', placeholder = '', optional = false, helper, maxLength }: FieldProps) {
  return <label className="field"><span>{label} {optional && <em>Optional</em>}</span>{helper && <small>{helper}</small>}<input type={type} value={(form[name] as string) || ''} placeholder={placeholder} maxLength={maxLength} onChange={(event) => update(name, event.target.value)} /></label>;
}

function TextArea({ label, name, form, update, optional = false, helper, maxLength }: Omit<FieldProps, 'type' | 'placeholder'>) {
  return <label className="field"><span>{label} {optional && <em>Optional</em>}</span>{helper && <small>{helper}</small>}<textarea value={(form[name] as string) || ''} maxLength={maxLength} onChange={(event) => update(name, event.target.value)} /></label>;
}

function ChoiceGrid({ label, name, options, form, toggle, max, optional = false, helper }: { label: string; name: string; options: string[]; form: BrandForm; toggle: Props['toggle']; max?: number; optional?: boolean; helper?: string }) {
  const selected = Array.isArray(form[name]) ? form[name] as string[] : [];
  return <fieldset className="field"><legend>{label} {optional && <em>Optional</em>}{helper && <small>{helper}</small>}{max && <small>{selected.length} of {max} selected</small>}</legend><div className="choice-grid">{options.map((option) => <button type="button" key={option} className={selected.includes(option) ? 'selected' : ''} onClick={() => toggle(name, option, max)}>{selected.includes(option) && <Check size={15} />}{option}</button>)}</div></fieldset>;
}

function UploadPlaceholder({ label, helper }: { label: string; helper: string }) {
  return <div className="upload-placeholder brand-upload"><FileUp size={20} /><div><strong>{label} <em>Optional</em></strong><p>{helper}</p><small>File persistence will be connected when document storage is added.</small></div></div>;
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="text-action add-row" onClick={onClick}><Plus size={16} /> {label}</button>;
}

function SingleChoice(props: Omit<Parameters<typeof ChoiceGrid>[0], 'max'>) {
  return <ChoiceGrid {...props} max={1} />;
}

export default function BrandOnboardingStep({ step, form, update, toggle }: Props) {
  if (step === 'team') return <>
    <div className="field-row"><Field label="First name" name="firstName" form={form} update={update} /><Field label="Last name" name="lastName" form={form} update={update} /></div>
    <Field label="Work email" name="email" type="email" form={form} update={update} />
    <Field label="Mobile number" name="mobile" type="tel" form={form} update={update} optional />
    <Field label="Job title" name="jobTitle" form={form} update={update} />
    <SingleChoice label="What is your role in this onboarding?" name="onboardingRole" options={['Primary IRL contact', 'Brand or marketing lead', 'Founder or business owner', 'Decision-maker', 'Campaign or project lead', 'Operations or logistics', 'Procurement or finance', 'Agency partner', 'Other']} form={form} toggle={toggle} />
    {form.additionalContactEnabled === 'yes' ? <div className="progressive-card"><h3>Additional contact</h3><div className="field-row"><Field label="Name" name="contact2Name" form={form} update={update} /><Field label="Work email" name="contact2Email" type="email" form={form} update={update} /></div><Field label="Role" name="contact2Role" form={form} update={update} /><SingleChoice label="Should they receive IRL updates?" name="contact2Updates" options={['Yes', 'No']} form={form} toggle={toggle} /></div> : <AddButton label="Add another contact" onClick={() => update('additionalContactEnabled', 'yes')} />}
  </>;

  if (step === 'brand') return <>
    <Field label="Brand name" name="brandName" form={form} update={update} />
    <Field label="Brand website" name="brandWebsite" type="url" form={form} update={update} />
    <SingleChoice label="Is the brand part of a larger company or group?" name="partOfGroup" options={['No', 'Yes']} form={form} toggle={toggle} />
    {(form.partOfGroup as string[] | undefined)?.includes('Yes') && <Field label="Parent company or group name" name="parentCompany" form={form} update={update} />}
    <div className="field-row"><Field label="Country" name="brandCountry" form={form} update={update} helper="Where is the brand based?" /><Field label="City" name="brandCity" form={form} update={update} optional /></div>
    <Field label="Which markets is the brand currently active in?" name="activeMarkets" form={form} update={update} helper="Enter countries or regions. This will become a searchable controlled multi-select when the market taxonomy is connected." />
    <Field label="What is the brand’s primary category?" name="brandPrimaryCategory" form={form} update={update} helper="Controlled category taxonomy to be connected." />
    <Field label="Does the brand also operate in another category?" name="brandSecondaryCategories" form={form} update={update} optional helper="Up to two secondary categories." />
    <TextArea label="How would you describe the brand in one sentence?" name="brandDescription" form={form} update={update} helper="Use the description you would give someone encountering the brand for the first time. Maximum 200 characters." maxLength={200} />
    <ChoiceGrid label="Which qualities are most central to the brand?" name="qualities" options={qualities} form={form} toggle={toggle} max={5} helper="Choose only the qualities that genuinely shape the brand." />
    <ChoiceGrid label="Where can customers currently buy the brand?" name="salesChannels" options={salesChannels} form={form} toggle={toggle} />
  </>;

  if (step === 'product') return <>
    <SingleChoice label="What would you like IRL to consider?" name="productScope" options={['One specific product', 'A product range', 'Several products', 'We would like IRL to help us decide']} form={form} toggle={toggle} />
    <Field label="Product or range name" name="productName" form={form} update={update} />
    <Field label="Product webpage" name="productWebpage" type="url" form={form} update={update} optional />
    <Field label="Pick the product category" name="productCategory" form={form} update={update} helper="Controlled product category taxonomy to be connected." />
    <Field label="Product subcategory" name="productSubcategory" form={form} update={update} helper="Controlled subcategory based on the selected category." />
    <div className="field-row"><Field label="Currency" name="priceCurrency" form={form} update={update} /><Field label="Minimum retail price" name="priceMin" type="number" form={form} update={update} /></div>
    <Field label="Maximum retail price" name="priceMax" type="number" form={form} update={update} optional helper="Leave blank for a single-price product." />
    <Field label="Which variants should IRL consider?" name="variants" form={form} update={update} optional helper="Size, flavour, colour, formulation, model or another relevant variant." />
    <SingleChoice label="Is this product available through the same markets and channels listed for the brand?" name="sameProductAvailability" options={['Yes', 'No']} form={form} toggle={toggle} />
    {(form.sameProductAvailability as string[] | undefined)?.includes('No') && <div className="progressive-card"><Field label="Product-specific markets" name="productMarkets" form={form} update={update} /><ChoiceGrid label="Product-specific channels" name="productChannels" options={salesChannels} form={form} toggle={toggle} /></div>}
    {form.additionalProductEnabled === 'yes' ? <div className="progressive-card"><h3>Additional product or range</h3><Field label="Product or range name" name="product2Name" form={form} update={update} /><Field label="Product category" name="product2Category" form={form} update={update} /><Field label="Typical retail price or range" name="product2Price" form={form} update={update} /></div> : <AddButton label="Add another product or range" onClick={() => update('additionalProductEnabled', 'yes')} />}
  </>;

  if (step === 'audience') return <>
    <TextArea label="Describe the priority audience you would most like IRL to reach" name="audienceDescription" form={form} update={update} maxLength={200} helper="Maximum 200 characters." />
    <SingleChoice label="Where is this audience based?" name="audienceGeography" options={audienceGeography} form={form} toggle={toggle} />
    <details><summary>Add optional audience detail</summary>
      <ChoiceGrid label="Which age groups are most relevant?" name="ageGroups" options={ageGroups} form={form} toggle={toggle} max={3} optional />
      <ChoiceGrid label="Which life stages are most relevant?" name="lifeStages" options={lifeStages} form={form} toggle={toggle} max={3} optional />
    </details>
    <ChoiceGrid label="What matters most when they choose this type of product?" name="decisionFactors" options={decisionFactors} form={form} toggle={toggle} max={3} />
    <SingleChoice label="How open are they to trying an unfamiliar brand or product?" name="discoveryOpenness" options={['1 — Very unlikely', '2', '3 — Neutral', '4', '5 — Very open', 'Not sure']} form={form} toggle={toggle} />
    <Field label="Is there anyone this product is not intended for?" name="audienceExclusions" form={form} update={update} optional />
    <ChoiceGrid label="How is this audience understanding informed?" name="audienceEvidence" options={['Customer or sales data', 'Customer research', 'Campaign or website analytics', 'Retail or partner feedback', 'Team experience', 'Working assumption']} form={form} toggle={toggle} optional />
    <UploadPlaceholder label="Upload existing audience material" helper="Persona, research, survey or audience deck." />
    <TextArea label="Is there anything else IRL should understand about this audience?" name="audienceNotes" form={form} update={update} optional />
    {form.secondaryAudienceEnabled === 'yes' ? <div className="progressive-card"><h3>Secondary audience</h3><TextArea label="Describe the secondary audience" name="secondaryAudienceDescription" form={form} update={update} maxLength={200} /><SingleChoice label="Where is this audience based?" name="secondaryAudienceGeography" options={audienceGeography} form={form} toggle={toggle} /></div> : <AddButton label="Add a secondary audience" onClick={() => update('secondaryAudienceEnabled', 'yes')} />}
  </>;

  if (step === 'need') return <>
    <TextArea label="What need or outcome is the customer looking for?" name="customerNeed" form={form} update={update} maxLength={250} helper="Maximum 250 characters." />
    <ChoiceGrid label="When is this need most relevant?" name="needContext" options={needContexts} form={form} toggle={toggle} max={3} />
    <SingleChoice label="What are customers currently using or doing instead?" name="currentAlternative" options={alternatives} form={form} toggle={toggle} />
    <Field label="Optional explanation" name="alternativeExplanation" form={form} update={update} optional />
    <SingleChoice label="What is the single biggest barrier to choosing this product?" name="primaryBarrier" options={barriers} form={form} toggle={toggle} />
    <ChoiceGrid label="What would most help reduce that barrier?" name="barrierReducers" options={barrierReducers} form={form} toggle={toggle} max={2} />
    <TextArea label="Is there anything else IRL should understand about this decision?" name="decisionNotes" form={form} update={update} optional />
  </>;

  if (step === 'value') return <>
    <ChoiceGrid label="Which channels currently play the biggest role in reaching this audience?" name="marketingChannels" options={marketingChannels} form={form} toggle={toggle} max={4} optional />
    <SingleChoice label="What is the main gap or opportunity you would like IRL to help address?" name="irlOpportunity" options={opportunities} form={form} toggle={toggle} />
  </>;

  if (step === 'operations') return <>
    <SingleChoice label="How would guests use the product?" name="guestUsageModel" options={usageModels} form={form} toggle={toggle} />
    <ChoiceGrid label="Does the product require any special setup or handling?" name="handlingRequirements" options={handlingRequirements} form={form} toggle={toggle} />
    <SingleChoice label="Could your team supply and replenish the product for an initial pilot?" name="supplyCapability" options={supplyCapability} form={form} toggle={toggle} />
  </>;

  if (step === 'success') return <>
    <Field label="What is the single most important result IRL should support?" name="primarySuccessResult" form={form} update={update} helper="This should align with the main gap or opportunity selected earlier." />
    <ChoiceGrid label="Which signals would be most useful to see in reporting?" name="successSignals" options={successSignals} form={form} toggle={toggle} max={3} />
  </>;

  if (step === 'requirements') return <>
    <TextArea label="Are there any mandatory brand, safety or compliance requirements?" name="complianceRequirements" form={form} update={update} optional />
    <TextArea label="Are there any claims, words or messages IRL must use or avoid?" name="messagingRequirements" form={form} update={update} optional />
    <TextArea label="Are there any environments, categories or associations the brand should avoid?" name="associationRestrictions" form={form} update={update} optional />
    <UploadPlaceholder label="Upload brand guidelines or relevant compliance material" helper="Brand guidelines, compliance documentation or other relevant material." />
  </>;

  return <BrandReview form={form} update={update} />;
}

function BrandReview({ form, update }: { form: BrandForm; update: Props['update'] }) {
  const entries = Object.entries(form).filter(([key, value]) => !key.endsWith('Enabled') && (Array.isArray(value) ? value.length : Boolean(value)));
  const confirmed = form.profileConfirmed === 'yes';
  return <div className="review-list">
    <div className="review-intro"><h3>Review your Brand Profile</h3><p>Check your answers before sending them to IRL. You can return to any section from the navigation to make changes.</p></div>
    {entries.length === 0 ? <p>No answers have been added yet.</p> : entries.map(([key, value]) => <div key={key}><span>{key.replace(/([A-Z])/g, ' $1')}</span><strong>{Array.isArray(value) ? value.join(', ') : value}</strong></div>)}
    <TextArea label="Is there anything else IRL should know before we begin matching?" name="finalNotes" form={form} update={update} optional />
    <label className="confirm"><input type="checkbox" checked={confirmed} onChange={(event) => update('profileConfirmed', event.target.checked ? 'yes' : '')} /> I confirm that this Brand Profile is accurate to the best of my knowledge.</label>
    <p className="privacy-note">IRL uses this information to build and maintain your Brand Profile, identify suitable property matches and support future partnership conversations. Contact IRL if information needs to be corrected.</p>
  </div>;
}
