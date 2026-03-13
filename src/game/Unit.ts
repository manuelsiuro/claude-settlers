import type { UnitType } from './UnitType';
import { UNIT_DEFINITIONS } from './UnitType';
import type { UnitDefinition } from './UnitType';
import type { HexCoord } from './HexGrid';
import type { ResourceType } from './ResourceType';

/**
 * Unit behavior states.
 * Uses const object + type alias pattern (required by erasableSyntaxOnly).
 */
export const UnitState = {
  /** At the Castle, waiting for a job assignment */
  Idle: 'idle',
  /** Walking from Castle/current position to assigned building */
  WalkingToWork: 'walking_to_work',
  /** Performing work at assigned building */
  Working: 'working',
  /** Walking back to Castle (e.g., building destroyed, reassignment) */
  WalkingHome: 'walking_home',
  /** Engaged in combat (knight-only) */
  Fighting: 'fighting',
} as const;

export type UnitState = (typeof UnitState)[keyof typeof UnitState];

export interface Unit {
  /** Unique identifier */
  id: string;
  /** Unit profession type */
  type: UnitType;
  /** Current hex position */
  coord: HexCoord;
  /** Current behavior state */
  state: UnitState;
  /** Building this unit is assigned to work at (null if unassigned) */
  assignedBuildingId: string | null;
  /** Player who owns this unit */
  playerId: number;
  /** Current movement path (sequence of hex coords to follow) */
  path: HexCoord[];
  /** Index of current segment start in path */
  pathIndex: number;
  /** Interpolation progress 0..1 between path[pathIndex] and path[pathIndex+1] */
  moveProgress: number;
  /** Resource currently being carried (null if empty-handed) */
  carryingResource: ResourceType | null;
  /** Knight rank 1-5 (only meaningful for Knight type) */
  knightRank: number;
}

let nextUnitId = 1;

/** Create a new unit at the given hex coordinate */
export function createUnit(
  type: UnitType,
  coord: HexCoord,
  playerId: number,
): Unit {
  const id = `unit_${nextUnitId++}`;

  return {
    id,
    type,
    coord,
    state: UnitState.Idle,
    assignedBuildingId: null,
    playerId,
    path: [],
    pathIndex: 0,
    moveProgress: 0,
    carryingResource: null,
    knightRank: 1,
  };
}

/** Get the unit definition for a unit instance */
export function getUnitDefinition(unit: Unit): UnitDefinition {
  return UNIT_DEFINITIONS[unit.type];
}

/** Check if a unit is currently moving */
export function isUnitMoving(unit: Unit): boolean {
  return unit.path.length > 0 && unit.pathIndex < unit.path.length - 1;
}

/** Get the unit's current world-interpolated position between hexes */
export function getUnitWorldPosition(unit: Unit): HexCoord {
  if (unit.path.length === 0 || unit.pathIndex >= unit.path.length - 1) {
    return unit.coord;
  }

  const from = unit.path[unit.pathIndex];
  const to = unit.path[unit.pathIndex + 1];
  const t = unit.moveProgress;

  return {
    q: from.q + (to.q - from.q) * t,
    r: from.r + (to.r - from.r) * t,
  };
}

/** Assign a unit to a building */
export function assignUnitToBuilding(unit: Unit, buildingId: string): void {
  unit.assignedBuildingId = buildingId;
}

/** Unassign a unit from its building */
export function unassignUnit(unit: Unit): void {
  unit.assignedBuildingId = null;
}

/** Set a movement path for a unit */
export function setUnitPath(unit: Unit, path: HexCoord[]): void {
  unit.path = path;
  unit.pathIndex = 0;
  unit.moveProgress = 0;
}

/** Clear a unit's movement path */
export function clearUnitPath(unit: Unit): void {
  unit.path = [];
  unit.pathIndex = 0;
  unit.moveProgress = 0;
}

/** Reset the unit ID counter (for testing) */
export function resetUnitIdCounter(): void {
  nextUnitId = 1;
}

/** Get the current ID counter value (for serialization) */
export function getUnitIdCounter(): number {
  return nextUnitId;
}

/** Set the ID counter value (for deserialization) */
export function setUnitIdCounter(value: number): void {
  nextUnitId = value;
}
