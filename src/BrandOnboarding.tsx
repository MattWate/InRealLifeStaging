import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { Check, FileUp, Plus, Trash2 } from 'lucide-react';
import { currencyOptions, marketOptions, type SelectOption } from './onboarding-options';
import { fieldLabels } from './admin/questionnaire';

export type NestedAnswer = Record<string, string | string[]>;
export type BrandFormValue = string | string[] | NestedAnswer[];
export type BrandForm = Record<string, BrandFormValue>;

type Props = {
  step: string;
  form: BrandForm;
  update: (key: string, value: BrandFormValue) => void;
  toggle: (key: string, value: string, max?: number) => void;
  errors?: Record<string, string>;
  goToStep?: (step: string) => void;
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
  min?: number;
  step?: string;
};

const ValidationContext = createContext<Record<string, string>>({});
const UpdateContext = createContext<Props['update']>(() => undefined);

function FieldError({ name }: { name: string }) {
  const error = useContext(ValidationContext)[name];
  return error ? <span className="field-error" id={`${name}-error`} role="alert">{error}</span> : null;
}

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

function Field({ label, name, form, update, type = 'text', placeholder = '', optional = false, helper, maxLength, min, step }: FieldProps) {
  const error = useContext(ValidationContext)[name];
  return <label className="field"><span>{label} {optional && <em>Optional</em>}</span><input type={type} value={typeof form[name] === 'string' ? form[name] as string : ''} placeholder={placeholder || helper || ''} maxLength={maxLength} min={min} step={step} inputMode={type === 'number' ? 'decimal' : undefined} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} onChange={(event) => update(name, event.target.value)} /><FieldError name={name} /></label>;
}

function TextArea({ label, name, form, update, optional = false, helper, maxLength }: Omit<FieldProps, 'type' | 'placeholder'>) {
  const error = useContext(ValidationContext)[name];
  return <label className="field"><span>{label} {optional && <em>Optional</em>}</span><textarea value={typeof form[name] === 'string' ? form[name] as string : ''} placeholder={helper || ''} maxLength={maxLength} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} onChange={(event) => update(name, event.target.value)} /><FieldError name={name} /></label>;
}

function ChoiceGrid({ label, name, options, form, toggle, max, optional = false, helper, ranked = false, appearance }: { label: string; name: string; options: string[]; form: BrandForm; toggle: Props['toggle']; max?: number; optional?: boolean; helper?: string; ranked?: boolean; appearance?: 'scale' }) {
  const selected = Array.isArray(form[name]) && (form[name] as unknown[]).every(item => typeof item === 'string') ? form[name] as string[] : [];
  const error = useContext(ValidationContext)[name];
  const update = useContext(UpdateContext);
  const hasOther = options.includes('Other') && selected.includes('Other');
  const otherName = `${name}Other`;
  const otherError = useContext(ValidationContext)[otherName];
  const kind = max === 1 ? 'single' : 'multi';
  const instruction = helper || (max && max > 1 ? `Choose up to ${max}${ranked ? ' in priority order' : ''}.` : '');
  return <fieldset className={`field choice-field choice-field--${kind}${ranked ? ' choice-field--ranked' : ''}${appearance ? ` choice-field--${appearance}` : ''}`} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined}><legend>{label} {optional && <em>Optional</em>}</legend>{instruction && <small className="field-helper">{instruction}</small>}<div className="choice-grid">{options.map((option) => {
    const rank = selected.indexOf(option);
    const numbered = rank >= 0 && Boolean(max && max > 1);
    return <button type="button" key={option} aria-pressed={rank >= 0} className={rank >= 0 ? 'selected' : ''} onClick={() => toggle(name, option, max)}>{rank >= 0 && <span className={`choice-indicator${numbered ? ' choice-indicator--numbered' : ''}`}>{numbered ? rank + 1 : max === 1 ? <span className="radio-dot" /> : <Check size={15} />}</span>}{option}</button>;
  })}</div>{hasOther && <label className="other-field"><span>Please specify</span><input value={typeof form[otherName] === 'string' ? form[otherName] as string : ''} placeholder="Tell us what you mean by Other" aria-invalid={Boolean(otherError)} aria-describedby={otherError ? `${otherName}-error` : undefined} onChange={event => update(otherName, event.target.value)} /><FieldError name={otherName} /></label>}<FieldError name={name} /></fieldset>;
}

function SingleChoice(props: Omit<Parameters<typeof ChoiceGrid>[0], 'max' | 'ranked'>) { return <ChoiceGrid {...props} max={1} />; }

function SearchableMultiSelect({ label, name, options, form, update }: { label: string; name: string; options: SelectOption[]; form: BrandForm; update: Props['update'] }) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const error = useContext(ValidationContext)[name];
  const selected = Array.isArray(form[name]) ? form[name] as string[] : typeof form[name] === 'string' ? (form[name] as string).split(',').map(value => value.trim()).filter(Boolean) : [];
  const match = options.find(option => option.value.toLowerCase() === query.trim().toLowerCase() || option.label.toLowerCase() === query.trim().toLowerCase());
  const add = () => {
    if (!match || selected.includes(match.value)) return;
    update(name, [...selected, match.value]);
    setQuery('');
  };
  return <fieldset className="field searchable-field" aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined}><legend>{label}</legend><div className="searchable-entry"><input list={listId} value={query} placeholder="Search for a country or region" onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} /><datalist id={listId}>{options.map(option => <option key={option.label} value={option.value}>{option.label}</option>)}</datalist><button type="button" disabled={!match || selected.includes(match.value)} onClick={add}>Add</button></div>{selected.length > 0 && <div className="selected-values" aria-label="Selected markets">{selected.map(value => <button type="button" key={value} onClick={() => update(name, selected.filter(item => item !== value))}><span>{value}</span><span aria-hidden="true">×</span><span className="sr-only">Remove {value}</span></button>)}</div>}<FieldError name={name} /></fieldset>;
}

function SearchableSelect({ label, name, options, form, update, optional = false }: { label: string; name: string; options: SelectOption[]; form: BrandForm; update: Props['update']; optional?: boolean }) {
  const listId = useId();
  const error = useContext(ValidationContext)[name];
  return <label className="field"><span>{label} {optional && <em>Optional</em>}</span><input list={listId} value={typeof form[name] === 'string' ? form[name] as string : ''} placeholder="Search by code or currency name" maxLength={3} pattern="[A-Z]{3}" aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} onChange={event => update(name, event.target.value.toUpperCase().split(' — ')[0])} /><datalist id={listId}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</datalist><FieldError name={name} /></label>;
}

function UploadPlaceholder({ label, helper }: { label: string; helper: string }) {
  return <div className="upload-placeholder brand-upload"><FileUp size={20} /><div><strong>{label} <em>Optional</em></strong><p>{helper}</p><small>Document storage is not connected yet. You can submit the profile without an upload.</small></div></div>;
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) { return <button type="button" className="text-action add-row" onClick={onClick}><Plus size={16} /> {label}</button>; }

function JourneyHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <div className="subsection-heading journey-heading"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{description && <p>{description}</p>}</div>;
}

function CarryForward({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return <div className="carry-forward"><span>{label}</span><strong>{value}</strong></div>;
}

function NestedField({ label, value, onChange, type = 'text', optional = false, placeholder = '', step, min }: { label: string; value: string; onChange: (value: string) => void; type?: string; optional?: boolean; placeholder?: string; step?: string; min?: number }) {
  return <label className="field"><span>{label} {optional && <em>Optional</em>}</span><input type={type} value={value} placeholder={placeholder} step={step} min={min} inputMode={type === 'number' ? 'decimal' : undefined} onChange={event => onChange(event.target.value)} /></label>;
}

function NestedCurrencySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const listId = useId();
  return <label className="field"><span>Currency</span><input list={listId} value={value} placeholder="Search by code or currency name" maxLength={3} pattern="[A-Z]{3}" onChange={event => onChange(event.target.value.toUpperCase().split(' — ')[0])} /><datalist id={listId}>{currencyOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</datalist></label>;
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

function NestedSingleChoice({ label, value, options, onChange, otherValue = '', onOtherChange }: { label: string; value: string | string[] | undefined; options: string[]; onChange: (value: string[]) => void; otherValue?: string; onOtherChange?: (value: string) => void }) {
  const selected = Array.isArray(value) ? value : [];
  return <fieldset className="field choice-field choice-field--single"><legend>{label}</legend><div className="choice-grid">{options.map(option => <button type="button" key={option} aria-pressed={selected.includes(option)} className={selected.includes(option) ? 'selected' : ''} onClick={() => { const next = selected.includes(option) ? [] : [option]; onChange(next); if (selected.includes('Other') && !next.includes('Other')) onOtherChange?.(''); }}>{selected.includes(option) && <span className="choice-indicator"><span className="radio-dot" /></span>}{option}</button>)}</div>{selected.includes('Other') && onOtherChange && <label className="other-field"><span>Please specify</span><input value={otherValue} placeholder="Tell us what you mean by Other" onChange={event => onOtherChange(event.target.value)} /></label>}</fieldset>;
}

function NestedChoiceGrid({ label, value, options, onChange, otherValue = '', onOtherChange }: { label: string; value: string | string[] | undefined; options: string[]; onChange: (value: string[]) => void; otherValue?: string; onOtherChange?: (value: string) => void }) {
  const selected = Array.isArray(value) ? value : [];
  return <fieldset className="field choice-field choice-field--multi"><legend>{label}</legend><small className="field-helper">Select all that apply</small><div className="choice-grid">{options.map(option => <button type="button" key={option} aria-pressed={selected.includes(option)} className={selected.includes(option) ? 'selected' : ''} onClick={() => { const next = selected.includes(option) ? selected.filter(item => item !== option) : [...selected, option]; onChange(next); if (selected.includes('Other') && !next.includes('Other')) onOtherChange?.(''); }}>{selected.includes(option) && <span className="choice-indicator"><Check size={15} /></span>}{option}</button>)}</div>{selected.includes('Other') && onOtherChange && <label className="other-field"><span>Please specify</span><input value={otherValue} placeholder="Tell us what you mean by Other" onChange={event => onOtherChange(event.target.value)} /></label>}</fieldset>;
}

function AdditionalContacts({ form, update }: Pick<Props, 'form' | 'update'>) {
  const rows = nested(form, 'additionalContacts');
  return <>{rows.map((contact, index) => <div className="progressive-card" key={`contact-${index}`}><div className="progressive-heading"><h3>Additional contact {index + 1}</h3><button type="button" className="icon-action" aria-label={`Remove additional contact ${index + 1}`} onClick={() => removeNested(form, 'additionalContacts', index, update)}><Trash2 size={17} /></button></div><div className="field-row"><NestedField label="First name" value={String(contact.firstName || '')} onChange={value => updateNested(form, 'additionalContacts', index, 'firstName', value, update)} /><NestedField label="Last name" value={String(contact.lastName || '')} onChange={value => updateNested(form, 'additionalContacts', index, 'lastName', value, update)} /></div><NestedField label="Work email" type="email" value={String(contact.email || '')} onChange={value => updateNested(form, 'additionalContacts', index, 'email', value, update)} /><NestedField label="Job title or role" value={String(contact.jobTitle || '')} onChange={value => updateNested(form, 'additionalContacts', index, 'jobTitle', value, update)} /></div>)}<FieldError name="additionalContacts" />{rows.length < 4 && <AddButton label="Add another contact" onClick={() => addNested(form, 'additionalContacts', update)} />}</>;
}

function AdditionalProducts({ form, update, categories }: Pick<Props, 'form' | 'update'> & { categories: string[] }) {
  const rows = nested(form, 'additionalProducts');
  return <>{rows.map((product, index) => {
    const category = Array.isArray(product.category) ? String(product.category[0] || '') : '';
    const hasWebpage = Array.isArray(product.hasWebpage) ? String(product.hasWebpage[0] || '') : '';
    const sameAvailability = Array.isArray(product.sameAvailability) ? String(product.sameAvailability[0] || '') : '';
    const shipping = Array.isArray(product.internationalShipping) ? String(product.internationalShipping[0] || '') : '';
    return <div className="progressive-card" key={`product-${index}`}>
      <div className="progressive-heading"><h3>Additional product or range {index + 1}</h3><button type="button" className="icon-action" aria-label={`Remove additional product ${index + 1}`} onClick={() => removeNested(form, 'additionalProducts', index, update)}><Trash2 size={17} /></button></div>
      <NestedField label="Product or range name" value={String(product.name || '')} onChange={value => updateNested(form, 'additionalProducts', index, 'name', value, update)} />
      <NestedSingleChoice label="Does it have a product webpage?" value={product.hasWebpage} options={['Yes', 'No']} onChange={value => updateNested(form, 'additionalProducts', index, 'hasWebpage', value, update)} />
      {hasWebpage === 'Yes' && <NestedField label="Product webpage" type="url" value={String(product.webpage || '')} onChange={value => updateNested(form, 'additionalProducts', index, 'webpage', value, update)} />}
      <NestedSingleChoice label="Product category" value={product.category} options={categories} otherValue={String(product.categoryOther || '')} onOtherChange={value => updateNested(form, 'additionalProducts', index, 'categoryOther', value, update)} onChange={value => updateNested(form, 'additionalProducts', index, 'category', value, update)} />
      {category && <NestedSingleChoice label="Product subcategory" value={product.subcategory} options={subcategories[category] || ['Other']} otherValue={String(product.subcategoryOther || '')} onOtherChange={value => updateNested(form, 'additionalProducts', index, 'subcategoryOther', value, update)} onChange={value => updateNested(form, 'additionalProducts', index, 'subcategory', value, update)} />}
      <div className="field-row"><NestedCurrencySelect value={String(product.currency || '')} onChange={value => updateNested(form, 'additionalProducts', index, 'currency', value, update)} /><NestedField label="Minimum retail price" type="number" min={0} step="0.01" value={String(product.priceMin || '')} onChange={value => updateNested(form, 'additionalProducts', index, 'priceMin', value, update)} /></div>
      <NestedField label="Maximum retail price" type="number" min={0} step="0.01" optional value={String(product.priceMax || '')} onChange={value => updateNested(form, 'additionalProducts', index, 'priceMax', value, update)} />
      <NestedField label="Are there any variants you want IRL to focus on?" optional value={String(product.variants || '')} onChange={value => updateNested(form, 'additionalProducts', index, 'variants', value, update)} />
      <NestedSingleChoice label="Same markets and channels as the brand?" value={product.sameAvailability} options={['Yes', 'No']} onChange={value => updateNested(form, 'additionalProducts', index, 'sameAvailability', value, update)} />
      {sameAvailability === 'No' && <><NestedField label="Product-specific markets" value={String(product.markets || '')} onChange={value => updateNested(form, 'additionalProducts', index, 'markets', value, update)} /><NestedChoiceGrid label="Product-specific channels" value={product.channels} options={salesChannels} otherValue={String(product.channelsOther || '')} onOtherChange={value => updateNested(form, 'additionalProducts', index, 'channelsOther', value, update)} onChange={value => updateNested(form, 'additionalProducts', index, 'channels', value, update)} /></>}
      <NestedSingleChoice label="Do you ship this product internationally?" value={product.internationalShipping} options={['Yes', 'Yes, to specific regions', 'No']} onChange={value => updateNested(form, 'additionalProducts', index, 'internationalShipping', value, update)} />
      {shipping === 'Yes, to specific regions' && <NestedField label="International shipping regions" value={String(product.shippingRegions || '')} onChange={value => updateNested(form, 'additionalProducts', index, 'shippingRegions', value, update)} />}
      <NestedField label="Legal, safety or compliance information" optional value={String(product.legalSafetyCompliance || '')} onChange={value => updateNested(form, 'additionalProducts', index, 'legalSafetyCompliance', value, update)} />
    </div>;
  })}<FieldError name="additionalProducts" />{rows.length < 3 && <AddButton label="Add another product or range" onClick={() => addNested(form, 'additionalProducts', update)} />}</>;
}

function CounterpartContact({ role, form, update }: { role: 'Approver' | 'Day-to-day contact'; form: BrandForm; update: Props['update'] }) {
  return <div className="progressive-card"><h3>{role}</h3><p className="progressive-intro">Please add the person IRL should work with in this role.</p><div className="field-row"><Field label="First name" name="counterpartFirstName" form={form} update={update} /><Field label="Last name" name="counterpartLastName" form={form} update={update} /></div><Field label="Work email" name="counterpartEmail" type="email" form={form} update={update} /></div>;
}

function AudienceFields({ prefix = '', form, update, toggle }: Props & { prefix?: string }) {
  const key = (name: string) => prefix ? `${prefix}${name.charAt(0).toUpperCase()}${name.slice(1)}` : name;
  return <>
    <JourneyHeading eyebrow="Audience profile" title="Who they are" description="Start with the clearest picture of the customer, then add structured detail where it improves the match." />
    <TextArea label="Describe this priority audience beyond their basic demographics" name={key('audienceDescription')} form={form} update={update} maxLength={200} helper="For example: what connects them, what they care about, or why this product is relevant to them. Maximum 200 characters." />
    <SingleChoice label="Where is this audience based?" name={key('audienceGeography')} options={audienceGeography} form={form} toggle={toggle} />
    {selectedOne(form[key('audienceGeography')]) === 'Specific countries or regions' && <Field label="Which countries or regions?" name={key('audienceGeographyDetail')} form={form} update={update} placeholder="For example: South Africa, the UK and Western Europe" />}
    <details className="optional-depth"><summary>Add demographic and travel detail <span>Optional</span></summary>
      <ChoiceGrid label="Which age groups are most relevant?" name={key('ageGroups')} options={ageGroups} form={form} toggle={toggle} max={3} optional />
      <ChoiceGrid label="Which life stages are most relevant?" name={key('lifeStages')} options={lifeStages} form={form} toggle={toggle} max={3} optional />
      <ChoiceGrid label="Which income or spending-power bands are most relevant?" name={key('spendingPower')} options={spendingPower} form={form} toggle={toggle} optional />
      <SingleChoice label="Is this customer typically travelling for business, leisure, or both?" name={key('travelPurpose')} options={['Business', 'Leisure', 'Both', 'Not travel-related', 'Not sure']} form={form} toggle={toggle} optional />
    </details>
    <JourneyHeading eyebrow="Customer behaviour" title="How they discover and choose" description="These answers describe the audience's behaviour, rather than the channels your brand uses to market to them." />
    <ChoiceGrid label="Where does this audience typically discover products like yours?" name={key('discoveryChannels')} options={discoveryChannels} form={form} toggle={toggle} max={4} optional />
    <ChoiceGrid label="What matters most when they choose this type of product?" name={key('decisionFactors')} options={decisionFactors} form={form} toggle={toggle} max={3} ranked helper="Choose their first, second and third priorities in order." />
    <SingleChoice label="How open are they to trying an unfamiliar brand or product?" name={key('discoveryOpenness')} options={['1 — Very unlikely', '2', '3 — Neutral', '4', '5 — Very open', 'Not sure']} form={form} toggle={toggle} appearance="scale" />
    <Field label="Is there anyone this product is not intended for?" name={key('audienceExclusions')} form={form} update={update} optional />
    <JourneyHeading eyebrow="Confidence" title="What this understanding is based on" description="This helps IRL distinguish measured audience knowledge from an informed assumption." />
    <SingleChoice label="How do you know this about your audience?" name={key('audienceEvidence')} options={['Customer or sales data', 'Surveys or customer feedback', 'Social media analytics', 'Industry research', "Founder's direct experience", 'Assumption, not yet tested', 'Other']} form={form} toggle={toggle} />
    {selectedOne(form[key('audienceEvidence')]) === 'Assumption, not yet tested' && <p className="field-notice">IRL will mark this audience information for review before it informs a match.</p>}
    <TextArea label="Is there anything else IRL should understand about this audience?" name={key('audienceNotes')} form={form} update={update} optional />
  </>;
}

export default function BrandOnboardingStep(props: Props) {
  return <ValidationContext.Provider value={props.errors || {}}><UpdateContext.Provider value={props.update}><BrandOnboardingStepContent {...props} /></UpdateContext.Provider></ValidationContext.Provider>;
}

function BrandOnboardingStepContent({ step, form, update, toggle, goToStep }: Props) {
  if (step === 'team') {
    const role = selectedOne(form.onboardingRole);
    if (role === 'Neither') return <><SingleChoice label="Which best describes your role in this partnership?" name="onboardingRole" options={['Day-to-day contact', 'Approver', 'Both', 'Neither']} form={form} toggle={toggle} /><div className="forward-message"><h3>Please send this profile to the right person</h3><p>The profile should be completed by the day-to-day IRL contact, the approver, or someone who fulfils both roles. Your answers have been saved on this device.</p></div></>;
    return <>
      <JourneyHeading eyebrow="Primary contact" title="Who should IRL speak to?" description="We only need the essential contact details for this first profile." />
      <div className="field-row"><Field label="First name" name="firstName" form={form} update={update} /><Field label="Last name" name="lastName" form={form} update={update} /></div>
      <Field label="Work email" name="email" type="email" form={form} update={update} />
      <SingleChoice label="Which best describes your role in this partnership?" name="onboardingRole" options={['Day-to-day contact', 'Approver', 'Both', 'Neither']} form={form} toggle={toggle} />
      {role === 'Day-to-day contact' && <CounterpartContact role="Approver" form={form} update={update} />}
      {role === 'Approver' && <CounterpartContact role="Day-to-day contact" form={form} update={update} />}
      <JourneyHeading eyebrow="Brand essentials" title="Tell us about the brand" description="Enough for IRL to recognise the brand and create a useful starting overview." />
      <Field label="Brand name" name="brandName" form={form} update={update} />
      <Field label="Brand website" name="brandWebsite" type="url" form={form} update={update} placeholder="https://" />
      <TextArea label="Describe the brand in one clear sentence" name="brandDescription" form={form} update={update} maxLength={200} helper="What do you make, and what makes the brand relevant? Maximum 200 characters." />
    </>;
  }

  if (step === 'product') {
    const category = selectedOne(form.productCategory);
    const hasCurrency = typeof form.priceCurrency === 'string' && Boolean(form.priceCurrency.trim());
    const hasPrice = typeof form.priceMin === 'string' && Boolean(form.priceMin.trim());
    return <>
      <p className="section-guidance">Start with the single product or range that gives IRL the best introduction to your brand. More products can be added later.</p>
      <SingleChoice label="What should IRL consider first?" name="productScope" options={['One specific product', 'A product range', 'Help us decide']} form={form} toggle={toggle} />
      <Field label="Product or range name" name="productName" form={form} update={update} />
      <Field label="Product webpage" name="productWebpage" type="url" form={form} update={update} optional placeholder="https://" />
      <SingleChoice label="Which category best describes it?" name="productCategory" options={primaryCategories} form={form} toggle={toggle} />
      <div className="field-row">
        <SearchableSelect label="Typical retail currency" name="priceCurrency" options={currencyOptions} form={form} update={update} optional />
        <Field label="Typical retail price" name="priceMin" type="number" min={0} step="0.01" form={form} update={update} optional />
      </div>
      {(hasCurrency !== hasPrice) && <p className="field-notice">If you add a price, include both the currency and the amount.</p>}
      {category === 'Health & Wellness' && <TextArea label="Any legal, safety or compliance requirements?" name="legalSafetyCompliance" form={form} update={update} helper="Include anything IRL must know before placing or presenting this product." />}
    </>;
  }

  if (step === 'need') {
    const barrier = selectedOne(form.primaryBarrier);
    return <>
      <JourneyHeading eyebrow="Priority audience" title="Who should experience this product?" description="Describe the people and context that matter most, rather than a long list of demographics." />
      <TextArea label="Describe the priority audience" name="audienceDescription" form={form} update={update} maxLength={300} helper="Who are they, what matters to them, and why is this product relevant? Maximum 300 characters." />
      <SingleChoice label="What is the main barrier stopping them from choosing the product?" name="primaryBarrier" options={['Awareness — they do not know it exists', 'Understanding — they do not understand the value', 'Trust — they need proof or reassurance', 'Trial — they need to experience it first', 'Availability — it is hard to find or buy', 'Price — the cost is the main concern', 'Habit — they default to an existing alternative', 'Not sure yet']} form={form} toggle={toggle} />
      <CarryForward label="The barrier IRL should help address" value={barrier} />
      <SingleChoice label="Where could IRL add the most value?" name="irlOpportunity" options={['Introduce the brand to the right people', 'Let people experience the product in context', 'Build trust through real-world use', 'Create useful customer feedback and evidence', 'Encourage purchase or repeat use', 'Help us learn which audiences or settings fit best', 'Not sure yet']} form={form} toggle={toggle} />
      <TextArea label="What would make an IRL partnership worthwhile?" name="primarySuccessResult" form={form} update={update} maxLength={240} helper="Give us the single most useful result or learning. Maximum 240 characters." />
      <SingleChoice label="Could you supply product for an initial small-scale activation?" name="supplyCapability" options={['Yes', 'Probably, depending on quantity', 'Not yet', 'Not sure']} form={form} toggle={toggle} />
      <TextArea label="Are there any competitor, placement or association restrictions?" name="competitorLockouts" form={form} update={update} optional helper="Leave blank if none." />
    </>;
  }

  if (step === 'review') return <BrandReview form={form} update={update} goToStep={goToStep} />;
  return null;
}

export type BrandValidationError = { key: string; label: string; message: string };

export function validateBrandStepFields(step: string, form: BrandForm): BrandValidationError[] {
  const errors: BrandValidationError[] = [];
  const add = (key: string, label: string, message = `${label} is required.`) => { if (!errors.some(error => error.key === key)) errors.push({ key, label, message }); };
  const text = (key: string) => typeof form[key] === 'string' ? String(form[key]).trim() : '';
  const requireText = (key: string, label: string) => { if (!text(key)) add(key, label); };
  const requireChoice = (key: string, label: string) => { if (!selectedOne(form[key])) add(key, label, 'Choose one option.'); };
  const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const validUrl = (value: string) => { try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:'; } catch { return false; } };

  if (step === 'team') {
    requireChoice('onboardingRole', 'Partnership role');
    if (selectedOne(form.onboardingRole) === 'Neither') return [{ key: 'onboardingRole', label: 'Partnership role', message: 'The profile must be completed by the day-to-day contact, approver, or someone who is both.' }];
    ['firstName:First name', 'lastName:Last name', 'email:Work email', 'brandName:Brand name', 'brandWebsite:Brand website', 'brandDescription:Brand description'].forEach(item => { const [key, label] = item.split(':'); requireText(key, label); });
    if (text('email') && !validEmail(text('email'))) add('email', 'Work email', 'Enter a valid work email address.');
    if (text('brandWebsite') && !validUrl(text('brandWebsite'))) add('brandWebsite', 'Brand website', 'Enter a complete website address beginning with http:// or https://.');
    if (['Day-to-day contact', 'Approver'].includes(selectedOne(form.onboardingRole))) {
      ['counterpartFirstName:Counterpart first name', 'counterpartLastName:Counterpart last name', 'counterpartEmail:Counterpart email'].forEach(item => { const [key, label] = item.split(':'); requireText(key, label); });
      if (text('counterpartEmail') && !validEmail(text('counterpartEmail'))) add('counterpartEmail', 'Counterpart email', 'Enter a valid email address.');
    }
  }

  if (step === 'product') {
    requireChoice('productScope', 'Starting product');
    requireText('productName', 'Product or range name');
    requireChoice('productCategory', 'Product category');
    if (text('productWebpage') && !validUrl(text('productWebpage'))) add('productWebpage', 'Product webpage', 'Enter a complete website address beginning with http:// or https://.');
    if (selectedOne(form.productCategory) === 'Other') requireText('productCategoryOther', 'Product category details');
    const currency = text('priceCurrency');
    const price = text('priceMin');
    if (currency || price) {
      if (!currency) add('priceCurrency', 'Typical retail currency', 'Add a currency when you add a price.');
      if (!price) add('priceMin', 'Typical retail price', 'Add a price when you choose a currency.');
      if (currency && !/^[A-Z]{3}$/.test(currency)) add('priceCurrency', 'Typical retail currency', 'Choose a valid three-letter currency code.');
      if (price && (!Number.isFinite(Number(price)) || Number(price) < 0)) add('priceMin', 'Typical retail price', 'Enter a valid price.');
    }
    if (selectedOne(form.productCategory) === 'Health & Wellness') requireText('legalSafetyCompliance', 'Legal, safety or compliance requirements');
  }

  if (step === 'need') {
    requireText('audienceDescription', 'Priority audience');
    requireChoice('primaryBarrier', 'Primary barrier');
    requireChoice('irlOpportunity', 'IRL opportunity');
    requireText('primarySuccessResult', 'Partnership result');
    requireChoice('supplyCapability', 'Supply capability');
  }

  if (step === 'review' && form.profileConfirmed !== 'yes') add('profileConfirmed', 'Profile accuracy confirmation', 'Confirm that the initial Brand Profile is accurate before submitting.');
  return errors;
}

export function validateBrandStep(step: string, form: BrandForm): string[] {
  return validateBrandStepFields(step, form).map(error => error.label);
}

const reviewGroups = [
  { id: 'team', editStep: 'team', title: 'Your contact details', keys: ['firstName', 'lastName', 'email', 'onboardingRole', 'counterpartFirstName', 'counterpartLastName', 'counterpartEmail'] },
  { id: 'brand', editStep: 'team', title: 'Brand essentials', keys: ['brandName', 'brandWebsite', 'brandDescription'] },
  { id: 'product', editStep: 'product', title: 'Starting product', keys: ['productScope', 'productName', 'productWebpage', 'productCategory', 'productCategoryOther', 'priceCurrency', 'priceMin', 'legalSafetyCompliance'] },
  { id: 'audience', editStep: 'need', title: 'Audience and opportunity', keys: ['audienceDescription', 'primaryBarrier', 'irlOpportunity', 'primarySuccessResult', 'supplyCapability', 'competitorLockouts'] },
] as const;

function hasReviewValue(value: BrandFormValue | undefined) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function displayReviewValue(value: BrandFormValue): string {
  if (!Array.isArray(value)) return value;
  return value.map(item => typeof item === 'string'
    ? item
    : Object.entries(item).map(([key, answer]) => `${fieldLabels[key] || key.replace(/([A-Z])/g, ' $1')}: ${Array.isArray(answer) ? answer.join(', ') : answer}`).join(' · ')).join('\n');
}

function BrandReview({ form, update, goToStep }: { form: BrandForm; update: Props['update']; goToStep?: Props['goToStep'] }) {
  const knownKeys = new Set<string>(reviewGroups.flatMap(group => [...group.keys, 'secondaryAudienceEnabled']));
  const populatedGroups = reviewGroups.map(group => ({ ...group, entries: group.keys.filter(key => hasReviewValue(form[key])).map(key => [key, form[key]!] as const) })).filter(group => group.entries.length);
  const additionalEntries = Object.entries(form).filter(([key, value]) => !knownKeys.has(key) && key !== 'finalNotes' && key !== 'profileConfirmed' && !key.endsWith('Enabled') && hasReviewValue(value));
  return <div className="review-list">
    <div className="review-intro"><h3>Review your initial Brand Profile</h3><p>These are the essentials IRL will use to create your starting profile. Use Edit section to make a change without losing your progress.</p></div>
    {populatedGroups.length === 0 && additionalEntries.length === 0 ? <p>No answers have been added yet.</p> : <>
      {populatedGroups.map(group => <section className="review-section" key={group.id}>
        <header><h3>{group.title}</h3>{goToStep && <button type="button" onClick={() => goToStep(group.editStep)}>Edit section</button>}</header>
        <div className="review-answers">{group.entries.map(([key, value]) => <div className="review-answer" key={key}><span>{fieldLabels[key] || key.replace(/([A-Z])/g, ' $1')}</span><strong>{displayReviewValue(value)}</strong></div>)}</div>
      </section>)}
      {additionalEntries.length > 0 && <section className="review-section"><header><h3>Additional information</h3></header><div className="review-answers">{additionalEntries.map(([key, value]) => <div className="review-answer" key={key}><span>{fieldLabels[key] || key.replace(/([A-Z])/g, ' $1')}</span><strong>{displayReviewValue(value)}</strong></div>)}</div></section>}
    </>}
    <div className="review-final"><TextArea label="Is there anything else IRL should know?" name="finalNotes" form={form} update={update} optional /><label className="confirm"><input type="checkbox" checked={form.profileConfirmed === 'yes'} onChange={(event) => update('profileConfirmed', event.target.checked ? 'yes' : '')} /> I confirm that this initial Brand Profile is accurate to the best of my knowledge.</label><FieldError name="profileConfirmed" /><p className="privacy-note">IRL uses this information to build and maintain your Brand Profile, identify suitable property matches and support future partnership conversations. Contact IRL if information needs to be corrected.</p></div>
  </div>;
}
