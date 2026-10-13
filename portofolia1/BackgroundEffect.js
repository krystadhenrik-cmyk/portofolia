
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: true });

let w, h;
let viewH = 0;
let dpr = 1;
let tileSize = 38;
let placements = [];
let neighborList = [];
let values = null;
let velocities = null;
let tileLift = null;
let tileLiftVel = null;
let tileTouch = null;
let touchGen = 0;
let running = true;

const BASE_VISIBILITY = 0.1;
const OPACITY_SWING = 0.09;
const DISPLAY_OPACITY = 1;
const COUPLING = 0.056;
const DAMPING = 0.984;
const RESTORE = 0.00045;
const TIME_STEP = 0.5;
const RIPPLE_NOISE = 0.00045;

const TILE_LIFT_SPRING = 0.11;
const TILE_LIFT_DAMP = 0.93;
const MOUSE_LIFT_ALPHA = 0.24;
const FRICTION_MIN_SPEED = 0.06;
const FRICTION_GAIN = 0.72;
const FRICTION_MAX = 0.52;
const FRICTION_TARGET = 0.58;
const FRICTION_VEL_GAIN = 0.035;
const FRICTION_SAMPLE_STEP = 5;

const MAX_FPS = 14;
const FRAME_COST_LIMIT_MS = 12;
const PERF_WARN_MS = 8;
const PERF_CRITICAL_MS = 14;
const PERF_SEVERE_MS = 20;

let lastTick = 0;
let physicsSteps = 1;
let perfEma = 0;
let skipDrawFrame = false;

let mouseX = -9999;
let mouseY = -9999;
let mouseVX = 0;
let mouseVY = 0;
let mouseReady = false;
let lastMouseMoveTime = 0;
let prevFrictionX = null;
let prevFrictionY = null;
let spatialGrid = new Map();
let spatialCellSize = 40;
const frictionScratch = new Set();

function getCombinedLoad() {
    return Math.max(perfEma, window.__fxSparkLoad || 0);
}

function getFrameInterval() {
    const load = getCombinedLoad();
    if (load > PERF_SEVERE_MS) {
        return 1000 / 7;
    }
    if (load > PERF_CRITICAL_MS) {
        return 1000 / 10;
    }
    if (load > PERF_WARN_MS) {
        return 1000 / 12;
    }
    return 1000 / MAX_FPS;
}

function pointInPolygon(px, py, verts) {
    let inside = false;

    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
        const xi = verts[i].x;
        const yi = verts[i].y;
        const xj = verts[j].x;
        const yj = verts[j].y;
        const intersect =
            (yi > py) !== (yj > py) &&
            px < ((xj - xi) * (py - yi)) / (yj - yi + 0.00001) + xi;

        if (intersect) {
            inside = !inside;
        }
    }

    return inside;
}

function getTilesAtPoint(px, py) {
    const matches = [];
    const gx0 = Math.floor(px / spatialCellSize);
    const gy0 = Math.floor(py / spatialCellSize);

    for (let gx = gx0 - 1; gx <= gx0 + 1; gx++) {
        for (let gy = gy0 - 1; gy <= gy0 + 1; gy++) {
            const bucket = spatialGrid.get(gx + "," + gy);
            if (!bucket) {
                continue;
            }

            for (let b = 0; b < bucket.length; b++) {
                const i = bucket[b];
                if (pointInPolygon(px, py, placements[i].verts)) {
                    matches.push(i);
                }
            }
        }
    }

    return matches;
}

function applyTileFriction(i, speed) {
    const intensity = Math.min(speed * FRICTION_GAIN, FRICTION_MAX);
    if (intensity < FRICTION_MIN_SPEED * FRICTION_GAIN) {
        return;
    }

    tileTouch[i] = touchGen;
    tileLiftVel[i] += intensity * FRICTION_VEL_GAIN;
    springTileLift(i, intensity * FRICTION_TARGET);
}

function applyFrictionAtPoint(px, py, speed) {
    const tiles = getTilesAtPoint(px, py);

    for (let t = 0; t < tiles.length; t++) {
        const i = tiles[t];
        if (frictionScratch.has(i)) {
            continue;
        }

        frictionScratch.add(i);
        applyTileFriction(i, speed);
    }
}

function deg2rad(d) {
    return (d * Math.PI) / 180;
}

function rotatePoint(p, angleDeg) {
    const r = deg2rad(angleDeg);
    const c = Math.cos(r);
    const s = Math.sin(r);
    return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

function translatePentagon(verts, dx, dy) {
    return verts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

function makeBasePentagon(size) {
    const angle01 = 60;
    const length1 = size;
    const angle12 = -(90 - angle01);

    const p0 = { x: 0, y: 0 };
    const p1 = {
        x: p0.x + length1 * Math.cos(deg2rad(angle01)),
        y: p0.y + length1 * Math.sin(deg2rad(angle01))
    };
    const p4 = {
        x: p0.x + length1 * Math.cos(deg2rad(-angle01)),
        y: p0.y + length1 * Math.sin(deg2rad(-angle01))
    };
    const p2 = {
        x: p1.x + length1 * Math.cos(deg2rad(angle12)),
        y: p1.y + length1 * Math.sin(deg2rad(angle12))
    };
    const p3 = {
        x: p4.x + length1 * Math.cos(deg2rad(-angle12)),
        y: p4.y + length1 * Math.sin(deg2rad(-angle12))
    };

    return [p0, p1, p2, p3, p4];
}

function rotatePentagon(verts, angleDeg) {
    return verts.map((p) => rotatePoint(p, angleDeg));
}

function buildCairoGroup(size) {
    const base = makeBasePentagon(size);
    const group = [base];

    let p1 = rotatePentagon(base, 90);
    let diff = { x: base[1].x - p1[1].x, y: base[1].y - p1[1].y };
    group.push(translatePentagon(p1, diff.x, diff.y));

    let p2 = rotatePentagon(base, 180);
    diff = { x: base[2].x - p2[3].x, y: base[2].y - p2[3].y };
    group.push(translatePentagon(p2, diff.x, diff.y));

    let p3 = rotatePentagon(base, -90);
    diff = { x: base[4].x - p3[4].x, y: base[4].y - p3[4].y };
    group.push(translatePentagon(p3, diff.x, diff.y));

    const columnOffset = {
        x: group[0][0].x - group[1][2].x,
        y: group[0][0].y - group[1][2].y
    };

    const bottomLength = Math.hypot(base[2].x - base[3].x, base[2].y - base[3].y);
    const pentWidth = base[2].x;
    const repSpacing = pentWidth * 2 + bottomLength;

    return {
        group,
        columnOffset,
        repSpacing,
        pentWidth,
        groupBounds: pentBounds(group.flat())
    };
}

function pentBounds(verts) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    verts.forEach((p) => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    });

    return { minX, minY, maxX, maxY };
}

function getDocumentHeight() {
    return Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        window.innerHeight
    );
}

function getPageMouseY(clientY) {
    return clientY + (window.scrollY || 0);
}

function pickTileSize() {
    let best = 32;
    let bestScore = Infinity;
    const heightForPick = viewH || window.innerHeight;

    for (let size = 22; size <= 64; size++) {
        const { repSpacing } = buildCairoGroup(size);
        const colStep = repSpacing * 0.5;
        const cols = w / colStep;
        const rows = heightForPick / repSpacing;
        const score =
            Math.abs(cols - Math.round(cols)) +
            Math.abs(rows - Math.round(rows));

        if (score < bestScore) {
            bestScore = score;
            best = size;
        }
    }

    return best;
}

function groupOrigin(col, row, startX, startY, layout) {
    const { repSpacing, pentWidth, columnOffset } = layout;

    if (col % 2 === 1) {
        return {
            ox: startX + Math.floor(col / 2) * repSpacing + pentWidth * 2 + columnOffset.x,
            oy: startY + row * repSpacing + columnOffset.y
        };
    }

    return {
        ox: startX + Math.floor(col / 2) * repSpacing,
        oy: startY + row * repSpacing
    };
}

function vertexKey(p) {
    return `${Math.round(p.x * 4)},${Math.round(p.y * 4)}`;
}

function edgeKey(v1, v2) {
    const a = vertexKey(v1);
    const b = vertexKey(v2);
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function buildNeighbors() {
    const n = placements.length;
    const sets = Array.from({ length: n }, () => new Set());
    const edgeMap = new Map();

    for (let i = 0; i < n; i++) {
        const verts = placements[i].verts;
        for (let e = 0; e < 5; e++) {
            const ek = edgeKey(verts[e], verts[(e + 1) % 5]);
            if (!edgeMap.has(ek)) edgeMap.set(ek, []);
            edgeMap.get(ek).push(i);
        }
    }

    edgeMap.forEach((indices) => {
        for (let a = 0; a < indices.length; a++) {
            for (let b = a + 1; b < indices.length; b++) {
                const i = indices[a];
                const j = indices[b];
                if (i === j) continue;
                sets[i].add(j);
                sets[j].add(i);
            }
        }
    });

    neighborList = sets.map((set) => Array.from(set));
}

function hashRandom(seed) {
    const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
    return x - Math.floor(x);
}

function initOscillators() {
    const n = placements.length;
    values = new Float32Array(n);
    velocities = new Float32Array(n);
    tileLift = new Float32Array(n);
    tileLiftVel = new Float32Array(n);
    tileTouch = new Int32Array(n);

    for (let i = 0; i < n; i++) {
        const seed = placements[i].seed;
        const r1 = hashRandom(seed);
        const r2 = hashRandom(seed + 17.31);
        const r3 = hashRandom(seed + 53.79);

        values[i] = (r1 * 2 - 1) * (0.55 + r2 * 0.45);
        velocities[i] = (r3 * 2 - 1) * (0.004 + r1 * 0.009);
    }
}

function springTileLift(i, target) {
    const force = (target - tileLift[i]) * TILE_LIFT_SPRING;
    tileLiftVel[i] = (tileLiftVel[i] + force) * TILE_LIFT_DAMP;
    tileLift[i] += tileLiftVel[i];

    if (tileLift[i] > 0.65) {
        tileLift[i] = 0.65;
        tileLiftVel[i] *= -0.35;
    } else if (tileLift[i] < -0.65) {
        tileLift[i] = -0.65;
        tileLiftVel[i] *= -0.35;
    }
}

function buildSpatialGrid() {
    spatialGrid.clear();

    for (let i = 0; i < placements.length; i++) {
        const { cx, cy } = placements[i];
        const gx = Math.floor(cx / spatialCellSize);
        const gy = Math.floor(cy / spatialCellSize);
        const key = gx + "," + gy;

        if (!spatialGrid.has(key)) {
            spatialGrid.set(key, []);
        }

        spatialGrid.get(key).push(i);
    }
}

function updateTileMouseLift() {
    if (!tileLift || !mouseReady) {
        return;
    }

    if (getCombinedLoad() > PERF_SEVERE_MS) {
        return;
    }

    touchGen++;
    frictionScratch.clear();

    const speed = Math.hypot(mouseVX, mouseVY);

    if (speed >= FRICTION_MIN_SPEED) {
        if (prevFrictionX != null) {
            const dist = Math.hypot(mouseX - prevFrictionX, mouseY - prevFrictionY);
            const steps = Math.max(1, Math.ceil(dist / FRICTION_SAMPLE_STEP));

            for (let s = 0; s <= steps; s++) {
                const u = s / steps;
                applyFrictionAtPoint(
                    prevFrictionX + (mouseX - prevFrictionX) * u,
                    prevFrictionY + (mouseY - prevFrictionY) * u,
                    speed
                );
            }
        } else {
            applyFrictionAtPoint(mouseX, mouseY, speed);
        }
    }

    prevFrictionX = mouseX;
    prevFrictionY = mouseY;

    for (let i = 0; i < tileLift.length; i++) {
        if (tileTouch[i] === touchGen) {
            continue;
        }

        if (Math.abs(tileLift[i]) > 0.003 || Math.abs(tileLiftVel[i]) > 0.003) {
            springTileLift(i, 0);
        }
    }
}

function decayMouseVelocity(now) {
    if (now - lastMouseMoveTime > 48) {
        mouseVX *= 0.82;
        mouseVY *= 0.82;
    }
}

function updateOscillators(steps) {
    const n = values.length;
    if (!n) return;

    for (let step = 0; step < steps; step++) {
        for (let i = 0; i < n; i++) {
            const nbs = neighborList[i];
            let force = 0;

            if (nbs.length) {
                let sum = 0;
                for (let j = 0; j < nbs.length; j++) {
                    sum += values[nbs[j]];
                }
                const avg = sum / nbs.length;
                force += (avg - values[i]) * COUPLING;
            }

            force -= values[i] * RESTORE;

            velocities[i] = (velocities[i] + force * TIME_STEP) * DAMPING;
            velocities[i] += (Math.random() - 0.5) * RIPPLE_NOISE;
            values[i] += velocities[i] * TIME_STEP;

            if (values[i] > 1) {
                values[i] = 1;
                velocities[i] *= -0.28;
            } else if (values[i] < -1) {
                values[i] = -1;
                velocities[i] *= -0.28;
            }
        }
    }
}

function rebuildPlacements() {
    tileSize = pickTileSize();
    spatialCellSize = Math.max(28, Math.floor(tileSize * 0.85));
    placements = [];

    const layout = buildCairoGroup(tileSize);
    const { group, repSpacing, groupBounds } = layout;

    const bleed = repSpacing * 2;
    const startX = -groupBounds.minX - bleed;
    const startY = -groupBounds.minY - bleed;

    let tileId = 0;
    let col = 0;
    let maxRight = -Infinity;
    let rowMaxBottom = -Infinity;

    while (maxRight < w + bleed || col === 0) {
        let row = 0;
        rowMaxBottom = -Infinity;

        while (rowMaxBottom < h + bleed || row === 0) {
            const { ox, oy } = groupOrigin(col, row, startX, startY, layout);

            group.forEach((pent, pentIndex) => {
                const verts = translatePentagon(pent, ox, oy);
                const b = pentBounds(verts);

                maxRight = Math.max(maxRight, b.maxX);
                rowMaxBottom = Math.max(rowMaxBottom, b.maxY);

                placements.push({
                    verts,
                    seed: col * 1.91 + row * 2.47 + pentIndex * 1.33 + tileId * 0.17,
                    cx: (b.minX + b.maxX) * 0.5,
                    cy: (b.minY + b.maxY) * 0.5
                });

                tileId++;
            });

            row++;
            if (row > 600) break;
        }

        col++;
        if (col > 600) break;
    }

    buildNeighbors();
    buildSpatialGrid();
    initOscillators();
}

function drawGlassPentagon(verts, alpha) {
    const a = Math.max(0.015 * DISPLAY_OPACITY, alpha);

    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) {
        ctx.lineTo(verts[i].x, verts[i].y);
    }
    ctx.closePath();

    const b = pentBounds(verts);
    const grad = ctx.createLinearGradient(b.minX, b.minY, b.maxX, b.maxY);
    grad.addColorStop(0, `rgba(255, 255, 255, ${a * 1.35})`);
    grad.addColorStop(0.5, `rgba(160, 215, 255, ${a * 0.8})`);
    grad.addColorStop(1, `rgba(124, 77, 255, ${a * 0.5})`);

    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 255, 255, ${a * 1.05})`;
    ctx.lineWidth = 0.65;
    ctx.stroke();
}

function draw() {
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < placements.length; i++) {
        const ambient = values ? values[i] : 0;
        const lift = tileLift ? tileLift[i] : 0;
        const alpha =
            (BASE_VISIBILITY + OPACITY_SWING * ambient + MOUSE_LIFT_ALPHA * lift) * DISPLAY_OPACITY;
        drawGlassPentagon(placements[i].verts, alpha);
    }
}

function loop(now) {
    requestAnimationFrame(loop);
    if (!running) return;

    const frameInterval = getFrameInterval();
    if (lastTick && now - lastTick < frameInterval) return;

    const load = getCombinedLoad();
    if (load > PERF_SEVERE_MS + 5) {
        skipDrawFrame = !skipDrawFrame;
        if (skipDrawFrame) {
            lastTick = now;
            return;
        }
    }

    const t0 = performance.now();
    decayMouseVelocity(t0);
    updateTileMouseLift();

    if (values && neighborList.length && load <= PERF_SEVERE_MS) {
        const steps = load > PERF_CRITICAL_MS ? 1 : physicsSteps;
        updateOscillators(steps);
    }

    draw();

    const frameCost = performance.now() - t0;
    perfEma = perfEma * 0.86 + frameCost * 0.14;
    window.__fxTileLoad = perfEma;
    lastTick = now;

    if (frameCost > FRAME_COST_LIMIT_MS || load > PERF_WARN_MS) {
        lastTick += frameInterval * 0.5;
        physicsSteps = Math.max(1, physicsSteps - 1);
    } else if (frameCost < FRAME_COST_LIMIT_MS * 0.55 && physicsSteps < 2 && load < PERF_WARN_MS) {
        physicsSteps++;
    }
}

function resize() {
    dpr = window.devicePixelRatio || 1;
    w = window.innerWidth;
    viewH = window.innerHeight;
    h = getDocumentHeight();

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lastTick = 0;
    rebuildPlacements();
}

function syncDocumentHeight() {
    const nextH = getDocumentHeight();
    if (Math.abs(nextH - h) < 4) {
        return;
    }

    h = nextH;
    canvas.height = Math.floor(h * dpr);
    canvas.style.height = h + "px";
    lastTick = 0;
    rebuildPlacements();
}

window.addEventListener("resize", resize, { passive: true });
window.addEventListener("load", () => {
    setTimeout(syncDocumentHeight, 120);
    setTimeout(syncDocumentHeight, 800);
});

document.addEventListener(
    "mousemove",
    (e) => {
        const now = performance.now();

        if (mouseReady) {
            const dt = Math.max(1, now - lastMouseMoveTime);
            const pageY = getPageMouseY(e.clientY);
            mouseVX = (e.clientX - mouseX) / dt;
            mouseVY = (pageY - mouseY) / dt;
        } else {
            mouseReady = true;
            prevFrictionX = e.clientX;
            prevFrictionY = getPageMouseY(e.clientY);
        }

        mouseX = e.clientX;
        mouseY = getPageMouseY(e.clientY);
        lastMouseMoveTime = now;
    },
    { passive: true }
);

document.addEventListener("visibilitychange", () => {
    running = document.visibilityState === "visible";
    if (running) lastTick = 0;
});

resize();
requestAnimationFrame(loop);
