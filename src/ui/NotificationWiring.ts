import type { Game, GameNotification } from '../engine/Game';
import { VictoryCondition } from '../game/VictoryManager';
import { audioManager } from '../engine/AudioManager';
import type { SfxType } from '../engine/AudioManager';
import { showSnackbar } from './Snackbar';

type ShowGameOverFn = (result: import('../game/VictoryManager').VictoryResult) => void;
type UpdatePauseSpeedUIFn = (paused: boolean, speed: number) => void;

/** Map notification types to SFX */
function notificationToSfx(type: string): SfxType {
  switch (type) {
    case 'building_complete': return 'building_complete';
    case 'knight_recruited': return 'knight_recruited';
    case 'under_attack': return 'under_attack';
    case 'building_captured': return 'building_captured';
    case 'building_destroyed': return 'building_destroyed';
    case 'combat_result': return 'combat_clash';
    case 'tool_waiting': return 'notification';
    case 'population_cap': return 'notification';
    case 'victory': return 'victory';
    case 'defeat': return 'defeat';
    default: return 'notification';
  }
}

/** Wire up notification handler for the active game instance */
export function wireNotifications(
  g: Game,
  showGameOver: ShowGameOverFn,
  updatePauseSpeedUI: UpdatePauseSpeedUIFn,
): void {
  g.onNotification = (notification: GameNotification) => {
    showSnackbar(notification.message);
    audioManager.play(notificationToSfx(notification.type));

    if (notification.type === 'victory' || notification.type === 'defeat') {
      const victoryMgr = g.getVictoryManager();
      const result = victoryMgr.getResult();

      if (notification.type === 'defeat' && victoryMgr.isEliminated(g.getHumanPlayerId())) {
        showGameOver(result ?? { winnerId: 0, condition: VictoryCondition.Elimination });
      } else if (result) {
        showGameOver(result);
      }
    }
  };

  g.onSpeedChange = (paused: boolean, speed: number) => {
    updatePauseSpeedUI(paused, speed);
  };
}
