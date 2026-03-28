/**
 * 5-step interactive tutorial for new players.
 * Polls game state to detect completion of each step.
 * Shows a persistent banner with instructions.
 */
import type { Game } from '../engine/Game';
import { BuildingType } from '../game/BuildingType';
import { BuildingState } from '../game/Building';

const STORAGE_KEY = 'feudal-tutorial-completed';

export function shouldShowTutorial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'true';
  } catch { return true; }
}

function markComplete(): void {
  try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* noop */ }
}

interface TutorialStep {
  title: string;
  hint: string;
  check: (game: Game) => boolean;
}

const STEPS: TutorialStep[] = [
  {
    title: 'Step 1/5: Build a Woodcutter',
    hint: 'Open the Build panel and place a Woodcutter Hut near trees. Click the hammer icon or press B.',
    check: (game) => {
      const gs = game.getGameState();
      return gs.getAllBuildings().some(
        b => b.type === BuildingType.WoodcutterHut && b.playerId === game.getHumanPlayerId()
      );
    },
  },
  {
    title: 'Step 2/5: Connect with a Flag & Road',
    hint: 'Place a Flag next to your Woodcutter, then build a Road connecting it to your Castle\'s flag. Press F for flag mode, R for road mode.',
    check: (game) => {
      const rn = game.getRoadNetwork();
      const pid = game.getHumanPlayerId();
      // Need at least 2 flags (Castle flag + new one) and 1 road
      const flags = rn.getAllFlags().filter(f => f.playerId === pid);
      const roads = rn.getAllRoads();
      return flags.length >= 2 && roads.length >= 1;
    },
  },
  {
    title: 'Step 3/5: Build a Sawmill',
    hint: 'Place a Sawmill to turn Wood into Planks. Connect it with flags and roads too!',
    check: (game) => {
      const gs = game.getGameState();
      return gs.getAllBuildings().some(
        b => b.type === BuildingType.Sawmill && b.playerId === game.getHumanPlayerId()
      );
    },
  },
  {
    title: 'Step 4/5: Wait for Production',
    hint: 'Your economy is starting! Watch the Woodcutter gather Wood and the Sawmill process it into Planks.',
    check: (game) => {
      const gs = game.getGameState();
      const pid = game.getHumanPlayerId();
      const sawmill = gs.getAllBuildings().find(
        b => b.type === BuildingType.Sawmill && b.playerId === pid && b.state === BuildingState.Active
      );
      if (!sawmill) return false;
      // Check if sawmill has produced at least once (output inventory has planks)
      return (sawmill.outputInventory['planks'] ?? 0) > 0 || sawmill.productionProgress > 0.5;
    },
  },
  {
    title: 'Step 5/5: Build a Guard Hut',
    hint: 'Place a Guard Hut to expand your territory and recruit a Knight for defense. You\'re ready to build your realm!',
    check: (game) => {
      const gs = game.getGameState();
      return gs.getAllBuildings().some(
        b => b.type === BuildingType.GuardHut && b.playerId === game.getHumanPlayerId()
      );
    },
  },
];

let banner: HTMLElement | null = null;
let bannerTitle: HTMLElement | null = null;
let bannerHint: HTMLElement | null = null;
let currentStep = 0;
let pollInterval: ReturnType<typeof setInterval> | null = null;
let gameRef: Game | null = null;

export function initTutorial(game: Game): void {
  if (!shouldShowTutorial()) return;

  gameRef = game;
  currentStep = 0;

  // Create banner element
  banner = document.createElement('div');
  banner.id = 'tutorial-banner';
  banner.innerHTML = `
    <div class="tutorial-content">
      <strong class="tutorial-title"></strong>
      <span class="tutorial-hint"></span>
    </div>
    <button class="tutorial-skip" title="Skip tutorial">Skip</button>
  `;
  document.body.appendChild(banner);

  bannerTitle = banner.querySelector('.tutorial-title');
  bannerHint = banner.querySelector('.tutorial-hint');

  // Skip button
  banner.querySelector('.tutorial-skip')!.addEventListener('click', () => {
    completeTutorial();
  });

  // Add styles
  const style = document.createElement('style');
  style.id = 'tutorial-styles';
  style.textContent = `
    #tutorial-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      background: linear-gradient(135deg, rgba(33, 150, 243, 0.95), rgba(25, 118, 210, 0.95));
      color: white;
      font-size: 13px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      backdrop-filter: blur(8px);
      animation: tutorialSlideIn 0.4s ease;
    }
    @keyframes tutorialSlideIn {
      from { transform: translateY(-100%); }
      to { transform: translateY(0); }
    }
    .tutorial-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .tutorial-title {
      font-size: 14px;
      font-weight: 600;
    }
    .tutorial-hint {
      font-size: 12px;
      opacity: 0.9;
    }
    .tutorial-skip {
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.4);
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .tutorial-skip:hover {
      background: rgba(255,255,255,0.35);
    }
    .tutorial-complete {
      background: linear-gradient(135deg, rgba(76, 175, 80, 0.95), rgba(56, 142, 60, 0.95)) !important;
    }
    @media (max-width: 768px) {
      #tutorial-banner { padding: 6px 12px; }
      .tutorial-title { font-size: 13px; }
      .tutorial-hint { font-size: 11px; }
    }
  `;
  document.head.appendChild(style);

  // Show first step
  renderStep();

  // Poll game state every second
  pollInterval = setInterval(pollProgress, 1000);
}

function renderStep(): void {
  if (!bannerTitle || !bannerHint || currentStep >= STEPS.length) return;
  const step = STEPS[currentStep];
  bannerTitle.textContent = step.title;
  bannerHint.textContent = step.hint;
}

function pollProgress(): void {
  if (!gameRef || currentStep >= STEPS.length) return;

  const step = STEPS[currentStep];
  if (step.check(gameRef)) {
    currentStep++;
    if (currentStep >= STEPS.length) {
      completeTutorial();
    } else {
      renderStep();
    }
  }
}

function completeTutorial(): void {
  markComplete();
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }

  if (banner && bannerTitle && bannerHint) {
    banner.classList.add('tutorial-complete');
    bannerTitle.textContent = 'Tutorial Complete!';
    bannerHint.textContent = 'You know the basics. Expand your economy, raise an army, and conquer the map!';
    const skipBtn = banner.querySelector('.tutorial-skip') as HTMLElement;
    if (skipBtn) skipBtn.textContent = 'Close';
    if (skipBtn) skipBtn.onclick = () => disposeTutorial();

    // Auto-dismiss after 5 seconds
    setTimeout(disposeTutorial, 5000);
  }
}

export function disposeTutorial(): void {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  banner?.remove();
  document.getElementById('tutorial-styles')?.remove();
  banner = null;
  bannerTitle = null;
  bannerHint = null;
  gameRef = null;
}
