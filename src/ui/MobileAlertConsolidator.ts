/**
 * On mobile, collapses stacked alert bars to show only the most critical one
 * with a badge showing the count of hidden alerts. Tap badge to cycle through.
 */

let interval: ReturnType<typeof setInterval> | null = null;
let alertBar: HTMLElement | null = null;
let badge: HTMLElement | null = null;
let isDesktop = true;
let expanded = false;

export function initMobileAlertConsolidator(): void {
  alertBar = document.getElementById('alert-bar');
  badge = document.getElementById('alert-bar-badge');
  if (!alertBar || !badge) return;

  isDesktop = window.innerWidth > 768;
  window.addEventListener('resize', onResize);
  badge.addEventListener('click', onBadgeClick);

  // Poll every 2.5s (slightly after the 2s alert bar update interval)
  interval = setInterval(update, 2500);
  update();
}

export function disposeMobileAlertConsolidator(): void {
  if (interval !== null) clearInterval(interval);
  interval = null;
  window.removeEventListener('resize', onResize);
  if (badge) badge.removeEventListener('click', onBadgeClick);
  if (alertBar) alertBar.classList.remove('collapsed');
  alertBar = null;
  badge = null;
  expanded = false;
}

function onResize(): void {
  isDesktop = window.innerWidth > 768;
  update();
}

function onBadgeClick(): void {
  expanded = !expanded;
  update();
}

function update(): void {
  if (!alertBar || !badge) return;

  if (isDesktop || expanded) {
    alertBar.classList.remove('collapsed');
    badge.style.display = 'none';
    return;
  }

  // Count non-empty alert sections
  const children = Array.from(alertBar.children).filter(
    c => c.id !== 'alert-bar-badge'
  );
  const nonEmpty = children.filter(c => c.children.length > 0);
  const hiddenCount = Math.max(0, nonEmpty.length - 1);

  if (hiddenCount > 0) {
    alertBar.classList.add('collapsed');
    badge.textContent = `+${hiddenCount} more`;
    badge.style.display = 'flex';
  } else {
    alertBar.classList.remove('collapsed');
    badge.style.display = 'none';
  }
}
