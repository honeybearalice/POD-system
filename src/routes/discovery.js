const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { getDb } = require('../db');
const { discoverProducts } = require('../services/discovery');
const { scrapePage } = require('../services/scraper');
const { generateThumbnail } = require('../services/thumbnail');
const bus = require('../services/event-bus');
const { PRESETS } = require('../data/presets');
const { dirs } = require('../utils/file');

const router = express.Router();

// In-memory job cache for fast polling
const jobs = new Map();

const SUPPORTED_PLATFORMS = ['etsy', 'amazon', 'redbubble'];

// GET /presets — static preset categories
router.get('/presets', (req, res) => {
  res.json(PRESETS);
});

// POST / — start a discovery search
router.post('/', (req, res) => {
  let { query, platforms, page } = req.body;
  if (!query || !query.trim()) return res.status(400).json({ error: 'query is required' });

  query = query.trim();
  platforms = (platforms || SUPPORTED_PLATFORMS).filter(p => SUPPORTED_PLATFORMS.includes(p));
  if (!platforms.length) platforms = SUPPORTED_PLATFORMS;
  page = parseInt(page) || 1;

  const id = uuidv4();
  const db = getDb();
  db.prepare('INSERT INTO discovery_jobs (id, query, platforms, status) VALUES (?, ?, ?, ?)')
    .run(id, query, platforms.join(','), 'searching');

  const jobData = { id, status: 'searching', query, platforms, results: [], errors: {}, hasMore: false };
  jobs.set(id, jobData);
  bus.emit('event', { type: 'discovery:start', jobId: id, query, platforms });
  res.json({ id, status: 'searching' });

  // Run in background
  (async () => {
    try {
      const data = await discoverProducts(query, platforms, page, (platform, count, error) => {
        bus.emit('event', { type: 'discovery:progress', jobId: id, platform, found: count, error });
      });

      const db2 = getDb();
      const insert = db2.prepare(
        'INSERT INTO discovery_results (id, discovery_job_id, platform, product_url, title, thumbnail_url, price, reviews_count, sales_count, rating, rank) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );

      const results = [];
      const insertMany = db2.transaction(() => {
        for (const p of data.products) {
          const rid = uuidv4();
          insert.run(rid, id, p.platform, p.url, p.title, p.thumbnail, p.price, p.reviewsCount || 0, p.salesCount || 0, p.rating || 0, p.rank);
          results.push({ id: rid, ...p });
        }
      });
      insertMany();

      db2.prepare('UPDATE discovery_jobs SET status = ?, total_results = ? WHERE id = ?')
        .run('done', results.length, id);

      jobData.status = 'done';
      jobData.results = results;
      jobData.hasMore = data.hasMore;
      jobData.errors = data.errors;

      bus.emit('event', { type: 'discovery:done', jobId: id, totalResults: results.length });
    } catch (e) {
      const db2 = getDb();
      db2.prepare('UPDATE discovery_jobs SET status = ?, error = ? WHERE id = ?').run('error', e.message, id);
      jobData.status = 'error';
      jobData.error = e.message;
      bus.emit('event', { type: 'discovery:error', jobId: id, error: e.message });
    }
  })();
});

// GET /:id — poll discovery job status + results
router.get('/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (job) return res.json(job);

  // Fallback to DB
  const db = getDb();
  const row = db.prepare('SELECT * FROM discovery_jobs WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Job not found' });
  const results = db.prepare('SELECT * FROM discovery_results WHERE discovery_job_id = ? ORDER BY rank').all(req.params.id);
  res.json({ ...row, results });
});

// POST /:id/scrape — batch-scrape selected discovery results
router.post('/:id/scrape', async (req, res) => {
  const { resultIds } = req.body;
  if (!resultIds?.length) return res.status(400).json({ error: 'resultIds is required' });

  const db = getDb();
  const placeholders = resultIds.map(() => '?').join(',');
  const selected = db.prepare(`SELECT * FROM discovery_results WHERE id IN (${placeholders})`).all(...resultIds);
  if (!selected.length) return res.status(404).json({ error: 'No results found' });

  // Create scrape jobs for each product URL
  const scrapeJobs = [];
  for (const result of selected) {
    const jobId = uuidv4();
    db.prepare('INSERT INTO scrape_jobs (id, platform, query, url, status) VALUES (?, ?, ?, ?, ?)')
      .run(jobId, result.platform, '', result.product_url, 'scraping');
    scrapeJobs.push({ id: jobId, url: result.product_url, platform: result.platform, title: result.title });
  }

  res.json({ scrapeJobs: scrapeJobs.map(j => ({ id: j.id, title: j.title })) });

  // Process each sequentially to avoid memory pressure
  for (const job of scrapeJobs) {
    try {
      const outputDir = path.join(dirs.uploads, job.id);
      bus.emit('event', { type: 'scrape:start', jobId: job.id, url: job.url });
      const result = await scrapePage(job.url, outputDir);
      const images = [];
      for (const img of result.images) {
        const imgId = uuidv4();
        db.prepare('INSERT INTO images (id, scrape_job_id, path, source_url, platform) VALUES (?, ?, ?, ?, ?)')
          .run(imgId, job.id, img.path, img.url, result.platform);
        try {
          const thumbPath = await generateThumbnail(img.path, imgId);
          db.prepare('UPDATE images SET thumbnail_path = ? WHERE id = ?').run(thumbPath, imgId);
        } catch {}
        images.push({ id: imgId, ...img });
      }
      db.prepare('UPDATE scrape_jobs SET status = ?, platform = ?, total_images = ? WHERE id = ?')
        .run('done', result.platform, result.total, job.id);
      bus.emit('event', { type: 'scrape:done', jobId: job.id, imageCount: images.length, platform: result.platform });
    } catch (e) {
      db.prepare('UPDATE scrape_jobs SET status = ? WHERE id = ?').run('error', job.id);
      bus.emit('event', { type: 'scrape:error', jobId: job.id, error: e.message });
    }
  }

  bus.emit('event', { type: 'discovery:scrape-done', totalJobs: scrapeJobs.length });
});

module.exports = router;
