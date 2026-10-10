export interface Pose {
  readonly x: number;
  readonly y: number;
  /** Heading in radians, 0 faces +x. */
  readonly angle: number;
}

export interface Hit {
  /** Perpendicular distance to the wall, which avoids fisheye distortion. */
  readonly distance: number;
  readonly cell: string;
  /** Which kind of grid line was crossed last, used to shade faces differently. */
  readonly side: "x" | "y";
}

export type GridMap = readonly string[];

const MAX_STEPS = 64;
const EMPTY_CELL = ".";
const OUTSIDE_CELL = "1";

function cellAt(map: GridMap, column: number, row: number): string {
  return map[row]?.[column] ?? OUTSIDE_CELL;
}

function castRay(map: GridMap, pose: Pose, rayAngle: number): Hit {
  const directionX = Math.cos(rayAngle);
  const directionY = Math.sin(rayAngle);
  const deltaX = directionX === 0 ? Infinity : Math.abs(1 / directionX);
  const deltaY = directionY === 0 ? Infinity : Math.abs(1 / directionY);
  const stepX = directionX < 0 ? -1 : 1;
  const stepY = directionY < 0 ? -1 : 1;

  let column = Math.floor(pose.x);
  let row = Math.floor(pose.y);
  let sideDistanceX = (directionX < 0 ? pose.x - column : column + 1 - pose.x) * deltaX;
  let sideDistanceY = (directionY < 0 ? pose.y - row : row + 1 - pose.y) * deltaY;
  let side: Hit["side"] = "x";

  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (sideDistanceX < sideDistanceY) {
      sideDistanceX += deltaX;
      column += stepX;
      side = "x";
    } else {
      sideDistanceY += deltaY;
      row += stepY;
      side = "y";
    }
    const cell = cellAt(map, column, row);
    if (cell !== EMPTY_CELL) {
      const travelled = side === "x" ? sideDistanceX - deltaX : sideDistanceY - deltaY;
      return { distance: travelled, cell, side };
    }
  }
  return { distance: MAX_STEPS, cell: OUTSIDE_CELL, side };
}

/** Casts one ray per screen column across the field of view and returns the hits left to right. */
export function castFrame(map: GridMap, pose: Pose, columns: number, fieldOfView: number): Hit[] {
  const hits: Hit[] = [];
  for (let index = 0; index < columns; index += 1) {
    const offset = columns === 1 ? 0 : index / (columns - 1) - 0.5;
    const rayOffset = offset * fieldOfView;
    const hit = castRay(map, pose, pose.angle + rayOffset);
    hits.push({ ...hit, distance: hit.distance * Math.cos(rayOffset) });
  }
  return hits;
}
