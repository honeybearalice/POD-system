/**
 * Platform discovery service — searches e-commerce listing pages
 * for trending POD products and extracts product metadata.
 */
const { chromium } = require('playwright');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(min = 2000, max = 5000) {
  return Math.floor(Math.random() * (max - min)) + min;
}

// ─── Etsy ───────────────────────────────────────────────────

async function searchEtsy(page, query, pageNum) {
  const url = `https://www.etsy.com/search?q=${encodeURIComponent(query)}&ref=search_bar&page=${pageNum}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(randomDelay());

  // Detect captcha / verification block
  const blocked = await page.evaluate(() => {
    const title = document.title.toLowerCase();
    const body = document.body?.textContent?.toLowerCase() || '';
    return title.includes('verification') || title.includes('captcha') ||
           body.includes('verify you are a human') || body.includes('security check');
  });
  if (blocked) {
    return { platform: 'etsy', products: [], hasMore: false, error: 'Etsy requires captcha verification — blocked from this IP' };
  }

  // Scroll to trigger lazy loading
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(600);
  }

  const products = await page.evaluate(() => {
    const cards = document.querySelectorAll('[data-listing-id], .v2-listing-card, .wt-grid__item-xs-6');
    const results = [];
    cards.forEach((card, i) => {
      const link = card.querySelector('a[href*="/listing/"]');
      const img = card.querySelector('img');
      const titleEl = card.querySelector('h3, [data-listing-card-title], .v2-listing-card__info h3, .wt-text-caption');
      const priceEl = card.querySelector('.currency-value, span.currency-value, .lc-price .wt-text-title-01');
      const reviewEl = card.querySelector('.wt-text-body-01, .wt-screen-reader-only');

      if (!link) return;

      let href = link.href || '';
      if (href.includes('?')) href = href.split('?')[0];

      let thumb = img?.src || img?.dataset?.src || '';
      thumb = thumb.replace(/il_\d+x\d+/, 'il_300xN');

      let reviewCount = 0;
      const reviewText = reviewEl?.textContent || '';
      const reviewMatch = reviewText.match(/([\d,]+)\s*review/i) || reviewText.match(/\(([\d,]+)\)/);
      if (reviewMatch) reviewCount = parseInt(reviewMatch[1].replace(/,/g, ''));

      results.push({
        url: href,
        title: (titleEl?.textContent || '').trim().substring(0, 200),
        thumbnail: thumb,
        price: (priceEl?.textContent || '').trim(),
        reviewsCount: reviewCount,
        rank: i,
      });
    });
    return results;
  });

  const hasMore = await page.evaluate(() => {
    return !!document.querySelector('a[data-page]:last-child, .wt-action-group__item-container:last-child a');
  });

  return { platform: 'etsy', products: products.filter(p => p.url && p.title), hasMore };
}

// ─── Amazon ─────────────────────────────────────────────────

async function searchAmazon(page, query, pageNum) {
  const url = `https://www.amazon.com/s?k=${encodeURIComponent(query)}&page=${pageNum}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(randomDelay());

  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(500);
  }

  const products = await page.evaluate(() => {
    const cards = document.querySelectorAll('[data-component-type="s-search-result"]');
    const results = [];
    cards.forEach((card, i) => {
      // Amazon's current layout: h2 contains title text directly,
      // product link is a separate <a> with href containing /dp/
      const linkEl = card.querySelector('a[href*="/dp/"]') || card.querySelector('a.a-link-normal.s-no-outline');
      const titleEl = card.querySelector('h2');
      const img = card.querySelector('img.s-image');
      const priceWhole = card.querySelector('.a-price .a-price-whole');
      const priceFrac = card.querySelector('.a-price .a-price-fraction');
      const ratingEl = card.querySelector('span[aria-label*="star"], i.a-icon-star-small');
      const reviewCountEl = card.querySelector('span.a-size-base.s-underline-text, [aria-label*="rating"]');

      if (!linkEl && !titleEl) return;

      let href = linkEl?.href || '';
      // Normalize Amazon URLs
      const dpMatch = href.match(/\/dp\/([A-Z0-9]+)/);
      if (dpMatch) href = `https://www.amazon.com/dp/${dpMatch[1]}`;
      if (!href) return;

      // Get title from h2 text (not from link text which may be different)
      const title = (titleEl?.textContent || linkEl?.textContent || '').trim();

      let price = '';
      if (priceWhole) price = `$${priceWhole.textContent.trim()}${priceFrac ? priceFrac.textContent.trim() : ''}`;

      let rating = 0;
      const ratingLabel = ratingEl?.getAttribute('aria-label') || ratingEl?.className || '';
      const ratingMatch = ratingLabel.match(/([\d.]+)\s*out/i);
      if (ratingMatch) rating = parseFloat(ratingMatch[1]);

      let reviewsCount = 0;
      const rcText = reviewCountEl?.textContent || '';
      const rcMatch = rcText.match(/([\d,]+)/);
      if (rcMatch) reviewsCount = parseInt(rcMatch[1].replace(/,/g, ''));

      results.push({
        url: href,
        title: title.substring(0, 200),
        thumbnail: img?.src || '',
        price,
        rating,
        reviewsCount,
        rank: i,
      });
    });
    return results;
  });

  const hasMore = await page.evaluate(() => {
    return !!document.querySelector('.s-pagination-next:not(.s-pagination-disabled)');
  });

  return { platform: 'amazon', products: products.filter(p => p.url && p.title), hasMore };
}

// ─── Redbubble ──────────────────────────────────────────────

async function searchRedbubble(page, query, pageNum) {
  const url = `https://www.redbubble.com/shop?query=${encodeURIComponent(query)}&ref=search_box&page=${pageNum}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(randomDelay());

  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(500);
  }

  const products = await page.evaluate(() => {
    // Redbubble: a[href*="/i/"] links are the product cards
    const links = document.querySelectorAll('a[href*="/i/"]');
    const results = [];
    const seen = new Set();

    links.forEach((link, i) => {
      const href = link.href || '';
      // Deduplicate — same product may appear in multiple <a> tags
      const cleanHref = href.split('?')[0];
      if (seen.has(cleanHref) || !cleanHref) return;
      seen.add(cleanHref);

      // Find the image inside or near this link
      const img = link.querySelector('img') || link.parentElement?.querySelector('img');
      const title = img?.alt || link.getAttribute('aria-label') || link.textContent?.trim() || '';
      if (!title || title.length < 3) return;

      let thumb = img?.src || img?.dataset?.src || '';
      // Try srcset for better quality
      if (img?.srcset) {
        const srcsetParts = img.srcset.split(',').map(s => s.trim());
        const last = srcsetParts[srcsetParts.length - 1];
        if (last) thumb = last.split(' ')[0];
      }

      // Walk up to find price in parent container
      const container = link.closest('[class*="result"], [class*="card"], [class*="Item"]') || link.parentElement;
      const priceEl = container?.querySelector('[class*="price"], span[class*="Price"]');

      results.push({
        url: cleanHref,
        title: title.substring(0, 200),
        thumbnail: thumb,
        price: (priceEl?.textContent || '').trim(),
        reviewsCount: 0,
        rank: i,
      });
    });
    return results;
  });

  const hasMore = await page.evaluate(() => {
    return !!document.querySelector('a[rel="next"], [aria-label="Next page"]');
  });

  return { platform: 'redbubble', products: products.filter(p => p.url && p.title), hasMore };
}

// ─── Main Entry ─────────────────────────────────────────────

const PLATFORM_FNS = {
  etsy: searchEtsy,
  amazon: searchAmazon,
  redbubble: searchRedbubble,
};

async function discoverProducts(query, platforms, page = 1, onProgress) {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const tasks = platforms.map(async (platform) => {
      const fn = PLATFORM_FNS[platform];
      if (!fn) return { platform, products: [], hasMore: false, error: 'Unsupported platform' };

      try {
        const ctx = await browser.newContext({
          userAgent: randomUA(),
          viewport: { width: 1920, height: 1080 },
        });
        const pg = await ctx.newPage();
        const result = await fn(pg, query, page);
        await ctx.close();
        if (onProgress) onProgress(platform, result.products.length);
        return result;
      } catch (e) {
        if (onProgress) onProgress(platform, 0, e.message);
        return { platform, products: [], hasMore: false, error: e.message };
      }
    });

    const results = await Promise.allSettled(tasks);
    const combined = {
      products: [],
      hasMore: false,
      errors: {},
    };

    let rank = 0;
    for (const r of results) {
      const val = r.status === 'fulfilled' ? r.value : { platform: 'unknown', products: [], error: r.reason?.message };
      if (val.error) combined.errors[val.platform] = val.error;
      if (val.hasMore) combined.hasMore = true;
      for (const p of val.products) {
        p.platform = val.platform;
        p.rank = rank++;
        combined.products.push(p);
      }
    }

    return combined;
  } finally {
    await browser.close();
  }
}

module.exports = { discoverProducts, PLATFORM_FNS };
