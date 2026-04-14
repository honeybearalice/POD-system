import { route, start } from './lib/router.js';
import { render as dashboard } from './pages/dashboard.js';
import { render as collect } from './pages/collect.js';
import { render as extract } from './pages/extract.js';
import { render as mockup } from './pages/mockup.js';
import { render as listing } from './pages/listing.js';
import { render as settings } from './pages/settings.js';
import { connectSSE } from './lib/api.js';

route('/dashboard', dashboard);
route('/collect', collect);
route('/extract', extract);
route('/mockup', mockup);
route('/listing', listing);
route('/settings', settings);

start('/dashboard');

// SSE notifications
const badges = {};
connectSSE((event) => {
  if (event.type === 'scrape:done') addBadge('/collect', event.imageCount);
  if (event.type === 'design:created') addBadge('/extract', 1);
  if (event.type === 'image:uploaded') addBadge('/collect', 1);
});

function addBadge(page, count) {
  badges[page] = (badges[page] || 0) + count;
  const nav = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (!nav) return;
  // Don't show badge on active page
  if (nav.classList.contains('active')) { badges[page] = 0; return; }
  let badge = nav.querySelector('.nav-badge');
  if (!badge) { badge = document.createElement('span'); badge.className = 'nav-badge'; nav.appendChild(badge); }
  badge.textContent = badges[page];
}

// Clear badge when navigating to page
window.addEventListener('hashchange', () => {
  const page = window.location.hash.slice(1);
  badges[page] = 0;
  const nav = document.querySelector(`.nav-item[data-page="${page}"]`);
  const badge = nav?.querySelector('.nav-badge');
  if (badge) badge.remove();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Don't trigger if typing in input/textarea
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const pages = ['/dashboard', '/collect', '/extract', '/mockup', '/listing', '/settings'];
  const num = parseInt(e.key);
  if (num >= 1 && num <= 6) {
    window.location.hash = pages[num - 1];
  }
});
