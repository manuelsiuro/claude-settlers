import type * as THREE from 'three';

export class PerformanceMonitor {
  private element: HTMLElement;
  private frames = 0;
  private lastTime = performance.now();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private _visible = false;
  private renderer: THREE.WebGLRenderer | null = null;

  constructor() {
    this.element = document.createElement('div');
    Object.assign(this.element.style, {
      position: 'fixed',
      top: '8px',
      right: '8px',
      background: 'rgba(0,0,0,0.7)',
      color: '#0f0',
      fontFamily: 'monospace',
      fontSize: '11px',
      padding: '4px 8px',
      borderRadius: '4px',
      zIndex: '9999',
      pointerEvents: 'none',
      lineHeight: '1.4',
      display: 'none',
    });

    document.body.appendChild(this.element);

    // Auto-show in dev mode or with ?fps param
    const shouldShow =
      (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
      new URLSearchParams(window.location.search).has('fps');
    if (shouldShow) this.show();
  }

  /** Set the renderer for draw call stats */
  setRenderer(renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
  }

  show(): void {
    this._visible = true;
    this.element.style.display = '';
    if (!this.intervalId) {
      this.intervalId = setInterval(() => this.updateDisplay(), 500);
    }
  }

  hide(): void {
    this._visible = false;
    this.element.style.display = 'none';
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  toggle(): void {
    if (this._visible) this.hide();
    else this.show();
  }

  get visible(): boolean { return this._visible; }

  /** Call once per frame in the animate loop */
  tick(): void {
    this.frames++;
  }

  private updateDisplay(): void {
    const now = performance.now();
    const elapsed = (now - this.lastTime) / 1000;
    const fps = Math.round(this.frames / elapsed);
    let text = `${fps} FPS`;
    if (this.renderer) {
      const info = this.renderer.info;
      text += `\n${info.render.calls} draws`;
      text += `\n${(info.render.triangles / 1000).toFixed(0)}K tris`;
      text += `\n${info.memory.geometries} geom`;
    }
    this.element.textContent = text;
    this.element.style.whiteSpace = 'pre';
    this.frames = 0;
    this.lastTime = now;
  }

  dispose(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.element.remove();
  }
}
