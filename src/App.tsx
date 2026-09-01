import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, Check, Circle, Save, Sparkles, Store } from 'lucide-react';
import BrandOnboardingStep from './BrandOnboarding';

type Flow = 'brand' | 'operator';

type Step = {
  id: string;
  title: string;
  eyebrow: string;
  intro: string;
};

const brandSteps: Step[] = [
  { id: 'team', title: 'Your team', eyebrow: 'Step 1', intro: 'Tell us who should be involved as we build your Brand Profile. This helps IRL keep the right people informed and create the most accurate property matches for your brand.' },
  { id: 'brand', title: 'About your brand', eyebrow: 'Step 2', intro: 'Give us a clear picture of your brand so we can identify properties, guests and environments that genuinely align with it.' },
  { id: 'product', title: 'The product or range', eyebrow: 'Step 3', intro: 'Tell us which product or range you would like IRL to consider first. This gives us a clear starting point for matching.' },
  { id: 'audience', title: 'Who you want to reach', eyebrow: 'Step 4', intro: 'Help us understand the people for whom this product is most relevant. Complete the core questions, then add more detail only where it improves the match.' },
  { id: 'need', title: 'Customer need and barrier', eyebrow: 'Step 5', intro: 'Understanding the need and the barrier helps IRL design a more relevant real-life experience.' },
  { id: 'value', title: 'How IRL should add value', eyebrow: 'Step 6', intro: 'Give us a light view of what is already working and the main gap a real-life product experience should help address.' },
  { id: 'operations', title: 'Making it work', eyebrow: 'Step 7', intro: 'Tell us only about the practical requirements that could affect whether the product can operate successfully in a hospitality property.' },
  { id: 'success', title: 'What success looks like', eyebrow: 'Step 8', intro: 'Keep this focused on the evidence that would make the partnership useful, not a long list of vanity metrics.' },
  { id: 'requirements', title: 'Brand requirements', eyebrow: 'Step 9', intro: 'Share only the requirements IRL must know to protect the brand, the guest and the property.' },
  { id: 'review', title: 'Review and submit', eyebrow: 'Step 10', intro: 'Review your Brand Profile, make any final edits and confirm that it is accurate before sending it to IRL.' },
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
  const [flow, setFlow] = useState<Flow | null>(() => (localStorage.getItem('irl-flow') as Flow | null));
  const [stepIndex, setStepIndex] = useState(0);
  const [savedAt, setSavedAt] = useState<string>('');
  const [form, setForm] = useState<Record<string, string | string[]>>(() => {
    const saved = localStorage.getItem('irl-draft');
    return saved ? JSON.parse(saved) : {};
  });

  const steps = flow === 'operator' ? operatorSteps : brandSteps;
  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);
  const current = steps[stepIndex];

  useEffect(() => {
    if (!flow) return;
    const timer = window.setTimeout(() => {
      localStorage.setItem('irl-draft', JSON.stringify(form));
      localStorage.setItem('irl-flow', flow);
      setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [form, flow]);

  const completed = useMemo(() => new Set(steps.slice(0, stepIndex).map((step) => step.id)), [steps, stepIndex]);

  const update = (key: string, value: string | string[]) => setForm((currentForm) => ({ ...currentForm, [key]: value }));
  const toggle = (key: string, value: string, max = 99) => {
    const existing = Array.isArray(form[key]) ? (form[key] as string[]) : [];
    if (existing.includes(value)) update(key, existing.filter((item) => item !== value));
    else if (existing.length < max) update(key, [...existing, value]);
  };

  if (!flow) {
    return (
      <main className="welcome-shell">
        <section className="welcome-card">
          <div className="brand-mark">IRL</div>
          <p className="eyebrow">IRL Network onboarding</p>
          <h1>Build a profile that makes better real-life matches possible.</h1>
          <p className="lede">Choose the journey that applies to you. Your progress is saved automatically, so you can return at any time.</p>
          <div className="flow-grid">
            <button className="flow-card" onClick={() => { setFlow('brand'); setStepIndex(0); }}>
              <Store size={28} />
              <span><strong>I represent a brand</strong><small>Tell IRL about your brand, products, audience and objectives.</small></span>
              <ArrowRight size={20} />
            </button>
            <button className="flow-card" onClick={() => { setFlow('operator'); setStepIndex(0); }}>
              <Building2 size={28} />
              <span><strong>I operate a property</strong><small>Tell IRL about your guests, spaces, systems and operational readiness.</small></span>
              <ArrowRight size={20} />
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-lockup"><div className="brand-mark small">IRL</div><span>NETWORK</span></div>
          <p className="profile-label">{flow === 'brand' ? 'Brand profile' : 'Operator profile'}</p>
          <nav className="step-list" aria-label="Onboarding progress">
            {steps.map((step, index) => (
              <button key={step.id} className={index === stepIndex ? 'active' : ''} onClick={() => setStepIndex(index)}>
                <span className="step-icon">{completed.has(step.id) ? <Check size={14} /> : index === stepIndex ? <Circle size={12} fill="currentColor" /> : index + 1}</span>
                <span>{step.title}</span>
              </button>
            ))}
          </nav>
        </div>
        <button className="switch-link" onClick={() => { setFlow(null); setStepIndex(0); }}>Switch profile type</button>
      </aside>

      <main className="form-shell">
        <header className="mobile-header">
          <div className="brand-lockup"><div className="brand-mark small">IRL</div><span>NETWORK</span></div>
          <span>{stepIndex + 1} of {steps.length}</span>
        </header>
        <div className="progress-wrap"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
        <div className="form-content">
          <div className="save-state"><Save size={14} /> {savedAt ? `Saved at ${savedAt}` : 'Autosave on'}</div>
          <p className="eyebrow">{current.eyebrow}</p>
          <h1>{current.title}</h1>
          <p className="intro">{current.intro}</p>

          <section className="question-card">
            {flow === 'brand' ? (
              <BrandOnboardingStep step={current.id} form={form} update={update} toggle={toggle} />
            ) : (
              <OperatorStep step={current.id} form={form} update={update} toggle={toggle} />
            )}
          </section>

          <footer className="form-actions">
            <button className="button secondary" disabled={stepIndex === 0} onClick={() => setStepIndex((index) => Math.max(0, index - 1))}><ArrowLeft size={18} /> Back</button>
            <button className="button primary" onClick={() => setStepIndex((index) => Math.min(steps.length - 1, index + 1))}>{stepIndex === steps.length - 1 ? 'Save profile' : 'Save and continue'} <ArrowRight size={18} /></button>
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
