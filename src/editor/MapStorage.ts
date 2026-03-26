import type { MapData, MapListEntry } from '../game/MapData';
import { validateMapData } from '../game/MapData';
import { logger } from '../util/Logger';

const INDEX_KEY = 'feudal_maps_index';
const MAP_KEY_PREFIX = 'feudal_map_';

function mapKey(id: string): string {
  return `${MAP_KEY_PREFIX}${id}`;
}

/** Get the lightweight index of all saved maps */
export function listMaps(): MapListEntry[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MapListEntry[];
  } catch {
    return [];
  }
}

/** Get a full MapData by id, or null if not found */
export function getMap(id: string): MapData | null {
  try {
    const raw = localStorage.getItem(mapKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as MapData;
  } catch {
    return null;
  }
}

/** Save a MapData to localStorage (creates or updates) */
export function saveMap(data: MapData): void {
  data.updatedAt = Date.now();

  // Save full map data
  localStorage.setItem(mapKey(data.id), JSON.stringify(data));

  // Update index
  const index = listMaps();
  const entry: MapListEntry = {
    id: data.id,
    name: data.name,
    width: data.width,
    height: data.height,
    thumbnail: data.thumbnail,
    playerCount: data.startingPositions.length,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };

  const existing = index.findIndex((e) => e.id === data.id);
  if (existing >= 0) {
    index[existing] = entry;
  } else {
    index.push(entry);
  }

  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

/** Delete a map from localStorage */
export function deleteMap(id: string): void {
  localStorage.removeItem(mapKey(id));

  const index = listMaps().filter((e) => e.id !== id);
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

/** Download a MapData as a .feudalmap.json file */
export function downloadMap(data: MapData): void {
  // Strip thumbnail from download to reduce file size
  const exportData = { ...data, thumbnail: undefined };
  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.feudalmap.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Import a MapData from a file picker. Returns null if cancelled or invalid. */
export function importMapFromFile(): Promise<MapData | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.feudalmap.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string) as MapData;
          const errors = validateMapData(data);
          if (errors.length > 0) {
            logger.warn('Map import validation errors:', errors);
            resolve(null);
            return;
          }
          // Assign new ID to avoid collisions
          data.id = crypto.randomUUID();
          resolve(data);
        } catch {
          resolve(null);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

/** Bundled map entry from public/maps/index.json */
export interface BundledMapEntry {
  id: string;
  name: string;
  description: string;
  file: string;
  thumbnail: string;
  width: number;
  height: number;
  playerCount: number;
}

/** Load the index of bundled maps from public/maps/ */
export async function loadBundledMapsIndex(): Promise<BundledMapEntry[]> {
  try {
    const resp = await fetch('/maps/index.json');
    if (!resp.ok) return [];
    return (await resp.json()) as BundledMapEntry[];
  } catch {
    return [];
  }
}

/** Load a bundled map by filename */
export async function loadBundledMap(file: string): Promise<MapData | null> {
  try {
    const resp = await fetch(`/maps/${file}`);
    if (!resp.ok) return null;
    return (await resp.json()) as MapData;
  } catch {
    return null;
  }
}
