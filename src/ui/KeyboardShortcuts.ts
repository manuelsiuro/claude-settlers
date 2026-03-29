/** Centralized keyboard shortcuts for the game */

import type { Game } from '../engine/Game';
import { HexGrid } from '../game/HexGrid';
import { toggleEncyclopedia } from './EncyclopediaPanel';

interface ShortcutHandlers {
  getGame: () => Game | undefined;
  toggleBuildPanel: () => void;
  showStatsPanel: (tab?: string) => void;
  showDashboard: () => void;
}

interface ShortcutDef {
  key: string;
  label: string;
  description: string;
}

const SHORTCUTS: ShortcutDef[] = [
  { key: 'B', label: 'B', description: 'Toggle Build Panel' },
  { key: 'S', label: 'S', description: 'Toggle Stats Panel' },
  { key: 'D', label: 'D', description: 'Toggle Dashboard' },
  { key: 'E', label: 'E', description: 'Toggle Encyclopedia' },
  { key: 'Space', label: 'Space', description: 'Pause / Resume' },
  { key: 'F1-F4', label: 'F1-F4', description: 'Game Speed (0.5x/1x/2x/3x)' },
  { key: 'Home', label: 'Home', description: 'Center on Castle' },
  { key: '1-5', label: '1-5', description: 'Recall Camera Bookmark' },
  { key: 'Ctrl+1-5', label: 'Ctrl+1-5', description: 'Save Camera Bookmark' },
  { key: 'Escape', label: 'Esc', description: 'Cancel / Close Panel' },
  { key: 'P', label: 'P', description: 'Toggle FPS Counter' },
  { key: '?', label: '?', description: 'Show Keyboard Shortcuts' },
];

let overlayEl: HTMLElement | null = null;
let handlers: ShortcutHandlers | null = null;
let keyHandler: ((e: KeyboardEvent) => void) | null = null;

function isTyping(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

function isGameActive(): boolean {
  const setupOv = document.getElementById('setup-overlay');
  return setupOv?.classList.contains('hidden') ?? false;
}

export function initKeyboardShortcuts(h: ShortcutHandlers): void {
  handlers = h;

  keyHandler = (e: KeyboardEvent) => {
    if (isTyping(e)) return;
    if (!isGameActive()) return;

    switch (e.key.toLowerCase()) {
      case 'b':
        e.preventDefault();
        handlers?.toggleBuildPanel();
        break;
      case 's':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          handlers?.showStatsPanel();
        }
        break;
      case 'd':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          handlers?.showDashboard();
        }
        break;
      case 'e':
        e.preventDefault();
        toggleEncyclopedia();
        break;
      case 'home': {
        e.preventDefault();
        const g = handlers?.getGame();
        if (g) {
          const pid = g.getHumanPlayerId();
          const castle = g.getGameState().getBuildingsByPlayer(pid).find(b => b.type === 'castle');
          if (castle) {
            const cam = g.getCameraController();
            if (cam) {
              const pos = HexGrid.hexToWorld(castle.coord.q, castle.coord.r);
              cam.panTo(pos.x, pos.z);
            }
          }
        }
        break;
      }
      case 'p':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          handlers?.getGame()?.getPerformanceMonitor()?.toggle();
        }
        break;
      case 'f1':
        e.preventDefault();
        handlers?.getGame()?.setSpeed(0.5);
        break;
      case 'f2':
        e.preventDefault();
        handlers?.getGame()?.setSpeed(1);
        break;
      case 'f3':
        e.preventDefault();
        handlers?.getGame()?.setSpeed(2);
        break;
      case 'f4':
        e.preventDefault();
        handlers?.getGame()?.setSpeed(3);
        break;
      case '?':
        e.preventDefault();
        toggleShortcutsOverlay();
        break;
    }
  };

  window.addEventListener('keydown', keyHandler);
}

function toggleShortcutsOverlay(): void {
  if (overlayEl && !overlayEl.classList.contains('hidden')) {
    overlayEl.classList.add('hidden');
    return;
  }
  showShortcutsOverlay();
}

function showShortcutsOverlay(): void {
  if (!overlayEl) {
    overlayEl = document.createElement('div');
    overlayEl.id = 'shortcuts-overlay';
    overlayEl.className = 'shortcuts-overlay';
    overlayEl.innerHTML = `
      <div class="shortcuts-card">
        <h3 class="shortcuts-title">Keyboard Shortcuts</h3>
        <div class="shortcuts-list">
          ${SHORTCUTS.map(s => `
            <div class="shortcuts-row">
              <kbd class="shortcuts-key">${s.label}</kbd>
              <span class="shortcuts-desc">${s.description}</span>
            </div>
          `).join('')}
        </div>
        <p class="shortcuts-hint">Press <kbd>?</kbd> or <kbd>Esc</kbd> to close</p>
      </div>
    `;
    document.body.appendChild(overlayEl);

    overlayEl.addEventListener('click', (e) => {
      if (e.target === overlayEl) {
        overlayEl!.classList.add('hidden');
      }
    });
    overlayEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') overlayEl!.classList.add('hidden');
    });
  }
  overlayEl.classList.remove('hidden');
}

export function disposeKeyboardShortcuts(): void {
  if (keyHandler) {
    window.removeEventListener('keydown', keyHandler);
    keyHandler = null;
  }
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
  handlers = null;
}
