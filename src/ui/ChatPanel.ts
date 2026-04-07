/**
 * In-game chat panel for multiplayer LAN games.
 *
 * Creates its own DOM elements dynamically (no GameHTML changes needed).
 * Toggle with Enter key (when not focused in an input) or the chat icon button.
 * Hidden by default; shows when first message arrives or Enter is pressed.
 */

const PLAYER_COLORS = ['#4488ff', '#ff4444', '#44cc44', '#ffcc00'];
const MAX_MESSAGES = 50;

interface ChatMessage {
  playerName: string;
  message: string;
  playerId: number;
}

let panelEl: HTMLElement | null = null;
let messagesEl: HTMLElement | null = null;
let inputEl: HTMLInputElement | null = null;
let toggleBtnEl: HTMLElement | null = null;
let sendFn: ((message: string) => void) | null = null;
let messages: ChatMessage[] = [];
let keyHandler: ((e: KeyboardEvent) => void) | null = null;
let unreadCount = 0;

// ── Public API ──────────────────────────────────────────────────────

export function initChatPanel(send: (message: string) => void): void {
  sendFn = send;
  messages = [];
  unreadCount = 0;
  ensurePanel();
  attachKeyHandler();
}

export function addChatMessage(playerName: string, message: string, playerId: number): void {
  messages.push({ playerName, message, playerId });
  if (messages.length > MAX_MESSAGES) {
    messages.shift();
  }
  renderMessages();

  // Show panel on first incoming message, or update unread badge
  if (panelEl && panelEl.style.display === 'none') {
    unreadCount++;
    updateBadge();
    showPanel();
  } else if (panelEl && panelEl.style.display !== 'none') {
    // Panel visible — no unread
  } else {
    unreadCount++;
    updateBadge();
  }
}

export function toggleChatPanel(): void {
  if (!panelEl) return;
  if (panelEl.style.display === 'none') {
    showPanel();
  } else {
    hidePanel();
  }
}

export function disposeChatPanel(): void {
  if (keyHandler) {
    window.removeEventListener('keydown', keyHandler);
    keyHandler = null;
  }
  panelEl?.remove();
  panelEl = null;
  messagesEl = null;
  inputEl = null;
  toggleBtnEl?.remove();
  toggleBtnEl = null;
  sendFn = null;
  messages = [];
  unreadCount = 0;
}

// ── Internal ────────────────────────────────────────────────────────

function ensurePanel(): void {
  if (panelEl) return;

  // Toggle button (chat icon) — always visible in multiplayer
  toggleBtnEl = document.createElement('button');
  toggleBtnEl.id = 'chat-toggle-btn';
  toggleBtnEl.className = 'chat-toggle-btn';
  toggleBtnEl.title = 'Toggle Chat (Enter)';
  toggleBtnEl.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
    <span class="chat-badge hidden" id="chat-badge">0</span>
  `;
  toggleBtnEl.addEventListener('click', () => toggleChatPanel());
  document.body.appendChild(toggleBtnEl);

  // Chat panel
  panelEl = document.createElement('div');
  panelEl.id = 'chat-panel';
  panelEl.className = 'chat-panel';
  panelEl.style.display = 'none';
  panelEl.innerHTML = `
    <div class="chat-header">
      <span class="chat-title">Chat</span>
      <button class="chat-close-btn" id="chat-close-btn" title="Close">&times;</button>
    </div>
    <div class="chat-messages" id="chat-messages"></div>
    <div class="chat-input-row">
      <input type="text" class="chat-input" id="chat-input" placeholder="Type a message..." maxlength="200" autocomplete="off" />
      <button class="chat-send-btn" id="chat-send-btn">Send</button>
    </div>
  `;
  document.body.appendChild(panelEl);

  messagesEl = document.getElementById('chat-messages')!;
  inputEl = document.getElementById('chat-input') as HTMLInputElement;

  // Close button
  document.getElementById('chat-close-btn')!.addEventListener('click', () => hidePanel());

  // Send button
  document.getElementById('chat-send-btn')!.addEventListener('click', () => sendCurrentMessage());

  // Enter in input sends message
  inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      sendCurrentMessage();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      hidePanel();
    }
  });

  renderMessages();
}

function attachKeyHandler(): void {
  if (keyHandler) {
    window.removeEventListener('keydown', keyHandler);
  }

  keyHandler = (e: KeyboardEvent) => {
    // Only toggle on Enter when not typing in any input
    if (e.key !== 'Enter') return;
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    e.preventDefault();
    toggleChatPanel();
    // Focus the input when opening
    if (panelEl && panelEl.style.display !== 'none') {
      inputEl?.focus();
    }
  };

  window.addEventListener('keydown', keyHandler);
}

function showPanel(): void {
  if (!panelEl) return;
  panelEl.style.display = 'flex';
  unreadCount = 0;
  updateBadge();
  scrollToBottom();
}

function hidePanel(): void {
  if (!panelEl) return;
  panelEl.style.display = 'none';
  inputEl?.blur();
}

function sendCurrentMessage(): void {
  if (!inputEl || !sendFn) return;
  const text = inputEl.value.trim();
  if (!text) return;
  sendFn(text);
  inputEl.value = '';
  inputEl.focus();
}

function renderMessages(): void {
  if (!messagesEl) return;
  messagesEl.innerHTML = messages.map(m => {
    const color = PLAYER_COLORS[m.playerId - 1] ?? '#888888';
    const safeName = escapeHtml(m.playerName);
    const safeMsg = escapeHtml(m.message);
    return `<div class="chat-message"><span style="color:${color};font-weight:600;">${safeName}:</span> ${safeMsg}</div>`;
  }).join('');
  scrollToBottom();
}

function scrollToBottom(): void {
  if (messagesEl) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

function updateBadge(): void {
  const badge = document.getElementById('chat-badge');
  if (!badge) return;
  if (unreadCount > 0) {
    badge.textContent = String(unreadCount > 99 ? '99+' : unreadCount);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
