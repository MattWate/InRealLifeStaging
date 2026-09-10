import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { adminFetch } from './Auth';
import { fieldLabels, fieldSections, sectionTitles, sectionOrder } from './questionnaire';

type ReviewStatus = 'in_progress' | 'needs_review' | 'in_review' | 'approved' | 'changes_requested' | 'rejected';
type Submission = { id: string; type: 'brand' | 'operator'; status: string; review_status: ReviewStatus; review_notes?: string; current_step: string | null; completion_percentage: number | string; updated_at: string | null; name: string; email: string | null; property_name: string | null; submitted_at: string | null; schema_version?: string | null; audience_review_required?: boolean; legal_review_required?: boolean };
type List = { submissions: Submission[]; hasMore: boolean; page: number; counts: { total: number; brands: number; operators: number; in_progress: number; review: number; approved: number } };
type Detail = { submission: Submission; answers: { field_key: string; section_key?: string; answer_json: unknown }[] };
type AnswerMap = Record<string, unknown>;
const date = (value: string | null) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Date unavailable';
const human = (value: string) => value.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
function valueText(value: unknown): string {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return 'Not provided';
  if (Array.isArray(value)) return value.map(valueText).join(', ');
  if (typeof value === 'object') return Object.entries(value).map(([key, answer]) => `${human(key)}: ${valueText(answer)}`).join('\n');
  return String(value);
}
const present = (value: unknown) => value != null && value !== '' && (!Array.isArray(value) || value.length > 0);
const first = (value: unknown) => Array.isArray(value) ? value[0] : value;
const answerMap = (answers: Detail['answers']) => Object.fromEntries(answers.map(answer => [answer.field_key, answer.answer_json]));
const rankedFields = new Set(['decisionFactors', 'secondaryDecisionFactors', 'marketingChannelRank']);
const statusLabels: Record<ReviewStatus, string> = { in_progress: 'In progress', needs_review: 'Needs review', in_review: 'In review', approved: 'Approved', changes_requested: 'Changes requested', rejected: 'Rejected' };
const statusClass = (status: ReviewStatus) => `admin-status admin-status--${status.replace('_', '-')}`;

function CompactValue({ value, ranked = false }: { value: unknown; ranked?: boolean }) {
  if (!present(value)) return <span className="admin-empty">Not provided</span>;
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) return <ol className={ranked ? 'admin-ranked' : 'admin-values'}>{value.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ol>;
  return <>{valueText(value)}</>;
}

function BrandOverview({ answers }: { answers: AnswerMap }) {
  const contact = [answers.firstName, answers.lastName].filter(present).join(' ');
  const product = answers.productName;
  const audience = answers.audienceDescription;
  const opportunity = first(answers.irlOpportunity);
  const facts = [
    { label: 'Primary contact', value: contact || answers.email, detail: contact ? answers.email : answers.jobTitle },
    { label: 'Primary product', value: product, detail: [first(answers.productCategory), first(answers.productSubcategory)].filter(present).join(' · ') },
    { label: 'Priority audience', value: audience, detail: first(answers.audienceGeography) },
    { label: 'Primary opportunity', value: opportunity, detail: answers.primarySuccessResult },
  ];
  return <section className="admin-brand-overview" aria-label="Brand review summary">
    <div className="admin-section-heading"><div><p className="irl-eyebrow">Review summary</p><h2>Brand at a glance</h2></div><p>Key information for assessing fit before reading the full response.</p></div>
    <div className="admin-overview-grid">{facts.map(fact => <article className="irl-card" key={fact.label}><span>{fact.label}</span><strong>{present(fact.value) ? valueText(fact.value) : 'Not provided'}</strong>{present(fact.detail) && <small>{valueText(fact.detail)}</small>}</article>)}</div>
    <div className="irl-card admin-match-brief">
      <h3>Initial matching brief</h3>
      <dl>
        <div><dt>Brand position</dt><dd><CompactValue value={[first(answers.brandDifferentiator), first(answers.brandValues)].filter(present)} /></dd></div>
        <div><dt>Customer need</dt><dd><CompactValue value={first(answers.customerOutcome)} /></dd></div>
        <div><dt>Primary barrier</dt><dd><CompactValue value={first(answers.primaryBarrier)} /></dd></div>
        <div><dt>Suggested placements</dt><dd><CompactValue value={answers.brandSuggestedPlacements} /></dd></div>
        <div><dt>Supply readiness</dt><dd><CompactValue value={first(answers.supplyCapability)} /></dd></div>
        <div><dt>Success signals</dt><dd><CompactValue value={answers.successSignals} /></dd></div>
      </dl>
    </div>
  </section>;
}

function AnswerValue({ answer }: { answer: Detail['answers'][number] }) {
  const value = answer.answer_json;
  if (Array.isArray(value) && value.every(item => typeof item === 'object' && item !== null)) return <div className="admin-repeatables">{value.map((item, index) => <article key={index}><strong>{human(answer.field_key.replace(/^additional/, '').replace(/s$/, ''))} {index + 1}</strong><dl>{Object.entries(item as Record<string, unknown>).filter(([, nested]) => present(nested)).map(([key, nested]) => <div key={key}><dt>{human(key)}</dt><dd><CompactValue value={nested} /></dd></div>)}</dl></article>)}</div>;
  return <CompactValue value={value} ranked={rankedFields.has(answer.field_key)} />;
}

function ReviewWorkspace({ submission, onSaved }: { submission: Submission; onSaved: () => void }) {
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>(submission.review_status);
  const [notes, setNotes] = useState(submission.review_notes || '');
  const [name, setName] = useState(submission.name);
  const [email, setEmail] = useState(submission.email || '');
  const [propertyName, setPropertyName] = useState(submission.property_name || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { setReviewStatus(submission.review_status); setNotes(submission.review_notes || ''); setName(submission.name); setEmail(submission.email || ''); setPropertyName(submission.property_name || ''); }, [submission]);
  return <section className="irl-card admin-review-workspace">
    <div className="admin-section-heading"><div><p className="irl-eyebrow">Admin workspace</p><h2>Review and manage</h2></div><p>Update the operational record and add internal context. The applicant’s original answers below remain unchanged.</p></div>
    <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setMessage('');
      try {
        await adminFetch('admin-submissions', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: submission.id, review_status: reviewStatus, review_notes: notes, name, email, property_name: propertyName }) });
        setMessage('Application updated.'); onSaved();
      } catch (error) { setMessage((error as Error).message); }
      finally { setBusy(false); }
    }}>
      <div className="admin-edit-grid"><label>Organisation name<input value={name} onChange={event => setName(event.target.value)} required maxLength={200} /></label><label>Primary email<input type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} /></label>{submission.type === 'operator' && <label>Property name<input value={propertyName} onChange={event => setPropertyName(event.target.value)} maxLength={200} /></label>}<label>Review status<select value={reviewStatus} onChange={event => setReviewStatus(event.target.value as ReviewStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
      <label>Internal review notes<textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength={10000} placeholder="Add context, follow-up questions or a review summary…" /></label>
      <div className="admin-review-actions"><button className="irl-button irl-button--primary" disabled={busy}>{busy ? 'Saving…' : 'Save admin update'}</button>{message && <p role="status">{message}</p>}</div>
    </form>
  </section>;
}
export function Dashboard() {
  const [params, setParams] = useSearchParams();
  const type = params.get('type') || 'all';
  const status = params.get('status') || 'all';
  const q = params.get('q') || '';
  const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
  const [search, setSearch] = useState(q);
  const [data, setData] = useState<List | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  useEffect(() => { setSearch(q); }, [q]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    const query = new URLSearchParams({ type, status, q, page: String(page) });
    adminFetch(`admin-submissions?${query}`, { signal: controller.signal }).then(setData)
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [type, status, q, page, version]);
  return <main className="irl-container admin-content">
    <div className="admin-title"><div><p className="irl-eyebrow">IRL network</p><h1>Applications</h1><p className="admin-muted">Every saved brand and operator profile, from first draft through review.</p></div><button className="irl-button irl-button--secondary" disabled={loading} onClick={() => setVersion(v => v + 1)}>Refresh</button></div>
    {data && <div className="admin-stats admin-stats--four" aria-label="Application overview"><div className="irl-card"><strong>{data.counts.total}</strong><span>All applications</span><small>{data.counts.brands} brands · {data.counts.operators} operators</small></div><div className="irl-card"><strong>{data.counts.in_progress}</strong><span>In progress</span><small>Saved but not submitted</small></div><div className="irl-card"><strong>{data.counts.review}</strong><span>For review</span><small>Submitted or needs attention</small></div><div className="irl-card"><strong>{data.counts.approved}</strong><span>Approved</span><small>Review completed</small></div></div>}
    <form className="admin-filters" onSubmit={event => { event.preventDefault(); setParams({ type, status, q: search, page: '1' }); }}>
      <label>Search applications<input type="search" placeholder="Name, property or email" value={search} onChange={e => setSearch(e.target.value)} maxLength={150} /></label>
      <label>Profile type<select value={type} onChange={e => setParams({ type: e.target.value, status, q, page: '1' })}><option value="all">All profiles</option><option value="brand">Brands</option><option value="operator">Operators</option></select></label>
      <label>Status<select value={status} onChange={e => setParams({ type, status: e.target.value, q, page: '1' })}><option value="all">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <button className="irl-button irl-button--primary">Search</button>
    </form>
    {loading ? <p role="status" className="admin-state">Loading submissions…</p> : error ? <div className="admin-state"><p role="alert">{error}</p><button className="irl-button irl-button--secondary" onClick={() => setVersion(v => v + 1)}>Try again</button></div> : data && <>
      {!data.submissions.length ? <section className="irl-card admin-state"><h2>No matching applications</h2><p>Try another search, profile type or status.</p></section> :
      <div className="irl-card admin-table-wrap"><table><thead><tr><th scope="col">Organisation / property</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Progress</th><th scope="col">Last activity</th><th scope="col">Action</th></tr></thead><tbody>{data.submissions.map(row => <tr key={row.id}>
        <td><strong>{row.name}</strong>{row.property_name && <small>{row.property_name}</small>}{row.email && <small>{row.email}</small>}</td><td><span className="irl-chip">{human(row.type)}</span></td><td><span className={statusClass(row.review_status)}>{statusLabels[row.review_status]}</span></td><td><div className="admin-progress"><span style={{ width: `${Math.min(100, Number(row.completion_percentage) || 0)}%` }} /><small>{Math.round(Number(row.completion_percentage) || 0)}% · {row.current_step ? human(row.current_step) : 'Started'}</small></div></td><td>{date(row.updated_at)}</td><td><div className="admin-table-review">{row.audience_review_required && <span className="irl-chip admin-chip--review">Audience</span>}{row.legal_review_required && <span className="irl-chip admin-chip--review">Legal</span>}<Link to={`/admin/submissions/${row.id}`} aria-label={`Open ${row.name} application`}>Open profile</Link></div></td>
      </tr>)}</tbody></table></div>}
      <div className="admin-pagination"><button className="irl-button irl-button--secondary" disabled={page === 1} onClick={() => setParams({ type, status, q, page: String(page - 1) })}>Previous</button><span>Page {page}</span><button className="irl-button irl-button--secondary" disabled={!data.hasMore} onClick={() => setParams({ type, status, q, page: String(page + 1) })}>Next</button></div>
    </>}
  </main>;
}
export function SubmissionDetail() {
  const { id } = useParams();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError('');
    adminFetch(`admin-submissions?id=${encodeURIComponent(id || '')}`, { signal: controller.signal }).then(setData)
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [id, version]);
  const groups = data?.answers.reduce<Record<string, Detail['answers']>>((result, answer) => {
    if (answer.field_key.endsWith('Enabled')) return result;
    const section = answer.section_key || fieldSections[data.submission.type][answer.field_key] || 'other';
    (result[section] ||= []).push(answer); return result;
  }, {}) || {};
  const order = data ? sectionOrder[data.submission.type] : [];
  const mappedAnswers = data ? answerMap(data.answers) : {};
  return <main className="irl-container admin-content"><Link to="/admin">← All applications</Link>
    {error ? <div className="admin-state"><p role="alert">{error}</p><button className="irl-button irl-button--secondary" onClick={() => setVersion(v => v + 1)}>Try again</button></div> : !data ? <p role="status" className="admin-state">Loading answers…</p> : <>
      <div className="admin-title"><div><p className="irl-eyebrow">{data.submission.type} application</p><h1>{data.submission.name}</h1><p>{[data.submission.property_name, data.submission.email].filter(Boolean).join(' · ')}</p><p className="admin-muted">{data.submission.submitted_at ? `Submitted ${date(data.submission.submitted_at)}` : `Last saved ${date(data.submission.updated_at)}`} · {Math.round(Number(data.submission.completion_percentage) || 0)}% complete{data.submission.schema_version ? ` · ${data.submission.schema_version}` : ''}</p></div><div className="admin-statuses"><span className={statusClass(data.submission.review_status)}>{statusLabels[data.submission.review_status]}</span>{data.submission.audience_review_required && <span className="irl-chip admin-chip--review">Audience review required</span>}{data.submission.legal_review_required && <span className="irl-chip admin-chip--review">Legal review required</span>}</div></div>
      <ReviewWorkspace submission={data.submission} onSaved={() => setVersion(value => value + 1)} />
      {data.submission.type === 'brand' && <BrandOverview answers={mappedAnswers} />}
      {!data.answers.length && <p className="admin-state">No questionnaire answers were recorded for this submission.</p>}
      {Object.entries(groups).sort(([a], [b]) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b))).map(([section, answers]) => <section className="irl-card admin-answers" key={section}>
        <h2>{sectionTitles[data.submission.type][section] || human(section)}</h2><dl>{answers.map(answer => <div key={answer.field_key}><dt>{fieldLabels[answer.field_key] || human(answer.field_key)}</dt><dd><AnswerValue answer={answer} /></dd></div>)}</dl>
      </section>)}
    </>}
  </main>;
}
