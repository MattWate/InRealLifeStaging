import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { adminFetch } from './Auth';
import { fieldLabels, fieldSections, sectionTitles, sectionOrder } from './questionnaire';

type Submission = { id: string; type: 'brand' | 'operator'; name: string; email: string | null; property_name: string | null; submitted_at: string | null };
type List = { submissions: Submission[]; hasMore: boolean; page: number; counts: { total: number; brands: number; operators: number } };
type Detail = { submission: Submission; answers: { field_key: string; section_key?: string; answer_json: unknown }[] };
const date = (value: string | null) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Date unavailable';
const human = (value: string) => value.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
function valueText(value: unknown): string {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return 'Not provided';
  if (Array.isArray(value)) return value.map(valueText).join(', ');
  if (typeof value === 'object') return Object.entries(value).map(([key, answer]) => `${human(key)}: ${valueText(answer)}`).join('\n');
  return String(value);
}
export function Dashboard() {
  const [params, setParams] = useSearchParams();
  const type = params.get('type') || 'all';
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
    const query = new URLSearchParams({ type, q, page: String(page) });
    adminFetch(`admin-submissions?${query}`, { signal: controller.signal }).then(setData)
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [type, q, page, version]);
  return <main className="irl-container admin-content">
    <div className="admin-title"><div><p className="irl-eyebrow">Completed forms</p><h1>Submissions</h1></div><button className="irl-button irl-button--secondary" disabled={loading} onClick={() => setVersion(v => v + 1)}>Refresh</button></div>
    {data && <div className="admin-stats" aria-label="All completed submissions"><div className="irl-card"><strong>{data.counts.total}</strong><span>Total submissions</span></div><div className="irl-card"><strong>{data.counts.brands}</strong><span>Brands</span></div><div className="irl-card"><strong>{data.counts.operators}</strong><span>Operators</span></div></div>}
    <form className="admin-filters" onSubmit={event => { event.preventDefault(); setParams({ type, q: search, page: '1' }); }}>
      <label>Search submissions<input type="search" placeholder="Name, property or email" value={search} onChange={e => setSearch(e.target.value)} maxLength={150} /></label>
      <label>Profile type<select value={type} onChange={e => setParams({ type: e.target.value, q, page: '1' })}><option value="all">All profiles</option><option value="brand">Brands</option><option value="operator">Operators</option></select></label>
      <button className="irl-button irl-button--primary">Search</button>
    </form>
    {loading ? <p role="status" className="admin-state">Loading submissions…</p> : error ? <div className="admin-state"><p role="alert">{error}</p><button className="irl-button irl-button--secondary" onClick={() => setVersion(v => v + 1)}>Try again</button></div> : data && <>
      {!data.submissions.length ? <section className="irl-card admin-state"><h2>{q || type !== 'all' ? 'No matching submissions' : 'No completed forms yet'}</h2><p>{q || type !== 'all' ? 'Try another search or profile type.' : 'Brand and operator forms appear here after they are submitted successfully.'}</p></section> :
      <div className="irl-card admin-table-wrap"><table><thead><tr><th scope="col">Organisation / property</th><th scope="col">Type</th><th scope="col">Contact</th><th scope="col">Submitted</th><th scope="col">Review</th></tr></thead><tbody>{data.submissions.map(row => <tr key={row.id}>
        <td><strong>{row.name}</strong>{row.property_name && <small>{row.property_name}</small>}</td><td><span className="irl-chip">{human(row.type)}</span></td><td>{row.email || 'Not provided'}</td><td>{date(row.submitted_at)}</td><td><Link to={`/admin/submissions/${row.id}`} aria-label={`View ${row.name} submission`}>View answers</Link></td>
      </tr>)}</tbody></table></div>}
      <div className="admin-pagination"><button className="irl-button irl-button--secondary" disabled={page === 1} onClick={() => setParams({ type, q, page: String(page - 1) })}>Previous</button><span>Page {page}</span><button className="irl-button irl-button--secondary" disabled={!data.hasMore} onClick={() => setParams({ type, q, page: String(page + 1) })}>Next</button></div>
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
  return <main className="irl-container admin-content"><Link to="/admin">← All submissions</Link>
    {error ? <div className="admin-state"><p role="alert">{error}</p><button className="irl-button irl-button--secondary" onClick={() => setVersion(v => v + 1)}>Try again</button></div> : !data ? <p role="status" className="admin-state">Loading answers…</p> : <>
      <div className="admin-title"><div><p className="irl-eyebrow">{data.submission.type} submission</p><h1>{data.submission.name}</h1><p>{[data.submission.property_name, data.submission.email].filter(Boolean).join(' · ')}</p><p className="admin-muted">Submitted {date(data.submission.submitted_at)}</p></div><span className="irl-chip">Submitted</span></div>
      {!data.answers.length && <p className="admin-state">No questionnaire answers were recorded for this submission.</p>}
      {Object.entries(groups).sort(([a], [b]) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b))).map(([section, answers]) => <section className="irl-card admin-answers" key={section}>
        <h2>{sectionTitles[data.submission.type][section] || human(section)}</h2><dl>{answers.map(answer => <div key={answer.field_key}><dt>{fieldLabels[answer.field_key] || human(answer.field_key)}</dt><dd>{valueText(answer.answer_json)}</dd></div>)}</dl>
      </section>)}
    </>}
  </main>;
}
