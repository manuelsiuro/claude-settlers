/** Campaign scenario definitions with objectives and constraints */

import type { Scenario, Difficulty, VictoryConfig } from './GameConfig';

export interface CampaignObjective {
  id: string;
  description: string;
  /** Check function returns true when objective is met. Evaluated in VictoryManager. */
  type: 'buildings' | 'population' | 'territory' | 'gold' | 'military' | 'time_survive';
  target: number;
}

export interface CampaignScenario {
  id: string;
  name: string;
  description: string;
  difficulty: Difficulty;
  scenario: Scenario;
  mapSize: number;
  numPlayers: number;
  seed: number;
  objectives: CampaignObjective[];
  /** Override victory config — campaign uses custom objectives */
  victory: VictoryConfig;
  /** Flavor text shown at start */
  briefing: string;
  /** Whether sandbox features (free building) are enabled */
  sandbox?: boolean;
}

export const CAMPAIGN_SCENARIOS: CampaignScenario[] = [
  {
    id: 'tutorial_valley',
    name: 'The First Settlement',
    description: 'Establish a basic economy in a peaceful valley.',
    difficulty: 'easy',
    scenario: 'river_valley',
    mapSize: 24,
    numPlayers: 1,
    seed: 100,
    objectives: [
      { id: 'build_10', description: 'Build 10 buildings', type: 'buildings', target: 10 },
      { id: 'pop_20', description: 'Reach 20 population', type: 'population', target: 20 },
    ],
    victory: { elimination: false, domination: false, economic: false, timed: false, timedLimitMinutes: 0, peaceful: false },
    briefing: 'You have arrived in a fertile river valley. Establish your settlement by building basic economy structures and growing your population.',
  },
  {
    id: 'mountain_fortress',
    name: 'Mountain Fortress',
    description: 'Build a mining empire in the mountains and amass gold.',
    difficulty: 'normal',
    scenario: 'mountain_pass',
    mapSize: 32,
    numPlayers: 2,
    seed: 200,
    objectives: [
      { id: 'gold_20', description: 'Accumulate 20 gold bars', type: 'gold', target: 20 },
      { id: 'territory_40', description: 'Control 40% of the map', type: 'territory', target: 40 },
    ],
    victory: { elimination: false, domination: false, economic: false, timed: false, timedLimitMinutes: 0, peaceful: false },
    briefing: 'The mountain passes hide rich ore deposits. Build mines and smelters to fuel your economy. An AI rival seeks the same riches.',
  },
  {
    id: 'island_survival',
    name: 'Island Survival',
    description: 'Survive and thrive on a small island with limited resources.',
    difficulty: 'normal',
    scenario: 'island',
    mapSize: 24,
    numPlayers: 1,
    seed: 300,
    objectives: [
      { id: 'pop_40', description: 'Reach 40 population', type: 'population', target: 40 },
      { id: 'build_20', description: 'Build 20 buildings', type: 'buildings', target: 20 },
    ],
    victory: { elimination: false, domination: false, economic: false, timed: false, timedLimitMinutes: 0, peaceful: false },
    briefing: 'Shipwrecked on an island with only your Castle crew. Use the limited land wisely — water surrounds you on all sides.',
  },
  {
    id: 'desert_oasis',
    name: 'Oasis Trade Empire',
    description: 'Build a marketplace empire in the harsh desert.',
    difficulty: 'hard',
    scenario: 'oasis',
    mapSize: 32,
    numPlayers: 3,
    seed: 400,
    objectives: [
      { id: 'gold_30', description: 'Accumulate 30 gold bars', type: 'gold', target: 30 },
      { id: 'military_8', description: 'Have 8 military units', type: 'military', target: 8 },
    ],
    victory: { elimination: false, domination: false, economic: false, timed: false, timedLimitMinutes: 0, peaceful: false },
    briefing: 'The desert oasis is a crossroads for traders and raiders alike. Build your economy around the scarce water while defending against two aggressive rivals.',
  },
  {
    id: 'peninsula_defense',
    name: 'Last Stand',
    description: 'Defend your peninsula against overwhelming odds.',
    difficulty: 'hard',
    scenario: 'peninsula',
    mapSize: 32,
    numPlayers: 3,
    seed: 500,
    objectives: [
      { id: 'survive_20', description: 'Survive for 20 minutes', type: 'time_survive', target: 20 },
      { id: 'military_12', description: 'Build an army of 12 military units', type: 'military', target: 12 },
    ],
    victory: { elimination: false, domination: false, economic: false, timed: false, timedLimitMinutes: 0, peaceful: false },
    briefing: 'Surrounded on three sides by water, your peninsula is your fortress. Two enemies close in. Survive for 20 minutes while building your defenses.',
  },
  {
    id: 'conquest',
    name: 'Total Conquest',
    description: 'Eliminate all rivals and dominate the continent.',
    difficulty: 'hard',
    scenario: 'continent',
    mapSize: 48,
    numPlayers: 4,
    seed: 600,
    objectives: [
      { id: 'territory_75', description: 'Control 75% of the map', type: 'territory', target: 75 },
    ],
    victory: { elimination: true, domination: true, economic: false, timed: false, timedLimitMinutes: 0, peaceful: false },
    briefing: 'Three rival lords challenge your claim to the continent. Expand, build armies, and crush them all. Only total domination will bring peace.',
  },
  // ── New scenarios ──────────────────────────────────────────────
  {
    id: 'peaceful_builder',
    name: 'The Peaceful Builder',
    description: 'Build a thriving settlement without any military.',
    difficulty: 'easy',
    scenario: 'default',
    mapSize: 32,
    numPlayers: 1,
    seed: 700,
    objectives: [
      { id: 'build_30', description: 'Build 30 buildings', type: 'buildings', target: 30 },
      { id: 'pop_60', description: 'Reach 60 population', type: 'population', target: 60 },
      { id: 'gold_10', description: 'Accumulate 10 gold bars', type: 'gold', target: 10 },
    ],
    victory: { elimination: false, domination: false, economic: false, timed: false, timedLimitMinutes: 0, peaceful: false },
    briefing: 'No enemies threaten your realm. Focus on building the most efficient economy you can. Complete all three objectives to prove your mastery.',
    sandbox: true,
  },
  {
    id: 'speed_run',
    name: 'Speed Run',
    description: 'Achieve economic victory in under 15 minutes.',
    difficulty: 'hard',
    scenario: 'continent',
    mapSize: 24,
    numPlayers: 1,
    seed: 800,
    objectives: [
      { id: 'gold_50', description: 'Accumulate 50 gold bars', type: 'gold', target: 50 },
    ],
    victory: { elimination: false, domination: false, economic: false, timed: true, timedLimitMinutes: 15, peaceful: false },
    briefing: 'The clock is ticking. You have 15 minutes to amass 50 gold bars. Every second counts — optimize your build order and production chains.',
  },
  {
    id: 'archipelago_explorer',
    name: 'Archipelago Explorer',
    description: 'Expand across scattered islands to claim territory.',
    difficulty: 'normal',
    scenario: 'archipelago',
    mapSize: 48,
    numPlayers: 2,
    seed: 900,
    objectives: [
      { id: 'territory_60', description: 'Control 60% of the map', type: 'territory', target: 60 },
      { id: 'build_25', description: 'Build 25 buildings', type: 'buildings', target: 25 },
    ],
    victory: { elimination: false, domination: false, economic: false, timed: false, timedLimitMinutes: 0, peaceful: false },
    briefing: 'Scattered islands dot the ocean. Use harbors and strategic military placement to claim as many islands as possible before your rival does.',
  },
  {
    id: 'four_kingdoms',
    name: 'Four Kingdoms',
    description: 'Survive a 4-player diplomacy challenge.',
    difficulty: 'hard',
    scenario: 'default',
    mapSize: 48,
    numPlayers: 4,
    seed: 1000,
    objectives: [
      { id: 'survive_30', description: 'Survive for 30 minutes', type: 'time_survive', target: 30 },
      { id: 'military_15', description: 'Have 15 military units', type: 'military', target: 15 },
    ],
    victory: { elimination: false, domination: false, economic: false, timed: false, timedLimitMinutes: 0, peaceful: false },
    briefing: 'Four kingdoms vie for supremacy. Use diplomacy to forge alliances, build your military, and outlast your rivals. The last kingdom standing wins.',
  },
  {
    id: 'dark_forest',
    name: 'Dark Forest',
    description: 'Navigate dense fog of war in a forested battleground.',
    difficulty: 'hard',
    scenario: 'default',
    mapSize: 32,
    numPlayers: 2,
    seed: 1100,
    objectives: [
      { id: 'territory_50', description: 'Control 50% of the map', type: 'territory', target: 50 },
      { id: 'military_10', description: 'Have 10 military units', type: 'military', target: 10 },
    ],
    victory: { elimination: true, domination: false, economic: false, timed: false, timedLimitMinutes: 0, peaceful: false },
    briefing: 'Dense forests hide your enemy. Expand cautiously, use scouts to reveal the fog of war, and strike when the time is right. Elimination is the only path to victory.',
  },
  {
    id: 'gold_rush',
    name: 'Gold Rush',
    description: 'Race to mine gold in the mountains before your rival.',
    difficulty: 'normal',
    scenario: 'mountain_pass',
    mapSize: 32,
    numPlayers: 2,
    seed: 1200,
    objectives: [
      { id: 'gold_40', description: 'Accumulate 40 gold bars', type: 'gold', target: 40 },
    ],
    victory: { elimination: false, domination: false, economic: false, timed: false, timedLimitMinutes: 0, peaceful: false },
    briefing: 'The mountain passes are rich with gold deposits. Build your mining empire faster than your rival. The first to 40 gold bars wins the rush.',
  },
];

/** Get completed campaign scenario IDs from localStorage */
export function getCompletedCampaigns(): string[] {
  try {
    const json = localStorage.getItem('feudal-campaign-completed');
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

/** Mark a campaign scenario as completed */
export function completeCampaign(id: string): void {
  const completed = getCompletedCampaigns();
  if (!completed.includes(id)) {
    completed.push(id);
    localStorage.setItem('feudal-campaign-completed', JSON.stringify(completed));
  }
}
