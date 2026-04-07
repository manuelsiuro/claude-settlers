/**
 * Command types for deterministic game state mutations.
 *
 * All player and AI actions that modify game state go through commands.
 * In single-player (Phase 1), commands execute immediately via CommandExecutor.
 * In multiplayer (Phase 2), commands are collected per turn, sent to the relay
 * server, and broadcast to all clients for synchronized execution.
 *
 * Commands must carry only serializable primitives — no references to live objects.
 */

import type { BuildingType } from './BuildingType';
import type { ResourceType } from './ResourceType';
import type { UpgradeAxis } from './BuildingUpgrade';
import type { TreatyType } from './DiplomacyManager';
import type { HexCoord } from './HexGrid';
import type { GoodsDistributionSettings } from './GoodsDistribution';
import type { AutoTradeRule } from './marketplace/types';

// ── Base types ──────────────────────────────────────────────────────────

export interface BaseCommand {
  type: string;
  playerId: number;
}

export type CommandResult =
  | { success: true; data?: unknown }
  | { success: false; error: string };

// ── Building commands ───────────────────────────────────────────────────

export interface PlaceBuildingCommand extends BaseCommand {
  type: 'PlaceBuilding';
  buildingType: BuildingType;
  coord: HexCoord;
}

export interface DemolishBuildingCommand extends BaseCommand {
  type: 'DemolishBuilding';
  buildingId: string;
}

export interface ToggleBuildingPauseCommand extends BaseCommand {
  type: 'ToggleBuildingPause';
  buildingId: string;
}

export interface StartUpgradeCommand extends BaseCommand {
  type: 'StartUpgrade';
  buildingId: string;
  upgradeAxis: UpgradeAxis;
}

export interface StartBuildingUpgradeCommand extends BaseCommand {
  type: 'StartBuildingUpgrade';
  buildingId: string;
}

// ── Road & flag commands ────────────────────────────────────────────────

export interface PlaceFlagCommand extends BaseCommand {
  type: 'PlaceFlag';
  coord: HexCoord;
}

export interface ConnectFlagsCommand extends BaseCommand {
  type: 'ConnectFlags';
  flagAId: string;
  flagBId: string;
}

export interface DemolishFlagCommand extends BaseCommand {
  type: 'DemolishFlag';
  flagId: string;
}

export interface DemolishRoadCommand extends BaseCommand {
  type: 'DemolishRoad';
  roadId: string;
}

export interface UpgradeRoadCommand extends BaseCommand {
  type: 'UpgradeRoad';
  roadId: string;
  targetQuality: number;
}

// ── Military commands ───────────────────────────────────────────────────

export interface AttackBuildingCommand extends BaseCommand {
  type: 'AttackBuilding';
  unitId: string;
  targetBuildingId: string;
}

// ── Logistics commands ──────────────────────────────────────────────────

export interface SetGoodsDistributionCommand extends BaseCommand {
  type: 'SetGoodsDistribution';
  settings: GoodsDistributionSettings;
}

export interface SetToolQueueCommand extends BaseCommand {
  type: 'SetToolQueue';
  buildingId: string;
  toolType: ResourceType;
  delta: number;
}

// ── Marketplace commands ────────────────────────────────────────────────

export interface MarketplaceTradeCommand extends BaseCommand {
  type: 'MarketplaceTrade';
  sellResource: ResourceType;
  sellAmount: number;
  buyResource: ResourceType;
  venue: 'market' | 'castle';
}

export interface AcceptDealCommand extends BaseCommand {
  type: 'AcceptDeal';
  dealId: string;
}

export interface AddAutoTradeRuleCommand extends BaseCommand {
  type: 'AddAutoTradeRule';
  rule: AutoTradeRule;
}

export interface UpdateAutoTradeRuleCommand extends BaseCommand {
  type: 'UpdateAutoTradeRule';
  ruleIndex: number;
  updates: Partial<AutoTradeRule>;
}

export interface RemoveAutoTradeRuleCommand extends BaseCommand {
  type: 'RemoveAutoTradeRule';
  ruleIndex: number;
}

// ── Diplomacy commands ──────────────────────────────────────────────────

export interface SetTreatyCommand extends BaseCommand {
  type: 'SetTreaty';
  targetPlayerId: number;
  treatyType: TreatyType;
}

// ── AI convenience commands ─────────────────────────────────────────────

export interface AutoConnectBuildingCommand extends BaseCommand {
  type: 'AutoConnectBuilding';
  coord: HexCoord;
}

// ── Discriminated union ─────────────────────────────────────────────────

export type GameCommand =
  | PlaceBuildingCommand
  | DemolishBuildingCommand
  | ToggleBuildingPauseCommand
  | StartUpgradeCommand
  | StartBuildingUpgradeCommand
  | PlaceFlagCommand
  | ConnectFlagsCommand
  | DemolishFlagCommand
  | DemolishRoadCommand
  | UpgradeRoadCommand
  | AttackBuildingCommand
  | SetGoodsDistributionCommand
  | SetToolQueueCommand
  | MarketplaceTradeCommand
  | AcceptDealCommand
  | AddAutoTradeRuleCommand
  | UpdateAutoTradeRuleCommand
  | RemoveAutoTradeRuleCommand
  | SetTreatyCommand
  | AutoConnectBuildingCommand;
