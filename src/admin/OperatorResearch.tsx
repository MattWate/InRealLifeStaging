import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminFetch } from './Auth';

type ImportSummary = { id: string; property_name: string; property_city?: string; status: string; created_at: string };
type Claim = { id: string; entity_type: string; entity_key: string; field_key: string; proposed_value: unknown; reviewed_value?: unknown; admin_decision: 'pending'|'accepted'|'edited'|'rejected'; research_provenance: string; confidence: string; presentation_action: string; rationale: string; source_ids: string[] };
type Source = { source_key: string; title: string; url: string };
type ImportDetail = { research_import: { property_name: string; property_city?: string; property_website?: string; created_at: string; status: string }; claims: Claim[]; sources: Source[] };

export function OperatorResearch() {
  const [json, setJson] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [imports, setImports] = useState<ImportSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [issues, setIssues] = useState<Array<{ path: string; message: string }>>([]);
  const refresh = () => adminFetch('admin-operator-research-import').then(body => setImports(body.imports || [])).catch(error => setMessage(error.message));
  useEffect(() => { void refresh(); }, []);

  async function process(validate_only: boolean) {
    setBusy(true); setIssues([]); setMessage('');
    try {
      const research = JSON.parse(json);
      const response = await fetch('/.netlify/functions/admin-operator-research-import', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ research, validate_only }),
      });
      const body = await response.json();
      if (!response.ok) { setIssues(body.issues || []); throw new Error(body.error || 'Import failed.'); }
      setPreview(body.summary);
      setMessage(validate_only ? 'Research structure is valid. Review the summary before importing.' : 'Research imported. The source data and claims are preserved for review.');
      if (!validate_only) { setJson(''); setFileName(''); await refresh(); }
    } catch (error) { setMessage(error instanceof SyntaxError ? 'Invalid JSON. Check the uploaded file.' : (error as Error).message); }
    finally { setBusy(false); }
  }
  return <main className="admin-main">
    <div className="admin-page-heading"><div><p className="irl-eyebrow">Property intelligence</p><h1>Operator research imports</h1><p>Upload research from Jared’s external tool. Imports remain internal and unverified until reviewed.</p></div></div>
    <section className="irl-card" style={{ padding: 24, marginBottom: 24 }}>
      <h2>Upload research JSON</h2>
      <p>Accepted format: <code>irl-operator-research-v1</code>. Maximum 1 MB. This does not contact the hotel.</p>
      <label>Choose JSON file <input type="file" accept=".json,application/json" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 1024 * 1024) { setMessage('File exceeds 1 MB.'); return; } setJson(await file.text()); setFileName(file.name); setPreview(null); setIssues([]); }} /></label>
      {fileName && <p>Selected: {fileName}</p>}
      <label htmlFor="operator-research-json">Or paste JSON</label>
      <textarea id="operator-research-json" rows={8} value={json} onChange={event => { setJson(event.target.value); setPreview(null); }} style={{width:'100%', fontFamily:'monospace'}} />
      <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:16}}>
        <button className="irl-button irl-button--secondary" disabled={!json.trim() || busy} onClick={() => void process(true)}>Validate and preview</button>
        <button className="irl-button irl-button--primary" disabled={!json.trim() || busy || !preview} onClick={() => void process(false)}>Import research</button>
      </div>
      {message && <p role="status">{message}</p>}
      {issues.length > 0 && <ul>{issues.slice(0,30).map((issue,index) => <li key={index}><strong>{issue.path}</strong>: {issue.message}</li>)}</ul>}
      {preview && <div className="irl-card" style={{padding:16,marginTop:16}}><h3>{preview.property_name}</h3><p>{preview.rooms} room types · {preview.spaces} spaces · {preview.audiences} audiences · {preview.zones} experience zones · {preview.claims} claims · {preview.sources} sources</p></div>}
    </section>
    <section><h2>Recent research</h2>{imports.length === 0 ? <p>No property research has been imported yet.</p> : <ul>{imports.map(item => <li key={item.id}><Link to={`/admin/operator-research/${item.id}`}>{item.property_name}</Link> · {item.property_city || 'Location unrecorded'} · {item.status} · {new Date(item.created_at).toLocaleDateString()}</li>)}</ul>}</section>
  </main>;
}

export function OperatorResearchDetail() {
  const { id } = useParams();
  const [data,setData] = useState<ImportDetail | null>(null);
  const [error,setError] = useState('');
  useEffect(() => { adminFetch(`admin-operator-research-import?id=${encodeURIComponent(id || '')}`).then(setData).catch(e => setError(e.message)); }, [id]);
  if (error) return <main className="admin-main"><p role="alert">{error}</p></main>;
  if (!data) return <main className="admin-main"><p>Loading research…</p></main>;
  const sources = new Map(data.sources.map(s => [s.source_key,s]));
  const groups = [...new Set(data.claims.map(c => c.entity_type))];
  return <main className="admin-main">
    <Link to="/admin/operator-research">← All operator research</Link>
    <div className="admin-page-heading"><div><p className="irl-eyebrow">Research draft · {data.research_import.status}</p><h1>{data.research_import.property_name}</h1><p>{data.research_import.property_city} · {data.research_import.property_website || 'Website not provided'}</p></div></div>
    <p>This is an evidence review of externally gathered material. It is not yet an approved or operator-confirmed property record.</p>
    {groups.map(group => <section key={group} style={{marginTop:28}}><h2 style={{textTransform:'capitalize'}}>{group === 'zone' ? 'Experience zones' : group}</h2><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12}}>{data.claims.filter(c=>c.entity_type===group).map(claim=><ClaimCard key={claim.id} claim={claim} sources={sources} />)}</div></section>)}
  </main>;
}

function displayValue(value: unknown) { return value == null ? 'Information needed' : Array.isArray(value) ? value.join(', ') : String(value); }

function ClaimCard({claim,sources}:{claim:Claim;sources:Map<string,Source>}) {
  const [decision,setDecision] = useState(claim.admin_decision);
  const [input,setInput] = useState(displayValue(claim.reviewed_value ?? claim.proposed_value));
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  async function review(next:Claim['admin_decision']) {
    setBusy(true); setError('');
    try {
      const proposed = claim.proposed_value;
      const reviewed_value = next === 'edited' ? Array.isArray(proposed) ? input.split(',').map(v=>v.trim()).filter(Boolean) : typeof proposed === 'number' ? Number(input) : input : undefined;
      const response = await fetch('/.netlify/functions/admin-operator-research-import', {
        method:'PATCH',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json'},
        body:JSON.stringify({claim_id:claim.id,decision:next,...(next==='edited'?{reviewed_value}:{})}),
      });
      const body=await response.json();
      if(!response.ok) throw new Error(body.error||'Unable to save review.');
      setDecision(next);
    } catch(e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <article className="irl-card" style={{padding:18}}>
    <small>{claim.entity_key} · {claim.field_key.split('.').slice(1).join(' ')}</small>
    <h3 style={{overflowWrap:'anywhere'}}>{displayValue(claim.proposed_value)}</h3>
    <p>{claim.rationale}</p>
    <p><strong>{claim.research_provenance.replaceAll('_',' ')}</strong> · {claim.confidence} confidence · {claim.presentation_action.replaceAll('_',' ')}</p>
    {claim.source_ids.map(sourceId=>{const source=sources.get(sourceId);return source?<p key={sourceId}><a href={source.url} target="_blank" rel="noopener noreferrer">Source: {source.title}</a></p>:null;})}
    <p><strong>Jared's review:</strong> {decision}</p>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <button className="irl-button irl-button--secondary" disabled={busy} onClick={()=>void review('accepted')}>Accept</button>
      <button className="irl-button irl-button--secondary" disabled={busy} onClick={()=>void review('rejected')}>Reject</button>
      <button className="irl-button irl-button--secondary" disabled={busy} onClick={()=>void review('pending')}>Pending</button>
    </div>
    <label>Correction (lists separated by commas)<textarea value={input} onChange={event=>setInput(event.target.value)} rows={2} style={{width:'100%'}} /></label>
    <button className="irl-button irl-button--primary" disabled={busy || !input.trim()} onClick={()=>void review('edited')}>Save correction</button>
    {error && <p role="alert">{error}</p>}
  </article>;
}
