import type { TerrainType } from '../game/TerrainType';

/** State snapshot for a single tile */
export interface TileSnapshot {
  q: number;
  r: number;
  terrain: TerrainType;
  elevation: number;
  deposit?: { resource: string };
}

/** A group of tile changes from a single stroke */
export interface UndoCommand {
  before: TileSnapshot[];
  after: TileSnapshot[];
}

const MAX_UNDO_LEVELS = 100;

/**
 * Command-pattern undo/redo manager.
 * Each stroke (pointer-down to pointer-up) = one undo group.
 */
export class UndoManager {
  private undoStack: UndoCommand[] = [];
  private redoStack: UndoCommand[] = [];

  /** Callback invoked after undo/redo to refresh visuals */
  onChanged: (() => void) | null = null;

  execute(command: UndoCommand): void {
    if (command.before.length === 0 && command.after.length === 0) return;
    this.undoStack.push(command);
    this.redoStack.length = 0; // Clear redo on new action
    if (this.undoStack.length > MAX_UNDO_LEVELS) {
      this.undoStack.shift();
    }
  }

  undo(): UndoCommand | null {
    const cmd = this.undoStack.pop();
    if (!cmd) return null;
    this.redoStack.push(cmd);
    this.onChanged?.();
    return cmd;
  }

  redo(): UndoCommand | null {
    const cmd = this.redoStack.pop();
    if (!cmd) return null;
    this.undoStack.push(cmd);
    this.onChanged?.();
    return cmd;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undoCount(): number {
    return this.undoStack.length;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
