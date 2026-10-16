// The production web export (served statically) with the saved game from the dev run, tweaked so a raid
// comes at once and the hold is hungry — the state that froze the hosted build. Watches that the clock
// keeps running and records every console error.
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const out = 'smoke';
const dist = process.argv[2] ?? 'dist';
const port = 8082;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  let file = path.join(dist, decodeURIComponent(url.pathname));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  res.setHeader('Content-Type', types[path.extname(file)] ?? 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(port, resolve));

const consoleLog = [];
const errors = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 820 } });
page.on('console', (m) => {
  const line = `[${m.type()}] ${m.text()}`;
  consoleLog.push(line);
  if (m.type() === 'error') errors.push(line);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack ?? ''}`));
const hudText = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300);

try {
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.locator('[aria-label="Skip the prologue"], [aria-label="MINE"]').first().waitFor({ timeout: 120_000 });
  const skip = page.locator('[aria-label="Skip the prologue"]');
  if (await skip.count()) await skip.first().click();
  await wait(8000);
  await page.screenshot({ path: `${out}/prod-00-fresh.png` });
  consoleLog.push(`[prod] fresh: ${await hudText()}`);
  // The dev run's save, with a raid due in 20 s and no food.
  if (fs.existsSync(`${out}/save.json`)) {
    const save = JSON.parse(fs.readFileSync(`${out}/save.json`, 'utf8'));
    save.state.nextRaidAt = save.state.elapsedSeconds + 20;
    save.state.warehouse.apples = 0;
    save.state.warehouse.fish = 0;
    save.state.warehouse.mutton = 0;
    save.state.hungry = true;
    // The hosted build froze with everyone gone: nobody left, nobody working.
    save.state.population = 0;
    save.state.staffing = {};
    save.state.sites = [];
    save.state.pendingSites = [];
    consoleLog.push(`[prod] save.json: ${String(fs.statSync(`${out}/save.json`).size)} bytes, elapsed ${String(save.state.elapsedSeconds)}, version ${String(save.version)}`);
    // The running game writes its own save every few seconds and on page hide: put ours in and stop the
    // game's writes, then reload.
    await page.evaluate((text) => {
      localStorage.setItem('mineforge-save', text);
      Storage.prototype.setItem = () => {};
      Storage.prototype.removeItem = () => {};
    }, JSON.stringify(save));
    await page.reload({ waitUntil: 'domcontentloaded' });
    consoleLog.push(`[prod] reloaded with: ${(await page.evaluate(() => localStorage.getItem('mineforge-save') ?? '')).slice(0, 120)}`);
    await page.locator('[aria-label="MINE"]').first().waitFor({ timeout: 120_000 });
    for (let i = 0; i < 4; i += 1) {
      await wait(10_000);
      consoleLog.push(`[prod] saved game +${String((i + 1) * 10)}s: ${await hudText()}`);
      await page.screenshot({ path: `${out}/prod-01-saved-${String(i)}.png` });
    }
    const a = await hudText();
    await wait(3000);
    const b = await hudText();
    if (a === b) errors.push('[prod] the HUD did not change in 3 s: the game looks frozen');
  } else {
    errors.push('[prod] no save.json from the dev run');
  }
} catch (e) {
  errors.push(`[prod] ${e.stack ?? e.message}`);
  await page.screenshot({ path: `${out}/prod-99-failure.png` }).catch(() => {});
} finally {
  fs.writeFileSync(`${out}/prod-console.log`, consoleLog.join('\n'));
  fs.writeFileSync(`${out}/prod-errors.log`, errors.join('\n'));
  await browser.close();
  server.close();
}
console.log(`prod smoke: ${errors.length} error(s)`);
console.log(errors.join('\n'));
