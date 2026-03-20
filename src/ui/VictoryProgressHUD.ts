import type { Game } from '../engine/Game';
import { VictoryCondition, VictoryManager } from '../game/VictoryManager';

let updateInterval: ReturnType<typeof setInterval> | null = null;

export function initVictoryProgressHUD(getGame: () => Game): void {
  disposeVictoryProgressHUD();

  updateInterval = setInterval(() => {
    const game = getGame();
    if (!game) return;

    const el = document.getElementById('victory-progress');
    if (!el) return;

    const vm = game.getVictoryManager();
    const pid = game.getHumanPlayerId();
    const enabled = vm.getEnabledConditions();

    if (enabled.length === 0) {
      el.innerHTML = '';
      return;
    }

    const pills: string[] = [];

    for (const condition of enabled) {
      const pill = buildPill(condition, vm, pid);
      if (pill) pills.push(pill);
    }

    // On mobile, show only the closest-to-winning condition
    const isMobile = window.innerWidth <= 768;
    if (isMobile && pills.length > 1) {
      // Find the pill with highest progress
      let bestIdx = 0;
      let bestProgress = 0;
      for (let i = 0; i < enabled.length; i++) {
        const p = getProgress(enabled[i], vm, pid);
        if (p > bestProgress) {
          bestProgress = p;
          bestIdx = i;
        }
      }
      el.innerHTML = pills[bestIdx] ?? '';
    } else {
      el.innerHTML = pills.join('');
    }
  }, 2000);
}

export function disposeVictoryProgressHUD(): void {
  if (updateInterval !== null) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  const el = document.getElementById('victory-progress');
  if (el) el.innerHTML = '';
}

function getProgress(condition: VictoryCondition, vm: VictoryManager, pid: number): number {
  switch (condition) {
    case VictoryCondition.Domination: {
      const fraction = vm.getPlayerTerritoryFraction(pid);
      return fraction / VictoryManager.DOMINATION_THRESHOLD;
    }
    case VictoryCondition.Economic: {
      const gold = vm.getPlayerGoldBars(pid);
      return gold / VictoryManager.ECONOMIC_GOLD_TARGET;
    }
    case VictoryCondition.Peaceful: {
      const goods = vm.getPlayerStorageGoods(pid);
      return goods / VictoryManager.PEACEFUL_GOODS_TARGET;
    }
    case VictoryCondition.Timed: {
      const limit = vm.getTimedLimit();
      if (limit <= 0) return 0;
      return vm.getElapsedTime() / limit;
    }
    case VictoryCondition.Elimination: {
      const active = vm.getActivePlayers().length;
      // Progress is how many are eliminated; not very meaningful for a "fill bar"
      return active <= 1 ? 1 : 0;
    }
    default:
      return 0;
  }
}

function buildPill(condition: VictoryCondition, vm: VictoryManager, pid: number): string | null {
  const progress = getProgress(condition, vm, pid);
  const isClose = progress >= 0.75;
  const cls = isClose ? ' victory-pill-close' : '';

  switch (condition) {
    case VictoryCondition.Domination: {
      const pct = Math.round(vm.getPlayerTerritoryFraction(pid) * 100);
      return `<span class="victory-pill${cls}" title="Domination: ${pct}% / 75%">🗺 ${pct}%/75%</span>`;
    }
    case VictoryCondition.Economic: {
      const gold = vm.getPlayerGoldBars(pid);
      return `<span class="victory-pill${cls}" title="Economic: ${gold} / ${VictoryManager.ECONOMIC_GOLD_TARGET} gold bars">👑 ${gold}/${VictoryManager.ECONOMIC_GOLD_TARGET}</span>`;
    }
    case VictoryCondition.Peaceful: {
      const goods = vm.getPlayerStorageGoods(pid);
      return `<span class="victory-pill${cls}" title="Peaceful: ${goods} / ${VictoryManager.PEACEFUL_GOODS_TARGET} stored goods">🌾 ${goods}/${VictoryManager.PEACEFUL_GOODS_TARGET}</span>`;
    }
    case VictoryCondition.Timed: {
      const limit = vm.getTimedLimit();
      const remaining = Math.max(0, limit - vm.getElapsedTime());
      const mins = Math.floor(remaining / 60);
      const secs = Math.floor(remaining % 60);
      const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
      return `<span class="victory-pill${cls}" title="Time remaining">⏱ ${timeStr}</span>`;
    }
    case VictoryCondition.Elimination: {
      const active = vm.getActivePlayers().length;
      // Total players includes eliminated ones
      const total = active + Array.from({ length: 10 }, (_, i) => i + 1).filter(id => vm.isEliminated(id)).length;
      return `<span class="victory-pill${cls}" title="Elimination: ${active} of ${total} players remaining">💀 ${active}/${total}</span>`;
    }
    default:
      return null;
  }
}
