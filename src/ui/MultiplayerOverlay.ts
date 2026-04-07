/**
 * Multiplayer overlay states shown during gameplay:
 * 1. Waiting overlay — displayed while waiting for the opponent's turn packet.
 * 2. Disconnected overlay — displayed when the connection to the relay is lost.
 *
 * Elements are created lazily on first use and reused thereafter.
 * z-index 9000 keeps them below the lobby (10000) but above normal game UI.
 */

// ── Waiting overlay ────────────────────────────────────────────────────

let waitingEl: HTMLElement | null = null;

function ensureWaiting(): HTMLElement {
  if (!waitingEl) {
    waitingEl = document.createElement('div');
    waitingEl.id = 'mp-waiting-overlay';
    waitingEl.className = 'mp-overlay';
    waitingEl.innerHTML = `
      <div class="mp-overlay-card">
        <div class="mp-spinner"></div>
        <p style="margin:16px 0 0;text-align:center;">Waiting for opponent&hellip;</p>
      </div>
    `;
    document.body.appendChild(waitingEl);
  }
  return waitingEl;
}

export function showWaitingOverlay(): void {
  const el = ensureWaiting();
  el.style.display = 'flex';
}

export function hideWaitingOverlay(): void {
  if (waitingEl) {
    waitingEl.style.display = 'none';
  }
}

// ── Disconnected overlay ───────────────────────────────────────────────

let disconnectedEl: HTMLElement | null = null;

function ensureDisconnected(): HTMLElement {
  if (!disconnectedEl) {
    disconnectedEl = document.createElement('div');
    disconnectedEl.id = 'mp-disconnected-overlay';
    disconnectedEl.className = 'mp-overlay';
    disconnectedEl.innerHTML = `
      <div class="mp-overlay-card">
        <h3 style="margin:0 0 8px;text-align:center;">Connection Lost</h3>
        <p style="margin:0 0 16px;text-align:center;opacity:0.7;font-size:0.85rem;">
          Attempting to reconnect&hellip;
        </p>
        <button class="btn-filled" id="mp-disconnect-leave-btn" style="width:100%;">Return to Menu</button>
      </div>
    `;
    document.body.appendChild(disconnectedEl);
  }
  return disconnectedEl;
}

export function showDisconnectedOverlay(onLeave: () => void): void {
  const el = ensureDisconnected();
  el.style.display = 'flex';

  // Re-wire button each time in case the callback changes
  const btn = document.getElementById('mp-disconnect-leave-btn');
  if (btn) {
    const fresh = btn.cloneNode(true) as HTMLElement;
    btn.parentNode?.replaceChild(fresh, btn);
    fresh.addEventListener('click', () => {
      hideDisconnectedOverlay();
      onLeave();
    });
  }
}

export function hideDisconnectedOverlay(): void {
  if (disconnectedEl) {
    disconnectedEl.style.display = 'none';
  }
}
