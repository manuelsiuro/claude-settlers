/** Cross-game achievements system persisted in localStorage */

import { showSnackbar } from './Snackbar';
import { icon } from './icons';

const STORAGE_KEY = 'feudal-achievements';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string; // icon name from icons.ts
}

const ACHIEVEMENTS: AchievementDef[] = [
  // Victory
  { id: 'first_victory', name: 'First Triumph', description: 'Win your first game', icon: 'trophy' },
  { id: 'domination_victory', name: 'Total Domination', description: 'Win by controlling 75% of the map', icon: 'map' },
  { id: 'economic_victory', name: 'Golden Age', description: 'Win by accumulating 50 gold bars', icon: 'crown' },
  { id: 'peaceful_victory', name: 'Merchant Prince', description: 'Win via peaceful trade victory', icon: 'warehouse' },
  { id: 'win_hard', name: 'Iron Will', description: 'Win on Hard difficulty', icon: 'shield_icon' },

  // Economy
  { id: 'build_10', name: 'Budding Lord', description: 'Build 10 buildings in a single game', icon: 'construction' },
  { id: 'build_25', name: 'Master Builder', description: 'Build 25 buildings in a single game', icon: 'construction' },
  { id: 'build_50', name: 'Grand Architect', description: 'Build 50 buildings in a single game', icon: 'construction' },
  { id: 'full_chain', name: 'Chain Master', description: 'Complete a Grain → Flour → Bread chain', icon: 'crown' },
  { id: 'gold_bars_10', name: 'Midas Touch', description: 'Accumulate 10 gold bars', icon: 'crown' },
  { id: 'population_50', name: 'Growing Village', description: 'Reach 50 population', icon: 'people' },
  { id: 'population_100', name: 'Thriving Town', description: 'Reach 100 population', icon: 'people' },

  // Military
  { id: 'first_knight', name: 'To Arms!', description: 'Recruit your first knight', icon: 'shield_icon' },
  { id: 'capture_building', name: 'Conqueror', description: 'Capture an enemy building', icon: 'shield_icon' },
  { id: 'rank5_knight', name: 'Legendary Knight', description: 'Promote a knight to rank 5', icon: 'shield_icon' },
  { id: 'army_10', name: 'Standing Army', description: 'Have 10 military units at once', icon: 'shield_icon' },

  // Exploration
  { id: 'territory_50', name: 'Expanding Borders', description: 'Control 50% of the map', icon: 'map' },
  { id: 'all_scenarios', name: 'World Traveler', description: 'Play on all 8 map scenarios', icon: 'map' },

  // Trade
  { id: 'first_trade', name: 'Open Market', description: 'Complete your first trade', icon: 'warehouse' },
  { id: 'trade_10', name: 'Trader', description: 'Complete 10 trades in one game', icon: 'warehouse' },

  // Misc
  { id: 'play_30min', name: 'Dedicated Ruler', description: 'Play a single game for 30 minutes', icon: 'clock' },
  { id: 'play_60min', name: 'Tireless Lord', description: 'Play a single game for 60 minutes', icon: 'clock' },
  { id: 'sandbox_builder', name: 'Creative Mode', description: 'Play a sandbox game', icon: 'construction' },
  { id: 'night_owl', name: 'Night Owl', description: 'Play through a full day/night cycle', icon: 'moon' },
];

interface AchievementState {
  unlocked: Record<string, number>; // id → timestamp
  stats: {
    totalGames: number;
    totalVictories: number;
    scenariosPlayed: string[];
  };
}

function loadState(): AchievementState {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (json) return JSON.parse(json);
  } catch { /* ignore */ }
  return { unlocked: {}, stats: { totalGames: 0, totalVictories: 0, scenariosPlayed: [] } };
}

function saveState(state: AchievementState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

let state: AchievementState = loadState();

/** Unlock an achievement by ID (no-op if already unlocked) */
export function unlockAchievement(id: string): void {
  if (state.unlocked[id]) return;
  const def = ACHIEVEMENTS.find(a => a.id === id);
  if (!def) return;
  state.unlocked[id] = Date.now();
  saveState(state);
  // Show popup
  showSnackbar(`Achievement: ${def.name}`, 'success');
}

/** Check if an achievement is unlocked */
export function isUnlocked(id: string): boolean {
  return !!state.unlocked[id];
}

/** Get achievement progress stats */
export function getAchievementStats(): { total: number; unlocked: number } {
  return { total: ACHIEVEMENTS.length, unlocked: Object.keys(state.unlocked).length };
}

/** Record a game start for stats tracking */
export function recordGameStart(scenario: string): void {
  state.stats.totalGames++;
  if (!state.stats.scenariosPlayed.includes(scenario)) {
    state.stats.scenariosPlayed.push(scenario);
  }
  saveState(state);

  if (state.stats.scenariosPlayed.length >= 8) {
    unlockAchievement('all_scenarios');
  }
}

/** Record a victory */
export function recordVictory(condition: string, difficulty: string): void {
  state.stats.totalVictories++;
  saveState(state);
  unlockAchievement('first_victory');
  if (condition === 'domination') unlockAchievement('domination_victory');
  if (condition === 'economic') unlockAchievement('economic_victory');
  if (condition === 'peaceful') unlockAchievement('peaceful_victory');
  if (difficulty === 'hard') unlockAchievement('win_hard');
}

// ---- Achievement Gallery Overlay ----

let overlayEl: HTMLElement | null = null;

export function initAchievementsPanel(): void {
  // Will be created on demand
}

export function showAchievements(): void {
  state = loadState(); // refresh
  if (!overlayEl) {
    overlayEl = document.createElement('div');
    overlayEl.id = 'achievements-overlay';
    overlayEl.className = 'achievements-overlay';
    document.body.appendChild(overlayEl);

    overlayEl.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.achievements-close')) {
        hideAchievements();
      }
    });
  }

  const stats = getAchievementStats();
  const pct = stats.total > 0 ? Math.round((stats.unlocked / stats.total) * 100) : 0;

  overlayEl.innerHTML = `
    <div class="achievements-card">
      <div class="achievements-header">
        <h2 class="achievements-title">${icon('trophy')} Achievements</h2>
        <span class="achievements-progress">${stats.unlocked}/${stats.total} (${pct}%)</span>
        <button class="icon-btn achievements-close">${icon('close')}</button>
      </div>
      <div class="achievements-list">
        ${ACHIEVEMENTS.map(a => {
          const done = !!state.unlocked[a.id];
          return `<div class="achievement-item ${done ? 'unlocked' : 'locked'}">
            <span class="achievement-icon">${icon(a.icon)}</span>
            <div class="achievement-text">
              <span class="achievement-name">${a.name}</span>
              <span class="achievement-desc">${a.description}</span>
            </div>
            ${done ? '<span class="achievement-check">&#10003;</span>' : ''}
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
  overlayEl.classList.remove('hidden');
}

export function hideAchievements(): void {
  overlayEl?.classList.add('hidden');
}

export function toggleAchievements(): void {
  if (overlayEl && !overlayEl.classList.contains('hidden')) hideAchievements();
  else showAchievements();
}
