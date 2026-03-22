import './landing.css';

const FEATURED_CLIPS = [
  { type: 'code', content: 'const apiKey = process.env.OPENAI_KEY;', time: '2s ago' },
  { type: 'url', content: 'github.com/klypt/docs', time: '12s ago' },
  { type: 'code', content: 'SELECT * FROM users WHERE id = $1', time: '45s ago' },
  { type: 'text', content: 'Meeting notes: Discussed Q4 roadmap...', time: '1m ago' },
];

const DEMO_CLIPS = [
  { id: '1', title: 'API Configuration', type: 'code', selected: true },
  { id: '2', title: 'Database Query', type: 'code', selected: true },
  { id: '3', title: 'Design System Colors', type: 'text', selected: true },
  { id: '4', title: 'Project Docs', type: 'url', selected: false },
  { id: '5', title: 'SSH Key', type: 'key', selected: false },
];

const FAQ_ITEMS = [
  {
    question: 'How does Klypt access my clipboard?',
    answer: 'On desktop (macOS, Windows, Linux), Klypt runs as a background app with clipboard access permissions. On iOS, it uses the system Share Sheet. Your clipboard data never leaves your devices except when you explicitly enable cloud sync.'
  },
  {
    question: 'Is my sensitive data encrypted?',
    answer: 'Yes. All your notes and clipboard history are encrypted end-to-end using AES-256 encryption. Only you can decrypt your data — we cannot access it even if we wanted to.'
  },
  {
    question: 'Does it work offline?',
    answer: 'Klypt works fully offline. Your notes are stored locally first, then synced when connection is available. The sync status indicator shows you exactly what\'s pending.'
  },
  {
    question: 'Can I sync between different platforms?',
    answer: 'Yes! Klypt syncs seamlessly between macOS, Windows, Linux, iOS, and Android. Your notes and clipboard history are available everywhere, with real-time sync when online.'
  },
  {
    question: 'What happens to my data if I cancel?',
    answer: 'Your data is always yours. If you cancel your subscription, you can export all your notes and clipboard history in standard formats (JSON, Markdown, plain text). We\'ll keep your data for 30 days before permanent deletion.'
  },
];

const SOCIAL_PROOF = [
  {
    name: 'Sarah Chen',
    handle: '@sarahcodes',
    avatar: 'SC',
    badge: 'GitHub Star',
    content: 'Klypt has completely changed how I work across my MacBook and iPhone. The real-time sync is magical — clips appear instantly. This is the clipboard manager I\'ve always wanted.'
  },
  {
    name: 'Marcus Rodriguez',
    handle: '@marcusdev',
    avatar: 'MR',
    badge: 'Verified on HN',
    content: 'The AI Handbook feature alone is worth the Pro subscription. Turn my code snippets and notes into documentation in one click. Game changer for my open source projects.'
  },
  {
    name: 'Elena Kowalski',
    handle: '@elena_pm',
    avatar: 'EK',
    badge: 'Pro User',
    content: 'Finally a clipboard manager that actually understands what developers need. Privacy-first, beautiful design, and it just works. Been using it for 6 months straight.'
  },
];

const RELEASE_BASE = 'https://github.com/williamRR/klypt/releases/latest/download';
const GITHUB_RELEASES_API = 'https://api.github.com/repos/williamRR/klypt/releases/latest';
const WEB_APP_URL = 'https://web-zeta-one-26.vercel.app';

type Platform = { name: string; version: string; status: string; url: string };

function buildPlatforms(version: string): Platform[] {
  const v = version.replace(/^v/, '');
  return [
    { name: 'macOS',   version, status: 'stable',  url: `${RELEASE_BASE}/Klypt_${v}_aarch64.dmg` },
    { name: 'Windows', version, status: 'stable',  url: `${RELEASE_BASE}/Klypt_${v}_x64_en-US.msi` },
    { name: 'Linux',   version, status: 'stable',  url: `${RELEASE_BASE}/Klypt_${v}_amd64.AppImage` },
    { name: 'iOS',     version: 'coming', status: 'coming', url: '' },
    { name: 'Android', version: 'coming', status: 'coming', url: '' },
    { name: 'Web',     version, status: 'stable',  url: WEB_APP_URL },
  ];
}

let PLATFORMS: Platform[] = buildPlatforms('v0.1.1');

async function fetchLatestRelease(): Promise<void> {
  try {
    const res = await fetch(GITHUB_RELEASES_API);
    if (!res.ok) return;
    const data = await res.json();
    const version: string = data.tag_name ?? 'v0.1.1';
    PLATFORMS = buildPlatforms(version);
    // Re-render the download section with updated data
    const grid = document.querySelector('.platforms-grid');
    if (grid) grid.innerHTML = renderPlatformCards();
  } catch (_) { /* silently fallback to defaults */ }
}

function renderPlatformCards(): string {
  return PLATFORMS.map(platform => `
    <div class="platform-card">
      <div class="platform-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      </div>
      <div class="platform-name">${platform.name}</div>
      <div class="platform-version">${platform.version}</div>
      <span class="platform-status ${platform.status}">${platform.status}</span>
      <div class="platform-download">
        ${platform.status !== 'coming' ? `
          <a href="${platform.url}" class="btn btn-secondary btn-sm" style="width: 100%; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 6px;" ${platform.name !== 'Web' ? 'download' : 'target="_blank"'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            ${platform.name === 'Web' ? 'Open App' : 'Download'}
          </a>
        ` : `
          <button class="btn btn-ghost btn-sm" style="width: 100%;" disabled>Coming Soon</button>
        `}
      </div>
    </div>
  `).join('');
}

function renderLanding(): void {
  const root = document.getElementById('landing-root');
  if (!root) return;

  root.innerHTML = '';
  root.appendChild(createLandingApp());
  initScrollAnimations();
  initFaqAccordions();
  initMobileNav();
  initDemoClips();
}

function createLandingApp(): HTMLElement {
  const app = document.createElement('div');
  app.className = 'landing-app';

  app.appendChild(createNavbar());
  app.appendChild(createHero());
  app.appendChild(createBento());
  app.appendChild(createHowItWorks());
  app.appendChild(createAiDemo());
  app.appendChild(createPricing());
  app.appendChild(createPlatforms());
  app.appendChild(createSocialProof());
  app.appendChild(createFaq());
  app.appendChild(createFooter());

  return app;
}

function createNavbar(): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'landing-nav';
  nav.id = 'landing-nav';

  nav.innerHTML = `
    <div class="nav-container">
      <a href="#" class="nav-logo" onclick="event.preventDefault(); window.location.hash = ''">
        <div class="nav-logo-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <span>Quick<span class="nav-logo-y">y</span>Memo</span>
      </a>
      
      <ul class="nav-links">
        <li><a href="#features">Features</a></li>
        <li><a href="#how-it-works">How It Works</a></li>
        <li><a href="#pricing">Pricing</a></li>
        <li><a href="#download">Download</a></li>
      </ul>
      
      <div class="nav-actions">
        <button class="btn btn-secondary btn-sm" onclick="window.location.hash = 'app'">Open App</button>
        <button class="btn btn-primary btn-sm" onclick="window.location.hash = 'app'">Get Started</button>
        <button class="nav-mobile-toggle" id="mobile-nav-toggle" aria-label="Toggle menu">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  return nav;
}

function createHero(): HTMLElement {
  const hero = document.createElement('section');
  hero.className = 'hero landing-section';
  hero.id = 'hero';

  hero.innerHTML = `
    <div class="hero-container">
      <div class="hero-content">
        <div class="hero-badge">
          <span class="hero-badge-dot"></span>
          Now with AI Handbook
        </div>
        <h1 class="hero-title">
          <span class="hero-title-word">Your</span>
          <span class="hero-title-word">clipboard,</span>
          <span class="hero-title-word hero-title-violet">everywhere</span>
        </h1>
        <p class="hero-subtitle">
          Klypt syncs your notes and clipboard history across all your devices in real-time. 
          Code snippets, credentials, URLs — always at your fingertips.
        </p>
        <div class="hero-cta">
          <button class="btn btn-primary btn-lg" onclick="window.location.hash = 'app'">
            Start Free
            <ArrowRight size={18} />
          </button>
          <span class="hero-cta-note">No credit card required</span>
        </div>
      </div>
      
      <div class="hero-visual">
        <div class="hero-demo">
          <div class="demo-header">
            <span class="demo-dot demo-dot-red"></span>
            <span class="demo-dot demo-dot-yellow"></span>
            <span class="demo-dot demo-dot-green"></span>
            <div class="demo-sync-badge">
              <span class="demo-sync-dot"></span>
              Synced · &lt;500ms
            </div>
          </div>
          <div id="hero-clips"></div>
        </div>
      </div>
    </div>
  `;

  return hero;
}

function createBento(): HTMLElement {
  const bento = document.createElement('section');
  bento.className = 'bento landing-section';
  bento.id = 'features';

  bento.innerHTML = `
    <div class="bento-container">
      <span class="section-label">Features</span>
      <h2 class="section-title">Everything you need, nothing you don't</h2>
      <p class="section-subtitle">
        A complete clipboard and notes solution designed for developers. 
        Fast, secure, and beautifully simple.
      </p>
      
      <div class="bento-grid">
        <div class="bento-card bento-card-lg">
          <div class="bento-card-icon">
            <Zap size={24} />
          </div>
          <h3 class="bento-card-title">Real-time Sync</h3>
          <p class="bento-card-text">
            Your clipboard history syncs instantly across all devices. Copy on Mac, paste on iPhone. 
            No waiting, no manual sync buttons.
          </p>
          <div class="bento-card-visual">
            <div class="bento-visual-header">
              <span class="bento-visual-dot"></span>
              <div class="bento-visual-line"></div>
              <div class="bento-visual-line"></div>
              <div class="bento-visual-line"></div>
            </div>
            <div class="bento-visual-bars">
              <div class="bento-visual-bar"></div>
              <div class="bento-visual-bar"></div>
              <div class="bento-visual-bar"></div>
              <div class="bento-visual-bar"></div>
              <div class="bento-visual-bar"></div>
              <div class="bento-visual-bar"></div>
              <div class="bento-visual-bar"></div>
            </div>
          </div>
        </div>
        
        <div class="bento-card bento-card-md">
          <div class="bento-mini-icon teal">
            <Search size={20} />
          </div>
          <h4 class="bento-mini-title">Semantic Search</h4>
          <p class="bento-mini-text">
            Find anything instantly with fuzzy search. No need to remember exact words.
          </p>
        </div>
        
        <div class="bento-card bento-card-md">
          <div class="bento-mini-icon amber">
            <Shield size={20} />
          </div>
          <h4 class="bento-mini-title">End-to-End Encrypted</h4>
          <p class="bento-mini-text">
            Your data is encrypted before it leaves your device. We can't read it.
          </p>
        </div>
        
        <div class="bento-card bento-card-md">
          <div class="bento-mini-icon blue">
            <FileText size={20} />
          </div>
          <h4 class="bento-mini-title">Smart Content Types</h4>
          <p class="bento-mini-text">
            Automatically detects code, URLs, credentials, and plain text.
          </p>
        </div>
        
        <div class="bento-card bento-card-md">
          <div class="bento-mini-icon violet">
            <Sparkles size={20} />
          </div>
          <h4 class="bento-mini-title">AI Handbook</h4>
          <p class="bento-mini-text">
            Generate documentation from your clips with one click. Pro feature.
          </p>
        </div>
      </div>
    </div>
  `;

  return bento;
}

function createHowItWorks(): HTMLElement {
  const how = document.createElement('section');
  how.className = 'how-it-works landing-section';
  how.id = 'how-it-works';

  how.innerHTML = `
    <div class="how-container">
      <div style="text-align: center;">
        <span class="section-label">How It Works</span>
        <h2 class="section-title">Up and running in 60 seconds</h2>
      </div>
      
      <div class="steps">
        <div class="step" data-step="1">
          <div class="step-number">1</div>
          <div class="step-connector">
            <div class="step-connector-fill" id="connector-1"></div>
          </div>
          <h3 class="step-title">Install Klypt</h3>
          <p class="step-text">
            Download for macOS, Windows, Linux, iOS, or Android. Takes 30 seconds.
          </p>
          <div class="step-visual">
            <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
              <rect x="10" y="10" width="100" height="60" rx="8" stroke="var(--violet)" stroke-width="2"/>
              <rect x="20" y="25" width="40" height="30" rx="4" fill="var(--violet-dim)"/>
              <text x="40" y="45" font-size="10" fill="var(--violet)" text-anchor="middle">Mac</text>
              <rect x="70" y="25" width="30" height="30" rx="4" fill="var(--bg-surface)"/>
              <text x="85" y="45" font-size="8" fill="var(--text-muted)" text-anchor="middle">Win</text>
            </svg>
          </div>
        </div>
        
        <div class="step" data-step="2">
          <div class="step-number">2</div>
          <div class="step-connector">
            <div class="step-connector-fill" id="connector-2"></div>
          </div>
          <h3 class="step-title">Sign in with OAuth</h3>
          <p class="step-text">
            Use your Google or GitHub account. No new password to remember.
          </p>
          <div class="step-visual">
            <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
              <rect x="30" y="15" width="60" height="50" rx="6" fill="var(--bg-surface)" stroke="var(--bg-border)"/>
              <circle cx="45" cy="35" r="8" fill="var(--coral-dim)"/>
              <rect x="55" y="28" width="25" height="14" rx="2" fill="var(--bg-elevated)"/>
              <rect x="40" y="50" width="40" height="8" rx="2" fill="var(--violet-dim)"/>
            </svg>
          </div>
        </div>
        
        <div class="step" data-step="3">
          <div class="step-number">3</div>
          <h3 class="step-title">Start copying</h3>
          <p class="step-text">
            That's it. Your clipboard syncs automatically. Open on any device to paste.
          </p>
          <div class="step-visual">
            <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
              <rect x="5" y="20" width="45" height="40" rx="6" fill="var(--bg-surface)" stroke="var(--violet)"/>
              <rect x="70" y="20" width="45" height="40" rx="6" fill="var(--bg-surface)" stroke="var(--violet)"/>
              <path d="M55 40 L65 40 M60 35 L65 40 L60 45" stroke="var(--teal)" stroke-width="2"/>
              <rect x="12" y="35" width="30" height="10" rx="2" fill="var(--violet-dim)"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  `;

  return how;
}

function createAiDemo(): HTMLElement {
  const ai = document.createElement('section');
  ai.className = 'ai-demo landing-section';
  ai.id = 'ai-demo';

  ai.innerHTML = `
    <div class="ai-container">
      <div style="text-align: center;">
        <span class="section-label">AI Handbook</span>
        <h2 class="section-title">Turn clips into documentation</h2>
        <p class="section-subtitle" style="margin-left: auto; margin-right: auto;">
          Select your code snippets and notes, click generate, and get beautifully formatted documentation.
        </p>
      </div>
      
      <div class="ai-demo-card">
        <div class="ai-demo-header">
          <div>
            <div class="ai-demo-title">Generate Documentation</div>
            <div class="ai-demo-subtitle">Select clips to include in your handbook</div>
          </div>
          <div class="ai-pro-badge">
            <Star size={12} />
            Pro Feature
          </div>
        </div>
        
        <div class="ai-demo-grid" id="demo-clips">
          ${DEMO_CLIPS.map(clip => `
            <div class="ai-clip-item ${clip.selected ? 'selected' : ''}" data-id="${clip.id}">
              <div class="ai-clip-checkbox">
                ${clip.selected ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
              </div>
              <div class="ai-clip-content">
                <div class="ai-clip-title">${clip.title}</div>
                <div class="ai-clip-type">${clip.type}</div>
              </div>
            </div>
          `).join('')}
        </div>
        
        <button class="btn btn-primary" id="generate-doc-btn">
          <Sparkles size={16} />
          Generate Documentation
        </button>
        
        <div class="ai-demo-output" id="ai-output">
          <div class="ai-output-label">Output</div>
          <div class="ai-output-content" id="ai-output-content">
            Select clips and click generate to create documentation...
          </div>
        </div>
      </div>
    </div>
  `;

  return ai;
}

function createPricing(): HTMLElement {
  const pricing = document.createElement('section');
  pricing.className = 'pricing landing-section';
  pricing.id = 'pricing';

  pricing.innerHTML = `
    <div class="pricing-container">
      <div style="text-align: center;">
        <span class="section-label">Pricing</span>
        <h2 class="section-title">Simple, transparent pricing</h2>
        <p class="section-subtitle" style="margin-left: auto; margin-right: auto;">
          Start free, upgrade when you need more power.
        </p>
      </div>
      
      <div class="pricing-toggle">
        <span class="pricing-toggle-label active" data-period="monthly">Monthly</span>
        <button class="pricing-toggle-switch" id="pricing-toggle">
          <span class="pricing-toggle-knob"></span>
        </button>
        <span class="pricing-toggle-label" data-period="yearly">Yearly</span>
        <span class="pricing-save-badge">Save 2 months</span>
      </div>
      
      <div class="pricing-grid">
        <div class="pricing-card">
          <div class="pricing-card-header">
            <div class="pricing-card-name">Free</div>
            <div class="pricing-card-desc">Perfect for getting started</div>
          </div>
          <div class="pricing-card-price">
            <span class="pricing-card-price-value">$0</span>
            <span class="pricing-card-price-period">/ forever</span>
          </div>
          <ul class="pricing-card-features">
            <li>
              <span class="pricing-check"><Check size={12} /></span>
              100 notes
            </li>
            <li>
              <span class="pricing-check"><Check size={12} /></span>
              50 clipboard items
            </li>
            <li>
              <span class="pricing-check"><Check size={12} /></span>
              2 devices
            </li>
            <li>
              <span class="pricing-check"><Check size={12} /></span>
              Local encryption
            </li>
          </ul>
          <button class="btn btn-secondary" style="width: 100%;" onclick="window.location.hash = 'app'">
            Get Started
          </button>
        </div>
        
        <div class="pricing-card featured">
          <div class="pricing-card-header">
            <div class="pricing-card-name">Pro</div>
            <div class="pricing-card-desc">For power users and teams</div>
          </div>
          <div class="pricing-card-price">
            <span class="pricing-card-price-value" id="pro-price">$8</span>
            <span class="pricing-card-price-period" id="pro-period">/ month</span>
          </div>
          <ul class="pricing-card-features">
            <li>
              <span class="pricing-check"><Check size={12} /></span>
              Unlimited notes
            </li>
            <li>
              <span class="pricing-check"><Check size={12} /></span>
              Unlimited clipboard history
            </li>
            <li>
              <span class="pricing-check"><Check size={12} /></span>
              Unlimited devices
            </li>
            <li>
              <span class="pricing-check"><Check size={12} /></span>
              Cloud sync + E2E encryption
            </li>
            <li>
              <span class="pricing-check"><Check size={12} /></span>
              AI Handbook (100 generations/mo)
            </li>
            <li>
              <span class="pricing-check"><Check size={12} /></span>
              Priority support
            </li>
          </ul>
          <button class="btn btn-primary" style="width: 100%;" onclick="window.location.hash = 'app'">
            Start 14-day Trial
          </button>
        </div>
      </div>
    </div>
  `;

  return pricing;
}

function createPlatforms(): HTMLElement {
  const platforms = document.createElement('section');
  platforms.className = 'platforms landing-section';
  platforms.id = 'download';

  platforms.innerHTML = `
    <div class="platforms-container">
      <div style="text-align: center;">
        <span class="section-label">Download</span>
        <h2 class="section-title">Available on all your devices</h2>
        <p class="section-subtitle" style="margin-left: auto; margin-right: auto;">
          One subscription, all platforms. Your data follows you everywhere.
        </p>
      </div>
      
      <div class="platforms-grid">
        ${renderPlatformCards()}
      </div>
    </div>
  `;

  return platforms;
}

function createSocialProof(): HTMLElement {
  const social = document.createElement('section');
  social.className = 'social-proof landing-section';

  social.innerHTML = `
    <div class="social-container">
      <div style="text-align: center;">
        <span class="section-label">Testimonials</span>
        <h2 class="section-title">Loved by developers worldwide</h2>
      </div>
      
      <div class="social-grid">
        ${SOCIAL_PROOF.map(item => `
          <div class="social-card">
            <div class="social-card-header">
              <div class="social-avatar">${item.avatar}</div>
              <div class="social-author">
                <div class="social-name">${item.name}</div>
                <div class="social-handle">${item.handle}</div>
              </div>
              <div class="social-badge">
                <Check size={10} />
                ${item.badge}
              </div>
            </div>
            <p class="social-content">${item.content}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  return social;
}

function createFaq(): HTMLElement {
  const faq = document.createElement('section');
  faq.className = 'faq landing-section';

  faq.innerHTML = `
    <div class="faq-container">
      <div style="text-align: center;">
        <span class="section-label">FAQ</span>
        <h2 class="section-title">Frequently asked questions</h2>
      </div>
      
      <div class="faq-list">
        ${FAQ_ITEMS.map((item, index) => `
          <div class="faq-item" data-index="${index}">
            <button class="faq-question">
              ${item.question}
              <span class="faq-icon">
                <ChevronDown size={20} />
              </span>
            </button>
            <div class="faq-answer">
              <p>${item.answer}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  return faq;
}

function createFooter(): HTMLElement {
  const footer = document.createElement('footer');
  footer.className = 'landing-footer';

  footer.innerHTML = `
    <div class="footer-container">
      <div class="footer-grid">
        <div class="footer-brand">
          <div class="footer-logo">
            <div class="nav-logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
           Klypt
          </div>
          <p class="footer-tagline">
            Your clipboard, everywhere. The notes app built for developers who value privacy and speed.
          </p>
        </div>
        
        <div class="footer-column">
          <h4>Product</h4>
          <ul class="footer-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#download">Download</a></li>
            <li><a href="#">Changelog</a></li>
          </ul>
        </div>
        
        <div class="footer-column">
          <h4>Resources</h4>
          <ul class="footer-links">
            <li><a href="#">Documentation</a></li>
            <li><a href="#">API Reference</a></li>
            <li><a href="#">GitHub</a></li>
            <li><a href="#">Community</a></li>
          </ul>
        </div>
        
        <div class="footer-column">
          <h4>Company</h4>
          <ul class="footer-links">
            <li><a href="#">About</a></li>
            <li><a href="#">Blog</a></li>
            <li><a href="#">Careers</a></li>
            <li><a href="#">Contact</a></li>
          </ul>
        </div>
      </div>
      
      <div class="footer-bottom">
        <div class="footer-legal">
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Cookie Policy</a>
        </div>
        <div class="footer-social">
          <a href="#" aria-label="GitHub">
            <Github size={18} />
          </a>
          <a href="#" aria-label="Twitter">
            <Twitter size={18} />
          </a>
        </div>
      </div>
    </div>
  `;

  return footer;
}

function initScrollAnimations(): void {
  const nav = document.getElementById('landing-nav');
  if (!nav) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  });

  const steps = document.querySelectorAll('.step');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const stepNum = entry.target.getAttribute('data-step');
        if (stepNum) {
          const connector = document.getElementById(`connector-${stepNum}`);
          if (connector) {
            connector.classList.add('visible');
          }
        }
      }
    });
  }, { threshold: 0.5 });

  steps.forEach(step => observer.observe(step));

  const heroClipsEl = document.getElementById('hero-clips');
  if (heroClipsEl) {
    const clipsContainer = heroClipsEl;
    let clipIndex = 0;

    function updateClips() {
      clipsContainer.innerHTML = FEATURED_CLIPS.map((clip, i) => `
        <div class="demo-clip" style="animation-delay: ${i * 100}ms">
          <div class="demo-clip-header">
            <span class="demo-clip-type ${clip.type}">${clip.type}</span>
            <span class="demo-clip-time">${clip.time}</span>
          </div>
          <div class="demo-clip-content ${clip.type === 'code' ? 'code' : ''}">${escapeHtml(clip.content)}</div>
        </div>
      `).join('');
    }

    updateClips();
    setInterval(() => {
      clipIndex = (clipIndex + 1) % FEATURED_CLIPS.length;
      const newClip = FEATURED_CLIPS[clipIndex];
      const firstClip = clipsContainer.firstElementChild;
      if (firstClip) {
        firstClip.innerHTML = `
          <div class="demo-clip-header">
            <span class="demo-clip-type ${newClip.type}">${newClip.type}</span>
            <span class="demo-clip-time">${newClip.time}</span>
          </div>
          <div class="demo-clip-content ${newClip.type === 'code' ? 'code' : ''}">${escapeHtml(newClip.content)}</div>
        `;
        (firstClip as HTMLElement).style.animation = 'none';
        (firstClip as HTMLElement).offsetHeight;
        (firstClip as HTMLElement).style.animation = 'slideIn 0.4s var(--ease-snap)';
        clipsContainer.appendChild(firstClip);
      }
    }, 3000);
  }
}

function initFaqAccordions(): void {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    if (question) {
      question.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        faqItems.forEach(i => i.classList.remove('open'));
        if (!isOpen) {
          item.classList.add('open');
        }
      });
    }
  });
}

function initMobileNav(): void {
  const toggle = document.getElementById('mobile-nav-toggle');
  if (!toggle) return;

  let sheet: HTMLElement | null = document.querySelector('.mobile-nav-sheet');
  let overlay: HTMLElement | null = document.querySelector('.mobile-nav-overlay');

  if (!sheet) {
    sheet = document.createElement('div');
    sheet.className = 'mobile-nav-sheet';
    sheet.innerHTML = `
      <button class="mobile-nav-close" style="position: absolute; top: 20px; right: 20px; background: none; border: none; color: var(--text-primary); cursor: pointer;">
        <X size={24} />
      </button>
      <ul class="mobile-nav-links">
        <li><a href="#features">Features</a></li>
        <li><a href="#how-it-works">How It Works</a></li>
        <li><a href="#pricing">Pricing</a></li>
        <li><a href="#download">Download</a></li>
      </ul>
      <button class="btn btn-primary" style="width: 100%;">Get Started</button>
    `;
    document.body.appendChild(sheet);

    overlay = document.createElement('div');
    overlay.className = 'mobile-nav-overlay';
    document.body.appendChild(overlay);

    const closeBtn = sheet.querySelector('.mobile-nav-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeNav);
    }

    overlay.addEventListener('click', closeNav);

    sheet.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeNav);
    });
  }

  function closeNav() {
    sheet?.classList.remove('open');
    overlay?.classList.remove('open');
  }

  toggle.addEventListener('click', () => {
    sheet?.classList.add('open');
    overlay?.classList.add('open');
  });
}

function initDemoClips(): void {
  const clips = document.querySelectorAll('.ai-clip-item');
  const generateBtn = document.getElementById('generate-doc-btn');
  const outputContentEl = document.getElementById('ai-output-content');

  if (!generateBtn || !outputContentEl) return;

  clips.forEach(clip => {
    clip.addEventListener('click', () => {
      clip.classList.toggle('selected');
      const checkbox = clip.querySelector('.ai-clip-checkbox');
      if (checkbox) {
        if (clip.classList.contains('selected')) {
          checkbox.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
        } else {
          checkbox.innerHTML = '';
        }
      }
    });
  });

  generateBtn.addEventListener('click', () => {
    const selectedClips = document.querySelectorAll('.ai-clip-item.selected');
    if (selectedClips.length === 0) {
      if (outputContentEl) outputContentEl.innerHTML = 'Please select at least one clip to generate documentation.';
      return;
    }

    const sampleDoc = `# API Configuration Handbook

## Overview
This document consolidates your selected code snippets and configuration notes into a comprehensive reference.

## Contents

### 1. Database Configuration
\`\`\`sql
SELECT * FROM users WHERE id = $1
\`\`\`

### 2. API Setup
\`\`\`javascript
const apiKey = process.env.OPENAI_KEY;
\`\`\`

### 3. Usage Notes
- Store sensitive keys in environment variables
- Use parameterized queries to prevent SQL injection
- Keep API keys rotated every 90 days

## Generated by Klypt AI Handbook`;

    if (outputContentEl) {
      const outputEl = outputContentEl;
      outputEl.innerHTML = '';
      let charIndex = 0;

      const cursor = document.createElement('span');
      cursor.className = 'ai-output-cursor';

      function typeChar() {
        if (charIndex < sampleDoc.length) {
          outputEl.textContent = sampleDoc.slice(0, charIndex + 1);
          outputEl.appendChild(cursor);
          charIndex++;
          setTimeout(typeChar, 15);
        } else {
          cursor.remove();
        }
      }

      typeChar();
    }
  });

  const pricingToggle = document.getElementById('pricing-toggle');
  const proPrice = document.getElementById('pro-price');
  const proPeriod = document.getElementById('pro-period');
  const toggleLabels = document.querySelectorAll('.pricing-toggle-label');

  if (pricingToggle && proPrice && proPeriod) {
    let isYearly = false;

    pricingToggle.addEventListener('click', () => {
      isYearly = !isYearly;
      pricingToggle.classList.toggle('active', isYearly);

      toggleLabels.forEach(label => {
        label.classList.toggle('active', label.getAttribute('data-period') === (isYearly ? 'yearly' : 'monthly'));
      });

      if (isYearly) {
        proPrice.textContent = '$72';
        proPeriod.textContent = '/ year';
      } else {
        proPrice.textContent = '$8';
        proPeriod.textContent = '/ month';
      }
    });
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function mountLanding(): void {
  renderLanding();
  fetchLatestRelease();
}

export function unmountLanding(): void {
  const root = document.getElementById('landing-root');
  if (root) {
    root.innerHTML = '';
  }
}
