import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BedDouble,
  BriefcaseBusiness,
  Building2,
  Coffee,
  Compass,
  Database,
  Droplets,
  LoaderCircle,
  MapPin,
  MoonStar,
  Sparkles,
  Users,
} from 'lucide-react';

type ProfileData = {
  property: Record<string, any>;
  metrics: Record<string, any> | null;
  roomTypes: Record<string, any>[];
  spaces: Record<string, any>[];
  zones: Record<string, any>[];
  onboarding: Record<string, any>;
};

const zoneIcons: Record<string, typeof MoonStar> = {
  sleep_recovery: MoonStar,
  bath_body: Droplets,
  food_drink: Coffee,
  living_social: Users,
  work_focus: BriefcaseBusiness,
  arrival_welcome: Sparkles,
  outdoor_movement: Compass,
};

export default function OperatorProfile() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/.netlify/functions/operator-profile?slug=curiocity-green-point')
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Unable to load profile.');
        return payload;
      })
      .then(setData)
      .catch((reason) => setError(reason.message));
  }, []);

  if (error) {
    return <main className="profile-state"><Database size={34} /><h1>Profile unavailable</h1><p>{error}</p><a href="/">Return to onboarding</a></main>;
  }

  if (!data) {
    return <main className="profile-state"><LoaderCircle className="spin" size={34} /><p>Building the property profile from live data…</p></main>;
  }

  const { property, metrics, roomTypes, spaces, zones, onboarding } = data;
  const guestTypes = normaliseList(onboarding.typical_guests || onboarding.guest_types);
  const guestPriorities = normaliseList(onboarding.guest_priorities || onboarding.what_guests_care_about);
  const upgradeCategories = normaliseList(onboarding.product_categories_to_improve || onboarding.useful_product_categories);
  const primaryZones = zones.filter((zone) => ['strong', 'exceptional', 'medium'].includes(zone.strength)).slice(0, 5);

  return (
    <main className="operator-profile">
      <header className="profile-topbar">
        <a className="profile-back" href="/"><ArrowLeft size={16} /> Onboarding</a>
        <div className="profile-brand"><span>IRL</span><strong>PROPERTY INTELLIGENCE</strong></div>
        <div className="profile-status">Live data profile</div>
      </header>

      <section className="profile-hero">
        <div className="hero-copy">
          <p className="profile-kicker">IRL Operator Profile</p>
          <h1>{property.operator_name}</h1>
          <p className="hero-location"><MapPin size={17} /> {property.name}, {property.city}</p>
          <p className="hero-intro">{property.description_operator || property.operator_description}</p>
          <div className="hero-tags">
            <span>{humanise(property.property_type)}</span>
            <span>{property.number_of_properties || 1} locations</span>
            <span>{property.commercial_readiness_status === 'ready' ? 'Campaign ready' : 'Profile in review'}</span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-art-grid" />
          <div className="hero-art-number">{property.total_rooms || property.total_units}</div>
          <div className="hero-art-label">guest rooms and units</div>
        </div>
      </section>

      <section className="profile-metrics-wrap">
        <div className="section-heading inverse"><p>Property in lived time</p><h2>More than rooms. Time spent inside a real guest experience.</h2></div>
        <div className="profile-metrics">
          <Metric value={formatNumber(metrics?.guest_nights)} label="Guest nights" note="Recorded during the reporting period" />
          <Metric value={formatNumber(metrics?.guest_count)} label="Guests" note="Across imported stay records" />
          <Metric value={formatNumber(metrics?.reservation_count)} label="Stays" note="Anonymised reservation rows" />
          <Metric value={metrics?.average_length_of_stay ? `${Number(metrics.average_length_of_stay).toFixed(1)}` : '—'} label="Average nights" note="Per reservation record" />
        </div>
        {metrics && <p className="data-period">Data period: {formatDate(metrics.period_start)} to {formatDate(metrics.period_end)} · Snapshot status: {humanise(metrics.status)}</p>}
      </section>

      <section className="profile-section audience-section">
        <div className="section-heading"><p>The people who stay here</p><h2>A diverse, social guest base with time to discover and use products naturally.</h2></div>
        <div className="audience-grid">
          <div className="audience-stat">
            <strong>{metrics?.international_guest_percentage != null ? `${Math.round(Number(metrics.international_guest_percentage))}%` : '—'}</strong>
            <span>International guests</span>
            <small>Among guests with known origin</small>
          </div>
          <div className="audience-copy">
            <h3>Guest mix</h3>
            <div className="profile-chips">{guestTypes.map((item) => <span key={item}>{item}</span>)}</div>
            <h3>What guests value</h3>
            <div className="profile-chips muted">{guestPriorities.slice(0, 10).map((item) => <span key={item}>{item}</span>)}</div>
          </div>
        </div>
      </section>

      <section className="profile-section zones-section">
        <div className="section-heading"><p>Meaningful moments</p><h2>Experience Zones show where products can become part of the stay.</h2></div>
        <div className="zone-grid">
          {primaryZones.map((zone) => {
            const Icon = zoneIcons[zone.code] || Sparkles;
            return <article className="zone-card" key={zone.code}>
              <Icon size={23} />
              <div><span className="zone-strength">{humanise(zone.strength)}</span><h3>{zone.name}</h3><p>{zone.evidence_notes || zone.description}</p></div>
            </article>;
          })}
        </div>
      </section>

      <section className="profile-section inventory-section">
        <div className="section-heading"><p>Experiential inventory</p><h2>Private rooms and communal spaces create different kinds of exposure.</h2></div>
        <div className="inventory-layout">
          <div className="inventory-card">
            <BedDouble size={24} />
            <h3>Accommodation</h3>
            <ul>{roomTypes.slice(0, 8).map((room) => <li key={room.name}><span>{room.name}</span><strong>{room.number_of_sellable_units ?? '—'}</strong></li>)}</ul>
          </div>
          <div className="inventory-card">
            <Building2 size={24} />
            <h3>Communal environments</h3>
            <ul>{spaces.map((space) => <li key={space.name}><span>{space.name}</span><strong>{humanise(space.private_or_communal || space.space_type)}</strong></li>)}</ul>
          </div>
        </div>
      </section>

      <section className="profile-opportunity">
        <div>
          <p className="profile-kicker">The opportunity</p>
          <h2>Where thoughtful brand support can improve the guest experience.</h2>
          <p>Curiocity identified pressure around linen, beds, heaters, kitchenware and consistent guest-ready amenities. IRL can use this profile to identify brands whose products solve a real operational or guest need.</p>
        </div>
        <div className="opportunity-list">
          {upgradeCategories.slice(0, 9).map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>

      <footer className="profile-footer">
        <div className="profile-brand"><span>IRL</span><strong>IN REAL LIFE</strong></div>
        <p>This profile is generated from operator-submitted information and an approved data structure. Figures should remain subject to IRL review before external campaign use.</p>
      </footer>
    </main>
  );
}

function Metric({ value, label, note }: { value: string; label: string; note: string }) {
  return <article><strong>{value}</strong><span>{label}</span><small>{note}</small></article>;
}

function normaliseList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  if (value && typeof value === 'object') {
    const candidate = Object.values(value as Record<string, unknown>)[0];
    return normaliseList(candidate);
  }
  return [];
}

function humanise(value: unknown) {
  return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat('en-ZA').format(number) : '—';
}

function formatDate(value: unknown) {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(String(value)));
}
