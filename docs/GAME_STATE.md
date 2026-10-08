# Mine Forge Fight — current state (handover)

_Last updated 2026-10-08. Read this before changing anything; then read the files it points to._

## What the game is

A mobile (Expo / React Native, also runs on web) mining-and-stronghold game inspired by
**Deep Corp** (KishMish Games): a side-view Wild West mine under a small surface stronghold.
Miners cut deposits, haulers push carts to the lift, coal and ores flow up to a warehouse, and the
stronghold spends gold, coal and ores on its buildings (21 kinds plus up to 8 forges, levels 1–20), raises a 9-unit army and
fights off raiders in Heroes III–style hex battles, or sells ore to the river barges waiting at the docks.

Two screens (Expo Router, `src/app/`):

| Route | File | What it shows |
|---|---|---|
| `/` | `src/app/index.tsx` | Stronghold, full screen: the isometric castle map (`CityView`: drag to pan, pinch / wheel / +− to zoom, tap a building), a slim bar on top (gold, peasants, raid clock — the warehouse's resources are in the warehouse's pop-up and the Menu, not on screen), a ⚔️ **War** button on the right edge under it (red with "!" while raiders are sighted or a battle waits; otherwise a badge with the recruits that can be hired now) opening the War sheet (`CombatPanel`: the raid now via `RaidBanner inPanel` — with ride out / hold the walls, command, auto-resolve now, the next raid's kind and strength —, the auto-resolve switch, every unit with army / waiting / gear and RECRUIT ALL, the defences summary with traps per side, LAY TRAPS and links to the keep, wall, towers, gate, moat and armory, and the stakes), live raid alerts, a news toast, and a toolbar (Mine, Build, Buildings, Tech, Docks, Menu; Tech shows how many techs are ready to research, Docks shows how many barges are moored). Build opens a palette of unbuilt buildings, rock clearing, roads and traps; picking a building enters placement mode (drag the green/red footprint — a drag that starts on it moves it, any other drag pans — or tap where it should go, then Build here); picking Clear rocks, a road or a trap enters paint mode (one finger paints a stroke of tiles, laid on release; two fingers / right-drag pan; the bar switches kind; Done ends it). Tapping a building opens its pop-up (`Sheet` + `BuildingDetail`, with Destroy; the warehouse adds the haul-route table, the keep the defence summary); tapping a trap opens its sheet (effect, side, Take it up). |
| `/mine` | `src/app/mine.tsx` | The mine map (pan/zoom camera), Dig toggle, deposit info panel, stockpile table, hauling chain, haulage, the mine's tech branch, Dig Deeper. |
| `/battle` | `src/app/battle.tsx` | The battle — a siege at the walls or a battle in the field: hex board, orders, auto-battle / quick resolve, log, result. |

The mine screen shows a `RaidBanner` (next raid countdown → raiders sighted → at the gate → result); the
stronghold shows it only for live raids (sighted / at the gate); the full raid status, last result and every
combat option are in the War sheet (⚔️ side button) — the Menu just points there.

`src/app/_layout.tsx` wraps everything in `GestureHandlerRootView` + `SafeAreaProvider`, loads the saved
game, and starts the 1-second simulation (`startSimulation()`).

## Gameplay rules (as implemented)

- **Map**: 300 columns × ~2,260 rows of 48 px tiles (≈14,400 × 108,000 px). The lift is the centre
  column (150). Rows 0–1 are the surface. Each gallery "level" is 5 rows: rock, miners' chambers,
  2 rows of ladder shaft, rail tunnel. Level −1 is the entrance level (rail tunnel on row 6); galleries
  0…449 follow. The whole depth exists from the start as dark rock; **Dig Deeper** opens the next
  gallery (extends the lift, adds 12 station slots, +25 vein capacity). Cost: `100 + 60·(depth−1)^1.35` gold.
- **Rock rule** (user requirement): tunnels/shafts never run side by side — at least one rock tile
  between them; tunnels only meet end-on. The two columns beside the lift stay rock (tunnels may only
  cross them sideways). Enforced by `checkDigStep` in `src/game/mineLayout.ts`.
- **Deposits**: ~30% of tiles, in clusters of 1–15 tiles (5×5 cells, each grows one cluster inside
  its top-left 4×4 so clusters never touch). Types: coal, granite, copper, iron, gold, diamond (gold
  and diamonds commoner with depth), and the six newer ores that raise the army (`NEW_ORES`), each from a
  depth down and commoner over the next rows: tin (row 8), silver (20), sulfur (35), salt (50),
  emeralds (75), mithril (105). A cluster first rolls (`newRoll`) for a newer ore reached at its depth;
  the rest are drawn as before, so the older ores lie where they always did. Each holds 1,000–5,000 units
  (precious ones less). Deterministic
  from tile position (hash), computed lazily and cached. Every gallery station's "ore column" tile is
  always a coal seam. Deposits **block digging**; a mined-out deposit becomes a hollow you can dig through.
- **Peasants do every job** (`src/game/workforce.ts`, Stronghold-style). `population` = all peasants
  (soldiers aren't counted). New ones arrive every 4 s while `population < beds` (the keep's hall `KEEP_BEDS` = 8, plus the houses). Jobs, in
  order: miners (`sites` + `pendingSites`), cart pushers (one per cart on each worked level), building
  crews (`crewSize(level)` = 2 + ⌊L/5⌋ per construction job), then building staff in `STAFF_PRIORITY`
  order (houses first — without housekeepers only the keep's 8 beds are left, so a hold whose peasants are
  all under orders still grows back to 8 and staffs its houses). **Every building but the keep, the
  wall and the towers needs staff** (`UNSTAFFED`; `staffNeeded`: warehouse 2 + ⌊L/2⌋ haulers, gate
  1 + ⌊L/10⌋, houses and all others 1 + ⌊L/5⌋); the rest idle at the campfire. `workforceOf(state)`
  computes it; `freeHands` = staff + idle (what new orders and recruits can take — staff are pulled off
  buildings). A building short of staff works at `workedLevel` = level × staff/needed, with nobody at
  0: houses' beds, the gate's health (unmanned = an open gap) and trade bonus, foundry, research,
  armory, stables, dwelling growth; surface hauling = haulers × 6 × (1 + 0.15·stables) per tick. The
  keep, the wall's health and every tower work at their built level, and storage sizes (warehouse,
  mine stockpiles) stay with the built level so nothing stored is lost. Peasants arrive only while
  `population` < the staffed beds. Buildings can be stopped (`paused`, `toggleBuildingPause`) to free
  their staff. Assigning a
  miner needs 1 free peasant (2 for the first on a level: + a cart pusher); an extra cart needs 1;
  each recruited soldier uses up a peasant (`population` drops).
- **Miners and sites**: `sites` = working miners (stand tile + face tile, face can be beside/above/
  below); `pendingSites` = miners waiting for an auto-dug tunnel. Each miner mines `minerRate`/s from
  their face into that resource's "vein" stockpile until the deposit is mined out (then they go back
  to the campfire).
- **Assigning**: tap a tile → info panel (`DepositPanel`). Double-tap → send a free peasant to mine it. If nothing
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
- **The stronghold map** (`src/game/cityMap.ts`): 59×59 tiles in rings from the edge inward
  (`zoneAt`): tiles 0–2 **raider ground** (raiders are drawn there, on the side they come from, while a
  raid is sighted or attacking), 3–4 the **trap belt** (traps only, see below), 5 the **moat**
  (bridge at the gate), 6 the **wall ring** with the towers (`TOWER_SPOTS`) and the gate (front-left
  wall, x 28–30); the town is inside (7–51, 45×45). On the **far side from the gate there is no land** outside
  the wall: rows y 0–5 are **river** (`RIVER_ROWS`, zone `water`, flowing west → east), running right up
  to the wall, with the moat flowing into it at both ends. A walled **harbour** is cut into the castle
  square from the river (`HARBOUR`: water at x 28–30, y 6–8; the wall steps in round it — columns x 27
  and 31, back row y 9 = `DOCKS_ROW`), and the **docks** stand in the middle of its back wall
  (`DOCKS_SPOT`, `DOCK_TILES`). Mountains ring the map on all four sides (the renderer's backdrop); the
  river runs on through gorges in them (in at the back-left, out at the front-right), and the gate road
  leaves through a pass on the front-left. The **moat** ring is a building (see Buildings): a dry ditch until it's built, then
  flooded from the river (water, rims and the bridge at the gate are drawn only then). `WALL_TILES`
  lists every wall tile (the ring, open at the harbour mouth, plus the harbour's walls). Raiders only come from the three land sides (`RAID_SIDES`), so the trap belt and
  raiders' ground exist on those sides only. None of the rings can be built on. Saves with traps where
  the river now runs get them paid back in full on load. Fixed in the town: the 5×5
  keep on its plaza, the 3×3 mine, the campfire and parade ground. Every other building is
  **placed by the player**, once, on its footprint (`FOOTPRINTS`: houses 2×2, guardhouse and griffin
  eyrie 2×2, stables 4×3, the rest 3×3), anywhere it fits (`placementProblem`). `placements` in the
  store; `placeBuilding(id, spot)` places and starts level 1 (road tiles under it are taken up); later
  levels are built in place — **built buildings never move**. `destroyBuilding(id)` pulls down **any
  building but the keep** (DESTROY in its pop-up, tapped twice): its level goes to 0, its plot is freed
  (`placements` entry removed — fixed ones keep their spot to be rebuilt), any construction cancelled and
  **50% of everything spent on it** (`buildingSpent` / `destroyRefund`: gold + every resource for each
  level built or being built) comes back, resources capped by warehouse room. A forge's goods go back to
  the store; pulling down the depot calls every cart back (`undoWagonTrip`), the docks send every waiting
  barge away. `cancelConstruction(id)` stops a level being built (STOP BUILDING, tapped twice): all it cost
  comes back, the crew's work is lost, and a building that was never finished leaves its plot. A new game starts with houses, warehouse, foundry and guardhouse on `DEFAULT_SPOTS`.
- **Rocks** (`src/game/rocks.ts`): the town starts mostly under rocks — about 4 in 5 tiles outside the
  ground that starts clear (the plaza round the keep, the mine and its yard, the starting roads and the
  starting buildings' plots); stones / rocks / boulders (`startingRock(x, y)`, a hash of the tile).
  Buildings and roads can't go on rocks (`placementProblem(…, rockyTest(cleared))`, `roadProblem`), and
  walking over them is slow (×0.4). The save keeps only the tiles cleared (`clearedRocks`). Build →
  Clear rocks paints a stroke; `clearRocks(tiles)` adds an order (free) to `clearOrders`; a crew of 2
  peasants (`CLEAR_CREW`, counted with the builders) works through the first order, 1 s of work a tick
  (stones 1.5 s, rocks 3 s, boulders 5 s each); when it's done its rocks vanish together (one still-image
  rebuild per order) and their stone goes to the warehouse as granite (1 / 2 / 3). Ordered rocks are
  outlined on the map and the crew hammers at the first one. Older saves get the rocks too, with the
  ground under every building, building site and road counted as cleared.
- **Roads** (`src/game/roads.ts`): the player lays tiles of road on open town ground (not under a
  building): dirt (2 gold, walking ×1.5), stone (6 gold, ×2), granite (4 gold + 2 granite, ×2.5); bare
  ground is ×1. `roads` in the store (tile key → kind), `layRoads(kind | 'erase', tiles)` lays a stroke
  in order while it can be paid for (taking up is free, no refund). A new game (and older saves) start
  with dirt on `STARTING_ROAD_RUNS` (the old fixed roads); the road out of the gate (`GATE_ROAD`) stays
  fixed. **Walking**: `walkBetween(from, to, placements, roads)` = Dijkstra over town tiles and the land
  outside the walls, reached through the gateway and over the gate road (4 directions; every building
  footprint, the keep and the mine block; water and the wall don't), cost per tile 1/speed; cached per
  (placements, roads) object. Effects: hauling — `haulFactor(walk mine → warehouse)` = 6 s / walk time,
  clamped 0.5–3 (no way through: 0.5), multiplies `surfaceHaul` (default layout: 6 s → ×1.0);
  construction — `buildFactor(walk warehouse → site)` = 1 + (12 − time)/40, clamped 0.7–1.3, multiplies
  each job's progress. Peasant walkers follow the same paths with per-tile timing (`times`), so they
  speed up on roads. Saves: version 1 (the
  old 32-tile map) migrate by moving every building 7 tiles in (`OLD_MAP_SHIFT`); version 2 (the 47-tile
  map) by `grownMap`: buildings, roads, cleared rocks and clearing orders move 6 tiles in
  (`GROWN_MAP_SHIFT`), traps keep their distance from their own edge (`grownCoordinate`), and a road that
  ran (nearly) down to the gate is carried on to it. Rocks are hashed from where a tile lay on the 47-tile
  map, so they didn't move either. Any spot that no longer fits is dropped and re-placed
  (`validPlacements` + `fillPlacements`).
- **Traps** (`src/game/traps.ts`): 1-tile traps laid anywhere in the trap belt except the gate road
  (`trapProblem`); `traps` in the store, `layTrap(kind, spot)` pays at once, `removeTrap(spot)` refunds
  half the gold. Spike pit (30 gold, 10 coal): 15 damage to one random raider company on foot. Pitch
  ditch (45 gold, 20 coal): 5 damage to every company on foot. Snare (50 gold, 3 copper): one company on
  foot loses its first turn (`Stack.snared`, skipped in `beginTurn`). Damage × `trapPower` (research:
  +10%/level). Each raid comes from one **side** of the map (`raidSide(n)`: raid 1 from the south-west
  gate side, then hashed over the three land sides, `RAID_SIDES`; sides are compass names for the
  screen's corners, `MAP_SIDES`), and only the
  traps on that side's stretch of the belt fire (`trapsFacing`; corner tiles face two sides). They
  fire in `createBattle` before round 1 (`springTraps`: pitch, then spikes, then snares; fliers pass
  over), logged as `trap` events; kills are `battle.trapKills` → `RaidReport.trapKills`. Traps stay
  after a raid. The sighting notice and the raid banner name the side and its trap count.
- **Tech tree** (`src/game/techs.ts`): 66 upgrades bought once with **gold only**, separate from building
  levels — a branch per building (3 tiers: I, II, III) and a 6-tech branch for the mine (2 per tier).
  A tech needs the one before it (`requires`, sometimes a tech from another branch too, e.g. Steam drills
  needs the foundry's Tempered steel) and its building at level 1 / 3 / 6 (`TIER_LEVEL`; the mine:
  1 / 2 / 4 galleries, `TIER_DEPTH`). `techs` in the store, `buyTech(id)`, `techBlocker` / `techNeeds`;
  the Library cuts every tech's price 10% (`techCost`). Effects are summed by `techBonuses(techs)` and
  applied in `buildingStats(levels, staff, techs)` (mining rate, cart load, capacities, hauling, dig
  speed/cost, taxes, build sites and crew speed, beds and newcomer rate, trade, armory bonuses, wall/gate
  HP, tower damage and double shots, boiling oil, trap power, per-unit growth and battle bonuses), plus
  `getDepthCost` / `cartCost` discounts; Bigger bins adds +50 to the stored `veinCapacity` when bought.
  In battle: `unitBonus` (attack/defence/shots per unit of the hold), `towerShots`, `wallOil` (damage
  every round to raider companies beside a standing wall section, `oil` events). Shown in the Tech pop-up
  (`TechTree`), at the bottom of every building's pop-up and on the mine screen (`TechBranchView`).
- **Buildings** (`src/game/buildings.ts`): 20 buildings, each level 0 (empty plot) to 20. Economy: Central
  Keep, Workers' Houses, Warehouses, Foundry, Research Facility, Docks (fixed, outside the walls, starts at
  1). Defence: Armory, Wall, Towers, Gate, Moat (fixed ring, needs the keep at level 10 —
  `MOAT_KEEP_LEVEL` — and no staff, like the wall; tapped on its front stretch west of the gate). One
  dwelling per unit: Guardhouse, Archery Range, Barracks, Monastery, Balloon Works, Stables, Griffin Eyrie,
  Paladin Chapel, Celestial Sanctum. Start: keep/houses/warehouse/foundry/guardhouse at 1, the rest 0.
  Effects come from `buildingStats(levels, staff?)` (staff omitted = fully staffed, for previews): keep =
  level cap for everything else, building sites at once `1 + ⌊L/5⌋`, taxes L gold per 5 s; houses = beds
  `8 + 4L + ⌊L²/2⌋` for peasants (the 8 is the keep's hall, there even with no housekeepers);
  warehouses = capacity `100·1.3^(L−1)` per resource + mine stockpiles; foundry = miner rate and cart load;
  research = dig speed/cost and trap damage; stables = haulers' carts (and cavalry); gate = gate HP;
  moat = `10 + 6L` damage a round to raider companies wading in it (battle, below);
  docks = the barges (one comes every `120 − 4(L−1)` s, at least `MIN_BARGE_INTERVAL` 40; orders worth
  about `150 + 50(L−1)` gold; +3%/level prices — all from the worked level, so no dockhands = no barges); wall = HP of each wall section; towers = `2 + ⌊L/5⌋` towers, `5 + 3L` damage per shot per round;
  armory = +⌈L/2⌉ attack / +⌊L/2⌋ defence for every unit (its pop-up shows the forges and the gear store);
  forges = gear-making speed `1 + 0.15(L−1)` (see Gear); Cart Depot (3×2) = carts `1 + L` (+ techs), each
  carrying 10 at ×1.5 walking speed (see Carts). Dwellings of strong units need a keep level
  before their first level (`requiredKeep`). Costs (`buildingCost`): treasury gold ×1.3 per level plus
  warehouse resources (coal from L1, granite 3, copper 5, iron 7, gold ore 11, diamonds 15). A cost bigger
  than warehouse capacity blocks the upgrade. Build time `6 + 2·L^1.6` s; `construction` jobs tick per second.
- **Army** (`src/game/units.ts`): pikeman, bowman, swordsman, monk, balloon, cavalry, griffin, paladin,
  angel (tiers 1–9), stats after Heroes III (attack, defence, damage range, HP, speed, shots) plus abilities:
  pikemen +50% vs riders; crossbowmen/monks/balloons shoot; monks heal an ally (10 HP each, can bring back
  fallen members up to the stack's starting size); balloons fly and are immune to melee (never pinned);
  cavalry +5% damage per hex charged; griffins fly and retaliate twice; paladins give every ally +2/+2;
  angels fly and resurrect once per battle (100 HP each, even a destroyed stack). Recruits accumulate at
  each built dwelling (`unitGrowth`, per 2-minute muster, up to 3 musters), need the unit's keep level,
  and cost gold (`ARMY_RECRUITING`) plus **one piece of the unit's gear** each (`UNIT_GEAR`) — no raw
  resources — taken from the gear kept **at the dwelling** (`dwellingGear`, brought by carts; see Carts).
  Start: 12 pikemen and 10 pikes at the guardhouse. `army`, `recruits`, `recruit()`.
  The bowmen are **crossbowmen** now (id still `bowman`).
- **Gear** (`src/game/items.ts`): raw resources → parts → gear, each tier's gear harder to make. Parts:
  steel bar (2 iron, coal), bronze (copper, tin), silver filigree (2 silver, gold), gunpowder (2 sulfur,
  coal), bomb (gunpowder, iron), burner (bronze, 2 coal), salted tack (2 salt, copper), gem lure (silver
  filigree, emerald), mithril bar (2 mithril, 2 coal). Gear: pike (2 iron) → crossbow (iron, 2 copper) →
  sword and shield (steel, bronze) → blessed staff (filigree, steel, granite) → balloon rig (burner, 2
  bombs) → lance and barding (pike, tack, 2 steel) → griffin harness (gem lure, tack, steel) → mithril plate
  (2 mithril bars, a sword, filigree) → celestial relic (mithril plate, gem lure, gunpowder, tack, diamond,
  2 granite — every resource in its tree). `items` in the store is the gear store.
- **Forges** (`src/game/forges.ts`): **every step is made at a forge of its own**. Up to 8 forges
  (`FORGE_IDS` = `forge1`…`forge8`, Forge I…VIII) are ordinary buildings (2×2, placed by the player, built
  with crews, staffed 1 + ⌊L/5⌋, techs on one shared `forges` branch: Bellows / Master smiths / Water hammers
  = +20/30/50% speed), each needing a keep level (`FORGE_KEEP`: 1, 1, 2, 3, 5, 7, 9, 12); lists show only the
  next forge to build (`isShownBuilding`). `forgeTasks` maps a forge to its task (`ForgeTask`: item, target
  = how many to count as made — 5/10/25/50 —, its **shelf** `stock` (materials brought by carts), its
  **rack** `output` (finished pieces waiting for a cart, at most `FORGE_OUTPUT_CAP` 5) and the piece on the
  anvil: `loaded`, `done` seconds). A forge works only from its shelf: each tick, if it has no piece, its
  rack has room and the item counted (`itemsCounted`: store + racks + on carts to the store) is below its
  target, it takes one piece's materials off the shelf (`shelfMissing` empty), works at its `forgeSpeed`
  (worked level, 0 without smiths) and puts the piece on its rack. So a sword needs one forge on steel
  bars, one on bronze and one on swords (or one forge set to each in turn). `setForgeTask(forge, item |
  null)` and destroying a forge send its shelf, its anvil's materials and its rack back to the store
  (`returnForgeGoods`); `setForgeTarget`. `forgeStatus` (unbuilt / idle / unstaffed / working / full /
  rackFull / waiting — for a cart, for goods in the store, or for a depot), `forgesMaking`, `freeForge`
  for the UI: a forge's pop-up (`ForgePanel`: status and progress, shelf and rack, keep-in-store target,
  the task list with recipes and which forges make what), `GearStore` (carts out, every forge's task and
  status and everything in the store — also on the armory's pop-up), and each dwelling's recruit card
  (gear in store, which forges make it, "set a free forge to it"). Saves from when the armory made
  everything get the unmade part of its old orders paid back.
- **Carts** (`src/game/wagons.ts`, "wagons" in the code so they aren't the mine's carts; a trip's `site` is
  the forge or dwelling it serves): the **Cart
  Depot** (`depot`, staffed by carters, `requiredKeep` 1, techs Greased axles / Bigger wagons / Draft horses
  = +25% speed, +6 load, +50% speed and 2 more carts) has `wagons` carts (`1 + worked level` + techs), each
  carrying `wagonLoad` (10) at `wagonSpeed` (×1.5 walking). `wagonJobs` are the carts out on trips
  (`WagonJob`: kind, forge, the forge's item when sent, load, `startedAt`, three `legs` in seconds,
  `dropped`); the rest wait at the depot. Trips are round trips along the roads: **supply** depot →
  warehouse → forge → depot (materials leave the warehouse when the cart is sent and land on the forge's
  shelf when it arrives — back to the warehouse if the forge has changed task or gone), **collect** depot
  → forge → warehouse → depot (the pieces leave the rack when sent and reach the store on arrival), and
  **deliver** depot → warehouse → dwelling → depot (gear from the store to the unit's dwelling, for its
  recruits: each dwelling keeps `gearWanted(waiting)` = the recruits waiting, at least
  `DWELLING_GEAR_MIN` 5 and at most `DWELLING_GEAR_CAP` 20, counting gear there and on the way). Legs
  are `walkBetween` times between the buildings' plots divided by cart speed (`wagonLegs`; no way through
  = no trip), so roads, rocks and where the depot, warehouse and forges stand all matter. Each tick, after
  deliveries, free carts are sent in rounds: full racks, then forges with nothing on their shelf and
  nothing coming, then dwellings with more recruits waiting than gear there or coming, then any rack with
  pieces, then any shelf below `FORGE_BUFFER` (3) pieces' worth
  (`supplyLoad`: what's missing for 3 pieces counting what's coming, only what the store has, whole
  enough to fit the cart, and only if at least one piece is possible), then dwellings below what they keep.
  A forge's target counts everything made: store, racks, carts and the dwellings (`itemsCounted`).
  Pulling a dwelling down sends its gear back to the store. Saves from before carts delivered gear have
  each unit's gear in the store moved to its dwelling (if built). The map draws each cart on its route (`Wagons` / `WagonSprite`: the same walks
  stretched to the legs, the load's colour on the middle leg) and the depot as an open shed with parked
  carts; the depot's pop-up (`DepotPanel`) lists every cart's trip (`wagonText`) with RECALL
  (`recallWagon`: undelivered materials go back to the warehouse, undelivered pieces back onto their
  forge's rack — or into the store if the forge has moved on).
- **Two kinds of battle** (`BattleKind`, `raidKind(n)`): each raid is announced as a **raiding party in the
  fields** or a **siege army** (raids 1–2 are raiding parties, then about half each, hashed by number).
  A field battle is troops only — `createBattle({ kind: 'field' })` leaves out the walls, gate, towers,
  oil, moat and traps — and a raiding party is sized to the army's value alone and brings no wall-breakers
  (no ogres or cyclopes, `SIEGE_ONLY`). A siege is the battle at the walls as before, sized to army +
  defences. Against a siege army the hold can **ride out** to meet it in the field instead
  (`setRideOut`, RIDE OUT / HOLD THE WALLS on the raid banner; `raidBattleKind`). Stakes in the field:
  beaten, the raiders only reach the outskirts and take half as much (`FIELD_PLUNDER_SHARE` 15%); won,
  the bounty is half again (`FIELD_BOUNTY` ×1.5). The battle board shows open grass in the field.
  **Auto-resolver**: `autoResolveRaids` (switch on the raid banner and in the War sheet) fights each raid out the
  moment it arrives (`resolveBattle`, settled at once, the result left on the battlefield); otherwise the
  banner's AUTO-RESOLVE button settles a battle waiting for orders (`quickResolveBattle`), and an
  uncommanded battle still fights itself after `RAID_AUTO_AFTER` (30 s). Reports say which kind it was.
- **Raids** (`src/game/raids.ts`): first raiders arrive at 6:00, then 5 min after each raid ends; sighted
  60 s ahead. **Raids are sized to the hold**: at sighting, `holdPowerOf(state)` = army value +
  defences at half their worth (`holdPower`: towers × damage × shots × 5 rounds × 11 value/HP, wall HP
  × 8 + gate HP, the traps on an average side × 11) — shown as HOLD POWER in the defence summary and in
  the raid banner. Raid n's strength = max(`raidFloor(n)` = 150 + 10(n−1), at most 400;
  `raidShare(n)` × power, 50% + 1% per raid up to 90% — never more than the hold can field) ×
  `raidRelief(raidsLostInARow)` (a quarter less for each raid lost in a row, down to 40%; a win or a
  withdrawal resets the streak) (`raidStrength`). (Until 2026-10-08 the floor rose to 1,000 and the share
  to 120%, so a hold that fell behind lost every raid; an auto-fought hold with no defences now wins about
  29 in 30.) A raid sighted under harsher rules is re-sized on load. Split by `raidParty(n,
  strength)` into 2–7 stacks of goblins, wolf riders, orc archers, harpies, ogres (2× wall damage),
  cyclopes (shoot walls), behemoths (ignore 40% defence), stronger types joining with n. Each comes from
  one side of the map and crosses that side's traps first (see Traps). At arrival a `battle` starts;
  open the battle screen to command it, otherwise it quick-resolves after 30 s. Win: bounty 30% of the
  raiders' strength (`raiderStrength(battle)`) in gold. Lose: 30% of gold and of every warehouse
  resource is plundered. Survivors (and healed/resurrected) rejoin the army; the dead are lost. Saves
  with a raid sighted under the old exponential rules (> 1.5× the new strength) get it re-sized on load.
- **Combat** (`src/game/combat.ts`, pure + deterministic): 13×9 hex field (odd rows shifted). Raiders
  deploy left, the army right (shooters behind). Wall in column 9 with the gate in row 4: walkers must
  break a section/the gate (the AI aims for the weakest point); the army can pass its own gate; raiders'
  arrows over a standing wall do half damage. Each round towers shoot the most valuable raiders, then
  stacks act by speed (ties: defenders first). Damage = rolled base × (1 + 5%/point attack over defence,
  max +300%; or −2.5%/point under, min 30%), half for long range (>7) and for shooters in melee. One
  retaliation per round (griffins 2). Defend = +30% defence till next turn. 30 rounds → raiders withdraw.
  With the moat built, column 8 (`MOAT_COL`, in front of the wall) is water except the bridge at the gate
  row (`inMoat`): raiders on foot who wade in stop there (`reachable`) and take `battle.moat` damage at the
  start of every round they stand in it (`moat` events); the AI prefers the dry bridge. The Drawbridge
  tech raises the bridge (`moatAtGate`). The moat counts in the hold's power.
  `act(battle, action)` returns a new battle; `chooseAction` is the AI; `resolveBattle` = quick combat.
- **Economy**: carts and digging cost warehouse **coal** + gold; buildings also cost ores. Trade is with
  **river barges** (`src/game/ship.ts`): up to `MAX_BARGES` (5) wait at the docks at once, each at a
  berth (`BERTHS`: three nose-in at the harbour's quay, two on the river by its mouth) with an order —
  so many units of one resource at a price 10–50% over `RESOURCE_PRICE` × (1 + trade bonus) (coal 1,
  granite 1, copper 3, iron 4, gold 12, diamond 30, tin 3, silver 8, sulfur 5, salt 4, emeralds 20,
  mithril 40). `bargeOrder` draws it (seeded by `bargeSerial`):
  mostly goods the warehouse has, less often one another barge already wants, about the docks' hold in
  gold. A barge waits as long as it takes: the Docks sheet (`BargesPanel`; toolbar or tap the docks)
  sells it 10 or as much as it still wants (`sellToBarge`; needs dockhands, `bargeBlocker` says why
  not), and once its order is filled it sails off (`leftAt`) and its berth frees up `BARGE_SAIL` (20) s
  later; any waiting barge can also be sent away empty (`sendBargeAway` — one still sailing in turns back
  from where it is, `turnBack` setting `leftAt` so its pose doesn't jump). The tick sends the next barge up
  the river every docks interval (`nextBargeAt`, `docksOf`) while a berth is free and the docks are
  staffed. Saved: `barges` (waiting ones only), `nextBargeAt`, `bargeSerial`. The renderer (`Barges`)
  sails each in from downriver (east) along the river to its berth and back out (`bargePose`, a worklet,
  on `bargeRoute(berth)`), with a pennant in the colour of the goods it wants.

## Code map

```
src/
  app/                     routes (Expo Router)
    _layout.tsx            gesture root, safe area, loads the save, starts the simulation, flushes saves
    index.tsx              stronghold screen
    mine.tsx               mine screen (layout + live state → MineScene, panels)
  game/                    simulation + pure model (no React Native / Skia)
    gameStore.ts           Zustand store: the starting state, the actions, persistence, loadGame,
                           startSimulation
    state.ts               the state's types (GameState, Raid, RaidReport, …) and `raidBattleKind`
    tick.ts                `tickGame(state)`: one second of the game (the store's `tick`)
    hold.ts                pure reads of the state: workforce, walks, mine layout, hold power, forge and
                           cart status, what can be recruited
    costs.ts               costs and blockers (the reason a build, tech, trap, barge or dig can't happen)
    updates.ts             state changes shared by actions and the tick (settling a battle, returning
                           goods, starting a building, moving stock)
    saveMigration.ts       `migrateSave` / `mergeSave`: older saves moved onto the current map and laid
                           over a fresh game
    mineLayout.ts          the tile model: dug tiles & kinds, deposits/clusters, sites, dig rules,
                           deposit info, auto-dig route finder
    haulage.ts             cart routes (BFS to lift), trip schedule, cart pose (worklet), events
    resources.ts           RESOURCES list, Stock type, names/colours, market prices
    workforce.ts           peasant pool: allocation of miners/pushers/crews/staff/idle, arrival rate
    cityMap.ts             the stronghold's tile map: rings (raiders, traps, moat, wall), map sides,
                           footprints, fixed ground, placement checks, save-migration helpers
    traps.ts               trap kinds, costs, damage, belt placement checks, traps facing a side
    save.ts                batched localStorage storage for the persisted store, flushSave()
    buildings.ts           stronghold buildings: ids, start levels, stats per level, costs, build time
    units.ts               army + raider stats/abilities, dwellings, recruit gold and growth
    items.ts               gear and parts: recipes, each unit's gear
    forges.ts              the forges: ids, keep levels, tasks with shelf and rack, loads, speeds
    wagons.ts              the depot's carts: trips, what to bring a forge, goods on the move
    combat.ts              hex battle engine: setup, turns, damage, walls/towers, AI, quick resolve
    raids.ts               raid timing, strength, composition, side, bounty/plunder constants
    techs.ts               the tech tree: 66 gold upgrades in branches (mine + every building), bonuses
    ship.ts                river barges: berths, orders (`bargeOrder`), course and pose (`bargePose`)
    rocks.ts               the rocks the town starts under: where they lie, sizes, clearing work and yield
    roads.ts               road kinds/costs/speeds, road placement checks, walking paths (Dijkstra),
                           haul and construction speed factors
  components/
    MineMapLayout.ts       grid constants (tile size, columns, levels, 12 stations a gallery, exit bins)
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
    BargesPanel.tsx        the barges waiting at the docks: one card per order (sell 10, fill, send away)
    CombatPanel.tsx        the War sheet behind the ⚔️ side button: raid now, auto-resolve, army and
                           recruiting, defences and traps, stakes (`hireableNow` for the button's badge)
    ForgePanel.tsx         a forge's pop-up (status, shelf, target, task list), GearStore (carts, forges,
                           the store) and DepotPanel (every cart's trip)
    GameScene*.tsx         the castle map (Skia, isometric, styled after Firefly's Stronghold): iso
                           boxes/roofs painted back to front; every building in 4 looks by tier, its
                           material's `kind` dressing walls and roofs (`faceDressing`, `roofRows`):
                           plank huts under thatch, half-timbered plaster under red tiles, stone and
                           dressed stone under slate; boxes and roofs outlined. Fortifications go
                           from timber straight to stone (`fortMat`): a timber keep (tower with an
                           overhanging fighting platform), then a square stone keep with turrets,
                           then a fortress keep with round corner towers (`Cylinder`) and a central
                           tower; a palisade, then a continuous crenellated stone curtain wall
                           (`WallSegment`, battlements on both faces by `wallRuns`); round stone
                           towers with an archer; a gatehouse of two round towers and a portcullis;
                           a low wattle fence marks the wall's line until it's built (no defence).
                           The ground has no grid (the placement ghost shows it only while placing or
                           painting): grass in broad lighter/darker patches from value noise with
                           tufts and flowers, bare earth in the trap belt, a ragged dirt yard round
                           the keep (`buildGrass`), and soft blurred shadows from every building,
                           wall, tower and tree. Army on parade. Round it a backdrop drawn live (a few paths):
                           sky, three mountain ranges behind the far sides and two (further out,
                           never over the map) in front of the near sides, the river running on
                           through gaps in them, the gate road through a pass, and woods carrying on
                           the raiders' woods, with boulders (`WOODS`). The mountains, those boulders
                           and the rocks on the map are all the same two-tone crag (`crag`) in one
                           stone (`STONE_LIGHT`/`STONE_DARK`; the ranges hazier with distance). The back part is drawn under the castle image,
                           the front part (woods and ranges in front of the near sides) over it. The
                           map and the backdrop share the land colours (`LAND`, `LAWN`, `CROWNS`) and
                           the map has no outline, so the hold sits in its valley. It uses extra room
                           above and below the map (`SKY_ROOM`, `FOOT_ROOM`); the castle image covers
                           only the map part (`STILL_TOP`, `STILL_HEIGHT`), so it didn't grow. Two layers for speed: everything still is
                           rendered offscreen into ONE image (`useStillImage`, keyed on building levels,
                           placements, traps, parade sizes, building sites and raiders
                           (traps are drawn flat on the ground there) — rebuilding costs ~100 ms,
                           so keep fast-changing things out of the key); the live layer on top has the
                           warehouse piles, progress bars, selection, a few animated bits (smoke,
                           balloons, flame, mine wheel, the river barges) and every peasant as one `Atlas` moved by a
                           single `useRSXformBuffer` worklet (haulers, staff errands, crews, idlers).
                           One frame-callback clock at ≤30 fps, paused when the screen isn't focused.
                           `GameSceneCanvas.tsx` puts the scene together (the still image's contents,
                           the live layer); its parts are in `stronghold/`: `shapes` (materials, iso
                           boxes/roofs/towers/flags, shared colours), `backdrop`, `ground` (grass, rocks,
                           roads, traps, trees, raiders), `fortifications` (wall, towers, gatehouse),
                           `buildingArt` (every building, campfire, headframe, scaffolds, parade),
                           `live` (piles, smoke, balloons, wheel, carts, barges, progress bars),
                           `peasants` (the sprite atlas), `overlays` (plots, selection, placement
                           ghost) and `stillImage` (`useStillImage`, `pictureToImage`).
    GameSceneLayout.ts     drawing the tile map: `iso()` / `groundAt()` projection, `plotOf()` (plots from
                           placements), doors and peasant routes, silhouettes and the depth-ordered
                           tap list (the wall is tapped at the front end of its left run);
                           ORIGIN_X / ORIGIN_Y for worklets
    buildingIcons.ts       an emoji icon per building and per trap (build palette, trap bar)
    TechTree.tsx           the tech tree (all branches) and one branch with its tiers, details, Research
    BattleBoard(.web).tsx, BattleBoardCanvas.tsx   battlefield (Skia): hexes, wall/gate, towers, sprites
    battleLayout.ts        hex geometry for the board, taps and labels (Skia-free)
    skiaPaths.ts           who owns a Skia path: parse once, held by a component, or freed with a drawing
    unitSprites.ts         12×12 pixel sprites for all 16 creatures (also the army on parade)
    RaidBanner.tsx         raid status banner on both main screens
    CityView.tsx           the stronghold's full-screen map: camera (shared values), gestures, wheel,
                           +/− buttons, tap hit-testing on building silhouettes (else `onTapGround`, for
                           traps), dragging the building being placed (judged by the press point,
                           `onBegin`), paint strokes for roads/traps, right/middle-drag pan, level badges
    Sheet.tsx              pop-up panel (slides up, scrolls, closes on ✕ or backdrop)
    BuildingsPanel.tsx     pop-up pieces: `BuildingDetail` (effects now → next, cost, Upgrade, staff +
                           Stop, unit card + Recruit, the building's tech branch), `BuildingGrid` (all
                           buildings), `DefenceSummary`
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
- **Stronghold screen speed**: it re-renders once per tick; `CityView` is memoized (its props only
  change with building levels / selection), heavy rows are memoized components with primitive props
  (`BuildingChip`, `StockRow`, `BargeCard`) and `upgradeBlocker` takes a shared `workforce`. Measured on a built-up game (dev build): 65–100 ms per frame and ~45 ms per tick
  before → no frames over 50 ms and ~10 ms per tick after.
- **Never give a live canvas's `<Path>` an SVG string** (`src/components/skiaPaths.ts`). On web nothing
  in Skia is garbage-collected, and a `<Path path="…">` has its string parsed into a new path every time
  the canvas draws — on a canvas with anything animated, every frame — and never freed. That filled
  CanvasKit's memory within an hour or two ("memory access out of bounds" in `PictureRecorder`, then
  "Cannot read properties of null (reading 'getCanvas')" thousands of times, and a dead screen).
  Every path now has an owner: module-level geometry is parsed once (`parseSvg`: the backdrop, barges,
  ground, grid, belt); a component's changing shapes are held by `useSvgPaths` (freed 5 s after it stops
  drawing them: piles, selection, placement ghost, clearing marks, the battle board); the still castle
  image's components use `svgPath`, collected per drawing and freed once its image is made
  (`collectPaths`, which also runs those drawings one at a time and skips outdated ones). `svgPath`
  warns in development if used outside a drawing. To check: count `CanvasKit.Path.MakeFromSVGString`
  calls over a few seconds on an idle screen — it should be 0.
- **React Native Skia 2.6.2 leaks every frame on web — patched** (`patches/@shopify+react-native-skia+2.6.2.patch`,
  applied by `patch-package`). Its web renderer made, for every frame of every animated canvas, a paint copy
  per draw command, a new pool paint, a Picture and any shaders, and freed none of them (`JsiSkPaint.assign`
  /`reset` also dropped the paint they replaced): ~6,400 CanvasKit objects a second on the stronghold, so
  CanvasKit ran out of memory after an hour or two (`Aborted()`, then "memory access out of bounds"). The patch
  backports the fix from Skia 2.14 (frame-scoped objects deleted once each frame is recorded, the previous
  picture and old recordings freed, offscreen drawings freed on unmount). Expo SDK 57 pins 2.6.2; drop the
  patch when an SDK ships a fixed Skia. To check: count CanvasKit objects made vs deleted (wrap the classes'
  `delete` and factories) — every type should balance within a few seconds.
- **Freeing Skia images** (the castle's still image, the mine's terrain blocks): never `dispose()` an
  image the canvas might still draw. A canvas keeps replaying its last drawing for animations, and on
  web a screen in the background is not really frozen — React keeps committing while its canvas keeps
  replaying the old drawing. So images are freed only after a commit made **while the screen is
  focused** (`useIsFocused`) plus a short delay: `useStillImage` (also skips rebuilding while hidden)
  and the mine's `terrainViewCommitted`. Breaking this shows up as "Cannot pass deleted object as a
  pointer of type Image const*".
- **Offscreen images on web — never `drawAsImageFromPicture`**: on web it makes a new WebGL context
  (an OffscreenCanvas) for every image and never frees it; browsers keep ~16 per page and then drop the
  oldest — the map's canvas — so the stronghold went black after enough castle redraws. The castle image
  is drawn with `pictureToImage` (`stronghold/stillImage.tsx`): a CPU raster surface on web (no context; ~30
  ms for the whole castle), an offscreen GPU surface on iOS/Android, both disposed straight away. As a
  safety net, `CityView` remounts the scene if its canvas ever fires `webglcontextlost`.
- **Castle redraw cost**: the still image is rebuilt from a fresh React tree each time, so anything
  computed inside it is redone too. Big static paths are parsed into Skia paths once (`buildGround`),
  rocks and roads keep one parsed set for their current state (`latest` in `skiaPaths.ts`, freeing the replaced set a few
  seconds later). A rebuild is ~35–45 ms recording + ~30 ms rasterising on web (was ~95 + leaks).
- **Web quirks**: Skia's web `<Canvas style>` must be a plain object (not an array). Modules imported
  by non-lazy web code must not touch Skia at module load (hence `MineHaulerSteps.ts`). Avoid
  `__destroyWebGLContextAfterRender` (broke hidden screens).

## Running, checking, testing

- Node is only available via **nvm** (v24). In a non-interactive shell: `source ~/.nvm/nvm.sh` first.
- Checks (run before calling anything done): `npx tsc --noEmit` · `npx expo lint` · `npx expo-doctor`.
- **Tests**: `npm test` (jest with the `jest-expo` preset) runs `__tests__/*-test.ts` — never put tests in
  `src/app/` (every file there is a route). `support.ts` has helpers: `newGame(overrides)` resets the store
  (no raid comes unless a test asks), `run(seconds)` ticks it, `build(levels)` places buildings like the
  player would. `raids-test` (sizing, kinds, siege-only units), `combat-test` (siege vs field, determinism),
  `items-test` (gear per unit, the relic's resources, mine depths), `store-test` (forge chain by cart, task
  changes, gear deliveries, auto-resolve / orders / riding out) and `save-test` (v2→v3 map growth, the old
  armory refund, the save guard) — the save tests load a fresh copy of the store over an in-memory
  `localStorage`, so they never touch a real save.
- Web dev server: `npx expo start --web --port 8081` (`.claude/launch.json` has an `expo-web` config).
  **Never set `CI=1`** — Metro then stops watching files and serves stale lazy chunks.
- **Saving**: the store is wrapped in Zustand `persist` (key `mineforge-save`, `SAVE_VERSION` 3). Storage is
  `localStorage`: the browser's on web; on iOS/Android `import 'expo-sqlite/localStorage/install'` (first line
  of `_layout.tsx`) provides a synchronous SQLite-backed one. `_layout.tsx` calls `loadGame()` at module load
  (before any render), then starts the clock. Writes are batched (latest state ~3 s after a change) and
  flushed on app background / page hide (`flushSave`). Everything except actions is saved; `mergeSave`
  lays the save over a fresh game, merging records key by key (new buildings/units/resources get defaults;
  saves from before peasants get `population` = old miners + 8, construction jobs get a crew)
  and recomputing building-derived stats; an open battle gets 30 s to be commanded again. A damaged save
  starts a new game (a copy is kept as `mineforge-save-damaged`). **Nothing is written until the save has
  loaded** (`SaveStorage.markLoaded`, called from `onRehydrateStorage` when it succeeds): a game that failed
  to load the save — a bug in `mergeSave`/`migrateSave`, or in development a store re-created by a reload
  mid-edit — runs as a new game but never overwrites the save (it says so in the news). Before this guard a
  failed reload during development wrote a new game over the save. **Adding state**: give it a default in the store; bump `SAVE_VERSION` + add a
  `migrate` only if an old value would be wrong (not just missing). "Start a new game" (stronghold footer,
  two taps) calls `resetGame()`, which keeps `layoutVersion` counting up so layout caches can't go stale.
  Reloading the page now resumes the game; to test from scratch use the button or clear `localStorage`.
- Fast logic tests without the UI: compile the store to CommonJS and drive it from Node, e.g.
  ```bash
  OUT=/tmp/sim && npx tsc src/game/gameStore.ts --ignoreConfig --outDir $OUT --rootDir src \
    --module commonjs --target es2022 --skipLibCheck --moduleResolution bundler --esModuleInterop
  NODE_PATH=$PWD/node_modules node -e "const {useGameStore}=require('$OUT/game/gameStore.js'); \
    const s=useGameStore; s.setState({miners:3,gold:1000}); for(let i=0;i<60;i++) s.getState().tick(); \
    console.log(s.getState().warehouse)"
  ```
- To see late-game states in the browser, temporarily change the initial state in `gameStore.ts`
  (mark with `// TEMP-DEBUG` and remove before finishing). An existing save overrides the initial state,
  so start a new game (or clear `localStorage`) to see it. In Node tests there's no `localStorage`, so
  saving is off unless you provide one.
- Browser automation shares the pane with the user — unexpected clicks/pans may be the user playing.

## Status

- **Git**: work is committed on feature branches and merged to `main` (remote `origin`, GitHub
  `lacho2350/mineForgeFight`). `.claude/` (launch config) is untracked.
- Verified: typecheck, lint, expo-doctor and the jest suite pass; flows tested in the web preview and via Node sims.
  Pinch zoom and right-drag pan are untested (desktop automation can't do two-finger touch/right-drag).

## Known gaps / likely next steps

1. Offline progress: the game clock stops while the app is closed (could catch up on load).
2. City view: peasants are drawn on top of buildings (no per-frame depth sort) and walk straight lines
   between doors and the road; miners/pushers are only counted. One of each building (no second
   houses); built buildings can't be moved (destroy for 50% back and rebuild); the wall ring is fixed (no
   wall drawing). Raiders on
   the map are only a picture (traps fire as a step before the battle, and the battle is still fought
   at a gate whichever side they come from). Traps are never used up. Food / popularity (Stronghold's peasant arrival rules) don't exist yet.
3. Balance pass: building costs, recruit prices, tech prices, road speeds and the raid share/floor vs.
   mining output are first guesses. Techs are bought instantly (no research time or queue).
4. Battle polish: movement animation (stacks jump), Heroes-style "wait", morale/luck, hero commander,
   two-hex units; going out to attack raider camps.
5. The wall is tapped at the front end of its left run (or from the Buildings list).
6. No feedback text when a hand-drawn dig is released on an invalid tile (it just doesn't order).
7. Deep levels: one lift ride can take ~40 s each way; rebalance speeds if it feels slow.
