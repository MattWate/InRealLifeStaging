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

function SearchableSelect({ label, name, options, form, update }: { label: string; name: string; options: SelectOption[]; form: BrandForm; update: Props['update'] }) {
  const listId = useId();
  const error = useContext(ValidationContext)[name];
  return <label className="field"><span>{label}</span><input list={listId} value={typeof form[name] === 'string' ? form[name] as string : ''} placeholder="Search by code or currency name" maxLength={3} pattern="[A-Z]{3}" aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} onChange={event => update(name, event.target.value.toUpperCase().split(' — ')[0])} /><datalist id={listId}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</datalist><FieldError name={name} /></label>;
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
  return <div className="progressive-card"><h3>{role}</h3><p className="progressive-intro">Please add the person IRL should work with in this role.</p><div className="field-row"><Field label="First name" name="counterpartFirstName" form={form} update={update} /><Field label="Last name" name="counterpartLastName" form={form} update={update} /></div><Field label="Work email" name="counterpartEmail" type="email" form={form} update={update} /><Field label="Job title" name="counterpartJobTitle" form={form} update={update} /></div>;
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
  const secondaryAudienceRef = useRef<HTMLDivElement>(null);
  const secondaryAudienceEnabled = selectedOne(form.secondaryAudienceEnabled) === 'Yes';
  const secondaryCategories = Array.isArray(form.brandSecondaryCategories) ? form.brandSecondaryCategories as string[] : [];
  const selectedBrandCategories = [selectedOne(form.brandPrimaryCategory), ...secondaryCategories].filter(Boolean);
  const productCategoryOptions = selectedBrandCategories.length ? selectedBrandCategories : primaryCategories;
  useEffect(() => {
    if (step === 'audience' && secondaryAudienceEnabled) window.requestAnimationFrame(() => secondaryAudienceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [secondaryAudienceEnabled, step]);
  useEffect(() => {
    if (step === 'product' && productCategoryOptions.length === 1 && !selectedOne(form.productCategory)) update('productCategory', [productCategoryOptions[0]]);
  }, [form.productCategory, productCategoryOptions, step, update]);

  if (step === 'team') {
    const role = selectedOne(form.onboardingRole);
    return <><div className="subsection-heading"><p className="eyebrow">Primary contact</p><h2>Your details</h2></div><div className="field-row"><Field label="First name" name="firstName" form={form} update={update} /><Field label="Last name" name="lastName" form={form} update={update} /></div><Field label="Work email" name="email" type="email" form={form} update={update} /><Field label="Mobile number" name="mobile" type="tel" form={form} update={update} optional /><Field label="Job title" name="jobTitle" form={form} update={update} /><SingleChoice label="Which best describes your role in this partnership?" name="onboardingRole" options={['Day-to-day contact', 'Approver', 'Both']} form={form} toggle={toggle} />{role === 'Day-to-day contact' && <CounterpartContact role="Approver" form={form} update={update} />}{role === 'Approver' && <CounterpartContact role="Day-to-day contact" form={form} update={update} />}<AdditionalContacts form={form} update={update} /></>;
  }

  if (step === 'brand') return <>
    <JourneyHeading eyebrow="Brand identity" title="The organisation behind the product" />
    <Field label="Brand name" name="brandName" form={form} update={update} />
    <Field label="Brand website" name="brandWebsite" type="url" form={form} update={update} />
    <SingleChoice label="Is the brand part of a larger company or group?" name="partOfGroup" options={['No', 'Yes']} form={form} toggle={toggle} />
    {selectedOne(form.partOfGroup) === 'Yes' && <Field label="Parent company or group name" name="parentCompany" form={form} update={update} />}
    <div className="field-row"><Field label="Country" name="brandCountry" form={form} update={update} placeholder="Where is the brand based?" /><Field label="City" name="brandCity" form={form} update={update} optional /></div>

    <JourneyHeading eyebrow="Commercial footprint" title="Where customers can find you" description="Markets describe where the brand is active. Sales channels describe where customers can currently buy it." />
    <SearchableMultiSelect label="Which markets is the brand currently active in?" name="activeMarkets" options={marketOptions} form={form} update={update} />
    <ChoiceGrid label="Where can customers currently buy the brand?" name="salesChannels" options={salesChannels} form={form} toggle={toggle} />

    <JourneyHeading eyebrow="Classification" title="How the brand fits" />
    <SingleChoice label="What is the brand's primary category?" name="brandPrimaryCategory" options={primaryCategories} form={form} toggle={toggle} />
    <ChoiceGrid label="Does the brand also operate in another category?" name="brandSecondaryCategories" options={primaryCategories.filter(category => category !== selectedOne(form.brandPrimaryCategory))} form={form} toggle={toggle} max={2} optional />

    <JourneyHeading eyebrow="Positioning" title="How you describe the brand" />
    <TextArea label="How would you describe the brand in one sentence?" name="brandDescription" form={form} update={update} helper="Focus on the promise or relevance of the brand rather than repeating its location or category. Maximum 200 characters." maxLength={200} />
    <SingleChoice label="What most sets your brand apart?" name="brandDifferentiator" options={['Product quality', 'Innovation', 'Design', 'Price', 'Convenience', 'Expertise']} form={form} toggle={toggle} />
    <SingleChoice label="What does your brand stand for?" name="brandValues" options={['Sustainability', 'Craft', 'Heritage', 'Community', 'Wellness', 'Status & Identity']} form={form} toggle={toggle} />

    <JourneyHeading eyebrow="Brand associations" title="Where the brand should — and should not — sit" description="These final questions distinguish associations you want to avoid from brands that signal a good fit." />
    <TextArea label="Are there any competitor brands or categories you'd rather we didn't place you alongside?" name="competitorLockouts" form={form} update={update} optional />
    <TextArea label="Which 3–4 brands would feel at home in your ideal customer's bag?" name="brandNeighbourhood" form={form} update={update} optional helper="These are positive reference points, not competitors to exclude. This answer will not be scored as a matching field." />
  </>;

  if (step === 'product') {
    const category = selectedOne(form.productCategory);
    const scope = selectedOne(form.productScope);
    const itemLabel = scope === 'A product range' ? 'Product range name' : scope === 'Several products' ? 'First product or range name' : 'Product or range name';
    return <>
      <JourneyHeading eyebrow="Starting point" title="What you want IRL to consider" description="Choose the scope first. The labels and product options below will adapt to that choice." />
      <SingleChoice label="What should IRL consider?" name="productScope" options={['One specific product', 'A product range', 'Several products', 'Help us decide']} form={form} toggle={toggle} />
      {scope === 'Several products' && <p className="section-guidance">Start with the first product or range, then use <strong>Add another product or range</strong> below for the others.</p>}
      {scope === 'Help us decide' && <p className="section-guidance">Give us the most likely product or range to start with. IRL can use this information to help refine the final selection with you.</p>}

      <JourneyHeading eyebrow="Product profile" title={scope === 'Several products' ? 'Your first product or range' : 'The product details'} />
      <Field label={itemLabel} name="productName" form={form} update={update} />
      <SingleChoice label="Does it have a product webpage?" name="hasProductWebpage" options={['Yes', 'No']} form={form} toggle={toggle} />
      {selectedOne(form.hasProductWebpage) === 'Yes' && <Field label="Product webpage" name="productWebpage" type="url" form={form} update={update} />}
      {productCategoryOptions.length === 1
        ? <div className="carry-forward"><span>Product category</span><strong>{productCategoryOptions[0]}</strong><small>Carried forward from the brand profile.</small></div>
        : <SingleChoice label="Which of the brand's categories does this product belong to?" name="productCategory" options={productCategoryOptions} form={form} toggle={toggle} />}
      {category && <SingleChoice label="Product subcategory" name="productSubcategory" options={subcategories[category] || ['Other']} form={form} toggle={toggle} />}
      <div className="field-row"><SearchableSelect label="Currency" name="priceCurrency" options={currencyOptions} form={form} update={update} /><Field label="Minimum retail price" name="priceMin" type="number" min={0} step="0.01" form={form} update={update} placeholder="0.00" /></div>
      {['A product range', 'Several products'].includes(scope) && <Field label="Maximum retail price" name="priceMax" type="number" min={0} step="0.01" form={form} update={update} optional placeholder="0.00" />}
      <Field label="Are there any variants you want IRL to focus on?" name="variants" form={form} update={update} optional />

      <JourneyHeading eyebrow="Availability" title="Where the product can go next" description="This is about the product's availability. It is separate from the brand's marketing activity later in the form." />
      <SingleChoice label="Is this product available through the same markets and channels listed for the brand?" name="sameProductAvailability" options={['Yes', 'No']} form={form} toggle={toggle} />
      {selectedOne(form.sameProductAvailability) === 'No' && <div className="progressive-card"><Field label="Product-specific markets" name="productMarkets" form={form} update={update} /><ChoiceGrid label="Product-specific channels" name="productChannels" options={salesChannels} form={form} toggle={toggle} /></div>}
      <SingleChoice label="Do you ship internationally?" name="internationalShipping" options={['Yes', 'Yes, to specific regions', 'No']} form={form} toggle={toggle} />
      {selectedOne(form.internationalShipping) === 'Yes, to specific regions' && <Field label="Which regions do you ship to?" name="internationalShippingRegions" form={form} update={update} />}

      <JourneyHeading eyebrow="Requirements" title="What IRL needs to know before placement" />
      <TextArea label="Is there anything we need to know for legal, safety, or compliance reasons before your product goes in front of a guest?" name="legalSafetyCompliance" form={form} update={update} optional={selectedOne(form.brandPrimaryCategory) !== 'Health & Wellness'} helper={selectedOne(form.brandPrimaryCategory) === 'Health & Wellness' ? 'Required for Health & Wellness brands.' : 'Include age restrictions, health warnings or ingredient concerns.'} />
      <div className={scope === 'Several products' ? 'additional-products additional-products--prominent' : 'additional-products'}>
        <AdditionalProducts form={form} update={update} categories={productCategoryOptions} />
      </div>
    </>;
  }

  if (step === 'audience') return <><AudienceFields step={step} form={form} update={update} toggle={toggle} /><UploadPlaceholder label="Upload existing audience material" helper="Persona, research, survey or audience deck." />{secondaryAudienceEnabled ? <div className="progressive-card secondary-audience" ref={secondaryAudienceRef} tabIndex={-1}><div className="progressive-heading"><h3>Secondary audience</h3><button type="button" className="icon-action" aria-label="Remove secondary audience" onClick={() => update('secondaryAudienceEnabled', [])}><Trash2 size={17} /></button></div><AudienceFields prefix="secondary" step={step} form={form} update={update} toggle={toggle} /></div> : <AddButton label="Add a secondary audience" onClick={() => update('secondaryAudienceEnabled', ['Yes'])} />}</>;

  if (step === 'need') return <>
    <JourneyHeading eyebrow="Desired outcome" title="What the customer is trying to achieve" />
    <SingleChoice label="What outcome is your customer looking for?" name="customerOutcome" options={['Save time', 'Feel confident or reassured', 'Feel good or indulge', 'Improve health or performance', 'Look or feel better', 'Simplify a routine', 'Feel calm or relaxed', 'Enhance my home or space', 'Solve a specific problem', 'Other']} form={form} toggle={toggle} />
    <Field label="Add detail if useful" name="customerOutcomeDetail" form={form} update={update} optional maxLength={100} helper="Maximum 100 characters." />
    <ChoiceGrid label="When is this need most relevant?" name="needContext" options={needContexts} form={form} toggle={toggle} max={3} />

    <JourneyHeading eyebrow="Current behaviour" title="What happens today" />
    <SingleChoice label="What are they currently using instead?" name="currentAlternative" options={['Nothing, this is new to them', 'A competitor brand', 'A generic or unbranded alternative', 'A DIY or homemade solution', 'They avoid the category entirely', 'Not sure']} form={form} toggle={toggle} />
    <Field label="Add an explanation if useful" name="alternativeExplanation" form={form} update={update} optional />

    <JourneyHeading eyebrow="Adoption" title="What gets in the way — and what could help" description="First identify the single biggest barrier, then choose the strongest ways to reduce it." />
    <SingleChoice label="What do you believe is the single biggest barrier to choosing this product?" name="primaryBarrier" options={['Price', "Awareness — they don't know it exists", 'Access — hard to find or buy', 'Trust — unproven or unfamiliar', 'Habit — hard to switch from current choice', 'Not sure']} form={form} toggle={toggle} />
    <ChoiceGrid label="What do you believe would most help a customer choose your product?" name="barrierReducers" options={['Experiencing it firsthand — trying it, seeing or feeling the quality', 'Seeing other people use it', 'A trusted recommendation', 'Understanding it better', 'Better value', 'Easier availability', 'Being experienced in a credible, high-quality setting', 'Not sure']} form={form} toggle={toggle} max={2} />
    <TextArea label="Is there anything else IRL should understand about this decision?" name="decisionNotes" form={form} update={update} optional />
  </>;

  if (step === 'value-success') {
    const selectedMarketing = Array.isArray(form.marketingChannels) ? form.marketingChannels as string[] : [];
    const experiential = Array.isArray(form.experientialHistory) ? form.experientialHistory as string[] : [];
    const usedExperiential = experiential.some(value => value !== 'None of these');
    const reducers = Array.isArray(form.barrierReducers) ? (form.barrierReducers as string[]).join(' · ') : '';
    return <>
      <JourneyHeading eyebrow="Current reach" title="How your team reaches this audience today" description="These are channels the brand actively uses. Earlier questions described where customers buy and how they discover products." />
      <ChoiceGrid label="Which channels does your team currently use to reach this audience?" name="marketingChannels" options={marketingChannels} form={form} toggle={toggle} helper="Select all that apply." />
      {selectedMarketing.length > 0 && <ChoiceGrid label="Rank the three channels you use most" name="marketingChannelRank" options={selectedMarketing} form={form} toggle={toggle} max={3} ranked />}
      {selectedMarketing.length > 0 && <SingleChoice label="Which of these channels currently drives the most measurable customer acquisition or sales?" name="measuredAcquisitionChannel" options={[...selectedMarketing, "We don't currently know"]} form={form} toggle={toggle} />}
      <SingleChoice label="Do you currently run any paid marketing?" name="paidMarketing" options={['Yes, ongoing', 'Yes, occasionally', 'No, not yet', 'Not sure']} form={form} toggle={toggle} helper="Include paid activity beyond the specific channels selected above." />

      <JourneyHeading eyebrow="Experience" title="What you have already tried" description="This is about previous or current real-world and experiential activity, rather than your general marketing mix." />
      <ChoiceGrid label="Which real-world or experiential activities have you used before?" name="experientialHistory" options={experientialTactics} form={form} toggle={toggle} />
      {usedExperiential && <><SingleChoice label="How effective was that activity overall?" name="experientialEffectiveness" options={['Very effective', 'Somewhat effective', 'Hard to measure', 'Not effective']} form={form} toggle={toggle} /><SingleChoice label="What is that assessment based on?" name="experientialEvidence" options={['Direct sales or booking data', 'Customer feedback', 'General impression', 'Not sure']} form={form} toggle={toggle} /></>}

      <JourneyHeading eyebrow="IRL opportunity" title="Move from the customer barrier to the opportunity" description="Use what you told us about the customer to identify the main job IRL should do." />
      <CarryForward label="Customer barrier" value={selectedOne(form.primaryBarrier)} />
      <CarryForward label="What could help" value={reducers} />
      <SingleChoice label="With that in mind, what's the main gap or opportunity IRL should address?" name="irlOpportunity" options={opportunities} form={form} toggle={toggle} />

      <JourneyHeading eyebrow="Success" title="What winning looks like" description="Turn the opportunity into one intended result, then choose the signals that would make progress visible." />
      <CarryForward label="Selected opportunity" value={selectedOne(form.irlOpportunity)} />
      <Field label="What is the single most important result IRL should support?" name="primarySuccessResult" form={form} update={update} helper={selectedOne(form.irlOpportunity) ? `Confirm or refine: ${selectedOne(form.irlOpportunity)}` : 'This should confirm or refine the opportunity selected above.'} />
      <ChoiceGrid label="Which signals would be most useful to see in reporting?" name="successSignals" options={successSignals} form={form} toggle={toggle} max={3} />
    </>;
  }

  if (step === 'operations') return <><ChoiceGrid label="Where or how could a guest realistically use or experience this product?" name="brandSuggestedPlacements" options={placementOptions} form={form} toggle={toggle} /><ChoiceGrid label="Does the product require anything special to use, store, or display?" name="handlingRequirements" options={handlingRequirements} form={form} toggle={toggle} /><SingleChoice label="Could you supply product for an initial IRL experience?" name="supplyCapability" options={['Yes', 'Probably', 'Need to discuss', 'No']} form={form} toggle={toggle} />{['Yes', 'Probably'].includes(selectedOne(form.supplyCapability)) && <Field label="Is there a practical limit to how much product you could supply initially?" name="initialSupplyLimit" form={form} update={update} optional />}</>;

  return <BrandReview form={form} update={update} goToStep={goToStep} />;
}

export type BrandValidationError = { key: string; label: string; message: string };

export function validateBrandStepFields(step: string, form: BrandForm): BrandValidationError[] {
  const missing: BrandValidationError[] = [];
  const add = (key: string, label: string, message = `${label} is required.`) => { if (!missing.some(error => error.key === key)) missing.push({ key, label, message }); };
  const requireText = (key: string, label: string) => { if (!String(typeof form[key] === 'string' ? form[key] : '').trim()) add(key, label); };
  const requireChoice = (key: string, label: string) => { if (!selectedOne(form[key])) add(key, label, 'Choose one option.'); };
  const requireMany = (key: string, label: string) => { if (!Array.isArray(form[key]) || !(form[key] as unknown[]).some(value => typeof value === 'string' && value.trim())) add(key, label, 'Choose at least one option.'); };
  const requireList = (key: string, label: string) => { const value = form[key]; if (!(typeof value === 'string' && value.trim()) && !(Array.isArray(value) && value.some(item => typeof item === 'string' && item.trim()))) add(key, label, 'Add at least one country or region.'); };
  const requireOther = (key: string, label = 'Other') => { const value = form[key]; if (Array.isArray(value) && (value as unknown[]).includes('Other')) requireText(`${key}Other`, `${label} details`); };
  if (step === 'team') {
    requireChoice('onboardingRole', 'Partnership role');
    if (selectedOne(form.onboardingRole) && !['Day-to-day contact', 'Approver', 'Both'].includes(selectedOne(form.onboardingRole))) add('onboardingRole', 'Partnership role', 'Choose one of the available roles.');
    ['firstName:First name', 'lastName:Last name', 'email:Work email', 'jobTitle:Job title'].forEach(item => { const [key, label] = item.split(':'); requireText(key, label); });
    if (typeof form.email === 'string' && form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) add('email', 'Work email', 'Enter a valid work email address.');
    if (['Day-to-day contact', 'Approver'].includes(selectedOne(form.onboardingRole))) ['counterpartFirstName:Counterpart first name', 'counterpartLastName:Counterpart last name', 'counterpartEmail:Counterpart email', 'counterpartJobTitle:Counterpart job title'].forEach(item => { const [key, label] = item.split(':'); requireText(key, label); });
    if (nested(form, 'additionalContacts').some(contact => ['firstName', 'lastName', 'email', 'jobTitle'].some(key => !String(contact[key] || '').trim()))) add('additionalContacts', 'Additional contacts', 'Complete each added contact or remove the incomplete contact.');
  }
  if (step === 'brand') {
    ['brandName:Brand name', 'brandWebsite:Brand website', 'brandCountry:Brand country', 'brandDescription:Brand description'].forEach(item => { const [key, label] = item.split(':'); requireText(key, label); });
    requireList('activeMarkets', 'Active markets');
    ['partOfGroup:Company or group status', 'brandPrimaryCategory:Primary category', 'brandDifferentiator:Brand differentiator', 'brandValues:Brand values'].forEach(item => { const [key, label] = item.split(':'); requireChoice(key, label); });
    if (selectedOne(form.partOfGroup) === 'Yes') requireText('parentCompany', 'Parent company');
    requireMany('salesChannels', 'Sales channels');
    ['brandPrimaryCategory', 'brandSecondaryCategories', 'salesChannels'].forEach(key => requireOther(key));
  }
  if (step === 'product') {
    ['productName:Product or range name', 'priceCurrency:Currency', 'priceMin:Minimum retail price'].forEach(item => { const [key, label] = item.split(':'); requireText(key, label); });
    if (typeof form.priceCurrency === 'string' && form.priceCurrency.trim() && !/^[A-Z]{3}$/.test(form.priceCurrency)) add('priceCurrency', 'Currency', 'Choose a three-letter currency code from the list.');
    ['productScope:Product scope', 'hasProductWebpage:Product webpage status', 'productCategory:Product category', 'productSubcategory:Product subcategory', 'sameProductAvailability:Product availability', 'internationalShipping:International shipping'].forEach(item => { const [key, label] = item.split(':'); requireChoice(key, label); });
    if (selectedOne(form.hasProductWebpage) === 'Yes') requireText('productWebpage', 'Product webpage');
    if (selectedOne(form.sameProductAvailability) === 'No') { requireText('productMarkets', 'Product-specific markets'); requireMany('productChannels', 'Product-specific channels'); }
    if (selectedOne(form.internationalShipping) === 'Yes, to specific regions') requireText('internationalShippingRegions', 'International shipping regions');
    if (selectedOne(form.brandPrimaryCategory) === 'Health & Wellness') requireText('legalSafetyCompliance', 'Legal, safety or compliance information');
    ['productCategory', 'productSubcategory', 'productChannels'].forEach(key => requireOther(key));
    if (nested(form, 'additionalProducts').some(product => !String(product.name || '').trim() || !String(product.currency || '').trim() || !String(product.priceMin || '').trim() || !selectedOne(product.hasWebpage) || !selectedOne(product.category) || !selectedOne(product.subcategory) || !selectedOne(product.sameAvailability) || !selectedOne(product.internationalShipping) || (selectedOne(product.hasWebpage) === 'Yes' && !String(product.webpage || '').trim()) || (selectedOne(product.sameAvailability) === 'No' && (!String(product.markets || '').trim() || !Array.isArray(product.channels) || !product.channels.length)) || (selectedOne(product.internationalShipping) === 'Yes, to specific regions' && !String(product.shippingRegions || '').trim()) || (selectedOne(product.category) === 'Health & Wellness' && !String(product.legalSafetyCompliance || '').trim()) || (selectedOne(product.category) === 'Other' && !String(product.categoryOther || '').trim()) || (selectedOne(product.subcategory) === 'Other' && !String(product.subcategoryOther || '').trim()) || (Array.isArray(product.channels) && product.channels.includes('Other') && !String(product.channelsOther || '').trim()))) add('additionalProducts', 'Additional products', 'Complete each added product or remove the incomplete product.');
  }
  if (step === 'audience') {
    requireText('audienceDescription', 'Priority audience'); ['audienceEvidence:Audience evidence', 'audienceGeography:Audience geography', 'discoveryOpenness:Openness to unfamiliar brands'].forEach(item => { const [key, label] = item.split(':'); requireChoice(key, label); }); if (!Array.isArray(form.decisionFactors) || form.decisionFactors.length !== 3) add('decisionFactors', 'Decision priorities', 'Choose exactly three priorities in order.');
    if (selectedOne(form.audienceGeography) === 'Specific countries or regions') requireText('audienceGeographyDetail', 'Audience countries or regions');
    ['audienceEvidence', 'lifeStages', 'discoveryChannels', 'decisionFactors'].forEach(key => requireOther(key));
    if (selectedOne(form.secondaryAudienceEnabled) === 'Yes') { requireText('secondaryAudienceDescription', 'Secondary audience description'); ['secondaryAudienceEvidence:Secondary audience evidence', 'secondaryAudienceGeography:Secondary audience geography', 'secondaryDiscoveryOpenness:Secondary audience openness'].forEach(item => { const [key, label] = item.split(':'); requireChoice(key, label); }); if (!Array.isArray(form.secondaryDecisionFactors) || form.secondaryDecisionFactors.length !== 3) add('secondaryDecisionFactors', 'Secondary audience priorities', 'Choose exactly three priorities in order.'); if (selectedOne(form.secondaryAudienceGeography) === 'Specific countries or regions') requireText('secondaryAudienceGeographyDetail', 'Secondary audience countries or regions'); ['secondaryAudienceEvidence', 'secondaryLifeStages', 'secondaryDiscoveryChannels', 'secondaryDecisionFactors'].forEach(key => requireOther(key)); }
  }
  if (step === 'need') { ['customerOutcome:Customer outcome', 'currentAlternative:Current alternative', 'primaryBarrier:Primary barrier'].forEach(item => { const [key, label] = item.split(':'); requireChoice(key, label); }); requireMany('needContext', 'Need context'); requireMany('barrierReducers', 'Barrier reducers'); requireOther('customerOutcome'); }
  if (step === 'value-success') {
    ['measuredAcquisitionChannel:Measured acquisition channel', 'paidMarketing:Paid marketing', 'irlOpportunity:Main gap or opportunity'].forEach(item => { const [key, label] = item.split(':'); requireChoice(key, label); }); requireMany('marketingChannels', 'Marketing channels'); const marketingCount = Array.isArray(form.marketingChannels) ? form.marketingChannels.length : 0; if (!Array.isArray(form.marketingChannelRank) || form.marketingChannelRank.length !== Math.min(3, marketingCount)) add('marketingChannelRank', 'Marketing channel ranking', 'Rank up to three selected marketing channels.'); requireMany('experientialHistory', 'Experiential marketing history'); const experiential = Array.isArray(form.experientialHistory) ? form.experientialHistory as string[] : []; if (experiential.some(value => value !== 'None of these')) { requireChoice('experientialEffectiveness', 'Experiential effectiveness'); requireChoice('experientialEvidence', 'Experiential evidence'); } requireText('primarySuccessResult', 'Most important result'); requireMany('successSignals', 'Reporting signals'); ['marketingChannels', 'experientialHistory', 'successSignals'].forEach(key => requireOther(key));
  }
  if (step === 'operations') { requireMany('brandSuggestedPlacements', 'Suggested placements'); requireMany('handlingRequirements', 'Handling requirements'); requireChoice('supplyCapability', 'Supply capability'); ['brandSuggestedPlacements', 'handlingRequirements'].forEach(key => requireOther(key)); }
  if (step === 'review' && form.profileConfirmed !== 'yes') add('profileConfirmed', 'Profile accuracy confirmation', 'Confirm that the Brand Profile is accurate before submitting.');
  return missing;
}

export function validateBrandStep(step: string, form: BrandForm): string[] {
  return validateBrandStepFields(step, form).map(error => error.label);
}

const reviewGroups = [
  { id: 'team', title: 'Your team', keys: ['firstName', 'lastName', 'email', 'mobile', 'jobTitle', 'onboardingRole', 'counterpartFirstName', 'counterpartLastName', 'counterpartEmail', 'counterpartJobTitle', 'additionalContacts'] },
  { id: 'brand', title: 'About your brand', keys: ['brandName', 'brandWebsite', 'partOfGroup', 'parentCompany', 'brandCountry', 'brandCity', 'activeMarkets', 'salesChannels', 'salesChannelsOther', 'brandPrimaryCategory', 'brandPrimaryCategoryOther', 'brandSecondaryCategories', 'brandSecondaryCategoriesOther', 'brandDescription', 'brandDifferentiator', 'brandValues', 'competitorLockouts', 'brandNeighbourhood'] },
  { id: 'product', title: 'Product or range', keys: ['productScope', 'productName', 'hasProductWebpage', 'productWebpage', 'productCategory', 'productCategoryOther', 'productSubcategory', 'productSubcategoryOther', 'priceCurrency', 'priceMin', 'priceMax', 'variants', 'sameProductAvailability', 'productMarkets', 'productChannels', 'productChannelsOther', 'internationalShipping', 'internationalShippingRegions', 'legalSafetyCompliance', 'additionalProducts'] },
  { id: 'audience', title: 'Priority audience', keys: ['audienceDescription', 'audienceGeography', 'audienceGeographyDetail', 'ageGroups', 'lifeStages', 'lifeStagesOther', 'spendingPower', 'travelPurpose', 'discoveryChannels', 'discoveryChannelsOther', 'decisionFactors', 'decisionFactorsOther', 'discoveryOpenness', 'audienceExclusions', 'audienceEvidence', 'audienceEvidenceOther', 'audienceNotes', 'secondaryAudienceDescription', 'secondaryAudienceGeography', 'secondaryAudienceGeographyDetail', 'secondaryAgeGroups', 'secondaryLifeStages', 'secondaryLifeStagesOther', 'secondarySpendingPower', 'secondaryTravelPurpose', 'secondaryDiscoveryChannels', 'secondaryDiscoveryChannelsOther', 'secondaryDecisionFactors', 'secondaryDecisionFactorsOther', 'secondaryDiscoveryOpenness', 'secondaryAudienceExclusions', 'secondaryAudienceEvidence', 'secondaryAudienceEvidenceOther', 'secondaryAudienceNotes'] },
  { id: 'need', title: 'Customer decision', keys: ['customerOutcome', 'customerOutcomeOther', 'customerOutcomeDetail', 'needContext', 'currentAlternative', 'alternativeExplanation', 'primaryBarrier', 'barrierReducers', 'decisionNotes'] },
  { id: 'value-success', title: 'IRL opportunity and success', keys: ['marketingChannels', 'marketingChannelsOther', 'marketingChannelRank', 'measuredAcquisitionChannel', 'paidMarketing', 'experientialHistory', 'experientialHistoryOther', 'experientialEffectiveness', 'experientialEvidence', 'irlOpportunity', 'primarySuccessResult', 'successSignals', 'successSignalsOther'] },
  { id: 'operations', title: 'Making it work', keys: ['brandSuggestedPlacements', 'brandSuggestedPlacementsOther', 'handlingRequirements', 'handlingRequirementsOther', 'supplyCapability', 'initialSupplyLimit'] },
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
    <div className="review-intro"><h3>Review your Brand Profile</h3><p>Your answers are grouped into the profile IRL will review. Use Edit section to make a change without losing your progress.</p></div>
    {populatedGroups.length === 0 && additionalEntries.length === 0 ? <p>No answers have been added yet.</p> : <>
      {populatedGroups.map(group => <section className="review-section" key={group.id}>
        <header><h3>{group.title}</h3>{goToStep && <button type="button" onClick={() => goToStep(group.id)}>Edit section</button>}</header>
        <div className="review-answers">{group.entries.map(([key, value]) => <div className="review-answer" key={key}><span>{fieldLabels[key] || key.replace(/([A-Z])/g, ' $1')}</span><strong>{displayReviewValue(value)}</strong></div>)}</div>
      </section>)}
      {additionalEntries.length > 0 && <section className="review-section"><header><h3>Additional information</h3></header><div className="review-answers">{additionalEntries.map(([key, value]) => <div className="review-answer" key={key}><span>{fieldLabels[key] || key.replace(/([A-Z])/g, ' $1')}</span><strong>{displayReviewValue(value)}</strong></div>)}</div></section>}
    </>}
    <div className="review-final"><TextArea label="Is there anything else IRL should know?" name="finalNotes" form={form} update={update} optional /><label className="confirm"><input type="checkbox" checked={form.profileConfirmed === 'yes'} onChange={(event) => update('profileConfirmed', event.target.checked ? 'yes' : '')} /> I confirm that this Brand Profile is accurate to the best of my knowledge.</label><FieldError name="profileConfirmed" /><p className="privacy-note">IRL uses this information to build and maintain your Brand Profile, identify suitable property matches and support future partnership conversations. Contact IRL if information needs to be corrected.</p></div>
  </div>;
}
