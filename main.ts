// Push-optimal Sokoban solver for make.fun sokoban-solver-01-run-20261121.
// Strategy: split each level into its rooms (articulation-point analysis), solve
// every room push-optimally with A* over pushes, then stitch the room solutions
// together with plain walks through the hallway. Rooms are independent by
// construction (boxes never leave their room), so the sum of the room optima is
// the level's push optimum. Deterministic: every budget is a node count, never
// the wall clock, so two runs produce byte-identical output.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const IN_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Four moves, fixed order everywhere so every BFS is deterministic.
const DIRS: [number, number, string][] = [
  [0, -1, 'u'],
  [0, 1, 'd'],
  [-1, 0, 'l'],
  [1, 0, 'r'],
];

type Board = {
  w: number;
  h: number;
  wall: Uint8Array;
  goals: number[];
  goalSet: Uint8Array;
  boxes: number[];
  player: number;
};

function parseLevel(text: string): Board {
  const rows = text.split('\n').filter((r) => r.length > 0);
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const wall = new Uint8Array(w * h);
  const goals: number[] = [];
  const goalSet = new Uint8Array(w * h);
  const boxes: number[] = [];
  let player = 0;
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const ch = row[x] ?? '#';
      const i = y * w + x;
      if (ch === '#') wall[i] = 1;
      if (ch === '.' || ch === '*' || ch === '+') {
        goals.push(i);
        goalSet[i] = 1;
      }
      if (ch === '$' || ch === '*') boxes.push(i);
      if (ch === '@' || ch === '+') player = i;
    }
  });
  boxes.sort((a, b) => a - b);
  return { w, h, wall, goals, goalSet, boxes, player };
}

// Flood fill from `start` over cells where open[i] is 1. Returns the visited
// set and the smallest visited cell (the canonical player position: every
// square the player can stand on without pushing is the same position).
function flood(start: number, open: Uint8Array, w: number, h: number): { seen: Uint8Array; low: number } {
  const seen = new Uint8Array(w * h);
  const stack: number[] = [start];
  seen[start] = 1;
  let low = start;
  while (stack.length > 0) {
    const u = stack.pop()!;
    if (u < low) low = u;
    const ux = u % w;
    const uy = (u / w) | 0;
    for (const [dx, dy] of DIRS) {
      const vx = ux + dx;
      const vy = uy + dy;
      if (vx < 0 || vx >= w || vy < 0 || vy >= h) continue;
      const v = u + dy * w + dx;
      if (!open[v] || seen[v]) continue;
      seen[v] = 1;
      stack.push(v);
    }
  }
  return { seen, low };
}

// Tarjan articulation points of the walkable graph (iterative; grids are tiny).
function findArticulations(w: number, h: number, wall: Uint8Array): Uint8Array {
  const n = w * h;
  const disc = new Int32Array(n).fill(-1);
  const low = new Int32Array(n);
  const isArt = new Uint8Array(n);
  let clock = 0;
  for (let s = 0; s < n; s++) {
    if (wall[s] || disc[s] !== -1) continue;
    const stack: [number, number, number][] = [[s, -1, 0]];
    disc[s] = low[s] = clock++;
    let rootKids = 0;
    while (stack.length > 0) {
      const top = stack[stack.length - 1]!;
      const [u, parent, ci] = top;
      if (ci < 4) {
        top[2]++;
        const [dx, dy] = DIRS[ci];
        const ux = u % w;
        const uy = (u / w) | 0;
        const vx = ux + dx;
        const vy = uy + dy;
        if (vx < 0 || vx >= w || vy < 0 || vy >= h) continue;
        const v = u + dy * w + dx;
        if (wall[v]) continue;
        if (disc[v] === -1) {
          if (parent === -1) rootKids++;
          disc[v] = low[v] = clock++;
          stack.push([v, u, 0]);
        } else if (v !== parent) {
          if (disc[v] < low[u]) low[u] = disc[v];
        }
      } else {
        stack.pop();
        if (parent !== -1) {
          if (low[u] < low[parent]) low[parent] = low[u];
          if (low[u] >= disc[parent]) isArt[parent] = 1;
        } else if (rootKids > 1) {
          isArt[u] = 1;
        }
      }
    }
  }
  return isArt;
}

function componentsWithout(w: number, h: number, wall: Uint8Array, removed: number): number[][] {
  const n = w * h;
  const seen = new Uint8Array(n);
  const comps: number[][] = [];
  for (let s = 0; s < n; s++) {
    if (wall[s] || s === removed || seen[s]) continue;
    const comp: number[] = [];
    const stack = [s];
    seen[s] = 1;
    while (stack.length > 0) {
      const u = stack.pop()!;
      comp.push(u);
      const ux = u % w;
      const uy = (u / w) | 0;
      for (const [dx, dy] of DIRS) {
        const vx = ux + dx;
        const vy = uy + dy;
        if (vx < 0 || vx >= w || vy < 0 || vy >= h) continue;
        const v = u + dy * w + dx;
        if (wall[v] || v === removed || seen[v]) continue;
        seen[v] = 1;
        stack.push(v);
      }
    }
    comps.push(comp);
  }
  return comps;
}

type Room = { door: number; cells: number[]; boxes: number[]; goals: number[] };

// A room is a component cut off by one door cell: it holds boxes and goals in
// equal number and never the player start. Take the smallest such components
// first; a bigger component holding several rooms is skipped once its rooms
// are claimed.
function findRooms(b: Board): Room[] {
  const boxSet = new Set(b.boxes);
  const goalSet = new Set(b.goals);
  const isArt = findArticulations(b.w, b.h, b.wall);
  type Cand = { door: number; cells: number[]; boxes: number };
  const cands: Cand[] = [];
  for (let c = 0; c < b.w * b.h; c++) {
    if (!isArt[c]) continue;
    for (const comp of componentsWithout(b.w, b.h, b.wall, c)) {
      let nb = 0;
      let ng = 0;
      let hasPlayer = false;
      for (const x of comp) {
        if (boxSet.has(x)) nb++;
        if (goalSet.has(x)) ng++;
        if (x === b.player) hasPlayer = true;
      }
      if (nb > 0 && nb === ng && !hasPlayer) cands.push({ door: c, cells: comp, boxes: nb });
    }
  }
  cands.sort((x, y) => x.cells.length - y.cells.length);
  const claimed = new Set<number>();
  const rooms: Room[] = [];
  for (const cand of cands) {
    if (cand.cells.some((x) => claimed.has(x))) continue;
    for (const x of cand.cells) claimed.add(x);
    const boxes = cand.cells.filter((x) => boxSet.has(x));
    const goals = cand.cells.filter((x) => goalSet.has(x));
    rooms.push({ door: cand.door, cells: cand.cells, boxes, goals });
  }
  rooms.sort((x, y) => x.door - y.door);
  return rooms;
}

// Minimum pushes to bring a box from each cell to any goal, other boxes
// treated as floor (so it is a true lower bound). 0-1 BFS over (box, player)
// states, multi-source from every (goal, adjacent player) pair. Cells with
// no finite value are dead: a box there can never reach a goal.
function pushDistances(b: Board, allowed: Uint8Array): Int32Array {
  const n = b.w * b.h;
  const dist = new Int32Array(n * n).fill(-1);
  const cap = 2 * n * n + 8;
  const dq = new Int32Array(cap);
  let head = cap >> 1;
  let tail = head;
  const pushFront = (s: number): void => {
    head = (head - 1 + cap) % cap;
    dq[head] = s;
  };
  const pushBack = (s: number): void => {
    dq[tail] = s;
    tail = (tail + 1) % cap;
  };
  const popFront = (): number => {
    const s = dq[head];
    head = (head + 1) % cap;
    return s;
  };
  for (const g of b.goals) {
    if (!allowed[g]) continue;
    const gx = g % b.w;
    const gy = (g / b.w) | 0;
    for (const [dx, dy] of DIRS) {
      const px = gx + dx;
      const py = gy + dy;
      if (px < 0 || px >= b.w || py < 0 || py >= b.h) continue;
      const p = g + dy * b.w + dx;
      if (!allowed[p] || b.wall[p]) continue;
      const s = g * n + p;
      if (dist[s] === -1) {
        dist[s] = 0;
        pushFront(s);
      }
    }
  }
  while (head !== tail) {
    const s = popFront();
    const box = (s / n) | 0;
    const pl = s % n;
    const c = dist[s];
    const bx = box % b.w;
    const by = (box / b.w) | 0;
    const px = pl % b.w;
    const py = (pl / b.w) | 0;
    // Player steps (cost 0).
    for (const [dx, dy] of DIRS) {
      const nx = px + dx;
      const ny = py + dy;
      if (nx < 0 || nx >= b.w || ny < 0 || ny >= b.h) continue;
      const np = pl + dy * b.w + dx;
      if (!allowed[np] || b.wall[np] || np === box) continue;
      const s2 = box * n + np;
      if (dist[s2] === -1) {
        dist[s2] = c;
        pushFront(s2);
      }
    }
    // Reverse pushes (cost 1): the box came from box-d, the player from box-2d.
    for (const [dx, dy] of DIRS) {
      const b2x = bx - dx;
      const b2y = by - dy;
      const p2x = bx - 2 * dx;
      const p2y = by - 2 * dy;
      if (b2x < 0 || b2x >= b.w || b2y < 0 || b2y >= b.h) continue;
      if (p2x < 0 || p2x >= b.w || p2y < 0 || p2y >= b.h) continue;
      const bPrev = box - dy * b.w - dx;
      const pPrev = box - 2 * dy * b.w - 2 * dx;
      if (!allowed[bPrev] || b.wall[bPrev]) continue;
      if (!allowed[pPrev] || b.wall[pPrev]) continue;
      const s2 = bPrev * n + pPrev;
      if (dist[s2] === -1) {
        dist[s2] = c + 1;
        pushBack(s2);
      }
    }
  }
  const mind = new Int32Array(n).fill(-1);
  for (let cell = 0; cell < n; cell++) {
    if (!allowed[cell] || b.wall[cell]) continue;
    let best = -1;
    for (let p = 0; p < n; p++) {
      const d = dist[cell * n + p];
      if (d !== -1 && (best === -1 || d < best)) best = d;
    }
    mind[cell] = best;
  }
  return mind;
}

// Shortest walk from `from` to `to` over cells where open[i] is 1, treating
// `boxes` as walls. Deterministic neighbour order; null when unreachable.
function walkPath(
  from: number,
  to: number,
  boxes: number[],
  open: Uint8Array,
  w: number,
  h: number,
): string | null {
  if (from === to) return '';
  const blocked = new Uint8Array(w * h);
  for (const b of boxes) blocked[b] = 1;
  const prev = new Int32Array(w * h).fill(-1);
  const prevMove = new Array<string>(w * h).fill('');
  const queue: number[] = [from];
  prev[from] = from;
  let qi = 0;
  while (qi < queue.length) {
    const u = queue[qi++]!;
    const ux = u % w;
    const uy = (u / w) | 0;
    for (const [dx, dy, ch] of DIRS) {
      const vx = ux + dx;
      const vy = uy + dy;
      if (vx < 0 || vx >= w || vy < 0 || vy >= h) continue;
      const v = u + dy * w + dx;
      if (!open[v] || blocked[v] || prev[v] !== -1) continue;
      prev[v] = u;
      prevMove[v] = ch;
      if (v === to) {
        let out = '';
        let cur = v;
        while (cur !== from) {
          out = prevMove[cur] + out;
          cur = prev[cur]!;
        }
        return out;
      }
      queue.push(v);
    }
  }
  return null;
}

type Push = { box: number; dx: number; dy: number; ch: string };

type RoomResult = { pushes: Push[]; endPlayer: number; expansions: number } | null;

// A* over pushes inside one room (allowed cells = room cells + door).
// `weight` scales the heuristic: 1 is optimal, higher is a faster fallback.
function solveRoom(
  b: Board,
  allowed: Uint8Array,
  goals: number[],
  boxes0: number[],
  player0: number,
  door: number,
  weight: number,
  cap: number,
): RoomResult {
  const mind = pushDistances(b, allowed);
  const goalSet = new Uint8Array(b.w * b.h);
  for (const g of goals) goalSet[g] = 1;
  const heuristic = (boxes: number[]): number => {
    let s = 0;
    for (const x of boxes) {
      const d = mind[x];
      if (d === -1) return Infinity;
      s += d;
    }
    return s;
  };
  const openFor = (boxes: number[]): Uint8Array => {
    const open = new Uint8Array(b.w * b.h);
    for (let i = 0; i < b.w * b.h; i++) if (allowed[i] && !b.wall[i]) open[i] = 1;
    for (const x of boxes) open[x] = 0;
    return open;
  };
  const dead2x2 = (boxes: number[]): boolean => {
    const boxSet = new Set(boxes);
    const filled = (x: number): boolean => b.wall[x] || boxSet.has(x);
    for (let y = 0; y + 1 < b.h; y++) {
      for (let x = 0; x + 1 < b.w; x++) {
        const a = y * b.w + x;
        const cells = [a, a + 1, a + b.w, a + b.w + 1];
        if (!cells.every((c) => allowed[c] && filled(c))) continue;
        if (!cells.some((c) => boxSet.has(c))) continue;
        if (cells.some((c) => goalSet[c])) continue;
        return true;
      }
    }
    return false;
  };

  // State arrays; index 0 is the start.
  const stBoxes: number[][] = [boxes0.slice()];
  const stPlayer: number[] = [player0];
  const stParent: number[] = [-1];
  const stAct: (Push | null)[] = [null];
  const stG: number[] = [0];
  const best = new Map<string, number>();
  const keyOf = (player: number, boxes: number[]): string => `${player}|${boxes.join(',')}`;
  const h0 = heuristic(boxes0);
  if (h0 === Infinity) return null;
  best.set(keyOf(player0, boxes0), 0);
  // Heap of [f, h, seq, stateIndex], smallest first.
  const heap: [number, number, number, number][] = [];
  let seq = 0;
  const heapLess = (x: [number, number, number, number], y: [number, number, number, number]): boolean =>
    x[0] < y[0] || (x[0] === y[0] && (x[1] < y[1] || (x[1] === y[1] && x[2] < y[2])));
  const heapPush = (e: [number, number, number, number]): void => {
    let i = heap.length;
    heap.push(e);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!heapLess(heap[i]!, heap[p]!)) break;
      [heap[i], heap[p]] = [heap[p]!, heap[i]!];
      i = p;
    }
  };
  const heapPop = (): [number, number, number, number] => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heapLess(heap[l]!, heap[m]!)) m = l;
        if (r < heap.length && heapLess(heap[r]!, heap[m]!)) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m]!, heap[i]!];
        i = m;
      }
    }
    return top;
  };
  heapPush([h0 * weight, h0, seq++, 0]);

  let expansions = 0;
  while (heap.length > 0) {
    const [, , , idx] = heapPop();
    const g = stG[idx]!;
    const boxes = stBoxes[idx]!;
    const player = stPlayer[idx]!;
    if (best.get(keyOf(player, boxes)) !== g) continue; // stale entry
    expansions++;
    if (expansions > cap) return null;
    // Goal: every box on a goal and the player can still walk out the door.
    if (boxes.every((x) => goalSet[x])) {
      const open = openFor(boxes);
      const { seen } = flood(player, open, b.w, b.h);
      if (seen[door]) {
        const pushes: Push[] = [];
        let cur = idx;
        while (cur > 0) {
          pushes.push(stAct[cur]!);
          cur = stParent[cur]!;
        }
        pushes.reverse();
        // The player really stands on the last pushed box's old cell after
        // the final push — not on the canonical (lowest reachable) cell the
        // state stores. Stitching walks start from the real position.
        const endPlayer = pushes.length > 0 ? pushes[pushes.length - 1]!.box : player0;
        return { pushes, endPlayer, expansions };
      }
    }
    const open = openFor(boxes);
    const { seen: reach } = flood(player, open, b.w, b.h);
    const boxSet = new Set(boxes);
    for (let bi = 0; bi < boxes.length; bi++) {
      const box = boxes[bi]!;
      const bx = box % b.w;
      const by = (box / b.w) | 0;
      for (const [dx, dy, ch] of DIRS) {
        const tx = bx + dx;
        const ty = by + dy;
        if (tx < 0 || tx >= b.w || ty < 0 || ty >= b.h) continue;
        const target = box + dy * b.w + dx;
        if (!allowed[target] || b.wall[target] || boxSet.has(target)) continue;
        const qx = bx - dx;
        const qy = by - dy;
        if (qx < 0 || qx >= b.w || qy < 0 || qy >= b.h) continue;
        const pusher = box - dy * b.w - dx;
        if (!reach[pusher]) continue;
        const next = boxes.slice();
        next[bi] = target;
        next.sort((x, y) => x - y);
        const h = heuristic(next);
        if (h === Infinity) continue;
        if (dead2x2(next)) continue;
        const open2 = openFor(next);
        const { low: canon } = flood(box, open2, b.w, b.h);
        const ng = g + 1;
        const k = keyOf(canon, next);
        const prev = best.get(k);
        if (prev !== undefined && prev <= ng) continue;
        best.set(k, ng);
        const ni = stBoxes.length;
        stBoxes.push(next);
        stPlayer.push(canon);
        stParent.push(idx);
        stAct.push({ box, dx, dy, ch });
        stG.push(ng);
        heapPush([ng + weight * h, h, seq++, ni]);
      }
    }
  }
  return null;
}

// Turn a room's push list into LURD moves, walking between pushes.
function pushesToMoves(
  b: Board,
  allowed: Uint8Array,
  pushes: Push[],
  boxes0: number[],
  player0: number,
): string {
  let out = '';
  let player = player0;
  const boxes = boxes0.slice();
  for (const p of pushes) {
    const pusher = p.box - p.dy * b.w - p.dx;
    const open = new Uint8Array(b.w * b.h);
    for (let i = 0; i < b.w * b.h; i++) if (allowed[i] && !b.wall[i]) open[i] = 1;
    const walk = walkPath(player, pusher, boxes, open, b.w, b.h);
    if (walk === null) return '';
    out += walk + p.ch;
    const bi = boxes.indexOf(p.box);
    boxes[bi] = p.box + p.dy * b.w + p.dx;
    boxes.sort((x, y) => x - y);
    player = p.box;
  }
  return out;
}

const ROOM_CAP = 200_000;

function solveLevel(text: string): string {
  const b = parseLevel(text);
  if (b.boxes.length === 0) return '';
  const rooms = findRooms(b);
  const claimed = new Set<number>();
  for (const r of rooms) for (const x of r.boxes) claimed.add(x);
  if (rooms.length === 0 || claimed.size !== b.boxes.length) {
    // Fallback: solve the whole level as one room (small levels only).
    const allowed = new Uint8Array(b.w * b.h);
    for (let i = 0; i < b.w * b.h; i++) if (!b.wall[i]) allowed[i] = 1;
    for (const weight of [1, 2, 1000]) {
      const res = solveRoom(b, allowed, b.goals, b.boxes, b.player, b.player, weight, 500_000);
      if (res) return pushesToMoves(b, allowed, res.pushes, b.boxes, b.player);
    }
    return '';
  }
  const fullOpen = new Uint8Array(b.w * b.h);
  for (let i = 0; i < b.w * b.h; i++) if (!b.wall[i]) fullOpen[i] = 1;
  let moves = '';
  let player = b.player;
  const curBoxes = b.boxes.slice();
  for (const room of rooms) {
    const walk = walkPath(player, room.door, curBoxes, fullOpen, b.w, b.h);
    if (walk === null) return '';
    moves += walk;
    player = room.door;
    const allowed = new Uint8Array(b.w * b.h);
    for (const c of room.cells) allowed[c] = 1;
    allowed[room.door] = 1;
    let res: RoomResult = null;
    for (const weight of [1, 2, 1000]) {
      res = solveRoom(b, allowed, room.goals, room.boxes, room.door, room.door, weight, ROOM_CAP);
      if (res) break;
    }
    if (!res) return '';
    moves += pushesToMoves(b, allowed, res.pushes, room.boxes, room.door);
    player = res.endPlayer;
    // Room boxes are solved: replace them with their goals in the global set.
    for (const x of room.boxes) {
      const i = curBoxes.indexOf(x);
      curBoxes.splice(i, 1);
    }
    for (const g of room.goals) curBoxes.push(g);
    curBoxes.sort((x, y) => x - y);
  }
  return moves;
}

for (const id of readdirSync(IN_DIR).sort()) {
  const moves = solveLevel(readFileSync(join(IN_DIR, id, 'level.txt'), 'utf8'));
  mkdirSync(join(OUT_DIR, id), { recursive: true });
  writeFileSync(join(OUT_DIR, id, 'solution.txt'), `${moves}\n`);
}
