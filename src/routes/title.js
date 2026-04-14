const express = require('express');
const { generateTitle, generateDescription } = require('../services/title-generator');

const router = express.Router();

router.post('/generate', (req, res) => {
  const { templateName, filename, tags, platform, count } = req.body;
  const results = [];
  const n = Math.min(count || 5, 20);
  for (let i = 0; i < n; i++) {
    const title = generateTitle({ templateName, filename, tags, platform });
    const description = generateDescription(title);
    results.push({ ...title, description });
  }
  res.json({ results });
});

module.exports = router;
