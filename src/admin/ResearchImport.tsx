import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminFetch } from './Auth';
import { buildResearchImportRequest, MAX_RESEARCH_IMPORT_BYTES, parseResearchJson, type ResearchTargetMode } from './research-import';
import { RecentResearchImports } from './ResearchReview';

type Brand = { id: string; name: string; country_code: string | null; website: string | null };
type Issue = { code?: string; path?: string; message: string };
type Preview = {
  valid: true;
  summary: { brand_name: string; products: number; claims: number; sources: number };
  warnings: Issue[];
};
type ImportResult = {
  import_id: string;
  organisation_id: string;
  organisation_created: boolean;
  status: string;
  counts: { products: number; claims: number; sources: number; warnings: number };
};

export function ResearchImport() {
  const [mode, setMode] = useState<ResearchTargetMode>('existing');
  const [brandSearch, setBrandSearch] = useState('');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [json, setJson] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setBrandsLoading(true);
      adminFetch(`admin-brand-research-import?q=${encodeURIComponent(brandSearch)}`, { signal: controller.signal })
        .then(response => setBrands(response.brands || []))
        .catch(error => { if (!controller.signal.aborted) setMessage(error.message); })
        .finally(() => { if (!controller.signal.aborted) setBrandsLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [brandSearch]);

  const parsedName = useMemo(() => {
    try {
      const value = JSON.parse(json);
      return typeof value?.brand?.reference_name === 'string' ? value.brand.reference_name : '';
    } catch { return ''; }
  }, [json]);

  function resetValidation() {
    setPreview(null); setResult(null); setIssues([]); setMessage('');
  }

  async function submit(validateOnly: boolean) {
    setBusy(true); setIssues([]); setMessage('');
    try {
      const research = parseResearchJson(json);
      const payload = buildResearchImportRequest(research, mode, selectedBrand, validateOnly);
      const response = await fetch('/.netlify/functions/admin-brand-research-import', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({ error: 'The server returned an unexpected response.' }));
      if (!response.ok) {
        if (response.status === 401) window.dispatchEvent(new Event('irl-session-expired'));
        setIssues([...(body.errors || []), ...(body.details || [])]);
        throw new Error(body.error || 'Unable to process the research import.');
      }
      if (validateOnly) {
        setPreview(body); setMessage('Validation passed. Review the summary before importing.');
      } else {
        setResult(body); setPreview(null); setMessage('Research imported and ready for admin review.');
      }
    } catch (error) {
      setMessage((error as Error).message);
    } finally { setBusy(false); }
  }

  if (result) return <main className="irl-container admin-content">
    <Link to="/admin">← Applications</Link>
    <section className="irl-card admin-import-success">
      <p className="irl-eyebrow">Import complete</p>
      <h1>{parsedName || 'Brand research'} is ready for review</h1>
      <p>The original research and {result.counts.claims} field-level claims are stored. No researched value has changed the live Brand Profile.</p>
      <dl>
        <div><dt>Import ID</dt><dd>{result.import_id}</dd></div>
        <div><dt>Organisation</dt><dd>{result.organisation_created ? 'New brand created' : 'Linked to existing brand'}</dd></div>
        <div><dt>Products</dt><dd>{result.counts.products}</dd></div>
        <div><dt>Warnings</dt><dd>{result.counts.warnings}</dd></div>
      </dl>
      <div className="admin-import-actions"><Link className="irl-button irl-button--primary" to={`/admin/research/${result.import_id}`}>Review research claims</Link><button className="irl-button irl-button--secondary" onClick={() => { setJson(''); setFileName(''); setResult(null); setPreview(null); setMessage(''); }}>Import another profile</button></div>
    </section>
  </main>;

  return <main className="irl-container admin-content">
    <div className="admin-title"><div><p className="irl-eyebrow">Research-assisted onboarding</p><h1>Import brand research</h1><p className="admin-muted">Validate a profile prepared from the IRL research contract, then store it for review before anything is shown to the brand.</p></div></div>

    <div className="admin-import-layout">
      <RecentResearchImports />
      <section className="irl-card admin-import-card">
        <div className="admin-import-step"><span>1</span><div><h2>Choose the brand record</h2><p>Link the research deliberately. IRL will never guess based on a similar name.</p></div></div>
        <div className="admin-mode-options" role="group" aria-label="Brand record choice">
          <button type="button" className={mode === 'existing' ? 'active' : ''} aria-pressed={mode === 'existing'} onClick={() => { setMode('existing'); resetValidation(); }}><strong>Existing brand</strong><small>Attach this research to a brand already in Neon.</small></button>
          <button type="button" className={mode === 'new' ? 'active' : ''} aria-pressed={mode === 'new'} onClick={() => { setMode('new'); setSelectedBrand(''); resetValidation(); }}><strong>Create new brand</strong><small>Create a basic brand organisation during import.</small></button>
        </div>
        {mode === 'existing' ? <div className="admin-brand-picker">
          <label>Find a brand<input type="search" value={brandSearch} onChange={event => setBrandSearch(event.target.value)} placeholder="Search by brand name or website" maxLength={150} /></label>
          <label>Select brand<select value={selectedBrand} onChange={event => { setSelectedBrand(event.target.value); resetValidation(); }} disabled={brandsLoading}><option value="">{brandsLoading ? 'Loading brands…' : 'Choose a brand'}</option>{brands.map(brand => <option value={brand.id} key={brand.id}>{brand.name}{brand.country_code ? ` · ${brand.country_code}` : ''}</option>)}</select></label>
          {!brandsLoading && !brands.length && <p className="admin-muted">No matching brand records found. Choose “Create new brand” if this is a new opportunity.</p>}
        </div> : <div className="admin-new-brand-note"><strong>{parsedName || 'Brand name will come from the JSON'}</strong><p>A pending brand organisation will be created. Profile fields will remain unchanged until review and customer confirmation.</p></div>}
      </section>

      <section className="irl-card admin-import-card">
        <div className="admin-import-step"><span>2</span><div><h2>Add the research JSON</h2><p>Upload Jared’s AI output or paste it below. Only the locked v1 contract is accepted.</p></div></div>
        <label className="admin-file-picker">Choose JSON file<input type="file" accept="application/json,.json" onChange={async event => {
          const file = event.target.files?.[0];
          if (!file) return;
          resetValidation(); setFileName(file.name);
          if (file.size > MAX_RESEARCH_IMPORT_BYTES) { setJson(''); setMessage('The research JSON exceeds the 1 MB limit.'); return; }
          try { setJson(await file.text()); } catch { setMessage('The selected file could not be read.'); }
        }} /><small>{fileName || 'Maximum file size: 1 MB'}</small></label>
        <div className="admin-json-divider"><span>or paste JSON</span></div>
        <label>Research JSON<textarea className="admin-json-input" value={json} onChange={event => { setJson(event.target.value); setFileName(''); resetValidation(); }} placeholder={'{\n  "schema_version": "irl-brand-research-v1",\n  …\n}'} spellCheck={false} /></label>
        <div className="admin-import-actions"><button className="irl-button irl-button--primary" disabled={busy || !json.trim() || (mode === 'existing' && !selectedBrand)} onClick={() => void submit(true)}>{busy ? 'Validating…' : 'Validate research'}</button><span className="admin-muted">Validation does not write anything to Neon.</span></div>
      </section>

      {(message || issues.length > 0) && <section className={`irl-card admin-import-feedback ${issues.length ? 'has-errors' : ''}`} aria-live="polite">
        <h2>{issues.length ? 'Validation needs attention' : 'Validation result'}</h2>
        {message && <p role={issues.length ? 'alert' : 'status'}>{message}</p>}
        {issues.length > 0 && <ul>{issues.map((issue, index) => <li key={`${issue.path}-${index}`}><strong>{issue.path || issue.code || 'Research document'}</strong><span>{issue.message}</span></li>)}</ul>}
      </section>}

      {preview && <section className="irl-card admin-import-card admin-import-preview">
        <div className="admin-import-step"><span>3</span><div><h2>Review and import</h2><p>The document is structurally valid. Warnings remain visible for the claim-review stage.</p></div></div>
        <div className="admin-import-summary"><div><span>Brand</span><strong>{preview.summary.brand_name}</strong></div><div><span>Products</span><strong>{preview.summary.products}</strong></div><div><span>Claims</span><strong>{preview.summary.claims}</strong></div><div><span>Sources</span><strong>{preview.summary.sources}</strong></div></div>
        <div className="admin-warning-list"><h3>{preview.warnings.length ? `${preview.warnings.length} warning${preview.warnings.length === 1 ? '' : 's'}` : 'No warnings'}</h3>{preview.warnings.length > 0 && <ul>{preview.warnings.map((warning, index) => <li key={`${warning.code}-${index}`}><strong>{warning.path || warning.code}</strong><span>{warning.message}</span></li>)}</ul>}</div>
        <div className="admin-import-confirm"><p><strong>Safe import:</strong> this stores the original research and review claims only. It does not overwrite the live Brand Profile.</p><button className="irl-button irl-button--primary" disabled={busy} onClick={() => void submit(false)}>{busy ? 'Importing…' : 'Confirm import'}</button></div>
      </section>}
    </div>
  </main>;
}
