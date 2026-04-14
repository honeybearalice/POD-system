const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { removeBg } = require('../services/bgremove');
const { checkImage } = require('../services/ip-detector');
const { generateThumbnail } = require('../services/thumbnail');
const bus = require('../services/event-bus');
const { dirs } = require('../utils/file');

const router = express.Router();
const upload = multer({ dest: dirs.uploads, limits: { fileSize: 50 * 1024 * 1024 } });

// Upload image
router.post('/upload', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const id = uuidv4();
  const ext = path.extname(req.file.originalname) || '.png';
  const newPath = path.join(dirs.uploads, `${id}${ext}`);
  require('fs').renameSync(req.file.path, newPath);

  const db = getDb();
  db.prepare('INSERT INTO images (id, path, category) VALUES (?, ?, ?)').run(id, newPath, 'upload');

  // Generate thumbnail
  try {
    const thumbPath = await generateThumbnail(newPath, id);
    db.prepare('UPDATE images SET thumbnail_path = ? WHERE id = ?').run(thumbPath, id);
  } catch {}

  bus.emit('event', { type: 'image:uploaded', imageId: id });
  res.json({ id, path: newPath, filename: req.file.originalname });
});

// Remove background
router.post('/remove-bg', async (req, res) => {
  try {
    const { imageId, imagePath } = req.body;
    let inputPath = imagePath;
    if (imageId) {
      const db = getDb();
      const img = db.prepare('SELECT * FROM images WHERE id = ?').get(imageId);
      if (!img) return res.status(404).json({ error: 'Image not found' });
      inputPath = img.path;
    }
    if (!inputPath) return res.status(400).json({ error: 'imageId or imagePath required' });

    const resolved = require('path').resolve(inputPath);
    if (!resolved.startsWith(dirs.uploads) && !resolved.startsWith(dirs.extracted)) {
      return res.status(400).json({ error: 'Invalid image path' });
    }

    const designId = uuidv4();
    const outputPath = path.join(dirs.extracted, `${designId}.png`);
    const result = await removeBg(inputPath, outputPath);

    const db = getDb();
    db.prepare('INSERT INTO designs (id, source_image_id, path, method, resolution) VALUES (?, ?, ?, ?, ?)').run(designId, imageId || null, outputPath, 'bg_remove', `${result.width}x${result.height}`);

    bus.emit('event', { type: 'design:created', designId, imageId });
    res.json({ designId, ...result, output: `/app/files/extracted/${designId}.png` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// IP Check
router.post('/ip-check', async (req, res) => {
  try {
    const { imageId } = req.body;
    const db = getDb();
    const img = db.prepare('SELECT * FROM images WHERE id = ?').get(imageId);
    if (!img) return res.status(404).json({ error: 'Image not found' });

    const result = await checkImage(img.path);
    db.prepare('UPDATE images SET risk_level = ?, risk_details = ? WHERE id = ?').run(result.risk_level, JSON.stringify(result), imageId);

    bus.emit('event', { type: 'ip-check:done', imageId, risk_level: result.risk_level });
    res.json({ imageId, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Batch IP check
router.post('/ip-check-batch', async (req, res) => {
  const { imageIds } = req.body;
  if (!imageIds?.length) return res.status(400).json({ error: 'imageIds required' });

  const results = [];
  const db = getDb();
  for (let i = 0; i < imageIds.length; i++) {
    const imageId = imageIds[i];
    const img = db.prepare('SELECT * FROM images WHERE id = ?').get(imageId);
    if (!img) { results.push({ imageId, error: 'not found' }); continue; }
    try {
      const result = await checkImage(img.path);
      db.prepare('UPDATE images SET risk_level = ?, risk_details = ? WHERE id = ?').run(result.risk_level, JSON.stringify(result), imageId);
      results.push({ imageId, ...result });
      bus.emit('event', { type: 'ip-check:progress', imageId, index: i + 1, total: imageIds.length, risk_level: result.risk_level });
    } catch (e) {
      results.push({ imageId, error: e.message });
    }
  }
  bus.emit('event', { type: 'ip-check:batch-done', total: results.length });
  res.json({ results });
});

module.exports = router;
