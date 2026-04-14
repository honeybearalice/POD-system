/**
 * Playwright-based product image scraper.
 * Supports TEMU, Amazon, Etsy, generic Shopify sites.
 */
const { chromium } = require('playwright');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

function detectPlatform(url) {
  if (/temu\.com/i.test(url)) return 'temu';
  if (/amazon\.(com|co\.|de|fr|it|es|ca|com\.au)/i.test(url)) return 'amazon';
  if (/etsy\.com/i.test(url)) return 'etsy';
  return 'generic';
}

async function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadImage(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const ws = fs.createWriteStream(dest);
      res.pipe(ws);
      ws.on('finish', () => { ws.close(); resolve(dest); });
      ws.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function scrapePage(url, outputDir) {
  const platform = detectPlatform(url);
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    let imageUrls = [];

    if (platform === 'temu') {
      // Scroll to load lazy images
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, 600));
        await page.waitForTimeout(500);
      }
      imageUrls = await page.evaluate(() => {
        const imgs = document.querySelectorAll('img');
        return [...imgs].map(i => i.src || i.dataset?.src || '').filter(s =>
          s && (s.includes('img.ltwebstatic') || s.includes('aimg.kwcdn')) && !s.includes('icon') && !s.includes('logo')
        );
      });
    } else if (platform === 'amazon') {
      imageUrls = await page.evaluate(() => {
        const imgs = document.querySelectorAll('#imgTagWrapperId img, #altImages img, .imgTagWrapper img');
        const urls = [...imgs].map(i => i.src || i.dataset?.oldHires || '').filter(Boolean);
        // Try to get hi-res versions
        return urls.map(u => u.replace(/\._[^.]+\./, '.'));
      });
    } else if (platform === 'etsy') {
      imageUrls = await page.evaluate(() => {
        const imgs = document.querySelectorAll('[data-listing-card-image] img, .listing-page-image-carousel img, img[data-src]');
        return [...imgs].map(i => (i.dataset?.src || i.src || '').replace(/il_\d+x\d+/, 'il_fullxfull')).filter(Boolean);
      });
    } else {
      // Generic: grab all large images
      imageUrls = await page.evaluate(() => {
        const imgs = document.querySelectorAll('img');
        return [...imgs].filter(i => i.naturalWidth >= 200 || i.width >= 200).map(i => i.src).filter(Boolean);
      });
    }

    await browser.close();

    // Deduplicate
    imageUrls = [...new Set(imageUrls)].filter(u => u.startsWith('http'));

    // Download images
    fs.mkdirSync(outputDir, { recursive: true });
    const downloaded = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const ext = imageUrls[i].match(/\.(jpg|jpeg|png|webp)/i)?.[1] || 'jpg';
      const dest = path.join(outputDir, `${i}.${ext}`);
      try {
        await downloadImage(imageUrls[i], dest);
        downloaded.push({ index: i, url: imageUrls[i], path: dest });
      } catch (e) {
        // Skip failed downloads
      }
    }

    return { platform, total: downloaded.length, images: downloaded };
  } catch (e) {
    await browser.close();
    throw e;
  }
}

module.exports = { scrapePage, detectPlatform };
