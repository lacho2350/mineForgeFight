# Mine Forge Fight — current state (handover)

_Last updated 2026-10-06. Read this before changing anything; then read the files it points to._

## What the game is

A mobile (Expo / React Native, also runs on web) mining-and-stronghold game inspired by
**Deep Corp** (KishMish Games): a side-view Wild West mine under a small surface stronghold.
Miners cut deposits, haulers push carts to the lift, coal and ores flow up to a warehouse, and the
stronghold spends gold, coal and ores on its buildings (18 kinds, levels 1–20), raises a 9-unit army and
fights off raiders in Heroes III–style hex battles, or sells ore at the trading post.

Two screens (Expo Router, `src/app/`):

| Route | File | What it shows |
|---|---|---|
| `/` | `src/app/index.tsx` | Stronghold: surface scene (Skia, tap a building to select it), construction panel, trading post (coal contract + ore market), haul-route stockpile table. |
| `/mine` | `src/app/mine.tsx` | The mine map (pan/zoom camera), Dig toggle, deposit info panel, stockpile table, hauling chain, Dig Deeper. |
| `/battle` | `src/app/battle.tsx` | The battle at the gate: hex board, orders, auto-battle / quick resolve, log, result. |

Both main screens show a `RaidBanner` (next raid countdown → raiders sighted → at the gate → result).

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
- **Hauling**: each level with miners has 1+ carts with red-shirted haulers (`carts[level]`, default 1,
  max one per miner; bought in the mine screen's Haulage section for coal + gold, ×1.6 per extra cart).
  A level's miners are shared out between its carts (miner i → cart i mod n); each cart visits its
  miners in turn: load beside the miner → path through dug tiles to the lift (BFS) → up the lift →
  pushed out to that resource's bin at the mine exit → tip → back down to the next miner. Coal only
  moves on load/tip events — the simulation and the renderer share one schedule (`haulage.ts`) driven
  by `haulTime`, so numbers change exactly when the cart is seen loading/tipping. Carts stop when a
  resource's exit bin can't take another load.
- **Stockpiles, per resource**: `vein` (miners' bins) → `mineExit` (surface bins) → `mineStock` →
  `warehouse`. Capacities apply per resource. Surface carts move exit→mine→warehouse each tick
  (per-tick totals shared across resources).
- **Buildings** (`src/game/buildings.ts`): 18 buildings, each level 0 (empty plot) to 20. Economy: Central
  Keep, Workers' Houses, Warehouses, Foundry, Research Facility. Defence: Armory, Wall, Towers, Gate. One
  dwelling per unit: Guardhouse, Archery Range, Barracks, Monastery, Balloon Works, Stables, Griffin Eyrie,
  Paladin Chapel, Celestial Sanctum. Start: keep/houses/warehouse/foundry/guardhouse at 1, the rest 0.
  Effects come from `buildingStats(levels)`: keep = level cap for everything else, builders `1 + ⌊L/5⌋`,
  taxes L gold per 5 s; houses = beds `2L + ⌊L²/4⌋` (each new bed hires a miner who auto-assigns);
  warehouses = capacity `100·1.3^(L−1)` per resource + mine stockpiles; foundry = miner rate and cart load;
  research = dig speed/cost; stables = surface wagon haul (and cavalry); gate = gate HP + 3%/level trade
  prices; wall = HP of each wall section; towers = `2 + ⌊L/5⌋` towers, `5 + 3L` damage per shot per round;
  armory = +⌈L/2⌉ attack / +⌊L/2⌋ defence for every unit. Dwellings of strong units need a keep level
  before their first level (`requiredKeep`). Costs (`buildingCost`): treasury gold ×1.3 per level plus
  warehouse resources (coal from L1, granite 3, copper 5, iron 7, gold ore 11, diamonds 15). A cost bigger
  than warehouse capacity blocks the upgrade. Build time `6 + 2·L^1.6` s; `construction` jobs tick per second.
- **Army** (`src/game/units.ts`): pikeman, bowman, swordsman, monk, balloon, cavalry, griffin, paladin,
  angel (tiers 1–9), stats after Heroes III (attack, defence, damage range, HP, speed, shots) plus abilities:
  pikemen +50% vs riders; bowmen/monks/balloons shoot; monks heal an ally (10 HP each, can bring back
  fallen members up to the stack's starting size); balloons fly and are immune to melee (never pinned);
  cavalry +5% damage per hex charged; griffins fly and retaliate twice; paladins give every ally +2/+2;
  angels fly and resurrect once per battle (100 HP each, even a destroyed stack). Recruits accumulate at
  each built dwelling (`unitGrowth`, per 2-minute muster, up to 3 musters), need the unit's keep level,
  and cost gold (+ some ore for higher tiers). Start: 12 pikemen. `army`, `recruits`, `recruit()`.
- **Raids** (`src/game/raids.ts`): first raiders arrive at 6:00, then 5 min after each raid ends; sighted
  60 s ahead. Raid n has value `600·1.3^(n−1)` split into 2–7 stacks of goblins, wolf riders, orc archers,
  harpies, ogres (2× wall damage), cyclopes (shoot walls), behemoths (ignore 40% defence), stronger types
  joining with n. At arrival a `battle` starts; open the battle screen to command it, otherwise it
  quick-resolves after 30 s. Win: bounty 30% of raid value in gold. Lose: 30% of gold and of every
  warehouse resource is plundered. Survivors (and healed/resurrected) rejoin the army; the dead are lost.
- **Combat** (`src/game/combat.ts`, pure + deterministic): 13×9 hex field (odd rows shifted). Raiders
  deploy left, the army right (shooters behind). Wall in column 9 with the gate in row 4: walkers must
  break a section/the gate (the AI aims for the weakest point); the army can pass its own gate; raiders'
  arrows over a standing wall do half damage. Each round towers shoot the most valuable raiders, then
  stacks act by speed (ties: defenders first). Damage = rolled base × (1 + 5%/point attack over defence,
  max +300%; or −2.5%/point under, min 30%), half for long range (>7) and for shooters in melee. One
  retaliation per round (griffins 2). Defend = +30% defence till next turn. 30 rounds → raiders withdraw.
  `act(battle, action)` returns a new battle; `chooseAction` is the AI; `resolveBattle` = quick combat.
- **Economy**: carts and digging cost warehouse **coal** + gold; buildings also cost ores. Trading post: Furnace contract (20 coal →
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
    buildings.ts           stronghold buildings: ids, start levels, stats per level, costs, build time
    units.ts               army + raider stats/abilities, dwellings, recruit costs and growth
    combat.ts              hex battle engine: setup, turns, damage, walls/towers, AI, quick resolve
    raids.ts               raid timing, strength, composition, bounty/plunder constants
  components/
    MineMapLayout.ts       grid constants (tile size, columns, levels, stations, exit bins)
    MineScene(.web).tsx    platform wrapper; web loads Skia (CanvasKit) lazily via WithSkiaWeb
    MineViewport.tsx       camera (pan/pinch/wheel/keys), view culling, dig drag, taps, labels,
                           haul clock, pickaxe layer
    MineSceneCanvas.tsx    the Skia canvas: terrain chunks, carts, miners, bins, dig overlay
    mineTerrain.ts         terrain renderer: tiles, fog, and cached block images (16 × 4 tiles) with
                           dirty tracking so a change only redraws nearby blocks
    MineHaulers.tsx        carts + haulers, miner bins, mine-exit bins (Skia pictures)
    MineHaulerSteps.ts     heap step counts (Skia-free so the viewport can import it on web)
    MinePickaxe(.web).tsx  animated pickaxe (Reanimated on native, CSS on web)
    MineSceneReadout.tsx   small readout labels on the map
    DepositPanel.tsx       tapped-tile info + Assign / Release / Dig & Assign
    HaulagePanel.tsx       carts per level + Add Cart
    StockpileTable.tsx     resources × stages table (both screens)
    MarketPanel.tsx        trading post market
    GameScene*.tsx         stronghold surface scene (Skia): every building drawn in 4 looks by tier
                           (levels 1–5 timber, 6–10 plaster, 11–15 stone, 16–20 dressed stone + gold),
                           empty plots, scaffolding + progress bar while building
    GameSceneLayout.ts     scene size (600×300, three rows), building plots (tap areas), mine hotspot;
                           narrow phones scroll the scene sideways (min scale 0.8)
    BattleBoard(.web).tsx, BattleBoardCanvas.tsx   battlefield (Skia): hexes, wall/gate, towers, sprites
    battleLayout.ts        hex geometry for the board, taps and labels (Skia-free)
    unitSprites.ts         12×12 pixel sprites for all 16 creatures (also drawn in the town's yard)
    RaidBanner.tsx         raid status banner on both main screens
    BuildingsPanel.tsx     construction panel: selected building's effects now → next, cost, Upgrade,
                           unit card + Recruit for dwellings; grid of all buildings with levels / progress
    GameUI.tsx             shared buttons/labels
```

### Key ideas to keep

- **One source of truth for the mine**: `selectMineLayout(state)` → `buildMineLayout(...)`, cached by
  `layoutVersion`. **Bump `layoutVersion` whenever dug tiles, sites, opened stations, depth, or a
  deposit's drawn step change**, or terrain/cart routes won't refresh. `depositMined` in the cached
  layout can lag; UI that shows live amounts passes live `depositMined` (see `mine.tsx`, `DepositLabels`).
- **Rendering is virtualised**: the canvas is screen-sized; a camera (`camX`, `camY`, `zoom` shared
  values) transforms the map; only blocks/sites inside `view` are mounted. Terrain is rasterised once
  into images per 16×4-tile block (one image draw per block per frame, nearest sampling, no AA).
  `trackChanges` diffs successive layouts (dug tiles, sites/faces, deposit steps) and only re-rasterises
  blocks within 4 tiles of a change. Replaced images are freed after a delay (the canvas may still be
  drawing them). Per-frame motion (camera, carts, pickaxes) runs on the UI thread; the haul clock only
  writes while it is moving; screens under the top one are frozen (`freezeOnBlur`).
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

- **Git**: work is committed on feature branches and merged to `main` (remote `origin`, GitHub
  `lacho2350/mineForgeFight`). `.claude/` (launch config) is untracked.
- Verified: typecheck, lint, expo-doctor pass; flows tested in the web preview and via Node sims.
  Pinch zoom and right-drag pan are untested (desktop automation can't do two-finger touch/right-drag).

## Known gaps / likely next steps

1. **Save/load** (e.g. Zustand `persist` + AsyncStorage) — the most visible gap.
2. Balance pass: building costs, recruit prices and raid strength vs. mining output are first guesses.
3. Battle polish: movement animation (stacks jump), Heroes-style "wait", morale/luck, hero commander,
   two-hex units; going out to attack raider camps.
4. Wall tap area sits behind the back-row buildings; it is selectable at its ends or from the grid.
5. No feedback text when a hand-drawn dig is released on an invalid tile (it just doesn't order).
6. Deep levels: one lift ride can take ~40 s each way; rebalance speeds if it feels slow.
