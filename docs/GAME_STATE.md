# Mine Forge Fight — current state (handover)

_Last updated 2026-10-16. Read this before changing anything; then read the files it points to._
_Releasing to Google Play, the App Store and PC: see [`RELEASE_PLAN.md`](RELEASE_PLAN.md)._

## What the game is

A mobile (Expo / React Native, also runs on web) mining-and-stronghold game inspired by
**Deep Corp** (KishMish Games): a side-view Wild West mine under a small surface stronghold.
Miners cut deposits, haulers push carts to the lift, coal and ores flow up to a warehouse, and the
stronghold spends gold, coal and ores on its buildings (21 kinds plus up to 8 forges, levels 1–20), raises a 9-unit army and
fights off raiders in Heroes III–style hex battles, or sells ore to the river barges waiting at the docks.

Two screens (Expo Router, `src/app/`):

| Route | File | What it shows |
|---|---|---|
| `/` | `src/app/index.tsx` | **Prologue first** on a new game (`Prologue`: six pages of the story — Aldmere lost to the Horde of the Red Hand, the flight north, the abandoned mining town of Greyhollow, what the mountain still holds, the Horde's scouts finding the valley, "the hold is yours" — with Next / Back / Skip and Android's Back turning back a page; `prologueSeen` in the store, `seePrologue()`; saves from before it count as seen, and the Menu's THE STORY SO FAR replays it). Stronghold, full screen: the isometric castle map (`CityView`: drag to pan, pinch / wheel / +− to zoom, tap a building), a slim bar on top (gold, peasants, raid clock — the warehouse's resources are in the warehouse's pop-up and the Menu, not on screen), a 👷 **auto-assign** button under the ⚔️ one (fills the buildings' empty spots from the campfire; badge = spots it would fill), a ⚔️ **War** button on the right edge under it (red with "!" while raiders are sighted or a battle waits; otherwise a badge with the recruits that can be hired now) opening the War sheet (`CombatPanel`: the raid now via `RaidBanner inPanel` — with ride out / hold the walls, command / watch, resolve now, the next raid's kind and strength —, the instant / fought-out battles switch, every unit with army / waiting / gear and RECRUIT ALL, the defences summary with traps per side, LAY TRAPS and links to the keep, wall, towers, gate, moat and armory, and the stakes), live raid alerts, a news toast, and a toolbar (Mine — the only way down; tapping the headframe opens **The Mine** pop-up instead (`MineInfo`, since 2026-10-22: what the mine is for, the headhouse's, cottage's and storehouse's status lines and numbers from `mineBuildingStatus.ts`, what waits at the mine, and GO DOWN THE MINE) —, Build, Buildings, Tech, Docks, Menu; Tech shows how many techs are ready to research, Docks shows how many barges are moored). Build opens a palette of unbuilt buildings, rock clearing, roads and traps; picking a building enters placement mode (the ground it may go on lit blue, yellow where rocks must be cleared first; drag the green/red footprint — a drag that starts on it moves it, any other drag pans — or tap where it should go, then Build here); picking Clear rocks, a road or a trap enters paint mode (one finger paints a stroke of tiles, laid on release; two fingers / right-drag pan; the bar switches kind; Done ends it). Tapping a building opens its pop-up (`Sheet` + `BuildingDetail`, with Destroy; the warehouse adds the haul-route table, the keep the defence summary); tapping a trap opens its sheet (effect, side, Take it up); tapping a road tile opens `RoadSheet` (its speed, CLEAR ROAD for that tile — free, no refund — or CLEAR MORE… for the eraser); tapping rocks or open ground inside the wall opens `GroundSheet`: rocks show their size, clearing time and granite with CLEAR ROCK (an order for the crew; shown as ordered after) and CLEAR MORE…, open ground offers LAY DIRT / STONE / GRANITE ROAD on that tile, LAY MORE ROAD…, and BUILD HERE… (the Build palette; the building picked starts centred on that tile). |
| `/mine` | `src/app/mine.tsx` | The mine, full screen: the map (pan/zoom camera) fills it, and everything else floats over it or pops up. Top: the mine's HUD (gold, wood, miners · free peasants, the raid clock) and, only while raiders are sighted or a battle is on, the raid banner; the zoom buttons sit under them. Bottom: a toolbar — 🏰 CITY first (the only way back up, besides Android's Back; since 2026-10-19, it was at the top), ⛏ DIG and 🔦 SURVEY (modes that switch each other off; Survey counts down while the surveyors are out), 👷 ASSIGN (everyone at the campfire to the free faces; badge = how many wait), 📜 UPGRADES (badge: mine techs ready) and CARTS (a drawn mining cart, `MineCartIcon`; badge: levels where a cart can be added now) — with the mode's hint and the news toast (`Toast`, new notices only) above it. A tapped tile (`DepositPanel`), stockpile bin (`BinPanel`: just that store's stock — an exit warehouse's heap, or the miners' bins of that resource — with its room and a FULL mark; since 2026-10-22, it was every stage of the haul) or surface building (`MineBuildingPanel`, since 2026-10-22: the headhouse — galleries open, carts and pushers, busy / quiet / held up by a full exit warehouse —, the mine storehouse — what the mine stockpile holds, its room and the haulers, held up when the city's warehouse is full —, and the mine captain's cottage — miners, pushers, idle at the campfire with ASSIGN, tunnel left to dig, the surveyors; text in `mineBuildingStatus.ts`, hit-tested by `surfaceBuildingAt` in MineMapLayout.ts) opens as a card above the toolbar; with a mouse, resting on a pile (a miner's bin or an exit bin) shows every resource the mine holds — in the miners' bins, at the exit, in the mine stockpile, and the total — with that pile's resource picked out (`MinePileTip`). UPGRADES opens a sheet with Dig Deeper and the mine's tech branch; CARTS a sheet with the haulage (Add Cart per level), the hauling chain and the warehouse's coal and gold. Android's Back leaves a mode, then closes the card, then goes up. The map scrolls clear of the bars (`insetTop` / `insetBottom` on `MineScene`). |
| `/campaign` | `src/app/campaign.tsx` | **The campaign map** (the end game, since 2026-10-17; `src/game/campaign.ts`): the road back south from Greyhollow to Aldmere, twelve battle sites on it — won ones gilded, the next one lit, the rest locked — on a parchment map drawn with plain views (no Skia, so it opens at once everywhere). A tapped site shows its story, the Horde's force there (`campaignParty`) against the army's worth, the bounty, and for the next site MARCH (`startCampaignBattle`, then `/battle`). Reached by the 🗺️ side button on the stronghold (shown once the campaign is open; badge: sites won, ★ after the victory), and described in the Menu. |
| `/battle` | `src/app/battle.tsx` | The battle — a siege at the walls or a battle in the field: hex board where every action plays out at the battlefield's pace (stacks walk their path hex by hex, lunge, shots fly, hits flash and their damage shows as they land — `battlePlayback.ts`), orders (taken once the action has played), auto-battle / quick resolve, log, result. Opening it takes command of the battle (also of one that starts while it's open); leaving mid-battle hands it to the captains (`releaseBattle`). |

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
  between them; tunnels only meet end-on: a dig may run head-on into another tunnel and join it there
  (the tile straight ahead may be dug, and diagonals beside it), but never into the side of the lift.
  The two columns beside the lift stay rock (tunnels may only cross them sideways). Every gallery's rail
  tunnel reaches two tiles past the lift on each side (`GALLERY_REACH`), so there's always a tile beyond
  that rock to dig down from — a shaft dug down from one main tunnel joins the gallery below, and you can
  carry on under the deepest one. Enforced by `checkDigStep` in `src/game/mineLayout.ts`.
- **Deposits**: ~30% of tiles, in clusters of 1–15 tiles (5×5 cells, each grows one cluster inside
  its top-left 4×4 so clusters never touch). Types: coal, granite, copper, iron, gold, diamond (gold
  and diamonds commoner with depth), and the six newer ores that raise the army (`NEW_ORES`), each from a
  depth down and commoner over the next rows: tin (row 8), silver (20), sulfur (35), salt (50),
  emeralds (75), mithril (105). A cluster first rolls (`newRoll`) for a newer ore reached at its depth;
  the rest are drawn as before, so the older ores lie where they always did. Each holds 1,000–5,000 units
  (precious ones less). Deterministic
  from tile position (hash), computed lazily and cached. Every gallery station's "ore column" tile is
  always a coal seam. Deposits **block digging**; a mined-out deposit becomes a hollow you can dig through.
- **Dark rock and surveys** (`src/game/survey.ts`): only rock within `FOG_REACH` (4) tiles of something
  dug (or of the surface) is known (`fogDistance` / `isRevealed` in mineLayout.ts); deeper rock is dark —
  `getDepositInfo` says `unknown` (the panel: "Unknown rock") and no miner can be sent there. **🔦 SURVEY**
  (beside DIG in the mine's toolbar; the two switch each other off) then a tap on a **tunnel** (any dug tile —
  a tap on rock is refused, and the mode stays on until the surveyors set out; while it's on, the patch a
  survey would map follows the mouse — or shows where a finger last tapped — shaded **green** where they
  can set out from, **red** where `surveyProblem` says they can't: `survey` prop → `SurveyPatch` in
  MineViewport.tsx) maps the rock `surveyRadius`
  (6, a 13 × 13 patch, so 3 tiles past what the tunnel shows) all round it: `surveys` in the state,
  `isSurveyed`; the deposits there show and can be dug to and assigned like any known ones. It costs
  `surveyCost` = 25 + ⌊(row − 2)/2⌋ gold and the surveyors are then out for `surveyCooldown` = 240 s
  (`surveyReadyAt`; the button counts down). A patch with no dark tiles left (`darkTiles`) is refused
  (free). The mine's survey techs: Survey lanterns (I, −30% time), Dowsing rods (II, +2 radius, −25% cost),
  Seismic charges (III, −40% time, +2 radius) — 240 → 168 → 72 s and 13 × 13 → 21 × 21. Surveyed rock is
  drawn half-shaded (`SURVEYED_ALPHA` in mineTerrain.ts).
- **Peasants do every job** (`src/game/workforce.ts`, Stronghold-style). `population` = all peasants
  (soldiers aren't counted). New ones arrive every 4 s while `population < beds` (the keep's hall `KEEP_BEDS`
  = 8, plus the cottages) and a kept cottage or the hall has room (`roomForNewcomer`, below).
  **Workers' cottages** (`src/game/houses.ts`): up to 24 (`HOUSE_IDS` `houses`…`houses24` — the first keeps
  the old `houses` id; six from the start, then four more with each keep level to the sixth, `HOUSE_KEEP`),
  each one tile, placed and levelled on its own, named Cottage I–XXIV, sleeping `houseBeds(L)` = 4 + ⌊(L−1)·5/19⌋
  (4 at level 1, 9 at 20); with the keep's 8 and the houses' techs the hold sleeps at most `MAX_PEASANTS` =
  200. They need **no staff**: each is kept by **its woman** (not a worker) — `src/game/homes.ts`:
  every built cottage has a `home` (`homes[id]`: water, food, her `errand`). She walks (`walkBetween`, the
  same way back) to the river — the riverside tile nearest her cottage, just inside the river wall
  (`waterSpot`) — for a load of water (`LOAD` 20), or to the store — the granary, else the warehouse
  (`foodStore`) — for a load of food (10, taken from the store as she sets off; only while it has a unit
  or more), whichever her home is shorter of, once it has room for a load (`PANTRY` 40 water, 20 food).
  Its sleepers drink `WATER_PER_PEASANT` (1/60 s) and eat `FOOD_PER_PEASANT` from it. **Happy homes**
  (`isHappy`): water and food in (`isKept`) **and a road at the door joined to the keep and the main gate**
  (`hasHomeRoad`, the same test as placing a building — but kept up all the time: a cottage whose road is
  taken up turns unhappy). **Who sleeps where** (`sleepers`): the happy cottages fill first, then the
  keep's hall (while the store has food; the hall eats straight from the store), then the unhappy ones.
  Anyone sleeping in an unhappy cottage (or in the hall with the store empty, `hungry`) counts as
  **sleeping badly** (`drySleepers`), which drags the hold's happiness down (below), and
  nobody new moves into an unhappy cottage. The HUD's peasants label says "N HOMES NO ROAD" (red) while
  any are cut off; the cottage's pop-up and the Menu say so too. New cottages start empty (their women
  set off at once); a new game's first starts full. The map draws each cottage (plaster then stone,
  chimney from tier 2) and each woman on her errand (`stronghold/housewives.tsx`: skirt and headscarf, a
  bucket or a basket on the way home, on the game clock); the HUD's food reads "N HOMES DRY"; a cottage's
  pop-up shows its sleepers, water, food and her errand (`HomeStatus`). Lists offer the next cottage only
  (`isShownBuilding`, like the forges); the houses' tech branch follows the biggest. Jobs, in
  order: miners (`sites` + `pendingSites`), cart pushers (one per cart on each worked level), building
  crews (`crewSize(level)` = 2 + ⌊L/5⌋ per construction job), then building staff in `STAFF_PRIORITY`
  order. **Every building but the keep, the wall, the towers, the moat and the cottages needs staff**
  (`UNSTAFFED`; `staffNeeded`: warehouse 2 + ⌊L/2⌋ haulers, gate 1 + ⌊L/10⌋, all others 1 + ⌊L/5⌋).
  **Nobody goes anywhere by themselves** (since 2026-10-13): newcomers, released miners and finished crews
  wait at the campfire (`idle`). A building has the staff the player gave it — `staffing` in the save,
  − / + in its pop-up (`assignStaff`), or **👷 AUTO-ASSIGN** on the stronghold's side (`autoAssignCity`:
  the campfire fills every empty spot, in `STAFF_PRIORITY` order; its badge = the spots it would fill);
  the mine's **👷 ASSIGN** (`autoAssignMine`) sends everyone at the campfire to the free faces in turn
  (`nextFreeSite`: a dug tile beside a deposit, coal first, then a gallery station; the first miner on a
  level brings a cart pusher). Miners and cart pushers come from the campfire only. Construction and
  clearing crews and recruits may still take a worker off a building when nobody waits (the lowest in
  `STAFF_PRIORITY` first) — the tick saves the staff each building actually has (`staffing: workforce.staff`),
  so it stays short until the player staffs it again, and whoever comes back waits at the campfire. A
  stopped building sends its staff to the campfire; restarting it takes whoever waits. A new building (or
  a level with room for more) stands empty until staffed — its completion notice says so. A new game
  starts staffed, and saves from before keep the staff they had (`fillStaffing`, in the merge; and when
  Fast Refresh adds `staffing` to a running game). (Until 2026-10-13 buildings filled themselves every
  second and idle peasants went mining by themselves — `idleToTheMine`, `autoMiners` — which sent a
  released miner straight back to the same face.) **One miner to a standing tile**: free
  deposit faces and free stations (`freeStationSites`) both skip a tile any miner already stands on (a
  station miner could once be put on a deposit miner's tile — the two drew as one, React logged duplicate
  keys every frame); the mine's sprites are keyed
  by tile and face. `workforceOf(state)`
  computes it; `freeHands` = staff + idle (what crews and recruits can take); `idle` = the campfire
  (what miners, cart pushers and the 👷 buttons take). A building short of staff works at `workedLevel` = level × staff/needed, with nobody at
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
  up when retraced, stops red at the first invalid tile (and quietly where it joins a tunnel). Why it
  stopped shows over the map while dragging, and after release the order's result (or why it was refused —
  gold, wood) stays there for a few seconds. Cost `3 + floor(row/10)` gold/tile, paid on
  release; time `2 + 0.04·row` s/tile, one tile at a time (`digPlan`, `digProgress`).
- **Hauling**: each level with miners has 1+ carts with red-shirted haulers (`carts[level]`, default 1,
  max one per miner; bought in the mine screen's Haulage section for coal + gold, ×1.6 per extra cart).
  A level's miners are shared out between its carts (miner i → cart i mod n); each cart visits its
  miners in turn: load beside the miner → path through dug tiles to the lift (BFS) → up the lift →
  pushed out to that resource's bin at the mine exit → tip → back down to the next miner. Coal only
  moves on load/tip events — the simulation and the renderer share one schedule (`haulage.ts`) driven
  by `haulTime`, so numbers change exactly when the cart is seen loading/tipping. A cart loads only what
  its resource's exit bin will have room for, counting the loads already on their way (so a bin never
  overflows); a miner whose ore has no room gets an empty trip, and the carts keep rolling for the rest —
  they stop only when nothing is on board and no bin with ore has room. (Until 2026-10-12 one full bin
  stopped every cart: a warehouse full of coal backed coal up to the exit and stalled the whole mine,
  granite and iron too — `haulage-test`.)
- **Wood** (`wood`, a resource kept in the warehouse but never mined — `MINE_RESOURCES` is the rest):
  the **Woodcutter's Hut** (2×2, staffed: 1 + ⌊L/5⌋ woodcutters) brings in `WOOD_PER_LEVEL` 0.25 wood/s per
  worked level (+30/50/70% with its techs: Sharp axes, Ox sledges, Sawpits) to the warehouse (only as much
  as it has room for), felled from **the forest** (`src/game/forest.ts`, `forest` + `forestSerial` in the
  store) **on the near mountains** in front of the hold — the range beyond the front-left side (where the
  gate road leaves through the pass) and on round the front corner to the front-right. A stand is a spot on
  a slope (`side:along:band`: a place along the range, and low / middle / high up it), about 100 wood
  (80–120); ~165 stand at the start. The woodcutters fell the stand nearest the end of the gate road, low
  slopes first (`fellingStand`, `fellWood`); every stand cut down grows back at a spot picked from the
  counter elsewhere on the mountains, so the forest keeps its size and never runs out. Drawn live by the
  backdrop (`ForestTrees`, between the near range — `Backdrop part="front"` — and the far front range —
  `part="frontFar"`): up to three trees per stand on the slope under the range's top edge there
  (`slopePoint`, from the peaks the backdrop recorded), fewer as it's cut. The woodcutters walk out of the
  gate, down the road into the pass and along the mountains' foot to the stand (`standWay`, `walkOn`), and
  home with logs. The hut's pop-up shows the forest (`ForestStatus`). Wood goes into gear (pikes, crossbows 2; sword and shield 1; blessed staves 2; balloon
  rigs 3 — the relic still needs every resource), into every building from level 2 (`WOOD_USE`: the keep
  more, the stone works less, the hut none, so a hold can always start), and 1 wood a tunnel tile
  (`TUNNEL_WOOD`, pit props: hand digging and the tunnels dug to assign a miner). Barges never order it. New
  games and older saves start with `STARTING_WOOD` 30.
- **Food** (`src/game/farms.ts`): fish, apples and mutton (`FOOD_RESOURCES`), kept in the `warehouse`
  record but capped by the **Granary** (`granaryCapacity`: the keep's larder 60 of each without one, +120 a
  level). Every peasant eats `FOOD_PER_PEASANT` (one food every two minutes): those in the keep's hall
  straight from the store, a little of each food in proportion to what's in, those in cottages from what
  their women bring (homes, above). With none left in store the hold is `hungry`: the hall sleeps dry, no
  cottage can be stocked with food, and happiness sinks (`FOOD_MOOD[0]`, −6 a minute) until everyone works
  slower (the farms are slowed like everything else, so a hungry hold should keep a granary stocked). Up to eight of each farm, built in order and unlocked with the keep
  (`FARM_SERIES`, `farmKeep`): **Apple orchards** (3×3, in town, 0.1 apples/s per worked level),
  **Fishing huts** (1×1, only right next to the river, along the river wall inside the town — the row
  y 7, x 7–51 but for the harbour's walls (x 26–32); safe from raids; none outside the walls; 0.12 fish/s per
  worked level; huts saved on other ground move to the nearest allowed spot on load (`validPlacements`);
  about a third of the riverside starts free of rocks; while placing, the
  allowed ground is lit (`buildSpots`, as for every building) and the camera brings an off-screen start into view) and
  **Sheep pastures** (3×3, grazing on the raiders' ground; the flock (`flocks`) grows by lambs to 10 sheep a
  level and gives 0.01 mutton and 0.006 wool a sheep a second; every raid from its side drives off a tenth
  of it, three tenths if the raiders win — `ravage` in updates.ts). Barges buy fish and wool (not apples or
  mutton), and **barges only order resources in the warehouse now** (at least 1, and `discovered` — had in a
  stockpile; with nothing they'd buy in store, no barge comes that time). New games and older saves start with `STARTING_APPLES` 150; **a new game also starts with a level-1 granary** (at 20,30, just above the main road, staffed) holding those apples and `STARTING_FISH` 60, so the larder has two kinds of food from the start. The top bar shows the food in store
  (red with HUNGRY); the warehouse's stockpile leaves food out and the granary shows its own when tapped; the
  sheep are drawn live and graze their way about the field (`Flocks`, stronghold/flocks.tsx: one atlas,
  each sheep ambling to a spot near its patch every 6–11 s, grazing there, turning to face its way).
  **Fishing huts' boats** (`src/game/boats.ts`): from level 5 a hut fishes from a boat on the river in
  front of it, a better one every five levels — Rowboat (5), Sailing skiff (10), Fishing smack (15, its
  net out), Fishing ketch (20, two masts); `fishingBoat(level)`, `nextBoat`. Only the look changes (the
  catch grows with the level as before): drawn drifting about the water in front of the hut, further the
  bigger it is (`FishingBoats`, stronghold/boats.tsx), and named in the hut's pop-up (`BoatStatus`). Farms and food are rounded to hundredths each tick (wood too), since
  tenths would swallow small rates.
- **Happiness** (`src/game/happiness.ts`, Stronghold-style, since 2026-10-16): one number for the hold,
  `happiness` 0–100 (`STARTING_HAPPINESS` 70), shown in the top bar (MOOD · a word from `moodWord`: Jubilant /
  Content / Grumbling / Unhappy / Wretched / Leaving; tap it for the sheet). It **drifts** every second by
  the sum of its factors, in points a minute (`moodFactors` → `moodDrift` → `driftHappiness`, clamped):
  **food** by the kinds of food in store (`FOOD_MOOD`: hungry −6, one kind 0, two +2, three +4); **homes**
  −4 × the share of peasants sleeping badly (`drySleepers`); **taxes** by the keep's rate (`src/game/taxes.ts`:
  none +3 and no gold, low +1 at half, average 0, high −3 at ×1.5, cruel −6 at ×2 — `taxRate` in the save,
  `setTaxRate`, chips in the happiness sheet and the keep's pop-up; `taxPerMinute(stats, population, rate)`);
  **fun / piety / a fair town** from the **fairgrounds, churches and gardens** (`src/game/moodBuildings.ts`:
  `fairground1–4`, `church1–4`, `gardens1–4`, 3×3, offered one at a time like the farms and unlocked with the
  keep at 1 / 4 / 8 / 12; fairs and churches are staffed, gardens aren't) — each kind gives `BUILDING_MOOD`
  (+3, +3, +2) when its worked levels × `PEASANTS_PER_LEVEL` (50) cover the whole population, less in
  proportion when they don't (`moodCoverage`: raise the level or build another); and a **siege** −3 while
  raiders are at the walls (`underSiege`). A battle moves it once (`afterBattle` in `settleBattle`): won +10,
  lost −15. **Effects**: the hold works at `workPaceAt` = 50% at 0 … 100% at 100 (`work` in the tick: mining,
  digging, building, forges, woodcutting — the old hungry slowdown is gone); at **0** a peasant **leaves**
  every `LEAVE_SECONDS` (30) — a free hand first, else the miner on the last face — with a notice, and nobody
  new arrives while it's 0 — except that the keep's household (`LEAVE_FLOOR`, 4) never leaves, and a hold with fewer gets drifters (one each arrival tick, hungry or not) until it has them again, so an emptied, starving hold can always build a farm and recover (since 2026-10-22; a save had starved to 1 peasant with no farms after lost raids plundered its food). `happiness-test`. When peasants start leaving (happiness 0, more than the household left) a pop-up says so on the city or the mine screen (`LeavingAlert`: what is hurting, NO TAXES, SEE HAPPINESS), once per slump — it comes back only after happiness has climbed to 5 and fallen to 0 again.
- **Stockpiles, per resource**: `vein` (miners' bins) → `mineExit` (surface bins) → `mineStock` →
  `warehouse`. Capacities apply per resource. Surface carts move exit→mine→warehouse each tick
  (per-tick totals shared across resources).
- **The warehouse's stockpile on the map** (`stronghold/stockpile.tsx`, since 2026-10-15, Stronghold-style):
  the warehouse's floor is a grid of 6 × 5 squares, **two to a resource** (`SLOTS_PER_RESOURCE`;
  the 14 non-food resources, each with its own place), on which the goods pile up as the stock grows — a
  resource's first square fills with the first half of the warehouse's capacity for it, the second with the
  rest, so **a full warehouse is a floor covered end to end**. **Seen only while the warehouse is tapped**
  (since 2026-10-17: the warehouse is drawn as a full building on its plot — a barn, a lower store with
  double doors, a lean-to — and when selected it and whatever stands in front of its floor go see-through,
  so the goods show inside; untapped, it's a building like any other). Looks by resource (`lookOf`): wood as stacked
  logs, granite as blocks in courses, ores and coal and salt and sulfur as heaps, gold / silver / diamonds /
  emeralds / mithril as chests (wood with the goods on the lid), wool as bales; in `STACK_STEPS` (8) steps
  (`stockpileSteps` is the memo key), drawn live with `useSvgPaths`. **The granary works the same way** (since
  2026-10-17; the old always-visible `Piles` are gone): tapped, it and what's in front of it go see-through and
  its floor shows six squares (two per food, a near-square grid — `floorOf` cuts any store's floor): fish in
  barrels, apples heaped, mutton in crates, filling against `granaryCapacity`.
  **Goods carried one by one** (`peasants.tsx`): every peasant's load is a sprite of the goods themselves —
  a sack in the resource's colour (lit, tied at the top), a bundle of logs, a basket of fish or apples —
  one cell per resource (`loadCell`); the haulers between the mine and the warehouse carry what the mine
  stockpile holds (`hauled`, like the handcarts), staff fetch `SUPPLIES` (iron), fishing hands and shepherds
  their food, woodcutters their logs. The load shows on the way to the store and is gone on the way back.
- **See-through buildings** (Stronghold-style, since 2026-10-15): a built building that stands in front of
  something that must stay in view and overlaps it on screen — the **tapped building**, the **warehouse's
  stockpile** (while the warehouse is tapped, the warehouse itself included), or the **building being
  placed** — is left out of the castle image and drawn
  over it faint (`FADED_OPACITY` 0.38): `fadedBuildings` / `watch` in GameSceneLayout.ts (`plotDepth` says
  what's in front; fortifications never fade; a watch's `except` is its own building, so the shed never
  fades for its own yard), `faded` in the still image's key and `StaticScene` (shadows stay), and
  `FadedBuildings` recorded as a **picture** by `useScenePicture` (stillImage.tsx: `drawAsPicture` under
  `collectPaths`, so its `svgPath`s are freed; the replaced picture is freed with `freeAfterDrawn`) and drawn
  in the live layer with `<Picture>` **through a layer** (`Group clip layer={<Paint opacity>}`, the clip the
  rectangle round the faded buildings, `fadedClip`): a picture ignores its group's plain `opacity`, so
  without the layer the faded buildings drew solid (seen 2026-10-16 — the foundry hid the yard as before).
  Changing what's faded rebuilds the castle image (a few hundred ms, in strips); until then the old image
  shows the building solid under the faint one. `fade-test` checks `fadedBuildings` on a new game (the
  foundry fades for the tapped warehouse; never the building itself or the fortifications).
- **The stronghold map** (`src/game/cityMap.ts`): 59×59 tiles in rings from the edge inward
  (`zoneAt`): tiles 0–2 **raider ground** (raiders are drawn there, on the side they come from, while a
  raid is sighted or attacking), 3–4 the **trap belt** (traps only, see below), 5 the **moat**
  (bridge at the gate), 6 the **wall ring** with the towers (`TOWER_SPOTS`) and the gate (front-left
  wall, x 28–30); the town is inside (7–51, 45×45). On the **far side from the gate there is no land** outside
  the wall: rows y 0–5 are **river** (`RIVER_ROWS`, zone `water`, flowing west → east), running right up
  to the wall, with the moat flowing into it at both ends. A walled **harbour** is cut into the castle
  square from the river (`HARBOUR`: water at x 27–31, y 6–8 — five wide, room for every barge; the wall
  steps in round it — columns x 26 and 32, back row y 9 = `DOCKS_ROW`), and the **docks** are a quay
  along its whole back wall (`DOCKS_SPOT`, `DOCK_TILES`, 5×1: a goods shed at one end, a second from tier 2,
  a crane between). Mountains ring the map on all four sides (the renderer's backdrop); the
  river runs on through gorges in them (in at the back-left, out at the front-right), and the gate road
  leaves through a pass on the front-left. The **moat** ring is a building (see Buildings): a dry ditch until it's built, then
  flooded from the river (water, rims and the bridge at the gate are drawn only then). `WALL_TILES`
  lists every wall tile (the ring, open at the harbour mouth, plus the harbour's walls). Raiders only come from the three land sides (`RAID_SIDES`), so the trap belt and
  raiders' ground exist on those sides only. None of the rings can be built on. Saves with traps where
  the river now runs get them paid back in full on load. Fixed in the town: the 5×5
  keep on its plaza, the 3×3 mine, the campfire and parade ground. Every other building is
  **placed by the player**, once, on its footprint (`FOOTPRINTS`: cottages 1×1, guardhouse and griffin
  eyrie 2×2, stables 4×3, the rest 3×3), anywhere it fits (`placementProblem`) — **never on roads**
  (take them up first: BUILD → Take up roads) or rocks. While placing, the ground it may go on is lit
  (`buildSpots`: its kind's ground — `buildingGround`: riverside for fishing huts, the raiders' ground for
  pastures, open town ground for the rest — off other buildings and roads; blue where clear, yellow
  under rocks). `placements` in the store; `placeBuilding(id, spot)` places and starts level 1; later
  levels are built in place — **built buildings never move**. `destroyBuilding(id)` pulls down **any
  building but the keep** (DESTROY in its pop-up, tapped twice): its level goes to 0, its plot is freed
  (`placements` entry removed — fixed ones keep their spot to be rebuilt), any construction cancelled and
  **50% of everything spent on it** (`buildingSpent` / `destroyRefund`: gold + every resource for each
  level built or being built) comes back, resources capped by warehouse room. A forge's goods go back to
  the store; pulling down the depot calls every cart back (`undoWagonTrip`), the docks send every waiting
  barge away. `cancelConstruction(id)` stops a level being built (STOP BUILDING, tapped twice): all it cost
  comes back, the crew's work is lost, and a building that was never finished leaves its plot. A new game starts with a cottage (`houses`), the first woodcutter's hut (since 2026-10-17, at 25,35 below
  the main road, left of the gate road its woodcutters take to the forest — staffed, so wood comes in from the
  start), warehouse, foundry and guardhouse on `DEFAULT_SPOTS`.
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
  building): dirt (2 gold, walking 1.5 tiles/s), stone (6 gold, 2), granite (4 gold + 2 granite, 2.5);
  **off the roads people walk 70% slower than on dirt** (`GROUND_SPEED` 0.45 tiles/s; over rocks
  `ROCK_SPEED` 0.18 — both were 1 and 0.4 until 2026-10-12), so they take a road wherever it's quicker. `roads` in the store (tile key → kind), `layRoads(kind | 'erase', tiles)` lays a stroke
  in order while it can be paid for (taking up is free, no refund). A new game (and older saves) start
  with dirt on `STARTING_ROAD_RUNS` (the old fixed roads); the road out of the gate (`GATE_ROAD`) stays
  fixed. **Walking**: `walkBetween(from, to, placements, roads)` = Dijkstra over town tiles and the land
  outside the walls, reached through the gateway and over the gate road (4 directions; every building
  footprint, the keep and the mine block; water and the wall don't), cost per tile 1/speed; cached per
  (placements, roads) object. **Carts keep to the roads**: `roadBetween` is the same search on road tiles
  alone (a road tile beside each stop); `cartWay` = that, or — only where no road joins the stops (one
  taken up) — the walkers' way, so a delivery never stalls. The depot's carts (`wagonLegs`, timed by the
  simulation, and drawn by `Wagons`) and the decorative handcarts use it. Effects: hauling —
  `haulFactor(walk mine → warehouse)` = `HAUL_REFERENCE` 5 s / walk time, clamped 0.5–3 (no way
  through: 0.5), multiplies `surfaceHaul` (a new game: 5.1 s → ×0.98; the reference was 6 s at first,
  7.5 s once walking off the roads got slower, 5 s since the warehouse grew to 5 × 5 next to the mine);
  construction — `buildFactor(walk warehouse → site)` = 1 + (12 − time)/40, clamped 0.7–1.3, multiplies
  each job's progress. Peasant walkers follow the same paths with per-tile timing (`times`), so they
  speed up on roads. Saves: version 1 (the
  old 32-tile map) migrate by moving every building 7 tiles in (`OLD_MAP_SHIFT`); version 2 (the 47-tile
  map) by `grownMap`: buildings, roads, cleared rocks and clearing orders move 6 tiles in
  (`GROWN_MAP_SHIFT`), traps keep their distance from their own edge (`grownCoordinate`), and a road that
  ran (nearly) down to the gate is carried on to it. Rocks are hashed from where a tile lay on the 47-tile
  map, so they didn't move either. Any spot that no longer fits is dropped and re-placed
  (`validPlacements` + `fillPlacements`).
- **A road at the door** (user rule, 2026-10-12): every building the player places — all but the
  pastures, out on the raiders' ground, and (since 2026-10-13) the fishing huts on the riverbank, reached
  on foot along the bank (no new game had a road anywhere near the river, so no hut could be placed) — needs a road at its **door** joined to **both the keep and the
  main gate** before it can be placed. Doors face the front-left (the row just outside the side along
  y + d); the barracks' faces the front-right (the column along x + w); **a one-tile building (a cottage,
  a fishing hut) opens on any side** — its four neighbours all count (since 2026-10-15: cottages packed four
  to a block by `splitHouses` had their back row's doors facing the front row, so no road could reach them
  and they stayed unhappy) — `doorSide` (`'any'` for 1 × 1), `doorText` (the words for the player),
  `doorTiles`, `needsRoad` in cityMap.ts. `accessRoads(roads)` (roads.ts, cached per roads object) = every stretch of
  road (tiles joined side by side) that touches both the keep's footprint and the gate's; `placementProblem`
  and `nearestFreeSpot` take it as `access` (the store's `placeBuilding`, the placing screen; callers
  without it skip the rule, e.g. older tests). **The main road** (`MAIN_ROAD`, `onMainRoad` in
  cityMap.ts: the middle column from the keep's front, y 26, down to the gate, y 51 — the starting road)
  always joins the two: it can be paved better but never taken up (`roadProblem` refuses, the road's
  pop-up has no CLEAR ROAD, the eraser says it stays) or built over (`placementProblem`, so a saved
  building on it is moved on load), and loading a save lays any stretch of it that's missing
  (`withMainRoad`).
  It's checked only when placing: a building keeps working if its road is taken up later. While placing,
  the door tiles are marked on the footprint — green where a joined road reaches them, red where not —
  and the bar says so; `startPlacing` starts at the nearest spot that fits with a road (else the nearest
  off the roads, to be moved). **Laid free**: `joinBuildings(placements, roads)` lays dirt from each
  building's door that lacks a road to the nearest joined road (breadth-first over open town
  ground; the merge clears the rocks under every road). Used for a new game's first buildings
  (`startingWays` in gameStore.ts, their rocks cleared) and once for saves from before the rule
  (`migrateSave` marks a save below `SAVE_VERSION` 6 `joinRoads` — 5 brought the rule, 6 the any-side
  doors, so the packed cottages get theirs —, `mergeSave` lays the roads once every spot is known and says
  how many tiles it laid; the marker isn't kept).
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
- **Shop and ads** (`src/game/shop.ts`; the store and ad SDKs in `src/components/purchases.ts` and
  `ads.ts`, with do-nothing `*.web.ts` twins for the web/PC build): Google Play Billing through **expo-iap**
  sells **No more ads** (`remove_ads`, €2, kept) and packs of **1,000 / 10,000 / 100,000 of everything**
  (`resources_1000` / `_10000` / `_100000`, €1 / €5 / €20, consumed so they can be bought again): the
  amount in gold plus the amount of every ore the mine yields (`MINE_RESOURCES`), delivered whole even
  past the warehouse's limit. Prices come from the store (Play Console); the euro ones in `PRODUCTS` only
  show where it can't be reached. `creditPurchase(id, key)` credits a purchase once per store token
  (`creditedPurchases`, the last 100), only once the store says *purchased* (pending payments wait), and
  then the purchase is finished with the store; at start-up `startStore()` fetches the prices and collects
  purchases paid but not yet credited (a crash mid-purchase, a reinstall); RESTORE PURCHASES does the same
  on demand. **Ads** (react-native-google-mobile-ads): consent first (Google's UMP form, `gatherConsent`;
  a PRIVACY CHOICES button where the law asks), then an **interstitial at most every
  `AD_INTERVAL_SECONDS` (180)**, shown only at a natural pause — `adBreak()` from going down the mine or up
  to the city, closing a pop-up and leaving a battle — never during a battle and never once `adsRemoved`.
  Development builds use Google's test ad unit; release builds show none until the real AdMob unit id
  replaces the placeholder in `ads.ts` (and the sample app ids in `app.json`'s plugin). To try the consent
  form outside Europe, flip `DEBUG_CONSENT_AS_EEA` in `ads.ts` (development only: `gatherConsent` is then
  given `debugGeography: EEA`; a real phone's hashed id goes in `DEBUG_CONSENT_TEST_DEVICES`, the emulator
  needs none). Both SDKs are
  loaded with a guarded `require`, so **Expo Go** (no native modules) runs the game without ads or
  purchases. The shop is in the Menu (`ShopPanel`).
- **Tech tree** (`src/game/techs.ts`): 78 upgrades bought once with **gold only**, separate from building
  levels — a branch per building (3 tiers: I, II, III) and a 9-tech branch for the mine (3 per tier).
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
  Keep, Workers' Cottages (24), Warehouses, Foundry, Research Facility, Docks (fixed, outside the walls, starts at
  1). Defence: Armory, Wall, Towers, Gate, Moat (fixed ring, needs the keep at level 10 —
  `MOAT_KEEP_LEVEL` — and no staff, like the wall; tapped on its front stretch west of the gate). One
  dwelling per unit: Guardhouse, Archery Range, Barracks, Monastery, Balloon Works, Stables, Griffin Eyrie,
  Paladin Chapel, Celestial Sanctum. Start: keep/houses/warehouse/foundry/guardhouse at 1, the rest 0.
  Effects come from `buildingStats(levels, staff?)` (staff omitted = fully staffed, for previews): keep =
  level cap for everything else, building sites at once `1 + ⌊L/5⌋`, taxes = keep level × peasants gold a minute (`taxPerPeasant` = L × the tax techs, `taxPerMinute`; collected every 5 s, shown in the keep's pop-up — until 2026-10-13 it was L gold per 5 s whatever the population); cottages = beds
  `8 + Σ houseBeds(L)` for peasants (the 8 is the keep's hall);
  warehouses (5 × 5 since 2026-10-13, was 3 × 3; default spot 30,34) = capacity `300·1.3^(L−1)` per resource (100·… until 2026-10-13) + mine stockpiles; foundry = miner rate and cart load;
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
  **Battles: instant or fought out** (`autoResolveRaids`, the switch in the War sheet): instant settles each
  raid the moment it arrives (`resolveBattle`, the result left on the battlefield) — how every battle went
  before 2026-10-12. Fought out (the default): the battle waits `RAID_AUTO_AFTER` (30 s) for the player to
  take command (COMMAND on the banner opens the battle screen); after that the **captains** fight it in the
  tick, both sides by the AI, one action at a time at the battlefield's pace (`battleDeadline` then holds
  when the next action is due: `actionSeconds` of the last one), and the banner says "round n, the captains
  fight it" with WATCH. RESOLVE NOW (banner) / QUICK RESOLVE (battle screen) settle it at once
  (`quickResolveBattle`). A save with a battle the captains were fighting goes straight on when loaded.
  Reports say which kind it was.
- **The campaign** (`src/game/campaign.ts`, the end game, since 2026-10-17): **opens the tick the hold has its
  first angel** (`campaignOpens`; `openCampaign` sets `campaign.scale` = the army's worth that moment, at least
  `CAMPAIGN_MIN_SCALE` 5,500 — one angel's). `CAMPAIGN_STAGES`: 12 sites (`CAMPAIGN_BATTLES`) from the High Pass
  over Wolfrun Ford, the Burnt Mill, Thornback Woods, Saltmarsh Causeway, Hollin Bridge, the Ash Fields,
  Harrowfield, the Iron Road and Kingsmoor to the Walls of Aldmere and the Red Hand's Court, each with its
  story and its place on the map. **Difficulty**: site n's strength = max(`campaignFloor` 3,000 → 25,000,
  `scale` × `campaignShare` 60% → 200%) (`campaignStrength`); the force is `raidParty(1 + 2n, strength,
  'siege')` — every raider kind, the stronger ones joining down the road (harpies and ogres from site 2,
  cyclopes from 4, behemoths from 5, more companies as it goes), and the court always has a bodyguard of
  behemoths (`campaignParty`). So the sites are fixed when the campaign opens, and growing the army is the
  way through. **Battles**: `startCampaignBattle` (refused by `campaignBlocker`: not open, won, a battle on,
  raiders sighted, no army) makes a **field** battle (`createBattle` with `campaign: n` and `raid: 1000 + n`;
  no walls, towers, oil, moat or traps — the armory's and the dwellings' bonuses apply) and runs it like a
  raid's: `battleArmy`, `battleCommanded` false, the captains fight it from `RAID_AUTO_AFTER_CAMPAIGN` (60) s
  unless the battle screen takes command; `Battle.campaign` marks it (`battleTitle` on the battle screen, the
  banner says "THE ARMY FIGHTS AT …", the end-of-battle lines differ). **Settling** (`settleCampaignBattle` in
  updates.ts, from `settleBattle`): the raid clock, `raidsFought`, the losing streak and the flocks are
  untouched and nothing is plundered; a win pays `campaignBounty` (50% of the force's worth) and
  `afterCampaignBattle` opens the next site (`won`, `fought`); the twelfth win sets `campaign.victory`. The
  report is a `RaidReport` with `campaign: n`. Happiness moves as after a raid. Raids keep coming: one
  arriving during a campaign battle waits for it (the tick's `battleRunning`). **Victory** (`Victory.tsx`,
  pages like the prologue): shown over the stronghold once `victory` is set and `victorySeen` isn't
  (`seeVictory`), again from the Menu's THE VICTORY; then the hold plays on (`nextStage` is null, MARCH is
  gone). `campaign` is saved (`cleanCampaign` on load; older saves start closed and open on the next tick if
  they have an angel). `campaign-test` covers it.
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
  open the battle screen to command it, otherwise the captains fight it from 30 s on (above). Win: bounty 30% of the
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
  Moves record the hexes walked (`pathTo`; fliers just from and to). **Pace** (`BATTLE_PACE`): 0.32 s a hex
  walked, 0.12 s a hex flown, 0.6 s a blow / shot / spell / tower shot / oil / moat, 0.3 s defending, 0.6 s
  a new round, and a 0.3 s beat after every action (`eventSeconds`, `actionSeconds`).
- **Economy**: carts and digging cost warehouse **coal** + gold; buildings also cost ores. Trade is with
  **river barges** (`src/game/ship.ts`): up to `MAX_BARGES` (5) wait at the docks at once, each at a
  berth (`BERTHS`: all five nose-in along the harbour's quay, the middle first) with an order —
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
    mine.tsx               mine screen: the full-screen map, its top bar and toolbar, the tile/bin card,
                           the upgrades and carts sheets
    campaign.tsx           the campaign map: the twelve sites, the picked site's card, MARCH
  game/                    simulation + pure model (no React Native / Skia)
    gameStore.ts           Zustand store: the starting state, the actions, persistence, loadGame,
                           startSimulation; `useGame(live)` / `useGameSlice(selector, live)` for screens
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
                           deposit info, dark rock (fog, surveyed patches), auto-dig route finder
    survey.ts              surveys of the dark rock from a tunnel: cost, cooldown, reach (and their
                           techs), the dark tiles in reach, refusals
    haulage.ts             cart routes (BFS to lift), trip schedule, cart pose (worklet), events
    resources.ts           RESOURCES list, Stock type, names/colours, market prices
    workforce.ts           peasant pool: allocation of miners/pushers/crews/staff/idle, arrival rate
    cityMap.ts             the stronghold's tile map: rings (raiders, traps, moat, wall), map sides,
                           footprints, fixed ground, placement checks, save-migration helpers
    traps.ts               trap kinds, costs, damage, belt placement checks, traps facing a side
    houses.ts              the workers' cottages: ids, keep levels, names, beds per level, the 200 cap
    homes.ts               the cottages' homes: water and food, the women's errands, who sleeps where,
                           the work pace and room for newcomers
    forest.ts              the forest on the near mountains: stands, felling the nearest, regrowth elsewhere
    farms.ts               food: orchard / fishing hut / pasture ids, food rates, eating and hunger, raid losses
    boats.ts               the fishing huts' boats by level (rowboat, skiff, smack, ketch)
    shop.ts                the products, their prices and what each credits (once per store token)
    save.ts                batched localStorage storage for the persisted store, flushSave()
    buildings.ts           stronghold buildings: ids, start levels, stats per level, costs, build time
    units.ts               army + raider stats/abilities, dwellings, recruit gold and growth
    items.ts               gear and parts: recipes, each unit's gear
    forges.ts              the forges: ids, keep levels, tasks with shelf and rack, loads, speeds
    wagons.ts              the depot's carts: trips, what to bring a forge, goods on the move
    combat.ts              hex battle engine: setup, turns, damage, walls/towers, AI, quick resolve
    raids.ts               raid timing, strength, composition, side, bounty/plunder constants
    campaign.ts            the end game: the twelve sites on the road to Aldmere, their strength and forces,
                           opening on the first angel, what a battle's result does, the victory
    techs.ts               the tech tree: 78 gold upgrades in branches (mine + every building), bonuses
    ship.ts                river barges: berths, orders (`bargeOrder`), course and pose (`bargePose`)
    rocks.ts               the rocks the town starts under: where they lie, sizes, clearing work and yield
    roads.ts               road kinds/costs/speeds, road placement checks, walking paths (Dijkstra),
                           haul and construction speed factors,
                           the roads joined to the keep and the gate (`accessRoads`) and laying the
                           missing ones free (`joinBuildings`)
  components/
    MineMapLayout.ts       grid constants (tile size, columns, levels, 12 stations a gallery, exit bins)
                           — the 12 exit bins stand six a side of the headhouse, resources taking turns right then
                           left (`exitBinOnLeft`, `getExitBinX`); carts tip from the side facing the lift (haulage.ts)
    MineScene(.web).tsx    platform wrapper; web loads Skia (CanvasKit) lazily via WithSkiaWeb
    MineViewport.tsx       camera (pan/pinch/wheel/keys; scrolls clear of the bars over the map), view
                           culling, dig drag, taps, labels, haul clock, pickaxe layer, zoom buttons
    MineSceneCanvas.tsx    the Skia canvas: terrain chunks, carts, miners, bins, dig overlay
    mineSurface.ts         the mine's surface strip (rows 0–1) in the stronghold's look: grey snowy mountains and green
                           hills, a grass verge and dirt road, and the headhouse (plaster + red tiles on stone, timber
                           headframe and wheel), plank-and-thatch storehouse (banner, logs) and cottage (chimney, picket
                           fence) drawn with the town's materials (stronghold/shapes.tsx MATS), outlined; drawn once
                           into a picture by mineTerrain.ts
    mineTerrain.ts         terrain renderer: tiles, fog, and cached block images (16 × 4 tiles) with
                           dirty tracking so a change only redraws nearby blocks
    MineHaulers.tsx        carts + haulers, miner bins, mine-exit stockpiles drawn as mini warehouses in the town's
                           style (open-fronted plank sheds, red-tiled gable with the resource's board) (Skia pictures)
    MineHaulerSteps.ts     bin sizes/places, heap steps (≈1 px each: a part-full heap is the full heap
                           clipped, so it rises smoothly) and `binAt` tap hit-testing (Skia-free so
                           the viewport can import it on web)
    BinPanel.tsx           a tapped bin's resource: miners' bins, mine exit, mine stockpile, warehouse
    MinePickaxe(.web).tsx  animated pickaxe (Reanimated on native, CSS on web)
    MinePileTip.tsx        the mouse's tip on a pile: every resource in the miners' bins, at the exit,
                           in the mine stockpile, and its total
    DepositPanel.tsx       tapped-tile info + Assign / Release / Dig & Assign
    HaulagePanel.tsx       carts per level + Add Cart
    StockpileTable.tsx     resources × stages table (the stronghold; the mine shows bins instead)
    BargesPanel.tsx        the barges waiting at the docks: one card per order (sell 10, fill, send away)
    CombatPanel.tsx        the War sheet behind the ⚔️ side button: raid now, auto-resolve, army and
                           recruiting, defences and traps, stakes (`hireableNow` for the button's badge)
    ForgePanel.tsx         a forge's pop-up (status, shelf, target, task list), GearStore (carts, forges,
                           the store) and DepotPanel (every cart's trip)
    GameScene*.tsx         the castle map (Skia, isometric, styled after Firefly's Stronghold): iso
                           boxes/roofs painted back to front; every building in 4 looks by tier, its
                           material's `kind` dressing walls and roofs (`faceDressing`, `roofRows`):
                           plank huts under thatch, half-timbered plaster under red tiles, stone and
                           dressed stone under slate; boxes and roofs outlined. Every building has a
                           **signature** that says what it's for at map scale (since 2026-10-17):
                           warehouse — hoist beam and loft door, crates/barrels/sacks on a loading
                           apron; foundry — chimneys, wide glowing furnace mouth, ore heap, ingots;
                           research — observatory dome and telescope from level 1, tall glass, blue
                           pennant / gold armillary; armory — shield and crossed swords over the door,
                           spear-and-shield rack; barracks — hall with banners and a drill yard (dummies,
                           flagpole); guardhouse — brazier, steel-tipped pikes; archery — straw butts
                           with targets and arrows, shooting-line posts; monastery — a *cloister*
                           (hall with bell cote and cross, arcaded walk, garth with well), nothing tall,
                           so it isn't mistaken for the church (tall spire at the front) or the paladin
                           chapel (tower with the red-and-gold banner, sun finial, crossed swords);
                           balloon works — hangar doors, iron gas-holder, mooring mast, tether to the
                           live balloon; stables — paddock with horses, haystack, trough; granary — barn
                           plus round silo, wheat sheaves, sacks; depot — cart bays and a big spare
                           wheel; cottages — hearth chimney at every level, lit shuttered window,
                           picket fence with flowers; woodcutters — a true log cabin (log courses,
                           notched corners), felled trunk, sawhorse and two-man saw, log stack, axe in
                           the block, pines; forges — chimney,
                           glow, anvil and hammer, racked blades; eyrie — nest on a crag and a pennant.
                           Pennants are a legend: red on everything that raises troops (guardhouse,
                           archery, barracks, stables, balloon works, armory, eyrie), blue on research,
                           gold on the holy/last-tier ones; economy buildings fly none. `TALL` in
                           `GameSceneLayout` must stay ≥ the tallest pixel of each look (taps). Fortifications go
                           from timber straight to stone (`fortMat`): a timber keep (tower with an
                           overhanging fighting platform), then a square stone keep with turrets,
                           then a fortress keep with round corner towers (`Cylinder`) and a central
                           tower; a palisade, then a continuous crenellated stone curtain wall
                           (`WallSegment`, battlements on both faces by `wallRuns`); round stone
                           towers with an archer; a gatehouse of two round towers and a portcullis;
                           a low wattle fence marks the wall's line until it's built (no defence).
                           The ground has no grid (the placement ghost shows it only while placing or
                           painting, on land; the grid on the river and harbour only while placing a
                           fishing hut — `gridLines`, `Ghost.water`): grass in broad lighter/darker patches from value noise with
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
                           map and the backdrop share the land colour (`LAND`, inside the walls and out),
                           the grass (`grass.ts`: the same noise patches and tufts on the map and, in
                           the backdrop's `MEADOW`, on the land round it, seamless across the edge) and
                           the trees (`CROWNS`), and the map has no outline, so the hold sits in its valley. It uses extra room
                           above and below the map (`SKY_ROOM`, `FOOT_ROOM`); the castle image covers
                           only the map part (`STILL_TOP`, `STILL_HEIGHT`), so it didn't grow. Two layers for speed: everything still is
                           rendered offscreen into ONE image (`useStillImage`, keyed on building levels,
                           placements, traps, parade sizes, building sites and raiders
                           (traps are drawn flat on the ground there), from two layers — `StaticGround`
                           and `StaticScene` — each recorded in a step of its own and rasterised a strip
                           of rows per task, so a rebuild never freezes the game (keep fast-changing
                           things out of the key all the same); the live layer on top has the
                           warehouse and granary stockpiles (when tapped), the see-through buildings' picture,
                           progress bars, selection, a few animated bits (smoke,
                           balloons, flame, mine wheel, the river barges) and every peasant as one `Atlas` moved by a
                           single `useRSXformBuffer` worklet (haulers, staff errands, crews, idlers, and the
                           handcarts: a third of the mine's haulers, up to 3, push carts heaped with
                           what the mine stockpile holds; each woodcutter's hut carts logs to the
                           warehouse; orchards cart apples, fishing huts' hands carry baskets of fish
                           and shepherds bring mutton in on foot (no roads outside the walls), to the
                           granary — or the warehouse without one; the carts keep to the roads;
                           a store with no room keeps its carts home — `peasants.tsx`, all decoration:
                           the simulation moves the goods per tick).
                           One frame-callback clock at ≤30 fps, paused when the screen isn't focused.
                           `GameSceneCanvas.tsx` puts the scene together (the still image's contents,
                           the live layer); its parts are in `stronghold/`: `shapes` (materials, iso
                           boxes/roofs/towers/flags, shared colours), `backdrop`, `ground` (grass, rocks,
                           roads, traps, trees, raiders), `fortifications` (wall, towers, gatehouse),
                           `buildingArt` (every building, campfire, headframe, scaffolds, parade),
                           `live` (smoke, balloons, wheel, carts, barges, progress
                           bars), `stockpile` (the stores' floors, below),
                           `peasants` (the sprite atlas: one cell per outfit), `villagerLooks` (what
                           every villager wears by job — `jobOf(building)`: hauler, woodcutter, builder,
                           quarryman, fisher, shepherd, smith, scholar, armourer, docker, gatekeeper,
                           soldier, archer, monk, priest, acolyte, groom, engineer, falconer, miller,
                           entertainer; idlers in plain tunics — as Skia-free rects), `housewives` (the cottages' women on their
                           errands), `overlays` (plots, selection, placement
                           ghost) and `stillImage` (`useStillImage`, `picturesToImage`).
    GameSceneLayout.ts     drawing the tile map: `iso()` / `groundAt()` projection, `plotOf()` (plots from
                           placements), doors and peasant routes, silhouettes and the depth-ordered
                           tap list (the wall is tapped at the front end of its left run);
                           **tapping** (`pickBuilding`, since 2026-10-17): the front-most building whose
                           *drawn* shape holds the tap (`tapShape`: as tall as it is at its tier —
                           `tapHeight` = 70% of `TALL` at tier 1, all of it at tier 4 —, set in 0.12 tile
                           from its plot's edges like the art, walls to 62% of that height and a roof
                           narrowing to its ridge), else the building whose footprint is under the finger,
                           else the ground. (The old test used the plot's full box at the tallest tier's
                           height, so a building in front caught taps meant for its neighbours.)
                           `pick-test`; ORIGIN_X / ORIGIN_Y for worklets
    buildingIcons.ts       an emoji icon per building and per trap (build palette, trap bar)
    TechTree.tsx           the tech tree (all branches) and one branch with its tiers, details, Research
    BattleBoard(.web).tsx, BattleBoardCanvas.tsx   battlefield (Skia): hexes, wall/gate, towers, sprites
    battleLayout.ts        hex geometry for the board, taps and labels (Skia-free)
    battlePlayback.ts      an action laid out in time: walk tracks, lunges, shots, hits (Skia-free; worklet poses)
    skiaPaths.ts           who owns a Skia path: parse once, held by a component, or freed with a drawing
    unitSprites.ts         16×16 shaded pixel sprites for all 16 creatures, each with its gear (pike and
                           kettle hat, crossbow and quiver, shield with a cross, glowing staff, lance and
                           pennant, plume and sun, tusks, the cyclops' boulder…); drawn as row runs
                           (`spriteRuns`, mirrored for the hold's side) on the battle board, the parade and
                           the raiders (`FIGURE_PIXEL` sets their size on the castle map)
    RaidBanner.tsx         raid status banner on both main screens, kept to a title and one line (kind ·
                           side · clock; party · strength vs yours); rules, traps and the auto-resolve
                           switch live in the War panel
    CityView.tsx           the stronghold's full-screen map: camera (shared values), gestures, wheel,
                           +/− buttons, taps (`pickBuilding` in GameSceneLayout; else `onTapGround`, for
                           traps), dragging the building being placed (judged by the press point,
                           `onBegin`), paint strokes for roads/traps, right/middle-drag pan, level badges
    Sheet.tsx              pop-up panel (slides up, scrolls, closes on ✕ or backdrop)
    Prologue.tsx           the story before a new game (and from the Menu), a page at a time
    Victory.tsx            the epilogue when the campaign's last site falls (and from the Menu)
    ShopPanel.tsx          the shop in the Menu: No more ads, the packs, restore, privacy choices
    purchases(.web).ts     the store (expo-iap): prices, buying, crediting and finishing purchases
    ads(.web).ts           the ads (Google Mobile Ads): consent, the interstitial at pauses every 3 min
    Toolbar.tsx            `Toast` (the latest notice for a few seconds) and `ToolButton` (a toolbar button
                           with a badge, lit while its mode is on; an emoji or a drawn icon), shared by the
                           stronghold and the mine
    MineCartIcon.tsx       the mine toolbar's mining cart, drawn with plain views (no emoji for one)
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
- **Free Skia images only after frames are drawn** (`freeAfterDrawn` in skiaPaths.ts): a hidden browser
  tab keeps running timers but draws no frames, so its canvas still had the old drawing queued; freeing on a
  timer alone made it draw a deleted image when the tab came back ("Cannot pass deleted object as a pointer
  of type Image const*", seen in Firefox). The castle image and the mine terrain wait for two frames, the
  delay, and two more frames.
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
  is drawn with `picturesToImage` (`stronghold/stillImage.tsx`): a CPU raster surface on web (no context),
  filled `STRIP_ROWS` (120) rows per task, an offscreen GPU surface on iOS/Android drawn at once, both
  disposed straight away. As a
  safety net, `CityView` remounts the scene if its canvas ever fires `webglcontextlost`.
- **Castle redraw cost**: the still image is rebuilt from a fresh React tree each time, so anything
  computed inside it is redone too. Big static paths are parsed into Skia paths once (`buildGround`),
  rocks and roads keep one parsed set for their current state (`latest` in `skiaPaths.ts`, freeing the replaced set a few
  seconds later). Measured 2026-10-12 (desktop Chromium, DPR 1, 2360×1333 image): recording ~80 ms in a
  dev build (~14 ms in production), rasterising ~165–185 ms in one go — a quarter-second freeze on every
  cleared rock, building site or raid. Now recorded as two layers (ground, then the rest) in separate
  tasks and rasterised a strip per task: no task over 50 ms; the image appears a few hundred ms later.
- **Re-rendering per tick** (the store changes every second): screens use `useGame(useIsFocused())`, so
  one out of sight (the stronghold under the mine or the battle, the mine under the battle) skips the
  ticks and catches up when shown; the map's slices use `useGameSlice(…, active)`. Lists that would redraw
  everything every tick are memoised on what they show: tech branches (`TechBranchView` re-renders only
  when the techs, buildings, depth or the number of its techs the gold pays for change), tech cards,
  build-palette entries, the toolbar and side buttons, the toast. Measured per tick in a dev build:
  stronghold 7.7 → 4.9 ms, with the build palette open 18 → 9.8, the tech sheet 23 → 7.4, the mine 18
  → 8.8 (it no longer re-renders the hidden stronghold too). While the **page** is hidden (another tab,
  a minimised window) `useGame` / `useGameSlice` pass no changes on at all — the game keeps ticking and
  the screens catch up when it's shown — so a background tab costs only the tick (~0.5 ms a second).
- **Browser load** (main-thread busy time, measured with a MessageChannel probe whose own floor is
  ~4%): filling the mountains, sky, river and forest (`Backdrop`, `ForestTrees` — big, complex paths) on
  every animation frame took ~22% of the main thread on its own. So the stronghold draws on **two
  stacked canvases** (`GameSceneCanvas`): below, everything still (backdrop, castle image, forest),
  redrawn only when the camera moves or they change; over it, see-through, the live layer (piles,
  flocks, smoke, barges, carts, progress bars, peasants, selection, ghost) at the clock's 30 fps.
  Stronghold idle 27% → ~8%, panning still 60 fps. The pulsing `LiveSignal` dots are a Reanimated CSS
  animation (`css.create` / `css.keyframes` — not React Native's StyleSheet, which rejects
  `animationName` on web), so the browser runs them with no script per frame (mine 8.7% → 7.1%).
  Memory: CanvasKit's heap is a fixed 128 MiB unless something grows it; the mine's terrain block cache
  (768×192 px, ~590 KB each) keeps `MAX_CACHED_BLOCKS` 72 (was 160, ~94 MB) but never fewer than the
  blocks on screen plus 12 (`keepBlocksInView`), or zooming out would redraw blocks every frame.
- **Web quirks**: Skia's web `<Canvas style>` must be a plain object (not an array). Modules imported
  by non-lazy web code must not touch Skia at module load (hence `MineHaulerSteps.ts`). Avoid
  `__destroyWebGLContextAfterRender` (broke hidden screens).

## Running, checking, testing

- Node is only available via **nvm** (v24). In a non-interactive shell: `source ~/.nvm/nvm.sh` first.
- Checks (run before calling anything done): `npx tsc --noEmit` · `npx expo lint` · `npx expo-doctor`.
  **GitHub Actions** runs the first two and `npm test` on every push (`.github/workflows/checks.yml`,
  since 2026-10-16) — a way to typecheck work written where nothing can be installed.
- **An Android APK on every push** to `main` and `release-prep` (`.github/workflows/android-apk.yml`, since
  2026-10-17), for testing on a real phone: `expo prebuild --platform android` in CI (nothing native is
  committed), then `./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a` on JDK 21 — a standalone
  release build (JS bundled, no dev server), signed with the template's debug keystore so every build
  installs over the last and keeps the save; `versionCode` = the run number. Published to the GitHub release
  `apk-<branch>` (replaced each build, so the link is fixed):
  `https://github.com/lacho2350/mineForgeFight/releases/download/apk-<branch>/mineforgefight-<branch>.apk`,
  and kept 14 days as a workflow artifact. Not for Google Play (that build goes through EAS, NEXT_STEPS.md).
  Run it by hand from the Actions tab (`workflow_dispatch`) for any other branch. **Gotcha**: with
  react-native-google-mobile-ads 17.2 every Android build (CI or `npx expo run:android`) fails in Gradle
  with "Cannot get property 'googleMobileAdsJson'" unless built with `-PRNGMA_ANDROID_BACKEND=classic` (the
  CI passes it); 17.3.0 fixes it — `npx expo install react-native-google-mobile-ads` on the computer.
- **Tests**: `npm test` (jest with the `jest-expo` preset) runs `__tests__/*-test.ts` — never put tests in
  `src/app/` (every file there is a route). `support.ts` has helpers: `newGame(overrides)` resets the store
  (no raid comes unless a test asks), `run(seconds)` ticks it, `build(levels)` places buildings like the
  player would. `raids-test` (sizing, kinds, siege-only units), `combat-test` (siege vs field, determinism),
  `items-test` (gear per unit, the relic's resources, mine depths), `store-test` (forge chain by cart, task
  changes, gear deliveries, auto-resolve / orders / riding out), `mine-test` (galleries reach past the lift,
  digging under a main tunnel and joining the gallery below, the rock rule), `houses-test` (beds add up, the
  200 cap, houses offered in order), `miners-test` (idle peasants go mining and come back when buildings
  need hands), `fade-test` (see-through buildings), `happiness-test` (the mood's factors, taxes, the buildings' coverage, leaving), `skia-fallback-test` (the web WebGL→CPU fallback in `skiaWebFallback.ts`, with CanvasKit and the page stood in for), `playthrough-test` (whole stretches of play through the store — a bot building up for an hour, an absent player through 90 minutes of raids, cruel taxes driving peasants away and kindness bringing them back, a save/load mid-game, a campaign fought by the captains — checking every game minute for NaN, negative or over-capacity stock, happiness off 0–100, too many peasants) and `save-test` (v2→v3 map growth, the old armory refund, the save guard, new houses on load) — the save tests load a fresh copy of the store over an in-memory
  `localStorage`, so they never touch a real save.
- **WebGL on the web** (since 2026-10-19): browsers refuse or take back WebGL contexts (hidden or embedded
  panes, blocklisted GPUs, too many GPU canvases, a GPU reset), and CanvasKit then throws ("failed to create
  webgl context", "Could not create surface"). `src/components/skiaWebFallback.ts` (imported first by the three
  canvas modules) wraps `CanvasKit.MakeWebGLCanvasSurface`: on a failure it draws that canvas on the CPU
  (`MakeSWCanvasSurface`) and switches every later canvas to the CPU; a canvas that had WebGL and lost it (it
  can't become 2D) draws off-screen while `SKIA_RESET_EVENT` makes its view remount with a fresh element
  (`useSkiaRemountKey` in skiaWebRemount.ts, the `key` of `WithSkiaWeb` in the three `.web.tsx` wrappers);
  a `webglcontextlost` anywhere does the same.
- Web dev server: `npx expo start --web --port 8081` (`.claude/launch.json` has an `expo-web` config).
- **A hosted, playable build** (since 2026-10-16): the web export runs as a Claude artifact ("Mine Forge
  Fight", claude.ai/artifact/9NgwBFCcYYtmY9S8ET6ywy). Branch `ci-smoke` holds the tooling: `smoke.yml`
  drives the dev server with Playwright (`scripts/smoke.mjs`: prologue, stockpile, the mood buildings and
  sheet, a raid, a reload, the fade, placing, the mine) and then the production export with a saved game
  (`scripts/smoke-prod.mjs`), pushing screenshots and logs to branch `ci-smoke-results`; `web-build.yml`
  (run by hand) pushes `expo export --platform web` there with CanvasKit copied in. The artifact is the
  export with `_expo/` renamed `expo/` (the service reserves leading underscores), the entry bundle's
  `url:location.origin+location.pathname` and `locateFile` pointed at `globalThis.__MFF_BASE`, and a page
  fragment that sets `__MFF_BASE`, wipes the save on `#new`, `history.replaceState('/')` (the router sees
  the stronghold) and shows errors in a `<pre>` at the foot. Note: a page whose `document.hidden` is true
  (a background tab, the desktop app's hidden browser pane) ticks but draws nothing — rAF and the
  screens' updates wait for it to be shown; that isn't a freeze.
- **Android** (tested 2026-10-12 in an emulator with Expo Go 57.0.9 — no native build needed): JDK 21 and
  the Android SDK live in `~/Android` (`jdk-21.0.12.1+1`, `Sdk` with platform-tools, emulator and the
  `system-images;android-36;google_apis;x86_64` image; AVD `mff_pixel`, a Pixel 7). Run
  `~/Android/Sdk/emulator/emulator -avd mff_pixel -gpu host` (on Wayland the host GPU path has crashed the
  emulator — `-gpu swiftshader_indirect` is steadier but slow; heavy host load can trip its watchdog),
  then `adb reverse tcp:8081 tcp:8081` and `adb shell am start -a android.intent.action.VIEW -d
  exp://127.0.0.1:8081` (the running web dev server serves the Android bundle too); screenshots with
  `adb exec-out screencap -p`. Everything worked: the stronghold, placing (lit ground), cottages and their
  women, the mine, the War panel and recruiting, raids and a commanded, animated battle, saving across a cold
  restart. Fixed then: Android's **Back** closes an open pop-up (`Sheet`) and cancels placing or painting
  instead of leaving the game; on the bare stronghold (nothing open, nothing being placed or painted, the
  prologue not showing) it opens **"Leave Greyhollow?"** (a `Sheet`, popup kind `leave`: STAY, or LEAVE —
  `flushSave()` then `BackHandler.exitApp()`; Back on the sheet stays), since 2026-10-15. The mine's
  terrain blocks are rasterised on the CPU when first seen, which opened the mine on a moment of black
  rock: now the stronghold's Mine button draws the blocks of the camera's first view before the screen
  opens (`warmMine` in `mineWarmup.ts` → `warmTerrainBlocks` in mineTerrain.ts; a no-op `.web.ts` twin,
  since the web loads Skia lazily on the mine screen), and `MineViewport` starts with that view (the
  window's width standing in for the frame's) instead of an empty one, so its first frame draws them —
  `mineStartCamX` / `mineViewAt` in `MineMapLayout.ts` (Skia-free) say where the camera starts.
  **Never set `CI=1`** — Metro then stops watching files and serves stale lazy chunks.
  **Metro doesn't watch folders created after it started** (it serves their first version forever, even
  after `touch`): after adding a folder (e.g. `src/components/stronghold/`), restart the dev server. To
  check what's served: `curl` the module's `.bundle` URL (as in the browser's network list) and grep it.
- **Saving**: the store is wrapped in Zustand `persist` (key `mineforge-save`, `SAVE_VERSION` 6 — 4 split
  the old 2×2 workers' houses into cottages on their tiles, `splitHouses`, enough to sleep as many, up to
  four each, stocked; a house job under way is paid back; 5 and 6 lay the roads to the doors, see
  "A road at the door"). Storage is
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
  **Editing code while a game is open**: Fast Refresh re-runs changed modules, and re-running
  `gameStore.ts` used to make a second, blank store that never loaded or ticked — the screen froze on it
  (raid clock stuck at "RAID 1 6:00") while the real game ran on unseen. In development the running store
  and its clock now live on `globalThis` (`mineforgeStore`, `mineforgeClock`) and are kept across a
  refresh, and `loadGame` only loads once. A refresh hands the kept store the edited actions (`gameState`
  bound to its `setState`) plus any new fields, so edited game logic runs at once; save migrations
  (`saveMigration.ts`) still only run when the page loads.
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
4. Battle polish: Heroes-style "wait", morale/luck, hero commander, a speed setting for the playback,
   two-hex units; going out to attack raider camps.
5. The wall is tapped at the front end of its left run (or from the Buildings list).
6. No feedback text when a hand-drawn dig is released on an invalid tile (it just doesn't order).
7. Deep levels: one lift ride can take ~40 s each way; rebalance speeds if it feels slow.
