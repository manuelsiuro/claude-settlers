import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';
import { TerrainType } from '../game/TerrainType';
import { ResourceType } from '../game/ResourceType';
import type { MapEditor } from './MapEditor';
import type { EditorState } from './MapEditorState';
import { EditorTool, DepositCycle } from './MapEditorState';
import type { UndoCommand, TileSnapshot } from './UndoManager';
import type { StartingPosition } from '../game/MapData';

const BRUSH_HIGHLIGHT_COLOR = 0xffff00;
const BRUSH_HIGHLIGHT_OPACITY = 0.2;

/**
 * Manages all editor tools: pointer event routing, brush preview, undo grouping.
 */
export class MapEditorTools {
  private editor: MapEditor;
  private state: EditorState;
  private currentStroke: Map<string, { before: TileSnapshot; after: TileSnapshot }> = new Map();
  private brushPreviewMeshes: THREE.Mesh[] = [];
  private lastHoverHex: { q: number; r: number } | null = null;

  /** Status message for the UI */
  onStatusChange: ((status: string) => void) | null = null;

  constructor(editor: MapEditor, state: EditorState) {
    this.editor = editor;
    this.state = state;

    // Wire editor pointer events
    editor.onPointerDown = (q, r, alt) => this.handlePointerDown(q, r, alt);
    editor.onPointerMove = (q, r, alt) => this.handlePointerMove(q, r, alt);
    editor.onPointerUp = () => this.handlePointerUp();
    editor.onHoverHex = (q, r) => this.handleHover(q, r);

    // Wire undo/redo to apply snapshots
    editor.undoManager.onChanged = () => {};
  }

  getState(): EditorState {
    return this.state;
  }

  setState(partial: Partial<EditorState>): void {
    Object.assign(this.state, partial);
    // Update brush preview on tool/size change
    if (this.lastHoverHex) {
      this.updateBrushPreview(this.lastHoverHex.q, this.lastHoverHex.r);
    }
  }

  undo(): void {
    const cmd = this.editor.undoManager.undo();
    if (cmd) {
      this.editor.applySnapshots(cmd.before);
    }
  }

  redo(): void {
    const cmd = this.editor.undoManager.redo();
    if (cmd) {
      this.editor.applySnapshots(cmd.after);
    }
  }

  dispose(): void {
    this.clearBrushPreview();
  }

  // ─── Pointer Handlers ─────────────────────────────────────────────────

  private handlePointerDown(q: number, r: number, altKey: boolean): void {
    this.currentStroke.clear();

    switch (this.state.tool) {
      case EditorTool.Terrain:
        this.applyTerrainBrush(q, r);
        break;
      case EditorTool.Elevation:
        this.applyElevationBrush(q, r, altKey);
        break;
      case EditorTool.Deposit:
        this.applyDepositTool(q, r);
        break;
      case EditorTool.StartPosition:
        this.applyStartPositionTool(q, r);
        break;
      case EditorTool.Fill:
        this.applyFillTool(q, r);
        break;
      case EditorTool.Eraser:
        this.applyEraserBrush(q, r);
        break;
      case EditorTool.Building:
        this.applyBuildingTool(q, r);
        break;
      case EditorTool.Flag:
        this.applyFlagTool(q, r);
        break;
      case EditorTool.Road:
        this.applyRoadTool(q, r);
        break;
    }
  }

  private handlePointerMove(q: number, r: number, altKey: boolean): void {
    // Continuous painting for brush-based tools
    switch (this.state.tool) {
      case EditorTool.Terrain:
        this.applyTerrainBrush(q, r);
        break;
      case EditorTool.Elevation:
        this.applyElevationBrush(q, r, altKey);
        break;
      case EditorTool.Eraser:
        this.applyEraserBrush(q, r);
        break;
    }
    this.updateBrushPreview(q, r);
  }

  private handlePointerUp(): void {
    // Commit the stroke as a single undo command
    if (this.currentStroke.size > 0) {
      const cmd: UndoCommand = {
        before: [],
        after: [],
      };
      for (const entry of this.currentStroke.values()) {
        cmd.before.push(entry.before);
        cmd.after.push(entry.after);
      }
      this.editor.undoManager.execute(cmd);
      this.currentStroke.clear();
    }
  }

  private handleHover(q: number, r: number): void {
    this.lastHoverHex = { q, r };
    this.updateBrushPreview(q, r);
  }

  // ─── Tool Implementations ─────────────────────────────────────────────

  private applyTerrainBrush(centerQ: number, centerR: number): void {
    const hexes = this.getHexesInBrush(centerQ, centerR, this.state.brushSize);
    const grid = this.editor.getGrid();

    for (const { q, r } of hexes) {
      if (!grid.isInBounds(q, r)) continue;
      const tile = grid.getTile(q, r);
      if (!tile || tile.terrain === this.state.terrainType) continue;

      this.recordBefore(q, r);

      // Remove deposits when changing from Mountain
      const deposit = this.state.terrainType === TerrainType.Mountain ? tile.deposit : undefined;
      grid.setTile(q, r, this.state.terrainType, tile.elevation, deposit);

      this.recordAfter(q, r);
    }

    this.editor.rebuildTerrain();
    this.onStatusChange?.(`Painting ${this.state.terrainType}`);
  }

  private applyElevationBrush(centerQ: number, centerR: number, lower: boolean): void {
    const hexes = this.getHexesInBrush(centerQ, centerR, this.state.brushSize);
    const grid = this.editor.getGrid();

    for (const { q, r } of hexes) {
      if (!grid.isInBounds(q, r)) continue;
      const tile = grid.getTile(q, r);
      if (!tile) continue;

      this.recordBefore(q, r);

      // Gaussian falloff from center
      const dist = this.hexDistance(centerQ, centerR, q, r);
      const falloff = Math.exp(-dist * dist * 0.5);
      const delta = (lower ? -0.05 : 0.05) * falloff;
      const newElev = Math.max(0, Math.min(1, tile.elevation + delta));
      grid.setTile(q, r, tile.terrain, newElev, tile.deposit);

      this.recordAfter(q, r);
    }

    this.editor.rebuildTerrain();
    this.onStatusChange?.(lower ? 'Lowering elevation' : 'Raising elevation');
  }

  private applyDepositTool(q: number, r: number): void {
    const grid = this.editor.getGrid();
    const tile = grid.getTile(q, r);
    if (!tile) return;

    if (tile.terrain !== TerrainType.Mountain) {
      this.onStatusChange?.('Deposits can only be placed on Mountain tiles');
      return;
    }

    this.recordBefore(q, r);

    // Cycle: none → iron → coal → gold → none
    const currentResource = tile.deposit?.resource ?? 'none';
    const currentIdx = DepositCycle.indexOf(currentResource as typeof DepositCycle[number]);
    const nextIdx = (currentIdx + 1) % DepositCycle.length;
    const next = DepositCycle[nextIdx];

    if (next === 'none') {
      grid.setTile(q, r, tile.terrain, tile.elevation);
    } else {
      grid.setTile(q, r, tile.terrain, tile.elevation, {
        resource: next as ResourceType,
        revealed: false,
        claimed: false,
      });
    }

    this.recordAfter(q, r);
    this.commitStroke();
    this.editor.rebuildTerrain();
    this.onStatusChange?.(next === 'none' ? 'Removed deposit' : `Placed ${next} deposit`);
  }

  private applyStartPositionTool(q: number, r: number): void {
    const grid = this.editor.getGrid();
    const tile = grid.getTile(q, r);
    if (!tile) return;

    if (tile.terrain === TerrainType.Water || tile.terrain === TerrainType.Mountain) {
      this.onStatusChange?.('Start positions must be on buildable terrain');
      return;
    }

    const positions = [...this.editor.getStartingPositions()];
    const playerId = this.state.selectedPlayer;

    // Check if clicking on an existing start position to remove it
    const existingIdx = positions.findIndex(
      (p) => p.q === q && p.r === r,
    );
    if (existingIdx >= 0) {
      positions.splice(existingIdx, 1);
      this.editor.setStartingPositions(positions);
      this.onStatusChange?.(`Removed Player ${positions[existingIdx]?.playerId ?? '?'} start`);
      return;
    }

    // Replace existing position for this player, or add new
    const playerIdx = positions.findIndex((p) => p.playerId === playerId);
    const newPos: StartingPosition = { playerId, q, r };
    if (playerIdx >= 0) {
      positions[playerIdx] = newPos;
    } else {
      positions.push(newPos);
    }

    this.editor.setStartingPositions(positions);
    this.onStatusChange?.(`Placed Player ${playerId} start`);
  }

  private applyFillTool(q: number, r: number): void {
    const grid = this.editor.getGrid();
    const tile = grid.getTile(q, r);
    if (!tile) return;

    const sourceTerrain = tile.terrain;
    if (sourceTerrain === this.state.terrainType) return; // No-op

    // BFS flood fill with safety cap
    const visited = new Set<string>();
    const queue: { q: number; r: number }[] = [{ q, r }];
    const MAX_FILL = 500;
    let filled = 0;

    while (queue.length > 0 && filled < MAX_FILL) {
      const curr = queue.shift();
      if (!curr) break;
      const key = HexGrid.key(curr.q, curr.r);
      if (visited.has(key)) continue;
      visited.add(key);

      const t = grid.getTile(curr.q, curr.r);
      if (!t || t.terrain !== sourceTerrain) continue;

      this.recordBefore(curr.q, curr.r);
      const deposit = this.state.terrainType === TerrainType.Mountain ? t.deposit : undefined;
      grid.setTile(curr.q, curr.r, this.state.terrainType, t.elevation, deposit);
      this.recordAfter(curr.q, curr.r);
      filled++;

      // Add neighbors
      const neighbors = grid.getNeighbors(curr.q, curr.r);
      for (const n of neighbors) {
        if (!visited.has(HexGrid.key(n.coord.q, n.coord.r))) {
          queue.push({ q: n.coord.q, r: n.coord.r });
        }
      }
    }

    this.commitStroke();
    this.editor.rebuildTerrain();
    this.onStatusChange?.(`Filled ${filled} tiles with ${this.state.terrainType}`);
  }

  private applyEraserBrush(centerQ: number, centerR: number): void {
    const hexes = this.getHexesInBrush(centerQ, centerR, this.state.brushSize);
    const grid = this.editor.getGrid();

    for (const { q, r } of hexes) {
      if (!grid.isInBounds(q, r)) continue;
      const tile = grid.getTile(q, r);
      if (!tile) continue;
      if (tile.terrain === TerrainType.Grassland && tile.elevation === 0.3 && !tile.deposit) continue;

      this.recordBefore(q, r);
      grid.setTile(q, r, TerrainType.Grassland, 0.3);
      this.recordAfter(q, r);
    }

    this.editor.rebuildTerrain();
    this.onStatusChange?.('Erasing');
  }

  private applyBuildingTool(q: number, r: number): void {
    // Alt-click (or click on existing building) to remove
    const existing = this.editor.getBuildingAt(q, r);
    if (existing) {
      this.editor.removeBuildingAt(q, r);
      this.onStatusChange?.(`Removed ${existing.type}`);
      return;
    }

    const key = this.editor.placeBuilding(
      this.state.selectedBuildingType,
      q,
      r,
      this.state.selectedPlayer,
    );
    if (key) {
      this.onStatusChange?.(`Placed ${this.state.selectedBuildingType}`);
    } else {
      this.onStatusChange?.('Cannot place building here');
    }
  }

  private applyFlagTool(q: number, r: number): void {
    // Toggle: remove if exists, place if not
    const network = this.editor.getRoadNetwork();
    const existing = network.getFlagAt(q, r);
    if (existing) {
      this.editor.removeFlagAt(q, r);
      this.onStatusChange?.('Removed flag');
      return;
    }

    if (this.editor.placeFlag(q, r, this.state.selectedPlayer)) {
      this.onStatusChange?.('Placed flag');
    } else {
      this.onStatusChange?.('Cannot place flag here');
    }
  }

  private applyRoadTool(q: number, r: number): void {
    const network = this.editor.getRoadNetwork();

    if (!this.state.roadStartHex) {
      // First click: select a flag to start from
      const flag = network.getFlagAt(q, r);
      if (flag) {
        this.state.roadStartHex = { q, r };
        this.onStatusChange?.('Click an adjacent flag to connect');
      } else {
        // Auto-place a flag if none exists, then start
        if (this.editor.placeFlag(q, r, this.state.selectedPlayer)) {
          this.state.roadStartHex = { q, r };
          this.onStatusChange?.('Flag placed — click adjacent flag to connect');
        } else {
          this.onStatusChange?.('Cannot place flag here');
        }
      }
    } else {
      // Second click: connect to this flag
      const startQ = this.state.roadStartHex.q;
      const startR = this.state.roadStartHex.r;

      // Auto-place a flag at destination if needed
      if (!network.getFlagAt(q, r)) {
        this.editor.placeFlag(q, r, this.state.selectedPlayer);
      }

      if (this.editor.connectFlags(startQ, startR, q, r)) {
        this.onStatusChange?.('Road built');
        // Chain: continue from end flag
        this.state.roadStartHex = { q, r };
      } else {
        this.onStatusChange?.('Cannot connect — flags must be adjacent');
        this.state.roadStartHex = null;
      }
    }
  }

  // ─── Brush Preview ────────────────────────────────────────────────────

  private updateBrushPreview(centerQ: number, centerR: number): void {
    this.clearBrushPreview();

    // No brush preview for single-hex or non-brush tools
    if (
      this.state.tool === EditorTool.Deposit ||
      this.state.tool === EditorTool.StartPosition ||
      this.state.tool === EditorTool.Fill ||
      this.state.tool === EditorTool.Building ||
      this.state.tool === EditorTool.Flag ||
      this.state.tool === EditorTool.Road
    ) {
      return;
    }

    const hexes = this.getHexesInBrush(centerQ, centerR, this.state.brushSize);
    const grid = this.editor.getGrid();
    const scene = this.editor.getScene();

    const geo = new THREE.CircleGeometry(0.5, 6);
    geo.rotateX(-Math.PI / 2);

    for (const { q, r } of hexes) {
      if (!grid.isInBounds(q, r)) continue;
      const { x, z } = HexGrid.hexToWorld(q, r);
      const tile = grid.getTile(q, r);
      const y = tile ? tile.elevation * 0.2 + 0.1 : 0.1;

      const mat = new THREE.MeshBasicMaterial({
        color: BRUSH_HIGHLIGHT_COLOR,
        transparent: true,
        opacity: BRUSH_HIGHLIGHT_OPACITY,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      scene.add(mesh);
      this.brushPreviewMeshes.push(mesh);
    }
  }

  private clearBrushPreview(): void {
    for (const mesh of this.brushPreviewMeshes) {
      mesh.removeFromParent();
      (mesh.material as THREE.Material).dispose();
    }
    this.brushPreviewMeshes = [];
  }

  // ─── Undo Helpers ─────────────────────────────────────────────────────

  private recordBefore(q: number, r: number): void {
    const key = HexGrid.key(q, r);
    if (this.currentStroke.has(key)) return; // Already recorded
    const snap = this.editor.getTileSnapshot(q, r);
    if (snap) {
      this.currentStroke.set(key, { before: snap, after: snap });
    }
  }

  private recordAfter(q: number, r: number): void {
    const key = HexGrid.key(q, r);
    const entry = this.currentStroke.get(key);
    if (entry) {
      const snap = this.editor.getTileSnapshot(q, r);
      if (snap) entry.after = snap;
    }
  }

  /** Immediately commit the current stroke (for single-click tools) */
  private commitStroke(): void {
    if (this.currentStroke.size > 0) {
      const cmd: UndoCommand = { before: [], after: [] };
      for (const entry of this.currentStroke.values()) {
        cmd.before.push(entry.before);
        cmd.after.push(entry.after);
      }
      this.editor.undoManager.execute(cmd);
      this.currentStroke.clear();
    }
  }

  // ─── Hex Math ─────────────────────────────────────────────────────────

  /** Get all hex coords within a brush radius (hex distance) */
  private getHexesInBrush(
    centerQ: number,
    centerR: number,
    radius: number,
  ): { q: number; r: number }[] {
    const results: { q: number; r: number }[] = [];
    const r0 = radius - 1; // radius=1 means just the center
    for (let dq = -r0; dq <= r0; dq++) {
      for (let dr = Math.max(-r0, -dq - r0); dr <= Math.min(r0, -dq + r0); dr++) {
        results.push({ q: centerQ + dq, r: centerR + dr });
      }
    }
    return results;
  }

  /** Hex distance between two hexes */
  private hexDistance(q1: number, r1: number, q2: number, r2: number): number {
    return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
  }
}
