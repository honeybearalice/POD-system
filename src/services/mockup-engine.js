const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { TEMPLATES_DIR } = require('../utils/file');

async function generateMockup(designPath, templateName, outputPath) {
  const tplDir = path.join(TEMPLATES_DIR, templateName);
  const configPath = path.join(tplDir, 'config.json');
  const templatePath = path.join(tplDir, 'template.png');
  const maskPath = path.join(tplDir, 'mask.png');

  if (!fs.existsSync(configPath)) throw new Error(`Template not found: ${templateName}`);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const { designArea } = config;

  // Resize design to fit the designated area
  const resizedDesign = await sharp(designPath)
    .resize(designArea.width, designArea.height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Detect ImageMagick: v7 uses `magick`, v6 uses `convert`
  const magickBin = fs.existsSync('/usr/bin/magick') ? 'magick' : (fs.existsSync('/usr/bin/convert') ? 'convert' : null);

  if (config.perspective && magickBin) {
    // Use ImageMagick for perspective transform (curved surfaces like mugs)
    const tmpDesign = outputPath.replace('.png', '_tmp_design.png');
    const tmpWarped = outputPath.replace('.png', '_tmp_warped.png');
    fs.writeFileSync(tmpDesign, resizedDesign);

    const { src, dst } = config.perspective;
    const distortArgs = src.map((s, i) => `${s[0]},${s[1]},${dst[i][0]},${dst[i][1]}`).join(' ');
    execSync(`${magickBin} ${tmpDesign} -virtual-pixel transparent -distort Perspective "${distortArgs}" ${tmpWarped}`);

    const warped = fs.readFileSync(tmpWarped);
    await sharp(templatePath)
      .composite([{ input: warped, left: designArea.x, top: designArea.y }])
      .png()
      .toFile(outputPath);

    // Cleanup temp files
    try { fs.unlinkSync(tmpDesign); fs.unlinkSync(tmpWarped); } catch {}
  } else if (fs.existsSync(maskPath)) {
    // Use mask-based compositing
    const mask = await sharp(maskPath)
      .resize(designArea.width, designArea.height)
      .greyscale()
      .toBuffer();

    const maskedDesign = await sharp(resizedDesign)
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();

    await sharp(templatePath)
      .composite([{ input: maskedDesign, left: designArea.x, top: designArea.y }])
      .png()
      .toFile(outputPath);
  } else {
    // Simple overlay
    await sharp(templatePath)
      .composite([{ input: resizedDesign, left: designArea.x, top: designArea.y }])
      .png()
      .toFile(outputPath);
  }

  return { output: outputPath, template: templateName };
}

async function generateAllMockups(designPath, outputDir) {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  const templates = fs.readdirSync(TEMPLATES_DIR).filter(d =>
    fs.existsSync(path.join(TEMPLATES_DIR, d, 'config.json'))
  );

  const results = [];
  for (const tpl of templates) {
    const outPath = path.join(outputDir, `${tpl}.png`);
    try {
      const r = await generateMockup(designPath, tpl, outPath);
      results.push(r);
    } catch (e) {
      results.push({ template: tpl, error: e.message });
    }
  }
  return results;
}

module.exports = { generateMockup, generateAllMockups };
