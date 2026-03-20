/**
 * Canvas-based chart rendering for the Dashboard.
 * DPI-aware, theme-aware (reads CSS custom properties), no external dependencies.
 */

// ============================================================
// Shared utilities
// ============================================================

function getThemeColors(el: HTMLElement) {
  const style = getComputedStyle(el);
  return {
    text: style.getPropertyValue('--color-on-surface').trim() || '#1a1a1a',
    textMuted: style.getPropertyValue('--color-on-surface-faint').trim() || '#999',
    gridLine: style.getPropertyValue('--color-outline-variant').trim() || '#e0e0e0',
    surface: style.getPropertyValue('--color-surface').trim() || '#fafaf7',
  };
}

function setupCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; w: number; h: number; dpr: number } | null {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w === 0 || h === 0) return null;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(dpr, dpr);
  return { ctx, w, h, dpr };
}

// ============================================================
// Line Chart
// ============================================================

export interface LineSeries {
  data: number[];
  color: string;
  label?: string;
  dashed?: boolean;
  fillAlpha?: number;
}

export interface LineChartOptions {
  yMin?: number;
  yMax?: number;
  gridLines?: number;
  xLabels?: string[];
  yLabelFormat?: (v: number) => string;
  padding?: { top: number; right: number; bottom: number; left: number };
  zeroLine?: boolean;
}

export function drawLineChart(
  canvas: HTMLCanvasElement,
  series: LineSeries[],
  options?: LineChartOptions,
): void {
  const setup = setupCanvas(canvas);
  if (!setup) return;
  const { ctx, w, h } = setup;
  const theme = getThemeColors(canvas);

  const pad = options?.padding ?? { top: 12, right: 12, bottom: 24, left: 40 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  if (chartW <= 0 || chartH <= 0) return;

  // Compute y-axis range
  let yMin = options?.yMin ?? Infinity;
  let yMax = options?.yMax ?? -Infinity;
  for (const s of series) {
    for (const v of s.data) {
      if (v < yMin) yMin = v;
      if (v > yMax) yMax = v;
    }
  }
  if (!isFinite(yMin)) yMin = 0;
  if (!isFinite(yMax)) yMax = 1;
  if (yMax === yMin) yMax = yMin + 1;

  const yRange = yMax - yMin;
  const toY = (v: number) => pad.top + chartH - ((v - yMin) / yRange) * chartH;
  const toX = (i: number, len: number) => pad.left + (i / (len - 1)) * chartW;

  // Grid lines
  const gridCount = options?.gridLines ?? 4;
  ctx.strokeStyle = theme.gridLine;
  ctx.lineWidth = 0.5;
  ctx.fillStyle = theme.textMuted;
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const fmt = options?.yLabelFormat ?? ((v: number) => v % 1 === 0 ? String(v) : v.toFixed(1));

  for (let i = 0; i <= gridCount; i++) {
    const v = yMin + (yRange * i) / gridCount;
    const y = toY(v);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    ctx.fillText(fmt(v), pad.left - 4, y);
  }

  // Zero line
  if (options?.zeroLine && yMin < 0 && yMax > 0) {
    const y0 = toY(0);
    ctx.strokeStyle = theme.text;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.left, y0);
    ctx.lineTo(w - pad.right, y0);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // X-axis labels
  if (options?.xLabels) {
    ctx.fillStyle = theme.textMuted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const labels = options.xLabels;
    for (let i = 0; i < labels.length; i++) {
      const x = pad.left + (i / (labels.length - 1)) * chartW;
      ctx.fillText(labels[i], x, h - pad.bottom + 4);
    }
  }

  // Draw each series
  for (const s of series) {
    if (s.data.length < 2) continue;

    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (s.dashed) ctx.setLineDash([6, 4]);
    else ctx.setLineDash([]);

    ctx.beginPath();
    for (let i = 0; i < s.data.length; i++) {
      const x = toX(i, s.data.length);
      const y = toY(s.data[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill area under line
    if (s.fillAlpha && s.fillAlpha > 0) {
      ctx.lineTo(toX(s.data.length - 1, s.data.length), pad.top + chartH);
      ctx.lineTo(toX(0, s.data.length), pad.top + chartH);
      ctx.closePath();
      ctx.globalAlpha = s.fillAlpha;
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  ctx.setLineDash([]);
}

// ============================================================
// Dual Bar Chart (production vs consumption)
// ============================================================

export interface DualBarItem {
  label: string;
  production: number;
  consumption: number;
  iconHtml?: string;
}

export interface DualBarChartOptions {
  barHeight?: number;
  gap?: number;
  padding?: { top: number; right: number; bottom: number; left: number };
}

export function drawDualBarChart(
  canvas: HTMLCanvasElement,
  items: DualBarItem[],
  options?: DualBarChartOptions,
): void {
  const setup = setupCanvas(canvas);
  if (!setup || items.length === 0) return;
  const { ctx, w, h } = setup;
  const theme = getThemeColors(canvas);

  const barH = options?.barHeight ?? 20;
  const gap = options?.gap ?? 6;
  const pad = options?.padding ?? { top: 8, right: 60, bottom: 8, left: 90 };

  const chartW = w - pad.left - pad.right;
  const centerX = pad.left + chartW / 2;

  // Find max rate for scaling
  let maxRate = 0;
  for (const item of items) {
    maxRate = Math.max(maxRate, item.production, item.consumption);
  }
  if (maxRate === 0) maxRate = 1;

  const halfW = chartW / 2;

  // Center axis
  ctx.strokeStyle = theme.gridLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX, pad.top);
  ctx.lineTo(centerX, h - pad.bottom);
  ctx.stroke();

  ctx.font = '11px system-ui, sans-serif';

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const y = pad.top + i * (barH + gap);

    // Label (left)
    ctx.fillStyle = theme.text;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, pad.left - 6, y + barH / 2);

    // Production bar (right from center, green)
    const prodW = (item.production / maxRate) * halfW;
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(centerX + 1, y, prodW, barH);

    // Consumption bar (left from center, red)
    const consW = (item.consumption / maxRate) * halfW;
    ctx.fillStyle = '#EF5350';
    ctx.fillRect(centerX - consW - 1, y, consW, barH);

    // Net balance text (right side)
    const net = item.production - item.consumption;
    const netStr = (net >= 0 ? '+' : '') + net.toFixed(1);
    ctx.fillStyle = net >= 0 ? '#4CAF50' : '#EF5350';
    ctx.textAlign = 'left';
    ctx.fillText(netStr, w - pad.right + 6, y + barH / 2);
  }
}

// ============================================================
// Donut Chart
// ============================================================

export interface DonutSegment {
  value: number;
  color: string;
  label: string;
}

export interface DonutChartOptions {
  innerRadiusRatio?: number;
  centerText?: string;
  centerSubText?: string;
}

export function drawDonutChart(
  canvas: HTMLCanvasElement,
  segments: DonutSegment[],
  options?: DonutChartOptions,
): void {
  const setup = setupCanvas(canvas);
  if (!setup) return;
  const { ctx, w, h } = setup;
  const theme = getThemeColors(canvas);

  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(cx, cy) - 20;
  const innerRatio = options?.innerRadiusRatio ?? 0.6;
  const innerRadius = radius * innerRatio;

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    // Draw empty donut
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2, true);
    ctx.fillStyle = theme.gridLine;
    ctx.fill();
  } else {
    let angle = -Math.PI / 2;
    for (const seg of segments) {
      const sweep = (seg.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, angle, angle + sweep);
      ctx.arc(cx, cy, innerRadius, angle + sweep, angle, true);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();
      angle += sweep;
    }
  }

  // Center text
  if (options?.centerText) {
    ctx.fillStyle = theme.text;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(options.centerText, cx, cy - (options.centerSubText ? 8 : 0));
  }
  if (options?.centerSubText) {
    ctx.fillStyle = theme.textMuted;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(options.centerSubText, cx, cy + 12);
  }
}

// ============================================================
// Chart time labels helper
// ============================================================

/** Generate x-axis time labels for a given number of data points at 30s intervals */
export function generateTimeLabels(pointCount: number, labelsCount = 5): string[] {
  if (pointCount <= 1) return ['now'];
  const labels: string[] = [];
  for (let i = 0; i < labelsCount; i++) {
    const idx = Math.round((i / (labelsCount - 1)) * (pointCount - 1));
    const secsAgo = (pointCount - 1 - idx) * 30;
    if (secsAgo === 0) labels.push('now');
    else if (secsAgo < 60) labels.push(`${secsAgo}s`);
    else labels.push(`${Math.round(secsAgo / 60)}m`);
  }
  return labels;
}
