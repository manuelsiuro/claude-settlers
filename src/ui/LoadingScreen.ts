/** Loading screen with progress bar shown during asset loading */

const TIPS = [
  'Place Flags along roads to create efficient transport routes',
  'Build a Woodcutter near forests for quick lumber supply',
  'Connect buildings with roads through Flags for resource delivery',
  'Military buildings expand your territory — place them strategically',
  'Use Ctrl+1-5 to save camera bookmarks, 1-5 to recall them',
  'Hungry workers produce slower — keep food production running early',
  'The Marketplace lets you trade surplus resources for scarce ones',
  'Upgrade roads for faster transport: Path → Dirt → Stone → Paved',
  'Check building status diagnostics to find production bottlenecks',
  'Guard Huts are cheap but Fortresses project much larger territory',
  'Transporters carry goods between Flags — more roads need more transporters',
  'Gold Bars boost your knights\' combat strength across the kingdom',
  'Build Houses to increase your population capacity',
  'Production chains: Grain → Flour → Bread is the most efficient food',
  'Place related buildings close together to shorten delivery routes',
];

let overlayEl: HTMLDivElement | null = null;
let barFillEl: HTMLDivElement | null = null;
let percentEl: HTMLSpanElement | null = null;
let detailEl: HTMLSpanElement | null = null;

export function showLoadingScreen(): void {
  // Remove existing if re-entering
  hideLoadingScreen();

  overlayEl = document.createElement('div');
  overlayEl.id = 'loading-overlay';
  overlayEl.className = 'loading-overlay';

  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];

  overlayEl.innerHTML = `
    <div class="loading-card">
      <div class="loading-crown">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 20h20L19 9l-5 5-2-7-2 7-5-5z"/>
          <path d="M2 20h20"/>
        </svg>
      </div>
      <h1 class="loading-title">Feudal Realm Manager</h1>
      <div class="loading-bar-container">
        <div class="loading-bar-track">
          <div class="loading-bar-fill" id="loading-bar-fill"></div>
        </div>
        <div class="loading-stats">
          <span class="loading-percent" id="loading-percent">0%</span>
          <span class="loading-detail" id="loading-detail">Preparing...</span>
        </div>
      </div>
      <p class="loading-tip" id="loading-tip">${tip}</p>
    </div>
  `;

  document.body.appendChild(overlayEl);

  barFillEl = document.getElementById('loading-bar-fill') as HTMLDivElement;
  percentEl = document.getElementById('loading-percent') as HTMLSpanElement;
  detailEl = document.getElementById('loading-detail') as HTMLSpanElement;
}

export function updateLoadingProgress(loaded: number, total: number, name: string): void {
  if (!barFillEl || !percentEl || !detailEl) return;
  const pct = Math.round((loaded / total) * 100);
  barFillEl.style.width = `${pct}%`;
  percentEl.textContent = `${pct}%`;
  // Format model name for display: "iron_smelter" → "Iron Smelter"
  const displayName = name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  detailEl.textContent = `Loading ${displayName}... (${loaded}/${total})`;
}

export function hideLoadingScreen(): void {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
    barFillEl = null;
    percentEl = null;
    detailEl = null;
  }
}
