// Reusable UI components
export function riskBadge(level) {
  const map = {
    compliant: { bg: '#10b981', text: '\u5408\u89c4', icon: '\u2705' },
    high_risk: { bg: '#f59e0b', text: '\u9ad8\u98ce\u9669', icon: '\u26a0\ufe0f' },
    infringing: { bg: '#ef4444', text: '\u4fb5\u6743', icon: '\u274c' },
    unchecked: { bg: '#6b7280', text: '\u672a\u68c0\u67e5', icon: '\u2b55' },
  };
  const { bg, text, icon } = map[level] || map.unchecked;
  return `<span class="risk-badge" style="background:${bg}">${icon} ${text}</span>`;
}

export function imageCard(src, title, extra = '') {
  return `<div class="image-card"><img src="${src}" alt="${title}" loading="lazy"><div class="image-card-title">${title}</div>${extra}</div>`;
}

export function statCard(label, value, icon, color) {
  return `<div class="stat-card" style="border-left:4px solid ${color}"><div class="stat-icon">${icon}</div><div><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div></div>`;
}

export function loading(msg = '\u5904\u7406\u4e2d...') {
  return `<div class="loading"><div class="spinner"></div><p>${msg}</p></div>`;
}

export function btn(text, cls = 'primary', attrs = '') {
  return `<button class="btn btn-${cls}" ${attrs}>${text}</button>`;
}

export function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add('show'); }, 10);
  setTimeout(() => { el.remove(); }, 3000);
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}
