/**
 * Multi-platform listing manager.
 * Handles OAuth token storage, batch uploads, and queue management.
 * Phase 1: CSV export for all platforms.
 * Phase 2+: Direct API integration per platform.
 */
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db');

// Platform-specific field mappings
const PLATFORM_FIELDS = {
  etsy: { titleMax: 140, descMax: 10000, tagsMax: 13, tagLenMax: 20 },
  amazon: { titleMax: 200, descMax: 2000, tagsMax: 50 },
  temu: { titleMax: 120, descMax: 5000, tagsMax: 20 },
  tiktok: { titleMax: 255, descMax: 10000, tagsMax: 50 },
  shopee: { titleMax: 120, descMax: 3000, tagsMax: 20 },
};

function truncate(str, max) {
  return str && str.length > max ? str.substring(0, max - 3) + '...' : str;
}

function formatForPlatform(product, platform) {
  const fields = PLATFORM_FIELDS[platform] || PLATFORM_FIELDS.etsy;
  return {
    title: truncate(product.title, fields.titleMax),
    description: truncate(product.description, fields.descMax),
    tags: (JSON.parse(product.tags || '[]')).slice(0, fields.tagsMax),
    price: product.price,
    images: JSON.parse(product.mockup_ids || '[]'),
  };
}

function exportCSV(products, platform, outputPath) {
  const fields = PLATFORM_FIELDS[platform] || PLATFORM_FIELDS.etsy;
  const header = 'Title,Description,Tags,Price,Image1,Image2,Image3,Image4,Image5\n';
  const rows = products.map(p => {
    const fmt = formatForPlatform(p, platform);
    const images = fmt.images.slice(0, 5).join('|');
    const escapeCsv = s => `"${(s || '').replace(/"/g, '""')}"`;
    return [
      escapeCsv(fmt.title),
      escapeCsv(fmt.description),
      escapeCsv(fmt.tags.join(',')),
      fmt.price || '',
      ...fmt.images.slice(0, 5).map(escapeCsv),
    ].join(',');
  }).join('\n');

  fs.writeFileSync(outputPath, header + rows);
  return outputPath;
}

// Queue-based listing system
class ListingQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  add(productId, platform, shopId) {
    const db = getDb();
    const id = require('uuid').v4();
    db.prepare('INSERT INTO listings (id, product_id, platform, shop_id, status) VALUES (?, ?, ?, ?, ?)').run(id, productId, platform, shopId, 'pending');
    this.queue.push({ id, productId, platform, shopId });
    if (!this.processing) this.process();
    return id;
  }

  async process() {
    this.processing = true;
    const db = getDb();
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      db.prepare('UPDATE listings SET status = ? WHERE id = ?').run('uploading', item.id);
      try {
        // Platform-specific upload logic would go here
        // For now, mark as listed (CSV export is the primary method)
        db.prepare('UPDATE listings SET status = ?, listed_at = CURRENT_TIMESTAMP WHERE id = ?').run('listed', item.id);
      } catch (e) {
        db.prepare('UPDATE listings SET status = ?, error_message = ? WHERE id = ?').run('error', e.message, item.id);
      }
    }
    this.processing = false;
  }

  getStatus(listingId) {
    const db = getDb();
    return db.prepare('SELECT * FROM listings WHERE id = ?').get(listingId);
  }
}

const listingQueue = new ListingQueue();

module.exports = { exportCSV, formatForPlatform, listingQueue, PLATFORM_FIELDS };
