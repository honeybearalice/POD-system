import * as api from '../lib/api.js';
import { riskBadge, loading, toast } from '../lib/components.js';
import { open as lightbox } from '../lib/lightbox.js';

export function render(container) {
  container.innerHTML = `
    <div class="page-header"><h1>\u667a\u80fd\u91c7\u96c6</h1><p>\u4ece\u7535\u5546\u5e73\u53f0\u62d3\u53d6\u4ea7\u54c1\u56fe\u7247</p></div>
    <div class="card">
      <h3>\u7c98\u8d34\u4ea7\u54c1\u94fe\u63a5</h3>
      <div class="input-row">
        <input type="text" id="scrape-url" placeholder="https://www.temu.com/... \u6216 Amazon/Etsy \u94fe\u63a5" class="input-full">
        <button class="btn btn-primary" id="btn-scrape">\u5f00\u59cb\u62d3\u53d6</button>
      </div>
      <div class="platform-tags">
        <span class="tag">TEMU</span><span class="tag">Amazon</span><span class="tag">Etsy</span><span class="tag">Shopify</span>
      </div>
    </div>
    <div id="scrape-result"></div>
    <div class="card">
      <h3>\u6216\u8005\u76f4\u63a5\u4e0a\u4f20\u56fe\u7247</h3>
      <div class="upload-zone" id="upload-zone">
        <p>\u62d6\u62fd\u56fe\u7247\u5230\u6b64\u5904\uff0c\u6216\u70b9\u51fb\u9009\u62e9\u6587\u4ef6</p>
        <input type="file" id="file-input" multiple accept="image/*" hidden>
      </div>
      <div id="upload-result" class="image-grid"></div>
    </div>`;

  const urlInput = document.getElementById('scrape-url');
  const btnScrape = document.getElementById('btn-scrape');
  const resultDiv = document.getElementById('scrape-result');
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');
  const uploadResult = document.getElementById('upload-result');

  btnScrape.onclick = async () => {
    const url = urlInput.value.trim();
    if (!url) return;
    if (!/^https?:\/\/.+\..+/.test(url)) { toast('\u8bf7\u8f93\u5165\u6709\u6548\u7684\u7f51\u5740', 'error'); return; }
    btnScrape.disabled = true;
    resultDiv.innerHTML = `<div class="card"><div class="progress-bar-container"><div class="progress-bar"></div></div><p class="muted text-center mt-1">\u6b63\u5728\u62d3\u53d6\u4ea7\u54c1\u56fe\u7247\uff0c\u8bf7\u7a0d\u5019\uff08\u6700\u591a60\u79d2\uff09...</p></div>`;
    try {
      const job = await api.scrape(url);
      let result;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        result = await api.pollScrape(job.id);
        if (result.status !== 'scraping') break;
      }
      if (result.status === 'done' && result.images?.length) {
        renderScrapedImages(result, resultDiv);
      } else {
        resultDiv.innerHTML = `<div class="card"><p class="error">\u62d3\u53d6\u5931\u8d25\u6216\u672a\u627e\u5230\u56fe\u7247: ${result.error || result.status}</p></div>`;
      }
    } catch (e) {
      resultDiv.innerHTML = `<div class="card"><p class="error">${e.message}</p></div>`;
    }
    btnScrape.disabled = false;
  };

  uploadZone.onclick = () => fileInput.click();
  uploadZone.ondragover = e => { e.preventDefault(); uploadZone.classList.add('dragover'); };
  uploadZone.ondragleave = () => uploadZone.classList.remove('dragover');
  uploadZone.ondrop = e => { e.preventDefault(); uploadZone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); };
  fileInput.onchange = () => handleFiles(fileInput.files);

  async function handleFiles(files) {
    for (const file of files) {
      const result = await api.upload(file);
      // Use server path for the image, not blob URL
      const filename = result.path.split('/').pop();
      uploadResult.innerHTML += `<div class="image-card" data-id="${result.id}">
        <img src="/app/files/uploads/${filename}" loading="lazy">
        <div class="image-card-title">${file.name}</div></div>`;
    }
    if (files.length) toast(`\u5df2\u4e0a\u4f20 ${files.length} \u5f20\u56fe\u7247`);
  }
}

function renderScrapedImages(result, container) {
  const images = result.images;
  container.innerHTML = `<div class="card">
    <h3>\u5df2\u62d3\u53d6 ${images.length} \u5f20\u56fe\u7247\uff08\u6765\u81ea ${result.platform || '\u7f51\u7ad9'}\uff09</h3>
    <div class="action-bar">
      <button class="btn btn-sm btn-secondary" id="btn-select-all">\u5168\u9009</button>
      <button class="btn btn-sm btn-secondary" id="btn-deselect-all">\u53d6\u6d88\u5168\u9009</button>
    </div>
    <div class="image-grid" id="scraped-grid">${images.map(img => {
      const filename = img.path.split('/').pop();
      const dir = img.path.includes('/') ? img.path.split('/data/')[1] : `uploads/${filename}`;
      const src = `/app/files/${dir}`;
      return `<div class="image-card scraped-img selected" data-id="${img.id}">
        <img src="${src}" loading="lazy">
        <div class="image-card-overlay"><input type="checkbox" checked></div>
      </div>`;
    }).join('')}</div>
    <div class="action-bar" id="scrape-actions">
      <button class="btn btn-primary" id="btn-check-all">IP \u98ce\u9669\u68c0\u6d4b</button>
      <button class="btn btn-success" id="btn-goto-extract">\u53bb\u62a0\u56fe\u63d0\u53d6 \u2192</button>
    </div></div>`;

  // Select / deselect all
  document.getElementById('btn-select-all')?.addEventListener('click', () => {
    container.querySelectorAll('.scraped-img').forEach(c => { c.classList.add('selected'); c.querySelector('input').checked = true; });
  });
  document.getElementById('btn-deselect-all')?.addEventListener('click', () => {
    container.querySelectorAll('.scraped-img').forEach(c => { c.classList.remove('selected'); c.querySelector('input').checked = false; });
  });

  // Toggle selection
  container.querySelectorAll('.scraped-img').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const cb = card.querySelector('input');
      cb.checked = !cb.checked;
      card.classList.toggle('selected', cb.checked);
    });
  });

  // Lightbox on image click
  const allSrcs = images.map(img => {
    const filename = img.path.split('/').pop();
    const dir = img.path.includes('/') ? img.path.split('/data/')[1] : `uploads/${filename}`;
    return `/app/files/${dir}`;
  });
  container.querySelectorAll('.scraped-img img').forEach((imgEl, i) => {
    imgEl.addEventListener('dblclick', (e) => { e.stopPropagation(); lightbox(allSrcs, i); });
  });

  // IP check
  document.getElementById('btn-check-all')?.addEventListener('click', async () => {
    const selected = [...container.querySelectorAll('.scraped-img.selected')].map(c => c.dataset.id);
    if (!selected.length) { toast('\u8bf7\u5148\u9009\u62e9\u56fe\u7247', 'error'); return; }
    const actionsDiv = document.getElementById('scrape-actions');
    actionsDiv.innerHTML = loading('\u6b63\u5728\u68c0\u6d4b IP \u98ce\u9669...');
    const checks = await api.ipCheckBatch(selected);
    toast(`IP \u68c0\u6d4b\u5b8c\u6210\uff1a${checks.results?.length} \u5f20\u56fe\u7247\u5df2\u626b\u63cf`);
    checks.results?.forEach(r => {
      const card = container.querySelector(`[data-id="${r.imageId}"]`);
      if (card) card.querySelector('.image-card-overlay').innerHTML = riskBadge(r.risk_level);
    });
    actionsDiv.innerHTML = `
      <button class="btn btn-danger" id="btn-delete-bad">\u5220\u9664\u4fb5\u6743\u56fe\u7247</button>
      <button class="btn btn-success" id="btn-goto-extract">\u53bb\u62a0\u56fe\u63d0\u53d6 \u2192</button>`;
    document.getElementById('btn-delete-bad')?.addEventListener('click', async () => {
      await api.deleteInfringing();
      toast('\u4fb5\u6743\u56fe\u7247\u5df2\u5220\u9664');
      container.querySelectorAll('.image-card').forEach(c => {
        if (c.querySelector('.risk-badge')?.textContent.includes('\u4fb5\u6743')) c.remove();
      });
    });
  });

  // Go to extract
  container.addEventListener('click', (e) => {
    if (e.target.id === 'btn-goto-extract' || e.target.closest('#btn-goto-extract')) {
      window.location.hash = '/extract';
    }
  });
}
