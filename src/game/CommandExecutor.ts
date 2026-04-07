/**
 * Single entry point for all game state mutations.
 *
 * In single-player, commands execute immediately.
 * In multiplayer (Phase 2), commands arrive from the relay server
 * and execute during lockstep turns.
 *
 * The executor delegates to existing manager methods — it does NOT
 * replace them. All pre-existing logic (validation, side effects)
 * stays in the managers.
 */

import type { GameState } from './GameState';
import type { RoadNetwork } from './RoadNetwork';
import type { HexGrid } from './HexGrid';
import type { TerritoryManager } from './TerritoryManager';
import type { AttackManager } from './AttackManager';
import type { UpgradeManager } from './UpgradeManager';
import type { ToolProductionManager } from './ToolProductionManager';
import type { MarketplaceManager } from './MarketplaceManager';
import type { DiplomacyManager } from './DiplomacyManager';
import type { LogisticsManager } from './LogisticsManager';
import { autoConnectBuilding } from './AutoRoad';
import type {
  GameCommand,
  CommandResult,
  PlaceBuildingCommand,
  DemolishBuildingCommand,
  ToggleBuildingPauseCommand,
  StartUpgradeCommand,
  StartBuildingUpgradeCommand,
  PlaceFlagCommand,
  ConnectFlagsCommand,
  DemolishFlagCommand,
  DemolishRoadCommand,
  UpgradeRoadCommand,
  AttackBuildingCommand,
  SetGoodsDistributionCommand,
  SetToolQueueCommand,
  MarketplaceTradeCommand,
  AcceptDealCommand,
  AddAutoTradeRuleCommand,
  UpdateAutoTradeRuleCommand,
  RemoveAutoTradeRuleCommand,
  SetTreatyCommand,
  AutoConnectBuildingCommand,
} from './Command';

export interface CommandExecutorDeps {
  gameState: GameState;
  roadNetwork: RoadNetwork;
  grid: HexGrid;
  territoryManager: TerritoryManager;
  attackManager: AttackManager;
  upgradeManager: UpgradeManager;
  toolProductionManager: ToolProductionManager;
  marketplaceManager: MarketplaceManager;
  diplomacyManager: DiplomacyManager;
  logisticsManager: LogisticsManager;
}

export class CommandExecutor {
  private deps: CommandExecutorDeps;

  /** Current game time in seconds (set by Game before executing commands) */
  gameTime = 0;

  constructor(deps: CommandExecutorDeps) {
    this.deps = deps;
  }

  execute(command: GameCommand): CommandResult {
    switch (command.type) {
      case 'PlaceBuilding': return this.placeBuilding(command);
      case 'DemolishBuilding': return this.demolishBuilding(command);
      case 'ToggleBuildingPause': return this.toggleBuildingPause(command);
      case 'StartUpgrade': return this.startUpgrade(command);
      case 'StartBuildingUpgrade': return this.startBuildingUpgrade(command);
      case 'PlaceFlag': return this.placeFlag(command);
      case 'ConnectFlags': return this.connectFlags(command);
      case 'DemolishFlag': return this.demolishFlag(command);
      case 'DemolishRoad': return this.demolishRoad(command);
      case 'UpgradeRoad': return this.upgradeRoad(command);
      case 'AttackBuilding': return this.attackBuilding(command);
      case 'SetGoodsDistribution': return this.setGoodsDistribution(command);
      case 'SetToolQueue': return this.setToolQueue(command);
      case 'MarketplaceTrade': return this.marketplaceTrade(command);
      case 'AcceptDeal': return this.acceptDeal(command);
      case 'AddAutoTradeRule': return this.addAutoTradeRule(command);
      case 'UpdateAutoTradeRule': return this.updateAutoTradeRule(command);
      case 'RemoveAutoTradeRule': return this.removeAutoTradeRule(command);
      case 'SetTreaty': return this.setTreaty(command);
      case 'AutoConnectBuilding': return this.autoConnectBuilding(command);
      default: return { success: false, error: `Unknown command type: ${(command as GameCommand).type}` };
    }
  }

  // ── Building ────────────────────────────────────────────────────────────

  private placeBuilding(cmd: PlaceBuildingCommand): CommandResult {
    const result = this.deps.gameState.placeBuilding(cmd.buildingType, cmd.coord, cmd.playerId);
    if (!result.ok) return { success: false, error: result.error };
    this.deps.territoryManager.markDirty();
    return { success: true, data: result.building };
  }

  private demolishBuilding(cmd: DemolishBuildingCommand): CommandResult {
    const refund = this.deps.gameState.demolishBuilding(cmd.buildingId);
    this.deps.territoryManager.markDirty();
    return { success: true, data: refund };
  }

  private toggleBuildingPause(cmd: ToggleBuildingPauseCommand): CommandResult {
    const building = this.deps.gameState.getBuilding(cmd.buildingId);
    if (!building) return { success: false, error: 'Building not found' };
    building.productionPaused = !building.productionPaused;
    return { success: true };
  }

  private startUpgrade(cmd: StartUpgradeCommand): CommandResult {
    const ok = this.deps.upgradeManager.startUpgrade(cmd.buildingId, cmd.upgradeAxis);
    if (!ok) return { success: false, error: 'Cannot start upgrade' };
    return { success: true };
  }

  private startBuildingUpgrade(cmd: StartBuildingUpgradeCommand): CommandResult {
    const ok = this.deps.upgradeManager.startBuildingUpgrade(cmd.buildingId);
    if (!ok) return { success: false, error: 'Cannot start building upgrade' };
    return { success: true };
  }

  // ── Roads & Flags ───────────────────────────────────────────────────────

  private placeFlag(cmd: PlaceFlagCommand): CommandResult {
    const flag = this.deps.roadNetwork.placeFlag(cmd.coord, cmd.playerId);
    if (!flag) return { success: false, error: 'Cannot place flag' };
    return { success: true, data: flag };
  }

  private connectFlags(cmd: ConnectFlagsCommand): CommandResult {
    const road = this.deps.roadNetwork.connectFlags(cmd.flagAId, cmd.flagBId);
    if (!road) return { success: false, error: 'Cannot connect flags' };
    return { success: true, data: road };
  }

  private demolishFlag(cmd: DemolishFlagCommand): CommandResult {
    const ok = this.deps.roadNetwork.removeFlag(cmd.flagId);
    if (!ok) return { success: false, error: 'Cannot remove flag' };
    return { success: true };
  }

  private demolishRoad(cmd: DemolishRoadCommand): CommandResult {
    const ok = this.deps.roadNetwork.removeRoad(cmd.roadId);
    if (!ok) return { success: false, error: 'Cannot remove road' };
    return { success: true };
  }

  private upgradeRoad(cmd: UpgradeRoadCommand): CommandResult {
    const newQuality = this.deps.roadNetwork.upgradeRoad(cmd.roadId, cmd.targetQuality);
    if (newQuality < 0) return { success: false, error: 'Cannot upgrade road' };
    return { success: true, data: newQuality };
  }

  // ── Military ────────────────────────────────────────────────────────────

  private attackBuilding(cmd: AttackBuildingCommand): CommandResult {
    const ok = this.deps.attackManager.orderAttack(cmd.unitId, cmd.targetBuildingId);
    if (!ok) return { success: false, error: 'Cannot order attack' };
    return { success: true };
  }

  // ── Logistics ───────────────────────────────────────────────────────────

  private setGoodsDistribution(cmd: SetGoodsDistributionCommand): CommandResult {
    this.deps.logisticsManager.setDistributionSettings(cmd.settings);
    return { success: true };
  }

  private setToolQueue(cmd: SetToolQueueCommand): CommandResult {
    this.deps.toolProductionManager.adjustQueue(cmd.buildingId, cmd.toolType, cmd.delta);
    return { success: true };
  }

  // ── Marketplace ─────────────────────────────────────────────────────────

  private marketplaceTrade(cmd: MarketplaceTradeCommand): CommandResult {
    const result = this.deps.marketplaceManager.executeTrade(
      cmd.playerId, cmd.sellResource, cmd.sellAmount, cmd.buyResource, cmd.venue,
    );
    if (!result.success) return { success: false, error: result.error ?? 'Trade failed' };
    return { success: true, data: result };
  }

  private acceptDeal(cmd: AcceptDealCommand): CommandResult {
    const result = this.deps.marketplaceManager.acceptDeal(cmd.playerId, cmd.dealId);
    if (!result.success) return { success: false, error: result.error ?? 'Deal failed' };
    return { success: true, data: result };
  }

  private addAutoTradeRule(cmd: AddAutoTradeRuleCommand): CommandResult {
    const ok = this.deps.marketplaceManager.addAutoTradeRule(cmd.playerId, cmd.rule);
    if (!ok) return { success: false, error: 'Cannot add auto-trade rule' };
    return { success: true };
  }

  private updateAutoTradeRule(cmd: UpdateAutoTradeRuleCommand): CommandResult {
    this.deps.marketplaceManager.updateAutoTradeRule(cmd.playerId, cmd.ruleIndex, cmd.updates);
    return { success: true };
  }

  private removeAutoTradeRule(cmd: RemoveAutoTradeRuleCommand): CommandResult {
    this.deps.marketplaceManager.removeAutoTradeRule(cmd.playerId, cmd.ruleIndex);
    return { success: true };
  }

  // ── Diplomacy ───────────────────────────────────────────────────────────

  private setTreaty(cmd: SetTreatyCommand): CommandResult {
    this.deps.diplomacyManager.setTreaty(cmd.playerId, cmd.targetPlayerId, cmd.treatyType, this.gameTime);
    return { success: true };
  }

  // ── AI Convenience ──────────────────────────────────────────────────────

  private autoConnectBuilding(cmd: AutoConnectBuildingCommand): CommandResult {
    const ok = autoConnectBuilding(cmd.coord, cmd.playerId, this.deps.roadNetwork, this.deps.grid);
    if (!ok) return { success: false, error: 'Auto-connect failed' };
    return { success: true };
  }
}
