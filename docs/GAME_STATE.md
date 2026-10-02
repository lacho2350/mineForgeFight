# Mine Forge Fight — current state (handover)

_Last updated 2026-10-02. Read this before changing anything; then read the files it points to._

## What the game is

A mobile (Expo / React Native, also runs on web) mining-and-stronghold game inspired by
**Deep Corp** (KishMish Games): a side-view Wild West mine under a small surface stronghold.
Miners cut deposits, haulers push carts to the lift, coal and ores flow up to a warehouse, and the
stronghold spends coal and gold on upgrades or sells ore at the trading post.

Two screens (Expo Router, `src/app/`):

| Route | File | What it shows |
|---|---|---|
| `/` | `src/app/index.tsx` | Stronghold: surface scene (Skia), resource bar, haul-route stockpile table, trading post (coal contract + ore market), upgrades (miner hut, pickaxes, warehouse). |
| `/mine` | `src/app/mine.tsx` | The mine map (pan/zoom camera), Dig toggle, deposit info panel, stockpile table, hauling chain, Dig Deeper. |

`src/app/_layout.tsx` wraps everything in `GestureHandlerRootView` + `SafeAreaProvider` and starts
the 1-second simulation (`startSimulation()`).

## Gameplay rules (as implemented)

- **Map**: 300 columns × ~2,260 rows of 48 px tiles (≈14,400 × 108,000 px). The lift is the centre
  column (150). Rows 0–1 are the surface. Each gallery "level" is 5 rows: rock, miners' chambers,
  2 rows of ladder shaft, rail tunnel. Level −1 is the entrance level (rail tunnel on row 6); galleries
  0…449 follow. The whole depth exists from the start as dark rock; **Dig Deeper** opens the next
  gallery (extends the lift, adds 8 station slots, +25 vein capacity). Cost: `100 + 60·(depth−1)^1.35` gold.
- **Rock rule** (user requirement): tunnels/shafts never run side by side — at least one rock tile
  between them; tunnels only meet end-on. The two columns beside the lift stay rock (tunnels may only
  cross them sideways). Enforced by `checkDigStep` in `src/game/mineLayout.ts`.
- **Deposits**: ~30% of tiles, in clusters of 1–15 tiles (5×5 cells, each grows one cluster inside
  its top-left 4×4 so clusters never touch). Types: coal, granite, copper, iron, gold, diamond (gold
  and diamonds commoner with depth). Each holds 1,000–5,000 units (precious ones less). Deterministic
  from tile position (hash), computed lazily and cached. Every gallery station's "ore column" tile is
  always a coal seam. Deposits **block digging**; a mined-out deposit becomes a hollow you can dig through.
- **Miners and sites**: `miners` = hired; `sites` = working miners (stand tile + face tile, face can be
  beside/above/below); `pendingSites` = miners waiting for an auto-dug tunnel; the rest are idle.
  Each miner mines `minerRate`/s from their face into that resource's "vein" stockpile until the
  deposit is mined out (miner then becomes idle). Hut: costs coal+gold, adds a miner, auto-assigns to a
  free face (coal first) else waits idle.
- **Assigning**: tap a tile → info panel (`DepositPanel`). Double-tap → assign an idle miner. If nothing
  is dug beside the deposit, the game finds the shortest legal tunnel (`findDigRoute`, BFS within
  30 tiles, ≤40 tiles long), charges for it, and reserves the miner until it's dug. Gallery station
  seams open the station (chamber + ladder shaft, which then stay dug — `openedStations`).
- **Digging by hand**: Dig mode; drag from any tunnel end across rock. Path follows the finger, backs
  up when retraced, stops red at the first invalid tile. Cost `3 + floor(row/10)` gold/tile, paid on
  release; time `2 + 0.04·row` s/tile, one tile at a time (`digPlan`, `digProgress`).
- **Hauling**: one cart + red-shirted hauler per level (sites grouped by level), visiting that level's
  miners in turn: load beside the miner → path through dug tiles to the lift (BFS) → up the lift →
  pushed out to that resource's bin at the mine exit → tip → back down to the next miner. Coal only
  moves on load/tip events — the simulation and the renderer share one schedule (`haulage.ts`) driven
  by `haulTime`, so numbers change exactly when the cart is seen loading/tipping. Carts stop when a
  resource's exit bin can't take another load.
- **Stockpiles, per resource**: `vein` (miners' bins) → `mineExit` (surface bins) → `mineStock` →
  `warehouse`. Capacities apply per resource. Surface carts move exit→mine→warehouse each tick
  (per-tick totals shared across resources).
- **Economy**: costs are paid in warehouse **coal** + gold. Trading post: Furnace contract (20 coal →
  32 gold) and a market selling any resource from the warehouse at `RESOURCE_PRICE`
  (coal 1, granite 1, copper 3, iron 4, gold 12, diamond 30).

## Code map

```
src/
  app/                     routes (Expo Router)
    _layout.tsx            gesture root, safe area, starts the simulation
    index.tsx              stronghold screen
    mine.tsx               mine screen (layout + live state → MineScene, panels)
  game/                    simulation + pure model (no React Native / Skia)
    gameStore.ts           Zustand store: all state + tick() + actions
    mineLayout.ts          the tile model: dug tiles & kinds, deposits/clusters, sites, dig rules,
                           deposit info, auto-dig route finder
    haulage.ts             cart routes (BFS to lift), trip schedule, cart pose (worklet), events
    resources.ts           RESOURCES list, Stock type, names/colours, market prices
  components/
    MineMapLayout.ts       grid constants (tile size, columns, levels, stations, exit bins)
    MineScene(.web).tsx    platform wrapper; web loads Skia (CanvasKit) lazily via WithSkiaWeb
    MineViewport.tsx       camera (pan/pinch/wheel/keys), view culling, dig drag, taps, labels,
                           haul clock, pickaxe layer
    MineSceneCanvas.tsx    the Skia canvas: terrain chunks, carts, miners, bins, dig overlay
    mineTerrain.ts         terrain renderer: cached chunk pictures (16 columns × 1 row), fog, tiles
    MineHaulers.tsx        carts + haulers, miner bins, mine-exit bins (Skia pictures)
    MineHaulerSteps.ts     heap step counts (Skia-free so the viewport can import it on web)
    MinePickaxe(.web).tsx  animated pickaxe (Reanimated on native, CSS on web)
    MineSceneReadout.tsx   small readout labels on the map
    DepositPanel.tsx       tapped-tile info + Assign / Release / Dig & Assign
    StockpileTable.tsx     resources × stages table (both screens)
    MarketPanel.tsx        trading post market
    GameScene*.tsx, GameSceneLayout.ts   stronghold surface scene (Skia) + its layout maths
    GameUI.tsx             shared buttons/labels
```

### Key ideas to keep

- **One source of truth for the mine**: `selectMineLayout(state)` → `buildMineLayout(...)`, cached by
  `layoutVersion`. **Bump `layoutVersion` whenever dug tiles, sites, opened stations, depth, or a
  deposit's drawn step change**, or terrain/cart routes won't refresh. `depositMined` in the cached
  layout can lag; UI that shows live amounts passes live `depositMined` (see `mine.tsx`, `DepositLabels`).
- **Rendering is virtualised**: the canvas is screen-sized; a camera (`camX`, `camY`, `zoom` shared
  values) transforms the map; only chunks/sites inside `view` are mounted. Terrain chunk pictures are
  cached by `layoutVersion:row:chunk`. Per-frame motion (camera, carts, pickaxes) runs on the UI thread.
- **Sim ↔ renderer sync**: the store applies cart loads/tips for the haul-time window
  `(haulAppliedTime, haulTime]`; the renderer plays `haulTime−1 → haulTime` (`useHaulClock`).
- **Web quirks**: Skia's web `<Canvas style>` must be a plain object (not an array). Modules imported
  by non-lazy web code must not touch Skia at module load (hence `MineHaulerSteps.ts`). Avoid
  `__destroyWebGLContextAfterRender` (broke hidden screens).

## Running, checking, testing

- Node is only available via **nvm** (v24). In a non-interactive shell: `source ~/.nvm/nvm.sh` first.
- Checks (run before calling anything done): `npx tsc --noEmit` · `npx expo lint` · `npx expo-doctor`.
- Web dev server: `npx expo start --web --port 8081` (`.claude/launch.json` has an `expo-web` config).
  **Never set `CI=1`** — Metro then stops watching files and serves stale lazy chunks.
- **There is no persistence**: reloading the page resets the game (and loses dug tunnels).
- Fast logic tests without the UI: compile the store to CommonJS and drive it from Node, e.g.
  ```bash
  OUT=/tmp/sim && npx tsc src/game/gameStore.ts --ignoreConfig --outDir $OUT --rootDir src \
    --module commonjs --target es2022 --skipLibCheck --moduleResolution bundler --esModuleInterop
  NODE_PATH=$PWD/node_modules node -e "const {useGameStore}=require('$OUT/game/gameStore.js'); \
    const s=useGameStore; s.setState({miners:3,gold:1000}); for(let i=0;i<60;i++) s.getState().tick(); \
    console.log(s.getState().warehouse)"
  ```
- To see late-game states in the browser, temporarily change the initial state in `gameStore.ts`
  (mark with `// TEMP-DEBUG` and remove before finishing). Navigating by URL reloads the page; use
  the in-app links to keep state.
- Browser automation shares the pane with the user — unexpected clicks/pans may be the user playing.

## Status

- **Git**: one commit (`firstAtempt`, the original prototype). Everything since is **staged but not
  committed** on `main`. `.claude/` (launch config) is untracked.
- Verified: typecheck, lint, expo-doctor pass; flows tested in the web preview and via Node sims.
  Pinch zoom and right-drag pan are untested (desktop automation can't do two-finger touch/right-drag).

## Known gaps / likely next steps

1. **Save/load** (e.g. Zustand `persist` + AsyncStorage) — the most visible gap.
2. **Uses for ores** beyond selling (buildings/upgrades costing copper, iron, granite…); currently all
   costs are coal + gold.
3. Haul capacity upgrades (bigger carts / more haulers per level) — one cart per level is a real
   bottleneck deeper down.
4. Stronghold building system is still a single picture + 3 upgrade buttons.
5. No feedback text when a hand-drawn dig is released on an invalid tile (it just doesn't order).
6. Deep levels: one lift ride can take ~40 s each way; rebalance speeds if it feels slow.
