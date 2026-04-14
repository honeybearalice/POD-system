import * as api from '../lib/api.js';
import { statCard } from '../lib/components.js';

const ACTIVITY_ICONS = { image: '\ud83d\uddbc\ufe0f', design: '\ud83c\udfa8', product: '\ud83d\udce6', mockup: '\ud83d\udcf1' };
const ACTIVITY_LABELS = { uploaded: '\u4e0a\u4f20\u4e86\u56fe\u7247', extracted: '\u63d0\u53d6\u4e86\u8bbe\u8ba1\u7a3f', created: '\u521b\u5efa\u4e86\u4ea7\u54c1', generated: '\u751f\u6210\u4e86\u6548\u679c\u56fe' };

export async function render(container) {
  container.innerHTML = `
    <div class="page-header"><h1>\u4eea\u8868\u76d8</h1><p>AI-POD \u63a7\u5236\u4e2d\u5fc3</p></div>
    <div id="stats-grid" class="stats-grid"><div class="loading"><div class="spinner"></div></div></div>
    <div class="card mt-1">
      <h3>\u5de5\u4f5c\u6d41\u8fdb\u5ea6</h3>
      <div id="pipeline" class="workflow-pipeline"></div>
    </div>
    <div class="two-col mt-1">
      <div class="card">
        <h3>\u5feb\u6377\u64cd\u4f5c</h3>
        <div class="quick-actions">
          <a href="#/collect" class="quick-action"><span class="qa-icon">\ud83d\udd0d</span>\u91c7\u96c6\u56fe\u7247</a>
          <a href="#/extract" class="quick-action"><span class="qa-icon">\u2702\ufe0f</span>\u62a0\u56fe\u63d0\u53d6</a>
          <a href="#/mockup" class="quick-action"><span class="qa-icon">\ud83d\uddbc\ufe0f</span>\u751f\u6210\u6548\u679c\u56fe</a>
          <a href="#/listing" class="quick-action"><span class="qa-icon">\ud83d\ude80</span>\u4e0a\u67b6\u4ea7\u54c1</a>
        </div>
      </div>
      <div class="card">
        <h3>\u6700\u8fd1\u52a8\u6001</h3>
        <ul id="recent-activity" class="activity-list"><li class="muted">\u52a0\u8f7d\u4e2d...</li></ul>
      </div>
    </div>`;

  try {
    const stats = await api.getStats();
    document.getElementById('stats-grid').innerHTML = `
      ${statCard('\u56fe\u7247\u603b\u6570', stats.images, '\ud83d\uddbc\ufe0f', '#6366f1')}
      ${statCard('\u8bbe\u8ba1\u7a3f', stats.designs, '\ud83c\udfa8', '#8b5cf6')}
      ${statCard('\u6548\u679c\u56fe', stats.mockups, '\ud83d\udcf1', '#06b6d4')}
      ${statCard('\u4ea7\u54c1', stats.products, '\ud83d\udce6', '#10b981')}
      ${statCard('\u5408\u89c4', stats.risk.compliant, '\u2705', '#10b981')}
      ${statCard('\u9ad8\u98ce\u9669', stats.risk.highRisk, '\u26a0\ufe0f', '#f59e0b')}
      ${statCard('\u4fb5\u6743', stats.risk.infringing, '\u274c', '#ef4444')}`;

    // Pipeline
    document.getElementById('pipeline').innerHTML = `
      <div class="pipeline-step"><span class="step-count">${stats.images}</span><span class="step-label">\u91c7\u96c6</span></div>
      <span class="pipeline-arrow">\u2192</span>
      <div class="pipeline-step"><span class="step-count">${stats.designs}</span><span class="step-label">\u62a0\u56fe</span></div>
      <span class="pipeline-arrow">\u2192</span>
      <div class="pipeline-step"><span class="step-count">${stats.mockups}</span><span class="step-label">\u6548\u679c\u56fe</span></div>
      <span class="pipeline-arrow">\u2192</span>
      <div class="pipeline-step"><span class="step-count">${stats.products}</span><span class="step-label">\u4e0a\u67b6</span></div>`;
  } catch (e) {
    document.getElementById('stats-grid').innerHTML = '<p class="error">\u52a0\u8f7d\u7edf\u8ba1\u5931\u8d25</p>';
  }

  // Recent activity
  try {
    const recent = await api.getRecent();
    const list = document.getElementById('recent-activity');
    if (!recent.length) {
      list.innerHTML = '<li class="muted">\u8fd8\u6ca1\u6709\u4efb\u4f55\u64cd\u4f5c\u8bb0\u5f55</li>';
    } else {
      list.innerHTML = recent.slice(0, 10).map(r => {
        const time = new Date(r.created_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const icon = ACTIVITY_ICONS[r.type] || '\ud83d\udccc';
        const label = ACTIVITY_LABELS[r.action] || r.action;
        const detail = r.detail ? ` - ${r.detail.substring(0, 30)}` : '';
        return `<li class="activity-item"><span class="activity-icon">${icon}</span><span>${label}${detail}</span><span class="activity-time">${time}</span></li>`;
      }).join('');
    }
  } catch {
    document.getElementById('recent-activity').innerHTML = '<li class="muted">\u52a0\u8f7d\u5931\u8d25</li>';
  }
}
