import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminFetch } from './Auth';

type Decision = 'pending' | 'accepted' | 'edited' | 'rejected';
type Product = { external_key: string; reference_name: string; suggest_for_opportunity: boolean };
type Claim = {
  id: string;
  claim_key: string;
  entity_type: 'brand' | 'product';
  entity_key: string;
  field_key: string;
  proposed_value: unknown;
  research_provenance: string;
  confidence: string;
  presentation_action: string;
  review_required: boolean;
  source_ids: string[];
  source_references: Array<{ source_id: string; title: string; publisher: string; url?: string }>;
  rationale: string;
  admin_decision: Decision;
  reviewed_value: unknown;
};
type Detail = {
  import: { id: string; organisation_name: string; status: string; generated_at: string; generator_name: string; generator_version: string };
  brand: { external_key: string; reference_name: string; match_hints?: { website?: string; country_code?: string } };
  products: Product[];
  warnings: Array<{ code: string; path?: string; message: string }>;
  selected_product_keys: string[];
  claims: Claim[];
};
type ImportListItem = {
  id: string;
  status: string;
  organisation_name: string;
  research_brand_name: string;
  product_count: number;
  claim_count: number;
  pending_count: number;
  created_at: string;
};
type Invitation = { id: string; recipient_name?: string; recipient_email: string; status: string; expires_at: string; opened_at?: string; submitted_at?: string; created_at: string };

const human = (value: string) => value.replace(/^brand\.|^product\.|^audience\./, '').replace(/_/g, ' ').replace(/^./, letter => letter.toUpperCase());
const displayValue = (value: unknown) => {
  if (value == null) return 'No value supplied';
  if (Array.isArray(value)) return value.map(String).join(', ') || 'Empty list';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};
const editText = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value, null, 2);

export function RecentResearchImports() {
  const [imports, setImports] = useState<ImportListItem[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    adminFetch('admin-brand-research-review', { signal: controller.signal })
      .then(response => setImports(response.imports || []))
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!imports.length) return null;
  return <section className="irl-card admin-research-recents">
    <div className="admin-section-heading"><div><p className="irl-eyebrow">Review queue</p><h2>Recent research imports</h2></div><p>Continue a review or reopen the evidence behind a completed one.</p></div>
    <div className="admin-table-wrap"><table><thead><tr><th>Brand</th><th>Status</th><th>Scope</th><th>Imported</th><th>Action</th></tr></thead><tbody>{imports.map(item => <tr key={item.id}><td><strong>{item.research_brand_name}</strong><small>{item.organisation_name}</small></td><td><span className={`admin-status ${item.status === 'reviewed' ? 'admin-status--approved' : 'admin-status--needs-review'}`}>{item.status === 'reviewed' ? 'Reviewed' : `${item.pending_count} pending`}</span></td><td>{item.product_count} products<small>{item.claim_count} claims</small></td><td>{new Date(item.created_at).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</td><td><Link to={`/admin/research/${item.id}`}>{item.status === 'reviewed' ? 'Open review' : 'Continue review'}</Link></td></tr>)}</tbody></table></div>
  </section>;
}

export function ResearchReview() {
  const { id } = useParams();
  const [data, setData] = useState<Detail | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [issues, setIssues] = useState<Array<{ path?: string; message: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [expiryDays, setExpiryDays] = useState(14);
  const [invitationNotes, setInvitationNotes] = useState('');
  const [customerUrl, setCustomerUrl] = useState('');

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setIssues([]);
    adminFetch(`admin-brand-research-review?id=${encodeURIComponent(id || '')}`, { signal: controller.signal })
      .then((response: Detail) => {
        setData(response);
        setDecisions(Object.fromEntries(response.claims.map(claim => [claim.id, claim.admin_decision])));
        setEdits(Object.fromEntries(response.claims.map(claim => [claim.id, editText(claim.reviewed_value ?? claim.proposed_value)])));
        setSelectedProducts(response.selected_product_keys || []);
      })
      .catch(error => { if (!controller.signal.aborted) setMessage(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, version]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    adminFetch(`admin-brand-profile-invitations?import_id=${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(response => setInvitations(response.invitations || []))
      .catch(error => { if (!controller.signal.aborted) setMessage(error.message); });
    return () => controller.abort();
  }, [id, version]);

  const reviewable = data?.claims.filter(claim => claim.research_provenance !== 'data_gap') || [];
  const decided = reviewable.filter(claim => decisions[claim.id] && decisions[claim.id] !== 'pending').length;
  const groups = useMemo(() => data?.claims.reduce<Record<string, Claim[]>>((result, claim) => {
    (result[claim.entity_key] ||= []).push(claim); return result;
  }, {}) || {}, [data]);

  async function save() {
    if (!data) return;
    setBusy(true); setMessage(''); setIssues([]);
    try {
      const claims = reviewable.map(claim => {
        const decision = decisions[claim.id] || 'pending';
        if (decision !== 'edited') return { claim_id: claim.id, decision };
        return { claim_id: claim.id, decision, reviewed_value: parseEdit(edits[claim.id], claim.proposed_value) };
      });
      const response = await fetch('/.netlify/functions/admin-brand-research-review', {
        method: 'PATCH', credentials: 'same-origin', cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ import_id: data.import.id, selected_product_keys: selectedProducts, claims }),
      });
      const body = await response.json().catch(() => ({ error: 'The server returned an unexpected response.' }));
      if (!response.ok) {
        if (response.status === 401) window.dispatchEvent(new Event('irl-session-expired'));
        setIssues(body.details || []); throw new Error(body.error || 'Unable to save the review.');
      }
      setMessage(body.completed ? 'Review complete. This profile is ready for an invitation.' : `Review saved. ${body.pending_claims} claims still need a decision.`);
      setVersion(value => value + 1);
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  async function createInvitation() {
    if (!data) return;
    setBusy(true); setMessage(''); setCustomerUrl('');
    try {
      const response = await fetch('/.netlify/functions/admin-brand-profile-invitations', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ import_id: data.import.id, recipient_name: recipientName, recipient_email: recipientEmail, expiry_days: expiryDays, notes: invitationNotes }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to create the invitation.');
      setCustomerUrl(body.customer_url); setMessage(body.message); setVersion(value => value + 1);
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  async function revokeInvitation(invitationId: string) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/.netlify/functions/admin-brand-profile-invitations', {
        method: 'PATCH', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type':'application/json' },
        body: JSON.stringify({ invitation_id: invitationId, action: 'revoke' }),
      });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to revoke the invitation.');
      setMessage('Invitation revoked.'); setVersion(value => value + 1);
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }

  return <main className="irl-container admin-content"><Link to="/admin/research">← Research imports</Link>
    {loading ? <p className="admin-state" role="status">Loading research claims…</p> : !data ? <section className="admin-state"><p role="alert">{message || 'Research import unavailable.'}</p></section> : <>
      <div className="admin-title"><div><p className="irl-eyebrow">Research review</p><h1>{data.brand.reference_name}</h1><p className="admin-muted">Linked to {data.import.organisation_name} · Generated by {data.import.generator_name} {data.import.generator_version}</p></div><span className={`admin-status ${data.import.status === 'reviewed' ? 'admin-status--approved' : 'admin-status--needs-review'}`}>{data.import.status === 'reviewed' ? 'Reviewed' : 'Needs review'}</span></div>

      <section className="irl-card admin-review-progress"><div><strong>{decided} of {reviewable.length}</strong><span>research claims decided</span></div><div className="admin-progress"><span style={{ width: `${reviewable.length ? Math.round(decided / reviewable.length * 100) : 100}%` }} /></div><p>Data gaps are excluded because the brand will answer them directly.</p></section>

      {data.products.length > 0 && <section className="irl-card admin-product-selection"><div className="admin-section-heading"><div><p className="irl-eyebrow">Opportunity scope</p><h2>Select the products</h2></div><p>Only selected products will be prepared for the customer confirmation link.</p></div><div>{data.products.map(product => <label key={product.external_key}><input type="checkbox" checked={selectedProducts.includes(product.external_key)} onChange={event => setSelectedProducts(current => event.target.checked ? [...current, product.external_key] : current.filter(key => key !== product.external_key))} /><span><strong>{product.reference_name}</strong>{product.suggest_for_opportunity && <small>Suggested by research</small>}</span></label>)}</div></section>}

      {Object.entries(groups).map(([entityKey, claims]) => {
        const product = data.products.find(item => item.external_key === entityKey);
        return <section className="irl-card admin-claim-group" key={entityKey}><div className="admin-section-heading"><div><p className="irl-eyebrow">{claims[0].entity_type}</p><h2>{product?.reference_name || data.brand.reference_name}</h2></div><p>{claims.length} field-level claims</p></div><div className="admin-claims">{claims.map(claim => {
          const decision = decisions[claim.id] || 'pending';
          const gap = claim.research_provenance === 'data_gap';
          return <article className={`admin-claim admin-claim--${decision}`} key={claim.id}>
            <div className="admin-claim-heading"><div><span>{human(claim.field_key)}</span><strong>{gap ? 'To be answered by the brand' : displayValue(claim.proposed_value)}</strong></div><div className="admin-claim-badges"><span className="irl-chip">{human(claim.research_provenance)}</span><span className="irl-chip">{human(claim.confidence)} confidence</span>{claim.review_required && <span className="irl-chip admin-chip--review">Review required</span>}</div></div>
            <p>{claim.rationale}</p>
            {claim.source_references?.length > 0 && <details><summary>{claim.source_references.length} source{claim.source_references.length === 1 ? '' : 's'}</summary><ul>{claim.source_references.map(source => <li key={source.source_id}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title}<small>{source.publisher}</small></li>)}</ul></details>}
            {gap ? <div className="admin-gap-note">This stays blank and will be included in the customer questions where applicable.</div> : <>
              <div className="admin-decision-buttons" role="group" aria-label={`Decision for ${human(claim.field_key)}`}><button type="button" className={decision === 'accepted' ? 'active' : ''} onClick={() => setDecisions(current => ({ ...current, [claim.id]: 'accepted' }))}>Accept</button><button type="button" className={decision === 'edited' ? 'active' : ''} onClick={() => setDecisions(current => ({ ...current, [claim.id]: 'edited' }))}>Edit</button><button type="button" className={decision === 'rejected' ? 'active' : ''} onClick={() => setDecisions(current => ({ ...current, [claim.id]: 'rejected' }))}>Reject</button></div>
              {decision === 'edited' && <label>Reviewed value<textarea value={edits[claim.id] || ''} onChange={event => setEdits(current => ({ ...current, [claim.id]: event.target.value }))} spellCheck={typeof claim.proposed_value === 'string'} /></label>}
            </>}
          </article>;
        })}</div></section>;
      })}

      {data.import.status === 'reviewed' && <section className="irl-card admin-invitation-panel"><div className="admin-section-heading"><div><p className="irl-eyebrow">Customer invitation</p><h2>Create the confirmation link</h2></div><p>The link opens the reviewed starting profile and asks the brand only for confirmation, corrections and the customer information IRL still needs.</p></div>
        <div className="admin-invitation-form"><label>Recipient name<input value={recipientName} maxLength={200} onChange={event => setRecipientName(event.target.value)} /></label><label>Recipient email<input type="email" required value={recipientEmail} maxLength={254} onChange={event => setRecipientEmail(event.target.value)} /></label><label>Link valid for<select value={expiryDays} onChange={event => setExpiryDays(Number(event.target.value))}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={60}>60 days</option></select></label><label className="admin-invitation-notes">Opportunity note (internal)<textarea value={invitationNotes} maxLength={2000} onChange={event => setInvitationNotes(event.target.value)} /></label></div>
        <button className="irl-button irl-button--primary" type="button" disabled={busy || !recipientEmail.trim()} onClick={() => void createInvitation()}>{busy ? 'Creating link…' : 'Create customer link'}</button>
        {customerUrl && <div className="admin-customer-link"><strong>Copy this link now</strong><p>It is shown only once. Creating another link will revoke this one.</p><div><input readOnly value={customerUrl} aria-label="Customer confirmation link" /><button type="button" onClick={() => void navigator.clipboard.writeText(customerUrl).then(() => setMessage('Customer link copied.'))}>Copy link</button></div></div>}
        {invitations.length > 0 && <div className="admin-invitation-history"><h3>Invitation history</h3><div className="admin-table-wrap"><table><thead><tr><th>Recipient</th><th>Status</th><th>Expires</th><th>Action</th></tr></thead><tbody>{invitations.map(invitation => <tr key={invitation.id}><td><strong>{invitation.recipient_name || invitation.recipient_email}</strong><small>{invitation.recipient_name && invitation.recipient_email}</small></td><td><span className={`admin-status ${invitation.status === 'submitted' ? 'admin-status--approved' : invitation.status === 'revoked' ? 'admin-status--rejected' : 'admin-status--in-progress'}`}>{human(invitation.status)}</span></td><td>{new Date(invitation.expires_at).toLocaleDateString('en-GB',{ dateStyle:'medium' })}</td><td>{['active','opened','draft'].includes(invitation.status) ? <button type="button" className="admin-text-button" disabled={busy} onClick={() => void revokeInvitation(invitation.id)}>Revoke</button> : '—'}</td></tr>)}</tbody></table></div></div>}
      </section>}

      {(message || issues.length > 0) && <section className={`irl-card admin-import-feedback ${issues.length ? 'has-errors' : ''}`}><p role={issues.length ? 'alert' : 'status'}>{message}</p>{issues.length > 0 && <ul>{issues.map((issue, index) => <li key={`${issue.path}-${index}`}><strong>{issue.path || 'Review'}</strong><span>{issue.message}</span></li>)}</ul>}</section>}
      <section className="admin-review-bar"><div><strong>{selectedProducts.length} product{selectedProducts.length === 1 ? '' : 's'} selected</strong><span>{reviewable.length - decided} claim{reviewable.length - decided === 1 ? '' : 's'} pending</span></div><button className="irl-button irl-button--primary" disabled={busy || (data.products.length > 0 && selectedProducts.length === 0)} onClick={() => void save()}>{busy ? 'Saving review…' : decided === reviewable.length ? 'Complete review' : 'Save review'}</button></section>
    </>}
  </main>;
}

function parseEdit(value: string, proposed: unknown) {
  if (typeof proposed === 'number') {
    const number = Number(value); if (!Number.isFinite(number)) throw new Error('Enter a valid number for every edited numeric field.'); return number;
  }
  if (Array.isArray(proposed) || (proposed && typeof proposed === 'object')) {
    try { return JSON.parse(value); } catch { throw new Error('Edited lists must be valid JSON arrays.'); }
  }
  return value.trim();
}
