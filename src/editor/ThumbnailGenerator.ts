import { HexGrid, HEX_WIDTH } from '../game/HexGrid';
import type { HexTile } from '../game/HexGrid';
import { TerrainType } from '../game/TerrainType';
import type { StartingPosition } from '../game/MapData';

/** Minimap terrain colors (matching Minimap.ts) */
const TERRAIN_COLORS: Record<string, string> = {
  [TerrainType.Grassland]: '#5cb85c',
  [TerrainType.Forest]: '#2d6a2d',
  [TerrainType.Mountain]: '#888888',
  [TerrainType.Water]: '#4a9bd9',
  [TerrainType.Desert]: '#d2b48c',
};

const PLAYER_COLORS = ['#4488ff', '#ff4444', '#44cc44', '#ffcc00'];

/**
 * Generates a 128x128 2D canvas thumbnail of a hex map.
 */
export function generateThumbnail(
  grid: HexGrid,
  startingPositions: StartingPosition[],
  size = 128,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Fill background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, size, size);

  const tiles = grid.getAllTiles();
  if (tiles.length === 0) return canvas.toDataURL('image/png');

  // Compute world bounds
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const worldCoords: { tile: HexTile; x: number; z: number }[] = [];
  for (const tile of tiles) {
    const { x, z } = HexGrid.hexToWorld(tile.coord.q, tile.coord.r);
    worldCoords.push({ tile, x, z });
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  const worldW = maxX - minX || 1;
  const worldH = maxZ - minZ || 1;
  const padding = 4;
  const drawW = size - padding * 2;
  const drawH = size - padding * 2;
  const scale = Math.min(drawW / worldW, drawH / worldH);
  const offsetX = padding + (drawW - worldW * scale) / 2;
  const offsetZ = padding + (drawH - worldH * scale) / 2;

  // Draw hex dots
  const dotRadius = Math.max(1, (HEX_WIDTH * scale) / 2.5);
  for (const { tile, x, z } of worldCoords) {
    const px = offsetX + (x - minX) * scale;
    const pz = offsetZ + (z - minZ) * scale;
    ctx.fillStyle = TERRAIN_COLORS[tile.terrain] ?? '#555555';
    ctx.beginPath();
    ctx.arc(px, pz, dotRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw starting position markers
  const markerRadius = Math.max(3, dotRadius * 2);
  for (const sp of startingPositions) {
    const { x, z } = HexGrid.hexToWorld(sp.q, sp.r);
    const px = offsetX + (x - minX) * scale;
    const pz = offsetZ + (z - minZ) * scale;
    ctx.fillStyle = PLAYER_COLORS[sp.playerId - 1] ?? '#ffffff';
    ctx.beginPath();
    ctx.arc(px, pz, markerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  return canvas.toDataURL('image/png');
}
