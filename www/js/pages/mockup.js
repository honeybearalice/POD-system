import * as api from '../lib/api.js';
import { loading, toast } from '../lib/components.js';
import { open as lightbox } from '../lib/lightbox.js';

export async function render(container) {
  const designId = sessionStorage.getItem('mockup-design-id');

  container.innerHTML = `
    <div class="page-header"><h1>\u6548\u679c\u56fe\u751f\u6210</h1><p>\u5c06\u8bbe\u8ba1\u7a3f\u5e94\u7528\u5230\u4ea7\u54c1\u6a21\u677f</p></div>
    <div class="card">
      <h3>\u9009\u62e9\u8bbe\u8ba1\u7a3f</h3>
      <div id="design-select" class="image-grid-sm">${loading('\u52a0\u8f7d\u8bbe\u8ba1\u7a3f...')}</div>
    </div>
    <div class="card">
      <h3>\u4ea7\u54c1\u6a21\u677f <small class="muted">(\u70b9\u51fb\u9009\u62e9/\u53d6\u6d88)</small></h3>
      <div id="template-list" class="template-grid"></div>
      <div class="action-bar">
        <button class="btn btn-primary" id="btn-generate" disabled>\u751f\u6210\u6548\u679c\u56fe</button>
        <span class="progress-counter" id="gen-progress"></span>
      </div>
    </div>
    <div class="card">
      <h3>\u751f\u6210\u7ed3\u679c</h3>
      <div id="mockup-results" class="image-grid"></div>
      <div id="mockup-actions"></div>
    </div>`;

  const designSelect = document.getElementById('design-select');
  const templateList = document.getElementById('template-list');
  const btnGenerate = document.getElementById('btn-generate');
  const mockupResults = document.getElementById('mockup-results');
  const mockupActions = document.getElementById('mockup-actions');

  let selectedDesignId = designId;

  // Load designs
  try {
    const designs = await api.getDesigns();
    if (!designs.length) {
      designSelect.innerHTML = '<p class="muted">\u8fd8\u6ca1\u6709\u8bbe\u8ba1\u7a3f\uff0c\u8bf7\u5148\u53bb\u300c\u62a0\u56fe\u63d0\u53d6\u300d\u3002</p>';
      return;
    }
    designSelect.innerHTML = designs.map(d => {
      const fn = d.path.split('/').pop();
      return `<div class="image-card selectable ${d.id === selectedDesignId ? 'selected' : ''}" data-id="${d.id}">
        <img src="/app/files/extracted/${fn}"></div>`;
    }).join('');

    designSelect.querySelectorAll('.image-card').forEach(card => {
      card.onclick = () => {
        designSelect.querySelectorAll('.image-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedDesignId = card.dataset.id;
        btnGenerate.disabled = false;
      };
    });
    if (selectedDesignId) btnGenerate.disabled = false;
  } catch (e) {
    designSelect.innerHTML = `<p class="error">${e.message}</p>`;
  }

  // Load templates with selection
  let selectedTemplates = new Set();
  try {
    const templates = await api.getTemplates();
    selectedTemplates = new Set(templates.map(t => t.slug));
    templateList.innerHTML = templates.map(t => `
      <div class="template-card selected" data-name="${t.slug}">
        <div class="template-icon">${getTemplateIcon(t.category)}</div>
        <div>${t.name}</div>
        <div class="muted">${t.designArea.width}x${t.designArea.height}</div>
      </div>`).join('');

    templateList.querySelectorAll('.template-card').forEach(card => {
      card.onclick = () => {
        const name = card.dataset.name;
        if (selectedTemplates.has(name)) {
          selectedTemplates.delete(name);
          card.classList.remove('selected');
        } else {
          selectedTemplates.add(name);
          card.classList.add('selected');
        }
      };
    });
  } catch {}

  // Generate mockups
  btnGenerate.onclick = async () => {
    if (!selectedDesignId) return;
    const templates = selectedTemplates.size ? [...selectedTemplates] : undefined;
    btnGenerate.disabled = true;
    mockupResults.innerHTML = loading('\u6b63\u5728\u751f\u6210\u6548\u679c\u56fe...');
    try {
      const result = await api.generateMockups(selectedDesignId, templates);
      const success = result.results.filter(r => !r.error);
      const mockupSrcs = success.map(r => r.url);

      mockupResults.innerHTML = success.map((r, i) => `
        <div class="image-card mockup-card">
          <img src="${r.url}" data-index="${i}">
          <div class="image-card-title">${r.template}</div>
        </div>`).join('');

      // Lightbox on click
      mockupResults.querySelectorAll('.mockup-card img').forEach(img => {
        img.onclick = () => lightbox(mockupSrcs, parseInt(img.dataset.index));
      });

      if (result.batchId) {
        mockupActions.innerHTML = `
          <div class="action-bar">
            <a href="/app/api/mockup/download/${result.batchId}" class="btn btn-success" download>\u4e0b\u8f7d\u5168\u90e8 (ZIP)</a>
            <button class="btn btn-primary" id="btn-to-listing">\u521b\u5efa\u4ea7\u54c1\u5e76\u4e0a\u67b6 \u2192</button>
          </div>`;
        document.getElementById('btn-to-listing')?.addEventListener('click', () => {
          sessionStorage.setItem('listing-design-id', selectedDesignId);
          sessionStorage.setItem('listing-mockup-batch', result.batchId);
          sessionStorage.setItem('listing-mockup-ids', JSON.stringify(success.map(r => r.id)));
          window.location.hash = '/listing';
        });
      }
      toast(`\u5df2\u751f\u6210 ${success.length} \u5f20\u6548\u679c\u56fe\uff01`);
    } catch (e) {
      mockupResults.innerHTML = `<p class="error">${e.message}</p>`;
    }
    btnGenerate.disabled = false;
  };
}

function getTemplateIcon(category) {
  const icons = { apparel: '\ud83d\udc55', drinkware: '\u2615', accessories: '\ud83d\udcf1', wall_art: '\ud83d\uddbc\ufe0f', bags: '\ud83d\udc5c' };
  return icons[category] || '\ud83d\udce6';
}
