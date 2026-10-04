// Usage:  npm i -D sharp  &&  npm run optimize:images
// Optional: npm run optimize:images -- src   (use 'src' on older Angular projects)
// Reads the originals and writes .webp NEXT to them (originals are kept as fallback).
import sharp from 'sharp';
import { existsSync, statSync } from 'node:fs';

const BASE = process.argv[2] || 'public';

// width: the image is only ever shown at a fraction of this, so keep it small.
// Decoded size in RAM is ~ 4 bytes x width x height, regardless of the file size on disk.
// alphaQuality: only matters for images with transparency (frame, suv). 100 keeps clean edges.
const jobs = [
  { src: 'window_frame.png', width: 1200, quality: 85, alphaQuality: 100 }, // keeps transparency
  { src: 'sky_view.jpg', width: 1600, quality: 78 },                    // scaled up ~9x, keep it wide
  { src: 'assets/images/suv-cutout.png', width: 900, quality: 88, alphaQuality: 100 }, // keeps transparency
];

const kb = (p) => (statSync(p).size / 1024).toFixed(0) + ' KB';

for (const j of jobs) {
  const input = `${BASE}/${j.src}`;
  const output = input.replace(/\.(png|jpe?g)$/i, '.webp');

  if (!existsSync(input)) { console.warn('skip (not found):', input); continue; }
  // Guard: an input that is already .webp would map to the same path and sharp would throw.
  if (output === input) { console.warn('skip (already .webp):', input); continue; }

  await sharp(input)
    .resize({ width: j.width, withoutEnlargement: true })
    .webp({ quality: j.quality, effort: 6, alphaQuality: j.alphaQuality ?? 90 })
    .toFile(output);

  console.log(`${j.src}: ${kb(input)}  ->  ${output.split('/').pop()}: ${kb(output)}`);
}