const { execFile } = require('child_process');
const path = require('path');

const PYTHON = path.join(__dirname, '../../.venv/bin/python3');
const SCRIPT = path.join(__dirname, '../../python/ip_check.py');
const BRANDS_DIR = path.join(__dirname, '../../data/brands');

function checkImage(imagePath) {
  return new Promise((resolve, reject) => {
    execFile(PYTHON, [SCRIPT, imagePath, BRANDS_DIR], { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`ip_check failed: ${stderr || err.message}`));
      try {
        const result = JSON.parse(stdout.trim());
        if (result.error) return reject(new Error(result.error));
        resolve(result);
      } catch (e) {
        reject(new Error(`Parse error: ${stdout}`));
      }
    });
  });
}

module.exports = { checkImage };
