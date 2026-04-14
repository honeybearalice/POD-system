const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { getDb } = require('../db');
const { scrapePage } = require('../services/scraper');
const { generateThumbnail } = require('../services/thumbnail');
const bus = require('../services/event-bus');
const { dirs } = require('../utils/file');

const router = express.Router();

// Scrape jobs in progress (in-memory for speed)
const jobs = new Map();

router.post('/', async (req, res) => {
  const { url, query } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  const id = uuidv4();
  const db = getDb();
  db.prepare('INSERT INTO scrape_jobs (id, platform, query, url, status) VALUES (?, ?, ?, ?, ?)').run(id, '', query || '', url, 'scraping');
  jobs.set(id, { status: 'scraping', images: [] });
  bus.emit('event', { type: 'scrape:start', jobId: id, url });
  res.json({ id, status: 'scraping' });

  // Run in background
  try {
    const outputDir = path.join(dirs.uploads, id);
    const result = await scrapePage(url, outputDir);
    const images = [];
    for (const img of result.images) {
      const imgId = uuidv4();
      db.prepare('INSERT INTO images (id, scrape_job_id, path, source_url, platform) VALUES (?, ?, ?, ?, ?)').run(imgId, id, img.path, img.url, result.platform);
      // Generate thumbnail
      try {
        const thumbPath = await generateThumbnail(img.path, imgId);
        db.prepare('UPDATE images SET thumbnail_path = ? WHERE id = ?').run(thumbPath, imgId);
      } catch {}
      images.push({ id: imgId, ...img });
    }
    db.prepare('UPDATE scrape_jobs SET status = ?, platform = ?, total_images = ? WHERE id = ?').run('done', result.platform, result.total, id);
    jobs.set(id, { status: 'done', images, platform: result.platform });
    bus.emit('event', { type: 'scrape:done', jobId: id, imageCount: images.length, platform: result.platform });
  } catch (e) {
    db.prepare('UPDATE scrape_jobs SET status = ? WHERE id = ?').run('error', id);
    jobs.set(id, { status: 'error', error: e.message, images: [] });
    bus.emit('event', { type: 'scrape:error', jobId: id, error: e.message });
  }
});

router.get('/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM scrape_jobs WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Job not found' });
    const images = db.prepare('SELECT * FROM images WHERE scrape_job_id = ?').all(req.params.id);
    return res.json({ ...row, images });
  }
  res.json(job);
});

module.exports = router;
