import type { Game } from '../engine/Game';
import type { TimeOfDay } from '../engine/AtmosphereController';

const PHASE_LABELS: Record<TimeOfDay, string> = {
  dawn: 'Dawn',
  morning: 'Morning',
  midday: 'Midday',
  golden_hour: 'Golden Hour',
  evening: 'Evening',
  night: 'Night',
};

const CANVAS_W = 80;
const CANVAS_H = 44;
const ARC_PAD_X = 8;
const ARC_PAD_TOP = 6;
const ARC_RADIUS_X = (CANVAS_W - ARC_PAD_X * 2) / 2;
const ARC_RADIUS_Y = CANVAS_H - ARC_PAD_TOP - 6; // leave room at bottom
const ARC_CX = CANVAS_W / 2;
const ARC_CY = CANVAS_H - 6;

let wrapper: HTMLDivElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let label: HTMLDivElement | null = null;
let rafId = 0;
let lastDrawTime = 0;
let getGameFn: (() => Game) | null = null;
let resizeObserver: ResizeObserver | null = null;

function skyColor(nightness: number): [string, string] {
  // Returns [topColor, bottomColor] for gradient
  if (nightness <= 0.1) return ['#5ba3e8', '#a8d4f0'];
  if (nightness <= 0.3) return ['#d4884a', '#e8c488'];
  if (nightness <= 0.6) return ['#a05530', '#cc8855'];
  return ['#1a2040', '#2a3355'];
}

function drawWidget(ctx: CanvasRenderingContext2D, dpr: number, game: Game): void {
  const atmo = game.getAtmosphereController();
  if (!atmo.isAutoCycling()) {
    if (wrapper) wrapper.classList.add('hidden');
    return;
  }
  if (wrapper) wrapper.classList.remove('hidden');

  const state = atmo.getCycleState();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Semicircular clip region
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(ARC_CX, ARC_CY, ARC_RADIUS_X + 2, ARC_RADIUS_Y + 2, 0, Math.PI, 0);
  ctx.lineTo(ARC_CX + ARC_RADIUS_X + 2, ARC_CY + 2);
  ctx.lineTo(ARC_CX - ARC_RADIUS_X - 2, ARC_CY + 2);
  ctx.closePath();
  ctx.clip();

  // Sky gradient fill
  const [topCol, botCol] = skyColor(state.nightness);
  const grad = ctx.createLinearGradient(0, ARC_PAD_TOP, 0, ARC_CY);
  grad.addColorStop(0, topCol);
  grad.addColorStop(1, botCol);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.restore();

  // Arc outline
  ctx.beginPath();
  ctx.ellipse(ARC_CX, ARC_CY, ARC_RADIUS_X, ARC_RADIUS_Y, 0, Math.PI, 0);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Ground line
  ctx.beginPath();
  ctx.moveTo(ARC_CX - ARC_RADIUS_X, ARC_CY);
  ctx.lineTo(ARC_CX + ARC_RADIUS_X, ARC_CY);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Sun/moon position
  const sunAngle = state.sunAngle;
  const isNight = sunAngle < 15 || sunAngle > 175;

  let iconX: number, iconY: number;
  if (isNight) {
    // Moon at top-center of arc
    iconX = ARC_CX;
    iconY = ARC_CY - ARC_RADIUS_Y;
  } else {
    // Map sunAngle 15→175 to π→0 (left to right on semicircle)
    const t = (sunAngle - 15) / (175 - 15); // 0..1
    const theta = Math.PI * (1 - t); // π..0
    iconX = ARC_CX + ARC_RADIUS_X * Math.cos(theta);
    iconY = ARC_CY - ARC_RADIUS_Y * Math.sin(theta);
  }

  if (isNight) {
    // Moon: silver crescent
    ctx.beginPath();
    ctx.arc(iconX, iconY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#d0d8e8';
    ctx.fill();
    // Cut out crescent
    ctx.beginPath();
    ctx.arc(iconX + 2, iconY - 1, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = skyColor(state.nightness)[0];
    ctx.fill();
  } else {
    // Sun: golden circle with rays
    ctx.beginPath();
    ctx.arc(iconX, iconY, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd54f';
    ctx.fill();
    // Rays
    ctx.strokeStyle = 'rgba(255,213,79,0.6)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(iconX + Math.cos(a) * 5, iconY + Math.sin(a) * 5);
      ctx.lineTo(iconX + Math.cos(a) * 7, iconY + Math.sin(a) * 7);
      ctx.stroke();
    }
  }

  // Update phase label
  if (label) {
    const phaseName = state.transitioning
      ? `${PHASE_LABELS[state.phase]} → ${PHASE_LABELS[state.targetPhase]}`
      : PHASE_LABELS[state.phase];
    label.textContent = phaseName;
  }
}

function tick(time: number): void {
  rafId = requestAnimationFrame(tick);
  // Throttle drawing to ~4fps (250ms)
  if (time - lastDrawTime < 250) return;
  lastDrawTime = time;

  if (!canvas || !getGameFn) return;
  const game = getGameFn();
  if (!game) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  drawWidget(ctx, dpr, game);
}

function positionWidget(minimapContainer: HTMLElement): void {
  if (!wrapper) return;
  const rect = minimapContainer.getBoundingClientRect();
  wrapper.style.top = `${rect.bottom + 4}px`;
}

export function initDayCycleWidget(
  getGame: () => Game,
  minimapContainer: HTMLElement,
): void {
  disposeDayCycleWidget();
  getGameFn = getGame;

  // Create wrapper
  wrapper = document.createElement('div');
  wrapper.className = 'cycle-widget hidden';

  // Create canvas (retina-aware)
  canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = CANVAS_W * dpr;
  canvas.height = CANVAS_H * dpr;
  canvas.style.width = `${CANVAS_W}px`;
  canvas.style.height = `${CANVAS_H}px`;
  canvas.style.display = 'block';
  wrapper.appendChild(canvas);

  // Phase label
  label = document.createElement('div');
  label.className = 'cycle-widget-label';
  wrapper.appendChild(label);

  document.body.appendChild(wrapper);

  // Position below minimap
  positionWidget(minimapContainer);
  resizeObserver = new ResizeObserver(() => positionWidget(minimapContainer));
  resizeObserver.observe(minimapContainer);

  // Start render loop
  lastDrawTime = 0;
  rafId = requestAnimationFrame(tick);
}

export function disposeDayCycleWidget(): void {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  resizeObserver?.disconnect();
  resizeObserver = null;
  wrapper?.remove();
  wrapper = null;
  canvas = null;
  label = null;
  getGameFn = null;
}
