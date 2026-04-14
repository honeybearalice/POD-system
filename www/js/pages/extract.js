import * as api from '../lib/api.js';
import { loading, toast, riskBadge } from '../lib/components.js';
import { open as lightbox } from '../lib/lightbox.js';

export async function render(container) {
  container.innerHTML = `
    <div class="page-header"><h1>\u62a0\u56fe\u63d0\u53d6</h1><p>\u53bb\u9664\u80cc\u666f\uff0c\u63d0\u53d6\u5370\u5237\u7ea7\u8bbe\u8ba1\u7a3f</p></div>
    <div class="two-col">
      <div class="card">
        <h3>\u6e90\u56fe\u7247</h3>
        <div id="source-images" class="image-grid-sm">${loading('\u52a0\u8f7d\u56fe\u7247\u4e2d...')}</div>
      </div>
      <div class="card">
        <h3>\u63d0\u53d6\u7ed3\u679c</h3>
        <div id="extracted-designs" class="image-grid-sm"></div>
      </div>
    </div>`;

  const sourceDiv = document.getElementById('source-images');
  const designsDiv = document.getElementById('extracted-designs');

  // Load images
  try {
    const images = await api.getImages({ limit: 50 });
    if (!images.length) {
      sourceDiv.innerHTML = '<p class="muted">\u8fd8\u6ca1\u6709\u56fe\u7247\uff0c\u8bf7\u5148\u53bb\u300c\u667a\u80fd\u91c7\u96c6\u300d\u6dfb\u52a0\u3002</p>';
      loadExistingDesigns(designsDiv);
      return;
    }
    sourceDiv.innerHTML = images.map(img => {
      const filename = img.path.split('/').pop();
      const dir = img.scrape_job_id ? `uploads/${img.scrape_job_id}` : 'uploads';
      const thumbSrc = img.thumbnail_path ? `/app/files/thumbnails/${img.id}.jpg` : `/app/files/${dir}/${filename}`;
      const fullSrc = `/app/files/${dir}/${filename}`;
      return `<div class="image-card" data-id="${img.id}" data-full="${fullSrc}">
        <img src="${thumbSrc}" loading="lazy">
        <div class="image-card-overlay">${img.risk_level !== 'unchecked' ? riskBadge(img.risk_level) : ''}</div>
        <button class="btn btn-sm btn-primary extract-btn" data-id="${img.id}">\u63d0\u53d6</button>
      </div>`;
    }).join('');

    sourceDiv.innerHTML += `<div class="action-bar"><button class="btn btn-primary" id="btn-extract-all">\u6279\u91cf\u63d0\u53d6\u5168\u90e8</button><span class="progress-counter" id="extract-progress"></span></div>`;

    // Single extract
    sourceDiv.querySelectorAll('.extract-btn').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        btn.textContent = '...';
        btn.disabled = true;
        try {
          const result = await api.removeBg(id);
          addDesignCard(designsDiv, result.designId, result.output);
          toast('\u8bbe\u8ba1\u7a3f\u63d0\u53d6\u6210\u529f\uff01');
        } catch (err) {
          toast(err.message, 'error');
        }
        btn.textContent = '\u63d0\u53d6';
        btn.disabled = false;
      };
    });

    // Lightbox on image double click
    sourceDiv.querySelectorAll('.image-card').forEach(card => {
      card.querySelector('img').addEventListener('dblclick', (e) => {
        e.stopPropagation();
        lightbox(card.dataset.full);
      });
    });

    // Batch extract with progress
    document.getElementById('btn-extract-all')?.addEventListener('click', async () => {
      const btns = [...sourceDiv.querySelectorAll('.extract-btn:not(:disabled)')];
      const progressEl = document.getElementById('extract-progress');
      const total = btns.length;
      for (let i = 0; i < btns.length; i++) {
        progressEl.textContent = `${i + 1}/${total}`;
        const id = btns[i].dataset.id;
        btns[i].textContent = '...';
        btns[i].disabled = true;
        try {
          const result = await api.removeBg(id);
          addDesignCard(designsDiv, result.designId, result.output);
        } catch {}
        btns[i].textContent = '\u5b8c\u6210';
      }
      progressEl.textContent = '';
      toast(`\u6279\u91cf\u63d0\u53d6\u5b8c\u6210\uff01\u5171 ${total} \u5f20`);
    });
  } catch (e) {
    sourceDiv.innerHTML = `<p class="error">${e.message}</p>`;
  }

  loadExistingDesigns(designsDiv);

  // Delegate mockup button clicks
  designsDiv.addEventListener('click', e => {
    const btn = e.target.closest('.mockup-btn');
    if (btn) {
      sessionStorage.setItem('mockup-design-id', btn.dataset.id);
      window.location.hash = '/mockup';
    }
  });
}

async function loadExistingDesigns(designsDiv) {
  try {
    const designs = await api.getDesigns();
    designs.forEach(d => {
      const filename = d.path.split('/').pop();
      addDesignCard(designsDiv, d.id, `/app/files/extracted/${filename}`);
    });
  } catch {}
}

function addDesignCard(container, designId, src) {
  // Avoid duplicates
  if (container.querySelector(`[data-design-id="${designId}"]`)) return;
  const card = document.createElement('div');
  card.className = 'image-card';
  card.dataset.designId = designId;
  card.innerHTML = `<img src="${src}" loading="lazy">
    <button class="btn btn-sm btn-success mockup-btn" data-id="${designId}">\u751f\u6210\u6548\u679c\u56fe</button>`;
  card.querySelector('img').addEventListener('dblclick', () => lightbox(src));
  container.appendChild(card);
}
