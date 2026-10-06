/**
 * Image Generation Pipeline for Process Showcase
 * Uses Gemini API (@google/genai) to generate cinematic background images.
 *
 * Flags:
 *   --force       Regenerate images even if they already exist in scripts/_originals/
 *   --only 1,2,4  Only generate specified step numbers (comma-separated)
 *
 * Usage:
 *   node scripts/generate-process-images.mjs
 *   node scripts/generate-process-images.mjs --only 1,2,4
 *   node scripts/generate-process-images.mjs --force
 */

import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ORIGINALS_DIR = path.join(ROOT, 'scripts', '_originals');
const PROMPTS_LOG = path.join(ROOT, 'scripts', 'process-image-prompts.json');

// Ensure directories exist
fs.mkdirSync(ORIGINALS_DIR, { recursive: true });

// Load .env if present
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
  } else {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match && !match[1].startsWith('#')) {
        const key = match[1];
        let val = match[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val.trim();
      }
    }
  }
}

// Parse CLI flags
const args = process.argv.slice(2);
const forceFlag = args.includes('--force');
let onlySteps = null;
const onlyArgIdx = args.findIndex(a => a === '--only' || a.startsWith('--only='));
if (onlyArgIdx !== -1) {
  const raw = args[onlyArgIdx].includes('=')
    ? args[onlyArgIdx].split('=')[1]
    : args[onlyArgIdx + 1];
  if (raw) {
    onlySteps = raw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
  }
}

const STYLE_BIBLE =
  'Cinematic, photorealistic luxury travel photography, full-frame cinema camera, 35mm, ' +
  'soft atmospheric haze, subtle film grain. Warm grade in deep espresso-brown shadows and sand-gold highlights. ' +
  'Calm, low-detail dark areas across the top third and bottom third of the frame (giant white headline text will sit there). ' +
  'Main subject placed within the centre 40% of the frame (the image is cropped to portrait on phones). ' +
  'No people, no text, no logos, no brand marks, no registration numbers, no watermarks.';

const PALETTE_FALLBACK =
  'Color palette: deep espresso-brown shadows (#1A1210), warm sand-gold highlights (#C89D66), ' +
  'golden hour rim lighting, soft amber glow, muted earth tones, low-contrast dark upper sky and lower terrain.';

const SCENES = [
  {
    step: 1,
    slug: 'process-01',
    name: 'Jets (Sky)',
    scene: 'A sleek generic ultra-long-range business jet cruising above a sea of clouds at sunset, three-quarter rear angle, warm light on the fuselage, deep brown-blue sky above.',
  },
  {
    step: 2,
    slug: 'process-02',
    name: 'Yachts (Sea)',
    scene: 'Aerial view of a modern superyacht at anchor in calm deep-teal water at sunrise, long soft wake lines, warm gold reflections on the water, wide empty water above and below.',
  },
  {
    step: 3,
    slug: 'process-03',
    name: 'Safaris (Land)',
    scene: 'A black full-size luxury SUV (no badges) on an empty savanna track at golden hour, a single acacia tree, dust haze, warm rim light, wide low horizon.',
  },
  {
    step: 4,
    slug: 'process-04',
    name: 'Escrow (Trust)',
    scene: 'A private jet apron at blue hour just after sunset: a black SUV parked beside the open airstair of a private jet, warm cabin light glowing from the door, wet reflective ground, quiet and empty.',
  },
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function requestWithTimeout(fn, timeoutMs = 300000) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs / 1000}s`)), timeoutMs)
    ),
  ]);
}

async function generateSingleImage(ai, prompt, imageSize = '4K', refImagePath = null) {
  const modelName = 'gemini-3-pro-image-preview';

  let contents = [];
  if (refImagePath && fs.existsSync(refImagePath)) {
    const refData = fs.readFileSync(refImagePath).toString('base64');
    contents.push({
      inlineData: {
        mimeType: 'image/png',
        data: refData,
      },
    });
    contents.push({
      text: `${prompt}\n\nStyle Reference instruction: match the reference image's colour grade, atmosphere, haze and level of detail, but depict a completely different scene as described above.`,
    });
  } else {
    contents.push({ text: prompt });
  }

  // Model call with fallbacks
  let response;
  try {
    response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: '16:9',
          imageSize,
        },
      },
    });
  } catch (err) {
    // If IMAGE-only rejected, try TEXT+IMAGE
    if (err.message && err.message.includes('responseModalities')) {
      response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: '16:9',
            imageSize,
          },
        },
      });
    } else {
      throw err;
    }
  }

  // Extract image data
  const candidate = response?.candidates?.[0];
  if (!candidate) throw new Error('No candidates in response');

  const part = candidate.content?.parts?.find(p => p.inlineData?.mimeType?.startsWith('image/'));
  if (!part?.inlineData?.data) {
    throw new Error(`No image data in response. Finish reason: ${candidate.finishReason || 'unknown'}`);
  }

  return Buffer.from(part.inlineData.data, 'base64');
}

async function runPipeline() {
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('               Process Showcase Image Generation Pipeline                 ');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ CRITICAL ERROR: GEMINI_API_KEY is not set in environment or .env file.');
    console.error('   Please provide a valid GEMINI_API_KEY to proceed with Gemini API image generation.\n');
    return {
      success: false,
      error: 'GEMINI_API_KEY is not set in environment or .env file',
      table: [],
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const statusTable = [];
  const promptsLogged = [];

  const refImage03Path = path.join(ORIGINALS_DIR, 'process-03.png');

  for (const item of SCENES) {
    if (onlySteps && !onlySteps.includes(item.step)) {
      continue;
    }

    const targetPng = path.join(ORIGINALS_DIR, `${item.slug}.png`);
    const alreadyExists = fs.existsSync(targetPng);

    // Rule 4: Do NOT regenerate process-03 unless --force
    if (item.step === 3 && alreadyExists && !forceFlag) {
      const meta = await sharp(targetPng).metadata();
      statusTable.push({
        image: item.slug,
        status: 'SKIPPED (Kept existing)',
        model: 'Existing Asset',
        requestedSize: '4K',
        realPixelSize: `${meta.width}×${meta.height}`,
        error: 'None',
      });
      console.log(`[${item.slug}] Existing step-3 image kept (${meta.width}×${meta.height}).`);
      continue;
    }

    if (alreadyExists && !forceFlag) {
      const meta = await sharp(targetPng).metadata();
      statusTable.push({
        image: item.slug,
        status: 'SKIPPED (Already exists)',
        model: 'Existing Asset',
        requestedSize: '4K',
        realPixelSize: `${meta.width}×${meta.height}`,
        error: 'None',
      });
      console.log(`[${item.slug}] Already exists in scripts/_originals/. Use --force to regenerate.`);
      continue;
    }

    console.log(`\n── Generating [${item.slug}] ${item.name} ─────────────────────────────`);

    let fullPrompt = `${STYLE_BIBLE}\n\nSCENE: ${item.scene}`;
    let imageBuffer = null;
    let actualSize = '4K';
    let realWidth = 0;
    let realHeight = 0;
    let success = false;
    let lastError = null;
    let usedRef = false;

    // Retry loop with exponential backoff
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`   Attempt ${attempt}/3: Requesting ${actualSize}...`);

        // Check if we should pass process-03 reference
        const tryRef = item.step !== 3 && fs.existsSync(refImage03Path) && attempt === 1;
        usedRef = tryRef;

        const p = tryRef ? fullPrompt : `${fullPrompt}\n\n${PALETTE_FALLBACK}`;

        imageBuffer = await requestWithTimeout(
          () => generateSingleImage(ai, p, actualSize, tryRef ? refImage03Path : null),
          300000
        );

        // Check real pixel width
        const meta = await sharp(imageBuffer).metadata();
        realWidth = meta.width;
        realHeight = meta.height;

        console.log(`   Received image: ${realWidth}×${realHeight}`);

        // If reference was used and resolution came out below 2560px, regenerate without reference
        if (tryRef && realWidth < 2560) {
          console.warn(`   ⚠️ Image-to-image ignored resolution (${realWidth}px < 2560px). Regenerating without reference...`);
          usedRef = false;
          imageBuffer = await requestWithTimeout(
            () => generateSingleImage(ai, `${fullPrompt}\n\n${PALETTE_FALLBACK}`, actualSize, null),
            300000
          );
          const meta2 = await sharp(imageBuffer).metadata();
          realWidth = meta2.width;
          realHeight = meta2.height;
          console.log(`   Regenerated without reference: ${realWidth}×${realHeight}`);
        }

        success = true;
        break;
      } catch (err) {
        lastError = err.message || String(err);
        console.error(`   ⚠️ Attempt ${attempt} failed: ${lastError}`);

        // If 4K fails, fall back to 2K on subsequent attempts
        if (actualSize === '4K') {
          console.log('   Falling back to 2K requested size for next attempt.');
          actualSize = '2K';
        }

        // Check for 429 retry delay
        let delayMs = Math.pow(2, attempt) * 2000;
        if (err.status === 429 || lastError.includes('429') || lastError.includes('RESOURCE_EXHAUSTED')) {
          const match = lastError.match(/retry after (\d+)/i);
          if (match) delayMs = parseInt(match[1], 10) * 1000 + 1000;
        }

        if (attempt < 3) {
          console.log(`   Waiting ${(delayMs / 1000).toFixed(1)}s before retry...`);
          await sleep(delayMs);
        }
      }
    }

    if (success && imageBuffer) {
      // Save raw PNG immediately
      await sharp(imageBuffer).png().toFile(targetPng);
      console.log(`   ✅ Saved raw PNG to ${targetPng}`);

      statusTable.push({
        image: item.slug,
        status: 'SUCCESS',
        model: 'gemini-3-pro-image-preview',
        requestedSize: actualSize,
        realPixelSize: `${realWidth}×${realHeight}`,
        error: 'None',
      });

      promptsLogged.push({
        slug: item.slug,
        name: item.name,
        prompt: fullPrompt,
        usedReference: usedRef,
        requestedSize: actualSize,
        realPixelSize: `${realWidth}×${realHeight}`,
      });

      // Pause 6-8s between images
      console.log('   Pausing 6s before next image...');
      await sleep(6000);
    } else {
      statusTable.push({
        image: item.slug,
        status: 'FAILED',
        model: 'gemini-3-pro-image-preview',
        requestedSize: actualSize,
        realPixelSize: 'N/A',
        error: lastError || 'Unknown error',
      });
    }
  }

  // Save prompts log
  if (promptsLogged.length > 0) {
    fs.writeFileSync(PROMPTS_LOG, JSON.stringify(promptsLogged, null, 2));
  }

  // Print summary table
  console.log('\n═══════════════════════════════════════════════════════════════════════════');
  console.log('                        Generation Status Summary                          ');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.table(statusTable);

  return {
    success: statusTable.every(r => r.status.includes('SUCCESS') || r.status.includes('SKIPPED')),
    table: statusTable,
  };
}

runPipeline().catch(err => {
  console.error('Fatal pipeline error:', err);
  process.exit(1);
});
