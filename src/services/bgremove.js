const { execFile } = require('child_process');
const path = require('path');

const PYTHON = path.join(__dirname, '../../.venv/bin/python3');
const SCRIPT = path.join(__dirname, '../../python/bg_remove.py');

function removeBg(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    execFile(PYTHON, [SCRIPT, inputPath, outputPath], { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`bg_remove failed: ${stderr || err.message}`));
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

module.exports = { removeBg };
