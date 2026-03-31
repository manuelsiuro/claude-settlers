/** Diplomacy panel for managing treaties with other players */

import type { Game } from '../engine/Game';
import type { TreatyType } from '../game/DiplomacyManager';
import { icon } from './icons';
import { showSnackbar } from './Snackbar';

const PLAYER_COLORS = ['#4488ff', '#ff4444', '#44cc44', '#ffcc00'];
const TREATY_LABELS: Record<TreatyType, string> = {
  none: 'Hostile',
  non_aggression: 'Non-Aggression',
  trade_agreement: 'Trade Agreement',
  alliance: 'Alliance',
};
const TREATY_DESCRIPTIONS: Record<TreatyType, string> = {
  none: 'No treaty — can attack each other',
  non_aggression: 'Cannot attack each other',
  trade_agreement: 'Non-aggression + 50% reduced trade fees',
  alliance: 'Trade agreement + shared fog of war',
};

let overlayEl: HTMLElement | null = null;
let getGame: (() => Game | undefined) | null = null;

export function initDiplomacyPanel(getGameFn: () => Game | undefined): void {
  getGame = getGameFn;
}

export function showDiplomacy(): void {
  const game = getGame?.();
  if (!game) return;

  if (!overlayEl) {
    overlayEl = document.createElement('div');
    overlayEl.id = 'diplomacy-overlay';
    overlayEl.className = 'diplomacy-overlay';
    document.body.appendChild(overlayEl);
  }

  const dm = game.getDiplomacyManager();
  const humanId = game.getHumanPlayerId();
  const config = game.getConfig();
  const numPlayers = config.numPlayers;

  if (numPlayers <= 1) {
    overlayEl.innerHTML = `
      <div class="diplomacy-card">
        <div class="diplomacy-header">
          <h2 class="diplomacy-title">${icon('people')} Diplomacy</h2>
          <button class="icon-btn diplomacy-close">${icon('close')}</button>
        </div>
        <div class="diplomacy-empty">No other players in this game</div>
      </div>
    `;
    overlayEl.classList.remove('hidden');
    overlayEl.querySelector('.diplomacy-close')?.addEventListener('click', hideDiplomacy);
    return;
  }

  let html = `
    <div class="diplomacy-card">
      <div class="diplomacy-header">
        <h2 class="diplomacy-title">${icon('people')} Diplomacy</h2>
        <button class="icon-btn diplomacy-close">${icon('close')}</button>
      </div>
      <div class="diplomacy-list">
  `;

  for (let pid = 1; pid <= numPlayers; pid++) {
    if (pid === humanId) continue;
    const treaty = dm.getTreaty(humanId, pid);
    const color = PLAYER_COLORS[pid - 1] ?? '#888';

    html += `
      <div class="diplomacy-player" data-pid="${pid}">
        <div class="diplomacy-player-header">
          <span class="diplomacy-player-dot" style="background:${color}"></span>
          <span class="diplomacy-player-name">Player ${pid}</span>
          <span class="diplomacy-treaty-badge treaty-${treaty}">${TREATY_LABELS[treaty]}</span>
        </div>
        <p class="diplomacy-treaty-desc">${TREATY_DESCRIPTIONS[treaty]}</p>
        <div class="diplomacy-actions">
          ${treaty === 'none' ? `
            <button class="btn-outlined btn-sm" data-action="non_aggression" data-target="${pid}">Propose Non-Aggression</button>
            <button class="btn-outlined btn-sm" data-action="trade_agreement" data-target="${pid}">Propose Trade Agreement</button>
            <button class="btn-filled btn-sm" data-action="alliance" data-target="${pid}">Propose Alliance</button>
          ` : `
            <button class="btn-outlined btn-sm btn-danger" data-action="none" data-target="${pid}">Break Treaty</button>
            ${treaty === 'non_aggression' ? `<button class="btn-outlined btn-sm" data-action="trade_agreement" data-target="${pid}">Upgrade to Trade</button>` : ''}
            ${treaty === 'trade_agreement' ? `<button class="btn-filled btn-sm" data-action="alliance" data-target="${pid}">Upgrade to Alliance</button>` : ''}
          `}
        </div>
      </div>
    `;
  }

  html += `</div></div>`;
  overlayEl.innerHTML = html;
  overlayEl.classList.remove('hidden');

  // Event delegation
  overlayEl.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('.diplomacy-close')) {
      hideDiplomacy();
      return;
    }
    const btn = target.closest('[data-action]') as HTMLElement | null;
    if (btn && game) {
      const action = btn.dataset.action as TreatyType;
      const targetPid = Number(btn.dataset.target);
      const gameTime = game.getEconomyTracker().getGameTime();
      dm.setTreaty(humanId, targetPid, action, gameTime);
      const label = action === 'none' ? 'Treaty broken' : `${TREATY_LABELS[action]} established`;
      showSnackbar(`${label} with Player ${targetPid}`, action === 'none' ? 'warning' : 'success');
      showDiplomacy(); // Refresh
    }
  });
}

export function hideDiplomacy(): void {
  overlayEl?.classList.add('hidden');
}

export function toggleDiplomacy(): void {
  if (overlayEl && !overlayEl.classList.contains('hidden')) hideDiplomacy();
  else showDiplomacy();
}
