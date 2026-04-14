const express = require('express');
const path = require('path');
const { ensureDirs, dirs, TEMPLATES_DIR } = require('./src/utils/file');

// Ensure data directories exist
ensureDirs();

const app = express();
app.use(express.json({ limit: '50mb' }));

// CORS — allow all origins for local/container dev
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Static file serving for processed images (Caddy strips /app prefix via handle_path)
app.use('/files/uploads', express.static(dirs.uploads));
app.use('/files/extracted', express.static(dirs.extracted));
app.use('/files/designs', express.static(dirs.designs));
app.use('/files/mockups', express.static(dirs.mockups));
app.use('/files/thumbnails', express.static(dirs.thumbnails));
app.use('/files/templates', express.static(TEMPLATES_DIR));

// API routes
app.use('/api/scrape', require('./src/routes/scrape'));
app.use('/api/process', require('./src/routes/process'));
app.use('/api/mockup', require('./src/routes/mockup'));
app.use('/api/title', require('./src/routes/title'));
app.use('/api/listing', require('./src/routes/listing'));
app.use('/api/product', require('./src/routes/product'));
app.use('/api/events', require('./src/routes/events'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Global error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI-POD server running on port ${PORT}`);
});
