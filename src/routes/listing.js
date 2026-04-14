const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { exportCSV, listingQueue, PLATFORM_FIELDS } = require('../services/listing-manager');
const { dirs } = require('../utils/file');

const router = express.Router();

// Get supported platforms
router.get('/platforms', (req, res) => {
  res.json(Object.keys(PLATFORM_FIELDS).map(p => ({ id: p, name: p.charAt(0).toUpperCase() + p.slice(1), fields: PLATFORM_FIELDS[p] })));
});

// Create product (pre-listing)
router.post('/products', (req, res) => {
  const { designId, title, description, tags, price, mockupIds } = req.body;
  const id = uuidv4();
  const db = getDb();
  db.prepare('INSERT INTO products (id, design_id, title, description, tags, price, mockup_ids, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, designId, title, description, JSON.stringify(tags || []), price || 0, JSON.stringify(mockupIds || []), 'draft');
  res.json({ id });
});

// Get products
router.get('/products', (req, res) => {
  const db = getDb();
  const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
  res.json(products);
});

// Update product
router.put('/products/:id', (req, res) => {
  const { title, description, tags, price, status } = req.body;
  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  db.prepare('UPDATE products SET title = ?, description = ?, tags = ?, price = ?, status = ? WHERE id = ?').run(
    title ?? product.title,
    description ?? product.description,
    tags ? JSON.stringify(tags) : product.tags,
    price ?? product.price,
    status ?? product.status,
    req.params.id
  );
  res.json({ updated: true });
});

// Delete product
router.delete('/products/:id', (req, res) => {
  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  db.prepare('DELETE FROM listings WHERE product_id = ?').run(req.params.id);
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

// Export as CSV for platform
function handleExportCSV(req, res) {
  const productIds = req.body?.productIds || (req.query.productIds ? req.query.productIds.split(',') : []);
  const platform = req.body?.platform || req.query.platform;
  if (!productIds?.length || !platform) return res.status(400).json({ error: 'productIds and platform required' });

  const db = getDb();
  const products = productIds.map(id => db.prepare('SELECT * FROM products WHERE id = ?').get(id)).filter(Boolean);
  if (!products.length) return res.status(404).json({ error: 'No products found' });

  const csvPath = path.join(dirs.mockups, `export-${platform}-${Date.now()}.csv`);
  exportCSV(products, platform, csvPath);

  res.download(csvPath, `${platform}-products-${Date.now()}.csv`);
}
router.post('/export-csv', handleExportCSV);
router.get('/export-csv', handleExportCSV);

// Queue listing for platform
router.post('/list', (req, res) => {
  const { productId, platform, shopId } = req.body;
  if (!productId || !platform) return res.status(400).json({ error: 'productId and platform required' });
  const id = listingQueue.add(productId, platform, shopId);
  res.json({ listingId: id, status: 'queued' });
});

// Get listing status
router.get('/status/:id', (req, res) => {
  const status = listingQueue.getStatus(req.params.id);
  if (!status) return res.status(404).json({ error: 'Listing not found' });
  res.json(status);
});

module.exports = router;
