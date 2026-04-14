import * as api from '../lib/api.js';
import { toast, formatBytes } from '../lib/components.js';

const CATEGORIES = [
  { value: 'apparel', label: '\u670d\u88c5', icon: '\ud83d\udc55' },
  { value: 'drinkware', label: '\u6c34\u676f', icon: '\u2615' },
  { value: 'accessories', label: '\u914d\u4ef6', icon: '\ud83d\udcf1' },
  { value: 'wall_art', label: '\u58c1\u753b', icon: '\ud83d\uddbc\ufe0f' },
  { value: 'bags', label: '\u7bb1\u5305', icon: '\ud83d\udc5c' },
  { value: 'stationery', label: '\u6587\u5177', icon: '\u270f\ufe0f' },
  { value: 'home', label: '\u5bb6\u5c45', icon: '\ud83c\udfe0' },
];

export async function render(container) {
  container.innerHTML = `
    <div class="page-header"><h1>\u8bbe\u7f6e</h1><p>\u7cfb\u7edf\u914d\u7f6e\u548c\u6570\u636e\u7ba1\u7406</p></div>
    <div class="two-col">
      <div class="card">
        <h3>\u7cfb\u7edf\u72b6\u6001</h3>
        <div id="system-status" class="settings-list"></div>
      </div>
      <div class="card">
        <h3>\u5b58\u50a8\u7528\u91cf</h3>
        <div id="storage-info" class="settings-list"></div>
      </div>
    </div>

    <!-- Template Management -->
    <div class="card">
      <h3>\u4ea7\u54c1\u6a21\u677f\u7ba1\u7406</h3>
      <div id="template-grid" class="template-grid"></div>
      <div class="action-bar">
        <button class="btn btn-primary" id="btn-add-template">\u2795 \u4e0a\u4f20\u65b0\u6a21\u677f</button>
      </div>
    </div>

    <!-- Add Template Form (hidden by default) -->
    <div class="card" id="template-form-card" style="display:none">
      <h3>\u4e0a\u4f20\u65b0\u6a21\u677f</h3>
      <div class="two-col">
        <div>
          <div class="form-group">
            <label>\u6a21\u677f\u540d\u79f0 (\u82f1\u6587\u7f16\u53f7\uff0c\u5982 hoodie-black)</label>
            <input type="text" id="tpl-name" class="input-full" placeholder="hoodie-black">
          </div>
          <div class="form-group">
            <label>\u663e\u793a\u540d\u79f0</label>
            <input type="text" id="tpl-display-name" class="input-full" placeholder="Black Hoodie">
          </div>
          <div class="form-group">
            <label>\u4ea7\u54c1\u5206\u7c7b</label>
            <select id="tpl-category" class="input-full">
              ${CATEGORIES.map(c => `<option value="${c.value}">${c.icon} ${c.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>\u5e95\u677f\u56fe\u7247 (template.png) *</label>
            <div class="upload-zone upload-zone-sm" id="tpl-upload-zone">
              <p>\u70b9\u51fb\u6216\u62d6\u62fd\u4e0a\u4f20\u5e95\u677f\u56fe</p>
              <input type="file" id="tpl-file" accept="image/*" hidden>
            </div>
            <div id="tpl-preview" style="margin-top:0.5rem"></div>
          </div>
          <div class="form-group">
            <label>\u906e\u7f69\u56fe (mask.png\uff0c\u53ef\u9009 \u2014 \u7528\u4e8e\u5f02\u5f62\u4ea7\u54c1)</label>
            <div class="upload-zone upload-zone-sm" id="mask-upload-zone">
              <p>\u70b9\u51fb\u6216\u62d6\u62fd\u4e0a\u4f20\u906e\u7f69\u56fe</p>
              <input type="file" id="mask-file" accept="image/*" hidden>
            </div>
          </div>
        </div>
        <div>
          <p class="muted" style="margin-bottom:1rem">\u8bbe\u8ba1\u533a\u57df\uff1a\u6307\u5b9a\u56fe\u6848\u5728\u5e95\u677f\u4e0a\u7684\u653e\u7f6e\u4f4d\u7f6e\u548c\u5927\u5c0f\u3002\u7559\u7a7a\u5219\u81ea\u52a8\u8ba1\u7b97\uff08\u5c45\u4e2d70%\u533a\u57df\uff09\u3002</p>
          <div class="two-col">
            <div class="form-group">
              <label>X \u504f\u79fb (px)</label>
              <input type="number" id="tpl-x" class="input-full" placeholder="\u81ea\u52a8">
            </div>
            <div class="form-group">
              <label>Y \u504f\u79fb (px)</label>
              <input type="number" id="tpl-y" class="input-full" placeholder="\u81ea\u52a8">
            </div>
          </div>
          <div class="two-col">
            <div class="form-group">
              <label>\u5bbd\u5ea6 (px)</label>
              <input type="number" id="tpl-w" class="input-full" placeholder="\u81ea\u52a8">
            </div>
            <div class="form-group">
              <label>\u9ad8\u5ea6 (px)</label>
              <input type="number" id="tpl-h" class="input-full" placeholder="\u81ea\u52a8">
            </div>
          </div>
          <div class="action-bar">
            <button class="btn btn-primary" id="btn-submit-template">\u4e0a\u4f20\u6a21\u677f</button>
            <button class="btn btn-secondary" id="btn-cancel-template">\u53d6\u6d88</button>
          </div>
        </div>
      </div>
    </div>

    <div class="two-col">
      <div class="card">
        <h3>\u5e73\u53f0\u5bfc\u51fa</h3>
        <div class="settings-list">
          <div class="setting-item"><span>\u5bfc\u51fa\u65b9\u5f0f</span><span class="badge">CSV \u4e0b\u8f7d</span></div>
          <p class="muted mt-1">\u4ea7\u54c1\u5bfc\u51fa\u4e3a CSV \u6587\u4ef6\uff0c\u624b\u52a8\u4e0a\u4f20\u5230\u5404\u5e73\u53f0\u3002</p>
        </div>
      </div>
      <div class="card">
        <h3>\u6570\u636e\u7ba1\u7406</h3>
        <div class="action-bar">
          <button class="btn btn-secondary" id="btn-gen-thumbs">\u8865\u751f\u7f29\u7565\u56fe</button>
          <button class="btn btn-danger" id="btn-clear-data">\u91cd\u7f6e\u6240\u6709\u6570\u636e</button>
        </div>
        <p class="muted mt-1">\u91cd\u7f6e\u5c06\u5220\u9664\u6240\u6709\u56fe\u7247\u3001\u8bbe\u8ba1\u7a3f\u3001\u6548\u679c\u56fe\u548c\u4ea7\u54c1\uff0c\u4e0d\u53ef\u64a4\u9500\u3002</p>
      </div>
    </div>`;

  // === System status ===
  const statusDiv = document.getElementById('system-status');
  try {
    const health = await api.get('/health');
    const stats = await api.getStats();
    statusDiv.innerHTML = `
      <div class="setting-item"><span>API \u670d\u52a1</span><span class="badge badge-ok">\u5728\u7ebf</span></div>
      <div class="setting-item"><span>\u6570\u636e\u5e93</span><span class="badge badge-ok">${stats.images} \u56fe / ${stats.products} \u4ea7\u54c1</span></div>
      <div class="setting-item"><span>\u670d\u52a1\u5668\u65f6\u95f4</span><span class="muted">${new Date(health.time).toLocaleString()}</span></div>`;
  } catch {
    statusDiv.innerHTML = `<div class="setting-item"><span>API \u670d\u52a1</span><span class="badge badge-err">\u79bb\u7ebf</span></div>`;
  }

  // === Storage ===
  const storageDiv = document.getElementById('storage-info');
  try {
    const storage = await api.getStorage();
    const items = [
      { key: 'uploads', label: '\u539f\u56fe' }, { key: 'extracted', label: '\u63d0\u53d6\u7a3f' },
      { key: 'mockups', label: '\u6548\u679c\u56fe' }, { key: 'thumbnails', label: '\u7f29\u7565\u56fe' },
    ];
    storageDiv.innerHTML = items.map(({ key, label }) => {
      const s = storage[key] || { count: 0, sizeBytes: 0 };
      return `<div class="setting-item"><span>${label}</span><span class="muted">${s.count} \u6587\u4ef6 / ${formatBytes(s.sizeBytes)}</span></div>`;
    }).join('') + `<div class="setting-item"><span><strong>\u603b\u8ba1</strong></span><span><strong>${formatBytes(storage.totalBytes)}</strong></span></div>`;
  } catch {
    storageDiv.innerHTML = '<p class="muted">\u52a0\u8f7d\u5931\u8d25</p>';
  }

  // === Template Management ===
  await loadTemplates();

  async function loadTemplates() {
    try {
      const templates = await api.getTemplates();
      document.getElementById('template-grid').innerHTML = templates.map(t => `
        <div class="template-card" data-slug="${t.slug}">
          <img src="${t.previewUrl}" alt="${t.name}" style="width:100%;max-height:80px;object-fit:contain;border-radius:4px;margin-bottom:0.5rem;background:#fff">
          <div class="template-icon">${getIcon(t.category)}</div>
          <div>${t.name}</div>
          <div class="muted">${t.designArea.width}x${t.designArea.height}</div>
          <button class="btn btn-sm btn-danger tpl-delete" data-slug="${t.slug}" style="margin-top:0.5rem">\u5220\u9664</button>
        </div>`).join('');

      // Delete template
      document.querySelectorAll('.tpl-delete').forEach(btn => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const slug = btn.dataset.slug;
          if (!confirm(`\u786e\u5b9a\u5220\u9664\u6a21\u677f "${slug}"\uff1f`)) return;
          try {
            await api.deleteTemplate(slug);
            toast(`\u6a21\u677f "${slug}" \u5df2\u5220\u9664`);
            loadTemplates();
          } catch (err) {
            toast(err.message, 'error');
          }
        };
      });
    } catch {
      document.getElementById('template-grid').innerHTML = '<p class="muted">\u52a0\u8f7d\u5931\u8d25</p>';
    }
  }

  // === Add Template Form ===
  const formCard = document.getElementById('template-form-card');
  let tplFileObj = null;
  let maskFileObj = null;

  document.getElementById('btn-add-template').onclick = () => {
    formCard.style.display = '';
    formCard.scrollIntoView({ behavior: 'smooth' });
  };
  document.getElementById('btn-cancel-template').onclick = () => {
    formCard.style.display = 'none';
    tplFileObj = null;
    maskFileObj = null;
  };

  // Template file upload zone
  const tplZone = document.getElementById('tpl-upload-zone');
  const tplFileInput = document.getElementById('tpl-file');
  tplZone.onclick = () => tplFileInput.click();
  tplZone.ondragover = e => { e.preventDefault(); tplZone.classList.add('dragover'); };
  tplZone.ondragleave = () => tplZone.classList.remove('dragover');
  tplZone.ondrop = e => { e.preventDefault(); tplZone.classList.remove('dragover'); setTplFile(e.dataTransfer.files[0]); };
  tplFileInput.onchange = () => setTplFile(tplFileInput.files[0]);

  function setTplFile(file) {
    if (!file) return;
    tplFileObj = file;
    tplZone.querySelector('p').textContent = `\u2705 ${file.name}`;
    // Preview
    const url = URL.createObjectURL(file);
    document.getElementById('tpl-preview').innerHTML = `<img src="${url}" style="max-height:120px;border-radius:6px;background:#fff">`;
  }

  // Mask file upload zone
  const maskZone = document.getElementById('mask-upload-zone');
  const maskFileInput = document.getElementById('mask-file');
  maskZone.onclick = () => maskFileInput.click();
  maskZone.ondragover = e => { e.preventDefault(); maskZone.classList.add('dragover'); };
  maskZone.ondragleave = () => maskZone.classList.remove('dragover');
  maskZone.ondrop = e => { e.preventDefault(); maskZone.classList.remove('dragover'); setMaskFile(e.dataTransfer.files[0]); };
  maskFileInput.onchange = () => setMaskFile(maskFileInput.files[0]);

  function setMaskFile(file) {
    if (!file) return;
    maskFileObj = file;
    maskZone.querySelector('p').textContent = `\u2705 ${file.name}`;
  }

  // Submit template
  document.getElementById('btn-submit-template').onclick = async () => {
    const name = document.getElementById('tpl-name').value.trim();
    const displayName = document.getElementById('tpl-display-name').value.trim();
    const category = document.getElementById('tpl-category').value;

    if (!name) return toast('\u8bf7\u8f93\u5165\u6a21\u677f\u540d\u79f0', 'error');
    if (!tplFileObj) return toast('\u8bf7\u4e0a\u4f20\u5e95\u677f\u56fe\u7247', 'error');

    const form = new FormData();
    form.append('name', name);
    form.append('displayName', displayName || name);
    form.append('category', category);
    form.append('template', tplFileObj);
    if (maskFileObj) form.append('mask', maskFileObj);

    const x = document.getElementById('tpl-x').value;
    const y = document.getElementById('tpl-y').value;
    const w = document.getElementById('tpl-w').value;
    const h = document.getElementById('tpl-h').value;
    if (x) form.append('x', x);
    if (y) form.append('y', y);
    if (w) form.append('width', w);
    if (h) form.append('height', h);

    const btn = document.getElementById('btn-submit-template');
    btn.disabled = true;
    btn.textContent = '\u4e0a\u4f20\u4e2d...';

    try {
      const result = await api.uploadTemplate(form);
      if (result.error) throw new Error(result.error);
      toast(`\u6a21\u677f "${result.slug}" \u4e0a\u4f20\u6210\u529f\uff01\u5e95\u677f\u5c3a\u5bf8 ${result.templateSize.width}x${result.templateSize.height}\uff0c\u8bbe\u8ba1\u533a\u57df ${result.designArea.width}x${result.designArea.height}`);
      formCard.style.display = 'none';
      tplFileObj = null;
      maskFileObj = null;
      loadTemplates();
    } catch (e) {
      toast(e.message, 'error');
    }
    btn.disabled = false;
    btn.textContent = '\u4e0a\u4f20\u6a21\u677f';
  };

  // === Thumbnails ===
  document.getElementById('btn-gen-thumbs').onclick = async () => {
    const btn = document.getElementById('btn-gen-thumbs');
    btn.disabled = true; btn.textContent = '\u5904\u7406\u4e2d...';
    try {
      const result = await api.generateThumbnails();
      toast(`\u5df2\u751f\u6210 ${result.generated} \u4e2a\u7f29\u7565\u56fe`);
    } catch (e) { toast(e.message, 'error'); }
    btn.disabled = false; btn.textContent = '\u8865\u751f\u7f29\u7565\u56fe';
  };

  // === Reset ===
  document.getElementById('btn-clear-data').onclick = async () => {
    if (!confirm('\u786e\u5b9a\u8981\u91cd\u7f6e\u6240\u6709\u6570\u636e\u5417\uff1f\u6b64\u64cd\u4f5c\u4e0d\u53ef\u64a4\u9500\uff01')) return;
    if (!confirm('\u518d\u6b21\u786e\u8ba4\uff1a\u6240\u6709\u56fe\u7247\u3001\u8bbe\u8ba1\u7a3f\u3001\u6548\u679c\u56fe\u548c\u4ea7\u54c1\u5c06\u88ab\u5220\u9664\u3002')) return;
    try {
      await api.resetAll();
      toast('\u6570\u636e\u5df2\u91cd\u7f6e');
      render(container);
    } catch (e) { toast(e.message, 'error'); }
  };
}

function getIcon(category) {
  const icons = { apparel: '\ud83d\udc55', drinkware: '\u2615', accessories: '\ud83d\udcf1', wall_art: '\ud83d\uddbc\ufe0f', bags: '\ud83d\udc5c', stationery: '\u270f\ufe0f', home: '\ud83c\udfe0' };
  return icons[category] || '\ud83d\udce6';
}
