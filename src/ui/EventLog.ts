/** Persistent event log that stores game notifications for review */

import type { GameNotification } from '../engine/GameNotifications';
import { icon } from './icons';

const MAX_EVENTS = 100;

export interface EventLogEntry {
  notification: GameNotification;
  timestamp: number; // game time or wall clock
  read: boolean;
}

let panelEl: HTMLElement | null = null;
let listEl: HTMLElement | null = null;
let badgeEl: HTMLElement | null = null;
let btnEl: HTMLElement | null = null;
let entries: EventLogEntry[] = [];
let visible = false;
let onNavigate: ((q: number, r: number) => void) | null = null;

/** Severity class for notification types */
function getSeverityClass(type: string): string {
  switch (type) {
    case 'under_attack':
    case 'building_destroyed':
    case 'defeat':
      return 'event-danger';
    case 'combat_result':
    case 'building_captured':
    case 'tool_waiting':
    case 'population_cap':
    case 'food_warning':
      return 'event-warning';
    case 'victory':
    case 'building_complete':
    case 'knight_recruited':
      return 'event-success';
    default:
      return 'event-info';
  }
}

/** Icon for notification type */
function getEventIcon(type: string): string {
  switch (type) {
    case 'under_attack': return icon('shield_icon');
    case 'building_destroyed': return icon('close');
    case 'building_complete': return icon('construction');
    case 'knight_recruited': return icon('shield_icon');
    case 'building_captured': return icon('shield_icon');
    case 'combat_result': return icon('skull');
    case 'victory': return icon('trophy');
    case 'defeat': return icon('skull');
    case 'tool_waiting': return icon('hammer');
    case 'population_cap': return icon('people');
    case 'food_warning': return icon('warehouse');
    default: return icon('crown');
  }
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function renderList(): void {
  if (!listEl) return;
  if (entries.length === 0) {
    listEl.innerHTML = '<div class="event-log-empty">No events yet</div>';
    return;
  }
  // Newest first
  listEl.innerHTML = entries.map((e, i) => {
    const sevClass = getSeverityClass(e.notification.type);
    const hasPos = e.notification.position != null;
    const readClass = e.read ? 'event-read' : '';
    return `<div class="event-log-item ${sevClass} ${readClass}" data-idx="${i}" ${hasPos ? 'data-nav="1"' : ''}>
      <span class="event-log-icon">${getEventIcon(e.notification.type)}</span>
      <span class="event-log-msg">${e.notification.message}</span>
      <span class="event-log-time">${formatTime(e.timestamp)}</span>
    </div>`;
  }).reverse().join('');
}

function updateBadge(): void {
  if (!badgeEl) return;
  const unread = entries.filter((e) => !e.read).length;
  if (unread > 0) {
    badgeEl.textContent = unread > 99 ? '99+' : String(unread);
    badgeEl.classList.remove('hidden');
  } else {
    badgeEl.classList.add('hidden');
  }
}

/** Initialize the event log panel and bell button */
export function initEventLog(navigateFn: (q: number, r: number) => void): void {
  onNavigate = navigateFn;
  entries = [];

  // Create bell button in app bar
  const appBarRight = document.querySelector('.app-bar-right');
  if (appBarRight && !document.getElementById('event-log-btn')) {
    btnEl = document.createElement('button');
    btnEl.id = 'event-log-btn';
    btnEl.className = 'icon-btn';
    btnEl.title = 'Event Log';
    btnEl.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
      </svg>
      <span class="event-log-badge hidden" id="event-log-badge">0</span>
    `;
    // Insert before the first button (menu)
    appBarRight.insertBefore(btnEl, appBarRight.firstChild);
    badgeEl = document.getElementById('event-log-badge');

    btnEl.addEventListener('click', () => toggleEventLog());
  }

  // Create panel
  if (!document.getElementById('event-log-panel')) {
    panelEl = document.createElement('div');
    panelEl.id = 'event-log-panel';
    panelEl.className = 'event-log-panel hidden';
    panelEl.innerHTML = `
      <div class="event-log-header">
        <span class="event-log-title">Event Log</span>
        <button class="icon-btn event-log-clear" title="Clear All">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
        </button>
        <button class="icon-btn event-log-close" title="Close">
          ${icon('close')}
        </button>
      </div>
      <div class="event-log-list" id="event-log-list"></div>
    `;
    document.body.appendChild(panelEl);
    listEl = document.getElementById('event-log-list');

    // Event delegation
    panelEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Close button
      if (target.closest('.event-log-close')) {
        hideEventLog();
        return;
      }

      // Clear button
      if (target.closest('.event-log-clear')) {
        entries = [];
        renderList();
        updateBadge();
        return;
      }

      // Click on item with position → navigate
      const item = target.closest('.event-log-item') as HTMLElement | null;
      if (item) {
        const idx = Number(item.dataset.idx);
        const entry = entries[idx];
        if (entry) {
          entry.read = true;
          item.classList.add('event-read');
          updateBadge();
          if (entry.notification.position && onNavigate) {
            onNavigate(entry.notification.position.q, entry.notification.position.r);
            hideEventLog();
          }
        }
      }
    });
  }
}

/** Add a notification to the event log */
export function addEvent(notification: GameNotification, gameTimeMs: number): void {
  entries.push({ notification, timestamp: gameTimeMs, read: false });
  if (entries.length > MAX_EVENTS) {
    entries.shift();
  }
  updateBadge();
  if (visible) {
    renderList();
  }
}

function toggleEventLog(): void {
  if (visible) hideEventLog();
  else showEventLog();
}

function showEventLog(): void {
  if (!panelEl) return;
  visible = true;
  panelEl.classList.remove('hidden');
  // Mark all as read when viewing
  for (const e of entries) e.read = true;
  updateBadge();
  renderList();
}

function hideEventLog(): void {
  if (!panelEl) return;
  visible = false;
  panelEl.classList.add('hidden');
}

/** Clean up on game dispose */
export function disposeEventLog(): void {
  entries = [];
  visible = false;
  if (panelEl) {
    panelEl.remove();
    panelEl = null;
    listEl = null;
  }
  if (btnEl) {
    btnEl.remove();
    btnEl = null;
    badgeEl = null;
  }
  onNavigate = null;
}
