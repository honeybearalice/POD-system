const express = require('express');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db');
const { backfillThumbnails } = require('../services/thumbnail');
const { dirs } = require('../utils/file');

const router = express.Router();

// Dashboard stats
router.get('/stats', (req, res) => {
  const db = getDb();
  const images = db.prepare('SELECT COUNT(*) as count FROM images').get().count;
  const designs = db.prepare('SELECT COUNT(*) as count FROM designs').get().count;
  const mockups = db.prepare('SELECT COUNT(*) as count FROM mockups').get().count;
  const products = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  const compliant = db.prepare("SELECT COUNT(*) as count FROM images WHERE risk_level = 'compliant'").get().count;
  const infringing = db.prepare("SELECT COUNT(*) as count FROM images WHERE risk_level = 'infringing'").get().count;
  const highRisk = db.prepare("SELECT COUNT(*) as count FROM images WHERE risk_level = 'high_risk'").get().count;
  res.json({ images, designs, mockups, products, risk: { compliant, infringing, highRisk } });
});

// Recent activity
router.get('/recent', (req, res) => {
  const db = getDb();
  const recent = db.prepare(`
    SELECT id, 'image' as type, 'uploaded' as action, category as detail, created_at FROM images
    UNION ALL
    SELECT id, 'design' as type, 'extracted' as action, method as detail, created_at FROM designs
    UNION ALL
    SELECT id, 'product' as type, 'created' as action, title as detail, created_at FROM products
    ORDER BY created_at DESC LIMIT 20
  `).all();
  res.json(recent);
});

// Storage usage
router.get('/storage', (req, res) => {
  function dirStats(dirPath) {
    if (!fs.existsSync(dirPath)) return { count: 0, sizeBytes: 0 };
    let count = 0, sizeBytes = 0;
    const walk = (p) => {
      for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
        if (entry.isDirectory()) walk(path.join(p, entry.name));
        else { count++; sizeBytes += fs.statSync(path.join(p, entry.name)).size; }
      }
    };
    walk(dirPath);
    return { count, sizeBytes };
  }
  const stats = {};
  let totalBytes = 0;
  for (const [key, dir] of Object.entries(dirs)) {
    if (key === 'brands') continue;
    stats[key] = dirStats(dir);
    totalBytes += stats[key].sizeBytes;
  }
  res.json({ ...stats, totalBytes });
});

// List images with filters
router.get('/images', (req, res) => {
  const { riskLevel, scrapeJobId, limit } = req.query;
  const db = getDb();
  let sql = 'SELECT * FROM images WHERE 1=1';
  const params = [];
  if (riskLevel) { sql += ' AND risk_level = ?'; params.push(riskLevel); }
  if (scrapeJobId) { sql += ' AND scrape_job_id = ?'; params.push(scrapeJobId); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit) || 100);
  res.json(db.prepare(sql).all(...params));
});

// Delete single image
router.delete('/images/:id', (req, res) => {
  const db = getDb();
  const img = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.id);
  if (!img) return res.status(404).json({ error: 'Image not found' });

  const deleteOp = db.transaction(() => {
    try { fs.unlinkSync(img.path); } catch {}
    if (img.thumbnail_path) try { fs.unlinkSync(img.thumbnail_path); } catch {}
    // Delete related designs and their mockups
    const designs = db.prepare('SELECT id FROM designs WHERE source_image_id = ?').all(img.id);
    for (const d of designs) {
      db.prepare('DELETE FROM mockups WHERE design_id = ?').run(d.id);
    }
    db.prepare('DELETE FROM designs WHERE source_image_id = ?').run(img.id);
    db.prepare('DELETE FROM images WHERE id = ?').run(img.id);
  });

  try { deleteOp(); res.json({ deleted: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// List designs
router.get('/designs', (req, res) => {
  const db = getDb();
  const designs = db.prepare('SELECT * FROM designs ORDER BY created_at DESC LIMIT 100').all();
  res.json(designs);
});

// Delete infringing images (with transaction for consistency)
router.post('/delete-infringing', (req, res) => {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM images WHERE risk_level = 'infringing'").all();

  const deleteAll = db.transaction(() => {
    rows.forEach(r => {
      try { fs.unlinkSync(r.path); } catch {}
      if (r.thumbnail_path) try { fs.unlinkSync(r.thumbnail_path); } catch {}
    });
    db.prepare("DELETE FROM images WHERE risk_level = 'infringing'").run();
  });

  try { deleteAll(); res.json({ deleted: rows.length }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Reset all data
router.post('/reset', (req, res) => {
  const db = getDb();
  const resetOp = db.transaction(() => {
    // Clean files
    for (const [key, dir] of Object.entries(dirs)) {
      if (key === 'brands' || !fs.existsSync(dir)) continue;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        try { fs.rmSync(p, { recursive: true, force: true }); } catch {}
      }
    }
    // Clean tables
    db.prepare('DELETE FROM listings').run();
    db.prepare('DELETE FROM products').run();
    db.prepare('DELETE FROM mockups').run();
    db.prepare('DELETE FROM designs').run();
    db.prepare('DELETE FROM images').run();
    db.prepare('DELETE FROM scrape_jobs').run();
  });

  try { resetOp(); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Backfill thumbnails
router.post('/generate-thumbnails', async (req, res) => {
  try {
    const db = getDb();
    const count = await backfillThumbnails(db);
    res.json({ generated: count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
