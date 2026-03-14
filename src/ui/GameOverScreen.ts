import type { Game } from '../engine/Game';
import type { VictoryResult } from '../game/VictoryManager';
import { VictoryCondition } from '../game/VictoryManager';
import { UnitType } from '../game/UnitType';

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
  };
  gameOverCondition.textContent = conditionLabels[result.condition] ?? result.condition;

  // Gather end-game stats
  const g = getGame();
  const pid = g.getHumanPlayerId();
  const gameState = g.getGameState();
  const buildings = gameState.getBuildingsByPlayer(pid);
  const units = gameState.getUnitsByPlayer(pid);
  const knights = units.filter(u => u.type === UnitType.Knight);
  const victoryMgr = g.getVictoryManager();
  const goldBars = victoryMgr.getPlayerGoldBars(pid);
  const territoryPct = Math.round(victoryMgr.getPlayerTerritoryFraction(pid) * 100);

  gameOverStats.innerHTML = `
    <div class="game-over-stat-row"><span>Buildings</span><span>${buildings.length}</span></div>
    <div class="game-over-stat-row"><span>Population</span><span>${units.length}</span></div>
    <div class="game-over-stat-row"><span>Knights</span><span>${knights.length}</span></div>
    <div class="game-over-stat-row"><span>Gold Bars</span><span>${goldBars}</span></div>
    <div class="game-over-stat-row"><span>Territory</span><span>${territoryPct}%</span></div>
  `;

  // Stop live updates — panels are hidden behind the overlay
  stopInfoPanelUpdatesFn();
  stopStatsPanelUpdatesFn();
  stopBuildPanelUpdatesFn();

  gameOverOverlay.classList.remove('hidden');
}

export function hideGameOverOverlay(): void {
  gameOverOverlay.classList.add('hidden');
}
