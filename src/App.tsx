import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, Check, Circle, Save, Sparkles, Store } from 'lucide-react';
import BrandOnboardingStep, { type BrandForm, validateBrandStepFields } from './BrandOnboarding';
import { clearOnboarding, initialFlow, readDraft, saveOnboarding, type Draft, type DraftValue } from './onboarding-persistence';

type Flow = 'brand' | 'operator';

type Step = {
  id: string;
  title: string;
  eyebrow: string;
  intro: string;
};

const brandSteps: Step[] = [
  { id: 'team', title: 'You and your brand', eyebrow: 'Step 1', intro: 'Give IRL the essentials we need to create your initial Brand Profile. This should take around three minutes.' },
  { id: 'product', title: 'Your starting product', eyebrow: 'Step 2', intro: 'Choose one product or range as the starting point. You can add more detail later as your IRL profile grows.' },
  { id: 'need', title: 'Audience and opportunity', eyebrow: 'Step 3', intro: 'Help us understand who the product is for, what stands in their way and what a useful IRL partnership should achieve.' },
  { id: 'review', title: 'Review and submit', eyebrow: 'Step 4', intro: 'Check the essentials, make any final edits and send your initial Brand Profile to IRL.' },
];

const operatorSteps: Step[] = [
  { id: 'organisation', title: 'Your organisation', eyebrow: 'Step 1', intro: 'Tell us who operates the property and who IRL should work with.' },
  { id: 'property', title: 'Your property', eyebrow: 'Step 2', intro: 'Give us the essential facts about the location and what guests can book.' },
  { id: 'guests', title: 'Your guests', eyebrow: 'Step 3', intro: 'Help us understand who stays with you and what matters during their visit.' },
  { id: 'spaces', title: 'Spaces and experiences', eyebrow: 'Step 4', intro: 'Show us where products could naturally live within the guest experience.' },
  { id: 'operations', title: 'How it works', eyebrow: 'Step 5', intro: 'Tell us how products, placement, evidence and replenishment could work operationally.' },
  { id: 'data', title: 'Data and systems', eyebrow: 'Step 6', intro: 'Tell us what booking and stay data is available, even if you need help finding it.' },
  { id: 'review', title: 'Review and submit', eyebrow: 'Step 7', intro: 'Check the profile before sending it to IRL.' },
];

function App() {
  const [flow, setFlow] = useState<Flow | null>(initialFlow);
  const [stepIndex, setStepIndex] = useState(0);
  const [savedAt, setSavedAt] = useState<string>('');
  const [form, setForm] = useState<Draft>(() => {
    const selectedFlow = initialFlow();
    const draft = readDraft(selectedFlow);
    const linkedBrand = new URLSearchParams(window.location.search).get('brand')?.trim();
    return selectedFlow === 'brand' && linkedBrand && !draft.brandName ? { ...draft, brandName: linkedBrand } : draft;
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const steps = flow === 'operator' ? operatorSteps : brandSteps;
  const progress = Math.min(95, Math.round(((stepIndex + 1) / steps.length) * 100));
  const current = steps[stepIndex];

  useEffect(() => {
    if (!flow || submitted || submitting) return;
    localStorage.setItem('irl-flow', flow);
    localStorage.setItem(`irl-draft-${flow}`, JSON.stringify(form));
    let active = true;
    const timer = window.setTimeout(() => {
      if (!String(form[flow === 'brand' ? 'brandName' : 'operatorName'] || '').trim()) { setSavedAt('Saved on this device'); return; }
      setSavedAt('Saving online…');
      void saveOnboarding(form, flow, current.id, progress).then(result => {
        if (!active) return;
        setSaveError('');
        if (result.status === 'submitted') setSubmitted(true);
        else setSavedAt(`Saved online at ${new Date(result.saved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      }).catch(error => { if (active) { setSavedAt('Saved on this device'); setSaveError(error.message); } });
    }, 650);
    return () => { active = false; window.clearTimeout(timer); };
  }, [form, flow, submitted, submitting, current.id, progress]);

  function chooseFlow(next: Flow) { window.history.replaceState(null, '', `/onboarding?flow=${next}`); setForm(readDraft(next)); setFlow(next); setStepIndex(0); setSubmitted(false); setSaveError(''); setValidationError(''); setFieldErrors({}); setSavedAt(''); }
  async function submitProfile() {
    if (!flow || submitting) return;
    if (flow === 'brand') {
      const sections = brandSteps.map((step, index) => ({ index, errors: validateBrandStepFields(step.id, form as BrandForm) }));
      const firstInvalid = sections.find(section => section.errors.length);
      if (firstInvalid) {
        setStepIndex(firstInvalid.index);
        setFieldErrors(Object.fromEntries(firstInvalid.errors.map(error => [error.key, error.message])));
        setValidationError('Please correct the highlighted fields before submitting your profile.');
        return;
      }
    }
    setSubmitting(true); setSaveError('');
    try {
      const result = await saveOnboarding(form, flow, 'review', 100, true);
      if (result.status !== 'submitted') throw new Error('The profile was saved but not submitted. Please try again.');
      clearOnboarding(flow);
      setSubmitted(true);
    } catch (error) { setSaveError((error as Error).message); }
    finally { setSubmitting(false); }
  }

  const completed = useMemo(() => new Set(steps.slice(0, stepIndex).map((step) => step.id)), [steps, stepIndex]);

  const update = (key: string, value: DraftValue) => { setValidationError(''); setFieldErrors(current => { const next = { ...current }; delete next[key]; return next; }); setForm((currentForm) => ({ ...currentForm, [key]: value })); };
  const toggle = (key: string, value: string, max = 99) => {
    const currentValue = form[key];
    const existing = Array.isArray(currentValue) && currentValue.every(item => typeof item === 'string') ? currentValue as string[] : [];
    const exclusive = ['None', 'None of these', 'Not sure', 'Not time-specific', 'Age is not a priority', 'Life stage is not a priority', 'Geography is not a priority'];
    let next = existing;
    if (existing.includes(value)) next = existing.filter((item) => item !== value);
    else if (max === 1) next = [value];
    else if (max > 1 && exclusive.includes(value)) next = [value];
    else if (existing.length < max) next = [...existing.filter(item => !exclusive.includes(item)), value];
    update(key, next);
    if (existing.includes('Other') && !next.includes('Other')) update(`${key}Other`, '');
    if (key === 'productScope' && !['A product range', 'Several products'].includes(value)) update('priceMax', '');
    if (key === 'marketingChannels') {
      const rank = Array.isArray(form.marketingChannelRank) ? form.marketingChannelRank as string[] : [];
      const measured = String((form.measuredAcquisitionChannel as string[] | undefined)?.[0] || '');
      setForm(currentForm => ({ ...currentForm, [key]: next, marketingChannelRank: rank.filter(item => next.includes(item)), measuredAcquisitionChannel: measured === "We don't currently know" || next.includes(measured) ? form.measuredAcquisitionChannel || [] : [] }));
    }
  };
  function continueProfile() {
    if (flow === 'brand') {
      const missing = validateBrandStepFields(current.id, form as BrandForm);
      if (missing.length) { setFieldErrors(Object.fromEntries(missing.map(error => [error.key, error.message]))); setValidationError('Please correct the highlighted fields to continue.'); return; }
    }
    setValidationError(''); setFieldErrors({});
    setStepIndex(index => Math.min(steps.length - 1, index + 1));
  }
  function startAnotherProfile() {
    if (!flow) return;
    clearOnboarding(flow); setForm({}); setStepIndex(0); setSubmitted(false); setSavedAt(''); setSaveError(''); setValidationError(''); setFieldErrors({});
  }

  if (!flow) {
    return (
      <main className="welcome-shell">
        <section className="welcome-card">
          <div className="brand-mark">IRL</div>
          <p className="eyebrow">IRL Network onboarding</p>
          <h1>Build a profile that makes better real-life matches possible.</h1>
          <p className="lede">Choose the journey that applies to you. Your progress is saved automatically, so you can return at any time.</p>
          <div className="flow-grid">
            <button className="flow-card" onClick={() => chooseFlow('brand')}>
              <Store size={28} />
              <span><strong>I represent a brand</strong><small>Tell IRL about your brand, products, audience and objectives.</small></span>
              <ArrowRight size={20} />
            </button>
            <button className="flow-card" onClick={() => chooseFlow('operator')}>
              <Building2 size={28} />
              <span><strong>I operate a property</strong><small>Tell IRL about your guests, spaces, systems and operational readiness.</small></span>
              <ArrowRight size={20} />
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (submitted && flow === 'brand') return <main className="welcome-shell"><section className="welcome-card submission-summary"><div className="brand-mark">IRL</div><p className="eyebrow">Submission received</p><h1>Thanks — {String(form.brandName || 'your brand')} is now with IRL.</h1><p>Your initial Brand Profile has been submitted successfully. The IRL team will review it and contact you about the next steps.</p>{form.email && <p className="submission-contact">Contact email <strong>{String(form.email)}</strong></p>}<div className="submission-actions"><a className="irl-button irl-button--primary" href="/">Back to IRL</a></div></section></main>;
  if (submitted) return <main className="welcome-shell"><section className="welcome-card"><div className="brand-mark">IRL</div><p className="eyebrow">Submission received</p><h1>Profile successfully submitted</h1><p>Your operator profile is safely stored and ready for the IRL team to review. You can now close this page.</p><div className="submission-actions"><a className="irl-button irl-button--primary" href="/">Back to IRL</a><button className="irl-button irl-button--secondary" onClick={startAnotherProfile}>Start another operator profile</button></div></section></main>;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-lockup"><div className="brand-mark small">IRL</div><span>NETWORK</span></div>
          <p className="profile-label">{flow === 'brand' ? 'Brand profile' : 'Operator profile'}</p>
          <nav className="step-list" aria-label="Onboarding progress">
            {steps.map((step, index) => (
              <button key={step.id} disabled={submitting} className={index === stepIndex ? 'active' : ''} onClick={() => { setValidationError(''); setFieldErrors({}); setStepIndex(index); }}>
                <span className="step-icon">{completed.has(step.id) ? <Check size={14} /> : index === stepIndex ? <Circle size={12} fill="currentColor" /> : index + 1}</span>
                <span>{step.title}</span>
              </button>
            ))}
          </nav>
        </div>
        <button className="switch-link" disabled={submitting} onClick={() => { setFlow(null); setStepIndex(0); }}>Switch profile type</button>
      </aside>

      <main className="form-shell">
        <header className="mobile-header">
          <div className="brand-lockup"><div className="brand-mark small">IRL</div><span>NETWORK</span></div>
          <span>{stepIndex + 1} of {steps.length}</span>
        </header>
        <div className="progress-wrap"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
        <div className="form-content">
          <div className="save-state" role="status"><Save size={14} /> {submitting ? 'Submitting profile…' : savedAt || 'Autosave on'}</div>
          {saveError && <p role="alert">{saveError} Your draft is still saved on this device.</p>}
          {validationError && <p className="validation-error" role="alert">{validationError}</p>}
          <p className="eyebrow">{current.eyebrow}</p>
          <h1>{current.title}</h1>
          <p className="intro">{current.intro}</p>

          <fieldset className="question-card onboarding-fields" disabled={submitting}>
            {flow === 'brand' ? (
              <BrandOnboardingStep step={current.id} form={form as BrandForm} update={update} toggle={toggle} errors={fieldErrors} goToStep={(step) => { const index = brandSteps.findIndex(item => item.id === step); if (index >= 0) { setValidationError(''); setFieldErrors({}); setStepIndex(index); } }} />
            ) : (
              <OperatorStep step={current.id} form={form as Record<string, string | string[]>} update={update} toggle={toggle} />
            )}
          </fieldset>

          <footer className="form-actions">
            <button className="button secondary" disabled={submitting || stepIndex === 0} onClick={() => { setValidationError(''); setFieldErrors({}); setStepIndex((index) => Math.max(0, index - 1)); }}><ArrowLeft size={18} /> Back</button>
            <button className="button primary" disabled={submitting} onClick={() => { if (stepIndex === steps.length - 1) void submitProfile(); else continueProfile(); }}>{submitting ? 'Submitting…' : stepIndex === steps.length - 1 ? 'Submit profile' : 'Save and continue'} <ArrowRight size={18} /></button>
          </footer>
        </div>
      </main>
    </div>
  );
}

type StepProps = {
  step: string;
  form: Record<string, string | string[]>;
  update: (key: string, value: string | string[]) => void;
  toggle: (key: string, value: string, max?: number) => void;
};

function Field({ label, name, form, update, type = 'text', optional = false }: { label: string; name: string; form: StepProps['form']; update: StepProps['update']; type?: string; optional?: boolean }) {
  return <label className="field"><span>{label} {optional && <em>Optional</em>}</span><input type={type} value={(form[name] as string) || ''} onChange={(event) => update(name, event.target.value)} /></label>;
}

function ChoiceGrid({ label, name, options, form, toggle, max }: { label: string; name: string; options: string[]; form: StepProps['form']; toggle: StepProps['toggle']; max?: number }) {
  const selected = Array.isArray(form[name]) ? form[name] as string[] : [];
  return <fieldset className="field"><legend>{label}{max && <small>{selected.length} of {max} selected</small>}</legend><div className="choice-grid">{options.map((option) => <button type="button" key={option} className={selected.includes(option) ? 'selected' : ''} onClick={() => toggle(name, option, max)}>{selected.includes(option) && <Check size={15} />}{option}</button>)}</div></fieldset>;
}

function OperatorStep({ step, form, update, toggle }: StepProps) {
  if (step === 'organisation') return <><Field label="Operator or group name" name="operatorName" form={form} update={update} /><div className="field-row"><Field label="Primary contact first name" name="operatorFirstName" form={form} update={update} /><Field label="Last name" name="operatorLastName" form={form} update={update} /></div><Field label="Work email" name="operatorEmail" type="email" form={form} update={update} /><Field label="Role" name="operatorRole" form={form} update={update} /><button className="text-action">+ Add another contact</button></>;
  if (step === 'property') return <><Field label="Property name" name="propertyName" form={form} update={update} /><div className="field-row"><Field label="City" name="propertyCity" form={form} update={update} /><Field label="Country" name="propertyCountry" form={form} update={update} /></div><ChoiceGrid label="What type of property is this?" name="propertyType" options={['Hotel', 'Hostel', 'Guesthouse', 'Boutique hotel', 'Serviced apartments', 'Self-catering', 'Hybrid hospitality']} form={form} toggle={toggle} max={1} /><div className="field-row"><Field label="Total rooms" name="totalRooms" type="number" form={form} update={update} /><Field label="Total units" name="totalUnits" type="number" form={form} update={update} optional /></div><Field label="What makes this property distinctive?" name="propertyDescription" form={form} update={update} /></>;
  if (step === 'guests') return <><ChoiceGrid label="Who typically stays with you?" name="guestTypes" options={['Local leisure guests', 'International travellers', 'Digital nomads', 'Backpackers', 'Families', 'Groups', 'Long-stay guests', 'Business travellers']} form={form} toggle={toggle} /><ChoiceGrid label="What do guests care about most?" name="guestPriorities" options={['Comfort', 'Price or value', 'Location', 'Safety', 'Cleanliness', 'Design', 'Quiet or privacy', 'Work-friendly spaces', 'Local experiences', 'Premium feel']} form={form} toggle={toggle} max={5} /><Field label="What issue appears most often in reviews?" name="reviewIssue" form={form} update={update} optional /><Field label="Describe peak and quiet periods" name="seasonality" form={form} update={update} optional /></>;
  if (step === 'spaces') return <><ChoiceGrid label="Which spaces are available to guests?" name="spaces" options={['Guest rooms', 'Bathrooms', 'Reception', 'Lounge', 'Restaurant', 'Kitchen', 'Coworking', 'Pool', 'Gym', 'Garden', 'Rooftop', 'Event space']} form={form} toggle={toggle} /><ChoiceGrid label="Which product categories could improve the guest experience?" name="categoryOpportunities" options={['Coffee and tea', 'Bath and body', 'Sleep and recovery', 'Snacks and drinks', 'Wellness', 'Travel essentials', 'Work-friendly technology', 'Kitchen basics', 'Cleaning products', 'Local experiences']} form={form} toggle={toggle} /><Field label="Are there any categories that are not appropriate?" name="categoryRestrictions" form={form} update={update} optional /></>;
  if (step === 'operations') return <><Field label="Who receives product deliveries?" name="deliveryOwner" form={form} update={update} /><Field label="Who places products after room turnover?" name="placementOwner" form={form} update={update} /><Field label="Who captures fulfilment photos?" name="evidenceOwner" form={form} update={update} /><ChoiceGrid label="How confident are you that the team can complete a small task after every checkout?" name="operationsConfidence" options={['1 — Not confident', '2', '3', '4', '5 — Very confident']} form={form} toggle={toggle} max={1} /></>;
  if (step === 'data') return <><ChoiceGrid label="Which booking platforms do you use?" name="bookingPlatforms" options={['Airbnb', 'Booking.com', 'Expedia', 'Hostelworld', 'LekkeSlaap', 'Direct website', 'Other']} form={form} toggle={toggle} /><Field label="Which PMS or management system do you use?" name="pms" form={form} update={update} optional /><ChoiceGrid label="Can you export a monthly stay or booking report?" name="reportingCapability" options={['Yes, easily', 'Yes, with help', 'Not sure', 'No']} form={form} toggle={toggle} max={1} /><div className="upload-placeholder"><Sparkles size={20} /><div><strong>Stay history upload</strong><p>File upload will be connected in the next build phase.</p></div></div></>;
  return <Review form={form} />;
}

function Review({ form }: { form: Record<string, string | string[]> }) {
  const entries = Object.entries(form).filter(([, value]) => Array.isArray(value) ? value.length : Boolean(value));
  return <div className="review-list">{entries.length === 0 ? <p>No answers have been added yet.</p> : entries.map(([key, value]) => <div key={key}><span>{key.replace(/([A-Z])/g, ' $1')}</span><strong>{Array.isArray(value) ? value.join(', ') : value}</strong></div>)}<label className="confirm"><input type="checkbox" /> I confirm that this profile is accurate to the best of my knowledge.</label></div>;
}

export default App;
