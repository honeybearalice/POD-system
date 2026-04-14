// Simple hash-based SPA router
const routes = {};
let currentPage = null;

export function route(path, handler) {
  routes[path] = handler;
}

export function navigate(path) {
  window.location.hash = path;
}

export function start(defaultPath = '/dashboard') {
  window.addEventListener('hashchange', () => render());
  if (!window.location.hash) window.location.hash = defaultPath;
  else render();
}

function render() {
  const path = window.location.hash.slice(1) || '/dashboard';
  const handler = routes[path];
  if (handler) {
    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === path);
    });
    const main = document.getElementById('main-content');
    if (main) {
      currentPage = path;
      handler(main);
    }
  }
}
