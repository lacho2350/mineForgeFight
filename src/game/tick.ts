import { cartEventsBetween, getCartRoutes } from './haulage';
import { RESOURCE_INFO, emptyStock, type Resource } from './resources';
import { BUILDING_INFO, DWELLING_UNIT, buildingStats, workedLevel, type BuildingId } from './buildings';
import { ARMY_RECRUITING, ARMY_UNITS, MAX_MUSTERS_WAITING, MUSTER_SECONDS, unitGrowth, type ArmyUnit } from './units';
import { createBattle, resolveBattle } from './combat';
import { RAID_AUTO_AFTER, RAID_WARNING, raidKind, raidParty, raidSide, raidStrength } from './raids';
import { BERTHS, MAX_BARGES, bargeOrder, isWaiting, BARGE_SAIL } from './ship';
import { ROCK_INFO, startingRock } from './rocks';
import { ITEM_INFO, UNIT_GEAR, type ItemId } from './items';
import { FORGE_IDS, FORGE_OUTPUT_CAP, addLoad, isForge, loadUnits, shelfMissing, type ForgeId, type ForgeTask, type Load } from './forges';
import { gearComing, gearWanted, incomingTo, supplyLoad, wagonBackAt, wagonDropAt, type WagonJob } from './wagons';
import { SIDE_NAMES } from './cityMap';
import { haulFactor } from './roads';
import { trapCounts, trapsFacing } from './traps';
import { depositRemaining, depositStep, depositTotal, digTime, tileKey, parseKey, type Site } from './mineLayout';
import { raidBattleKind, type CartLoad, type GameState } from './state';
import {
  describeParty,
  docksOf,
  forgeSpeedsOf,
  haulWalk,
  holdPowerOf,
  itemsCounted,
  selectMineLayout,
  siteFactor,
  siteResource,
  unitAvailable,
  wagonLegs,
  workforceOf,
} from './hold';
import { buildingFields, roundCoal, settleBattle, transfer } from './updates';

// One second of the game: miners cut, carts and haulers move the goods, builders, smiths and carts work,
// recruits muster, raids and barges come and go.
export function tickGame(state: GameState): Partial<GameState> {
  // Each miner cuts from their own deposit into that resource's stockpile beside the miners,
  // until the deposit is mined out (or the stockpile is full).
  const vein = { ...state.vein };
  let mined = 0;
  let depositMined = state.depositMined;
  let sites = state.sites;
  let layoutChanged = false;
  const exhausted: Site[] = [];
  for (const site of state.sites) {
    const resource = siteResource(site);
    const total = depositTotal(site.faceRow, site.faceColumn);
    const remaining = depositRemaining({ depositMined }, site.faceRow, site.faceColumn);
    const take = roundCoal(Math.min(state.minerRate, remaining, Math.max(0, state.veinCapacity - vein[resource])));
    if (take <= 0 && remaining > 0) continue;
    const key = tileKey(site.faceRow, site.faceColumn);
    if (depositMined === state.depositMined) depositMined = { ...depositMined };
    depositMined[key] = roundCoal((depositMined[key] ?? 0) + take);
    vein[resource] = roundCoal(vein[resource] + take);
    mined = roundCoal(mined + take);
    const left = remaining - take;
    // Redraw the deposit as it shrinks, and free the miner once it is mined out.
    if (depositStep(total, left) !== depositStep(total, remaining)) layoutChanged = true;
    if (left <= 0) exhausted.push(site);
  }
  let notice = state.notice;
  if (exhausted.length > 0) {
    sites = sites.filter((site) => !exhausted.includes(site));
    layoutChanged = true;
    notice = exhausted.length === 1
      ? 'A deposit is mined out. Its miner went back to the campfire: tap another deposit to assign one.'
      : `${String(exhausted.length)} deposits are mined out. Their miners went back to the campfire.`;
  }

  // Carts: the mine renderer animates the second that ends at `haulTime`, so the loads and tips
  // that happen in it are applied now, as the player sees them. Each trip serves one miner: it
  // loads that miner's resource from its stockpile and tips it into the same resource's bin at
  // the mine exit.
  const from = state.haulAppliedTime;
  const to = state.haulTime;
  const mineExitIn = { ...state.mineExit };
  let cartLoads = state.cartLoads;
  let toMineExit = 0;
  const routes = getCartRoutes(selectMineLayout(state), state.carts);
  for (const [cart, route] of routes) {
    const tips = cartEventsBetween(route, from, to, 'tip');
    const loads = cartEventsBetween(route, from, to, 'load');
    if (tips.length === 0 && loads.length === 0) continue;
    cartLoads = cartLoads === state.cartLoads ? { ...cartLoads } : cartLoads;
    if (tips.length > 0) {
      const carried = cartLoads[cart] as CartLoad | undefined;
      if (carried && carried.amount > 0) {
        mineExitIn[carried.resource] = roundCoal(mineExitIn[carried.resource] + carried.amount);
        toMineExit = roundCoal(toMineExit + carried.amount);
      }
      delete cartLoads[cart];
    }
    for (const trip of loads) {
      const resource = route.resources[trip];
      const take = Math.min(vein[resource], state.mineCartCapacity);
      vein[resource] = roundCoal(vein[resource] - take);
      cartLoads[cart] = { resource, amount: take };
    }
  }

  // Carts keep rolling only while every bin they deliver to at the mine exit has room for a load.
  const carried = emptyStock();
  for (const load of Object.values(cartLoads)) carried[load.resource] += load.amount;
  const served = new Set<Resource>();
  for (const route of routes.values()) route.resources.forEach((resource) => served.add(resource));
  const canHaul = [...served].every(
    (resource) => mineExitIn[resource] + carried[resource] + state.mineCartCapacity <= state.mineExitCapacity,
  );

  // Surface hauling: mine exit → mine stockpile → warehouse, in the same tick as a delivery.
  const toMine = transfer(mineExitIn, state.mineStock, state.surfaceHaul, state.mineCapacity);
  const toStore = transfer(toMine.to, state.warehouse, state.surfaceHaul, state.warehouseCapacity);

  // Diggers work through the plan one tile at a time.
  let { digPlan, digProgress, playerDug, pendingSites } = state;
  let layoutVersion = state.layoutVersion + (layoutChanged ? 1 : 0);
  if (digPlan.length > 0) {
    digProgress = roundCoal(digProgress + buildingStats(state.buildings, undefined, state.techs).digSpeed);
    if (digProgress >= digTime(parseKey(digPlan[0]).row)) {
      playerDug = [...playerDug, digPlan[0]];
      digPlan = digPlan.slice(1);
      digProgress = 0;
      layoutVersion += 1;
    }
  }
  // A miner waiting on a tunnel starts as soon as the tile beside their deposit is dug.
  const dugNow = new Set(playerDug);
  const arrived = pendingSites.filter((site) => dugNow.has(tileKey(site.row, site.column)));
  if (arrived.length > 0) {
    pendingSites = pendingSites.filter((site) => !arrived.includes(site));
    const faces = new Set(sites.map((site) => tileKey(site.faceRow, site.faceColumn)));
    const starting = arrived.filter((site) => !faces.has(tileKey(site.faceRow, site.faceColumn)));
    sites = [...sites, ...starting];
    layoutVersion += 1;
    if (starting.length > 0) notice = `The tunnel is through: a miner started on the ${RESOURCE_INFO[siteResource(starting[0])].deposit.toLowerCase()}.`;
  }

  // Building crews: each job advances a second (more with master masons, and with a quick walk from
  // the warehouse); finished levels take effect at once.
  const { techs } = state;
  let { buildings, construction } = state;
  let gold = state.gold;
  if (construction.length > 0) {
    const speed = buildingStats(buildings, undefined, techs).buildSpeed;
    construction = construction.map((job) => ({ ...job, progress: Math.round((job.progress + speed * siteFactor(state, job.building)) * 100) / 100 }));
    const finished = construction.filter((job) => job.progress >= job.duration);
    if (finished.length > 0) {
      construction = construction.filter((job) => job.progress < job.duration);
      buildings = { ...buildings };
      for (const job of finished) buildings[job.building] = job.level;
      const job = finished[0];
      notice = `${BUILDING_INFO[job.building].name} reached level ${String(job.level)}; the crew is back at the campfire.`;
      if (job.building === 'houses') notice += ` The houses now sleep ${String(buildingStats(buildings, undefined, techs).beds)} peasants.`;
    }
  }
  // The clearing crew works through the first order; when it's done its rocks are gone and their
  // stone reaches the warehouse as granite.
  let { clearedRocks, clearOrders } = state;
  if (clearOrders.length > 0) {
    const [order, ...rest] = clearOrders;
    const done = Math.round((order.done + 1) * 100) / 100;
    if (done < order.work) {
      clearOrders = [{ ...order, done }, ...rest];
    } else {
      clearOrders = rest;
      clearedRocks = [...clearedRocks, ...order.tiles];
      const granite = order.tiles.reduce((sum, key) => {
        const [x, y] = key.split(',').map(Number);
        const size = startingRock(x, y);
        return sum + (size ? ROCK_INFO[size].granite : 0);
      }, 0);
      const room = Math.max(0, state.warehouseCapacity - toStore.to.granite);
      toStore.to.granite = roundCoal(toStore.to.granite + Math.min(granite, room));
      notice = `Cleared ${String(order.tiles.length)} rock${order.tiles.length === 1 ? '' : 's'}: +${String(Math.min(granite, room))} granite${granite > room ? ' (the warehouse is full)' : ''}.`;
    }
  }

  // Carts, then forges. A cart unloads at its second stop (materials onto a forge's shelf, or finished
  // pieces into the store; materials for a forge that has changed task go back to the warehouse) and is
  // free again once back at the depot. Free carts are sent where they're most needed: racks that are full,
  // then forges with nothing to work with, then any rack with pieces, then any shelf running low.
  const second = state.elapsedSeconds + 1;
  let { items, forgeTasks, wagonJobs, wagonSerial, dwellingGear } = state;
  const anyForge = FORGE_IDS.some((forge) => forgeTasks[forge]);
  const anyGear = ARMY_UNITS.some((unit) => state.items[UNIT_GEAR[unit]] >= 1 && buildings[ARMY_RECRUITING[unit].dwelling] > 0);
  if (anyForge || anyGear || wagonJobs.length > 0) {
    items = { ...items };
    forgeTasks = { ...forgeTasks };
    dwellingGear = { ...dwellingGear };
    const nextJobs: WagonJob[] = [];
    for (const job of wagonJobs) {
      let current = job;
      if (!job.dropped && second >= wagonDropAt(job)) {
        const task = isForge(job.site) ? forgeTasks[job.site] : undefined;
        const unit = DWELLING_UNIT[job.site];
        if (job.kind === 'collect') {
          for (const [item, n] of Object.entries(job.load.items) as [ItemId, number][]) items[item] += n;
        } else if (job.kind === 'deliver' && unit && state.buildings[job.site] > 0) {
          dwellingGear[unit] = (dwellingGear[unit] ?? 0) + loadUnits(job.load);
        } else if (job.kind === 'supply' && isForge(job.site) && task && task.item === job.item && state.buildings[job.site] > 0) {
          forgeTasks[job.site] = { ...task, stock: addLoad(task.stock, job.load) };
        } else {
          // Nowhere to unload it (the forge changed task, or the building is gone): back to the stores.
          for (const [resource, n] of Object.entries(job.load.resources) as [Resource, number][]) toStore.to[resource] = roundCoal(toStore.to[resource] + n);
          for (const [item, n] of Object.entries(job.load.items) as [ItemId, number][]) items[item] += n;
        }
        current = { ...job, dropped: true };
      }
      if (second < wagonBackAt(current)) nextJobs.push(current);
    }
    wagonJobs = nextJobs;

    const stats = buildingStats(buildings, workforceOf(state).staff, techs);
    let free = stats.wagons - wagonJobs.length;
    if (free > 0) {
      const send = (kind: WagonJob['kind'], site: BuildingId, load: Load, item: ItemId) => {
        const legs = wagonLegs(state, kind, site, stats.wagonSpeed);
        if (!legs) return false;
        wagonJobs = [...wagonJobs, { id: wagonSerial, kind, site, item, load, startedAt: second, legs, dropped: false }];
        wagonSerial += 1;
        free -= 1;
        return true;
      };
      const collect = (forge: ForgeId) => {
        const task = forgeTasks[forge];
        if (!task || task.output < 1) return;
        const n = Math.min(task.output, stats.wagonLoad);
        if (send('collect', forge, { resources: {}, items: { [task.item]: n } }, task.item)) forgeTasks[forge] = { ...task, output: task.output - n };
      };
      const counted = (item: ItemId) => itemsCounted({ items, forgeTasks, wagonJobs, dwellingGear }, item);
      const supply = (forge: ForgeId) => {
        const task = forgeTasks[forge];
        if (!task || counted(task.item) >= task.target) return;
        const load = supplyLoad(task, incomingTo(wagonJobs, forge), toStore.to, items, stats.wagonLoad);
        if (!load) return;
        if (send('supply', forge, load, task.item)) {
          for (const [resource, n] of Object.entries(load.resources) as [Resource, number][]) toStore.to[resource] = roundCoal(toStore.to[resource] - n);
          for (const [item, n] of Object.entries(load.items) as [ItemId, number][]) items[item] -= n;
        }
      };
      // Gear out to a dwelling: enough for its recruits waiting (`gearWanted`), counting what's there and coming.
      const gearShort = (unit: ArmyUnit) => {
        const dwelling = ARMY_RECRUITING[unit].dwelling;
        if (buildings[dwelling] < 1) return 0;
        return gearWanted(state.recruits[unit]) - Math.floor(dwellingGear[unit] ?? 0) - gearComing(wagonJobs, dwelling);
      };
      const deliver = (unit: ArmyUnit) => {
        const gear = UNIT_GEAR[unit];
        const n = Math.min(gearShort(unit), Math.floor(items[gear]), stats.wagonLoad);
        if (n < 1) return;
        if (send('deliver', ARMY_RECRUITING[unit].dwelling, { resources: {}, items: { [gear]: n } }, gear)) items[gear] -= n;
      };
      const forges = FORGE_IDS.filter((forge) => forgeTasks[forge] && buildings[forge] > 0);
      const starved = (forge: ForgeId) => {
        const task = forgeTasks[forge];
        return !!task && !task.loaded && loadUnits(shelfMissing(task)) > 0 && loadUnits(incomingTo(wagonJobs, forge)) === 0;
      };
      // In rounds, most pressing first: full racks, forges with nothing to work with, dwellings with more
      // recruits waiting than gear there or coming, any rack with pieces, any shelf running low, any
      // dwelling below what it keeps on hand.
      const forgeRound = (wanted: (forge: ForgeId) => boolean, act: (forge: ForgeId) => void) => () => {
        for (const forge of forges) if (free > 0 && wanted(forge)) act(forge);
      };
      const dwellingRound = (wanted: (unit: ArmyUnit) => boolean) => () => {
        for (const unit of ARMY_UNITS) if (free > 0 && wanted(unit)) deliver(unit);
      };
      const bare = (unit: ArmyUnit) =>
        Math.floor(state.recruits[unit]) > Math.floor(dwellingGear[unit] ?? 0) + gearComing(wagonJobs, ARMY_RECRUITING[unit].dwelling);
      const rounds = [
        forgeRound((forge) => (forgeTasks[forge]?.output ?? 0) >= FORGE_OUTPUT_CAP, collect),
        forgeRound(starved, supply),
        dwellingRound(bare),
        forgeRound((forge) => (forgeTasks[forge]?.output ?? 0) >= 1, collect),
        forgeRound(() => true, supply),
        dwellingRound((unit) => gearShort(unit) > 0),
      ];
      for (const round of rounds) round();
    }

    // Each forge works from its own shelf: it takes the next piece's materials while its rack has room and
    // the store (counting racks and carts) is below its target; finished, the piece goes onto the rack.
    const speeds = forgeSpeedsOf(state);
    for (const forge of FORGE_IDS) {
      const task = forgeTasks[forge];
      if (!task || speeds[forge] <= 0) continue;
      const { recipe } = ITEM_INFO[task.item];
      let next: ForgeTask = task;
      if (!task.loaded) {
        if (task.output >= FORGE_OUTPUT_CAP || itemsCounted({ items, forgeTasks, wagonJobs, dwellingGear }, task.item) >= task.target) continue;
        if (loadUnits(shelfMissing(task)) > 0) continue;
        next = { ...task, stock: addLoad(task.stock, { resources: recipe.resources, items: recipe.items }, -1), loaded: true, done: 0 };
      }
      const done = Math.round((next.done + speeds[forge]) * 100) / 100;
      next = done >= recipe.seconds ? { ...next, loaded: false, done: 0, output: next.output + 1 } : { ...next, done };
      forgeTasks[forge] = next;
    }
  }

  // Barges: ones that sailed off are gone once out of sight; while a berth is free, the next one sets
  // off up the river every so often (none come without dockhands), with an order drawn for it.
  let { barges, nextBargeAt, bargeSerial } = state;
  if (barges.some((barge) => barge.leftAt !== undefined && state.elapsedSeconds >= barge.leftAt + BARGE_SAIL)) {
    barges = barges.filter((barge) => barge.leftAt === undefined || state.elapsedSeconds < barge.leftAt + BARGE_SAIL);
  }
  const docks = docksOf(state);
  const taken = new Set(barges.map((barge) => barge.berth));
  const berth = BERTHS.findIndex((_, index) => !taken.has(index));
  if (docks.interval > 0 && state.elapsedSeconds >= nextBargeAt && berth >= 0 && barges.filter(isWaiting).length < MAX_BARGES) {
    const order = bargeOrder(bargeSerial, toStore.to, docks.hold, docks.tradeBonus, barges.filter(isWaiting).map((barge) => barge.resource));
    barges = [...barges, { id: bargeSerial, berth, arrivedAt: state.elapsedSeconds, ...order }];
    bargeSerial += 1;
    nextBargeAt = state.elapsedSeconds + docks.interval;
  }

  const structure = buildingStats(buildings, undefined, techs);
  // The keep collects taxes every five seconds.
  const elapsedSeconds = state.elapsedSeconds + 1;
  if (elapsedSeconds % 5 === 0) gold = Math.round((gold + structure.taxPerFiveSeconds) * 100) / 100;

  // New peasants come to the campfire while there are free beds (the houses' staff keep the beds).
  const before = { sites, pendingSites, carts: state.carts, construction, clearOrders, buildings, paused: state.paused };
  const beds = buildingStats(buildings, workforceOf({ ...before, population: state.population }).staff, techs).beds;
  let population = state.population;
  if (elapsedSeconds % structure.arrivalSeconds === 0 && population < beds) population += 1;

  // Staff the buildings from whoever isn't under orders; what each building does follows its staff.
  const workforce = workforceOf({ ...before, population });
  const fields = buildingFields(buildings, workforce.staff, techs, haulFactor(haulWalk(state)));

  // Dwellings: new recruits trickle in over each muster, and wait (up to a few musters' worth).
  const recruits = { ...state.recruits };
  for (const unit of ARMY_UNITS) {
    if (!unitAvailable({ buildings }, unit)) continue;
    const dwelling = ARMY_RECRUITING[unit].dwelling;
    const growth = unitGrowth(unit, workedLevel(dwelling, buildings[dwelling], workforce.staff[dwelling]), structure.growthBonus[unit]);
    recruits[unit] = Math.min(growth * MAX_MUSTERS_WAITING, Math.round((recruits[unit] + growth / MUSTER_SECONDS) * 1000) / 1000);
  }

  // Raids: sighted a minute out, then a battle at the gate. Nobody in command? It fights itself.
  let raidFields: Partial<GameState> = {};
  const { raid, battle } = state;
  const battleRunning = battle?.status === 'active';
  if (!raid && !battleRunning && elapsedSeconds + RAID_WARNING >= state.nextRaidAt) {
    // Raiders sized to the hold as it stands when they're sighted: a raiding party in the fields to the
    // army alone (walls can't help out there), a siege army to the army and the defences.
    const number = state.raidsFought + 1;
    const kind = raidKind(number);
    const power = holdPowerOf({ ...state, buildings, construction, population, sites, pendingSites });
    const party = raidParty(number, raidStrength(number, kind === 'field' ? power.army : power.total, state.raidsLostInARow), kind);
    raidFields = { raid: { number, arrivesAt: state.nextRaidAt, party, kind } };
    const side = raidSide(number);
    const traps = trapsFacing(state.traps, side).length;
    const soon = String(state.nextRaidAt - elapsedSeconds);
    notice =
      kind === 'field'
        ? `Raiders pillaging the fields to the ${SIDE_NAMES[side]}: ${describeParty(party)}. The army must meet them in the open in ${soon} s.`
        : `A siege army to the ${SIDE_NAMES[side]}: ${describeParty(party)}. They storm the walls in ${soon} s${traps > 0 ? `, crossing ${String(traps)} trap${traps === 1 ? '' : 's'}` : ' — no traps on that side'} (or ride out to meet them).`;
  } else if (raid && !battleRunning && elapsedSeconds >= raid.arrivesAt) {
    const stats = buildingStats(buildings, workforce.staff, techs);
    const kind = raidBattleKind(raid);
    const created = createBattle({
      kind,
      raid: raid.number,
      army: state.army,
      enemies: raid.party,
      wallHp: stats.wallHp,
      gateHp: stats.gateHp,
      towers: stats.towers,
      towerDamage: stats.towerDamage,
      attackBonus: stats.attackBonus,
      defenceBonus: stats.defenceBonus,
      traps: trapCounts(trapsFacing(state.traps, raidSide(raid.number))),
      trapPower: stats.trapPower,
      towerShots: stats.towerShots,
      wallOil: stats.wallOil,
      moatDamage: stats.moatDamage,
      moatAtGate: stats.moatAtGate,
      unitBonus: stats.unitBonus,
    });
    if (created.status !== 'active' || state.autoResolveRaids) {
      // Decided before it began (no army to defend the hold), or the auto-resolver is on: fight it out and
      // settle the raid at once (the result stays on the battlefield to look at).
      const fought = created.status === 'active' ? resolveBattle(created) : created;
      const settled = settleBattle({ ...state, gold, warehouse: toStore.to, elapsedSeconds, battleArmy: state.army }, fought);
      raidFields = { ...settled, battle: fought, battleArmy: state.army, battleCommanded: false };
      notice = settled.notice;
    } else {
      raidFields = {
        battle: created,
        battleArmy: state.army,
        battleCommanded: false,
        battleDeadline: elapsedSeconds + RAID_AUTO_AFTER,
      };
      notice =
        kind === 'field'
          ? `The armies meet in the field! Take command, or it's fought without you in ${String(RAID_AUTO_AFTER)} s.`
          : `Raiders at the gate! Take command, or the defence fights on its own in ${String(RAID_AUTO_AFTER)} s.`;
    }
  } else if (battle && battleRunning && !state.battleCommanded && elapsedSeconds >= state.battleDeadline) {
    const settled = settleBattle({ ...state, gold, warehouse: toStore.to, elapsedSeconds }, resolveBattle(battle));
    raidFields = { ...settled, battle: null };
    notice = settled.notice;
  }

  return {
    ...fields,
    population,
    construction,
    gold,
    elapsedSeconds,
    digPlan,
    digProgress,
    playerDug,
    pendingSites,
    layoutVersion,
    sites,
    clearedRocks,
    clearOrders,
    items,
    forgeTasks,
    wagonJobs,
    wagonSerial,
    dwellingGear,
    barges,
    nextBargeAt,
    bargeSerial,
    depositMined,
    vein,
    mineExit: toMine.from,
    mineStock: toStore.from,
    warehouse: toStore.to,
    lastFlow: { mined, toMineExit, toMineStockpile: toMine.moved, toWarehouse: toStore.moved },
    haulTime: canHaul ? state.haulTime + 1 : state.haulTime,
    haulAppliedTime: to,
    cartLoads,
    recruits,
    ...raidFields,
    notice,
  };
}
