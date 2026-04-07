import type { Game } from '../engine/Game';
import type { VictoryResult } from '../game/VictoryManager';
import { VictoryCondition } from '../game/VictoryManager';
import { UnitType, UNIT_DEFINITIONS } from '../game/UnitType';
import { BuildingState, getInventoryTotal } from '../game/Building';
import { recordVictory, unlockAchievement } from './Achievements';
import { getPlayerCssColor, getPlayerLabel } from '../engine/PlayerColors';
import { buildReplayData, serializeReplay } from '../game/ReplayData';

let gameOverOverlay: HTMLElement;
let gameOverTitle: HTMLElement;
let gameOverCondition: HTMLElement;
let gameOverStats: HTMLElement;

let getGame: () => Game;
let stopInfoPanelUpdatesFn: () => void;
let stopStatsPanelUpdatesFn: () => void;
let stopBuildPanelUpdatesFn: () => void;

export function initGameOverScreen(
  getGameFn: () => Game,
  stopInfoUpdates: () => void,
  stopStatsUpdates: () => void,
  stopBuildUpdates: () => void,
): void {
  getGame = getGameFn;
  stopInfoPanelUpdatesFn = stopInfoUpdates;
  stopStatsPanelUpdatesFn = stopStatsUpdates;
  stopBuildPanelUpdatesFn = stopBuildUpdates;

  gameOverOverlay = document.getElementById('game-over-overlay')!;
  gameOverTitle = document.getElementById('game-over-title')!;
  gameOverCondition = document.getElementById('game-over-condition')!;
  gameOverStats = document.getElementById('game-over-stats')!;

  const gameOverContinueBtn = document.getElementById('game-over-continue-btn')!;
  const gameOverNewGameBtn = document.getElementById('game-over-new-game-btn')!;

  gameOverContinueBtn.addEventListener('click', () => {
    gameOverOverlay.classList.add('hidden');
  });

  gameOverNewGameBtn.addEventListener('click', () => {
    gameOverOverlay.classList.add('hidden');
    const overlay = document.getElementById('setup-overlay')!;
    overlay.classList.remove('hidden');
    overlay.style.animation = 'none';
    requestAnimationFrame(() => {
      overlay.style.animation = '';
    });
  });

  // Save Replay button
  const saveReplayBtn = document.getElementById('game-over-save-replay-btn');
  saveReplayBtn?.addEventListener('click', () => {
    const g = getGame();
    const config = g.getConfig();
    const commandLog = g.getNetworkAdapter().getCommandLog();
    const totalTurns = g.getCurrentTurn();

    // Build player assignments from config
    const humanIds = new Set(config.humanPlayerIds ?? [g.getHumanPlayerId()]);
    const assignments = [];
    for (let i = 1; i <= config.numPlayers; i++) {
      assignments.push({
        playerId: i,
        name: humanIds.has(i) ? `Player ${i}` : `AI ${i}`,
        isHuman: humanIds.has(i),
      });
    }

    const replayData = buildReplayData(config, config.seed, assignments, commandLog, totalTurns);
    const json = serializeReplay(replayData);

    // Trigger browser download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `replay-${config.seed}-${new Date().toISOString().slice(0, 10)}.replay.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

/** Show the game over screen */
export function showGameOver(result: VictoryResult): void {
  const isWin = result.winnerId === getGame().getHumanPlayerId();

  // Add icon and styled border
  const card = document.querySelector('.game-over-card') as HTMLElement;
  card.style.borderTop = `4px solid ${isWin ? 'var(--color-medieval-gold)' : '#c62828'}`;

  const existingIcon = document.querySelector('.game-over-icon');
  if (existingIcon) existingIcon.remove();
  const iconDiv = document.createElement('div');
  iconDiv.className = 'game-over-icon';
  iconDiv.style.color = isWin ? 'var(--color-medieval-gold)' : '#c62828';
  iconDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="currentColor">${isWin ? '<path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>' : '<path d="M12 2C6.48 2 2 6.48 2 12c0 3.07 1.39 5.81 3.57 7.63V22h4.86v-2h3.14v2h4.86v-2.37C20.61 17.81 22 15.07 22 12c0-5.52-4.48-10-10-10zM9 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>'}</svg>`;
  gameOverTitle.parentElement!.insertBefore(iconDiv, gameOverTitle);

  gameOverTitle.textContent = isWin ? 'Victory!' : 'Defeat';
  gameOverTitle.style.color = isWin ? '#4caf50' : '#f44336';
  if (isWin) {
    gameOverTitle.style.textShadow = '0 0 20px rgba(184, 134, 11, 0.4)';
  } else {
    gameOverTitle.style.textShadow = 'none';
  }

  const conditionLabels: Record<string, string> = {
    [VictoryCondition.Elimination]: 'All enemies have been defeated',
    [VictoryCondition.Domination]: 'Territorial domination achieved',
    [VictoryCondition.Economic]: 'Economic supremacy reached',
    [VictoryCondition.Timed]: 'Time limit reached — most territory wins',
    [VictoryCondition.Peaceful]: 'Trade empire established',
  };
  gameOverCondition.textContent = conditionLabels[result.condition] ?? result.condition;

  // Gather end-game stats
  const g = getGame();
  const config = g.getConfig();
  const pid = g.getHumanPlayerId();
  const gameState = g.getGameState();
  const victoryMgr = g.getVictoryManager();

  // Game duration (shared across views)
  const elapsed = victoryMgr.getElapsedTime();
  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60);
  const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const isMultiplayer = config.numPlayers > 1;

  if (isMultiplayer) {
    // --- Multiplayer comparison view ---
    renderMultiplayerStats(g, result, durationStr);
  } else {
    // --- Single-player view (unchanged) ---
    renderSinglePlayerStats(g, pid, durationStr);
  }

  // Achievement tracking — recompute human player stats for achievements
  const humanBuildings = gameState.getBuildingsByPlayer(pid);
  const humanActiveBuildings = humanBuildings.filter(b => b.state === BuildingState.Active).length;
  const humanUnits = gameState.getUnitsByPlayer(pid);
  const militaryTypeListAch: UnitType[] = [UnitType.Knight, UnitType.Archer, UnitType.Cavalry, UnitType.SiegeOperator, UnitType.Scout];
  const humanMilitaryUnits = humanUnits.filter(u => militaryTypeListAch.includes(u.type));
  const humanTerritoryPct = Math.round(victoryMgr.getPlayerTerritoryFraction(pid) * 100);

  if (isWin) {
    const diff = config.difficulty ?? 'normal';
    recordVictory(result.condition, diff);
  }
  if (humanActiveBuildings >= 10) unlockAchievement('build_10');
  if (humanActiveBuildings >= 25) unlockAchievement('build_25');
  if (humanActiveBuildings >= 50) unlockAchievement('build_50');
  if (humanUnits.length >= 50) unlockAchievement('population_50');
  if (humanUnits.length >= 100) unlockAchievement('population_100');
  if (humanMilitaryUnits.length >= 10) unlockAchievement('army_10');
  if (humanTerritoryPct >= 50) unlockAchievement('territory_50');

  // Widen card for multiplayer comparison layout
  const card2 = document.querySelector('.game-over-card') as HTMLElement;
  if (isMultiplayer) {
    card2.classList.add('game-over-card--multiplayer');
  } else {
    card2.classList.remove('game-over-card--multiplayer');
  }

  // Stop live updates — panels are hidden behind the overlay
  stopInfoPanelUpdatesFn();
  stopStatsPanelUpdatesFn();
  stopBuildPanelUpdatesFn();

  gameOverOverlay.classList.remove('hidden');
}

// ─── Single-player stats (unchanged layout) ────────────────────────────────

function renderSinglePlayerStats(g: Game, pid: number, durationStr: string): void {
  const gameState = g.getGameState();
  const victoryMgr = g.getVictoryManager();
  const buildings = gameState.getBuildingsByPlayer(pid);
  const units = gameState.getUnitsByPlayer(pid);
  const militaryTypeList: UnitType[] = [UnitType.Knight, UnitType.Archer, UnitType.Cavalry, UnitType.SiegeOperator, UnitType.Scout];
  const militaryUnits = units.filter(u => militaryTypeList.includes(u.type));
  const civilians = units.length - militaryUnits.length;
  const goldBars = victoryMgr.getPlayerGoldBars(pid);
  const territoryPct = Math.round(victoryMgr.getPlayerTerritoryFraction(pid) * 100);

  const activeBuildings = buildings.filter(b => b.state === BuildingState.Active).length;
  const constructing = buildings.filter(b => b.state === BuildingState.UnderConstruction || b.state === BuildingState.Planned).length;

  const militaryBreakdown = militaryTypeList
    .map(t => ({ type: t, count: units.filter(u => u.type === t).length }))
    .filter(e => e.count > 0)
    .map(e => `${UNIT_DEFINITIONS[e.type]?.label ?? e.type}: ${e.count}`)
    .join(', ');

  let totalResources = 0;
  for (const b of buildings) {
    totalResources += getInventoryTotal(b.inputInventory) + getInventoryTotal(b.outputInventory);
  }

  gameOverStats.innerHTML = `
    <div class="game-over-stat-section">
      <div class="game-over-stat-label">Game</div>
      <div class="game-over-stat-row"><span>Duration</span><span>${durationStr}</span></div>
      <div class="game-over-stat-row"><span>Territory</span><span>${territoryPct}%</span></div>
    </div>
    <div class="game-over-stat-section">
      <div class="game-over-stat-label">Economy</div>
      <div class="game-over-stat-row"><span>Buildings</span><span>${activeBuildings} active${constructing > 0 ? `, ${constructing} building` : ''}</span></div>
      <div class="game-over-stat-row"><span>Stored Resources</span><span>${totalResources}</span></div>
      <div class="game-over-stat-row"><span>Gold Bars</span><span>${goldBars}</span></div>
    </div>
    <div class="game-over-stat-section">
      <div class="game-over-stat-label">Population</div>
      <div class="game-over-stat-row"><span>Total Units</span><span>${units.length}</span></div>
      <div class="game-over-stat-row"><span>Civilians</span><span>${civilians}</span></div>
      <div class="game-over-stat-row"><span>Military</span><span>${militaryUnits.length}${militaryBreakdown ? ` (${militaryBreakdown})` : ''}</span></div>
    </div>
  `;
}

// ─── Multiplayer comparison view ────────────────────────────────────────────

interface PlayerStats {
  playerId: number;
  label: string;
  color: string;
  buildings: number;
  units: number;
  military: number;
  civilians: number;
  territoryPct: number;
  storedResources: number;
  goldBars: number;
}

function gatherPlayerStats(g: Game): PlayerStats[] {
  const gameState = g.getGameState();
  const victoryMgr = g.getVictoryManager();
  const humanPid = g.getHumanPlayerId();
  const numPlayers = g.getConfig().numPlayers;
  const militaryTypeList: UnitType[] = [UnitType.Knight, UnitType.Archer, UnitType.Cavalry, UnitType.SiegeOperator, UnitType.Scout];
  const results: PlayerStats[] = [];

  for (let pid = 1; pid <= numPlayers; pid++) {
    const buildings = gameState.getBuildingsByPlayer(pid);
    const activeBuildings = buildings.filter(b => b.state === BuildingState.Active).length;
    const units = gameState.getUnitsByPlayer(pid);
    const militaryUnits = units.filter(u => militaryTypeList.includes(u.type));
    const territoryPct = Math.round(victoryMgr.getPlayerTerritoryFraction(pid) * 100);
    const goldBars = victoryMgr.getPlayerGoldBars(pid);

    let storedResources = 0;
    for (const b of buildings) {
      storedResources += getInventoryTotal(b.inputInventory) + getInventoryTotal(b.outputInventory);
    }

    results.push({
      playerId: pid,
      label: getPlayerLabel(pid, humanPid),
      color: getPlayerCssColor(pid),
      buildings: activeBuildings,
      units: units.length,
      military: militaryUnits.length,
      civilians: units.length - militaryUnits.length,
      territoryPct,
      storedResources,
      goldBars,
    });
  }

  return results;
}

function renderMultiplayerStats(g: Game, result: VictoryResult, durationStr: string): void {
  const allStats = gatherPlayerStats(g);
  const winnerId = result.winnerId;

  // Stat row labels in order
  const statRows: { label: string; key: keyof PlayerStats; suffix?: string }[] = [
    { label: 'Buildings', key: 'buildings' },
    { label: 'Total Units', key: 'units' },
    { label: 'Civilians', key: 'civilians' },
    { label: 'Military', key: 'military' },
    { label: 'Territory', key: 'territoryPct', suffix: '%' },
    { label: 'Resources', key: 'storedResources' },
    { label: 'Gold Bars', key: 'goldBars' },
  ];

  // Find best value per stat for highlighting
  const bestValues: Record<string, number> = {};
  for (const row of statRows) {
    bestValues[row.key] = Math.max(...allStats.map(s => s[row.key] as number));
  }

  // Build HTML
  const playerCount = allStats.length;
  const columnWidth = playerCount <= 2 ? '140px' : '110px';

  let html = `
    <div class="game-over-stat-section" style="margin-bottom: 8px;">
      <div class="game-over-stat-row"><span>Duration</span><span>${durationStr}</span></div>
    </div>
    <div class="game-over-mp-grid" style="grid-template-columns: 120px repeat(${playerCount}, ${columnWidth});">
  `;

  // Header row: empty cell + player columns
  html += `<div class="game-over-mp-header"></div>`;
  for (const ps of allStats) {
    const isWinner = ps.playerId === winnerId;
    html += `
      <div class="game-over-mp-header game-over-mp-player${isWinner ? ' game-over-mp-winner' : ''}">
        <span class="game-over-mp-color-dot" style="background: ${ps.color};"></span>
        <span class="game-over-mp-player-name">${ps.label}</span>
        ${isWinner ? '<span class="game-over-mp-crown">&#9813;</span>' : ''}
      </div>
    `;
  }

  // Data rows
  for (const row of statRows) {
    html += `<div class="game-over-mp-label">${row.label}</div>`;
    for (const ps of allStats) {
      const val = ps[row.key] as number;
      const isBest = val === bestValues[row.key] && val > 0;
      const isWinner = ps.playerId === winnerId;
      html += `<div class="game-over-mp-value${isBest ? ' game-over-mp-best' : ''}${isWinner ? ' game-over-mp-winner-col' : ''}">${val}${row.suffix ?? ''}</div>`;
    }
  }

  html += `</div>`;
  gameOverStats.innerHTML = html;
}

export function hideGameOverOverlay(): void {
  gameOverOverlay.classList.add('hidden');
}
