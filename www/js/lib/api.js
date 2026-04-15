const API = '/app/api'; // Caddy proxies /app/* -> localhost:3000, stripping /app prefix

export async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return res.json();
}

export async function get(path) {
  const res = await fetch(`${API}${path}`);
  return res.json();
}

export async function del(path) {
  const res = await fetch(`${API}${path}`, { method: 'DELETE' });
  return res.json();
}

export async function put(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return res.json();
}

export async function upload(file) {
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(`${API}/process/upload`, { method: 'POST', body: form });
  return res.json();
}

export async function downloadBlob(path) {
  const res = await fetch(`${API}${path}`);
  return res.blob();
}

// Scraping
export async function scrape(url) { return post('/scrape', { url }); }
export async function pollScrape(id) { return get(`/scrape/${id}`); }

// Processing
export async function removeBg(imageId) { return post('/process/remove-bg', { imageId }); }
export async function ipCheck(imageId) { return post('/process/ip-check', { imageId }); }
export async function ipCheckBatch(imageIds) { return post('/process/ip-check-batch', { imageIds }); }

// Mockups & Templates
export async function getTemplates() { return get('/mockup/templates'); }
export async function generateMockups(designId, templateNames) { return post('/mockup/generate', { designId, templateNames }); }
export async function uploadTemplate(formData) {
  const res = await fetch(`${API}/mockup/templates`, { method: 'POST', body: formData });
  return res.json();
}
export async function updateTemplate(slug, data) { return put(`/mockup/templates/${slug}`, data); }
export async function deleteTemplate(slug) { return del(`/mockup/templates/${slug}`); }

// Titles
export async function generateTitles(opts) { return post('/title/generate', opts); }

// Products
export async function createProduct(data) { return post('/listing/products', data); }
export async function getProducts() { return get('/listing/products'); }
export async function updateProduct(id, data) { return put(`/listing/products/${id}`, data); }
export async function deleteProduct(id) { return del(`/listing/products/${id}`); }

// Platforms / Export
export async function getPlatforms() { return get('/listing/platforms'); }
export async function exportCSV(productIds, platform) { return downloadBlob(`/listing/export-csv?productIds=${productIds.join(',')}&platform=${platform}`); }

// Images / Designs
export async function getStats() { return get('/product/stats'); }
export async function getImages(params) { return get(`/product/images?${new URLSearchParams(params)}`); }
export async function getDesigns() { return get('/product/designs'); }
export async function deleteImage(id) { return del(`/product/images/${id}`); }
export async function deleteInfringing() { return post('/product/delete-infringing', {}); }

// System
export async function getRecent() { return get('/product/recent'); }
export async function getStorage() { return get('/product/storage'); }
export async function resetAll() { return post('/product/reset', {}); }
export async function generateThumbnails() { return post('/product/generate-thumbnails', {}); }

// Discovery
export async function discover(query, platforms, page) { return post('/discovery', { query, platforms, page }); }
export async function pollDiscovery(id) { return get(`/discovery/${id}`); }
export async function getPresets() { return get('/discovery/presets'); }
export async function batchScrapeDiscovery(jobId, resultIds) { return post(`/discovery/${jobId}/scrape`, { resultIds }); }

// SSE
export function connectSSE(onEvent) {
  const es = new EventSource(`${API}/events`);
  es.onmessage = (e) => { try { onEvent(JSON.parse(e.data)); } catch {} };
  es.onerror = () => { es.close(); setTimeout(() => connectSSE(onEvent), 5000); };
  return es;
}
