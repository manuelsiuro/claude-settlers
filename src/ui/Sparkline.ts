/**
 * Draw a sparkline on a canvas element.
 * Normalizes data to canvas height and draws a polyline.
 */
export function drawSparkline(
  canvas: HTMLCanvasElement,
  data: number[],
  color: string,
): void {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx || data.length < 2) return;

  ctx.scale(dpr, dpr);

  const max = Math.max(...data, 0.01); // avoid division by zero
  const stepX = w / (data.length - 1);

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';

  for (let i = 0; i < data.length; i++) {
    const x = i * stepX;
    const y = h - (data[i] / max) * (h - 2) - 1; // 1px padding top/bottom
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.stroke();
}
