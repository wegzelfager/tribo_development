import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const outDir = 'C:/Users/EL SAKR TECHNOLOGY/.gemini/antigravity-ide/brain/5e25467d-fdad-474d-8d7b-36257b9b6cca/screenshots';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const testViewports = [
  { width: 320, height: 568, dpr: 3, name: '320' },
  { width: 360, height: 640, dpr: 3, name: '360' },
  { width: 375, height: 667, dpr: 3, name: '375' },
  { width: 390, height: 844, dpr: 3, name: '390' },
  { width: 412, height: 915, dpr: 3, name: '412' },
  { width: 436, height: 932, dpr: 3, name: '436' },
  { width: 768, height: 1024, dpr: 2, name: '768' },
  { width: 1024, height: 768, dpr: 2, name: '1024' },
  { width: 1440, height: 900, dpr: 1, name: '1440' },
  { width: 844, height: 390, dpr: 3, name: 'landscape_844x390' }
];

async function run() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--ignore-gpu-blocklist']
  });

  const results = {};

  try {
    for (const vp of testViewports) {
      const page = await browser.newPage();
      await page.setViewport({
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: vp.dpr,
        isMobile: vp.width < 900,
        hasTouch: vp.width < 900
      });
      await page.goto('http://localhost:4200', { waitUntil: 'networkidle0' });

      // Scroll to teaser section
      await page.evaluate(() => {
        const teaser = document.querySelector('app-journey-teaser');
        if (teaser) teaser.scrollIntoView();
      });
      await new Promise(r => setTimeout(r, 600));

      const data = await page.evaluate(() => {
        const section = document.querySelector('.teaser');
        const h2 = document.querySelector('.teaser__headline');
        const sub = document.querySelector('.teaser__sub');
        const eyebrow = document.querySelector('.teaser__eyebrow');

        const secRect = section?.getBoundingClientRect();
        const h2Rect = h2?.getBoundingClientRect();
        const subRect = sub?.getBoundingClientRect();
        const eyeRect = eyebrow?.getBoundingClientRect();

        const scrollWidth = document.documentElement.scrollWidth;
        const innerWidth = window.innerWidth;
        const computedH2 = h2 ? window.getComputedStyle(h2) : null;

        // Check visible lines count
        const bnVisible = h2?.querySelector('.bn') ? window.getComputedStyle(h2.querySelector('.bn')).display !== 'none' : false;

        return {
          scrollWidth,
          innerWidth,
          noOverflow: scrollWidth <= innerWidth,
          layout: section?.getAttribute('data-layout'),
          isShort: section?.hasAttribute('data-short'),
          fs: computedH2?.fontSize,
          h2Width: h2Rect?.width,
          h2MarginLeft: h2Rect?.left,
          h2MarginRight: innerWidth - (h2Rect?.right || 0),
          subMarginLeft: subRect?.left,
          subMarginRight: innerWidth - (subRect?.right || 0),
          eyebrowMarginLeft: eyeRect?.left,
          eyebrowMarginRight: innerWidth - (eyeRect?.right || 0),
          lines: bnVisible ? 4 : 2,
        };
      });

      results[vp.name] = data;
      console.log(`Viewport ${vp.name} (${vp.width}x${vp.height}):`, JSON.stringify(data, null, 2));

      // Take screenshot
      const shotPath = path.join(outDir, `teaser_${vp.name}.png`);
      await page.screenshot({ path: shotPath });
      await page.close();
    }

    console.log('\n=== SUMMARY OF KEY FS VALUES ===');
    console.log(`fs at 320:  ${results['320']?.fs}`);
    console.log(`fs at 390:  ${results['390']?.fs}`);
    console.log(`fs at 768:  ${results['768']?.fs}`);
    console.log(`fs at 1440: ${results['1440']?.fs}`);

  } finally {
    await browser.close();
  }
}

run().catch(console.error);
