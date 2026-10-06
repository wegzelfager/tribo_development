/**
 * Process-image optimiser (sharp)
 * Reads raw PNGs from scripts/_originals/
 * Outputs to src/assets/images/process/:
 *   process-0N.webp        2560 px wide  quality ~84  (≤ 350 KB target)
 *   process-0N-1280.webp   1280 px wide  (mobile srcset)
 *   process-0N.avif        2560 px wide  quality ~55
 *
 * Usage:
 *   node scripts/optimize-process-images.mjs
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ORIGINALS_DIR = path.join(ROOT, 'scripts', '_originals');
const OUT_DIR = path.join(ROOT, 'src', 'assets', 'images', 'process');

fs.mkdirSync(OUT_DIR, { recursive: true });

const SLUGS = ['process-01', 'process-02', 'process-03', 'process-04'];

async function optimizeAll() {
  const table = [];

  for (const slug of SLUGS) {
    const rawPngPath = path.join(ORIGINALS_DIR, `${slug}.png`);
    if (!fs.existsSync(rawPngPath)) {
      console.warn(`Missing original: ${rawPngPath}`);
      continue;
    }

    const rawMeta = await sharp(rawPngPath).metadata();

    // 2560w WebP (target <= 350KB)
    let webpQ = 84;
    let webpBuf = await sharp(rawPngPath)
      .resize(2560, null, { kernel: sharp.kernel.lanczos3 })
      .webp({ quality: webpQ })
      .toBuffer();
    while (webpBuf.byteLength > 360000 && webpQ > 60) {
      webpQ -= 5;
      webpBuf = await sharp(rawPngPath)
        .resize(2560, null, { kernel: sharp.kernel.lanczos3 })
        .webp({ quality: webpQ })
        .toBuffer();
    }
    const webpPath = path.join(OUT_DIR, `${slug}.webp`);
    fs.writeFileSync(webpPath, webpBuf);

    // 1280w WebP
    const webp1280Path = path.join(OUT_DIR, `${slug}-1280.webp`);
    await sharp(rawPngPath)
      .resize(1280, null, { kernel: sharp.kernel.lanczos3 })
      .webp({ quality: 80 })
      .toFile(webp1280Path);

    // 2560w AVIF
    const avifPath = path.join(OUT_DIR, `${slug}.avif`);
    await sharp(rawPngPath)
      .resize(2560, null, { kernel: sharp.kernel.lanczos3 })
      .avif({ quality: 55 })
      .toFile(avifPath);

    const m2560 = await sharp(webpPath).metadata();
    const m1280 = await sharp(webp1280Path).metadata();

    table.push({
      slug,
      rawPng: (fs.statSync(rawPngPath).size / 1024).toFixed(0) + ' KB',
      rawDims: `${rawMeta.width}x${rawMeta.height}`,
      webp2560: `${(fs.statSync(webpPath).size / 1024).toFixed(0)} KB (${m2560.width}x${m2560.height})`,
      webp1280: `${(fs.statSync(webp1280Path).size / 1024).toFixed(0)} KB (${m1280.width}x${m1280.height})`,
      avif2560: `${(fs.statSync(avifPath).size / 1024).toFixed(0)} KB`,
    });
  }

  console.table(table);
  console.log('\n✅ All process images optimized in src/assets/images/process/');
}

optimizeAll().catch(err => {
  console.error('Optimization error:', err);
  process.exit(1);
});
