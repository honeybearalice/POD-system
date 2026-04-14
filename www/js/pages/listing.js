import * as api from '../lib/api.js';
import { loading, toast } from '../lib/components.js';

export async function render(container) {
  const designId = sessionStorage.getItem('listing-design-id');
  const mockupIds = JSON.parse(sessionStorage.getItem('listing-mockup-ids') || '[]');
  const batchId = sessionStorage.getItem('listing-mockup-batch');

  container.innerHTML = `
    <div class="page-header"><h1>\u4e0a\u67b6\u7ba1\u7406</h1><p>\u751f\u6210\u6807\u9898\u3001\u521b\u5efa\u4ea7\u54c1\u3001\u5bfc\u51fa\u5230\u5e73\u53f0</p></div>
    <div class="two-col">
      <div class="card">
        <h3>\u4ea7\u54c1\u4fe1\u606f</h3>
        <div class="form-group">
          <label>\u6807\u9898</label>
          <input type="text" id="product-title" class="input-full" placeholder="AI \u81ea\u52a8\u751f\u6210...">
          <button class="btn btn-sm btn-secondary mt-1" id="btn-gen-title">\u667a\u80fd\u751f\u6210\u6807\u9898</button>
        </div>
        <div class="form-group">
          <label>\u63cf\u8ff0</label>
          <textarea id="product-desc" class="input-full" rows="4" placeholder="AI \u81ea\u52a8\u751f\u6210..."></textarea>
        </div>
        <div class="form-group">
          <label>\u6807\u7b7e</label>
          <input type="text" id="product-tags" class="input-full" placeholder="\u7528\u82f1\u6587\u9017\u53f7\u5206\u9694">
        </div>
        <div class="form-group">
          <label>\u4ef7\u683c ($)</label>
          <input type="number" id="product-price" class="input-sm" value="19.99" step="0.01">
        </div>
        <div id="title-suggestions"></div>
      </div>
      <div class="card">
        <h3>\u5e73\u53f0\u9009\u62e9</h3>
        <div id="platform-list" class="platform-list"></div>
        <div class="action-bar">
          <button class="btn btn-primary" id="btn-create-product">\u521b\u5efa\u4ea7\u54c1</button>
          <button class="btn btn-success" id="btn-export-csv" disabled>\u5bfc\u51fa CSV</button>
        </div>
        <div id="listing-status"></div>
      </div>
    </div>
    <div class="card">
      <h3>\u4ea7\u54c1\u5217\u8868</h3>
      <div id="products-table"></div>
    </div>`;

  const titleInput = document.getElementById('product-title');
  const descInput = document.getElementById('product-desc');
  const tagsInput = document.getElementById('product-tags');
  const priceInput = document.getElementById('product-price');
  const titleSuggestions = document.getElementById('title-suggestions');

  // Generate titles
  document.getElementById('btn-gen-title').onclick = async () => {
    titleSuggestions.innerHTML = loading('\u6b63\u5728\u751f\u6210\u6807\u9898...');
    try {
      const result = await api.generateTitles({ count: 5 });
      titleSuggestions.innerHTML = '<p class="muted">\u70b9\u51fb\u9009\u7528\uff1a</p>' + result.results.map(r =>
        `<div class="title-suggestion" data-title="${r.title}" data-desc="${r.description}" data-tags="${r.tags.join(',')}">${r.title}</div>`
      ).join('');
      titleSuggestions.querySelectorAll('.title-suggestion').forEach(el => {
        el.onclick = () => {
          titleInput.value = el.dataset.title;
          descInput.value = el.dataset.desc;
          tagsInput.value = el.dataset.tags;
          titleSuggestions.querySelectorAll('.title-suggestion').forEach(s => s.classList.remove('selected'));
          el.classList.add('selected');
        };
      });
      titleSuggestions.querySelector('.title-suggestion')?.click();
    } catch (e) {
      titleSuggestions.innerHTML = `<p class="error">\u751f\u6210\u5931\u8d25: ${e.message}</p>`;
    }
  };

  // Auto-trigger
  document.getElementById('btn-gen-title').click();

  // Load platforms
  try {
    const platforms = await api.getPlatforms();
    document.getElementById('platform-list').innerHTML = platforms.map(p =>
      `<label class="platform-checkbox"><input type="checkbox" value="${p.id}" checked> ${p.name} <small>(\u6807\u9898\u4e0a\u9650 ${p.fields.titleMax} \u5b57\u7b26)</small></label>`
    ).join('');
  } catch {}

  let createdProductId = null;

  // Create product
  document.getElementById('btn-create-product').onclick = async () => {
    const title = titleInput.value;
    const description = descInput.value;
    const tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
    const price = parseFloat(priceInput.value) || 19.99;
    if (!title) return toast('\u8bf7\u5148\u751f\u6210\u6216\u8f93\u5165\u6807\u9898', 'error');

    try {
      const result = await api.createProduct({ designId, title, description, tags, price, mockupIds });
      createdProductId = result.id;
      document.getElementById('btn-export-csv').disabled = false;
      toast('\u4ea7\u54c1\u521b\u5efa\u6210\u529f\uff01');
      loadProducts();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  // Export CSV — use fetch + blob download instead of window.open
  document.getElementById('btn-export-csv').onclick = async () => {
    if (!createdProductId) return;
    const checked = [...document.querySelectorAll('.platform-checkbox input:checked')];
    if (!checked.length) return toast('\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u5e73\u53f0', 'error');

    for (const cb of checked) {
      try {
        const blob = await api.exportCSV([createdProductId], cb.value);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${cb.value}-products.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        toast(`${cb.value} \u5bfc\u51fa\u5931\u8d25`, 'error');
      }
    }
    toast('CSV \u5df2\u5bfc\u51fa\uff01');
  };

  async function loadProducts() {
    try {
      const products = await api.getProducts();
      const tableDiv = document.getElementById('products-table');
      if (!products.length) {
        tableDiv.innerHTML = '<p class="muted">\u8fd8\u6ca1\u6709\u4ea7\u54c1</p>';
        return;
      }
      tableDiv.innerHTML = `
        <table class="data-table"><thead><tr>
          <th>\u6807\u9898</th><th>\u4ef7\u683c</th><th>\u72b6\u6001</th><th>\u65f6\u95f4</th><th>\u64cd\u4f5c</th>
        </tr></thead>
        <tbody>${products.map(p => `<tr data-id="${p.id}">
          <td>${p.title || '-'}</td>
          <td>$${p.price || 0}</td>
          <td><span class="badge">${p.status}</span></td>
          <td>${new Date(p.created_at).toLocaleDateString()}</td>
          <td>
            <button class="btn btn-sm btn-secondary export-one" data-id="${p.id}">\u5bfc\u51fa</button>
            <button class="btn btn-sm btn-danger delete-one" data-id="${p.id}">\u5220\u9664</button>
          </td>
        </tr>`).join('')}</tbody></table>`;

      // Export single product
      tableDiv.querySelectorAll('.export-one').forEach(btn => {
        btn.onclick = async () => {
          const checked = [...document.querySelectorAll('.platform-checkbox input:checked')];
          if (!checked.length) return toast('\u8bf7\u5148\u9009\u62e9\u5e73\u53f0', 'error');
          for (const cb of checked) {
            try {
              const blob = await api.exportCSV([btn.dataset.id], cb.value);
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `${cb.value}-product.csv`; a.click();
              URL.revokeObjectURL(url);
            } catch {}
          }
          toast('CSV \u5df2\u5bfc\u51fa');
        };
      });

      // Delete product
      tableDiv.querySelectorAll('.delete-one').forEach(btn => {
        btn.onclick = async () => {
          if (!confirm('\u786e\u5b9a\u5220\u9664\u8fd9\u4e2a\u4ea7\u54c1\uff1f')) return;
          await api.deleteProduct(btn.dataset.id);
          toast('\u4ea7\u54c1\u5df2\u5220\u9664');
          loadProducts();
        };
      });
    } catch {}
  }
  loadProducts();
}
