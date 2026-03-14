export class PerformanceMonitor {
  private element: HTMLElement;
  private frames = 0;
  private lastTime = performance.now();
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.element = document.createElement('div');
    Object.assign(this.element.style, {
      position: 'fixed',
      top: '8px',
      right: '8px',
      background: 'rgba(0,0,0,0.7)',
      color: '#0f0',
      fontFamily: 'monospace',
      fontSize: '12px',
      padding: '4px 8px',
      borderRadius: '4px',
      zIndex: '9999',
      pointerEvents: 'none',
    });

    // Only show in dev mode or with ?fps param
    const shouldShow =
      (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
      new URLSearchParams(window.location.search).has('fps');
    if (!shouldShow) return;

    document.body.appendChild(this.element);
    this.intervalId = setInterval(() => this.updateDisplay(), 500);
  }

  /** Call once per frame in the animate loop */
  tick(): void {
    this.frames++;
  }

  private updateDisplay(): void {
    const now = performance.now();
    const elapsed = (now - this.lastTime) / 1000;
    const fps = Math.round(this.frames / elapsed);
    this.element.textContent = `${fps} FPS`;
    this.frames = 0;
    this.lastTime = now;
  }

  dispose(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.element.remove();
  }
}
