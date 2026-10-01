import { create } from 'zustand';

export const FIXED_TICK_MS = 1000;
export const COAL_REQUEST_SIZE = 20;
export const COAL_REQUEST_REWARD = 32;

type TickFlow = {
  mined: number;
  toMineExit: number;
  toMineStockpile: number;
  toWarehouse: number;
};

type GameState = {
  elapsedSeconds: number;
  depth: number;
  gold: number;
  miners: number;
  minerRate: number;
  pickaxeLevel: number;
  veinCoal: number;
  mineExitCoal: number;
  mineCoal: number;
  warehouseCoal: number;
  mineCartCapacity: number;
  mineExitCapacity: number;
  warehouseCartCapacity: number;
  veinCapacity: number;
  mineCapacity: number;
  warehouseCapacity: number;
  huts: number;
  warehouseUpgrades: number;
  lastFlow: TickFlow;
  notice: string;
  tick: () => void;
  fulfillCoalRequest: () => void;
  buildMinerHut: () => void;
  forgePickaxe: () => void;
  expandWarehouse: () => void;
  digDeeper: () => void;
};

const roundCoal = (amount: number) => Math.round(amount * 10) / 10;

export function getDepthCost(depth: number) {
  return Math.round(100 * 1.6 ** (depth - 1));
}

export const useGameStore = create<GameState>((set) => ({
  elapsedSeconds: 0,
  depth: 1,
  gold: 120,
  miners: 2,
  minerRate: 0.5,
  pickaxeLevel: 1,
  veinCoal: 0,
  mineCoal: 0,
  warehouseCoal: 16,
  mineCartCapacity: 5,
  warehouseCartCapacity: 10,
  veinCapacity: 50,
  mineCapacity: 50,
  warehouseCapacity: 100,
  huts: 1,
  warehouseUpgrades: 0,
  mineExitCoal: 0,
  mineExitCapacity: 50,
  lastFlow: { mined: 0, toMineExit: 0, toMineStockpile: 0, toWarehouse: 0 },
  notice: 'Two miners are already working the first seam.',

  tick: () => set((state) => {
    const mined = Math.min(
      Math.max(0, state.veinCapacity - state.veinCoal),
      state.miners * state.minerRate,
    );
    const fullVein = roundCoal(state.veinCoal + mined);
    const toMineExit = Math.min(
      fullVein,
      state.mineCartCapacity,
      Math.max(0, state.mineExitCapacity - state.mineExitCoal),
    );
    const veinCoal = roundCoal(fullVein - toMineExit);
    const fullMineExit = roundCoal(state.mineExitCoal + toMineExit);
    const toMineStockpile = Math.min(
      fullMineExit,
      state.mineCartCapacity,
      Math.max(0, state.mineCapacity - state.mineCoal),
    );
    const mineExitCoal = roundCoal(fullMineExit - toMineStockpile);
    const fullMineStockpile = roundCoal(state.mineCoal + toMineStockpile);
    const toWarehouse = Math.min(
      fullMineStockpile,
      state.warehouseCartCapacity,
      Math.max(0, state.warehouseCapacity - state.warehouseCoal),
    );

    return {
      elapsedSeconds: state.elapsedSeconds + 1,
      veinCoal,
      mineExitCoal,
      mineCoal: roundCoal(fullMineStockpile - toWarehouse),
      warehouseCoal: roundCoal(state.warehouseCoal + toWarehouse),
      lastFlow: { mined, toMineExit, toMineStockpile, toWarehouse },
    };
  }),

  fulfillCoalRequest: () => set((state) => {
    if (state.warehouseCoal < COAL_REQUEST_SIZE) {
      return { notice: `The request needs ${String(COAL_REQUEST_SIZE)} coal in the warehouse.` };
    }
    return {
      warehouseCoal: roundCoal(state.warehouseCoal - COAL_REQUEST_SIZE),
      gold: state.gold + COAL_REQUEST_REWARD,
      notice: `Delivered ${String(COAL_REQUEST_SIZE)} coal. The trading post paid ${String(COAL_REQUEST_REWARD)} gold.`,
    };
  }),

  buildMinerHut: () => set((state) => {
    const coalCost = 30;
    const goldCost = 20;
    if (state.warehouseCoal < coalCost || state.gold < goldCost) {
      return { notice: 'A miner hut costs 30 coal and 20 gold.' };
    }
    return {
      warehouseCoal: roundCoal(state.warehouseCoal - coalCost),
      gold: state.gold - goldCost,
      miners: state.miners + 1,
      huts: state.huts + 1,
      notice: 'A new miner joined the shift. The seam is producing faster.',
    };
  }),

  forgePickaxe: () => set((state) => {
    const coalCost = 20;
    const goldCost = 35;
    if (state.pickaxeLevel >= 4) return { notice: 'Your pickaxes are fully forged.' };
    if (state.warehouseCoal < coalCost || state.gold < goldCost) {
      return { notice: 'Forging better picks costs 20 coal and 35 gold.' };
    }
    return {
      warehouseCoal: roundCoal(state.warehouseCoal - coalCost),
      gold: state.gold - goldCost,
      pickaxeLevel: state.pickaxeLevel + 1,
      minerRate: roundCoal(state.minerRate + 0.25),
      notice: 'The new pickaxes increase every miner’s coal rate by 0.25 per second.',
    };
  }),

  expandWarehouse: () => set((state) => {
    const coalCost = 40;
    const goldCost = 30;
    if (state.warehouseCoal < coalCost || state.gold < goldCost) {
      return { notice: 'Warehouse expansion costs 40 coal and 30 gold.' };
    }
    return {
      warehouseCoal: roundCoal(state.warehouseCoal - coalCost),
      gold: state.gold - goldCost,
      warehouseCapacity: state.warehouseCapacity + 50,
      warehouseCartCapacity: state.warehouseCartCapacity + 5,
      warehouseUpgrades: state.warehouseUpgrades + 1,
      notice: 'The warehouse is larger, and the surface cart hauls 5 more coal per trip.',
    };
  }),

  digDeeper: () => set((state) => {
    const goldCost = getDepthCost(state.depth);
    if (state.gold < goldCost) {
      return { notice: `The next shaft costs ${String(goldCost)} gold.` };
    }
    return {
      depth: state.depth + 1,
      gold: state.gold - goldCost,
      notice: `The miners opened shaft ${String(state.depth + 1)}. The coal line is running there now.`,
    };
  }),
}));

let simulationTimer: ReturnType<typeof setInterval> | undefined;

export function startSimulation() {
  if (simulationTimer) return () => {};

  simulationTimer = setInterval(() => {
    useGameStore.getState().tick();
  }, FIXED_TICK_MS);

  return () => {
    if (simulationTimer) clearInterval(simulationTimer);
    simulationTimer = undefined;
  };
}