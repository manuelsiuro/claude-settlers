/**
 * Random events system that fires periodic events affecting gameplay.
 * Events have duration-limited effects and are announced via notifications.
 */
import type { GameState } from './GameState';
import { BuildingState } from './Building';
import { BuildingType } from './BuildingType';

// ── Configuration ───────────────────────────────────────────────────────

/** Minimum seconds between events */
const EVENT_INTERVAL_MIN = 180;
/** Maximum seconds between events */
const EVENT_INTERVAL_MAX = 360;

export interface RandomEvent {
  id: string;
  label: string;
  message: string;
  /** Duration in seconds (0 = instant) */
  duration: number;
  /** Which player is affected (0 = all) */
  playerId: number;
  /** Type for UI display */
  category: 'positive' | 'negative' | 'neutral';
}

export interface ActiveEffect {
  event: RandomEvent;
  remainingTime: number;
}

type EventGenerator = (gs: GameState, playerId: number) => RandomEvent | null;

// ── Event templates ─────────────────────────────────────────────────────

const POSITIVE_EVENTS: EventGenerator[] = [
  (gs, pid) => {
    const farms = gs.getAllBuildings().filter(
      b => b.type === BuildingType.Farm && b.playerId === pid && b.state === BuildingState.Active
    );
    if (farms.length === 0) return null;
    return {
      id: 'bumper_harvest',
      label: 'Bumper Harvest',
      message: `Favorable weather! Farm production boosted for 60 seconds.`,
      duration: 60,
      playerId: pid,
      category: 'positive',
    };
  },
  (_gs, pid) => ({
    id: 'traveling_craftsman',
    label: 'Traveling Craftsman',
    message: 'A traveling craftsman has arrived, boosting all production for 45 seconds!',
    duration: 45,
    playerId: pid,
    category: 'positive',
  }),
  (_gs, pid) => ({
    id: 'lucky_find',
    label: 'Lucky Find',
    message: 'Workers discovered extra materials! Construction speed boosted for 30 seconds.',
    duration: 30,
    playerId: pid,
    category: 'positive',
  }),
  (_gs, pid) => ({
    id: 'festival',
    label: 'Harvest Festival',
    message: 'A festival lifts everyone\'s spirits! Morale boosted for 90 seconds.',
    duration: 90,
    playerId: pid,
    category: 'positive',
  }),
  (_gs, pid) => ({
    id: 'visiting_hero',
    label: 'Visiting Hero',
    message: 'A legendary warrior visits! Military combat strength boosted for 60 seconds.',
    duration: 60,
    playerId: pid,
    category: 'positive',
  }),
];

const NEGATIVE_EVENTS: EventGenerator[] = [
  (gs, pid) => {
    const active = gs.getAllBuildings().filter(
      b => b.playerId === pid && b.state === BuildingState.Active && b.type !== BuildingType.Castle
    );
    if (active.length === 0) return null;
    return {
      id: 'building_fire',
      label: 'Building Fire',
      message: 'A building caught fire! One building is temporarily disabled.',
      duration: 30,
      playerId: pid,
      category: 'negative',
    };
  },
  (_gs, pid) => ({
    id: 'harsh_weather',
    label: 'Harsh Weather',
    message: 'Harsh weather slows movement and production for 45 seconds.',
    duration: 45,
    playerId: pid,
    category: 'negative',
  }),
  (_gs, pid) => ({
    id: 'supply_shortage',
    label: 'Supply Shortage',
    message: 'A supply route disruption slows production for 30 seconds.',
    duration: 30,
    playerId: pid,
    category: 'negative',
  }),
  (gs, pid) => {
    const mines = gs.getAllBuildings().filter(
      b => (b.type === BuildingType.IronMine || b.type === BuildingType.CoalMine || b.type === BuildingType.GoldMine)
        && b.playerId === pid && b.state === BuildingState.Active
    );
    if (mines.length === 0) return null;
    return {
      id: 'mine_collapse',
      label: 'Mine Collapse',
      message: 'A mine shaft collapsed! One mine is temporarily disabled.',
      duration: 45,
      playerId: pid,
      category: 'negative',
    };
  },
  (_gs, pid) => ({
    id: 'drought',
    label: 'Drought',
    message: 'A drought reduces food production for 60 seconds.',
    duration: 60,
    playerId: pid,
    category: 'negative',
  }),
  (_gs, pid) => ({
    id: 'plague',
    label: 'Plague',
    message: 'A plague sweeps through! Worker speed reduced for 45 seconds.',
    duration: 45,
    playerId: pid,
    category: 'negative',
  }),
];

const NEUTRAL_EVENTS: EventGenerator[] = [
  (_gs, pid) => ({
    id: 'wandering_merchant',
    label: 'Wandering Merchant',
    message: 'A wandering merchant offers favorable trade rates for 60 seconds!',
    duration: 60,
    playerId: pid,
    category: 'neutral',
  }),
  (_gs, pid) => ({
    id: 'trade_caravan',
    label: 'Trade Caravan',
    message: 'A trade caravan passes through, bringing supplies and opportunities.',
    duration: 45,
    playerId: pid,
    category: 'neutral',
  }),
];

// ── Manager ─────────────────────────────────────────────────────────────

export class RandomEventManager {
  private gameState: GameState;
  private timeUntilNextEvent: number;
  private activeEffects: ActiveEffect[] = [];
  private disabledBuildingId: string | null = null;
  private humanPlayerId: number;

  /** Callback for announcing events */
  onEvent: ((event: RandomEvent) => void) | null = null;

  /** Injectable random for testing */
  random: () => number = Math.random;

  constructor(gameState: GameState, humanPlayerId: number) {
    this.gameState = gameState;
    this.humanPlayerId = humanPlayerId;
    this.timeUntilNextEvent = this.rollNextInterval();
  }

  private rollNextInterval(): number {
    return EVENT_INTERVAL_MIN + this.random() * (EVENT_INTERVAL_MAX - EVENT_INTERVAL_MIN);
  }

  update(deltaTime: number): void {
    // Countdown to next event
    this.timeUntilNextEvent -= deltaTime;
    if (this.timeUntilNextEvent <= 0) {
      this.triggerRandomEvent();
      this.timeUntilNextEvent = this.rollNextInterval();
    }

    // Tick active effects
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      this.activeEffects[i].remainingTime -= deltaTime;
      if (this.activeEffects[i].remainingTime <= 0) {
        this.expireEffect(this.activeEffects[i]);
        this.activeEffects.splice(i, 1);
      }
    }
  }

  private triggerRandomEvent(): void {
    const pid = this.humanPlayerId;

    // 50% positive, 35% negative, 15% neutral
    const roll = this.random();
    let generators: EventGenerator[];
    if (roll < 0.50) generators = POSITIVE_EVENTS;
    else if (roll < 0.85) generators = NEGATIVE_EVENTS;
    else generators = NEUTRAL_EVENTS;

    // Pick a random generator from the chosen category
    const idx = Math.floor(this.random() * generators.length);
    const event = generators[idx](this.gameState, pid);
    if (!event) return;

    // Apply immediate effects
    this.applyEffect(event);

    // Track for duration
    if (event.duration > 0) {
      this.activeEffects.push({ event, remainingTime: event.duration });
    }

    this.onEvent?.(event);
  }

  private applyEffect(event: RandomEvent): void {
    if (event.id === 'building_fire') {
      // Disable a random non-Castle building
      const active = this.gameState.getAllBuildings().filter(
        b => b.playerId === event.playerId &&
             b.state === BuildingState.Active &&
             b.type !== BuildingType.Castle &&
             !b.productionPaused
      );
      if (active.length > 0) {
        const building = active[Math.floor(this.random() * active.length)];
        building.productionPaused = true;
        this.disabledBuildingId = building.id;
      }
    }

    if (event.id === 'mine_collapse') {
      // Disable a random mine
      const mines = this.gameState.getAllBuildings().filter(
        b => b.playerId === event.playerId &&
             b.state === BuildingState.Active &&
             (b.type === BuildingType.IronMine || b.type === BuildingType.CoalMine || b.type === BuildingType.GoldMine) &&
             !b.productionPaused
      );
      if (mines.length > 0) {
        const mine = mines[Math.floor(this.random() * mines.length)];
        mine.productionPaused = true;
        this.disabledBuildingId = mine.id;
      }
    }
  }

  private expireEffect(effect: ActiveEffect): void {
    if ((effect.event.id === 'building_fire' || effect.event.id === 'mine_collapse') && this.disabledBuildingId) {
      const building = this.gameState.getBuilding(this.disabledBuildingId);
      if (building) building.productionPaused = false;
      this.disabledBuildingId = null;
    }
  }

  /** Get active production speed multiplier from events */
  getProductionMultiplier(playerId: number): number {
    let mult = 1.0;
    for (const { event } of this.activeEffects) {
      if (event.playerId !== 0 && event.playerId !== playerId) continue;
      if (event.id === 'bumper_harvest') mult *= 1.5;
      if (event.id === 'traveling_craftsman') mult *= 1.25;
      if (event.id === 'harsh_weather') mult *= 0.75;
      if (event.id === 'supply_shortage') mult *= 0.80;
      if (event.id === 'drought') mult *= 0.70;
      if (event.id === 'trade_caravan') mult *= 1.1;
    }
    return mult;
  }

  /** Get active movement speed multiplier from events */
  getSpeedMultiplier(playerId: number): number {
    let mult = 1.0;
    for (const { event } of this.activeEffects) {
      if (event.playerId !== 0 && event.playerId !== playerId) continue;
      if (event.id === 'harsh_weather') mult *= 0.70;
      if (event.id === 'lucky_find') mult *= 1.3;
      if (event.id === 'plague') mult *= 0.70;
      if (event.id === 'visiting_hero') mult *= 1.2;
    }
    return mult;
  }

  /** Get all currently active effects */
  getActiveEffects(): ReadonlyArray<ActiveEffect> {
    return this.activeEffects;
  }

  /** Serialization */
  _getState(): { timeUntilNext: number; effects: { eventId: string; remaining: number }[]; disabledBuildingId: string | null } {
    return {
      timeUntilNext: this.timeUntilNextEvent,
      effects: this.activeEffects.map(e => ({ eventId: e.event.id, remaining: e.remainingTime })),
      disabledBuildingId: this.disabledBuildingId,
    };
  }

  _loadState(state: { timeUntilNext?: number; disabledBuildingId?: string | null }): void {
    if (state.timeUntilNext !== undefined) this.timeUntilNextEvent = state.timeUntilNext;
    if (state.disabledBuildingId) this.disabledBuildingId = state.disabledBuildingId;
  }
}
