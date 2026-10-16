// Drives the web dev server with Playwright: skips the prologue, fills the warehouse so the stockpile
// shows, taps the warehouse (see-through buildings), starts placing a building (the ghost), goes down the
// mine and back up, and saves screenshots + console errors under smoke/.
import { chromium } from 'playwright';
import fs from 'node:fs';

const out = 'smoke';
fs.mkdirSync(out, { recursive: true });
const consoleLog = [];
const errors = [];
const shot = async (page, name) => page.screenshot({ path: `${out}/${name}.png` });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 820 } });
page.on('console', (m) => {
  const line = `[${m.type()}] ${m.text()}`;
  consoleLog.push(line);
  if (m.type() === 'error') errors.push(line);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

try {
  await page.goto('http://localhost:8081', { waitUntil: 'domcontentloaded', timeout: 300_000 });
  await page.locator('[aria-label="Skip the prologue"], [aria-label="MINE"]').first().waitFor({ timeout: 300_000 });
  await wait(1500);
  await shot(page, '00-loaded');
  const skip = page.locator('[aria-label="Skip the prologue"]');
  if (await skip.count()) {
    await skip.first().click();
    await wait(1000);
  }
  await page.locator('[aria-label="MINE"]').first().waitFor({ timeout: 60_000 });
  await wait(12_000); // CanvasKit + the castle image
  await shot(page, '01-stronghold');

  // Fill the warehouse and the mine stockpile, so the yard shows goods and the haulers carry some.
  const cap = await page.evaluate(() => {
    const store = globalThis.mineforgeStore;
    if (!store) return -1;
    const state = store.getState();
    const capacity = state.warehouseCapacity;
    const share = { coal: 0.95, wood: 0.6, granite: 1, copper: 0.5, iron: 0.3, gold: 0.7, diamond: 0.9, tin: 0.2, silver: 1, sulfur: 0.4, salt: 0.4, emerald: 0.5, mithril: 0.5, wool: 0.5 };
    const warehouse = { ...state.warehouse };
    for (const [k, v] of Object.entries(share)) warehouse[k] = Math.floor(capacity * v);
    const mineStock = { ...state.mineStock, coal: 40, iron: 30, granite: 20, copper: 10 };
    store.setState({ warehouse, mineStock });
    return capacity;
  });
  consoleLog.push(`[smoke] warehouseCapacity=${cap}`);
  await wait(3000);
  await shot(page, '02-stockpile');
  const zoomIn = page.locator('[aria-label="Zoom in"]').first();
  await zoomIn.click();
  await wait(400);
  await zoomIn.click();
  await wait(2500);
  await shot(page, '03-stockpile-zoomed');

  // The happiness buildings: a fairground, a church and gardens on free ground, staffed from the campfire.
  await page.evaluate(() => {
    const store = globalThis.mineforgeStore;
    const state = store.getState();
    const spots = { fairground1: { x: 36, y: 29 }, church1: { x: 17, y: 22 }, gardens1: { x: 24, y: 22 } };
    const cleared = [...state.clearedRocks];
    for (const spot of Object.values(spots)) for (let x = spot.x; x < spot.x + 3; x++) for (let y = spot.y; y < spot.y + 3; y++) cleared.push(`${x},${y}`);
    store.setState({
      placements: { ...state.placements, ...spots },
      buildings: { ...state.buildings, fairground1: 6, church1: 11, gardens1: 6 },
      clearedRocks: cleared,
      population: 30,
      warehouse: { ...state.warehouse, fish: 40, mutton: 40 },
    });
    store.getState().autoAssignCity();
  });
  await wait(4000);
  await shot(page, '03b-mood-buildings');
  await page.locator('[aria-label^="Happiness"]').first().click();
  await wait(1000);
  await shot(page, '03c-mood-sheet');
  const cruel = page.locator('[aria-label="Cruel taxes"]');
  if (await cruel.count()) await cruel.first().click();
  await wait(500);
  await shot(page, '03d-mood-cruel');
  await page.locator('[aria-label="Close"]').last().click();
  await wait(800);

  // A raid: sighted (drawn on their ground), then a battle in the field the captains fight; the clock must
  // keep running throughout. Then a reload: the saved game resumes and keeps ticking.
  const clockAt = () => page.evaluate(() => globalThis.mineforgeStore.getState().elapsedSeconds);
  await page.evaluate(() => {
    const store = globalThis.mineforgeStore;
    store.setState({ nextRaidAt: store.getState().elapsedSeconds + 65, army: { ...store.getState().army, pikeman: 3 } });
  });
  for (let i = 0; i < 4; i += 1) {
    await wait(25_000);
    consoleLog.push(`[smoke] raid phase ${i}: clock ${await clockAt()} raid=${JSON.stringify(await page.evaluate(() => { const s = globalThis.mineforgeStore.getState(); return { raid: !!s.raid, battle: s.battle?.status ?? null, happiness: s.happiness, population: s.population }; }))}`);
    await shot(page, `03e-raid-${i}`);
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[aria-label="MINE"]').first().waitFor({ timeout: 120_000 });
  await wait(12_000);
  const t1 = await clockAt();
  await wait(5000);
  const t2 = await clockAt();
  consoleLog.push(`[smoke] after reload: clock ${t1} -> ${t2}`);
  if (t2 <= t1) errors.push(`[smoke] the clock stopped after a reload: ${t1} -> ${t2}`);
  await shot(page, '03f-reloaded');
  await page.locator('[aria-label="Zoom in"]').first().click();
  await page.locator('[aria-label="Zoom in"]').first().click();
  await wait(2500);

  // Tap the warehouse from the Buildings list: whatever stands in front of it should fade.
  await page.locator('[aria-label="BUILDINGS"]').first().click();
  await wait(800);
  await page.locator('[aria-label^="Warehouses, level"]').first().click();
  await wait(3000);
  await shot(page, '04-warehouse-tapped');
  await page.locator('[aria-label="Close"]').last().click();
  await wait(1500);
  await shot(page, '05-warehouse-closed');

  // Start placing a building: buildings in front of the ghost should fade.
  await page.locator('[aria-label="BUILD"]').first().click();
  await wait(800);
  const options = page.locator('[aria-label^="Build the "]');
  const names = await options.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  consoleLog.push(`[smoke] build options: ${names.join(' | ')}`);
  await options.first().click();
  await wait(3000);
  await shot(page, '06-placing');
  const cancel = page.locator('[aria-label^="CANCEL"]');
  if (await cancel.count()) await cancel.first().click();
  await wait(1000);

  // Down the mine and back up.
  await page.locator('[aria-label="MINE"]').first().click();
  await wait(250);
  await shot(page, '07-mine-first-frame');
  await wait(8000);
  await shot(page, '08-mine');
  await page.locator('[aria-label="Go up to the city"]').first().click();
  await wait(300);
  await shot(page, '09-city-first-frame');
  await wait(3000);
  await shot(page, '10-city-again');
} catch (e) {
  errors.push(`[smoke] ${e.stack ?? e.message}`);
  await shot(page, '99-failure').catch(() => {});
} finally {
  fs.writeFileSync(`${out}/console.log`, consoleLog.join('\n'));
  fs.writeFileSync(`${out}/errors.log`, errors.join('\n'));
  await browser.close();
}
console.log(`smoke: ${errors.length} error(s)`);
console.log(errors.join('\n'));
