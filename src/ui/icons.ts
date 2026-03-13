/** Inline SVG icons from Google Material Symbols (24x24, fill="currentColor") */

const svgs: Record<string, string> = {
  menu: '<path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>',
  construction: '<path d="m19.36 8.22-1.41-1.41-4.24 4.24 1.41 1.41 4.24-4.24zM3 19h4.41l9.02-9.02-1.41-1.41L6 17.59V19H3zm14.85-12.71L16.44 4.9a.996.996 0 0 0-1.41 0l-1.42 1.42 2.83 2.83 1.41-1.41a.996.996 0 0 0 0-1.42zM2 20h20v2H2z"/>',
  bar_chart: '<path d="M4 9h4v11H4zm6-5h4v16h-4zm6 8h4v8h-4z"/>',
  map: '<path d="m20.5 3-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/>',
  settings: '<path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/>',
  close: '<path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>',
  add: '<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/>',
  save: '<path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>',
  folder_open: '<path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>',
  download: '<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>',
  volume_up: '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8.77v6.46A4.47 4.47 0 0 0 16.5 12zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>',
  volume_off: '<path d="M16.5 12A4.5 4.5 0 0 0 14 8.77v2.06l2.47 2.47c.03-.1.03-.2.03-.3zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/>',
  music_note: '<path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>',
  pause: '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>',
  play_arrow: '<path d="M8 5v14l11-7z"/>',
  fast_forward: '<path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/>',
  // UI section icons
  crown: '<path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 2h14v2H5v-2z"/>',
  skull: '<path d="M12 2C6.48 2 2 6.48 2 12c0 3.07 1.39 5.81 3.57 7.63V22h4.86v-2h3.14v2h4.86v-2.37C20.61 17.81 22 15.07 22 12c0-5.52-4.48-10-10-10zM9 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>',
  trophy: '<path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>',
  shield_icon: '<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>',
  people: '<path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>',
  warehouse: '<path d="M20 3H4v10c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4V3zm-2 10c0 1.1-.9 2-2 2H8c-1.1 0-2-.9-2-2V5h12v8zM4 19h16v2H4z"/>',
  hammer: '<path d="M2 19.63L13.43 8.2l-1.72-1.72 1.41-1.41 1.72 1.72 1.41-1.42-1.72-1.71L16.12 2l5.66 5.66-1.59 1.59-1.71-1.72-1.42 1.41 1.72 1.72-1.41 1.41-1.72-1.72L4.24 21.04z"/>',
  sun: '<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>',
  moon: '<path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>',
  tune: '<path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/>',
};

export function icon(name: string, cls?: string): string {
  const svg = svgs[name] ?? '';
  const className = cls ? ` class="${cls}"` : '';
  return `<span${className} style="display:inline-flex;align-items:center;"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">${svg}</svg></span>`;
}

/** Resource icon definitions — colored circle background + white symbol */
const resourceIcons: Record<string, { color: string; path: string }> = {
  wood: {
    color: '#8B6914',
    path: 'M4 7h8M4 9h8', // Two log lines
  },
  stone: {
    color: '#9E9E9E',
    path: 'M5 5h6v6H5z', // Cube outline
  },
  grain: {
    color: '#DAA520',
    path: 'M8 3v8M6 5l2-2 2 2M5 7l3-2 3 2', // Wheat stalk
  },
  fish: {
    color: '#78909C',
    path: 'M3 8c3-3 7-3 10 0s-7 3-10 0zM13 8l2-2M13 8l2 2', // Fish
  },
  iron_ore: {
    color: '#8B4513',
    path: 'M4 10c0-3 2-5 4-5s4 2 4 4-1 4-4 4-4-1-4-3z', // Lump
  },
  coal_ore: {
    color: '#424242',
    path: 'M4 10c0-3 2-5 4-5s4 2 4 4-1 4-4 4-4-1-4-3z', // Dark lump
  },
  gold_ore: {
    color: '#B8860B',
    path: 'M4 10c0-3 2-5 4-5s4 2 4 4-1 4-4 4-4-1-4-3zM6 5l1-1M10 4l1 1', // Sparkling lump
  },
  planks: {
    color: '#D2B48C',
    path: 'M3 6h10v4H3z', // Flat rectangle
  },
  flour: {
    color: '#F5F5DC',
    path: 'M5 11c0-3 1.5-7 3-7s3 4 3 7-1 2-3 2-3 1-3-2z', // Sack
  },
  bread: {
    color: '#D4A056',
    path: 'M3 10c0-4 3-6 5-6s5 2 5 6H3z', // Dome loaf
  },
  meat: {
    color: '#C62828',
    path: 'M8 3a3 3 0 0 1 0 6H6l-2 4v1h1l1-2 1 2h1l-1-3h2a3 3 0 0 0 0-6z', // Drumstick
  },
  iron_bars: {
    color: '#607D8B',
    path: 'M3 5h10v6H3z', // Rectangular ingot
  },
  gold_bars: {
    color: '#FFD700',
    path: 'M4 11h8L10 5H6z', // Trapezoid ingot
  },
  tools: {
    color: '#795548',
    path: 'M6 3v7l2 2v1H7v-1L5 10V3z', // Hammer
  },
  swords: {
    color: '#90A4AE',
    path: 'M8 2v9M6 9h4M7 11l1 2 1-2', // Blade
  },
  shields: {
    color: '#5D4037',
    path: 'M8 2a6 6 0 0 1 0 12A6 6 0 0 1 8 2zM8 4v8M4 8h8', // Circle with cross
  },
  pigs: {
    color: '#F48FB1',
    path: 'M4 7a4 4 0 0 1 8 0c0 3-2 5-4 5S4 10 4 7zM5 5l-1-2M11 5l1-2M6 8h1M9 8h1', // Pig face
  },
};

/** Returns an inline SVG resource icon with colored circle background and white symbol */
export function resourceIcon(type: string, size: number = 16): string {
  const def = resourceIcons[type];
  if (!def) return '';
  const r = size / 2;
  // Use stroke-based symbols for clarity at small sizes
  const needsStroke = type === 'flour';
  const strokeAttr = needsStroke ? ' stroke="#666"' : '';
  return `<span style="display:inline-flex;align-items:center;vertical-align:middle;flex-shrink:0"><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 16 16"><circle cx="8" cy="8" r="${r}" fill="${def.color}"/><g transform="translate(0,0)" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"${strokeAttr}><path d="${def.path}"/></g></svg></span>`;
}
