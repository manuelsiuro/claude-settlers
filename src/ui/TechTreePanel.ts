import { BUILDING_DEFINITIONS, type BuildingDefinition } from '../game/BuildingType';
import { RESOURCE_PROPERTIES, type ResourceType } from '../game/ResourceType';
import { icon, resourceIcon } from './icons';
import { audioManager } from '../engine/AudioManager';

// ============================================================
// Constants
// ============================================================
const NODE_WIDTH = 160;
const NODE_HEIGHT = 72;
const COL_GAP = 220;
const ROW_GAP = 84;
const PADDING = 50;
const DRAG_THRESHOLD = 5;

// Category colors for left-border accents
const CATEGORY_COLORS: Record<string, string> = {
  core: '#B8860B',
  gathering: '#4CAF50',
  processing: '#FF8F00',
  military: '#7B1FA2',
  logistics: '#607D8B',
};

// ============================================================
// Data model
// ============================================================
interface TechTreeNode {
  type: string;
  def: BuildingDefinition;
  col: number;
  row: number;
  x: number;
  y: number;
  chainGroup: string;
}

interface TechTreeEdge {
  from: string;
  to: string;
  resource: ResourceType;
  amount: number;
  isDashed: boolean;
}

// ============================================================
// Persistent state across renders
// ============================================================

/** User-adjusted node positions, persists across re-renders */
const nodePositions = new Map<string, { x: number; y: number }>();
/** Cached graph data for the current render */
let currentNodes: TechTreeNode[] = [];
let currentEdges: TechTreeEdge[] = [];

/** Drag state for pointer-based dragging */
let dragState: {
  nodeType: string;
  startX: number;
  startY: number;
  nodeStartX: number;
  nodeStartY: number;
  moved: boolean;
} | null = null;

// ============================================================
// Graph builder — fully data-driven from BUILDING_DEFINITIONS
// ============================================================

/** Trace the upstream raw resource a building ultimately depends on */
function getChainGroup(def: BuildingDefinition, defs: Record<string, BuildingDefinition>): string {
  if (!def.production) {
    // Non-production buildings: group by category
    if (def.knightSlots > 0) return 'Military';
    if (def.category === 'logistics') return 'Logistics';
    if (def.category === 'core') return 'Core';
    // Gathering with no recipe (forester)
    return def.label;
  }

  // If no inputs, the output IS the raw resource
  if (def.production.inputs.length === 0) {
    const outRes = def.production.outputs[0]?.resource ?? '';
    return RESOURCE_PROPERTIES[outRes as ResourceType]?.label ?? outRes;
  }

  // Trace first input back to its raw source
  const firstInput = def.production.inputs[0].resource;
  // Find a producer of this resource
  for (const d of Object.values(defs)) {
    if (d.production?.outputs.some(o => o.resource === firstInput)) {
      return getChainGroup(d, defs);
    }
  }
  return RESOURCE_PROPERTIES[firstInput as ResourceType]?.label ?? firstInput;
}

/** Build resource-to-producer map */
function buildProducerMap(defs: Record<string, BuildingDefinition>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const [type, def] of Object.entries(defs)) {
    if (!def.production) continue;
    for (const out of def.production.outputs) {
      const list = map.get(out.resource) ?? [];
      list.push(type);
      map.set(out.resource, list);
    }
  }
  return map;
}

function buildGraph(): { nodes: TechTreeNode[]; edges: TechTreeEdge[] } {
  const defs = BUILDING_DEFINITIONS as Record<string, BuildingDefinition>;
  const producerMap = buildProducerMap(defs);

  // Create nodes
  const nodes: TechTreeNode[] = [];
  const nodeMap = new Map<string, TechTreeNode>();

  for (const [type, def] of Object.entries(defs)) {
    const node: TechTreeNode = {
      type,
      def,
      col: def.tier,
      row: 0,
      x: 0,
      y: 0,
      chainGroup: getChainGroup(def, defs),
    };
    nodes.push(node);
    nodeMap.set(type, node);
  }

  // Group by column and sort within columns by chain group
  const columns = new Map<number, TechTreeNode[]>();
  for (const node of nodes) {
    const col = columns.get(node.col) ?? [];
    col.push(node);
    columns.set(node.col, col);
  }

  for (const [, col] of columns) {
    col.sort((a, b) => {
      const cmp = a.chainGroup.localeCompare(b.chainGroup);
      if (cmp !== 0) return cmp;
      return a.def.label.localeCompare(b.def.label);
    });
    col.forEach((node, i) => {
      node.row = i;
      node.x = node.col * COL_GAP + PADDING;
      node.y = node.row * ROW_GAP + PADDING;
    });
  }

  // Build edges from production inputs
  const edges: TechTreeEdge[] = [];
  const edgeSet = new Set<string>();

  for (const [type, def] of Object.entries(defs)) {
    if (!def.production) continue;

    for (const input of def.production.inputs) {
      const producers = producerMap.get(input.resource) ?? [];
      for (const prod of producers) {
        const key = `${prod}->${type}:${input.resource}`;
        if (edgeSet.has(key)) continue;
        edgeSet.add(key);
        edges.push({
          from: prod,
          to: type,
          resource: input.resource as ResourceType,
          amount: input.amount,
          isDashed: false,
        });
      }
    }

    // Tool dependencies (dashed)
    if (def.workerTool) {
      const toolProducers = producerMap.get(def.workerTool) ?? [];
      for (const prod of toolProducers) {
        const key = `${prod}->${type}:${def.workerTool}:tool`;
        if (edgeSet.has(key)) continue;
        edgeSet.add(key);
        edges.push({
          from: prod,
          to: type,
          resource: def.workerTool as ResourceType,
          amount: 1,
          isDashed: true,
        });
      }
    }
  }

  // Military buildings consume swords+shields
  for (const [type, def] of Object.entries(defs)) {
    if (def.knightSlots <= 0) continue;
    const swordProducers = producerMap.get('swords') ?? [];
    const shieldProducers = producerMap.get('shields') ?? [];
    for (const prod of swordProducers) {
      const key = `${prod}->${type}:swords:knight`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ from: prod, to: type, resource: 'swords' as ResourceType, amount: 1, isDashed: true });
      }
    }
    for (const prod of shieldProducers) {
      const key = `${prod}->${type}:shields:knight`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ from: prod, to: type, resource: 'shields' as ResourceType, amount: 1, isDashed: true });
      }
    }
  }

  return { nodes, edges };
}

// ============================================================
// Resource icon color lookup (for SVG edge strokes)
// ============================================================
const RESOURCE_COLORS: Record<string, string> = {
  wood: '#8B6914', stone: '#9E9E9E', grain: '#DAA520', fish: '#78909C',
  iron_ore: '#8B4513', coal_ore: '#424242', gold_ore: '#B8860B',
  planks: '#D2B48C', flour: '#F5F5DC', bread: '#D4A056', meat: '#C62828',
  iron_bars: '#607D8B', gold_bars: '#FFD700', tools: '#795548',
  swords: '#90A4AE', shields: '#5D4037', pigs: '#F48FB1',
};

// ============================================================
// Rendering
// ============================================================

let overlay: HTMLElement;
let highlightedNode: string | null = null;
let activeFilter: string = 'All';

/** Get unique categories from building definitions */
function getCategories(): string[] {
  const cats = new Set<string>();
  for (const def of Object.values(BUILDING_DEFINITIONS)) {
    cats.add(def.category);
  }
  return ['All', ...Array.from(cats)];
}

/** Capitalize first letter */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Compute Bezier path d attribute between two nodes */
function computeEdgePath(fromType: string, toType: string): string {
  const srcPos = nodePositions.get(fromType);
  const tgtPos = nodePositions.get(toType);
  if (!srcPos || !tgtPos) return '';

  const sx = srcPos.x + NODE_WIDTH;
  const sy = srcPos.y + NODE_HEIGHT / 2;
  const tx = tgtPos.x;
  const ty = tgtPos.y + NODE_HEIGHT / 2;
  const cp = Math.abs(tx - sx) * 0.4;

  return `M${sx},${sy} C${sx + cp},${sy} ${tx - cp},${ty} ${tx},${ty}`;
}

/** Compute midpoint of edge for resource icon placement */
function computeEdgeMidpoint(fromType: string, toType: string): { x: number; y: number } {
  const srcPos = nodePositions.get(fromType);
  const tgtPos = nodePositions.get(toType);
  if (!srcPos || !tgtPos) return { x: 0, y: 0 };

  const sx = srcPos.x + NODE_WIDTH;
  const sy = srcPos.y + NODE_HEIGHT / 2;
  const tx = tgtPos.x;
  const ty = tgtPos.y + NODE_HEIGHT / 2;

  return { x: (sx + tx) / 2, y: (sy + ty) / 2 };
}

function renderTechTreeHTML(): string {
  const { nodes, edges } = buildGraph();
  currentNodes = nodes;
  currentEdges = edges;

  // Merge computed positions with user-adjusted positions (user positions take priority)
  for (const node of nodes) {
    if (!nodePositions.has(node.type)) {
      nodePositions.set(node.type, { x: node.x, y: node.y });
    }
  }

  // Compute canvas dimensions from actual positions (in case nodes were dragged outside)
  let maxX = 0;
  let maxY = 0;
  for (const pos of nodePositions.values()) {
    maxX = Math.max(maxX, pos.x + NODE_WIDTH + PADDING);
    maxY = Math.max(maxY, pos.y + NODE_HEIGHT + PADDING);
  }

  // Category filter buttons
  const categories = getCategories();
  const filterHTML = categories.map(cat => {
    const active = cat === activeFilter ? ' techtree-filter-active' : '';
    return `<button class="techtree-filter-btn${active}" data-filter="${cat}">${capitalize(cat)}</button>`;
  }).join('');

  // Filter nodes/edges based on active filter
  const visibleNodes = new Set<string>();
  for (const n of nodes) {
    if (activeFilter === 'All' || n.def.category === activeFilter) {
      visibleNodes.add(n.type);
    }
  }

  // SVG edges
  let edgeSVG = '';
  for (const edge of edges) {
    const srcPos = nodePositions.get(edge.from);
    const tgtPos = nodePositions.get(edge.to);
    if (!srcPos || !tgtPos) continue;

    const dimmed = (!visibleNodes.has(edge.from) && !visibleNodes.has(edge.to));
    const highlighted = highlightedNode && (edge.from === highlightedNode || edge.to === highlightedNode);
    const edgeDimClass = dimmed ? ' techtree-edge-dimmed' : '';
    const edgeHighClass = highlighted ? ' techtree-edge-highlight' : '';

    const d = computeEdgePath(edge.from, edge.to);
    const color = RESOURCE_COLORS[edge.resource] ?? '#999';
    const dash = edge.isDashed ? ' stroke-dasharray="6 4"' : '';
    const opacity = highlighted ? 1 : (dimmed ? 0.1 : 0.6);

    edgeSVG += `<path class="techtree-edge${edgeDimClass}${edgeHighClass}" data-from="${edge.from}" data-to="${edge.to}" d="${d}" fill="none" stroke="${color}" stroke-width="${highlighted ? 2.5 : 1.5}"${dash} opacity="${opacity}"/>`;

    // Resource icon at midpoint
    const mid = computeEdgeMidpoint(edge.from, edge.to);
    edgeSVG += `<g data-edge-mid="${edge.from}->${edge.to}" transform="translate(${mid.x - 8},${mid.y - 8})" opacity="${opacity}"><circle cx="8" cy="8" r="8" fill="${color}"/><text x="8" y="12" text-anchor="middle" font-size="9" fill="#fff" font-weight="600">${edge.amount}</text></g>`;
  }

  // Node cards
  let nodeHTML = '';
  for (const node of nodes) {
    const pos = nodePositions.get(node.type)!;
    const dimmed = !visibleNodes.has(node.type);
    const highlighted = highlightedNode === node.type;
    const dimClass = dimmed ? ' techtree-node-dimmed' : '';
    const highClass = highlighted ? ' techtree-node-highlight' : '';
    const catColor = CATEGORY_COLORS[node.def.category] ?? '#999';

    // Recipe summary
    let recipeHTML = '';
    if (node.def.production) {
      const inputs = node.def.production.inputs.map(i =>
        `${resourceIcon(i.resource, 14)}`
      ).join('');
      const outputs = node.def.production.outputs.map(o =>
        `${resourceIcon(o.resource, 14)}`
      ).join('');
      const inputPart = inputs || '<span style="font-size:10px;color:var(--color-on-surface-faint)">raw</span>';
      recipeHTML = `<div class="techtree-recipe">${inputPart}<span class="techtree-arrow">→</span>${outputs}</div>`;
    } else if (node.def.knightSlots > 0) {
      recipeHTML = `<div class="techtree-recipe"><span style="font-size:10px;color:var(--color-on-surface-faint)">${node.def.knightSlots} knight slots</span></div>`;
    } else if (node.def.storageCapacity > 0 && node.def.category === 'logistics') {
      recipeHTML = `<div class="techtree-recipe"><span style="font-size:10px;color:var(--color-on-surface-faint)">Storage: ${node.def.storageCapacity}</span></div>`;
    }

    nodeHTML += `
      <div class="techtree-node${dimClass}${highClass}" data-building="${node.type}"
           style="left:${pos.x}px;top:${pos.y}px;border-left:3px solid ${catColor};touch-action:none">
        <div class="techtree-node-name">${node.def.label}</div>
        <div class="techtree-node-cat">${capitalize(node.def.category)} · T${node.def.tier}</div>
        ${recipeHTML}
      </div>`;
  }

  return `
    <div class="techtree-panel">
      <div class="techtree-header">
        <span class="techtree-title">${icon('account_tree')} Production Chains</span>
        <button class="icon-btn techtree-close-btn" id="techtree-close-btn">${icon('close')}</button>
      </div>
      <div class="techtree-filters">${filterHTML}</div>
      <div class="techtree-viewport">
        <div class="techtree-canvas" style="width:${maxX}px;height:${maxY}px">
          <svg class="techtree-svg" width="${maxX}" height="${maxY}" viewBox="0 0 ${maxX} ${maxY}">
            ${edgeSVG}
          </svg>
          ${nodeHTML}
        </div>
      </div>
    </div>`;
}

// ============================================================
// Detail popover
// ============================================================
function showDetail(node: TechTreeNode, rect: DOMRect): void {
  // Remove existing
  const old = overlay.querySelector('.techtree-detail');
  old?.remove();

  const def = node.def;
  const costHTML = def.cost.map(c =>
    `<span style="display:inline-flex;align-items:center;gap:2px">${resourceIcon(c.resource, 14)} ${c.amount}</span>`
  ).join(' ');

  let recipeDetail = '';
  if (def.production) {
    const ins = def.production.inputs.map(i => {
      const label = RESOURCE_PROPERTIES[i.resource as ResourceType]?.label ?? i.resource;
      return `${resourceIcon(i.resource, 14)} ${label} x${i.amount}`;
    }).join(', ') || 'None (raw gathering)';
    const outs = def.production.outputs.map(o => {
      const label = RESOURCE_PROPERTIES[o.resource as ResourceType]?.label ?? o.resource;
      return `${resourceIcon(o.resource, 14)} ${label} x${o.amount}`;
    }).join(', ');
    recipeDetail = `
      <div class="techtree-detail-row"><strong>Inputs:</strong> ${ins}</div>
      <div class="techtree-detail-row"><strong>Outputs:</strong> ${outs}</div>
      <div class="techtree-detail-row"><strong>Time:</strong> ${def.production.productionTime}s</div>`;
  }

  const workerInfo = def.worker ? `<div class="techtree-detail-row"><strong>Worker:</strong> ${def.worker}${def.workerTool ? ` (needs ${RESOURCE_PROPERTIES[def.workerTool as ResourceType]?.label ?? def.workerTool})` : ''}</div>` : '';

  const detail = document.createElement('div');
  detail.className = 'techtree-detail';
  detail.innerHTML = `
    <div class="techtree-detail-title">${def.label}</div>
    <div class="techtree-detail-desc">${def.description}</div>
    <div class="techtree-detail-row"><strong>Cost:</strong> ${costHTML || 'Free'}</div>
    ${workerInfo}
    ${recipeDetail}
    <div class="techtree-detail-row"><strong>Build time:</strong> ${def.constructionTime}s</div>`;

  // Position near the node, keeping within panel bounds
  const panel = overlay.querySelector('.techtree-panel')!;
  const panelRect = panel.getBoundingClientRect();
  let left = rect.right - panelRect.left + 8;
  let top = rect.top - panelRect.top;

  // If it would overflow right, place to the left of the node instead
  if (left + 240 > panelRect.width) {
    left = rect.left - panelRect.left - 248;
  }
  // Keep within vertical bounds
  if (top + 320 > panelRect.height) {
    top = panelRect.height - 330;
  }
  if (top < 0) top = 8;

  detail.style.left = `${left}px`;
  detail.style.top = `${top}px`;

  panel.appendChild(detail);
}

function hideDetail(): void {
  overlay.querySelector('.techtree-detail')?.remove();
}

// ============================================================
// Edge updates (incremental, no full rebuild)
// ============================================================

/** Update all SVG edges connected to a specific node */
function updateEdgesForNode(nodeType: string): void {
  const svg = overlay.querySelector('.techtree-svg');
  if (!svg) return;

  for (const edge of currentEdges) {
    if (edge.from !== nodeType && edge.to !== nodeType) continue;

    // Update path
    const path = svg.querySelector(`path[data-from="${edge.from}"][data-to="${edge.to}"]`) as SVGPathElement | null;
    if (path) {
      path.setAttribute('d', computeEdgePath(edge.from, edge.to));
    }

    // Update midpoint icon
    const midG = svg.querySelector(`g[data-edge-mid="${edge.from}->${edge.to}"]`) as SVGGElement | null;
    if (midG) {
      const mid = computeEdgeMidpoint(edge.from, edge.to);
      midG.setAttribute('transform', `translate(${mid.x - 8},${mid.y - 8})`);
    }
  }
}

/** Grow the canvas/SVG if a node is dragged beyond current bounds */
function updateCanvasSize(): void {
  let maxX = 0;
  let maxY = 0;
  for (const pos of nodePositions.values()) {
    maxX = Math.max(maxX, pos.x + NODE_WIDTH + PADDING);
    maxY = Math.max(maxY, pos.y + NODE_HEIGHT + PADDING);
  }

  const canvas = overlay.querySelector('.techtree-canvas') as HTMLElement | null;
  const svg = overlay.querySelector('.techtree-svg') as SVGSVGElement | null;
  if (canvas) {
    canvas.style.width = `${maxX}px`;
    canvas.style.height = `${maxY}px`;
  }
  if (svg) {
    svg.setAttribute('width', String(maxX));
    svg.setAttribute('height', String(maxY));
    svg.setAttribute('viewBox', `0 0 ${maxX} ${maxY}`);
  }
}

// ============================================================
// Hover (DOM-based, no full re-render)
// ============================================================

function applyHoverHighlight(buildingType: string | null): void {
  if (buildingType === highlightedNode) return;
  highlightedNode = buildingType;

  // Update node classes
  const nodeEls = overlay.querySelectorAll('.techtree-node');
  const visibleNodes = new Set<string>();
  for (const n of currentNodes) {
    if (activeFilter === 'All' || n.def.category === activeFilter) {
      visibleNodes.add(n.type);
    }
  }

  for (const el of nodeEls) {
    const type = (el as HTMLElement).dataset.building;
    if (!type) continue;
    const dimmed = !visibleNodes.has(type);

    if (buildingType === null) {
      // No hover: restore filter-based state
      el.classList.toggle('techtree-node-dimmed', dimmed);
      el.classList.remove('techtree-node-highlight');
    } else if (type === buildingType) {
      el.classList.remove('techtree-node-dimmed');
      el.classList.add('techtree-node-highlight');
    } else {
      el.classList.remove('techtree-node-highlight');
      el.classList.toggle('techtree-node-dimmed', dimmed);
    }
  }

  // Update edge styles
  const svg = overlay.querySelector('.techtree-svg');
  if (!svg) return;

  for (const edge of currentEdges) {
    const path = svg.querySelector(`path[data-from="${edge.from}"][data-to="${edge.to}"]`) as SVGPathElement | null;
    const midG = svg.querySelector(`g[data-edge-mid="${edge.from}->${edge.to}"]`) as SVGGElement | null;

    const dimmed = (!visibleNodes.has(edge.from) && !visibleNodes.has(edge.to));
    const highlighted = buildingType !== null && (edge.from === buildingType || edge.to === buildingType);

    const opacity = highlighted ? 1 : (dimmed ? 0.1 : 0.6);
    const strokeWidth = highlighted ? 2.5 : 1.5;

    if (path) {
      path.setAttribute('opacity', String(opacity));
      path.setAttribute('stroke-width', String(strokeWidth));
      if (highlighted) {
        path.classList.add('techtree-edge-highlight');
        path.classList.remove('techtree-edge-dimmed');
      } else if (dimmed) {
        path.classList.add('techtree-edge-dimmed');
        path.classList.remove('techtree-edge-highlight');
      } else {
        path.classList.remove('techtree-edge-highlight', 'techtree-edge-dimmed');
      }
    }
    if (midG) {
      midG.setAttribute('opacity', String(opacity));
    }
  }
}

// ============================================================
// Interactions
// ============================================================
function handleHover(e: PointerEvent): void {
  // Don't update hover during drag
  if (dragState) return;

  const target = (e.target as HTMLElement).closest('.techtree-node') as HTMLElement | null;
  const buildingType = target?.dataset.building ?? null;
  applyHoverHighlight(buildingType);
}

function handleClick(e: MouseEvent): void {
  // Don't handle clicks that ended a drag
  if (dragState) return;

  const target = (e.target as HTMLElement).closest('.techtree-node') as HTMLElement | null;
  if (!target) {
    hideDetail();
    return;
  }

  audioManager.play('ui_click');
  const buildingType = target.dataset.building!;
  const node = currentNodes.find(n => n.type === buildingType);
  if (node) {
    showDetail(node, target.getBoundingClientRect());
  }
}

function handleFilterClick(e: MouseEvent): void {
  const btn = (e.target as HTMLElement).closest('.techtree-filter-btn') as HTMLElement | null;
  if (!btn) return;
  audioManager.play('ui_click');
  activeFilter = btn.dataset.filter ?? 'All';
  highlightedNode = null;
  // Reset positions on filter change so layout recomputes
  nodePositions.clear();
  render();
}

// ============================================================
// Drag handlers (pointer events for unified mouse+touch)
// ============================================================

function handlePointerDown(e: PointerEvent): void {
  const target = (e.target as HTMLElement).closest('.techtree-node') as HTMLElement | null;
  if (!target) return;

  const buildingType = target.dataset.building;
  if (!buildingType) return;

  const pos = nodePositions.get(buildingType);
  if (!pos) return;

  e.preventDefault();
  target.setPointerCapture(e.pointerId);

  dragState = {
    nodeType: buildingType,
    startX: e.clientX,
    startY: e.clientY,
    nodeStartX: pos.x,
    nodeStartY: pos.y,
    moved: false,
  };

  // Hide detail popover while dragging
  hideDetail();
}

function handlePointerMove(e: PointerEvent): void {
  if (!dragState) return;

  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;

  // Check if dragged past threshold
  if (!dragState.moved && Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;

  if (!dragState.moved) {
    dragState.moved = true;
    // Add dragging class to the node
    const nodeEl = overlay.querySelector(`.techtree-node[data-building="${dragState.nodeType}"]`) as HTMLElement | null;
    if (nodeEl) {
      nodeEl.classList.add('techtree-node-dragging');
    }
    // Prevent viewport scrolling during drag
    const viewport = overlay.querySelector('.techtree-viewport') as HTMLElement | null;
    if (viewport) viewport.style.touchAction = 'none';
  }

  // Get the viewport's scroll-adjusted coordinates
  const viewport = overlay.querySelector('.techtree-viewport') as HTMLElement | null;
  if (!viewport) return;

  const newX = dragState.nodeStartX + dx;
  const newY = dragState.nodeStartY + dy;

  // Update position (clamp to >= 0)
  const clampedX = Math.max(0, newX);
  const clampedY = Math.max(0, newY);
  nodePositions.set(dragState.nodeType, { x: clampedX, y: clampedY });

  // Move the node element
  const nodeEl = overlay.querySelector(`.techtree-node[data-building="${dragState.nodeType}"]`) as HTMLElement | null;
  if (nodeEl) {
    nodeEl.style.left = `${clampedX}px`;
    nodeEl.style.top = `${clampedY}px`;
  }

  // Update connected edges
  updateEdgesForNode(dragState.nodeType);

  // Grow canvas if needed
  updateCanvasSize();
}

function handlePointerUp(): void {
  if (!dragState) return;

  const wasDrag = dragState.moved;
  const nodeType = dragState.nodeType;
  dragState = null;

  // Remove dragging class
  const nodeEl = overlay.querySelector(`.techtree-node[data-building="${nodeType}"]`) as HTMLElement | null;
  if (nodeEl) {
    nodeEl.classList.remove('techtree-node-dragging');
  }

  // Restore viewport scrolling
  const viewport = overlay.querySelector('.techtree-viewport') as HTMLElement | null;
  if (viewport) viewport.style.touchAction = '';

  // If it was a drag, prevent the subsequent click from triggering detail popover
  if (wasDrag) {
    const clickBlocker = (e: Event) => {
      e.stopPropagation();
      viewport?.removeEventListener('click', clickBlocker, true);
    };
    viewport?.addEventListener('click', clickBlocker, true);
  }
}

// ============================================================
// Render
// ============================================================

function render(): void {
  overlay.innerHTML = renderTechTreeHTML();

  // Attach listeners
  const viewport = overlay.querySelector('.techtree-viewport');
  viewport?.addEventListener('pointermove', handleHover as EventListener);
  viewport?.addEventListener('click', handleClick as EventListener);

  // Drag handlers on the canvas (nodes are inside canvas)
  const canvas = overlay.querySelector('.techtree-canvas');
  canvas?.addEventListener('pointerdown', handlePointerDown as EventListener);
  document.addEventListener('pointermove', handlePointerMove as EventListener);
  document.addEventListener('pointerup', handlePointerUp as EventListener);

  const filters = overlay.querySelector('.techtree-filters');
  filters?.addEventListener('click', handleFilterClick as EventListener);

  const closeBtn = overlay.querySelector('#techtree-close-btn');
  closeBtn?.addEventListener('click', closeTechTreePanel);

  // Close on overlay background click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeTechTreePanel();
  });
}

// ============================================================
// Public API
// ============================================================

export function initTechTreePanel(): void {
  overlay = document.getElementById('techtree-overlay')!;
}

export function showTechTreePanel(): void {
  audioManager.play('ui_click');
  highlightedNode = null;
  activeFilter = 'All';
  // Reset positions on panel open so layout recomputes fresh
  nodePositions.clear();
  overlay.classList.remove('hidden');
  render();

  // Escape to close
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeTechTreePanel();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

export function closeTechTreePanel(): void {
  overlay.classList.add('hidden');
  overlay.innerHTML = '';
  // Clean up document-level drag listeners
  document.removeEventListener('pointermove', handlePointerMove as EventListener);
  document.removeEventListener('pointerup', handlePointerUp as EventListener);
  dragState = null;
}
