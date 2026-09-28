/** Shared geometry for the table plane. X is right, Y is near, Z is above the felt. */
export type MahjongSeat = 'south' | 'east' | 'north' | 'west';
export type MahjongLayoutMode = 'landscape' | 'compact' | 'portrait';
export type MahjongPoint = { x: number; y: number; z?: number };
export type MahjongCamera = { cx: number; cy: number; perspective: number; tilt: number };
export type MahjongRect = { x: number; y: number; width: number; height: number };
export type MahjongBounds = MahjongRect & { right: number; bottom: number };
export type MahjongPlacement = { x: number; y: number; angle: number };
export type MahjongRackLayout = MahjongPlacement & {
  tileW: number; tileH: number; tileD: number; gap: number; length: number;
  handCapacity: 14; drawGap: number;
  meldW: number; meldH: number; meldD: number; meldGap: number; meldSlotWidth: number;
};
export type MahjongRiverLayout = MahjongPlacement & {
  columns: number; rows: number; tileW: number; tileH: number; tileD: number;
  gap: number; gapX: number; gapY: number; rowPitch: number; width: number; height: number;
};
export type MahjongMeldLayout = MahjongPlacement & {
  tileW: number; tileH: number; tileD: number; gap: number;
  slotWidth: number; slots: 4; width: number; height: number; columns: number; rowPitch: number;
};
export type MahjongSelfRackLayout = MahjongRect & {
  tileW: number; tileH: number; gap: number; drawGap: number;
  columns: number; rows: number; capacity: 14; lift: number; rowGap: number;
};
export type MahjongLayout = {
  mode: MahjongLayoutMode;
  viewport: { width: number; height: number };
  camera: MahjongCamera;
  frame: MahjongRect;
  center: MahjongRect;
  racks: Record<Exclude<MahjongSeat, 'south'>, MahjongRackLayout>;
  rivers: Record<MahjongSeat, MahjongRiverLayout>;
  southMeld: MahjongMeldLayout;
  selfRack: MahjongSelfRackLayout;
  portraits: Record<MahjongSeat, { x: number; y: number; width: number; nameWidth: number }>;
  actionsY: number;
};

const radians = (degrees: number) => degrees * Math.PI / 180;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Matches perspective + rotateX on the shared CSS world, with transform-origin 0 0. */
export function projectMahjongPoint(point: MahjongPoint, camera: MahjongCamera): MahjongPoint & { scale: number } {
  const sine = Math.sin(radians(camera.tilt)), cosine = Math.cos(radians(camera.tilt));
  const z = point.z ?? 0;
  const rotatedY = point.y * cosine - z * sine;
  const rotatedZ = point.y * sine + z * cosine;
  const scale = camera.perspective / (camera.perspective - rotatedZ);
  return { x: camera.cx + point.x * scale, y: camera.cy + rotatedY * scale, z: rotatedZ, scale };
}

export function localToWorld(point: MahjongPoint, origin: MahjongPlacement): MahjongPoint {
  const sine = Math.sin(radians(origin.angle)), cosine = Math.cos(radians(origin.angle));
  return { x: origin.x + point.x * cosine - point.y * sine, y: origin.y + point.x * sine + point.y * cosine, z: point.z ?? 0 };
}

/** Project all eight vertices, including tile thickness, instead of just its face rectangle. */
export function projectMahjongBox(
  box: MahjongRect & { z?: number; depth?: number; angle?: number },
  camera: MahjongCamera,
): MahjongBounds {
  const corners: MahjongPoint[] = [];
  for (const x of [0, box.width]) for (const y of [0, box.height]) for (const z of [box.z ?? 0, (box.z ?? 0) + (box.depth ?? 0)]) {
    corners.push(projectMahjongPoint(localToWorld({ x, y, z }, { x: box.x, y: box.y, angle: box.angle ?? 0 }), camera));
  }
  const left = Math.min(...corners.map(point => point.x)), top = Math.min(...corners.map(point => point.y));
  const right = Math.max(...corners.map(point => point.x)), bottom = Math.max(...corners.map(point => point.y));
  return { x: left, y: top, width: right - left, height: bottom - top, right, bottom };
}

/** Layout depends only on the viewport. Drawing or claiming a tile cannot move an existing slot. */
export function getMahjongLayout(viewportWidth: number, viewportHeight: number): MahjongLayout {
  const width = Number.isFinite(viewportWidth) ? Math.max(240, viewportWidth) : 1600;
  const height = Number.isFinite(viewportHeight) ? Math.max(320, viewportHeight) : 900;
  const aspect = width / height;
  const mode: MahjongLayoutMode = width <= 580 && height > width ? 'portrait' : aspect < 1.5 ? 'compact' : 'landscape';
  const portrait = mode === 'portrait', compact = mode === 'compact';
  const scale = Math.min(width / (portrait ? 740 : compact ? 1120 : 1600), height / (portrait ? 1120 : 900));
  const camera: MahjongCamera = {
    cx: width / 2, cy: height * (portrait ? .39 : compact ? .43 : .45),
    perspective: Math.max(width, 520) * 1.3, tilt: portrait ? 24 : compact ? 30 : 35,
  };
  const columns = portrait ? 7 : 14, rows = portrait ? 2 : 1;
  const safeInset = portrait ? 12 : clamp(width * .08, 28, 160);
  const handGap = clamp(width / 1600 * 3, 1, 4);
  const drawGap = portrait ? clamp(width * .01, 3, 5) : clamp(width * .014, 5, 22);
  const tileW = Math.min(portrait ? 53 : Math.max(80, width * .05), (width - safeInset * 2 - handGap * (columns - 1) - drawGap) / columns, height * (portrait ? .061 : .145));
  const tileH = tileW * 1.43;
  const selfWidth = columns * tileW + handGap * (columns - 1) + drawGap;
  const lift = Math.min(20, tileH * .17);
  const rowGap = portrait ? lift + 11 : 0;
  const selfHeight = rows * tileH + (rows - 1) * rowGap;
  const selfRack: MahjongSelfRackLayout = {
    x: (width - selfWidth) / 2, y: height - selfHeight - (portrait ? 12 : 18), width: selfWidth,
    height: selfHeight, tileW, tileH, gap: handGap, drawGap, columns, rows, capacity: 14,
    lift, rowGap,
  };
  const rack = (x: number, y: number, angle: number, w: number, h: number): MahjongRackLayout => {
    const gap = .7 * scale, drawGap = 8 * scale, meldW = w * .69, meldGap = 4 * scale;
    return { x, y, angle, tileW: w, tileH: h, tileD: 16 * scale, gap,
      length: 14 * w + 13 * gap + drawGap, handCapacity: 14, drawGap,
      meldW, meldH: meldW * 1.43, meldD: 12 * scale, meldGap, meldSlotWidth: 4 * meldW + meldGap };
  };
  const northW = 50 * scale, sideW = 39 * scale;
  const northY = portrait ? -height * .255 : compact ? -height * .37 : -370 * scale;
  const sideX = portrait ? width * .4 : compact ? width * .375 : 550 * scale;
  const sideY = portrait ? 225 * scale : 260 * scale;
  const racks = {
    north: rack(330 * scale, northY, 180, northW, 75 * scale),
    west: rack(-sideX, -sideY, 90, sideW, 84 * scale),
    east: rack(sideX, sideY, -90, sideW, 84 * scale),
  };
  const riverColumns = portrait ? 5 : 6, riverRows = mode === 'landscape' && height >= 500 ? 3 : 2;
  const riverW = 40 * scale, riverH = 57 * scale, riverGap = 1.4 * scale;
  const riverWidth = riverColumns * riverW + (riverColumns - 1) * riverGap;
  const riverHeight = riverRows * riverH + (riverRows - 1) * riverGap;
  const inner = riverWidth / 2 + 8 * scale;
  const river = (x: number, y: number, angle: number): MahjongRiverLayout => ({
    x, y, angle, columns: riverColumns, rows: riverRows, tileW: riverW, tileH: riverH, tileD: 12 * scale,
    gap: riverGap, gapX: riverGap, gapY: riverGap, rowPitch: riverH + riverGap, width: riverWidth, height: riverHeight,
  });
  const rivers = {
    south: river(-riverWidth / 2, inner, 0),
    east: river(inner, riverWidth / 2, -90),
    north: river(riverWidth / 2, -inner, 180),
    west: river(-inner, -riverWidth / 2, 90),
  };
  const meldTileW = 35 * scale, meldGap = 5 * scale, meldSlotWidth = meldTileW * 4 + meldGap;
  const southMeld: MahjongMeldLayout = {
    x: -meldSlotWidth * (portrait ? 1 : 2),
    y: inner + riverHeight + 22 * scale, angle: 0,
    tileW: meldTileW, tileH: meldTileW * 1.43, tileD: 12 * scale, gap: meldGap,
    slotWidth: meldSlotWidth, slots: 4, columns: portrait ? 2 : 4, rowPitch: meldTileW * 1.43 + 15 * scale,
    width: meldSlotWidth * (portrait ? 2 : 4), height: meldTileW * 1.43 * (portrait ? 2 : 1) + (portrait ? 15 * scale : 0),
  };
  const actionsY = selfRack.y - (portrait ? 68 : height < 500 ? 64 : 78);
  const publicTop = portrait ? 195 : height < 500 ? 74 : 150;
  const publicBottom = actionsY - (portrait || compact ? 59 : 12);
  const initialPublicBottom = actionsY - 12;
  const publicBounds = () => {
    const boxes = [...Object.values(rivers).map(r => projectMahjongBox({ ...r, depth: r.tileD }, camera)),
      projectMahjongBox({ ...southMeld, depth: southMeld.tileD }, camera)];
    return { top: Math.min(...boxes.map(b => b.y)), bottom: Math.max(...boxes.map(b => b.bottom)) };
  };
  let publicScale = 1;
  for (let pass = 0; pass < 3; pass++) {
    const bounds = publicBounds();
    const factor = Math.min(1, (initialPublicBottom - publicTop) / (bounds.bottom - bounds.top));
    if (factor < 1) {
      publicScale *= factor;
      for (const river of Object.values(rivers)) for (const key of ['x', 'y', 'tileW', 'tileH', 'tileD', 'gap', 'gapX', 'gapY', 'rowPitch', 'width', 'height'] as const) river[key] *= factor;
      for (const key of ['x', 'y', 'tileW', 'tileH', 'tileD', 'gap', 'slotWidth', 'width', 'height', 'rowPitch'] as const) southMeld[key] *= factor;
    }
    const fitted = publicBounds();
    camera.cy += publicTop - fitted.top + Math.max(0, initialPublicBottom - publicTop - (fitted.bottom - fitted.top)) * .35;
  }
  // Four enlarged meld groups must remain inside the viewport after perspective.
  const meldBounds = projectMahjongBox({ ...southMeld, depth: southMeld.tileD }, camera);
  if (meldBounds.right > width - 14) southMeld.x -= (meldBounds.right - width + 14) / projectMahjongPoint({ x: 0, y: southMeld.y }, camera).scale;

  const portraitW = portrait ? 39 : height < 500 ? 40 : width <= 900 ? 52 : Math.min(100, width * .05);
  const nameWidth = portrait ? 70 : height < 500 ? 76 : width <= 900 ? 90 : 140;
  const portraitHeight = portraitW + 68; // Includes three lines of name plus balance and status.
  const portraits: MahjongLayout['portraits'] = {
    north: { x: (width - portraitW) / 2, y: 12, width: portraitW, nameWidth },
    west: { x: 12, y: portrait ? 72 : compact ? 92 : height * .32, width: portraitW, nameWidth },
    east: { x: width - 12 - portraitW, y: portrait ? 72 : compact ? 92 : height * .32, width: portraitW, nameWidth },
    south: { x: 12, y: selfRack.y - portraitHeight - 8, width: portraitW, nameWidth },
  };
  if (mode === 'landscape' && height < 500) {
    const sideY = Math.min(portraits.west.y, portraits.south.y - portraitHeight - 12);
    portraits.west.y = sideY;
    portraits.east.y = sideY;
  }
  const standingBounds = (r: MahjongRackLayout) => projectMahjongBox({ ...r, width: r.length, height: r.tileD, depth: r.tileH }, camera);
  const flatBounds = (r: MahjongRackLayout) => projectMahjongBox({ ...r, width: r.length, height: r.tileH, depth: r.tileD }, camera);
  const moveRackTop = (r: MahjongRackLayout, target: number) => {
    for (let pass = 0; pass < 4; pass++) r.y += (target - Math.min(standingBounds(r).y, flatBounds(r).y)) / Math.cos(radians(camera.tilt));
  };
  // Phone names occupy the outer top columns; the north rail fits between them.
  if (portrait) {
    const factor = Math.min(1, (width - 2 * (nameWidth + 22)) / standingBounds(racks.north).width);
    for (const key of ['tileW', 'gap', 'length', 'drawGap', 'meldW', 'meldH', 'meldGap', 'meldSlotWidth'] as const) racks.north[key] *= factor;
  }
  racks.north.x = racks.north.length / 2;
  moveRackTop(racks.north, portrait ? 130 : compact ? portraits.north.y + portraitHeight + 12 : height < 500 ? 22 : 78);
  if (!portrait && !compact) {
    portraits.north.x = width * .8 - portraitW / 2;
    if (height < 500) {
      portraits.north.nameWidth = 52;
      portraits.north.x = standingBounds(racks.north).right + 8 + (52 - portraitW) / 2;
    }
  }
  const compressRackRun = (r: MahjongRackLayout, factor: number) => {
    // Preserve the enlarged green back height when a short screen needs a tighter row.
    for (const key of ['tileW', 'gap', 'length', 'drawGap', 'meldW', 'meldH', 'meldGap', 'meldSlotWidth'] as const) r[key] *= factor;
  };
  for (const seat of ['west', 'east'] as const) {
    const r = racks[seat];
    if (portrait || compact) {
      const target = portraits[seat].y + portraitHeight + 14;
      moveRackTop(r, target);
      const bottom = Math.max(standingBounds(r).bottom, flatBounds(r).bottom);
      if (bottom > selfRack.y - selfRack.lift - 12) {
        compressRackRun(r, (selfRack.y - selfRack.lift - 12 - target) / (bottom - target));
        moveRackTop(r, target);
      }
    }
    const northName = portraits.north;
    const northNameLeft = northName.x + (northName.width - northName.nameWidth) / 2;
    const northNameRight = northNameLeft + northName.nameWidth;
    const initialSolid = standingBounds(r), initialFlat = flatBounds(r);
    const touchesNorthName = Math.min(initialSolid.x, initialFlat.x) < northNameRight && Math.max(initialSolid.right, initialFlat.right) > northNameLeft;
    const targetTop = seat === 'east' && !portrait && !compact && touchesNorthName
      ? Math.max(standingBounds(r).y, portraits.north.y + portraitHeight + 14)
      : Math.min(standingBounds(r).y, flatBounds(r).y);
    const actionSpan = Math.min(height < 500 ? 360 : 500, width * (height < 500 ? .67 : .70));
    const actionCenter = width * (height < 500 ? .505 : .51);
    const touchesActions = Math.min(initialSolid.x, initialFlat.x) < actionCenter + actionSpan / 2 && Math.max(initialSolid.right, initialFlat.right) > actionCenter - actionSpan / 2;
    const maxBottom = portrait || compact
      ? Math.min(actionsY - 59, seat === 'west' ? portraits.south.y - 12 : Infinity)
      : Math.min(touchesActions ? actionsY - 12 : Infinity, selfRack.y - selfRack.lift - 12);
    moveRackTop(r, targetTop);
    for (let pass = 0; pass < 4; pass++) {
      const bottom = Math.max(standingBounds(r).bottom, flatBounds(r).bottom);
      if (bottom <= maxBottom) break;
      compressRackRun(r, Math.max(.1, (maxBottom - targetTop) / (bottom - targetTop)));
      moveRackTop(r, targetTop);
    }
    // Finished hands occupy their full face footprint, wider than a standing rail.
    for (let pass = 0; pass < 3; pass++) {
      const bounds = flatBounds(r);
      const inset = portrait || compact ? 14 : nameWidth + 24;
      if (seat === 'west' && bounds.x < inset) r.x += (inset - bounds.x) / projectMahjongPoint(r, camera).scale;
      if (seat === 'east' && bounds.right > width - inset) r.x -= (bounds.right - width + inset) / projectMahjongPoint(r, camera).scale;
    }
  }
  // Reserve real solid-body groups, including the fully revealed hand footprint.
  // Keeping this independent of counts means a claim never moves existing slots.
  const northBottom = Math.max(standingBounds(racks.north).bottom, flatBounds(racks.north).bottom);
  let publicOriginY = 0;
  const movePublic = (dy: number) => {
    for (const r of Object.values(rivers)) r.y += dy;
    southMeld.y += dy;
    publicOriginY += dy;
  };
  const shrinkPublic = (factor: number) => {
    for (const r of Object.values(rivers)) {
      r.y = publicOriginY + (r.y - publicOriginY) * factor;
      for (const key of ['x', 'tileW', 'tileH', 'tileD', 'gap', 'gapX', 'gapY', 'rowPitch', 'width', 'height'] as const) r[key] *= factor;
    }
    southMeld.y = publicOriginY + (southMeld.y - publicOriginY) * factor;
    for (const key of ['x', 'tileW', 'tileH', 'tileD', 'gap', 'slotWidth', 'width', 'height', 'rowPitch'] as const) southMeld[key] *= factor;
    publicScale *= factor;
  };
  for (let pass = 0; pass < 8; pass++) {
    const top = projectMahjongBox({ ...rivers.north, depth: rivers.north.tileD }, camera).y;
    if (top < northBottom + 12) movePublic((northBottom + 12 - top) / Math.cos(radians(camera.tilt)));
    let bounds = publicBounds();
    if (bounds.bottom > publicBottom && bounds.top > northBottom + 12) {
      movePublic(-Math.min(bounds.top - northBottom - 12, bounds.bottom - publicBottom) / Math.cos(radians(camera.tilt)));
      bounds = publicBounds();
    }
    if (bounds.bottom > publicBottom) {
      const originY = projectMahjongPoint({ x: 0, y: publicOriginY }, camera).y;
      shrinkPublic(Math.max(.1, Math.min(.98, (publicBottom - originY) / (bounds.bottom - originY))));
    }
  }
  const westRight = Math.max(standingBounds(racks.west).right, flatBounds(racks.west).right);
  const eastLeft = Math.min(standingBounds(racks.east).x, flatBounds(racks.east).x);
  // Side rails keep their enlarged green backs; compact river panels fit between them.
  for (let pass = 0; pass < 6; pass++) {
    const west = projectMahjongBox({ ...rivers.west, depth: rivers.west.tileD }, camera);
    const east = projectMahjongBox({ ...rivers.east, depth: rivers.east.tileD }, camera);
    const factor = Math.min(1, (camera.cx - westRight - 10) / (camera.cx - west.x), (eastLeft - camera.cx - 10) / (east.right - camera.cx));
    if (factor >= .99999) break;
    for (const r of Object.values(rivers)) {
      r.y = publicOriginY + (r.y - publicOriginY) * factor;
      for (const key of ['x', 'tileW', 'tileH', 'tileD', 'gap', 'gapX', 'gapY', 'rowPitch', 'width', 'height'] as const) r[key] *= factor;
    }
    publicScale *= factor;
  }
  // A centered south rail also clears the long east rail in the four-kong state.
  for (let pass = 0; pass < 5; pass++) {
    const bounds = projectMahjongBox({ ...southMeld, depth: southMeld.tileD }, camera);
    const factor = Math.min(1, (camera.cx - westRight - 10) / (camera.cx - bounds.x), (eastLeft - camera.cx - 10) / (bounds.right - camera.cx));
    if (factor >= .99999) break;
    for (const key of ['x', 'tileW', 'tileH', 'tileD', 'gap', 'slotWidth', 'width', 'height', 'rowPitch'] as const) southMeld[key] *= factor;
  }
  return {
    mode, viewport: { width, height }, camera,
    frame: { x: -width * .55, y: -height * .65, width: width * 1.1, height: height * 1.7 },
    center: { x: -90 * scale * publicScale, y: publicOriginY -75 * scale * publicScale, width: 180 * scale * publicScale, height: 150 * scale * publicScale },
    racks, rivers, southMeld, selfRack, portraits, actionsY,
  };
}

export type RiverReadingAnchor<Id extends string | number = number> = { id: Id; index: number; rowOffset: number };

/** Match the renderer's complete-row window; offset is relative to that visible row. */
export function saveRiverAnchor<Id extends string | number>(
  ids: readonly Id[], scrollTop: number, columns: number, rowPitch: number,
): RiverReadingAnchor<Id> | null {
  if (!ids.length || columns < 1 || rowPitch <= 0) return null;
  const offset = Math.max(0, scrollTop) / rowPitch;
  const row = Math.round(offset);
  const index = Math.min(ids.length - 1, row * Math.floor(columns));
  return { id: ids[index], index, rowOffset: clamp(offset - row, -.49, .49) };
}

/** Falls back to the nearest surviving index if a claimed tile was removed from this river. */
export function restoreRiverAnchor<Id extends string | number>(
  anchor: RiverReadingAnchor<Id> | null, ids: readonly Id[], columns: number, rowPitch: number,
): number {
  if (!anchor || !ids.length || columns < 1 || rowPitch <= 0) return 0;
  const found = ids.indexOf(anchor.id);
  const index = found < 0 ? clamp(anchor.index, 0, ids.length - 1) : found;
  // Keep round(scrollTop / pitch) on the row containing the saved tile, including
  // anchors captured by the older floor-based implementation with offsets >= .5.
  return Math.max(0, (Math.floor(index / Math.floor(columns)) + clamp(anchor.rowOffset, -.49, .49)) * rowPitch);
}
