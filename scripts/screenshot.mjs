import { chromium } from 'playwright';
const out = process.env.OUT;
const url = process.env.URL || 'http://127.0.0.1:5173/';
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy, args: ['--disable-features=PostQuantumKyber,UseMLKEM', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function shoot(name, viewport, actions) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ignoreHTTPSErrors: true, bypassCSP: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { const l = m.location(); errors.push(`${m.type()}: ${m.text()} @ ${l.url?.split('/').pop()}:${l.lineNumber}`); } });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(6000);
  if (actions) await actions(page);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(name, 'done. console issues:', errors.slice(0, 15));
  await ctx.close();
}
await shoot('desktop', { width: 1440, height: 900 });
await shoot('desktop-select', { width: 1440, height: 900 }, async (page) => {
  await page.click('#stop-entry-sfo');
  await page.waitForTimeout(1500);
});
await shoot('mobile', { width: 390, height: 844 });
await shoot('export', { width: 1440, height: 900 }, async (page) => {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    (async () => { await page.click('button[title="Export the map"]'); await page.click('text=Map image (PNG)'); })(),
  ]);
  await download.saveAs(`${out}/exported-map.png`);
  console.log('export saved', download.suggestedFilename());
});
await browser.close();
