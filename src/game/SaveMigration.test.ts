import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { loadFromLocalStorage } from './SaveLoad';

// Mock localStorage for Node environment
const store: Record<string, string> = {};
beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
      },
      writable: true,
    });
  }
});

afterEach(() => {
  for (const key of Object.keys(store)) delete store[key];
});

describe('Save Migration', () => {
  it('rejects saves older than v3', () => {
    localStorage.setItem('feudal_realm_save', JSON.stringify({ version: 2 }));
    expect(loadFromLocalStorage()).toBeNull();
    localStorage.removeItem('feudal_realm_save');
  });

  it('migrates v7 save to current version (adds tool fields)', () => {
    const oldSave = {
      version: 7,
      timestamp: Date.now(),
      config: { seed: 1, mapSize: 24, numPlayers: 1, difficulty: 'normal', scenario: 'default' },
      nextBuildingId: 1,
      nextUnitId: 1,
      nextFlagId: 1,
      nextRoadId: 1,
      buildings: [{ id: 'b1', type: 'castle', inputInventory: {}, outputInventory: {}, constructionDelivered: {} }],
      units: [{ id: 'u1', type: 'knight' }],
      workerByBuilding: [],
      flags: [],
      roads: [],
      constructionManager: { builderAssignments: [], deliveryCooldown: 0 },
      transporterManager: { transporterStates: [], spawnCooldown: 0 },
      unitManager: { spawnCooldown: 0 },
      combatManager: { combatWins: [] },
      attackManager: { attacks: [] },
      territoryManager: { territory: [], version: 0 },
      logisticsManager: { routingCooldown: 0 },
      knightManager: { recruitCooldown: 0 },
      victoryManager: { eliminatedPlayers: [], gameOver: false, result: null, checkCooldown: 0 },
      terrainOverrides: [],
      deposits: { revealed: [], claimed: [] },
      aiPlayers: [],
      frustum: 10,
      cameraPosition: { x: 0, y: 0, z: 0 },
      cameraTarget: { x: 0, y: 0, z: 0 },
    };

    localStorage.setItem('feudal_realm_save', JSON.stringify(oldSave));
    const loaded = loadFromLocalStorage();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(15); // migrated to current
    // Check that migration added fields
    const building = loaded!.buildings[0] as Record<string, unknown>;
    expect(building.waitingForTool).toBe(null);
    expect(building.hp).toBe(1.0);
    const unit = loaded!.units[0] as Record<string, unknown>;
    expect(unit.carriedTool).toBe(null);
    expect(unit.satiation).toBe(1.0);
    // Check diplomacy was added
    expect(loaded!.diplomacyManager).toBeDefined();

    localStorage.removeItem('feudal_realm_save');
  });

  it('loads current version saves without modification', () => {
    const save = {
      version: 15,
      timestamp: Date.now(),
      config: { seed: 1, mapSize: 24, numPlayers: 1, difficulty: 'normal', scenario: 'default' },
      nextBuildingId: 1,
      nextUnitId: 1,
      nextFlagId: 1,
      nextRoadId: 1,
      buildings: [],
      units: [],
      workerByBuilding: [],
      flags: [],
      roads: [],
      constructionManager: { builderAssignments: [], deliveryCooldown: 0 },
      transporterManager: { transporterStates: [], spawnCooldown: 0 },
      unitManager: { spawnCooldown: 0 },
      combatManager: { combatWins: [] },
      attackManager: { attacks: [] },
      territoryManager: { territory: [], version: 0 },
      logisticsManager: { routingCooldown: 0 },
      knightManager: { recruitCooldown: 0 },
      victoryManager: { eliminatedPlayers: [], gameOver: false, result: null, checkCooldown: 0 },
      terrainOverrides: [],
      deposits: { revealed: [], claimed: [] },
      diplomacyManager: { treaties: [] },
      aiPlayers: [],
      frustum: 10,
      cameraPosition: { x: 0, y: 0, z: 0 },
      cameraTarget: { x: 0, y: 0, z: 0 },
    };

    localStorage.setItem('feudal_realm_save', JSON.stringify(save));
    const loaded = loadFromLocalStorage();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(15);
    localStorage.removeItem('feudal_realm_save');
  });
});
