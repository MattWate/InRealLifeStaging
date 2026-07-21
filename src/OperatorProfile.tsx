import { useEffect, useMemo, useState } from 'react';
import './operator-profile.css';
import { ArrowLeft, BedDouble, BriefcaseBusiness, Building2, CheckCircle2, Coffee, Compass, Database, Droplets, Gauge, LoaderCircle, MapPin, MoonStar, ShieldCheck, Sparkles, TrendingUp, Users } from 'lucide-react';

type Row = Record<string, any>;
type ProfileData = { property: Row; metrics: Row | null; roomTypes: Row[]; spaces: Row[]; zones: Row[]; onboarding: Record<string, any>; insights: { channelMix: Row[]; countryMix: Row[]; stayLength: Row[]; partyMix: Row[]; roomPerformance: Row[]; monthlyTrend: Row[]; quality: Row | null } };

const zoneIcons: Record<string, typeof MoonStar> = { sleep_recovery: MoonStar, bath_body: Droplets, food_drink: Coffee, living_social: Users, work_focus: BriefcaseBusiness, arrival_welcome: Sparkles, outdoor_movement: Compass };

export default function OperatorProfile() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { fetch('/.netlify/functions/operator-profile?slug=curiocity-green-point').then(async r => { const p = await r.json(); if (!r.ok) throw new Error(p.error); return p; }).then(setData).catch(e => setError(e.message)); }, []);
  if (error) return <main className="profile-state"><Database size={34}/><h1>Profile unavailable</h1><p>{error}</p><a href="/">Return to onboarding</a></main>;
  if (!data) return <main className="profile-state"><LoaderCircle className="spin" size={34}/><p>Building the property profile from live data…</p></main>;

  const { property, metrics, roomTypes, spaces, zones, onboarding, insights } = data;
  const guestTypes = list(onboarding['guests.types']);
  const guestPriorities = list(onboarding['guests.priorities']);
  const currentProducts = list(onboarding['products.current']);
  const upgrades = list(onboarding['products.upgrade_categories']);
  const noticed = list(onboarding['products.noticed']);
  const pressure = list(onboarding['products.maintenance_pressure']);
  const excluded = list(onboarding['products.excluded_categories']);
  const platforms = list(onboarding['systems.booking_platforms']);
  const primaryPlatforms = list(onboarding['systems.primary_platforms']);
  const taskConfidence = value(onboarding['operations.task_confidence']);
  const maxChannel = Math.max(...insights.channelMix.map(r => Number(r.stays)), 1);
  const maxMonth = Math.max(...insights.monthlyTrend.map(r => Number(r.guest_nights)), 1);
  const quality = insights.quality;
  const coverage = useMemo(() => quality ? {
    origin: pct(quality.rows_with_origin, quality.total_rows), channel: pct(quality.rows_with_channel, quality.total_rows), room: pct(quality.rows_with_room_type, quality.total_rows), unit: pct(quality.rows_with_unit, quality.total_rows),
  } : null, [quality]);

  return <main className="operator-profile">
    <header className="profile-topbar"><a className="profile-back" href="/"><ArrowLeft size={16}/> Onboarding</a><div className="profile-brand"><span>IRL</span><strong>PROPERTY INTELLIGENCE</strong></div><div className="profile-status">Live data profile</div></header>

    <section className="profile-hero"><div className="hero-copy"><p className="profile-kicker">IRL Operator Profile</p><h1>{property.operator_name}</h1><p className="hero-location"><MapPin size={17}/> {property.name}, {property.city}</p><p className="hero-intro">{property.description_operator || property.operator_description}</p><div className="hero-tags"><span>{humanise(property.property_type)}</span><span>{property.number_of_properties || 1} locations</span><span>{humanise(property.commercial_readiness_status)}</span><span>{humanise(property.reporting_capability)}</span></div></div><div className="hero-art"><div className="hero-art-grid"/><div className="hero-art-number">{property.total_rooms || property.total_units}</div><div className="hero-art-label">guest rooms and units</div></div></section>

    <section className="profile-metrics-wrap"><Heading inverse eyebrow="Property in lived time" title="More than rooms. Time spent inside a real guest experience."/><div className="profile-metrics"><Metric value={num(metrics?.guest_nights)} label="Guest nights" note="Cumulative exposure potential"/><Metric value={num(metrics?.guest_count)} label="Guests" note="Across imported stay records"/><Metric value={num(metrics?.reservation_count)} label="Stays" note="Anonymised reservation rows"/><Metric value={metrics?.average_length_of_stay ? Number(metrics.average_length_of_stay).toFixed(1) : '—'} label="Average nights" note="Repeated-use opportunity"/></div><p className="data-period">Data period: {date(metrics?.period_start)} to {date(metrics?.period_end)} · Snapshot: {humanise(metrics?.status)}</p></section>

    <section className="profile-section audience-section"><Heading eyebrow="Guest intelligence" title="Who stays, how they travel and what matters to them."/><div className="audience-grid"><div className="audience-stat"><strong>{metrics?.international_guest_percentage != null ? `${Math.round(Number(metrics.international_guest_percentage))}%` : '—'}</strong><span>International guests</span><small>Among records with known origin</small></div><div className="audience-copy"><h3>Guest mix</h3><div className="profile-chips">{guestTypes.map(x => <span key={x}>{x}</span>)}</div><h3>What guests value</h3><div className="profile-chips muted">{guestPriorities.map(x => <span key={x}>{x}</span>)}</div></div></div>
      <div className="insight-grid top-gap"><InsightList title="Top guest origins" rows={insights.countryMix.slice(0,6)} valueKey="guests" suffix=" guests"/><InsightBars title="Party composition" rows={insights.partyMix} maxKey="stays"/><InsightBars title="Length of stay" rows={insights.stayLength} maxKey="stays"/></div>
    </section>

    <section className="profile-section commercial-section"><Heading eyebrow="Commercial behaviour" title="Where bookings come from and how exposure accumulates over time."/><div className="commercial-grid"><div className="large-insight"><h3>Booking channel mix</h3>{insights.channelMix.map(r => <div className="bar-row" key={r.label}><div><span>{r.label}</span><strong>{r.stays} stays</strong></div><i><b style={{width:`${Number(r.stays)/maxChannel*100}%`}}/></i><small>{num(r.guest_nights)} guest nights</small></div>)}</div><div className="profile-note"><TrendingUp size={26}/><h3>Distribution context</h3><p>Primary platforms reported by the operator are {primaryPlatforms.join(' and ') || 'not yet confirmed'}.</p><div className="profile-chips muted">{platforms.map(x => <span key={x}>{x}</span>)}</div></div></div>
      <div className="trend-card"><h3>Guest-night volume by check-in month</h3><div className="trend-bars">{insights.monthlyTrend.map(r => <div key={r.label}><i style={{height:`${Math.max(8,Number(r.guest_nights)/maxMonth*100)}%`}}/><span>{r.label}</span><strong>{num(r.guest_nights)}</strong></div>)}</div></div>
    </section>

    <section className="profile-section zones-section"><Heading eyebrow="Meaningful moments" title="Experience Zones show where products can become part of the stay."/><div className="zone-grid">{zones.slice(0,7).map(z => { const Icon=zoneIcons[z.code]||Sparkles; return <article className="zone-card" key={z.code}><Icon size={23}/><div><span className="zone-strength">{humanise(z.strength)}</span><h3>{z.name}</h3><p>{z.evidence_notes||z.description}</p>{list(z.category_opportunities).length>0&&<div className="mini-tags">{list(z.category_opportunities).slice(0,4).map(x=><span key={x}>{x}</span>)}</div>}</div></article>; })}</div></section>

    <section className="profile-section inventory-section"><Heading eyebrow="Experiential inventory" title="Private rooms and communal spaces create different kinds of exposure."/><div className="inventory-layout"><div className="inventory-card"><BedDouble size={24}/><h3>Accommodation</h3><ul>{roomTypes.map(r=><li key={r.name}><span>{r.name}</span><strong>{r.number_of_sellable_units ?? '—'}</strong></li>)}</ul></div><div className="inventory-card"><Building2 size={24}/><h3>Communal environments</h3><ul>{spaces.map(s=><li key={s.name}><span>{s.name}</span><strong>{humanise(s.private_or_communal||s.space_type)}</strong></li>)}</ul></div></div><div className="room-performance"><h3>Room-type contribution</h3>{insights.roomPerformance.map(r=><div className="performance-row" key={r.label}><span>{r.label}</span><strong>{num(r.guest_nights)} guest nights</strong><small>{r.stays} stays · {r.average_stay || '—'} avg nights</small></div>)}</div></section>

    <section className="profile-section readiness-section"><Heading eyebrow="Operational readiness" title="The people, routines and data capability behind successful fulfilment."/><div className="readiness-grid"><Readiness icon={CheckCircle2} title="Turnover task confidence" value={`${taskConfidence || '—'}/5`} note="Operator-reported confidence"/><Readiness icon={Users} title="Product setup" value={objectText(onboarding['operations.product_setup_owner'],'team')} note={objectText(onboarding['operations.product_setup_owner'],'role')}/><Readiness icon={ShieldCheck} title="Photo verification" value={objectText(onboarding['operations.photo_owner'],'name')} note={objectText(onboarding['operations.photo_owner'],'role')}/><Readiness icon={Database} title="Monthly reporting" value={objectText(onboarding['operations.monthly_data_owner'],'name')} note={objectText(onboarding['operations.monthly_data_owner'],'role')}/></div><div className="friction-card"><Gauge size={24}/><div><span>Known operational friction</span><h3>{value(onboarding['guests.common_review_issue']) || 'No issue recorded'}</h3><p>Reported pressure areas: {pressure.join(', ') || 'none recorded'}.</p></div></div></section>

    <section className="profile-opportunity"><div><p className="profile-kicker">Product and brand fit</p><h2>Where thoughtful support can improve the guest experience and reduce operating pressure.</h2><p>Guests already notice {noticed.join(', ').toLowerCase() || 'selected amenities'}. The strongest opportunities are categories that improve comfort, consistency and the shared stay experience.</p></div><div><h3>Current amenities</h3><div className="opportunity-list">{currentProducts.map(x=><span key={x}>{x}</span>)}</div><h3>Upgrade opportunities</h3><div className="opportunity-list">{upgrades.map(x=><span key={x}>{x}</span>)}</div>{excluded.length>0&&<p className="restriction">Not suitable: {excluded.join(', ')}</p>}</div></section>

    <section className="profile-section quality-section"><Heading eyebrow="Data confidence" title="A transparent view of what is known, calculated and still needs strengthening."/><div className="quality-grid"><Coverage label="Guest origin" value={coverage?.origin}/><Coverage label="Booking channel" value={coverage?.channel}/><Coverage label="Room type" value={coverage?.room}/><Coverage label="Individual unit" value={coverage?.unit}/></div><div className="quality-copy"><p><strong>{num(quality?.total_rows)}</strong> reservation rows analysed from {date(quality?.first_check_in)} to {date(quality?.last_check_out)}.</p><p>Occupancy is not presented unless sellable inventory and out-of-service periods are fully verified.</p></div></section>

    <footer className="profile-footer"><div className="profile-brand"><span>IRL</span><strong>IN REAL LIFE</strong></div><p>This profile combines operator-submitted information with anonymised stay data. Figures remain subject to IRL review before external campaign use.</p></footer>
  </main>;
}

function Heading({eyebrow,title,inverse=false}:{eyebrow:string;title:string;inverse?:boolean}){return <div className={`section-heading ${inverse?'inverse':''}`}><p>{eyebrow}</p><h2>{title}</h2></div>}
function Metric({value,label,note}:{value:string;label:string;note:string}){return <article><strong>{value}</strong><span>{label}</span><small>{note}</small></article>}
function InsightList({title,rows,valueKey,suffix}:{title:string;rows:Row[];valueKey:string;suffix:string}){return <div className="small-insight"><h3>{title}</h3>{rows.map(r=><div key={r.label}><span>{r.label}</span><strong>{r[valueKey]}{suffix}</strong></div>)}</div>}
function InsightBars({title,rows,maxKey}:{title:string;rows:Row[];maxKey:string}){const max=Math.max(...rows.map(r=>Number(r[maxKey])),1);return <div className="small-insight"><h3>{title}</h3>{rows.map(r=><div className="mini-bar" key={r.label}><span>{r.label}</span><i><b style={{width:`${Number(r[maxKey])/max*100}%`}}/></i><strong>{r[maxKey]}</strong></div>)}</div>}
function Readiness({icon:Icon,title,value,note}:{icon:any;title:string;value:string;note:string}){return <article><Icon size={22}/><span>{title}</span><strong>{value||'—'}</strong><small>{note||'Not yet assigned'}</small></article>}
function Coverage({label,value}:{label:string;value?:number}){return <article><strong>{value==null?'—':`${value}%`}</strong><span>{label}</span><i><b style={{width:`${value||0}%`}}/></i></article>}
function list(v:unknown):string[]{if(Array.isArray(v))return v.map(String);if(typeof v==='string')return v.split(',').map(x=>x.trim()).filter(Boolean);return []}
function value(v:unknown){return typeof v==='string'||typeof v==='number'?String(v):''}
function objectText(v:unknown,key:string){return v&&typeof v==='object'&&!Array.isArray(v)?String((v as Row)[key]||''):''}
function humanise(v:unknown){return String(v||'').replaceAll('_',' ').replace(/\b\w/g,l=>l.toUpperCase())}
function num(v:unknown){const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat('en-ZA').format(n):'—'}
function date(v:unknown){if(!v)return 'Unknown';return new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'short',year:'numeric'}).format(new Date(String(v)))}
function pct(a:unknown,b:unknown){const x=Number(a),y=Number(b);return y?Math.round(x/y*100):0}
