/**
 * Gesture-driven bottom sheet controller for mobile panels.
 *
 * Uses transform: translateY() for GPU-composited animations.
 * Supports configurable snap points, velocity-based fling, and
 * swipe-to-dismiss. Content scrolling is only enabled at the
 * maximum snap point to prevent scroll-vs-drag conflicts.
 */

export interface BottomSheetOptions {
  /** Snap point heights in vh (how much of viewport the sheet covers). E.g., [30, 75] */
  snapPoints: number[];
  /** Called when snap index changes. -1 = hidden */
  onStateChange?: (snapIndex: number) => void;
  /** Called after dismiss transition completes */
  onDismiss?: () => void;
}

/** Velocity threshold in px/ms for fling gestures */
const FLING_THRESHOLD = 0.4;
/** Transition for animated snaps */
const SNAP_TRANSITION = 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)';
/** Height of the draggable header region in px */
const HANDLE_HEIGHT = 56;

function vhToPx(vh: number): number {
  return (vh / 100) * window.innerHeight;
}

export class BottomSheetController {
  private el: HTMLElement;
  private opts: BottomSheetOptions;
  private currentSnap = -1; // -1 = hidden

  // Drag state
  private isDragging = false;
  private dragStartY = 0;
  private dragStartTranslateY = 0;
  private lastTouchY = 0;
  private lastTouchTime = 0;
  private velocity = 0;

  // Bound handlers for cleanup
  private handleTouchStart: (e: TouchEvent) => void;
  private handleTouchMove: (e: TouchEvent) => void;
  private handleTouchEnd: (e: TouchEvent) => void;

  constructor(element: HTMLElement, options: BottomSheetOptions) {
    this.el = element;
    this.opts = options;

    this.handleTouchStart = this.onTouchStart.bind(this);
    this.handleTouchMove = this.onTouchMove.bind(this);
    this.handleTouchEnd = this.onTouchEnd.bind(this);

    this.bindEvents();
  }

  private bindEvents(): void {
    this.el.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    this.el.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.el.addEventListener('touchend', this.handleTouchEnd, { passive: true });
  }

  private onTouchStart(e: TouchEvent): void {
    const touch = e.touches[0];
    const rect = this.el.getBoundingClientRect();
    const touchLocalY = touch.clientY - rect.top;

    // Only drag from the handle/header region (top HANDLE_HEIGHT px of visible sheet)
    if (touchLocalY > HANDLE_HEIGHT) return;

    this.isDragging = true;
    this.dragStartY = touch.clientY;
    this.dragStartTranslateY = this.getTranslateY();
    this.lastTouchY = touch.clientY;
    this.lastTouchTime = Date.now();
    this.velocity = 0;

    // Disable CSS transition during drag for immediate response
    this.el.style.transition = 'none';
  }

  private onTouchMove(e: TouchEvent): void {
    if (!this.isDragging) return;
    e.preventDefault(); // Prevent page scroll during sheet drag

    const touch = e.touches[0];
    const deltaY = touch.clientY - this.dragStartY;
    // Only allow dragging downward from start or back up (but not above 0)
    const newTranslateY = Math.max(0, this.dragStartTranslateY + deltaY);

    this.el.style.transform = `translateY(${newTranslateY}px)`;

    // Track velocity for fling detection
    const now = Date.now();
    const dt = now - this.lastTouchTime;
    if (dt > 0) {
      this.velocity = (touch.clientY - this.lastTouchY) / dt; // px/ms, positive = downward
    }
    this.lastTouchY = touch.clientY;
    this.lastTouchTime = now;
  }

  private onTouchEnd(): void {
    if (!this.isDragging) return;
    this.isDragging = false;

    // Re-enable CSS transition for animated snap
    this.el.style.transition = SNAP_TRANSITION;

    const currentTranslateY = this.getTranslateY();
    const elementHeight = this.el.offsetHeight;
    const currentVisiblePx = elementHeight - currentTranslateY;

    if (this.velocity > FLING_THRESHOLD) {
      // Fling downward → go to next lower snap or dismiss
      this.resolveSnap(currentVisiblePx, 'down');
    } else if (this.velocity < -FLING_THRESHOLD) {
      // Fling upward → go to next higher snap
      this.resolveSnap(currentVisiblePx, 'up');
    } else {
      // No fling → snap to nearest
      this.resolveSnap(currentVisiblePx, null);
    }
  }

  private resolveSnap(currentVisiblePx: number, direction: 'up' | 'down' | null): void {
    const snapPointsPx = this.opts.snapPoints.map(vhToPx);

    if (direction === 'down') {
      // Find next lower snap point below current position
      const lower = snapPointsPx.filter(sp => sp < currentVisiblePx - 10);
      if (lower.length > 0) {
        const target = Math.max(...lower);
        this.snapTo(snapPointsPx.indexOf(target));
      } else {
        this.dismiss();
      }
    } else if (direction === 'up') {
      // Find next higher snap point above current position
      const higher = snapPointsPx.filter(sp => sp > currentVisiblePx + 10);
      if (higher.length > 0) {
        const target = Math.min(...higher);
        this.snapTo(snapPointsPx.indexOf(target));
      } else {
        // Already at max snap
        this.snapTo(this.opts.snapPoints.length - 1);
      }
    } else {
      // Snap to nearest, with dismiss threshold at half of lowest snap
      const lowestSnap = snapPointsPx[0];
      if (currentVisiblePx < lowestSnap * 0.5) {
        this.dismiss();
        return;
      }

      let nearestIdx = 0;
      let nearestDist = Infinity;
      for (let i = 0; i < snapPointsPx.length; i++) {
        const dist = Math.abs(snapPointsPx[i] - currentVisiblePx);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      }
      this.snapTo(nearestIdx);
    }
  }

  private getTranslateY(): number {
    const style = getComputedStyle(this.el);
    const matrix = new DOMMatrix(style.transform);
    return matrix.m42;
  }

  /** Set max-height based on largest snap point to ensure sheet is tall enough */
  private ensureHeight(): void {
    const maxSnap = Math.max(...this.opts.snapPoints);
    const isMobile = window.innerWidth <= 768;
    const toolbarPx = isMobile ? 56 : 0;
    this.el.style.maxHeight = `calc(${maxSnap}vh + ${toolbarPx}px)`;
  }

  /** Open the sheet at the given snap point index (0 = peek, last = expanded) */
  open(snapIndex = 0): void {
    if (snapIndex < 0 || snapIndex >= this.opts.snapPoints.length) return;

    this.ensureHeight();

    // Remove desktop hidden class and set initial off-screen position
    this.el.classList.remove('hidden');
    this.el.style.visibility = 'visible';
    this.el.style.pointerEvents = '';
    this.el.style.transition = 'none';
    this.el.style.transform = 'translateY(100%)';

    // Force reflow so transition works from the off-screen position
    void this.el.offsetHeight;

    // Animate to target snap
    this.el.style.transition = SNAP_TRANSITION;
    this.applySnap(snapIndex);
  }

  /** Snap to a specific index without the initial setup (for when already open) */
  snapTo(index: number): void {
    if (index < 0 || index >= this.opts.snapPoints.length) return;
    this.el.style.transition = SNAP_TRANSITION;
    this.applySnap(index);
  }

  private applySnap(index: number): void {
    const targetVisiblePx = vhToPx(this.opts.snapPoints[index]);
    const elementHeight = this.el.offsetHeight;
    const translateY = Math.max(0, elementHeight - targetVisiblePx);

    this.el.style.transform = `translateY(${translateY}px)`;

    const prevSnap = this.currentSnap;
    this.currentSnap = index;

    if (prevSnap !== index) {
      this.opts.onStateChange?.(index);
    }

    // Enable content scrolling only at the max snap point
    this.updateContentScroll(index);
  }

  private updateContentScroll(snapIndex: number): void {
    const content = this.el.querySelector(
      '.info-panel-content, .build-panel-content, .stats-panel-content'
    ) as HTMLElement | null;
    if (content) {
      content.style.overflowY = snapIndex === this.opts.snapPoints.length - 1 ? 'auto' : 'hidden';
    }
  }

  /** Dismiss the sheet with animation */
  dismiss(): void {
    this.el.style.transition = SNAP_TRANSITION;
    this.el.style.transform = 'translateY(100%)';

    const prevSnap = this.currentSnap;
    this.currentSnap = -1;

    if (prevSnap !== -1) {
      this.opts.onStateChange?.(-1);
    }

    // Hide completely after transition
    const onEnd = () => {
      if (this.currentSnap === -1) {
        this.el.style.visibility = 'hidden';
        this.el.style.pointerEvents = 'none';
      }
      this.el.removeEventListener('transitionend', onEnd);
      this.opts.onDismiss?.();
    };
    this.el.addEventListener('transitionend', onEnd, { once: true });

    // Fallback timeout in case transitionend doesn't fire
    setTimeout(() => {
      if (this.currentSnap === -1) {
        this.el.style.visibility = 'hidden';
        this.el.style.pointerEvents = 'none';
      }
    }, 400);
  }

  /** Current snap index (-1 = hidden) */
  getCurrentSnap(): number {
    return this.currentSnap;
  }

  /** Whether the sheet is currently open at any snap point */
  get isOpen(): boolean {
    return this.currentSnap >= 0;
  }

  /** Clean up event listeners */
  destroy(): void {
    this.el.removeEventListener('touchstart', this.handleTouchStart);
    this.el.removeEventListener('touchmove', this.handleTouchMove);
    this.el.removeEventListener('touchend', this.handleTouchEnd);
  }
}
