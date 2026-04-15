import * as api from '../lib/api.js';
import { riskBadge, loading, toast } from '../lib/components.js';
import { open as lightbox } from '../lib/lightbox.js';

export async function render(container) {
  container.innerHTML = `
    <div class="page-header"><h1>智能采集</h1><p>自动发现电商平台 POD 爆款，一键拓取产品图片</p></div>

    <!-- Smart Discovery -->
    <div class="card" id="discovery-card">
      <h3>🔍 智能发现 — 自动搜索热门 POD 产品</h3>
      <div class="input-row">
        <input type="text" id="discovery-query" placeholder="输入关键词，如：cat t-shirt, funny dad mug" class="input-full">
        <button class="btn btn-primary" id="btn-discover">搜索</button>
      </div>
      <div class="platform-tags" id="platform-checkboxes">
        <label class="tag tag-selectable selected" data-platform="etsy"><input type="checkbox" checked hidden> Etsy</label>
        <label class="tag tag-selectable selected" data-platform="amazon"><input type="checkbox" checked hidden> Amazon</label>
        <label class="tag tag-selectable selected" data-platform="redbubble"><input type="checkbox" checked hidden> Redbubble</label>
      </div>
      <div id="preset-chips" class="platform-tags" style="margin-top:0.5rem"></div>
    </div>
    <div id="discovery-results"></div>

    <!-- Manual URL scrape -->
    <div class="card">
      <h3>粘贴产品链接</h3>
      <div class="input-row">
        <input type="text" id="scrape-url" placeholder="https://www.temu.com/... 或 Amazon/Etsy 链接" class="input-full">
        <button class="btn btn-secondary" id="btn-scrape">拓取</button>
      </div>
      <div class="platform-tags">
        <span class="tag">TEMU</span><span class="tag">Amazon</span><span class="tag">Etsy</span><span class="tag">Shopify</span>
      </div>
    </div>
    <div id="scrape-result"></div>

    <!-- Upload -->
    <div class="card">
      <h3>或者直接上传图片</h3>
      <div class="upload-zone" id="upload-zone">
        <p>拖拽图片到此处，或点击选择文件</p>
        <input type="file" id="file-input" multiple accept="image/*" hidden>
      </div>
      <div id="upload-result" class="image-grid"></div>
    </div>`;

  // ─── Discovery ──────────────────────────────────────────
  const queryInput = document.getElementById('discovery-query');
  const btnDiscover = document.getElementById('btn-discover');
  const discoveryResults = document.getElementById('discovery-results');
  let currentPage = 1;
  let currentQuery = '';
  let currentPlatforms = [];
  let lastJobData = null;

  // Load preset chips
  try {
    const presets = await api.getPresets();
    document.getElementById('preset-chips').innerHTML =
      presets.map(p => `<span class="tag tag-selectable preset-chip" data-keywords='${JSON.stringify(p.keywords)}'>${p.icon} ${p.label}</span>`).join('');

    document.querySelectorAll('.preset-chip').forEach(chip => {
      chip.onclick = () => {
        const kws = JSON.parse(chip.dataset.keywords);
        const kw = kws[Math.floor(Math.random() * kws.length)];
        queryInput.value = kw;
        btnDiscover.click();
      };
    });
  } catch {}

  // Platform toggle
  document.querySelectorAll('#platform-checkboxes .tag-selectable').forEach(label => {
    label.onclick = () => {
      label.classList.toggle('selected');
      label.querySelector('input').checked = label.classList.contains('selected');
    };
  });

  function getSelectedPlatforms() {
    return [...document.querySelectorAll('#platform-checkboxes .tag-selectable.selected')]
      .map(l => l.dataset.platform);
  }

  // Search
  btnDiscover.onclick = () => startDiscovery(1);

  queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnDiscover.click();
  });

  async function startDiscovery(page) {
    const query = queryInput.value.trim();
    if (!query) return toast('请输入搜索关键词', 'error');

    const platforms = getSelectedPlatforms();
    if (!platforms.length) return toast('请至少选择一个平台', 'error');

    currentQuery = query;
    currentPlatforms = platforms;
    currentPage = page;

    if (page === 1) {
      btnDiscover.disabled = true;
      btnDiscover.textContent = '搜索中...';
      discoveryResults.innerHTML = `<div class="card">
        <div class="progress-bar-container"><div class="progress-bar"></div></div>
        <p class="muted text-center mt-1">正在搜索 ${platforms.join(' / ')} 平台，请稍候...</p>
      </div>`;
    }

    try {
      const job = await api.discover(query, platforms, page);
      let result;
      for (let i = 0; i < 45; i++) {
        await new Promise(r => setTimeout(r, 2000));
        result = await api.pollDiscovery(job.id);
        if (result.status !== 'searching') break;
      }

      lastJobData = result;

      if (result.status === 'done' && result.results?.length) {
        renderDiscoveryResults(result, page === 1);
      } else if (result.status === 'done') {
        discoveryResults.innerHTML = `<div class="card"><p class="muted text-center">未找到相关产品，试试换个关键词？</p></div>`;
      } else {
        discoveryResults.innerHTML = `<div class="card"><p class="error">搜索失败: ${result.error || result.status}</p></div>`;
      }
    } catch (e) {
      discoveryResults.innerHTML = `<div class="card"><p class="error">${e.message}</p></div>`;
    }
    btnDiscover.disabled = false;
    btnDiscover.textContent = '搜索';
  }

  function renderDiscoveryResults(data, isFirstPage) {
    const results = data.results || [];
    const hasMore = data.hasMore;
    const errors = data.errors || {};
    const errorKeys = Object.keys(errors);

    let errorMsg = '';
    if (errorKeys.length) {
      errorMsg = `<p class="muted" style="font-size:0.75rem">⚠️ ${errorKeys.map(k => `${k}: ${errors[k].substring(0, 60)}`).join('; ')}</p>`;
    }

    if (isFirstPage) {
      discoveryResults.innerHTML = `<div class="card">
        <div class="action-bar">
          <span class="muted">找到 <strong>${results.length}</strong> 个产品</span>
          <button class="btn btn-sm btn-secondary" id="btn-sel-all-disc">全选</button>
          <button class="btn btn-sm btn-secondary" id="btn-desel-all-disc">取消全选</button>
          <button class="btn btn-primary" id="btn-scrape-selected">📥 拓取选中产品的图片</button>
        </div>
        ${errorMsg}
        <div class="discovery-grid" id="discovery-grid"></div>
        <div class="action-bar" id="discovery-pager"></div>
      </div>`;
    }

    const grid = document.getElementById('discovery-grid');
    const pager = document.getElementById('discovery-pager');

    results.forEach(r => {
      const card = document.createElement('div');
      card.className = 'discovery-card';
      card.dataset.resultId = r.id;

      const platformLabel = r.platform === 'etsy' ? 'Etsy' : r.platform === 'amazon' ? 'Amazon' : r.platform === 'redbubble' ? 'Redbubble' : r.platform;
      const ratingStr = r.rating ? `★${r.rating}` : '';
      const reviewStr = r.reviewsCount ? `(${r.reviewsCount})` : '';
      const priceStr = r.price || '';

      card.innerHTML = `
        <img src="${r.thumbnail || r.thumbnail_url || ''}" loading="lazy" onerror="this.style.display='none'">
        <div class="discovery-card-info">
          <div class="discovery-card-title">${r.title || ''}</div>
          <div class="discovery-card-meta">
            <span class="tag tag-sm">${platformLabel}</span>
            ${priceStr ? `<span class="muted">${priceStr}</span>` : ''}
            ${ratingStr ? `<span class="muted">${ratingStr} ${reviewStr}</span>` : ''}
          </div>
        </div>
        <div class="discovery-check">☐</div>`;

      card.onclick = () => {
        card.classList.toggle('selected');
        card.querySelector('.discovery-check').textContent = card.classList.contains('selected') ? '☑' : '☐';
      };

      grid.appendChild(card);
    });

    // Update count
    const countEl = discoveryResults.querySelector('.action-bar span.muted');
    if (countEl) {
      const total = grid.querySelectorAll('.discovery-card').length;
      countEl.innerHTML = `找到 <strong>${total}</strong> 个产品`;
    }

    if (hasMore) {
      pager.innerHTML = `<button class="btn btn-secondary" id="btn-load-more">加载更多</button>`;
      document.getElementById('btn-load-more').onclick = () => {
        pager.innerHTML = loading('加载中...');
        startDiscovery(currentPage + 1);
      };
    } else {
      pager.innerHTML = '';
    }

    document.getElementById('btn-sel-all-disc')?.addEventListener('click', () => {
      grid.querySelectorAll('.discovery-card').forEach(c => { c.classList.add('selected'); c.querySelector('.discovery-check').textContent = '☑'; });
    });
    document.getElementById('btn-desel-all-disc')?.addEventListener('click', () => {
      grid.querySelectorAll('.discovery-card').forEach(c => { c.classList.remove('selected'); c.querySelector('.discovery-check').textContent = '☐'; });
    });

    document.getElementById('btn-scrape-selected')?.addEventListener('click', async () => {
      const selectedIds = [...grid.querySelectorAll('.discovery-card.selected')].map(c => c.dataset.resultId);
      if (!selectedIds.length) return toast('请先选择要拓取的产品', 'error');

      const btn = document.getElementById('btn-scrape-selected');
      btn.disabled = true;
      btn.textContent = `正在拓取 ${selectedIds.length} 个产品...`;

      try {
        const jobId = lastJobData.id;
        const resp = await api.batchScrapeDiscovery(jobId, selectedIds);
        toast(`已开始拓取 ${resp.scrapeJobs?.length || selectedIds.length} 个产品的图片，完成后会在仪表盘显示`);

        const scrapeResult = document.getElementById('scrape-result');
        scrapeResult.innerHTML = `<div class="card">
          <h3>正在拓取产品图片...</h3>
          <div class="progress-bar-container"><div class="progress-bar"></div></div>
          <p class="muted text-center mt-1">后台正在逐个拓取选中产品的图片，请稍候。</p>
        </div>`;
      } catch (e) {
        toast(e.message, 'error');
      }
      btn.disabled = false;
      btn.textContent = '📥 拓取选中产品的图片';
    });
  }

  // ─── Manual URL Scrape ──────────────────────────────────
  const urlInput = document.getElementById('scrape-url');
  const btnScrape = document.getElementById('btn-scrape');
  const resultDiv = document.getElementById('scrape-result');

  btnScrape.onclick = async () => {
    const url = urlInput.value.trim();
    if (!url) return;
    if (!/^https?:\/\/.+\..+/.test(url)) { toast('请输入有效的网址', 'error'); return; }
    btnScrape.disabled = true;
    resultDiv.innerHTML = `<div class="card"><div class="progress-bar-container"><div class="progress-bar"></div></div><p class="muted text-center mt-1">正在拓取产品图片，请稍候（最多60秒）...</p></div>`;
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
        resultDiv.innerHTML = `<div class="card"><p class="error">拓取失败或未找到图片: ${result.error || result.status}</p></div>`;
      }
    } catch (e) {
      resultDiv.innerHTML = `<div class="card"><p class="error">${e.message}</p></div>`;
    }
    btnScrape.disabled = false;
  };

  // ─── Upload ─────────────────────────────────────────────
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');
  const uploadResult = document.getElementById('upload-result');

  uploadZone.onclick = () => fileInput.click();
  uploadZone.ondragover = e => { e.preventDefault(); uploadZone.classList.add('dragover'); };
  uploadZone.ondragleave = () => uploadZone.classList.remove('dragover');
  uploadZone.ondrop = e => { e.preventDefault(); uploadZone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); };
  fileInput.onchange = () => handleFiles(fileInput.files);

  async function handleFiles(files) {
    for (const file of files) {
      const result = await api.upload(file);
      const filename = result.path.split('/').pop();
      uploadResult.innerHTML += `<div class="image-card" data-id="${result.id}">
        <img src="/app/files/uploads/${filename}" loading="lazy">
        <div class="image-card-title">${file.name}</div></div>`;
    }
    if (files.length) toast(`已上传 ${files.length} 张图片`);
  }
}

function renderScrapedImages(result, container) {
  const images = result.images;
  container.innerHTML = `<div class="card">
    <h3>已拓取 ${images.length} 张图片（来自 ${result.platform || '网站'}）</h3>
    <div class="action-bar">
      <button class="btn btn-sm btn-secondary" id="btn-select-all">全选</button>
      <button class="btn btn-sm btn-secondary" id="btn-deselect-all">取消全选</button>
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
      <button class="btn btn-primary" id="btn-check-all">IP 风险检测</button>
      <button class="btn btn-success" id="btn-goto-extract">去扣图提取 →</button>
    </div></div>`;

  document.getElementById('btn-select-all')?.addEventListener('click', () => {
    container.querySelectorAll('.scraped-img').forEach(c => { c.classList.add('selected'); c.querySelector('input').checked = true; });
  });
  document.getElementById('btn-deselect-all')?.addEventListener('click', () => {
    container.querySelectorAll('.scraped-img').forEach(c => { c.classList.remove('selected'); c.querySelector('input').checked = false; });
  });

  container.querySelectorAll('.scraped-img').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const cb = card.querySelector('input');
      cb.checked = !cb.checked;
      card.classList.toggle('selected', cb.checked);
    });
  });

  const allSrcs = images.map(img => {
    const filename = img.path.split('/').pop();
    const dir = img.path.includes('/') ? img.path.split('/data/')[1] : `uploads/${filename}`;
    return `/app/files/${dir}`;
  });
  container.querySelectorAll('.scraped-img img').forEach((imgEl, i) => {
    imgEl.addEventListener('dblclick', (e) => { e.stopPropagation(); lightbox(allSrcs, i); });
  });

  document.getElementById('btn-check-all')?.addEventListener('click', async () => {
    const selected = [...container.querySelectorAll('.scraped-img.selected')].map(c => c.dataset.id);
    if (!selected.length) { toast('请先选择图片', 'error'); return; }
    const actionsDiv = document.getElementById('scrape-actions');
    actionsDiv.innerHTML = loading('正在检测 IP 风险...');
    const checks = await api.ipCheckBatch(selected);
    toast(`IP 检测完成：${checks.results?.length} 张图片已扫描`);
    checks.results?.forEach(r => {
      const card = container.querySelector(`[data-id="${r.imageId}"]`);
      if (card) card.querySelector('.image-card-overlay').innerHTML = riskBadge(r.risk_level);
    });
    actionsDiv.innerHTML = `
      <button class="btn btn-danger" id="btn-delete-bad">删除侵权图片</button>
      <button class="btn btn-success" id="btn-goto-extract">去扣图提取 →</button>`;
    document.getElementById('btn-delete-bad')?.addEventListener('click', async () => {
      await api.deleteInfringing();
      toast('侵权图片已删除');
      container.querySelectorAll('.image-card').forEach(c => {
        if (c.querySelector('.risk-badge')?.textContent.includes('侵权')) c.remove();
      });
    });
  });

  container.addEventListener('click', (e) => {
    if (e.target.id === 'btn-goto-extract' || e.target.closest('#btn-goto-extract')) {
      window.location.hash = '/extract';
    }
  });
}
