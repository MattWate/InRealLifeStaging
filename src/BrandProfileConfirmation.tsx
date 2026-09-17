import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import './brand-profile-confirmation.css';

type ResponseStatus = 'untouched' | 'confirmed' | 'corrected' | 'not_applicable' | 'answered';
type ProfileResponse = {
  id?: string; response_id?: string; research_claim_id?: string | null;
  entity_type: 'brand' | 'product' | 'audience'; product_id?: string | null;
  field_key: string; response_status: ResponseStatus; original_value?: unknown; submitted_value?: unknown;
};
type Profile = {
  invitation: { recipient_name?: string; status: string; expires_at: string };
  brand: { name: string }; products: Array<{ id: string; name: string }>;
  responses: ProfileResponse[];
};

const OPTIONS: Record<string, Array<[string, string]>> = {
  'audience.evidence_source_code': [['customer_or_sales_data','Customer or sales data'],['surveys_or_customer_feedback','Surveys or customer feedback'],['social_media_analytics','Social media analytics'],['industry_research','Industry research'],['founders_direct_experience',"Founder's direct experience"],['assumption_not_yet_tested','An assumption not yet tested'],['other','Other']],
  'audience.geography_code': [['primarily_south_african','Primarily South African'],['primarily_international','Primarily international'],['both_local_and_international','Local and international'],['specific_countries_or_regions','Specific countries or regions'],['geography_not_a_priority','Geography is not a priority']],
  'audience.age_group_codes': [['18_24','18–24'],['25_34','25–34'],['35_44','35–44'],['45_54','45–54'],['55_64','55–64'],['65_plus','65+']],
  'audience.life_stage_codes': [['single_or_young_professional','Single or young professional'],['couple_no_children','Couple without children'],['parents_young_children','Parents with young children'],['parents_older_children_or_teens','Parents with older children or teens'],['multigenerational_household','Multigenerational household'],['empty_nesters_or_older_adults','Empty nesters or older adults'],['students','Students']],
  'audience.lifestyle_codes': [['wellness_and_health_conscious','Wellness and health conscious'],['adventure_and_exploration','Adventure and exploration'],['family_and_togetherness','Family and togetherness'],['social_connection_and_community','Social connection and community'],['comfort_and_relaxation','Comfort and relaxation'],['sustainability_and_conscious_living','Sustainability and conscious living'],['design_culture_and_discovery','Design, culture and discovery']],
  'brand.sales_channel_codes': [['brand_website','Brand website'],['brand_owned_stores','Brand-owned stores'],['major_retail','Major retail'],['independent_retail','Independent retail'],['online_marketplaces','Online marketplaces'],['hospitality','Hospitality'],['professional_or_trade_channels','Professional or trade channels'],['subscription','Subscription'],['other','Other']],
  'brand.marketing_channel_codes': [['social_media_organic','Organic social media'],['paid_social_ads','Paid social ads'],['google_or_search_ads','Google or search ads'],['influencer_or_creator_partnerships','Influencer or creator partnerships'],['email_marketing','Email marketing'],['pr_or_media_coverage','PR or media coverage'],['retail_or_in_store_presence','Retail or in-store presence'],['word_of_mouth','Word of mouth'],['events_or_activations','Events or activations'],['own_website','Own website'],['other','Other']],
  'brand.measured_acquisition_channel_code': [['social_media_organic','Organic social media'],['paid_social_ads','Paid social ads'],['google_or_search_ads','Google or search ads'],['influencer_or_creator_partnerships','Influencer or creator partnerships'],['email_marketing','Email marketing'],['pr_or_media_coverage','PR or media coverage'],['retail_or_in_store_presence','Retail or in-store presence'],['word_of_mouth','Word of mouth'],['events_or_activations','Events or activations'],['own_website','Own website'],['other','Other'],['we_dont_currently_know',"We don't currently know"]],
};
const HUMAN: Record<string, string> = {
  'audience.description':'Who is your priority customer?', 'audience.evidence_source_code':'What is this customer profile based on?',
  'audience.geography_code':'Where are they based?', 'audience.geography_detail':'Any specific countries or regions?',
  'audience.age_group_codes':'Which age groups matter most?', 'audience.life_stage_codes':'Which life stages best describe them?',
  'audience.lifestyle_codes':'Which lifestyle signals fit best?', 'brand.sales_channel_codes':'Where can customers buy from you?',
  'brand.marketing_channel_codes':'Which marketing channels do you use?', 'brand.marketing_channel_rank_codes':'Which three channels matter most?',
  'brand.measured_acquisition_channel_code':'Which channel drives the most measurable acquisition?',
};
const REQUIRED = new Set(['audience.description','audience.evidence_source_code','audience.geography_code','audience.age_group_codes','audience.life_stage_codes','audience.lifestyle_codes','brand.sales_channel_codes']);

export default function BrandProfileConfirmation() {
  const { token = '' } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [responses, setResponses] = useState<ProfileResponse[]>([]);
  const [edits, setEdits] = useState<Record<string,string>>({});
  const [direct, setDirect] = useState<Record<string, unknown>>({});
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/.netlify/functions/brand-profile-invitation?token=${encodeURIComponent(token)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body as Profile; })
      .then(body => {
        setProfile(body); setResponses(body.responses.filter(row => row.research_claim_id).map(row => ({ ...row, response_id: row.id })));
        setEdits(Object.fromEntries(body.responses.map(row => [row.id || row.field_key, editValue(row.submitted_value ?? row.original_value)])));
        const saved = Object.fromEntries(body.responses.filter(row => !row.research_claim_id && row.response_status === 'answered').map(row => [row.field_key, row.submitted_value]));
        setDirect(saved); setSubmitted(body.invitation.status === 'submitted');
      }).catch(error => { if (!controller.signal.aborted) setMessage(error.message); });
    return () => controller.abort();
  }, [token]);

  const prepared = responses.filter(row => row.research_claim_id);
  const reviewed = prepared.filter(row => row.response_status !== 'untouched').length;
  const completeDirect = [...REQUIRED].every(key => { const value = direct[key]; return value != null && value !== '' && (!Array.isArray(value) || value.length > 0); });
  const directResponses = useMemo(() => Object.entries(direct).map(([field_key, submitted_value]) => ({
    entity_type: field_key.startsWith('audience.') ? 'audience' as const : 'brand' as const,
    product_id: null, field_key, response_status: 'answered' as const, submitted_value,
  })), [direct]);

  function decide(row: ProfileResponse, status: ResponseStatus) {
    setResponses(current => current.map(item => item.response_id === row.response_id ? {
      ...item, response_status: status,
      submitted_value: status === 'confirmed' ? row.original_value : status === 'corrected' ? parseEdit(edits[row.response_id || row.field_key], row.original_value) : null,
    } : item));
  }
  function updateList(key: string, code: string, checked: boolean, max?: number) {
    setDirect(current => {
      const list = Array.isArray(current[key]) ? current[key] as string[] : [];
      if (checked && max && list.length >= max) return current;
      return { ...current, [key]: checked ? [...list, code] : list.filter(value => value !== code) };
    });
  }
  async function persist(action: 'save' | 'submit') {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/.netlify/functions/brand-profile-invitation?token=${encodeURIComponent(token)}`, {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type':'application/json' },
        body: JSON.stringify({ action, responses: [...responses.map(({ id: _id, research_claim_id: _claim, original_value: _original, ...row }) => row), ...directResponses] }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.details?.map((item: { message:string }) => item.message).join(' ') || body.error);
      if (action === 'submit') setSubmitted(true); else setMessage('Your progress has been saved.');
      return true;
    } catch (error) { setMessage((error as Error).message); return false; }
    finally { setBusy(false); }
  }
  async function next() {
    if (step === 0 && reviewed !== prepared.length) { setMessage('Please review every prepared field before continuing.'); return; }
    if (step === 1 && !completeDirect) { setMessage('Please complete the required customer details before continuing.'); return; }
    if (await persist('save')) { setStep(value => value + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }

  if (message && !profile) return <main className="confirm-shell"><div className="confirm-card"><a className="confirm-logo" href="/">IRL</a><h1>We can’t open this profile</h1><p role="alert">{message}</p></div></main>;
  if (!profile) return <main className="confirm-shell"><p role="status">Preparing your brand profile…</p></main>;
  if (submitted) return <main className="confirm-shell"><div className="confirm-card confirm-success"><a className="confirm-logo" href="/">IRL</a><p className="irl-eyebrow">Profile received</p><h1>Thank you, {profile.invitation.recipient_name || profile.brand.name}.</h1><p>Your brand profile is now ready for IRL to use in the opportunity-matching process. We’ll be in touch with the next step.</p></div></main>;

  return <main className="confirm-shell"><div className="confirm-wrap">
    <header className="confirm-header"><a className="confirm-logo" href="/">IRL</a><div><span>Step {step + 1} of 3</span><progress max="3" value={step + 1} /></div></header>
    <section className="confirm-intro"><p className="irl-eyebrow">Prepared profile</p><h1>{step === 0 ? `Let’s check what we know about ${profile.brand.name}.` : step === 1 ? 'Tell us who you want to reach.' : 'Review and send your profile.'}</h1><p>{step === 0 ? 'We have prepared a starting profile from public research. Confirm what is right and correct anything that is not.' : step === 1 ? 'These answers give IRL the customer context needed to find relevant operator opportunities.' : 'Your confirmed information and customer profile will become your initial IRL brand overview.'}</p></section>

    {step === 0 && <section className="confirm-fields">{prepared.map(row => <article className={`confirm-field confirm-field--${row.response_status}`} key={row.response_id}>
      <small>{human(row.field_key)}</small><h2>{display(row.original_value)}</h2>
      <div className="confirm-actions"><button type="button" className={row.response_status === 'confirmed' ? 'active' : ''} onClick={() => decide(row,'confirmed')}>Looks right</button><button type="button" className={row.response_status === 'corrected' ? 'active' : ''} onClick={() => decide(row,'corrected')}>Edit</button><button type="button" className={row.response_status === 'not_applicable' ? 'active' : ''} onClick={() => decide(row,'not_applicable')}>Doesn’t apply</button></div>
      {row.response_status === 'corrected' && <label>Correct value<textarea value={edits[row.response_id || '']} onChange={event => { setEdits(current => ({ ...current, [row.response_id || '']:event.target.value })); setResponses(current => current.map(item => item.response_id === row.response_id ? { ...item, submitted_value:parseEdit(event.target.value,row.original_value) } : item)); }} /></label>}
    </article>)}</section>}

    {step === 1 && <section className="confirm-questionnaire">
      <TextQuestion field="audience.description" value={direct['audience.description']} onChange={value => setDirect(current => ({ ...current, 'audience.description':value }))} />
      <ChoiceQuestion field="audience.evidence_source_code" value={direct['audience.evidence_source_code']} onChange={value => setDirect(current => ({ ...current, 'audience.evidence_source_code':value }))} />
      <ChoiceQuestion field="audience.geography_code" value={direct['audience.geography_code']} onChange={value => setDirect(current => ({ ...current, 'audience.geography_code':value }))} />
      {direct['audience.geography_code'] === 'specific_countries_or_regions' && <TextQuestion field="audience.geography_detail" value={direct['audience.geography_detail']} onChange={value => setDirect(current => ({ ...current, 'audience.geography_detail':value }))} />}
      {['audience.age_group_codes','audience.life_stage_codes','audience.lifestyle_codes','brand.sales_channel_codes','brand.marketing_channel_codes'].map(field => <MultiQuestion key={field} field={field} value={direct[field]} max={field === 'audience.lifestyle_codes' ? 3 : undefined} onChange={(code,checked) => updateList(field,code,checked,field === 'audience.lifestyle_codes' ? 3 : undefined)} />)}
      {Array.isArray(direct['brand.marketing_channel_codes']) && direct['brand.marketing_channel_codes'].length > 0 && <MultiQuestion field="brand.marketing_channel_rank_codes" options={(direct['brand.marketing_channel_codes'] as string[]).map(code => [code, OPTIONS['brand.marketing_channel_codes'].find(option => option[0] === code)?.[1] || human(code)] as [string,string])} value={direct['brand.marketing_channel_rank_codes']} max={3} onChange={(code,checked) => updateList('brand.marketing_channel_rank_codes',code,checked,3)} />}
      <ChoiceQuestion field="brand.measured_acquisition_channel_code" value={direct['brand.measured_acquisition_channel_code']} onChange={value => setDirect(current => ({ ...current, 'brand.measured_acquisition_channel_code':value }))} />
    </section>}

    {step === 2 && <section className="confirm-review"><div className="confirm-review-block"><h2>Prepared profile</h2><p>{reviewed} fields reviewed across {profile.products.length || 1} profile scope.</p></div><div className="confirm-review-block"><h2>Priority customer</h2><p>{String(direct['audience.description'] || '')}</p><ul>{(['audience.age_group_codes','audience.life_stage_codes','audience.lifestyle_codes'] as const).flatMap(key => (direct[key] as string[] || []).map(code => <li key={`${key}-${code}`}>{labelFor(key,code)}</li>))}</ul></div></section>}

    {message && <p className="confirm-message" role="alert">{message}</p>}
    <footer className="confirm-footer">{step > 0 && <button type="button" className="irl-button irl-button--secondary" onClick={() => { setMessage(''); setStep(value => value - 1); }}>Back</button>}<div>{step < 2 ? <button type="button" className="irl-button irl-button--primary" disabled={busy} onClick={() => void next()}>{busy ? 'Saving…' : 'Save and continue'}</button> : <button type="button" className="irl-button irl-button--primary" disabled={busy} onClick={() => void persist('submit')}>{busy ? 'Sending…' : 'Confirm and send profile'}</button>}</div></footer>
  </div></main>;
}

function TextQuestion({ field, value, onChange }:{ field:string; value:unknown; onChange:(value:string)=>void }) { return <label className="confirm-question"><span>{HUMAN[field]}{REQUIRED.has(field) && ' *'}</span><textarea value={String(value || '')} onChange={event => onChange(event.target.value)} /></label>; }
function ChoiceQuestion({ field, value, onChange }:{ field:string; value:unknown; onChange:(value:string)=>void }) { return <fieldset className="confirm-question"><legend>{HUMAN[field]}{REQUIRED.has(field) && ' *'}</legend><div className="confirm-options">{OPTIONS[field].map(([code,label]) => <label key={code}><input type="radio" name={field} checked={value === code} onChange={() => onChange(code)} />{label}</label>)}</div></fieldset>; }
function MultiQuestion({ field, value, onChange, max, options=OPTIONS[field] }:{ field:string; value:unknown; onChange:(code:string,checked:boolean)=>void; max?:number; options?:Array<[string,string]> }) { const selected=Array.isArray(value)?value as string[]:[]; return <fieldset className="confirm-question"><legend>{HUMAN[field]}{REQUIRED.has(field) && ' *'}</legend>{max && <small>Select up to {max}.</small>}<div className="confirm-options">{options.map(([code,label]) => <label key={code}><input type="checkbox" checked={selected.includes(code)} disabled={!selected.includes(code) && !!max && selected.length >= max} onChange={event => onChange(code,event.target.checked)} />{label}</label>)}</div></fieldset>; }
function human(value:string) { return value.replace(/^brand\.|^product\.|^audience\./,'').replace(/_/g,' ').replace(/^./,letter=>letter.toUpperCase()); }
function labelFor(field:string, code:string) { return OPTIONS[field]?.find(option=>option[0]===code)?.[1] || human(code); }
function display(value:unknown) { return Array.isArray(value) ? value.map(item=>human(String(item))).join(', ') : value == null ? 'Not supplied' : String(value); }
function editValue(value:unknown) { return Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value); }
function parseEdit(text:string, original:unknown) { if (Array.isArray(original)) return text.split(',').map(value=>value.trim()).filter(Boolean); if (typeof original === 'number') return Number(text); return text.trim(); }
