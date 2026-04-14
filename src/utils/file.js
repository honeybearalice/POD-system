const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '../../data');
const TEMPLATES_DIR = path.join(__dirname, '../../templates');

const dirs = {
  uploads: path.join(DATA_DIR, 'uploads'),
  extracted: path.join(DATA_DIR, 'extracted'),
  designs: path.join(DATA_DIR, 'designs'),
  mockups: path.join(DATA_DIR, 'mockups'),
  brands: path.join(DATA_DIR, 'brands'),
  thumbnails: path.join(DATA_DIR, 'thumbnails'),
};

function ensureDirs() {
  Object.values(dirs).forEach(d => fs.mkdirSync(d, { recursive: true }));
}

function genFilePath(dir, ext) {
  const id = uuidv4();
  return { id, path: path.join(dirs[dir], `${id}.${ext}`) };
}

function getTemplates() {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs.readdirSync(TEMPLATES_DIR).filter(d => {
    const configPath = path.join(TEMPLATES_DIR, d, 'config.json');
    return fs.existsSync(configPath);
  }).map(d => {
    const config = JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, d, 'config.json'), 'utf8'));
    return { slug: d, ...config };
  });
}

module.exports = { DATA_DIR, TEMPLATES_DIR, dirs, ensureDirs, genFilePath, getTemplates };
