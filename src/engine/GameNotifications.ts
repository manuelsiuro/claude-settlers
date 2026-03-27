import { BuildingType } from '../game/BuildingType';
import { BUILDING_DEFINITIONS } from '../game/BuildingType';
import { RESOURCE_PROPERTIES } from '../game/ResourceType';
import type { ResourceType } from '../game/ResourceType';
import type { Building } from '../game/Building';
import { HexGrid } from '../game/HexGrid';
import { MapRenderer } from './MapRenderer';
import { ParticleEffect } from './ParticleSystem';
import type { ParticleSystem } from './ParticleSystem';
import type { ProductionManager } from '../game/ProductionManager';
import type { ToolProductionManager } from '../game/ToolProductionManager';
import type { VictoryManager } from '../game/VictoryManager';
import type { ConstructionManager } from '../game/ConstructionManager';
import type { UnitManager } from '../game/UnitManager';
import type { GameState } from '../game/GameState';
import type { TerritoryManager } from '../game/TerritoryManager';
import type { KnightManager } from '../game/KnightManager';
import type { CombatManager } from '../game/CombatManager';
import type { AttackManager } from '../game/AttackManager';
import type { GeologistManager } from '../game/GeologistManager';
import type { EconomyTracker } from '../game/EconomyTracker';
import type { MoraleManager } from '../game/MoraleManager';
import type { FeedingManager } from '../game/FeedingManager';
import type { PopulationManager } from '../game/PopulationManager';
import type { BuildingAnimator } from './BuildingAnimator';
import type { CombatRenderer } from './CombatRenderer';
import type { DepositRenderer } from './DepositRenderer';
import type { UpgradeManager } from '../game/UpgradeManager';
import { BUILDING_TYPE_UPGRADE_AXIS } from '../game/UpgradeManager';
import type { BuildingRenderer } from './BuildingRenderer';
import type { AIPlayer } from '../game/AIPlayer';

export type GameNotificationType =
  | 'building_complete'
  | 'knight_recruited'
  | 'under_attack'
  | 'building_captured'
  | 'building_destroyed'
  | 'combat_result'
  | 'tool_waiting'
  | 'population_cap'
  | 'food_warning'
  | 'victory'
  | 'defeat';

export interface GameNotification {
  type: GameNotificationType;
  message: string;
}

export interface WireCallbacksParams {
  productionManager: ProductionManager;
  toolProductionManager: ToolProductionManager;
  victoryManager: VictoryManager;
  constructionManager: ConstructionManager;
  unitManager: UnitManager;
  gameState: GameState;
  territoryManager: TerritoryManager;
  knightManager: KnightManager;
  combatManager: CombatManager;
  attackManager: AttackManager;
  geologistManager: GeologistManager;
  economyTracker: EconomyTracker;
  moraleManager: MoraleManager;
  feedingManager: FeedingManager;
  populationManager: PopulationManager;
  buildingAnimator: BuildingAnimator;
  combatRenderer: CombatRenderer;
  depositRenderer: DepositRenderer;
  particleSystem: ParticleSystem;
  mapRenderer: MapRenderer;
  upgradeManager: UpgradeManager;
  buildingRenderer: BuildingRenderer;
  grid: HexGrid;
  humanPlayerId: number;
  aiPlayers: AIPlayer[];
  getNotification: () => ((notification: GameNotification) => void) | null;
}

export function wireGameCallbacks(params: WireCallbacksParams): void {
  const {
    productionManager,
    toolProductionManager,
    victoryManager,
    constructionManager,
    unitManager,
    gameState,
    territoryManager,
    knightManager,
    combatManager,
    attackManager,
    geologistManager,
    economyTracker,
    moraleManager,
    feedingManager,
    populationManager,
    buildingAnimator,
    combatRenderer,
    depositRenderer,
    particleSystem,
    mapRenderer,
    upgradeManager,
    buildingRenderer,
    grid,
    humanPlayerId,
    aiPlayers,
    getNotification,
  } = params;

  // Wire food consumption to economy tracker
  feedingManager.onFoodConsumed = (resource: ResourceType, amount: number) => {
    economyTracker.recordConsumption(resource, amount);
  };

  // Wire production events to economy tracker and morale system
  const trackProduction = (
    inputs: { resource: ResourceType; amount: number }[],
    outputs: { resource: ResourceType; amount: number }[],
    building?: Building,
  ) => {
    for (const input of inputs) {
      economyTracker.recordConsumption(input.resource, input.amount);
    }
    for (const output of outputs) {
      economyTracker.recordProduction(output.resource, output.amount);
    }
    // InnTavern consumes drinks and luxury goods -> record for morale
    if (building?.type === BuildingType.InnTavern) {
      for (const input of inputs) {
        if (RESOURCE_PROPERTIES[input.resource].isDrink) {
          moraleManager.recordDrinkServed(building.playerId, input.resource);
        }
        if (RESOURCE_PROPERTIES[input.resource].isLuxury) {
          moraleManager.recordLuxuryServed(building.playerId, input.resource);
        }
      }
    }
    // Track luxury goods production for morale (non-InnTavern buildings producing luxuries)
    if (building) {
      for (const output of outputs) {
        if (RESOURCE_PROPERTIES[output.resource].isLuxury) {
          moraleManager.recordLuxuryServed(building.playerId, output.resource);
        }
      }
    }
  };
  productionManager.onProductionComplete = trackProduction;
  toolProductionManager.onProductionComplete = trackProduction;

  victoryManager.onVictory = (result) => {
    const conditionLabels: Record<string, string> = {
      elimination: 'All enemies defeated',
      domination: 'Territorial domination',
      economic: 'Economic supremacy',
      timed: 'Time limit reached',
      peaceful: 'Trade empire',
    };
    const label = conditionLabels[result.condition] ?? result.condition;
    if (result.winnerId === humanPlayerId) {
      getNotification()?.({ type: 'victory', message: `Victory! ${label}!` });
    } else {
      getNotification()?.({ type: 'defeat', message: `Defeat! Player ${result.winnerId} achieved ${label}` });
    }
  };

  victoryManager.onDefeat = (result) => {
    if (result.playerId === humanPlayerId) {
      getNotification()?.({ type: 'defeat', message: 'Your Castle has been destroyed! Defeat!' });
    }
  };

  constructionManager.onBuildingActivated = (building) => {
    territoryManager.markDirty();
    buildingAnimator.onBuildingActivated(building.id);
    // Completion particle burst
    const { x, z } = HexGrid.hexToWorld(building.coord.q, building.coord.r);
    const tile = grid.getTile(building.coord.q, building.coord.r);
    const y = tile ? MapRenderer.getTileY(tile) : 0;
    particleSystem.emitBurst(x, y + 0.3, z, ParticleEffect.CompletionFlash, 20);
    // Initialize tool queue for dynamic-output buildings (e.g., Toolmaker)
    toolProductionManager.initializeQueue(building);
    if (building.playerId === humanPlayerId) {
      const def = BUILDING_DEFINITIONS[building.type];
      getNotification()?.({ type: 'building_complete', message: `${def.label} construction complete` });
    }
  };

  // Wire tool-waiting notifications
  const notifyToolWaiting = (building: Building) => {
    if (building.playerId !== humanPlayerId) return;
    if (!building.waitingForTool) return;
    const def = BUILDING_DEFINITIONS[building.type];
    const toolLabel = RESOURCE_PROPERTIES[building.waitingForTool].label;
    getNotification()?.({ type: 'tool_waiting', message: `${def.label} needs a ${toolLabel}` });
  };
  unitManager.onBuildingWaitingForTool = notifyToolWaiting;
  constructionManager.onBuildingWaitingForTool = notifyToolWaiting;

  unitManager.onPopulationCapReached = (playerId: number) => {
    if (playerId !== humanPlayerId) return;
    getNotification()?.({ type: 'population_cap', message: 'Population at capacity — build more houses' });
  };

  gameState.territoryCheck = (q, r, pId) => territoryManager.isOwnedBy(q, r, pId);

  gameState.onBuildingRemoved = (building) => {
    territoryManager.markDirty();
    if (building.playerId === humanPlayerId) {
      const def = BUILDING_DEFINITIONS[building.type];
      getNotification()?.({ type: 'building_destroyed', message: `${def.label} destroyed` });
      // Check if population now exceeds capacity after housing destroyed
      if (def.populationCapacity > 0 && populationManager.getUsageRatio(building.playerId) > 1) {
        getNotification()?.({ type: 'population_cap', message: 'Population exceeds capacity! Build more houses' });
      }
    }
  };

  knightManager.onKnightRecruited = (building) => {
    territoryManager.markDirty();
    if (building.playerId === humanPlayerId) {
      const def = BUILDING_DEFINITIONS[building.type];
      getNotification()?.({ type: 'knight_recruited', message: `Knight recruited at ${def.label}` });
    }
  };

  combatManager.onDuelResolved = (result) => {
    if (result.winnerPlayerId === humanPlayerId) {
      const winner = gameState.getUnit(result.winnerId);
      const msg = result.rankUp && winner
        ? `Knight victorious — promoted to rank ${winner.knightRank}!`
        : 'Knight won the duel!';
      getNotification()?.({ type: 'combat_result', message: msg });
    } else if (result.loserPlayerId === humanPlayerId) {
      getNotification()?.({ type: 'combat_result', message: 'Your knight was defeated' });
    }
    // NPC-vs-NPC duels: no notification for human player
  };

  attackManager.onBuildingUnderAttack = (building) => {
    combatRenderer.showAttackWarning(building);
    if (building.playerId === humanPlayerId) {
      const def = BUILDING_DEFINITIONS[building.type];
      getNotification()?.({ type: 'under_attack', message: `${def.label} is under attack!` });
    }
    // Notify AI player of the attack so it can respond
    for (const ai of aiPlayers) {
      if (ai.getPlayerId() === building.playerId) {
        ai.onUnderAttack(building.id);
      }
    }
  };

  attackManager.onBuildingCaptured = (building, byPlayerId, oldPlayerId) => {
    combatRenderer.showCaptureBanner(building, byPlayerId);
    const def = BUILDING_DEFINITIONS[building.type];
    if (byPlayerId === humanPlayerId) {
      getNotification()?.({ type: 'building_captured', message: `${def.label} captured!` });
    } else if (oldPlayerId === humanPlayerId) {
      getNotification()?.({ type: 'building_captured', message: `Enemy captured your ${def.label}!` });
    }
  };

  // Wire geologist deposit reveal -> deposit renderer
  geologistManager.onDepositRevealed = (coord, deposit) => {
    depositRenderer.addMarker(coord, deposit.resource, grid);
    const resourceLabels: Record<string, string> = {
      iron_ore: 'Iron',
      coal_ore: 'Coal',
      gold_ore: 'Gold',
    };
    const label = resourceLabels[deposit.resource] ?? deposit.resource;
    getNotification()?.({ type: 'building_complete', message: `${label} deposit discovered!` });
  };

  // Wire mine placement -> remove deposit marker + rebuild map
  gameState.onMinePlaced = (coord) => {
    depositRenderer.removeMarker(coord);
    mapRenderer.rebuild();
  };

  // Wire upgrade completion -> model swap for building-type upgrades + particles
  upgradeManager.onUpgradeComplete = (building, axis) => {
    if (axis === BUILDING_TYPE_UPGRADE_AXIS) {
      buildingRenderer.swapBuildingModel(building, grid);
      buildingAnimator.onBuildingActivated(building.id);
      const { x, z } = HexGrid.hexToWorld(building.coord.q, building.coord.r);
      const tile = grid.getTile(building.coord.q, building.coord.r);
      const y = tile ? MapRenderer.getTileY(tile) : 0;
      particleSystem.emitBurst(x, y + 0.3, z, ParticleEffect.CompletionFlash, 20);
      if (building.playerId === humanPlayerId) {
        const def = BUILDING_DEFINITIONS[building.type];
        getNotification()?.({ type: 'building_complete', message: `House upgraded to ${def.label}!` });
      }
    }
  };
}
