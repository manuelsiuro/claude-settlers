/**
 * Shared panel update utility that prevents DOM flickering.
 * Uses dual-path rendering: full rebuild when structure changes,
 * targeted value patches otherwise.
 */
export class PanelUpdater {
  private lastStructureKey = '';
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Smart update: full rebuild if structure changed, quick patch otherwise.
   * @param structureKey - fingerprint of what HTML sections/rows exist
   * @param renderHTML - returns full HTML string for the panel
   * @param updateValues - patches dynamic values via setText/setWidth/setClass
   * @param afterRebuild - optional callback after full rebuild (e.g. draw canvases)
   */
  update(
    structureKey: string,
    renderHTML: () => string,
    updateValues: () => void,
    afterRebuild?: () => void,
  ): void {
    if (structureKey !== this.lastStructureKey) {
      const scrollTop = this.container.scrollTop;
      this.container.innerHTML = renderHTML();
      this.container.scrollTop = scrollTop;
      afterRebuild?.();
      this.lastStructureKey = structureKey;
    } else {
      updateValues();
    }
  }

  /** Reset state (call on panel close) */
  reset(): void {
    this.lastStructureKey = '';
  }

  /** Set textContent of [data-field] element, compare-before-set */
  setText(field: string, text: string): void {
    const el = this.container.querySelector(`[data-field="${field}"]`);
    if (el && el.textContent !== text) {
      el.textContent = text;
    }
  }

  /** Set style.width of [data-field] element, compare-before-set */
  setWidth(field: string, pct: string): void {
    const el = this.container.querySelector(`[data-field="${field}"]`) as HTMLElement | null;
    if (el && el.style.width !== pct) {
      el.style.width = pct;
    }
  }

  /** Set className of [data-field] element, compare-before-set */
  setClass(field: string, className: string): void {
    const el = this.container.querySelector(`[data-field="${field}"]`);
    if (el && el.className !== className) {
      el.className = className;
    }
  }

  /** Set style.color of [data-field] element, compare-before-set */
  setColor(field: string, color: string): void {
    const el = this.container.querySelector(`[data-field="${field}"]`) as HTMLElement | null;
    if (el && el.style.color !== color) {
      el.style.color = color;
    }
  }

  /** Set style.background of [data-field] element, compare-before-set */
  setBackground(field: string, color: string): void {
    const el = this.container.querySelector(`[data-field="${field}"]`) as HTMLElement | null;
    if (el && el.style.background !== color) {
      el.style.background = color;
    }
  }
}
