const express = require('express');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { generateMockup, generateAllMockups } = require('../services/mockup-engine');
const { getTemplates, dirs, TEMPLATES_DIR } = require('../utils/file');

const router = express.Router();

// Multer for template upload (template.png + mask.png)
const tplUpload = multer({ dest: '/tmp/tpl-uploads', limits: { fileSize: 20 * 1024 * 1024 } });

// List templates
router.get('/templates', (req, res) => {
  const templates = getTemplates();
  // Add preview URL for each template
  res.json(templates.map(t => ({
    ...t,
    previewUrl: `/app/files/templates/${t.slug}/template.png`,
  })));
});

// Upload new template
router.post('/templates', tplUpload.fields([
  { name: 'template', maxCount: 1 },
  { name: 'mask', maxCount: 1 },
]), async (req, res) => {
  try {
    const { name, displayName, category, x, y, width, height } = req.body;
    if (!name || !req.files?.template) {
      return res.status(400).json({ error: 'name and template image are required' });
    }

    // Sanitize template name (slug)
    const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    const tplDir = path.join(TEMPLATES_DIR, slug);

    // Check if already exists
    if (fs.existsSync(tplDir)) {
      return res.status(409).json({ error: `Template "${slug}" already exists` });
    }

    fs.mkdirSync(tplDir, { recursive: true });

    // Copy template image (copyFile avoids EXDEV cross-device errors)
    const tplFile = req.files.template[0];
    fs.copyFileSync(tplFile.path, path.join(tplDir, 'template.png'));
    fs.unlinkSync(tplFile.path);

    // Copy mask if provided
    if (req.files.mask?.[0]) {
      fs.copyFileSync(req.files.mask[0].path, path.join(tplDir, 'mask.png'));
      fs.unlinkSync(req.files.mask[0].path);
    }

    // Auto-detect design area from image dimensions if not provided
    const sharp = require('sharp');
    const meta = await sharp(path.join(tplDir, 'template.png')).metadata();
    const designArea = {
      x: parseInt(x) || Math.round(meta.width * 0.15),
      y: parseInt(y) || Math.round(meta.height * 0.15),
      width: parseInt(width) || Math.round(meta.width * 0.7),
      height: parseInt(height) || Math.round(meta.height * 0.7),
    };

    // Write config
    const config = {
      name: displayName || name,
      category: category || 'apparel',
      designArea,
    };
    fs.writeFileSync(path.join(tplDir, 'config.json'), JSON.stringify(config, null, 2));

    res.json({
      slug,
      ...config,
      previewUrl: `/app/files/templates/${slug}/template.png`,
      templateSize: { width: meta.width, height: meta.height },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update template config (design area, name, category)
router.put('/templates/:slug', (req, res) => {
  const { slug } = req.params;
  const tplDir = path.join(TEMPLATES_DIR, slug);
  const configPath = path.join(tplDir, 'config.json');
  if (!fs.existsSync(configPath)) return res.status(404).json({ error: 'Template not found' });

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const { displayName, category, x, y, width, height } = req.body;

    if (displayName) config.name = displayName;
    if (category) config.category = category;
    if (x !== undefined) config.designArea.x = parseInt(x);
    if (y !== undefined) config.designArea.y = parseInt(y);
    if (width !== undefined) config.designArea.width = parseInt(width);
    if (height !== undefined) config.designArea.height = parseInt(height);

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    res.json({ slug, ...config });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete template
router.delete('/templates/:slug', (req, res) => {
  const { slug } = req.params;
  const tplDir = path.join(TEMPLATES_DIR, slug);
  if (!fs.existsSync(tplDir)) return res.status(404).json({ error: 'Template not found' });

  try {
    fs.rmSync(tplDir, { recursive: true, force: true });
    res.json({ deleted: true, slug });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Generate mockups for a design
router.post('/generate', async (req, res) => {
  try {
    const { designId, templateNames } = req.body;
    const db = getDb();
    const design = db.prepare('SELECT * FROM designs WHERE id = ?').get(designId);
    if (!design) return res.status(404).json({ error: 'Design not found' });

    const batchId = uuidv4();
    const outputDir = path.join(dirs.mockups, batchId);
    fs.mkdirSync(outputDir, { recursive: true });

    let results;
    if (templateNames?.length) {
      results = [];
      for (const tpl of templateNames) {
        const mockupId = uuidv4();
        const outPath = path.join(outputDir, `${tpl}.png`);
        try {
          await generateMockup(design.path, tpl, outPath);
          db.prepare('INSERT INTO mockups (id, design_id, template_name, path) VALUES (?, ?, ?, ?)').run(mockupId, designId, tpl, outPath);
          results.push({ id: mockupId, template: tpl, url: `/app/files/mockups/${batchId}/${tpl}.png` });
        } catch (e) {
          results.push({ template: tpl, error: e.message });
        }
      }
    } else {
      const raw = await generateAllMockups(design.path, outputDir);
      results = raw.map(r => {
        if (r.error) return r;
        const mockupId = uuidv4();
        db.prepare('INSERT INTO mockups (id, design_id, template_name, path) VALUES (?, ?, ?, ?)').run(mockupId, designId, r.template, r.output);
        return { id: mockupId, template: r.template, url: `/app/files/mockups/${batchId}/${r.template}.png` };
      });
    }

    res.json({ batchId, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Download all mockups as ZIP
router.get('/download/:batchId', (req, res) => {
  const dir = path.join(dirs.mockups, req.params.batchId);
  if (!fs.existsSync(dir)) return res.status(404).json({ error: 'Batch not found' });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename=mockups-${req.params.batchId}.zip`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(res);
  archive.directory(dir, false);
  archive.finalize();
});

module.exports = router;
