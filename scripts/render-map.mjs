// Renders the current default itinerary in headless Chromium and saves the app's
// PNG export plus a full-page screenshot. Usage: OUT=dir node scripts/render-map.mjs
import { chromium } from 'playwright';
const out = process.env.OUT || '.';
const url = process.env.URL || 'http://127.0.0.1:5173/';
const width = Number(process.env.WIDTH || 1800);
const height = Number(process.env.HEIGHT || 1100);
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(url, { waitUntil: 'load' });
// Wait until routing finished (status pill gone) and tiles settled.
await page.waitForFunction(() => !document.body.innerText.includes('Routing '), null, { timeout: 90000 }).catch(() => console.log('routing still pending'));
await page.waitForTimeout(6000);
await page.screenshot({ path: `${out}/app.png` });
// Dump the resolved legs (routed times/distances) as JSON for downstream use.
const legs = await page.evaluate(() => [...document.querySelectorAll('.leg-connector')].map((el) => ({
  label: el.getAttribute('aria-label'),
  text: el.innerText.replace(/\s+/g, ' ').trim(),
  mode: el.classList.contains('leg-connector--flight') ? 'flight' : 'drive',
  fallback: el.classList.contains('leg-connector--fallback'),
})));
await import('node:fs').then((fs) => fs.writeFileSync(`${out}/legs.json`, JSON.stringify(legs, null, 2)));
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 90000 }),
  (async () => { await page.click('button[title="Export the map"]'); await page.click('text=Map image (PNG)'); })(),
]);
await download.saveAs(`${out}/map-export.png`);
console.log('saved', `${out}/map-export.png`);
await browser.close();
