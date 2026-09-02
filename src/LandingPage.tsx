import { ArrowRight, BarChart3, Building2, Check, MapPin, Store } from 'lucide-react';
import './landing-page.css';
import { useAuth } from './admin/Auth';

const zones = [
  'Sleep & Recovery',
  'Bath & Body',
  'Food & Drink',
  'Living & Social',
  'Work & Focus',
  'Arrival & Welcome',
  'Outdoor & Movement',
];

function LandingPage() {
  const { user, loading } = useAuth();
  return (
    <div className="landing-page">
      <header className="landing-nav">
        <div className="irl-container landing-nav__inner">
          <a className="landing-brand" href="/" aria-label="IRL home">
            <span className="landing-brand__mark">IRL</span>
            <span>NETWORK</span>
          </a>

          <nav className="landing-nav__links" aria-label="Primary navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#brands">For Brands</a>
            <a href="#operators">For Operators</a>
            <a href="#network">Network</a>
          </nav>

          <div className="landing-nav__actions">
            <a className="landing-sign-in" href={user ? '/admin' : '/login'}>{loading ? 'Account' : user ? 'Dashboard' : 'Sign in'}</a>
            <a className="irl-button irl-button--primary landing-join" href="/onboarding">
              Join IRL <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="irl-container landing-hero__grid">
            <div className="landing-hero__copy">
              <p className="irl-eyebrow">Real-world product discovery</p>
              <h1 className="irl-display irl-display--large">Right product. Right place. Real life.</h1>
              <p className="irl-lede">
                IRL connects brands with hospitality environments where products can be experienced naturally, matched to the right audiences and measured beyond simple distribution.
              </p>
              <div className="landing-hero__actions">
                <a className="irl-button irl-button--primary" href="/onboarding?flow=brand">
                  I represent a brand <ArrowRight size={17} />
                </a>
                <a className="irl-button irl-button--secondary" href="/onboarding?flow=operator">
                  I operate a property
                </a>
              </div>
              <div className="landing-hero__proof">
                <span><Check size={15} /> Context-led matching</span>
                <span><Check size={15} /> Measurable activation</span>
                <span><Check size={15} /> Actionable insight</span>
              </div>
            </div>

            <div className="landing-hero__visual" aria-label="IRL matching model">
              <div className="landing-hero__visual-grid" />
              <div className="landing-hero__visual-label">IRL NETWORK</div>
              <div className="landing-match-card landing-match-card--brand">
                <Store size={19} />
                <span><small>BRAND</small><strong>Designed to perform</strong></span>
              </div>
              <div className="landing-match-line" />
              <div className="landing-match-core">IRL</div>
              <div className="landing-match-card landing-match-card--property">
                <Building2 size={19} />
                <span><small>PLACE</small><strong>Matched by context</strong></span>
              </div>
              <div className="landing-hero__visual-footer">MATCH • ACTIVATE • LEARN</div>
            </div>
          </div>
        </section>

        <section className="irl-section landing-how" id="how-it-works">
          <div className="irl-container">
            <div className="irl-section-heading landing-how__heading">
              <p className="irl-eyebrow">How IRL works</p>
              <h2 className="irl-display irl-display--section">Products mean more when people experience them in context.</h2>
              <p className="irl-lede">IRL turns hospitality environments into relevant, measurable moments of product discovery.</p>
            </div>

            <div className="landing-process">
              <article>
                <span className="landing-process__number">01</span>
                <h3>Match</h3>
                <p>We align brands, products, properties and audiences around where a product genuinely makes sense.</p>
              </article>
              <article>
                <span className="landing-process__number">02</span>
                <h3>Activate</h3>
                <p>Products appear naturally within the guest experience instead of feeling like an interruption.</p>
              </article>
              <article>
                <span className="landing-process__number">03</span>
                <h3>Learn</h3>
                <p>Exposure, use, engagement and feedback create evidence brands and operators can actually act on.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="landing-paths">
          <div className="irl-container landing-paths__grid">
            <article className="landing-path landing-path--brand" id="brands">
              <p className="irl-eyebrow">For Brands</p>
              <Store size={28} />
              <h2 className="irl-display irl-display--section">Move discovery into the moments that matter.</h2>
              <p>Put products in front of relevant customers while they are actually living the need your brand solves.</p>
              <a href="/onboarding?flow=brand">Explore IRL for Brands <ArrowRight size={17} /></a>
            </article>

            <article className="landing-path landing-path--operator" id="operators">
              <p className="irl-eyebrow">For Operators</p>
              <Building2 size={28} />
              <h2 className="irl-display irl-display--section">Turn guest experience into a better partnership platform.</h2>
              <p>Bring useful, relevant products into your spaces while creating new value from the experience you already deliver.</p>
              <a href="/onboarding?flow=operator">Explore IRL for Operators <ArrowRight size={17} /></a>
            </article>
          </div>
        </section>

        <section className="irl-section landing-network" id="network">
          <div className="irl-container landing-network__grid">
            <div className="irl-section-heading">
              <p className="irl-eyebrow">The IRL Network</p>
              <h2 className="irl-display irl-display--section">A network built around context, not just reach.</h2>
              <p className="irl-lede">Properties become rich environments for discovery because IRL understands who stays there, what they do and where products naturally belong.</p>
              <a className="landing-text-link" href="/profiles/curiocity-green-point">View a network profile <ArrowRight size={16} /></a>
            </div>

            <a className="landing-property-card" href="/profiles/curiocity-green-point">
              <div className="landing-property-card__art">
                <div className="landing-property-card__grid" />
                <span>CP</span>
              </div>
              <div className="landing-property-card__content">
                <p className="irl-eyebrow">Network profile</p>
                <h3>Curiocity Green Point</h3>
                <p className="landing-property-card__location"><MapPin size={15} /> Cape Town, South Africa</p>
                <div>
                  <span className="irl-chip">Hybrid hospitality</span>
                  <span className="irl-chip">Urban traveller</span>
                </div>
              </div>
            </a>
          </div>
        </section>

        <section className="irl-section landing-zones">
          <div className="irl-container">
            <div className="irl-section-heading">
              <p className="irl-eyebrow">Experience Zones</p>
              <h2 className="irl-display irl-display--section">Where does the product belong?</h2>
              <p className="irl-lede">IRL maps products to the moments and spaces where their value is easiest to understand.</p>
            </div>
            <div className="landing-zones__grid">
              {zones.map((zone, index) => (
                <div className="landing-zone" key={zone}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{zone}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-value">
          <div className="irl-container landing-value__grid">
            <div>
              <p className="irl-eyebrow">Why IRL</p>
              <h2 className="irl-display irl-display--section">Not sampling. A better signal.</h2>
            </div>
            <div className="landing-value__items">
              <article>
                <MapPin size={22} />
                <div><h3>Better context</h3><p>Products appear in environments where using them feels natural.</p></div>
              </article>
              <article>
                <Building2 size={22} />
                <div><h3>Better matching</h3><p>Brands, audiences and properties are aligned before activation starts.</p></div>
              </article>
              <article>
                <BarChart3 size={22} />
                <div><h3>Better evidence</h3><p>IRL captures signals that go beyond how many products were handed out.</p></div>
              </article>
            </div>
          </div>
        </section>

        <section className="landing-cta">
          <div className="irl-container landing-cta__inner">
            <div>
              <p className="irl-eyebrow">Join the network</p>
              <h2 className="irl-display irl-display--section">Find out where IRL could fit.</h2>
            </div>
            <div className="landing-cta__actions">
              <a className="irl-button irl-button--light" href="/onboarding?flow=brand">Join as a Brand</a>
              <a className="irl-button irl-button--ghost-light" href="/onboarding?flow=operator">Join as an Operator</a>
              <p>Already part of IRL? <a href="/login">Sign in</a></p>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="irl-container landing-footer__inner">
          <a className="landing-brand landing-brand--footer" href="/">
            <span className="landing-brand__mark">IRL</span><span>NETWORK</span>
          </a>
          <p>Real-world product discovery, matched with intent.</p>
          <span>© {new Date().getFullYear()} IRL Network</span>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
