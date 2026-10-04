// Usage:  npm i -D sharp  &&  npm run optimize:images
// Reads the originals and writes .webp NEXT to them (originals are kept as fallback).
import sharp from 'sharp';
import { existsSync, statSync } from 'node:fs';

const BASE = process.argv[2] || 'public'; // use 'src' on older Angular projects
const jobs = [
  { src: 'window_frame.png',            width: 1600, quality: 85 }, // keeps transparency
  { src: 'sky_view.jpg',                width: 1600, quality: 78 },
  { src: 'assets/images/suv-cutout.png', width: 900,  quality: 88 }, // keeps transparency
];

const kb = (p) => (statSync(p).size / 1024).toFixed(0) + ' KB';

for (const j of jobs) {
  const input = `${BASE}/${j.src}`;
  const output = input.replace(/\.(png|jpe?g)$/i, '.webp');
  if (!existsSync(input)) { console.warn('skip (not found):', input); continue; }
  await sharp(input)
    .resize({ width: j.width, withoutEnlargement: true })
    .webp({ quality: j.quality, effort: 5, alphaQuality: 90 })
    .toFile(output);
  console.log(`${j.src}: ${kb(input)}  ->  ${output.split('/').pop()}: ${kb(output)}`);
}
