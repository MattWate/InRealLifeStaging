import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, ExternalLink, MapPin, Package, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { adminFetch } from './Auth';
import './intelligence-profiles.css';

type Kind = 'brand' | 'property';
type Listing = { id: string; name: string; subtitle: string; imported: string; status: string; count: number; key: string };
type Claim = { id: string; entity_type: string; entity_key: string; field_key: string; proposed_value: unknown; reviewed_value?: unknown; admin_decision: 'pending' | 'accepted' | 'edited' | 'rejected'; research_provenance: string; confidence: string; source_ids?: string[]; source_references?: Array<{ source_id: string; title: string; url?: string }> };
type Profile = { name: string; location: string; website?: string; status: string; imported: string; claims: Claim[]; sources: Array<{ id: string; title: string; url: string }>; reviewUrl: string; entities: Array<{ key: string; name: string; kind: string }> };

const title = (value: string) => value.replace(/^.*?\./, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const render = (value: unknown) => value == null || value === '' ? 'Not yet known' : Array.isArray(value) ? value.join(' · ') : typeof value === 'object' ? JSON.stringify(value) : String(value);
const preferred = (claim: Claim) => claim.admin_decision === 'edited' ? claim.reviewed_value : claim.admin_decision === 'accepted' ? claim.proposed_value : claim.proposed_value;
const state = (claim: Claim) => claim.admin_decision === 'rejected' ? 'Rejected by IRL' : ['accepted','edited'].includes(claim.admin_decision) ? 'IRL reviewed' : claim.research_provenance === 'data_gap' ? 'Information gap' : claim.research_provenance === 'research_assumption' ? 'Research assumption' : 'Research finding';
const date = (value: string) => value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown';

export function IntelligenceDirectory({kind}:{kind:Kind}) {
  const [rows,setRows] = useState<Listing[]>([]);
  const [search,setSearch] = useState('');
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const path = kind === 'brand' ? 'admin-brand-research-review' : 'admin-operator-research-import';
    adminFetch(path,{signal:controller.signal}).then(body => {
      const candidates:Listing[] = kind === 'brand' ? (body.imports || []).map((i:any) => ({ id:i.id, name:i.research_brand_name || i.organisation_name, subtitle:i.organisation_name, imported:i.created_at, status:i.status, count:Number(i.claim_count || 0), key:i.organisation_id || i.id }))
        : (body.imports || []).map((i:any) => ({ id:i.id, name:i.property_name, subtitle:i.property_city || 'Location not specified', imported:i.created_at, status:i.status, count:0, key:i.property_id || `${String(i.property_name).toLowerCase()}|${String(i.property_city||'').toLowerCase()}` }));
      const seen = new Set<string>();
      setRows(candidates.filter(item => { if(seen.has(item.key))return false;seen.add(item.key);return true; }));
    }).catch(e => { if(!controller.signal.aborted)setError(e.message); }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[kind]);
  const matches = rows.filter(item => `${item.name} ${item.subtitle}`.toLowerCase().includes(search.toLowerCase()));
  return <main className="irl-container intelligence-page">
    <Link to="/admin" className="intelligence-back"><ArrowLeft size={16}/> Admin dashboard</Link>
    <div className="intelligence-directory-heading"><div><p className="irl-eyebrow">IRL network intelligence</p><h1>{kind === 'brand' ? 'Brand profiles' : 'Property profiles'}</h1><p>Research-led profiles are visible to IRL before partners verify their information.</p></div><Link className="irl-button irl-button--primary" to={kind==='brand'?'/admin/research':'/admin/operator-research'}>Import research <ArrowRight size={16}/></Link></div>
    <label className="intelligence-search"><Search size={18}/><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${kind==='brand'?'brands':'properties'}`} /></label>
    {loading?<p role="status">Loading profiles…</p>:error?<p role="alert">{error}</p>:matches.length===0?<div className="irl-card intelligence-empty"><h2>No research profiles found</h2><p>Import research to create the first intelligence profile.</p></div>:<div className="intelligence-directory-grid">{matches.map(item=><Link className="intelligence-list-card" to={`/admin/${kind==='brand'?'brands':'properties'}/${item.id}`} key={item.id}><span className="intelligence-card-symbol">{kind==='brand'?<Package size={22}/>:<Building2 size={22}/>}</span><span className="intelligence-card-category">{kind==='brand'?'Brand':'Property'} · Research record</span><h2>{item.name}</h2><p>{item.subtitle}</p><div className="intelligence-list-footer"><span>Imported {date(item.imported)}</span><ArrowRight size={17}/></div></Link>)}</div>}
    <p className="intelligence-footnote">Directory entries represent the most recent research record for each identifiable organisation or property. Full canonical profile consolidation is a later phase.</p>
  </main>;
}

export function IntelligenceProfile({kind}:{kind:Kind}) {
  const {id=''} = useParams();
  const [profile,setProfile] = useState<Profile|null>(null);
  const [error,setError] = useState('');
  useEffect(()=>{
    const controller=new AbortController();setProfile(null);setError('');
    const path=kind==='brand'?'admin-brand-research-review':'admin-operator-research-import';
    adminFetch(`${path}?id=${encodeURIComponent(id)}`,{signal:controller.signal}).then(data=>{
      if(kind==='brand') {
        const p=data.brand;
        setProfile({name:p.reference_name,location:p.match_hints?.country_code||'',website:p.match_hints?.website,status:data.import.status,imported:data.import.generated_at||data.import.created_at,claims:data.claims,sources:(data.sources||[]).filter((s:any)=>s.url).map((s:any)=>({id:s.source_id,title:s.title,url:s.url})),reviewUrl:`/admin/research/${id}`,entities:(data.products||[]).map((v:any)=>({key:v.external_key,name:v.reference_name,kind:'Product'}))});
      } else {
        const p=data.research_import;
        const raw=p.raw_payload||{};
        setProfile({name:p.property_name,location:[p.property_city,raw.property?.match_hints?.country_code].filter(Boolean).join(', '),website:p.property_website,status:p.status,imported:p.generated_at||p.created_at,claims:data.claims,sources:(data.sources||[]).map((s:any)=>({id:s.source_key,title:s.title,url:s.url})),reviewUrl:`/admin/operator-research/${id}`,entities:[...(raw.rooms||[]).map((v:any)=>({...v,kind:'Room type'})),...(raw.spaces||[]).map((v:any)=>({...v,kind:'Space'})),...(raw.audiences||[]).map((v:any)=>({...v,kind:'Audience'})),...(raw.zones||[]).map((v:any)=>({...v,kind:'Experience zone'}))].map((v:any)=>({key:v.external_key,name:v.reference_name,kind:v.kind}))});
      }
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return ()=>controller.abort();
  },[id,kind]);
  if(error)return <main className="irl-container intelligence-page"><p role="alert">{error}</p><Link to="/admin">Back to dashboard</Link></main>;
  if(!profile)return <main className="irl-container intelligence-page"><p role="status">Preparing intelligence profile…</p></main>;
  const visible=profile.claims.filter(c=>c.admin_decision!=='rejected'&&(c.proposed_value!=null||c.reviewed_value!=null));
  const groups=[...new Set(visible.map(c=>c.entity_type))];
  const gaps=profile.claims.filter(c=>c.research_provenance==='data_gap'&&c.admin_decision!=='rejected');
  const reviewed=profile.claims.filter(c=>c.admin_decision==='accepted'||c.admin_decision==='edited');
  const sources=new Map(profile.sources.map(s=>[s.id,s]));
  return <main className="intelligence-profile">
    <div className="irl-container intelligence-profile-shell">
      <Link className="intelligence-back" to={`/admin/${kind==='brand'?'brands':'properties'}`}><ArrowLeft size={16}/> All {kind==='brand'?'brands':'properties'}</Link>
      <section className="intelligence-hero"><div><p className="irl-eyebrow">IRL {kind==='brand'?'brand':'property'} intelligence</p><h1>{profile.name}</h1><p className="intelligence-location"><MapPin size={16}/>{profile.location||'Location not yet established'}</p><p>Working research profile · Last researched {date(profile.imported)}</p><div className="intelligence-hero-actions"><Link className="irl-button irl-button--primary" to={profile.reviewUrl}>Review evidence <ArrowRight size={16}/></Link>{profile.website&&<a href={profile.website} target="_blank" rel="noopener noreferrer" className="irl-button irl-button--ghost-light">Visit website <ExternalLink size={15}/></a>}</div></div><div className="intelligence-hero-decoration"><span>IRL</span><small>RESEARCH / INTELLIGENCE / CONTEXT</small></div></section>
      <section className="intelligence-metrics" aria-label="Research coverage"><div><strong>{profile.claims.length}</strong><span>Research claims</span></div><div><strong>{reviewed.length}</strong><span>IRL reviewed</span></div><div><strong>{gaps.length}</strong><span>Information gaps</span></div><div><strong>{profile.sources.length}</strong><span>Sources</span></div></section>
      <div className="intelligence-notice"><ShieldCheck size={21}/><p><strong>Research profile — partner confirmation not required to view.</strong> Publicly researched facts, interpretations and IRL-reviewed findings are labelled separately. This profile should not be mistaken for a fully partner-confirmed record.</p></div>
      {profile.entities.length>0&&<section className="intelligence-section"><div className="intelligence-section-title"><p className="irl-eyebrow">Inventory and context</p><h2>{kind==='brand'?'Products identified':'Property components identified'}</h2></div><div className="intelligence-entity-grid">{profile.entities.map(entity=><article key={`${entity.kind}-${entity.key}`} className="irl-card intelligence-entity"><small>{entity.kind}</small><h3>{entity.name}</h3></article>)}</div></section>}
      {groups.map(group=><section className="intelligence-section" key={group}><div className="intelligence-section-title"><p className="irl-eyebrow">Research and evidence</p><h2>{group==='zone'?'Experience zones':group==='brand'?'Brand overview':group==='property'?'Property overview':title(group)}</h2></div><div className="intelligence-facts">{visible.filter(c=>c.entity_type===group).map(c=><article key={c.id} className="irl-card intelligence-fact"><div className="intelligence-fact-header"><small>{title(c.field_key)}</small><span className={`intelligence-confidence ${c.admin_decision==='accepted'||c.admin_decision==='edited'?'is-reviewed':c.research_provenance==='research_assumption'?'is-assumption':''}`}>{state(c)}</span></div><strong>{render(preferred(c))}</strong>{c.entity_type!=='brand'&&c.entity_type!=='property'&&<small>{c.entity_key.replace(/_/g,' ')}</small>}{(c.source_ids||[]).map(sourceId=>{const source=sources.get(sourceId);return source?<a key={sourceId} href={source.url} target="_blank" rel="noopener noreferrer" className="intelligence-source">{source.title} ↗</a>:null})}</article>)}</div></section>)}
      {gaps.length>0&&<section className="intelligence-section"><div className="intelligence-section-title"><p className="irl-eyebrow">To be strengthened</p><h2>Information gaps</h2></div><div className="intelligence-gap-grid">{gaps.map(g=><div className="intelligence-gap" key={g.id}><Sparkles size={16}/><span>{title(g.field_key)}</span></div>)}</div></section>}
      <footer className="intelligence-profile-footer"><p>Source: IRL research database. Partner verification and canonical profile reconciliation remain separate workflows.</p><Link to={profile.reviewUrl}>Open detailed research review →</Link></footer>
    </div>
  </main>;
}
