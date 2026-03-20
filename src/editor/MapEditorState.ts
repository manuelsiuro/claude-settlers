import { TerrainType } from '../game/TerrainType';
import { BuildingType } from '../game/BuildingType';

export const EditorTool = {
  Terrain: 'terrain',
  Elevation: 'elevation',
  Deposit: 'deposit',
  StartPosition: 'start_position',
  Fill: 'fill',
  Eraser: 'eraser',
  Building: 'building',
  Flag: 'flag',
  Road: 'road',
} as const;

export type EditorTool = (typeof EditorTool)[keyof typeof EditorTool];

export const DepositCycle = ['none', 'iron_ore', 'coal_ore', 'gold_ore'] as const;
export type DepositType = (typeof DepositCycle)[number];

export interface EditorState {
  tool: EditorTool;
  terrainType: TerrainType;
  brushSize: number; // 1–3 hex radius
  selectedPlayer: number; // 1–4 for start position tool
  selectedBuildingType: BuildingType;
  roadStartHex: { q: number; r: number } | null; // for road tool: first flag coord
}

export function createDefaultEditorState(): EditorState {
  return {
    tool: EditorTool.Terrain,
    terrainType: TerrainType.Grassland,
    brushSize: 1,
    selectedPlayer: 1,
    selectedBuildingType: BuildingType.Castle,
    roadStartHex: null,
  };
}
