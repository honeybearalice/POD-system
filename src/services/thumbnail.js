const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { dirs } = require('../utils/file');

async function generateThumbnail(inputPath, imageId) {
  const outPath = path.join(dirs.thumbnails, `${imageId}.jpg`);
  await sharp(inputPath)
    .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(outPath);
  return outPath;
}

async function backfillThumbnails(db) {
  const rows = db.prepare("SELECT id, path FROM images WHERE thumbnail_path IS NULL").all();
  let count = 0;
  for (const row of rows) {
    if (!fs.existsSync(row.path)) continue;
    try {
      const thumbPath = await generateThumbnail(row.path, row.id);
      db.prepare("UPDATE images SET thumbnail_path = ? WHERE id = ?").run(thumbPath, row.id);
      count++;
    } catch {}
  }
  return count;
}

module.exports = { generateThumbnail, backfillThumbnails };
